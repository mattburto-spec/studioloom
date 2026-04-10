import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveCredentials } from "@/lib/ai/resolve-credentials";
import { createAIProvider } from "@/lib/ai";
import { TIMELINE_SYSTEM_PROMPT, buildRAGTimelinePrompt, buildRAGPerLessonPrompt } from "@/lib/ai/prompts";
import { validateTimelineActivities } from "@/lib/ai/validation";
import { evaluateTimelineQuality } from "@/lib/ai/quality-evaluator";
import { getTeachingContext } from "@/lib/ai/teacher-context";
import { approximateDuration } from "@/lib/ai/timing-validation";
import type { LessonJourneyInput, TimelineOutlineOption, TimelinePhase, TimelineLessonSkeleton, TimelineSkeleton, TimelineActivity, TimeWeight } from "@/types";

/**
 * Lightweight timing sanity check for timeline activities.
 * Timeline mode uses flat activities with durationMinutes (not workshopPhases),
 * so we can't call validateLessonTiming(). Instead, check:
 * 1. Total duration roughly matches expected lesson length
 * 2. Activities have warmup/reflection bookends
 * 3. No single activity exceeds reasonable duration
 */
// Un-quarantined (10 Apr 2026) — Wizard routes restored.

function validateTimelineTiming(
  activities: TimelineActivity[],
  lessonLengthMinutes: number,
  lessonSkeleton?: TimelineLessonSkeleton
): { warnings: string[]; repaired: TimelineActivity[] } {
  const warnings: string[] = [];
  const repaired = [...activities];

  if (repaired.length === 0) return { warnings, repaired };

  // Resolve timeWeight → durationMinutes for activities that only have timeWeight
  const target = lessonSkeleton?.estimatedMinutes || lessonLengthMinutes;
  for (const a of repaired) {
    if ((!a.durationMinutes || a.durationMinutes <= 0) && (a as unknown as Record<string, unknown>).timeWeight) {
      a.durationMinutes = approximateDuration(
        (a as unknown as Record<string, unknown>).timeWeight as TimeWeight,
        target
      );
      warnings.push(`Timeline timing: resolved timeWeight "${(a as unknown as Record<string, unknown>).timeWeight}" → ${a.durationMinutes} min for "${a.title}"`);
    }
  }

  const totalDuration = repaired.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
  const tolerance = target * 0.25; // 25% tolerance

  // 1. Total duration check — scale if way off
  if (totalDuration > 0 && Math.abs(totalDuration - target) > tolerance) {
    warnings.push(`Timeline timing: total ${totalDuration} min vs target ${target} min (${Math.abs(totalDuration - target)} min off). Auto-scaling.`);
    const scale = target / totalDuration;
    for (const a of repaired) {
      a.durationMinutes = Math.max(2, Math.round((a.durationMinutes || 10) * scale));
    }
  }

  // 2. Bookend check — ensure warmup at start and reflection at end
  const hasWarmup = repaired[0]?.role === "warmup" || repaired[0]?.role === "intro";
  const lastActivity = repaired[repaired.length - 1];
  const hasReflection = lastActivity?.role === "reflection";

  if (!hasWarmup && repaired.length > 0) {
    warnings.push("Timeline timing: no warmup/intro activity at start");
  }
  if (!hasReflection && repaired.length > 0) {
    warnings.push("Timeline timing: no reflection activity at end");
  }

  // 3. Max single activity duration (no activity should exceed 60% of lesson)
  const maxSingleDuration = Math.round(target * 0.60);
  for (const a of repaired) {
    if (a.durationMinutes > maxSingleDuration) {
      warnings.push(`Timeline timing: "${a.title}" (${a.durationMinutes} min) exceeds 60% of lesson (${maxSingleDuration} min). Capped.`);
      a.durationMinutes = maxSingleDuration;
    }
  }

  return { warnings, repaired };
}

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
                // Post-validation timing check
                const timingCheck = validateTimelineTiming(
                  validation.activities,
                  journeyInput.lessonLengthMinutes,
                  lessonSkeleton
                );
                const allWarnings = [...validation.errors, ...timingCheck.warnings];
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "complete",
                      activities: timingCheck.repaired,
                      warnings: allWarnings,
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

    // Post-validation timing check
    const timingCheck = validateTimelineTiming(
      validation.activities,
      journeyInput.lessonLengthMinutes,
      lessonSkeleton
    );
    const finalActivities = timingCheck.repaired;
    const allWarnings = [...validation.errors, ...timingCheck.warnings];

    // Quality evaluation (non-blocking — runs in parallel with response prep)
    let qualityReport = undefined;
    try {
      const isPerLesson = !!(lessonSkeleton && fullSkeleton);
      qualityReport = await evaluateTimelineQuality(
        finalActivities,
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

    // ── Activity Block usage tracking (Dimensions2) ──
    try {
      const { recordBlockUsage } = await import("@/lib/activity-blocks");
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const db = createAdminClient();
      const blockIds = new Set<string>();
      for (const act of finalActivities) {
        if ((act as unknown as Record<string, unknown>).source_block_id) {
          blockIds.add((act as unknown as Record<string, unknown>).source_block_id as string);
        }
      }
      if (blockIds.size > 0) {
        await Promise.allSettled(Array.from(blockIds).map(id => recordBlockUsage(db, id)));
        console.log(`[generate-timeline] ${blockIds.size} activity blocks used`);
      }
    } catch {
      // Block usage tracking is enhancement, not requirement
    }

    return NextResponse.json({
      activities: finalActivities,
      warnings: allWarnings,
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
