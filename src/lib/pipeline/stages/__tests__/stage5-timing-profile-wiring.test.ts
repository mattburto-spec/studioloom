/**
 * Sub-task 5.7 — stage5_applyTiming timingModifiers wiring tests.
 *
 * 5 tests (deterministic — no AI, no mocks, no fixtures):
 *   1-4. Per-profile wiring (design, service, personal_project, inquiry):
 *        workTime duration >= ceil(usable * profile.defaultWorkTimeFloor),
 *        debrief duration >= profile.reflectionMinimum. Reads profile
 *        values at runtime so the tests self-adjust if spec values change.
 *   5.   Edge case: design profile + 1 quick debrief activity.
 *        Natural debrief = getTimeForWeight("quick") = 6, design floor = 5.
 *        Asserts debrief === 6 (EXACT) — proves Math.max is a no-op when
 *        natural ≥ floor. If anyone collapses the branch to always use
 *        reflectionMinimum, this gate fires immediately.
 *
 * Input shape: PolishedSequence built directly, one lesson per test, all
 * activities cast into PolishedActivity by extension (FilledActivity is
 * the required superset; transitionIn/Out/crossReferences are all
 * optional).
 *
 * Phase routing: stage5 groups activities by lesson_structure_role via
 * mapActivityToWorkshopPhase — "opening"/"warmup" → opening,
 * "instruction" → miniLesson, "reflection"/"wrapup" → debrief,
 * everything else (including "core") → workTime.
 */
import { describe, it, expect } from "vitest";
import { stage5_applyTiming } from "../stage5-timing";
import { getFormatProfile } from "@/lib/ai/unit-types";
import type { FormatProfile, UnitType } from "@/lib/ai/unit-types";
import type {
  PolishedSequence,
  PolishedActivity,
  PolishedLesson,
  TimedUnit,
} from "@/types/activity-blocks";

// ─── Helpers ───

interface ActivityStub {
  role: string; // lesson_structure_role
  timeWeight: string;
  title?: string;
}

function makeActivity(stub: ActivityStub, idx: number): PolishedActivity {
  return {
    source: "generated",
    title: stub.title || `Activity ${idx}`,
    prompt: "Do the thing",
    bloom_level: "apply",
    time_weight: stub.timeWeight,
    grouping: "individual",
    phase: "investigate",
    activity_category: "research",
    lesson_structure_role: stub.role,
    response_type: "long-text",
    materials_needed: [],
  } as unknown as PolishedActivity;
}

function buildMinimalPolishedSequence(
  unitType: UnitType,
  activities: ActivityStub[],
  periodMinutes: number
): PolishedSequence {
  const lesson: PolishedLesson = {
    position: 1,
    label: "Lesson 1",
    description: "Test lesson",
    learningGoal: "Test goal",
    activities: activities.map((a, i) => makeActivity(a, i)),
  } as unknown as PolishedLesson;

  return {
    request: {
      topic: "Test topic",
      unitType,
      lessonCount: 1,
      gradeLevel: "13-14",
      framework: "IB_MYP",
      constraints: {
        availableResources: [],
        periodMinutes,
        workshopAccess: false,
        softwareAvailable: [],
      },
    },
    lessons: [lesson],
    polishMetrics: {
      transitionsAdded: 0,
      crossReferencesAdded: 0,
      familiarityAdaptations: 0,
      scaffoldingProgressions: 0,
      totalTokensUsed: 0,
      totalCost: {
        inputTokens: 0,
        outputTokens: 0,
        modelId: "fixture",
        estimatedCostUSD: 0,
        timeMs: 0,
      },
      polishTimeMs: 0,
    },
    interactionMap: [],
  } as unknown as PolishedSequence;
}

function findPhaseDuration(result: TimedUnit, phaseId: string): number {
  const phase = result.lessons[0].phases.find(p => p.phaseId === phaseId);
  if (!phase) {
    throw new Error(
      `Phase "${phaseId}" not found in result. Present: ${result.lessons[0].phases.map(p => p.phaseId).join(",")}`
    );
  }
  return phase.durationMinutes;
}

// Mirrors stage5-timing.ts line 112: periodMinutes - setupBuffer - cleanupBuffer - 3
function computeUsable(periodMinutes: number, profile: FormatProfile): number {
  return (
    periodMinutes -
    profile.timingModifiers.setupBuffer -
    profile.timingModifiers.cleanupBuffer -
    3
  );
}

// ─── Tests ───

