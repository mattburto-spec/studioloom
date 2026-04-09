import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { reanalyseDocument } from "@/lib/knowledge/analyse";
import { embedText } from "@/lib/ai/embeddings";
import { ANALYSIS_PROMPT_VERSION } from "@/lib/knowledge/analysis-prompts";
import type { LessonProfile, PartialTeachingContext, SchoolContext, TeacherPreferences } from "@/types/lesson-intelligence";

// Un-quarantined (9 Apr 2026) — Knowledge pipeline restored.

async function getTeacherId(request: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Build a searchable text summary for profile-level embedding.
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
    ...(profile.lesson_flow?.map((p) => `${p.title}: ${p.pedagogical_purpose}`) ?? []),
  ];
  return parts.filter(Boolean).join(". ");
}

/**
 * POST: Re-analyse an existing lesson profile with latest prompts.
 *
 * Uses the preserved raw_extracted_text from the lesson_profiles table.
 * Optionally accepts `all=true` query param to re-analyse ALL profiles
 * for this teacher (batch re-analysis).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 400 }
    );
  }

  const { id } = await params;
  const supabaseAdmin = createAdminClient();

  // Check if this is a batch re-analysis request
  const { searchParams } = new URL(request.url);
  const batchAll = searchParams.get("all") === "true";

  if (batchAll && id === "batch") {
    return handleBatchReanalysis(teacherId, supabaseAdmin);
  }

  // Single profile re-analysis
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("lesson_profiles")
    .select("id, raw_extracted_text, upload_id, title")
    .eq("id", id)
    .eq("teacher_id", teacherId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: "Lesson profile not found" },
      { status: 404 }
    );
  }

  if (!existing.raw_extracted_text) {
    return NextResponse.json(
      { error: "No raw text preserved for this profile — cannot re-analyse" },
      { status: 400 }
    );
  }

  // Fetch teacher profile for context
  const teachingContext = await fetchTeachingContext(teacherId, supabaseAdmin);

  // Get filename from upload record
  let filename = existing.title || "unknown";
  if (existing.upload_id) {
    const { data: uploadRow } = await supabaseAdmin
      .from("knowledge_uploads")
      .select("filename")
      .eq("id", existing.upload_id)
      .single();
    if (uploadRow?.filename) filename = uploadRow.filename;
  }

  try {
    // Update status
    if (existing.upload_id) {
      await supabaseAdmin
        .from("knowledge_uploads")
        .update({ status: "analysing", analysis_stage: "pass1_structure" })
        .eq("id", existing.upload_id);
    }

    const result = await reanalyseDocument(
      existing.raw_extracted_text,
      filename,
      async (stage) => {
        if (existing.upload_id) {
          await supabaseAdmin
            .from("knowledge_uploads")
            .update({ analysis_stage: stage })
            .eq("id", existing.upload_id);
        }
      },
      teachingContext
    );

    const profile = result.profile;

    // Generate new embedding
    let profileEmbedding: number[] | null = null;
    try {
      profileEmbedding = await embedText(buildProfileEmbeddingText(profile));
    } catch {
      // Non-critical
    }

    // Extract criteria
    const criteriaCovered =
      profile.criteria_analysis?.map((c) => c.criterion).filter(Boolean) ?? [];

    // Update the profile in DB
    await supabaseAdmin
      .from("lesson_profiles")
      .update({
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
        analysis_version: ANALYSIS_PROMPT_VERSION,
        analysis_model: profile.analysis_model,
        embedding: profileEmbedding?.length
          ? `[${profileEmbedding.join(",")}]`
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Update upload status
    if (existing.upload_id) {
      await supabaseAdmin
        .from("knowledge_uploads")
        .update({ status: "complete", analysis_stage: "complete" })
        .eq("id", existing.upload_id);
    }

    return NextResponse.json({
      profileId: id,
      profile,
      analysisVersion: ANALYSIS_PROMPT_VERSION,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Re-analysis failed";

    if (existing.upload_id) {
      await supabaseAdmin
        .from("knowledge_uploads")
        .update({ status: "analysed", analysis_stage: "error" })
        .eq("id", existing.upload_id);
    }

    return NextResponse.json(
      { error: `Re-analysis failed: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * Batch re-analyse all profiles for a teacher.
 * Returns count of profiles queued for re-analysis.
 */
async function handleBatchReanalysis(
  teacherId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any
) {
  const { data: profiles, error } = await supabaseAdmin
    .from("lesson_profiles")
    .select("id, analysis_version")
    .eq("teacher_id", teacherId);

  if (error || !profiles) {
    return NextResponse.json(
      { error: "Failed to fetch profiles" },
      { status: 500 }
    );
  }

  // Filter to profiles that need re-analysis (older version)
  const outdated = profiles.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => p.analysis_version !== ANALYSIS_PROMPT_VERSION
  );

  // For now, return the count and let the client trigger individual re-analyses
  // A background job would be better for large batches
  return NextResponse.json({
    totalProfiles: profiles.length,
    outdatedProfiles: outdated.length,
    currentVersion: ANALYSIS_PROMPT_VERSION,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    outdatedIds: outdated.map((p: any) => p.id),
  });
}

/**
 * Fetch teacher's teaching context for re-analysis.
 */
async function fetchTeachingContext(
  teacherId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any
): Promise<PartialTeachingContext | undefined> {
  try {
    const { data: tp } = await supabaseAdmin
      .from("teacher_profiles")
      .select("school_context, teacher_preferences, school_name, country, curriculum_framework, typical_period_minutes, subjects_taught, grade_levels_taught")
      .eq("teacher_id", teacherId)
      .single();

    if (!tp) return undefined;

    return {
      schoolContext: tp.school_context as Partial<SchoolContext> | undefined,
      teacherPreferences: tp.teacher_preferences as Partial<TeacherPreferences> | undefined,
      schoolName: tp.school_name ?? undefined,
      country: tp.country ?? undefined,
      curriculumFramework: tp.curriculum_framework ?? undefined,
      typicalPeriodMinutes: tp.typical_period_minutes ?? undefined,
      subjectsTaught: tp.subjects_taught ?? undefined,
      gradeLevelsTaught: tp.grade_levels_taught ?? undefined,
    };
  } catch {
    return undefined;
  }
}
