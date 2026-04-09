import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import {
  chunkDocument,
  chunkDocumentWithProfile,
  type ChunkMetadata,
} from "@/lib/knowledge/chunk";
import { embedAll, embedText } from "@/lib/ai/embeddings";
import { analyseDocument, reanalyseDocument } from "@/lib/knowledge/analyse";
import { ANALYSIS_PROMPT_VERSION } from "@/lib/knowledge/analysis-prompts";
import type {
  LessonProfile,
  PartialTeachingContext,
  SchoolContext,
  TeacherPreferences,
} from "@/types/lesson-intelligence";
import type { ExtractedDoc } from "@/lib/knowledge/extract";

// Un-quarantined (9 Apr 2026) — Knowledge pipeline restored.

export const maxDuration = 300; // 5 minutes — same as upload route

/**
 * Build a searchable text summary for profile-level embedding.
 * (Same as in upload route)
 */
function buildProfileEmbeddingText(profile: LessonProfile): string {
  const parts = [
    profile.title,
    profile.subject_area,
    profile.grade_level,
    profile.pedagogical_approach?.primary,
    profile.scaffolding_strategy?.model,
    ...(profile.strengths?.map((s) => s.what) ?? []),
    ...(profile.skills_developed?.map((s) => s.skill) ?? []),
    ...(profile.lesson_flow?.map(
      (p) => `${p.title}: ${p.pedagogical_purpose}`
    ) ?? []),
  ];
  return parts.filter(Boolean).join(". ");
}

/**
 * POST: Re-analyse an existing knowledge upload with latest prompts.
 *
 * Body: { uploadId: string }
 *
 * Pipeline:
 * 1. Fetch knowledge_uploads record, verify teacher ownership
 * 2. Get raw_extracted_text from upload
 * 3. Fetch teacher profile for analysis context
 * 4. Run 3-pass AI analysis using latest prompts
 * 5. UPSERT lesson_profiles row (update if exists, insert if not)
 * 6. Delete existing knowledge_chunks for this upload
 * 7. Re-chunk document with new profile
 * 8. Embed and store chunks
 * 9. Update upload status to "analysed"
 * 10. Return profile
 *
 * Response: { success: true, profileId, profile }
 */
