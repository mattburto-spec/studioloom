import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { withErrorHandler } from "@/lib/api/error-handler";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { createAIProvider } from "@/lib/ai";
import { JOURNEY_SYSTEM_PROMPT, buildRAGJourneyPrompt } from "@/lib/ai/prompts";
import { buildUnitTypeSystemPrompt } from "@/lib/ai/unit-types";
import { validateGeneratedPages } from "@/lib/ai/validation";
import { getTeachingContext } from "@/lib/ai/teacher-context";
import { getGradeTimingProfile } from "@/lib/ai/prompts";
import type { TimingContext } from "@/lib/ai/prompts";
import { validateLessonTiming } from "@/lib/ai/timing-validation";
import type { GeneratedLesson, TimingValidationResult } from "@/lib/ai/timing-validation";
import type { LessonJourneyInput, JourneyOutlineOption } from "@/types";

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

/**
 * POST /api/teacher/generate-journey
 * Generate a batch of lesson pages for journey-mode units.
 *
 * Body: {
 *   journeyInput: LessonJourneyInput,
 *   lessonIds: string[],             // e.g. ["L01","L02","L03","L04","L05","L06"]
 *   selectedOutline?: JourneyOutlineOption | null,
 *   previousLessonSummary?: string,  // context from earlier batch
 *   stream?: boolean
 * }
 */
export const POST = withErrorHandler("teacher/generate-journey:POST", async (request: NextRequest) => {
  const supabase = createSupabaseServer(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    journeyInput,
    lessonIds,
    selectedOutline,
    previousLessonSummary,
    stream: wantStream,
  } = body as {
    journeyInput: LessonJourneyInput;
    lessonIds: string[];
    selectedOutline?: JourneyOutlineOption | null;
    previousLessonSummary?: string;
    stream?: boolean;
  };

  // Validate inputs
  if (!journeyInput || !lessonIds?.length) {
    return NextResponse.json(
      { error: "journeyInput and lessonIds are required" },
      { status: 400 }
    );
  }

  if (!journeyInput.endGoal) {
    return NextResponse.json(
      { error: "endGoal is required in journeyInput" },
      { status: 400 }
    );
  }

  // Apply teacher profile defaults for lesson length
  try {
    const { data: profile } = await supabase
      .from("teacher_profiles")
      .select("typical_period_minutes")
      .eq("user_id", user.id)
      .single();

    if (profile?.typical_period_minutes && !journeyInput.lessonLengthMinutes) {
      journeyInput.lessonLengthMinutes = profile.typical_period_minutes;
    }
  } catch {
    // Profile lookup is enhancement — use defaults
  }
  if (!journeyInput.lessonLengthMinutes) journeyInput.lessonLengthMinutes = 50;
  if (!journeyInput.lessonsPerWeek) journeyInput.lessonsPerWeek = 3;

  // Resolve system prompt based on unit type (falls back to Design)
  const unitType = journeyInput.unitType || "design";
  const framework = journeyInput.curriculumFramework || "IB_MYP";
  const systemPrompt = unitType !== "design"
    ? buildUnitTypeSystemPrompt(unitType)
    : JOURNEY_SYSTEM_PROMPT;

  // Resolve AI credentials
  const creds = await resolveCredentials(supabase, user.id);
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

    // Fetch teaching context for framework vocab + school context
    const teachingContext = await getTeachingContext(user.id);

    // Build prompts with RAG context + teaching context + feedback + framework
    const { prompt: userPrompt, chunkIds } = await buildRAGJourneyPrompt(
      lessonIds,
      journeyInput,
      user.id,
      selectedOutline,
      previousLessonSummary,
      teachingContext,
      framework
    );

    // --- Streaming path ---
    if (wantStream && provider.streamLessonPages) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const gen = provider.streamLessonPages!(
              lessonIds,
              systemPrompt,
              userPrompt,
              unitType
            );

            for await (const event of gen) {
              if (event.type === "partial_json") {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "delta", json: event.json })}\n\n`)
                );
              } else if (event.type === "complete") {
                const validation = validateGeneratedPages(event.pages);
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "complete",
                      pages: validation.pages,
                      warnings: validation.errors,
                      lessonIds,
                      ragChunkIds: chunkIds,
                    })}\n\n`
                  )
                );
              }
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`)
            );
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

    // --- Non-streaming path ---
    const rawPages = await provider.generateLessonPages!(
      lessonIds,
      systemPrompt,
      userPrompt,
      unitType
    );

    const validation = validateGeneratedPages(rawPages);

    if (Object.keys(validation.pages).length === 0) {
      return NextResponse.json(
        {
          error: "AI generated invalid content. Please try again.",
          details: validation.errors,
        },
        { status: 422 }
      );
    }

    // --- Timing validation + auto-repair on each lesson page ---
    const timingResults: Record<string, { valid: boolean; issueCount: number; autoFixed: number }> = {};
    const timingProfile = getGradeTimingProfile(journeyInput.gradeLevel);
    const lessonMinutes = journeyInput.lessonLengthMinutes || 50;
    const timingCtx: TimingContext = {
      periodMinutes: lessonMinutes,
      isWorkshop: false,
      transitionMinutes: 3,
      setupMinutes: 0,
      cleanupMinutes: 0,
      gradeProfile: timingProfile,
    };

    for (const [pageId, page] of Object.entries(validation.pages)) {
      // Only validate pages that have workshopPhases (i.e., the AI included timing)
      const lessonPage = page as unknown as GeneratedLesson;
      if (lessonPage.workshopPhases) {
        const result = validateLessonTiming(lessonPage, timingProfile, timingCtx);
        // Replace with auto-repaired version
        validation.pages[pageId] = result.repairedLesson as unknown as typeof page;
        timingResults[pageId] = {
          valid: result.valid,
          issueCount: result.issues.length,
          autoFixed: result.issues.filter(i => i.autoFixed).length,
        };
      }
    }

    return NextResponse.json({
      pages: validation.pages,
      warnings: validation.errors,
      lessonIds,
      ragChunkIds: chunkIds,
      timingValidation: Object.keys(timingResults).length > 0 ? timingResults : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Generation failed: ${message}` },
      { status: 500 }
    );
  }
});
