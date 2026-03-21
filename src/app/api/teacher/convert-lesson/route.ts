import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { extractDocument } from "@/lib/knowledge/extract";
import { analysePass0 } from "@/lib/knowledge/analyse";
import { extractLessonStructure, type LessonStructureExtraction, type ExtractedResource, type ExtractedRubric } from "@/lib/converter/extract-lesson-structure";
import { buildSkeletonFromExtraction } from "@/lib/converter/build-skeleton";
import { extractImagesFromDocx, isDocx, type ExtractedImage } from "@/lib/converter/extract-images";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { createAIProvider } from "@/lib/ai";
import { UNIT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { validateGeneratedPages } from "@/lib/ai/validation";
import { onLessonUploaded } from "@/lib/teacher-style/profile-service";
import { chunkDocument, type ChunkMetadata } from "@/lib/knowledge/chunk";
import { embedAll } from "@/lib/ai/embeddings";
import type { ExtractedDoc } from "@/lib/knowledge/extract";
import type { TimelineSkeleton, PageContent } from "@/types";

function createSupabaseServer(request: NextRequest) {
  return createServerClient(
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
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * POST /api/teacher/convert-lesson
 *
 * Two-phase operation controlled by `phase` field:
 *
 * Phase 1 — "extract": Upload file → extract text → classify → extract lesson structure → return skeleton
 *   Input: FormData with `file`, `mode` ("full_unit" | "single_lesson"), optional `targetUnitId`
 *   Output: { skeleton, extraction, rawText, classification }
 *
 * Phase 2 — "generate": Take approved skeleton → generate full pages with original text context
 *   Input: JSON with `skeleton`, `rawText`, `extraction`, `mode`, optional `targetUnitId`
 *   Output: { pages, timingValidation }
 */
// Allow up to 5 minutes for 12-lesson generation (each AI call ~30-45s)
export const maxDuration = 300;

export const POST = withErrorHandler("teacher/convert-lesson:POST", async (request: NextRequest) => {
  const supabase = createSupabaseServer(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Detect phase from content type
  const contentType = request.headers.get("content-type") || "";
  const isFormData = contentType.includes("multipart/form-data");

  if (isFormData) {
    return handleExtraction(request, user.id);
  } else {
    return handleGeneration(request, user.id);
  }
});

/**
 * Phase 1: Extract lesson structure from uploaded file.
 */
async function handleExtraction(
  request: NextRequest,
  teacherId: string
): Promise<NextResponse> {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const mode = (formData.get("mode") as string) || "full_unit";
  const targetUnitId = formData.get("targetUnitId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
  }

  // Validate file type
  const ext = file.name.toLowerCase().split(".").pop();
  const isValidType = ACCEPTED_TYPES.includes(file.type) ||
    ["pdf", "docx", "pptx"].includes(ext || "");

  if (!isValidType) {
    return NextResponse.json(
      { error: "Unsupported file type. Please upload a PDF, DOCX, or PPTX file." },
      { status: 400 }
    );
  }

  try {
    // Step 1: Extract document text
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractDocument(buffer, file.name, file.type);

    console.log(`[convert-lesson] Extracted ${extracted.sections.length} sections from "${file.name}" (${extracted.rawText.length} chars)`);

    // Step 1b: Extract images from DOCX files
    let images: ExtractedImage[] = [];
    if (isDocx(file.name, file.type)) {
      images = await extractImagesFromDocx(buffer);
      console.log(`[convert-lesson] Extracted ${images.length} images from "${file.name}" (${images.reduce((s, i) => s + i.sizeBytes, 0)} bytes total)`);
    }

    // Step 2: Pass 0 classification — confirm it's a lesson plan
    const textPreview = extracted.rawText.length > 2000
      ? extracted.rawText.slice(0, 2000) + "\n\n[...]"
      : extracted.rawText;

    const classification = await analysePass0(textPreview, file.name);

    console.log(`[convert-lesson] Pass 0: type=${classification.detected_type}, confidence=${classification.confidence}, pipeline=${classification.recommended_pipeline}`);

    // Check if it's a lesson plan (or close enough)
    const isLessonPlan = classification.detected_type === "lesson_plan" ||
      classification.detected_type === "scheme_of_work";

    if (!isLessonPlan && classification.confidence > 0.7) {
      // High confidence it's NOT a lesson plan — redirect to knowledge base
      return NextResponse.json({
        error: "not_lesson_plan",
        detectedType: classification.detected_type,
        message: `This looks like a ${classification.detected_type.replace(/_/g, " ")} rather than a lesson plan. ` +
          `You can upload it to your Knowledge Base instead, where it will be analysed and available for RAG retrieval.`,
        signals: classification.signals,
      }, { status: 422 });
    }

    // Step 3: Extract lesson structure using AI
    const extraction = await extractLessonStructure(extracted.rawText, file.name);

    console.log(`[convert-lesson] Extracted ${extraction.totalLessons} lessons from "${file.name}"`);

    // Step 4: Build skeleton from extraction
    const skeleton = buildSkeletonFromExtraction(extraction);

    // Step 5: Index into knowledge base (fire-and-forget background)
    indexIntoKnowledgeBase(teacherId, extracted, file.name)
      .catch((err) => console.error("[convert-lesson] KB indexing failed:", err));

    return NextResponse.json({
      skeleton,
      extraction,
      rawText: extracted.rawText,
      classification: {
        detectedType: classification.detected_type,
        confidence: classification.confidence,
        signals: classification.signals,
      },
      framework: extraction.framework,
      layout: extraction.layout,
      resources: extraction.resources,
      rubrics: extraction.rubrics,
      lessonDurationMinutes: extraction.lessonDurationMinutes,
      totalDuration: extraction.totalDuration,
      imageCount: images.length,
      images: images.map(img => ({
        filename: img.filename,
        mimeType: img.mimeType,
        sizeBytes: img.sizeBytes,
      })),
      mode,
      targetUnitId,
      filename: file.name,
    });
  } catch (err) {
    console.error("[convert-lesson] Extraction error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Phase 2: Generate full pages from approved skeleton + original text.
 */
async function handleGeneration(
  request: NextRequest,
  teacherId: string
): Promise<NextResponse> {
  const body = await request.json();
  const { skeleton, rawText, extraction, mode, targetUnitId, lessonDurationMinutes, frameworkKey } = body as {
    skeleton: TimelineSkeleton;
    rawText: string;
    extraction: { unitTopic: string; gradeLevel: string; subjectArea: string; lessons: Array<{ title: string; activities: Array<{ description: string; type: string }>; learningObjective: string; resources?: Array<{ url: string; title: string; type: string }> }> };
    mode: "full_unit" | "single_lesson";
    targetUnitId?: string;
    lessonDurationMinutes?: number;
    frameworkKey?: string;
  };

  if (!skeleton || !skeleton.lessons || skeleton.lessons.length === 0) {
    return NextResponse.json({ error: "Invalid skeleton" }, { status: 400 });
  }

  if (!rawText) {
    return NextResponse.json({ error: "rawText required for context injection" }, { status: 400 });
  }

  // Resolve AI credentials
  const supabase = createSupabaseServer(request);
  const creds = await resolveCredentials(supabase, teacherId);

  if (!creds) {
    return NextResponse.json(
      { error: "AI provider not configured. Go to Settings to add your API key." },
      { status: 400 }
    );
  }

  try {
    const provider = createAIProvider(creds.provider, {
      apiEndpoint: creds.apiEndpoint,
      apiKey: creds.apiKey,
      modelName: creds.modelName,
    });

    // For imported lessons: OBSERVE timing, don't enforce rigid rules.
    // The teacher's original timing IS the data — we learn from it, not overwrite it.
    const defaultDuration = lessonDurationMinutes || 50;

    // Generate pages for each lesson with context injection
    // Process in parallel batches of 3 to speed up (was sequential = timeout)
    const allPages: Record<string, PageContent> = {};
    const timingObservations: Array<{ lessonId: string; duration: number; activityBreakdown: string[] }> = [];
    const BATCH_SIZE = 3;

    for (let i = 0; i < skeleton.lessons.length; i += BATCH_SIZE) {
      const batch = skeleton.lessons.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (lesson) => {
        // Find matching extraction lesson for context
        const extractionLesson = extraction?.lessons?.[lesson.lessonNumber - 1];
        const originalText = extractionLesson
          ? extractionLesson.activities.map((a: { description: string; type: string }) => `- ${a.type}: ${a.description}`).join("\n")
          : "";

        // Include resources for this lesson
        const lessonResources = extractionLesson?.resources || [];
        const resourcesText = lessonResources.length > 0
          ? `\n\nTEACHER RESOURCES FOR THIS LESSON:\n${lessonResources.map((r: { url: string; title: string; type: string }) => `- [${r.type}] ${r.title}: ${r.url}`).join("\n")}\nPRESERVE these resource links in the generated content.`
          : "";

        // Build the context-injected user prompt — flexible, not rigid
        const contextPrompt = buildConverterPrompt(lesson, originalText + resourcesText, extraction, defaultDuration);

        // Sanitize criterion tag for use as Anthropic schema property key
        // Keys must match ^[a-zA-Z0-9_.-]{1,64}$ — so "P&P" → "P_P", "AO1" stays "AO1"
        // The original criterion tags are preserved in the prompt context for the AI
        const rawCriterion = lesson.criterionTags?.[0] || "B";
        const safeCriterion = rawCriterion.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 64) || "B";

        // Generate using existing page generation
        const pages = await provider.generateCriterionPages(
          safeCriterion as "A" | "B" | "C" | "D",
          {
            topic: extraction.unitTopic,
            subject: extraction.subjectArea || "Design",
            gradeLevel: extraction.gradeLevel || "Year 9",
            framework: frameworkKey || "myp",
            duration: `${lesson.estimatedMinutes} minutes`,
          } as unknown as import("@/types").UnitWizardInput,
          UNIT_SYSTEM_PROMPT + `\n\nCONTEXT: This unit is being converted from the teacher's existing lesson plan.\nThe original lesson plan text for this lesson is:\n---\n${originalText}\n---\nPRESERVE the teacher's original activities, timing, and teaching approach.\nENHANCE with: scaffolding tiers, response types, student engagement activities.\nDo NOT force the teacher's lesson into a rigid timing model.\nDo NOT replace the teacher's activities with generic alternatives.`,
          contextPrompt
        );

        // Observe timing from the generated page — store as learning data, don't auto-repair
        const validation = validateGeneratedPages(pages);

        // Record timing observations for the teacher style profile
        if (extractionLesson) {
          timingObservations.push({
            lessonId: lesson.lessonId,
            duration: extractionLesson.estimatedMinutes || defaultDuration,
            activityBreakdown: extractionLesson.activities.map((a: { type: string; estimatedMinutes?: number }) =>
              `${a.type}: ${a.estimatedMinutes || "?"}min`
            ),
          });
        }

        return { lessonId: lesson.lessonId, pages: validation.pages };
      }));

      // Collect results from batch
      for (const { lessonId, pages } of batchResults) {
        for (const [pageId, page] of Object.entries(pages)) {
          allPages[`${lessonId}_${pageId}`] = page;
        }
      }

      console.log(`[convert-lesson] Generated batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(skeleton.lessons.length / BATCH_SIZE)}`);
    }

    // Fire teacher style profile learning (fire-and-forget)
    if (extraction?.lessons?.[0]) {
      onLessonUploaded(teacherId, {
        sections: extraction.lessons.map((l: { title: string; activities: Array<{ description: string; type: string; estimatedMinutes?: number }>; estimatedMinutes?: number }) => ({
          title: l.title,
          estimated_minutes: l.estimatedMinutes || 50,
          activity_type: l.activities[0]?.type,
        })),
        estimated_duration_minutes: extraction.lessons.reduce((sum: number, l: { estimatedMinutes?: number }) => sum + (l.estimatedMinutes || 50), 0),
        lesson_type: "imported_lesson_plan",
      }).catch((err: unknown) => console.error("[convert-lesson] Style profile update failed:", err));
    }

    return NextResponse.json({
      pages: allPages,
      timingObservations,
      skeleton,
      lessonCount: skeleton.lessons.length,
      mode,
      targetUnitId,
    });
  } catch (err) {
    console.error("[convert-lesson] Generation error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Build the user prompt for generating a single lesson page with converter context.
 */
function buildConverterPrompt(
  lesson: TimelineSkeleton["lessons"][0],
  originalText: string,
  extraction: { unitTopic: string; gradeLevel: string; subjectArea: string },
  lessonDuration: number
): string {
  return `Generate a lesson page for:

UNIT: ${extraction.unitTopic}
LESSON ${lesson.lessonNumber}: ${lesson.title}
KEY QUESTION: ${lesson.keyQuestion}
DURATION: ${lessonDuration} minutes
CRITERION FOCUS: ${lesson.criterionTags.join(", ")}
LESSON TYPE: ${lesson.lessonType || "skills-demo"}
PHASE: ${lesson.phaseLabel}

ORIGINAL TEACHER ACTIVITIES:
${originalText || "No specific activities extracted — generate based on lesson title and objectives."}

LEARNING INTENTION: ${lesson.learningIntention || ""}

APPROACH:
- PRESERVE the teacher's original activities, sequencing, and timing as faithfully as possible
- Enhance with: scaffolding tiers, response types for student engagement, materials lists
- Add 2-3 extension activities for early finishers (related to the lesson content)
- If the teacher's lesson has a natural structure (intro → instruction → activity → wrap-up), keep that structure
- Do NOT force the lesson into a rigid timing template — respect the teacher's design
- Include workshopPhases as an observation of the lesson structure (what the teacher planned), not as a mandate

Generate a complete lesson page with sections and scaffolding.
The teacher knows their class — trust their timing decisions.`;
}

/**
 * Background: index the imported document into the knowledge base.
 * Chunks the document and embeds into knowledge_chunks for RAG retrieval.
 * Fire-and-forget — errors don't block the import flow.
 */
async function indexIntoKnowledgeBase(
  teacherId: string,
  extracted: ExtractedDoc,
  filename: string
): Promise<void> {
  const db = createAdminClient();

  try {
    // Chunk the document
    const metadata: ChunkMetadata = {
      source_type: "uploaded_plan",
      source_filename: filename,
      teacher_id: teacherId,
      source_category: "lesson_plan",
    };

    const chunks = chunkDocument(extracted, metadata);

    if (chunks.length === 0) return;

    // Embed chunks
    const texts = chunks.map((c) =>
      c.context_preamble ? `${c.context_preamble}\n\n${c.content}` : c.content
    );

    let embeddings: number[][];
    try {
      embeddings = await embedAll(texts);
    } catch {
      embeddings = texts.map(() => []);
    }

    // Insert chunks into knowledge_chunks
    const rows = chunks.map((chunk, i) => ({
      source_type: chunk.metadata.source_type,
      source_id: chunk.metadata.source_id || null,
      source_filename: chunk.metadata.source_filename,
      teacher_id: chunk.metadata.teacher_id,
      content: chunk.content,
      criterion: chunk.criterion || null,
      page_id: chunk.page_id || null,
      content_type: chunk.content_type || null,
      grade_level: chunk.metadata.grade_level || null,
      subject_area: chunk.metadata.subject_area || null,
      topic: chunk.metadata.topic || null,
      embedding: embeddings[i]?.length > 0 ? JSON.stringify(embeddings[i]) : null,
    }));

    const { error: chunkError } = await db.from("knowledge_chunks").insert(rows);
    if (chunkError) {
      console.warn("[convert-lesson] Chunk insert failed:", chunkError.message);
    } else {
      console.log(`[convert-lesson] Indexed ${rows.length} chunks for "${filename}"`);
    }
  } catch (err) {
    console.error("[convert-lesson] Knowledge indexing failed:", err);
  }
}
