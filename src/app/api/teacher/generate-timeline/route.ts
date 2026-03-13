import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { createAIProvider } from "@/lib/ai";
import { TIMELINE_SYSTEM_PROMPT, buildRAGTimelinePrompt, buildRAGPerLessonPrompt } from "@/lib/ai/prompts";
import { validateTimelineActivities } from "@/lib/ai/validation";
import { evaluateTimelineQuality } from "@/lib/ai/quality-evaluator";
import { getTeachingContext } from "@/lib/ai/teacher-context";
import type { LessonJourneyInput, TimelineOutlineOption, TimelinePhase, TimelineLessonSkeleton, TimelineSkeleton } from "@/types";

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
 * POST /api/teacher/generate-timeline
 * Generate timeline activities for a unit (or a single phase within the unit).
 *
 * Body: {
 *   journeyInput: LessonJourneyInput,
 *   selectedOutline?: TimelineOutlineOption | null,
 *   phaseToGenerate?: TimelinePhase,          // generate one phase at a time
 *   previousActivitiesSummary?: string,       // context from earlier batches
 *   activitiesGeneratedSoFar?: number,
 *   estimatedActivityCount?: number,          // hint for tool schema
 *   stream?: boolean
 * }
 */
export async function POST(request: NextRequest) {
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
    selectedOutline,
    phaseToGenerate,
    previousActivitiesSummary,
    activitiesGeneratedSoFar,
    estimatedActivityCount,
    lessonSkeleton,
    fullSkeleton,
    stream: wantStream,
  } = body as {
    journeyInput: LessonJourneyInput;
    selectedOutline?: TimelineOutlineOption | null;
    phaseToGenerate?: TimelinePhase;
    previousActivitiesSummary?: string;
    activitiesGeneratedSoFar?: number;
    estimatedActivityCount?: number;
    lessonSkeleton?: TimelineLessonSkeleton;
    fullSkeleton?: TimelineSkeleton;
    stream?: boolean;
  };

  // Validate inputs
  if (!journeyInput) {
    return NextResponse.json(
      { error: "journeyInput is required" },
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

  // Resolve AI credentials
  const creds = await resolveCredentials(supabase, user.id);
  if (!creds) {
    return NextResponse.json(
      { error: "AI provider not configured. Go to Settings to add your API key." },
      { status: 400 }
    );
  }

  // Estimate activity count for tool schema
  const totalLessons = journeyInput.durationWeeks * journeyInput.lessonsPerWeek;
  const estCount = estimatedActivityCount
    || (lessonSkeleton
      ? Math.max(3, Math.round(lessonSkeleton.estimatedMinutes / 10))
      : phaseToGenerate
        ? Math.round(phaseToGenerate.estimatedLessons * 5)
        : totalLessons * 5);

  try {
    const provider = createAIProvider(creds.provider, {
      apiEndpoint: creds.apiEndpoint,
      apiKey: creds.apiKey,
      modelName: creds.modelName,
    });

    // Fetch teaching context for framework vocab + school context
    const teachingContext = await getTeachingContext(user.id);

    // Build prompts — per-lesson (skeleton-based) or per-phase (legacy)
    let userPrompt: string;
    let chunkIds: string[] = [];

    if (lessonSkeleton && fullSkeleton) {
      // Stage 2: Per-lesson generation using skeleton context
      const result = await buildRAGPerLessonPrompt(
        journeyInput,
        lessonSkeleton,
        fullSkeleton,
        user.id,
        teachingContext
      );
      userPrompt = result.prompt;
      chunkIds = result.chunkIds;
    } else {
      // Legacy: phase-based generation
      const result = await buildRAGTimelinePrompt(
        journeyInput,
        user.id,
        selectedOutline,
        phaseToGenerate,
        previousActivitiesSummary,
        activitiesGeneratedSoFar,
        teachingContext
      );
      userPrompt = result.prompt;
      chunkIds = result.chunkIds;
    }

    // --- Streaming path ---
    if (wantStream && provider.streamTimelineActivities) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const gen = provider.streamTimelineActivities!(
              estCount,
              TIMELINE_SYSTEM_PROMPT,
              userPrompt
            );

            for await (const event of gen) {
              if (event.type === "partial_json") {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "delta", json: event.json })}\n\n`)
                );
              } else if (event.type === "complete") {
                const validation = validateTimelineActivities(event.activities);
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "complete",
                      activities: validation.activities,
                      warnings: validation.errors,
                      ragChunkIds: chunkIds,
                    })}\n\n`
                  )
                );

                // Quality evaluation (async, sent as separate event after complete)
                try {
                  const isPerLesson = !!(lessonSkeleton && fullSkeleton);
                  const qualityReport = await evaluateTimelineQuality(
                    validation.activities,
                    {
                      topic: journeyInput.topic,
                      endGoal: journeyInput.endGoal,
                      gradeLevel: journeyInput.gradeLevel,
                      totalLessons: journeyInput.durationWeeks * journeyInput.lessonsPerWeek,
                      lessonLengthMinutes: journeyInput.lessonLengthMinutes,
                      lessonsInBatch: isPerLesson ? 1 : undefined,
                    },
                    creds.apiKey
                  );
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: "quality_report", qualityReport })}\n\n`
                    )
                  );
                } catch {
                  // Quality evaluation is non-critical
                }
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
    if (!provider.generateTimelineActivities) {
      return NextResponse.json(
        { error: "AI provider does not support timeline generation" },
        { status: 501 }
      );
    }

    const rawActivities = await provider.generateTimelineActivities(
      estCount,
      TIMELINE_SYSTEM_PROMPT,
      userPrompt
    );

    const validation = validateTimelineActivities(rawActivities);

    if (validation.activities.length === 0) {
      return NextResponse.json(
        {
          error: "AI generated no valid activities. Please try again.",
          details: validation.errors,
        },
        { status: 422 }
      );
    }

    // Quality evaluation (non-blocking — runs in parallel with response prep)
    let qualityReport = undefined;
    try {
      const isPerLesson = !!(lessonSkeleton && fullSkeleton);
      qualityReport = await evaluateTimelineQuality(
        validation.activities,
        {
          topic: journeyInput.topic,
          gradeLevel: journeyInput.gradeLevel,
          endGoal: journeyInput.endGoal,
          lessonLengthMinutes: journeyInput.lessonLengthMinutes,
          totalLessons,
          lessonsInBatch: isPerLesson ? 1 : undefined,
        },
        creds.apiKey
      );
    } catch {
      // Quality evaluation is enhancement — never block generation
    }

    return NextResponse.json({
      activities: validation.activities,
      warnings: validation.errors,
      ragChunkIds: chunkIds,
      qualityReport,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Generation failed: ${message}` },
      { status: 500 }
    );
  }
}
