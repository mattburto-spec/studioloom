/**
 * Stage 5: Timing & Structure
 *
 * Maps activities into Workshop Model phases, allocates time using
 * time_weight defaults, respects period length constraints.
 * Primarily computation — small AI call only for edge cases.
 */

import type {
  CostBreakdown,
  PolishedSequence,
  TimedUnit,
  TimedLesson,
  TimedPhase,
  LessonExtension,
  PolishedActivity,
} from "@/types/activity-blocks";
import type { FormatProfile } from "@/lib/ai/unit-types";

// ─── Constants ───

const ZERO_COST: CostBreakdown = {
  inputTokens: 0, outputTokens: 0, modelId: "computation",
  estimatedCostUSD: 0, timeMs: 0,
};

/** Time weight → minute ranges */
const TIME_WEIGHT_RANGES: Record<string, { min: number; max: number; default: number }> = {
  quick: { min: 5, max: 8, default: 6 },
  moderate: { min: 10, max: 18, default: 14 },
  extended: { min: 20, max: 35, default: 25 },
  flexible: { min: 5, max: 40, default: 15 },
};

/** Workshop Model phase durations (min/max in minutes) */
const WORKSHOP_PHASES = {
  opening: { min: 3, max: 8, default: 5 },
  miniLesson: { min: 5, max: 15, default: 10 },
  workTime: { minPercent: 0.45, idealPercent: 0.60 },
  debrief: { min: 3, max: 8, default: 5 },
};

// ─── Types ───

interface TimingConfig {
  /** Override period minutes (otherwise uses request.constraints.periodMinutes) */
  periodMinutesOverride?: number;
}

// ─── Helpers ───

function getTimeForWeight(weight: string): number {
  const range = TIME_WEIGHT_RANGES[weight] || TIME_WEIGHT_RANGES.moderate;
  return range.default;
}

function mapActivityToWorkshopPhase(act: PolishedActivity): string {
  const role = act.lesson_structure_role;
  if (role === "opening" || role === "warmup") return "opening";
  if (role === "instruction") return "miniLesson";
  if (role === "reflection" || role === "wrapup") return "debrief";
  return "workTime"; // "core" and everything else
}