export const POST = withErrorHandler(
  "teacher/knowledge/reanalyse:POST",
  async (request: NextRequest) => {
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    let body: { uploadId?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { uploadId } = body;

    if (!uploadId) {
      return NextResponse.json(
        { error: "uploadId is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // ─── Fetch upload record and verify ownership ───
    const { data: upload, error: uploadError } = await supabaseAdmin
      .from("knowledge_uploads")
      .select(
        "id, filename, raw_extracted_text, source_category, teacher_id"
      )
      .eq("id", uploadId)
      .eq("teacher_id", teacherId)
      .single();

    if (uploadError || !upload) {
      return NextResponse.json(
        { error: "Upload not found or access denied" },
        { status: 404 }
      );
    }

    if (!upload.raw_extracted_text) {
      return NextResponse.json(
        { error: "Upload has no extracted text. Cannot re-analyse." },
        { status: 400 }
      );
    }

    // ─── Update status to "reanalysing" ───
    await supabaseAdmin
      .from("knowledge_uploads")
      .update({ status: "reanalysing", analysis_stage: "reanalysing" })
      .eq("id", uploadId);

    // ─── Fetch teacher profile for teaching context ───
    let teachingContext: PartialTeachingContext | undefined;
    try {
      const { data: teacherProfile } = await supabaseAdmin
        .from("teacher_profiles")
        .select(
          "school_context, teacher_preferences, school_name, country, curriculum_framework, typical_period_minutes, subjects_taught, grade_levels_taught"
        )
        .eq("teacher_id", teacherId)
        .single();

      if (teacherProfile) {
        teachingContext = {
          schoolContext: teacherProfile.school_context as Partial<SchoolContext> | undefined,
          teacherPreferences: teacherProfile.teacher_preferences as Partial<TeacherPreferences> | undefined,
          schoolName: teacherProfile.school_name ?? undefined,
          country: teacherProfile.country ?? undefined,
          curriculumFramework: teacherProfile.curriculum_framework ?? undefined,
          typicalPeriodMinutes: teacherProfile.typical_period_minutes ?? undefined,
          subjectsTaught: teacherProfile.subjects_taught ?? undefined,
          gradeLevelsTaught: teacherProfile.grade_levels_taught ?? undefined,
        };
      }
    } catch {
      // Non-fatal
    }

    // ─── Run 3-pass AI analysis ───
    let analysisResult;
    try {
      analysisResult = await reanalyseDocument(
        upload.raw_extracted_text,
        upload.filename,
        async (stage) => {
          // Update progress in DB
          await supabaseAdmin
            .from("knowledge_uploads")
            .update({ analysis_stage: stage })
            .eq("id", uploadId);
        },
        teachingContext,
        upload.source_category ?? undefined
      );
    } catch (analysisErr) {
      const msg =
        analysisErr instanceof Error
          ? analysisErr.message
          : "Analysis failed";
      console.error("[reanalyse] AI analysis failed:", msg);

      await supabaseAdmin
        .from("knowledge_uploads")
        .update({
          status: "failed",
          error_message: `Re-analysis failed: ${msg}`,
        })
        .eq("id", uploadId);

      return NextResponse.json(
        { error: `Re-analysis failed: ${msg}` },
        { status: 500 }
      );
    }

    const profile = analysisResult.profile;

    console.log(
      `[reanalyse] Analysis complete: "${profile.title}" | ${profile.subject_area} | ${profile.grade_level} | ${profile.pedagogical_approach?.primary} | ${profile.criteria_analysis?.length || 0} criteria`
    );

    // ─── UPSERT lesson_profiles ───
    const criteriaCovered =
      profile.criteria_analysis
        ?.map((c) => c.criterion)
        .filter(Boolean) ?? [];

    let profileEmbedding: number[] | null = null;
    try {
      profileEmbedding = await embedText(buildProfileEmbeddingText(profile));
    } catch {
      // Non-critical
    }

    // First, check if a profile already exists for this upload
    const { data: existingProfile } = await supabaseAdmin
      .from("lesson_profiles")
      .select("id")
      .eq("upload_id", uploadId)
      .eq("teacher_id", teacherId)
      .single();

    let profileId: string | null = null;

    const profileData = {
      teacher_id: teacherId,
      upload_id: uploadId,
      title: profile.title,
      subject_area: profile.subject_area || null,
      grade_level: profile.grade_level || null,
      estimated_duration_minutes: profile.estimated_duration_minutes || null,
      lesson_type: profile.lesson_type || "single_lesson",
      pedagogical_approach: profile.pedagogical_approach?.primary || null,
      scaffolding_model: profile.scaffolding_strategy?.model || null,
      complexity_level: profile.complexity_level || null,
      criteria_covered: criteriaCovered,
      profile_data: profile,
      raw_extracted_text: upload.raw_extracted_text,
      analysis_version: ANALYSIS_PROMPT_VERSION,
      analysis_model: profile.analysis_model,
      embedding: profileEmbedding?.length
        ? `[${profileEmbedding.join(",")}]`
        : null,
    };

    if (existingProfile) {
      // Update existing profile
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("lesson_profiles")
        .update(profileData)
        .eq("id", existingProfile.id)
        .select("id")
        .single();

      if (updateError) {
        console.error("[reanalyse] Profile update failed:", updateError.message);
      } else {
        profileId = updated?.id ?? null;
      }
    } else {
      // Insert new profile
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("lesson_profiles")
        .insert(profileData)
        .select("id")
        .single();

      if (insertError) {
        console.error("[reanalyse] Profile insert failed:", insertError.message);
      } else {
        profileId = inserted?.id ?? null;
      }
    }

    // ─── Delete existing chunks for this upload ───
    await supabaseAdmin
      .from("knowledge_chunks")
      .delete()
      .eq("source_id", uploadId)
      .eq("teacher_id", teacherId);

    // ─── Build metadata for chunking ───
    const metadata: ChunkMetadata = {
      source_type: "uploaded_plan",
      source_id: uploadId,
      source_filename: upload.filename,
      teacher_id: teacherId,
      is_public: false,
      source_category: upload.source_category ?? undefined,
      ...(profile?.grade_level && { grade_level: profile.grade_level }),
      ...(profile?.subject_area && { subject_area: profile.subject_area }),
      ...(profile?.title && { topic: profile.title }),
    };

    // ─── Re-chunk with updated profile ───
    // For re-analysis, we need to reconstruct an ExtractedDoc-like structure
    // Since we only have raw text, we'll use chunkDocument (not chunkDocumentWithProfile)
    // unless the profile has lesson_flow with good phase data
    const doc: ExtractedDoc = {
      rawText: upload.raw_extracted_text,
      title: profile.title || "Re-analysed Document",
      sections: profile.lesson_flow?.map((phase) => ({
        heading: phase.title,
        content: phase.description || "",
        content_summary: phase.description || "",
        activity_type: phase.activity_type,
        estimated_minutes: phase.estimated_minutes,
        materials_mentioned: phase.materials_needed || [],
        tools_mentioned: phase.tools_required || [],
      })) ?? [
        {
          heading: "Content",
          content: upload.raw_extracted_text,
          content_summary: upload.raw_extracted_text.slice(0, 200),
          activity_type: "text",
          estimated_minutes: profile.estimated_duration_minutes || 60,
          materials_mentioned: [],
          tools_mentioned: [],
        },
      ],
    };

    const chunks = profile.lesson_flow?.length
      ? chunkDocumentWithProfile(doc, metadata, profile)
      : chunkDocument(doc, metadata);

    if (chunks.length === 0) {
      // No chunks produced — mark as analysed with 0 chunks
      await supabaseAdmin
        .from("knowledge_uploads")
        .update({
          status: "analysed",
          analysis_stage: "complete",
          chunk_count: 0,
          lesson_profile_id: profileId,
        })
        .eq("id", uploadId);

      return NextResponse.json({
        success: true,
        profileId,
        profile,
        chunkCount: 0,
      });
    }

    // ─── Generate chunk embeddings ───
    const texts = chunks.map((c) => c.content);
    let embeddings: number[][];
    try {
      embeddings = await embedAll(texts);
    } catch {
      embeddings = texts.map(() => []);
    }

    // ─── Insert chunks ───
    const rows = chunks.map((chunk, i) => ({
      source_type: chunk.metadata.source_type,
      source_id: chunk.metadata.source_id,
      source_filename: chunk.metadata.source_filename,
      teacher_id: chunk.metadata.teacher_id,
      content: chunk.content,
      criterion: chunk.criterion,
      page_id: chunk.page_id,
      content_type: chunk.content_type,
      grade_level: chunk.metadata.grade_level || null,
      subject_area: chunk.metadata.subject_area || null,
      topic: chunk.metadata.topic || null,
      is_public: false,
      embedding: embeddings[i]?.length ? `[${embeddings[i].join(",")}]` : null,
      // Dimensions v2 metadata (migration 058 — graceful if columns don't exist yet)
      ...(chunk.metadata.bloom_level
        ? { bloom_level: chunk.metadata.bloom_level }
        : {}),
      ...(chunk.metadata.grouping ? { grouping: chunk.metadata.grouping } : {}),
      ...(chunk.metadata.udl_checkpoints?.length
        ? { udl_checkpoints: chunk.metadata.udl_checkpoints }
        : {}),
    }));

    let insertError;
    ({ error: insertError } = await supabaseAdmin
      .from("knowledge_chunks")
      .insert(rows));

    // Retry without Dimensions v2 columns if migration 058 not applied yet
    if (
      insertError &&
      (insertError.message.includes("bloom_level") ||
        insertError.message.includes("grouping") ||
        insertError.message.includes("udl_checkpoints"))
    ) {
      console.warn(
        "[reanalyse] Retrying chunk insert without Dimensions v2 columns"
      );
      const fallbackRows = rows.map(
        ({ bloom_level, grouping, udl_checkpoints, ...rest }: Record<string, unknown>) => rest
      );
      ({ error: insertError } = await supabaseAdmin
        .from("knowledge_chunks")
        .insert(fallbackRows));
    }

    if (insertError) {
      throw new Error(`Chunk insert failed: ${insertError.message}`);
    }

    // ─── Update upload status to complete ───
    await supabaseAdmin
      .from("knowledge_uploads")
      .update({
        status: "analysed",
        analysis_stage: "complete",
        chunk_count: chunks.length,
        lesson_profile_id: profileId,
      })
      .eq("id", uploadId);

    return NextResponse.json({
      success: true,
      profileId,
      profile,
      chunkCount: chunks.length,
    });
  }
);
