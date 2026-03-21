import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { extractDocument } from "@/lib/knowledge/extract";
import { analysePass0 } from "@/lib/knowledge/analyse";
import { extractLessonStructure } from "@/lib/converter/extract-lesson-structure";
import { buildSkeletonFromExtraction } from "@/lib/converter/build-skeleton";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { createAIProvider } from "@/lib/ai";
import { UNIT_SYSTEM_PROMPT, getGradeTimingProfile, buildTimingContext, calculateUsableTime, maxInstructionMinutes } from "@/lib/ai/prompts";
import { validateLessonTiming } from "@/lib/ai/timing-validation";
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
  const { skeleton, rawText, extraction, mode, targetUnitId } = body as {
    skeleton: TimelineSkeleton;
    rawText: string;
    extraction: { unitTopic: string; gradeLevel: string; subjectArea: string; lessons: Array<{ title: string; activities: Array<{ description: string; type: string }>; learningObjective: string }> };
    mode: "full_unit" | "single_lesson";
    targetUnitId?: string;
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

    // Build grade profile for timing validation
    const gradeProfile = getGradeTimingProfile(4); // Default MYP 4, teacher can adjust
    const timingCtx = buildTimingContext(gradeProfile, 50, true); // 50 min default
    const usableTime = calculateUsableTime(timingCtx);
    const instructionCap = maxInstructionMinutes(gradeProfile);

    // Generate pages for each lesson with context injection
    const allPages: Record<string, PageContent> = {};
    const timingResults: Array<{ lessonId: string; issues: string[] }> = [];

    for (const lesson of skeleton.lessons) {
      // Find matching extraction lesson for context
      const extractionLesson = extraction?.lessons?.[lesson.lessonNumber - 1];
      const originalText = extractionLesson
        ? extractionLesson.activities.map((a: { description: string; type: string }) => `- ${a.type}: ${a.description}`).join("\n")
        : "";

      // Build the context-injected user prompt
      const contextPrompt = buildConverterPrompt(lesson, originalText, extraction, usableTime, instructionCap);

      // Generate using existing page generation
      const pages = await provider.generateCriterionPages(
        (lesson.criterionTags?.[0] || "B") as "A" | "B" | "C" | "D",
        {
          topic: extraction.unitTopic,
          subject: extraction.subjectArea || "Design",
          gradeLevel: extraction.gradeLevel || "Year 9",
          framework: "myp",
          duration: `${lesson.estimatedMinutes} minutes`,
        } as unknown as import("@/types").UnitWizardInput,
        UNIT_SYSTEM_PROMPT + `\n\nCONTEXT: This unit is being converted from the teacher's existing lesson plan.\nThe original lesson plan text for this lesson is:\n---\n${originalText}\n---\nPRESERVE the teacher's original activities and teaching approach.\nENHANCE with: Workshop Model timing, scaffolding tiers, extensions, response types.\nDo NOT replace the teacher's activities with generic alternatives.`,
        contextPrompt
      );

      // Validate timing on each generated page
      const validation = validateGeneratedPages(pages);
      for (const [pageId, page] of Object.entries(validation.pages)) {
        if (page.workshopPhases) {
          const timingValidation = validateLessonTiming(page, {
            periodMinutes: lesson.estimatedMinutes || 50,
            instructionCap,
            gradeProfile,
          });
          if (timingValidation.issues.length > 0) {
            timingResults.push({ lessonId: lesson.lessonId, issues: timingValidation.issues.map((i: { rule: string; message: string }) => i.message) });
          }
          // Apply auto-repaired page
          allPages[`${lesson.lessonId}_${pageId}`] = timingValidation.repairedPage || page;
        } else {
          allPages[`${lesson.lessonId}_${pageId}`] = page;
        }
      }
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
      timingValidation: timingResults,
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
  usableTime: number,
  instructionCap: number
): string {
  return `Generate a lesson page for:

UNIT: ${extraction.unitTopic}
LESSON ${lesson.lessonNumber}: ${lesson.title}
KEY QUESTION: ${lesson.keyQuestion}
DURATION: ${lesson.estimatedMinutes} minutes (usable: ~${usableTime} minutes)
CRITERION FOCUS: ${lesson.criterionTags.join(", ")}
LESSON TYPE: ${lesson.lessonType || "skills-demo"}
PHASE: ${lesson.phaseLabel}

ORIGINAL TEACHER ACTIVITIES:
${originalText || "No specific activities extracted — generate based on lesson title and objectives."}

LEARNING INTENTION: ${lesson.learningIntention || ""}

TIMING RULES:
- Workshop Model: Opening (5-10 min) → Mini-Lesson (max ${instructionCap} min) → Work Time (≥45% of usable time) → Debrief (5-10 min)
- Include 2-3 extension activities for early finishers
- Include workshopPhases with durations for each phase

Generate a complete lesson page with sections, scaffolding, and Workshop Model timing.
PRESERVE the teacher's original activities. ENHANCE with StudioLoom scaffolding.`;
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
