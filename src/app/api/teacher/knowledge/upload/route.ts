import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractDocument } from "@/lib/knowledge/extract";
import { chunkDocument, chunkDocumentWithProfile, type ChunkMetadata } from "@/lib/knowledge/chunk";
import { embedAll, embedText } from "@/lib/ai/embeddings";
import { analyseDocument } from "@/lib/knowledge/analyse";
import { extractVisualContent, type VisualExtractionResult } from "@/lib/knowledge/vision";
import { ANALYSIS_PROMPT_VERSION } from "@/lib/knowledge/analysis-prompts";
import { onLessonUploaded } from "@/lib/teacher-style/profile-service";
import { createKnowledgeItem } from "@/lib/knowledge-library";
import type { LessonProfile, PartialTeachingContext, SchoolContext, TeacherPreferences } from "@/types/lesson-intelligence";
import type { TextbookSectionContent, LessonResourceContent } from "@/types/knowledge-library";
import { UPLOAD_STAGE_CONFIG, type UploadSSEEvent, type UploadStage } from "@/types/upload-progress";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

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
 * Combines the most important fields into a single string.
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
 * POST: Upload a lesson plan file for knowledge base ingestion.
 *
 * Pipeline:
 * 1. Extract text from document
 * 2. Run 3-pass AI analysis (Structure → Pedagogy → Design Teaching)
 * 3. Store lesson profile in lesson_profiles table
 * 4. Chunk document with analysis-enriched metadata
 * 5. Embed chunks + profile
 * 6. Store chunks in knowledge_chunks
 *
 * The response includes the profile so the UI can show
 * a rich review screen immediately after upload.
 */