function generateExtensions(
  lesson: { activities: PolishedActivity[]; label: string },
  profile: FormatProfile
): LessonExtension[] {
  const extensions: LessonExtension[] = [];
  const dominantPhase = lesson.activities
    .filter(a => a.phase)
    .map(a => a.phase)
    .reduce((acc: Record<string, number>, p) => {
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const topPhase = Object.entries(dominantPhase)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || profile.phases[0]?.id;

  const phaseLabel = profile.phases.find(p => p.id === topPhase)?.label || topPhase;

  extensions.push({
    title: `Extension: Deepen Your ${phaseLabel} Work`,
    description: `Take your work from this lesson further. Explore an alternative approach or add more detail to your best ideas.`,
    duration: 15,
    designPhase: topPhase,
  });

  extensions.push({
    title: "Extension: Cross-Connect",
    description: `Find a connection between today's work and something from a previous lesson. Write or sketch this connection.`,
    duration: 10,
    designPhase: topPhase,
  });

  return extensions;
}

// ─── Main ───

export function stage5_applyTiming(
  polished: PolishedSequence,
  profile: FormatProfile,
  config?: TimingConfig
): TimedUnit {
  const startMs = Date.now();
  const periodMinutes = config?.periodMinutesOverride || polished.request.constraints.periodMinutes || 60;
  const setupBuffer = profile.timingModifiers.setupBuffer;
  const cleanupBuffer = profile.timingModifiers.cleanupBuffer;
  const transitionMinutes = 3;
  const usableMinutes = periodMinutes - setupBuffer - cleanupBuffer - transitionMinutes;

  const overflowLessons: number[] = [];

  const lessons: TimedLesson[] = polished.lessons.map((lesson) => {
    // Group activities into Workshop Model phases
    const phaseMap: Record<string, PolishedActivity[]> = {
      opening: [],
      miniLesson: [],
      workTime: [],
      debrief: [],
    };

    for (const act of lesson.activities) {
      const wsPhase = mapActivityToWorkshopPhase(act);
      phaseMap[wsPhase].push(act);
    }

    // Allocate time per phase
    const openingDuration = phaseMap.opening.length > 0
      ? Math.min(WORKSHOP_PHASES.opening.max, Math.max(WORKSHOP_PHASES.opening.min,
        phaseMap.opening.reduce((s, a) => s + getTimeForWeight(a.time_weight), 0)))
      : WORKSHOP_PHASES.opening.default;

    const miniLessonDuration = phaseMap.miniLesson.length > 0
      ? Math.min(WORKSHOP_PHASES.miniLesson.max, Math.max(WORKSHOP_PHASES.miniLesson.min,
        phaseMap.miniLesson.reduce((s, a) => s + getTimeForWeight(a.time_weight), 0)))
      : 0;

    // Reflection floor (spec §4.3): profile.reflectionMinimum is a hard floor on debrief duration.
    // For PP (reflectionMinimum=15), this intentionally overrides WORKSHOP_PHASES.debrief.max (8) —
    // the spec is explicit that "PP demands the deepest reflection of any format".
    // For format profiles where reflectionMinimum ≤ debrief.max, this is a natural no-op when the
    // computed debrief is already above the floor.
    const reflectionFloor = profile.timingModifiers.reflectionMinimum;
    const debriefDuration = phaseMap.debrief.length > 0
      ? Math.max(
          reflectionFloor,
          Math.min(WORKSHOP_PHASES.debrief.max, Math.max(WORKSHOP_PHASES.debrief.min,
            phaseMap.debrief.reduce((s, a) => s + getTimeForWeight(a.time_weight), 0)))
        )
      : Math.max(reflectionFloor, WORKSHOP_PHASES.debrief.default);

    // Work time gets the rest — but must be at least profile.defaultWorkTimeFloor of usable time
    const minWorkTime = Math.ceil(usableMinutes * profile.timingModifiers.defaultWorkTimeFloor);
    const remainingForWork = usableMinutes - openingDuration - miniLessonDuration - debriefDuration;
    const workTimeDuration = Math.max(minWorkTime, remainingForWork);

    // Check for overflow
    const totalAllocated = openingDuration + miniLessonDuration + workTimeDuration + debriefDuration;
    if (totalAllocated > usableMinutes + 5) {
      overflowLessons.push(lesson.position);
    }

    // Build TimedPhase array
    const phases: TimedPhase[] = [];

    if (openingDuration > 0) {
      phases.push({
        label: "Opening",
        phaseId: "opening",
        activities: phaseMap.opening,
        durationMinutes: openingDuration,
        isFlexible: false,
      });
    }

    if (miniLessonDuration > 0) {
      phases.push({
        label: "Mini-Lesson",
        phaseId: "miniLesson",
        activities: phaseMap.miniLesson,
        durationMinutes: miniLessonDuration,
        isFlexible: false,
      });
    }

    phases.push({
      label: "Work Time",
      phaseId: "workTime",
      activities: phaseMap.workTime,
      durationMinutes: workTimeDuration,
      isFlexible: true,
    });

    phases.push({
      label: "Debrief",
      phaseId: "debrief",
      activities: phaseMap.debrief.length > 0 ? phaseMap.debrief : [],
      durationMinutes: debriefDuration,
      isFlexible: false,
    });

    const extensions = generateExtensions(lesson, profile);

    return {
      ...lesson,
      phases,
      totalMinutes: periodMinutes,
      extensions,
    };
  });

  return {
    request: polished.request,
    lessons,
    timingMetrics: {
      totalMinutesAllocated: lessons.length * periodMinutes,
      totalMinutesAvailable: lessons.length * periodMinutes,
      overflowLessons,
      timingSource: "starter_default",
      timingTimeMs: Date.now() - startMs,
      timingCost: { ...ZERO_COST, timeMs: Date.now() - startMs },
    },
  };
}