describe("stage5_applyTiming — per-profile timingModifiers wiring (5.7)", () => {
  it("design profile: work-time floor (0.45) + reflection floor (5) applied", () => {
    const profile = getFormatProfile("design");
    const periodMinutes = 80;
    const usable = computeUsable(periodMinutes, profile);
    const expectedMinWork = Math.ceil(
      usable * profile.timingModifiers.defaultWorkTimeFloor
    );
    const expectedMinReflection = profile.timingModifiers.reflectionMinimum;

    const input = buildMinimalPolishedSequence(
      "design",
      [
        { role: "core", timeWeight: "moderate", title: "Investigate users" },
        { role: "core", timeWeight: "extended", title: "Sketch concepts" },
        { role: "reflection", timeWeight: "quick", title: "End-of-lesson reflect" },
      ],
      periodMinutes
    );

    const result = stage5_applyTiming(input, profile);

    expect(findPhaseDuration(result, "workTime")).toBeGreaterThanOrEqual(expectedMinWork);
    expect(findPhaseDuration(result, "debrief")).toBeGreaterThanOrEqual(expectedMinReflection);
  });

  it("service profile: reflection floor (10) bites via else-branch (empty debrief)", () => {
    const profile = getFormatProfile("service");
    const periodMinutes = 80;
    const usable = computeUsable(periodMinutes, profile);
    const expectedMinWork = Math.ceil(
      usable * profile.timingModifiers.defaultWorkTimeFloor
    );
    const expectedMinReflection = profile.timingModifiers.reflectionMinimum;

    // EMPTY debrief → else-branch → Math.max(10, WORKSHOP_PHASES.debrief.default=5) = 10.
    // Proves the floor bites when natural computation would have been below it.
    const input = buildMinimalPolishedSequence(
      "service",
      [
        { role: "core", timeWeight: "moderate", title: "Community interview" },
        { role: "core", timeWeight: "moderate", title: "Needs synthesis" },
      ],
      periodMinutes
    );

    const result = stage5_applyTiming(input, profile);

    expect(findPhaseDuration(result, "workTime")).toBeGreaterThanOrEqual(expectedMinWork);
    expect(findPhaseDuration(result, "debrief")).toBeGreaterThanOrEqual(expectedMinReflection);
  });

  it("personal_project profile: work-time floor (0.60) BINDS + reflection floor (15) overrides debrief.max (8)", () => {
    const profile = getFormatProfile("personal_project");
    // PP stress case: 0.60 work floor + 15 reflection floor.
    // Input is deliberately loaded with non-workTime phases so remaining
    // drops below the 0.60*usable floor, forcing the floor to actually
    // BIND. This lets NC-A (revert of EDIT 6) fire: if the floor reverts
    // to the hardcoded 0.45, minWorkTime drops from 44 → 33, and the
    // exact-equals assertion below fails.
    //
    // Period=80 overflows (totalAllocated > usable+5) but overflow is
    // non-fatal (flagged in overflowLessons, not thrown). Safe to use.
    const periodMinutes = 80;
    const usable = computeUsable(periodMinutes, profile); // 72
    const expectedMinWork = Math.ceil(
      usable * profile.timingModifiers.defaultWorkTimeFloor
    ); // ceil(72*0.60) = 44
    const expectedMinReflection = profile.timingModifiers.reflectionMinimum; // 15

    const input = buildMinimalPolishedSequence(
      "personal_project",
      [
        // Heavy non-workTime phases to eat usable and force the floor to bind.
        { role: "opening", timeWeight: "extended", title: "Milestone kick-off" },
        { role: "instruction", timeWeight: "extended", title: "Mentor mini-lesson" },
        { role: "core", timeWeight: "quick", title: "Project work" },
        { role: "reflection", timeWeight: "extended", title: "Milestone reflection" },
      ],
      periodMinutes
    );

    const result = stage5_applyTiming(input, profile);

    const workTime = findPhaseDuration(result, "workTime");
    const debrief = findPhaseDuration(result, "debrief");

    // Floor binds exactly at 44 (not the hardcoded 0.45 → 33).
    expect(workTime).toBe(expectedMinWork);
    expect(debrief).toBeGreaterThanOrEqual(expectedMinReflection);
    // PP-specific: prove the reflectionMinimum override punches through
    // WORKSHOP_PHASES.debrief.max = 8. If a refactor re-introduces the max
    // clamp above the floor, this assertion fires.
    expect(debrief).toBeGreaterThan(8);
  });

  it("inquiry profile: work-time floor (0.40) + reflection floor (5) applied", () => {
    const profile = getFormatProfile("inquiry");
    const periodMinutes = 80;
    const usable = computeUsable(periodMinutes, profile);
    const expectedMinWork = Math.ceil(
      usable * profile.timingModifiers.defaultWorkTimeFloor
    );
    const expectedMinReflection = profile.timingModifiers.reflectionMinimum;

    const input = buildMinimalPolishedSequence(
      "inquiry",
      [
        { role: "core", timeWeight: "moderate", title: "Investigate question" },
      ],
      periodMinutes
    );

    const result = stage5_applyTiming(input, profile);

    expect(findPhaseDuration(result, "workTime")).toBeGreaterThanOrEqual(expectedMinWork);
    expect(findPhaseDuration(result, "debrief")).toBeGreaterThanOrEqual(expectedMinReflection);
  });

  it("no double-padding: design + 1 quick debrief → debrief === 6 (natural above floor)", () => {
    // design reflectionMinimum = 5.
    // getTimeForWeight("quick") = 6 (TIME_WEIGHT_RANGES.quick.default).
    // Natural debrief: min(8, max(3, 6)) = 6. Floor: max(5, 6) = 6.
    // Exact-equals locks Math.max as a no-op when natural ≥ minimum.
    const profile = getFormatProfile("design");
    const periodMinutes = 80;

    const input = buildMinimalPolishedSequence(
      "design",
      [
        { role: "core", timeWeight: "moderate", title: "Work" },
        { role: "reflection", timeWeight: "quick", title: "Quick reflect" },
      ],
      periodMinutes
    );

    const result = stage5_applyTiming(input, profile);

    expect(findPhaseDuration(result, "debrief")).toBe(6);
  });
});