export async function POST(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  // Support skipping analysis for quick imports
  const skipAnalysis = formData.get("skipAnalysis") === "true";

  // Source category for textbook extensibility (lesson_plan | textbook | resource)
  const sourceCategory = formData.get("source_category") as string || "lesson_plan";
  const collection = formData.get("collection") as string || null;

  // Optional client-generated thumbnail (JPEG blob from PDF page 1)
  const thumbnailFile = formData.get("thumbnail") as File | null;

  // Optional page images (all pages rendered client-side)
  const pageImageFiles = formData.getAll("page_images") as File[];

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 20MB." },
      { status: 400 }
    );
  }

  // Validate file type
  const fileType = file.type || "";
  const filename = file.name || "unknown";
  const ext = filename.toLowerCase().split(".").pop();

  if (!ALLOWED_TYPES.includes(fileType) && !["pdf", "docx", "pptx"].includes(ext || "")) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload PDF, DOCX, or PPTX files." },
      { status: 400 }
    );
  }

  const supabaseAdmin = createAdminClient();

  // Create upload tracking record
  // Try with source_category first (requires migration 020), fallback without
  const baseInsert = {
    teacher_id: teacherId,
    filename,
    file_type: ext || fileType,
    file_size: file.size,
    status: "processing",
    analysis_stage: "extracting",
    ...(collection && { collection }),
  };

  let upload: { id: string } | null = null;
  let uploadError: { message: string } | null = null;

  const result1 = await supabaseAdmin
    .from("knowledge_uploads")
    .insert({ ...baseInsert, source_category: sourceCategory })
    .select("id")
    .single();

  if (result1.error) {
    // Retry without source_category (migration 020 not applied yet)
    const result2 = await supabaseAdmin
      .from("knowledge_uploads")
      .insert(baseInsert)
      .select("id")
      .single();
    upload = result2.data;
    uploadError = result2.error;
  } else {
    upload = result1.data;
  }

  if (uploadError || !upload) {
    console.error("[upload] Insert failed:", uploadError?.message);
    return NextResponse.json(
      { error: `Failed to create upload record: ${uploadError?.message || "unknown error"}` },
      { status: 500 }
    );
  }

  const uploadId = upload.id;

  // ─── Read file buffer before streaming (Next.js requires body consumed first) ───
  const buffer = Buffer.from(await file.arrayBuffer());

  // Read thumbnail + page image buffers eagerly
  let thumbnailBuffer: ArrayBuffer | null = null;
  if (thumbnailFile && thumbnailFile.size > 0) {
    thumbnailBuffer = await thumbnailFile.arrayBuffer();
  }
  const pageImageBuffers: { buffer: ArrayBuffer; name: string }[] = [];
  for (let i = 0; i < pageImageFiles.length; i++) {
    const imgFile = pageImageFiles[i];
    if (imgFile && imgFile.size > 0) {
      pageImageBuffers.push({ buffer: await imgFile.arrayBuffer(), name: `page_${i + 1}.jpg` });
    }
  }

  // ─── SSE streaming response ───
  const encoder = new TextEncoder();

  function sendEvent(controller: ReadableStreamDefaultController, event: UploadSSEEvent) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  }

  function emitStage(controller: ReadableStreamDefaultController, stage: UploadStage) {
    const config = UPLOAD_STAGE_CONFIG[stage];
    sendEvent(controller, {
      type: "progress",
      stage,
      percent: config.percent,
      message: config.messages[0],
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ─── Step 0.5: Store original file (never lose it) ───
        emitStage(controller, "extracting");
        let originalFilePath: string | null = null;
        try {
          const storagePath = `${teacherId}/originals/${uploadId}/${filename}`;
          const { data: fileData, error: fileErr } = await supabaseAdmin.storage
            .from("knowledge-media")
            .upload(storagePath, buffer, {
              contentType: fileType || "application/octet-stream",
              upsert: true,
            });
          if (!fileErr && fileData) {
            originalFilePath = fileData.path;
            console.log(`[upload] Original file stored: ${storagePath}`);
          }
        } catch (origErr) {
          console.warn("[upload] Original file storage failed:", origErr);
        }

        // ─── Step 1: Extract text ───
        const doc = await extractDocument(buffer, filename, fileType);

        // ─── Step 1.5: Extract visual content ───
        let visionResult: VisualExtractionResult = {
          descriptions: [],
          totalImagesFound: 0,
          method: "skipped",
        };

        try {
          emitStage(controller, "vision");
          await supabaseAdmin
            .from("knowledge_uploads")
            .update({ analysis_stage: "vision" })
            .eq("id", uploadId);

          visionResult = await extractVisualContent(buffer, filename, fileType);

          if (visionResult.descriptions.length > 0) {
            console.log(
              `[upload] Found ${visionResult.descriptions.length} visual elements via ${visionResult.method}`
            );

            for (const visual of visionResult.descriptions) {
              doc.sections.push({
                heading: `[Visual: ${visual.type}] Page ${visual.pageOrSlide}`,
                content: [
                  visual.description,
                  visual.educationalContext &&
                    `Educational context: ${visual.educationalContext}`,
                  visual.visibleText &&
                    `Visible text/labels: ${visual.visibleText}`,
                ]
                  .filter(Boolean)
                  .join("\n\n"),
              });
            }

            const visualSummary = visionResult.descriptions
              .map(
                (v) =>
                  `[Visual - ${v.type} on page ${v.pageOrSlide}]: ${v.description}`
              )
              .join("\n\n");
            doc.rawText += `\n\n--- Visual Content ---\n\n${visualSummary}`;
          }
        } catch (visionErr) {
          console.warn("[upload] Vision extraction failed:", visionErr);
        }

        // Check content quality
        const hasText = doc.rawText && doc.rawText.trim().length >= 50;
        const hasVisuals = visionResult.descriptions.length > 0;

        if (!hasText && !hasVisuals) {
          await supabaseAdmin
            .from("knowledge_uploads")
            .update({
              status: "failed",
              error_message: "No meaningful content could be extracted from file",
            })
            .eq("id", uploadId);

          sendEvent(controller, { type: "error", error: "No content could be extracted from this file." });
          controller.close();
          return;
        }

        // Store raw text immediately
        await supabaseAdmin
          .from("knowledge_uploads")
          .update({
            status: "extracted",
            analysis_stage: "extracted",
            raw_extracted_text: doc.rawText,
            ...(originalFilePath && { original_file_path: originalFilePath }),
          })
          .eq("id", uploadId);

        // ─── Step 1.9: Fetch teacher profile for analysis context ───
        let teachingContext: PartialTeachingContext | undefined;
        try {
          const { data: teacherProfile } = await supabaseAdmin
            .from("teacher_profiles")
            .select("school_context, teacher_preferences, school_name, country, curriculum_framework, typical_period_minutes, subjects_taught, grade_levels_taught")
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
            console.log(`[upload] Teaching context loaded: ${teacherProfile.school_name || "unnamed school"}, ${teacherProfile.curriculum_framework || "no framework"}`);
          }
        } catch {
          // Non-fatal
        }

        // ─── Step 2: 3-Pass AI Analysis (unless skipped) ───
        let profile: LessonProfile | null = null;
        let profileId: string | null = null;

        if (!skipAnalysis && process.env.ANTHROPIC_API_KEY) {
          emitStage(controller, "pass0_classify");
          await supabaseAdmin
            .from("knowledge_uploads")
            .update({ analysis_stage: "pass0_classify" })
            .eq("id", uploadId);

          emitStage(controller, "pass1_structure");
          await supabaseAdmin
            .from("knowledge_uploads")
            .update({ status: "analysing", analysis_stage: "pass1_structure" })
            .eq("id", uploadId);

          try {
            const analysisResult = await analyseDocument({
              extractedText: doc.rawText,
              filename,
              teachingContext,
              sourceCategory,
              onProgress: async (stage) => {
                // Emit SSE progress + update DB
                const stageKey = stage as UploadStage;
                if (UPLOAD_STAGE_CONFIG[stageKey]) {
                  emitStage(controller, stageKey);
                }
                await supabaseAdmin
                  .from("knowledge_uploads")
                  .update({ analysis_stage: stage })
                  .eq("id", uploadId);
              },
            });

            profile = analysisResult.profile;

            console.log(`[upload] Analysis complete: "${profile.title}" | ${profile.subject_area} | ${profile.grade_level} | ${profile.pedagogical_approach?.primary} | ${profile.criteria_analysis?.length || 0} criteria | ${profile.strengths?.length || 0} strengths | ${profile.lesson_flow?.length || 0} phases`);

            // Store profile
            emitStage(controller, "storing_profile");

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

            const { data: profileRow, error: profileError } = await supabaseAdmin
              .from("lesson_profiles")
              .insert({
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
                raw_extracted_text: doc.rawText,
                analysis_version: ANALYSIS_PROMPT_VERSION,
                analysis_model: profile.analysis_model,
                embedding: profileEmbedding?.length
                  ? `[${profileEmbedding.join(",")}]`
                  : null,
              })
              .select("id")
              .single();

            if (profileError) {
              console.error("[upload] Profile insert failed:", profileError.message);
            } else {
              profileId = profileRow?.id ?? null;
            }

            if (profileId) {
              await supabaseAdmin
                .from("knowledge_uploads")
                .update({
                  status: "analysed",
                  analysis_stage: "analysed",
                  lesson_profile_id: profileId,
                })
                .eq("id", uploadId);

              // Signal teacher style profile: lesson uploaded
              if (analysisResult.pass1) {
                onLessonUploaded(teacherId, analysisResult.pass1).catch(() => {
                  // Non-fatal — style profile update failure shouldn't block upload
                });
              }
            }
          } catch (analysisErr) {
            const msg = analysisErr instanceof Error ? analysisErr.message : "Analysis failed";
            console.error("[upload] AI analysis failed:", msg);
            // Continue to chunking
          }
        }

        // ─── Step 4: Chunk the document ───
        emitStage(controller, "chunking");
        const metadata: ChunkMetadata = {
          source_type: "uploaded_plan",
          source_id: uploadId,
          source_filename: filename,
          teacher_id: teacherId,
          is_public: false,
          source_category: sourceCategory,
          ...(profile?.grade_level && { grade_level: profile.grade_level }),
          ...(profile?.subject_area && { subject_area: profile.subject_area }),
          ...(profile?.title && { topic: profile.title }),
        };
        const chunks = profile?.lesson_flow?.length
          ? chunkDocumentWithProfile(doc, metadata, profile)
          : chunkDocument(doc, metadata);

        if (chunks.length === 0) {
          if (profile && profileId) {
            await supabaseAdmin
              .from("knowledge_uploads")
              .update({ status: "analysed", chunk_count: 0 })
              .eq("id", uploadId);

            sendEvent(controller, {
              type: "complete",
              uploadId,
              filename,
              chunkCount: 0,
              imageCount: visionResult.descriptions.length,
              title: profile.title,
              profileId: profileId || undefined,
              profile,
              analysed: true,
            });
            controller.close();
            return;
          }

          await supabaseAdmin
            .from("knowledge_uploads")
            .update({
              status: "failed",
              error_message: "No content could be extracted from file",
            })
            .eq("id", uploadId);

          sendEvent(controller, { type: "error", error: "No content could be extracted from this file." });
          controller.close();
          return;
        }

        // ─── Step 5: Generate chunk embeddings ───
        emitStage(controller, "embedding");
        const texts = chunks.map((c) => c.content);
        let embeddings: number[][];
        try {
          embeddings = await embedAll(texts);
        } catch {
          embeddings = texts.map(() => []);
        }

        // ─── Step 6: Insert chunks ───
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
        }));

        const { error: insertError } = await supabaseAdmin
          .from("knowledge_chunks")
          .insert(rows);

        if (insertError) {
          throw new Error(`Chunk insert failed: ${insertError.message}`);
        }

        // ─── Step 7: Auto-create a Knowledge Library item ───
        emitStage(controller, "creating_library_item");
        const docTitle = profile?.title ?? doc.title ?? filename.replace(/\.[^.]+$/, "");
        const itemType = sourceCategory === "textbook" ? "textbook-section" : "lesson-resource";

        const itemContent = sourceCategory === "textbook"
          ? {
              key_points: profile?.strengths?.length
                ? profile.strengths.slice(0, 5).map((s) => s.what)
                : doc.sections.slice(0, 10).map((s) => s.heading),
              ...(profile?.grade_level && { chapter: profile.grade_level }),
            } as TextbookSectionContent
          : {
              notes: profile?.lesson_flow?.length
                ? profile.lesson_flow.map((phase) => `**${phase.phase}** (${phase.estimated_minutes ? `${phase.estimated_minutes}min` : ""}): ${phase.description || ""}`).join("\n\n").slice(0, 1000)
                : doc.sections.map((s) => `**${s.heading}**\n${s.content.slice(0, 200)}`).join("\n\n").slice(0, 1000),
            } as LessonResourceContent;

        const descParts: string[] = [];
        if (profile?.subject_area) descParts.push(profile.subject_area);
        if (profile?.grade_level) descParts.push(profile.grade_level);
        if (profile?.pedagogical_approach?.primary) descParts.push(profile.pedagogical_approach.primary);
        if (profile?.criteria_analysis?.length) {
          const criteria = profile.criteria_analysis.map((ca) => ca.criterion).filter(Boolean);
          if (criteria.length) descParts.push(`Criteria: ${criteria.join(", ")}`);
        }
        if (profile?.strengths?.length) {
          descParts.push(profile.strengths[0].what);
        }
        const itemDescription = descParts.length > 0
          ? descParts.join(" · ")
          : `Uploaded ${ext?.toUpperCase() || "document"} — ${chunks.length} chunks indexed`;

        const itemTags: string[] = [];
        if (profile?.criteria_analysis) {
          for (const ca of profile.criteria_analysis) {
            if (ca.criterion) itemTags.push(`criterion-${ca.criterion.toLowerCase()}`);
          }
        }
        if (sourceCategory === "textbook") itemTags.push("textbook");
        if (sourceCategory === "lesson_plan") itemTags.push("lesson-plan");
        if (sourceCategory === "resource") itemTags.push("resource");
        if (profile?.subject_area) itemTags.push(profile.subject_area.toLowerCase());
        if (profile?.grade_level) itemTags.push(profile.grade_level.toLowerCase());

        // Upload thumbnail
        let thumbnailUrl: string | undefined;
        if (thumbnailBuffer) {
          try {
            const thumbPath = `${teacherId}/thumb_${uploadId}.jpg`;
            const { data: thumbData, error: thumbErr } = await supabaseAdmin.storage
              .from("knowledge-media")
              .upload(thumbPath, thumbnailBuffer, { contentType: "image/jpeg", upsert: true });
            if (!thumbErr && thumbData) {
              const { data: { publicUrl } } = supabaseAdmin.storage
                .from("knowledge-media")
                .getPublicUrl(thumbData.path);
              thumbnailUrl = publicUrl;
            }
          } catch (thumbErr) {
            console.warn("[upload] Thumbnail upload failed:", thumbErr);
          }
        }

        // Upload page images
        const pageImageUrls: string[] = [];
        for (let i = 0; i < pageImageBuffers.length; i++) {
          try {
            const imgPath = `${teacherId}/${uploadId}/${pageImageBuffers[i].name}`;
            const { data: imgData, error: imgErr } = await supabaseAdmin.storage
              .from("knowledge-media")
              .upload(imgPath, pageImageBuffers[i].buffer, { contentType: "image/jpeg", upsert: true });
            if (!imgErr && imgData) {
              const { data: { publicUrl } } = supabaseAdmin.storage
                .from("knowledge-media")
                .getPublicUrl(imgData.path);
              pageImageUrls.push(publicUrl);
            }
          } catch {
            // Non-fatal
          }
        }

        // Store DOCX embedded images
        if (visionResult.method === "docx-images" && visionResult.imageBuffers?.length) {
          for (let i = 0; i < visionResult.imageBuffers.length; i++) {
            try {
              const buf = visionResult.imageBuffers[i];
              const imgPath = `${teacherId}/${uploadId}/embedded_${i + 1}.${buf.ext}`;
              const { data: imgData, error: imgErr } = await supabaseAdmin.storage
                .from("knowledge-media")
                .upload(imgPath, buf.data, { contentType: `image/${buf.ext}`, upsert: true });
              if (!imgErr && imgData) {
                const { data: { publicUrl } } = supabaseAdmin.storage
                  .from("knowledge-media")
                  .getPublicUrl(imgData.path);
                pageImageUrls.push(publicUrl);
              }
            } catch {
              // Non-fatal
            }
          }
        }

        if (pageImageUrls.length > 0) {
          (itemContent as Record<string, unknown>).page_images = pageImageUrls;
        }

        try {
          await createKnowledgeItem(
            {
              title: docTitle,
              description: itemDescription,
              item_type: itemType,
              tags: itemTags,
              content: itemContent,
              source_type: "upload",
              source_upload_id: uploadId,
              ...(thumbnailUrl && { thumbnail_url: thumbnailUrl }),
              ...(collection && { collection }),
            },
            teacherId
          );
        } catch (itemErr) {
          console.warn("[upload] Knowledge item creation failed:", itemErr);
        }

        // ─── Step 8: Mark complete ───
        await supabaseAdmin
          .from("knowledge_uploads")
          .update({
            status: "complete",
            chunk_count: chunks.length,
            analysis_stage: profile ? "complete" : null,
          })
          .eq("id", uploadId);

        sendEvent(controller, {
          type: "complete",
          uploadId,
          filename,
          chunkCount: chunks.length,
          imageCount: visionResult.descriptions.length,
          title: docTitle,
          ...(profile && { profileId: profileId || undefined, profile, analysed: true }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Processing failed";
        console.error("[knowledge/upload] Error:", message);

        await supabaseAdmin
          .from("knowledge_uploads")
          .update({ status: "failed", error_message: message })
          .eq("id", uploadId);

        sendEvent(controller, { type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * GET: List teacher's uploads (with linked profile IDs)
 */
export async function GET(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();

  // Try with source_category (migration 020), fallback without
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uploads: any[] | null = null;

  const r1 = await supabaseAdmin
    .from("knowledge_uploads")
    .select(
      "id, filename, file_type, file_size, chunk_count, status, analysis_stage, lesson_profile_id, error_message, source_category, created_at"
    )
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  if (r1.error) {
    // Fallback: migration 020 not applied yet
    const r2 = await supabaseAdmin
      .from("knowledge_uploads")
      .select(
        "id, filename, file_type, file_size, chunk_count, status, analysis_stage, lesson_profile_id, error_message, created_at"
      )
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    uploads = r2.data;
  } else {
    uploads = r1.data;
  }

  // Get total chunk count for this teacher
  const { count } = await supabaseAdmin
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId);

  // Get total profile count
  const { count: profileCount } = await supabaseAdmin
    .from("lesson_profiles")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId);

  return NextResponse.json({
    uploads: uploads || [],
    totalChunks: count || 0,
    totalProfiles: profileCount || 0,
  });
}

/**
 * DELETE: Remove an upload, its chunks, and its lesson profile
 */
export async function DELETE(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const uploadId = searchParams.get("id");

  if (!uploadId) {
    return NextResponse.json({ error: "Upload ID required" }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // Delete chunks for this upload
  await supabaseAdmin
    .from("knowledge_chunks")
    .delete()
    .eq("source_id", uploadId)
    .eq("teacher_id", teacherId);

  // Delete the lesson profile (if any)
  await supabaseAdmin
    .from("lesson_profiles")
    .delete()
    .eq("upload_id", uploadId)
    .eq("teacher_id", teacherId);

  // Delete original file and media from storage
  try {
    const { data: origFiles } = await supabaseAdmin.storage
      .from("knowledge-media")
      .list(`${teacherId}/originals/${uploadId}`);
    if (origFiles?.length) {
      await supabaseAdmin.storage
        .from("knowledge-media")
        .remove(origFiles.map((f) => `${teacherId}/originals/${uploadId}/${f.name}`));
    }
    const { data: mediaFiles } = await supabaseAdmin.storage
      .from("knowledge-media")
      .list(`${teacherId}/${uploadId}`);
    if (mediaFiles?.length) {
      await supabaseAdmin.storage
        .from("knowledge-media")
        .remove(mediaFiles.map((f) => `${teacherId}/${uploadId}/${f.name}`));
    }
  } catch {
    // Non-fatal — storage cleanup failure doesn't block deletion
  }

  // Delete the upload record
  await supabaseAdmin
    .from("knowledge_uploads")
    .delete()
    .eq("id", uploadId)
    .eq("teacher_id", teacherId);

  return NextResponse.json({ success: true });
}
