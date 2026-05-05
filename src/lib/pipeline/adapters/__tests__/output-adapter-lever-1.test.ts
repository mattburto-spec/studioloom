/**
 * Lever 1 sub-phase 1G — output adapter composition.
 *
 * Verifies the W2 output adapter (PolishedActivity → ActivitySection)
 * correctly:
 *   - Passes framing/task/success_signal through unchanged
 *   - Composes the legacy `prompt` field from the three slots when
 *     they're populated (so non-migrated readers see the right text)
 *   - Falls back to legacy activity.prompt when slots are empty
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 */

import { describe, it, expect } from "vitest";
import { timedUnitToContentData } from "../output-adapter";
import type {
  TimedUnit,
  TimedLesson,
  TimedPhase,
  PolishedActivity,
  GenerationRequest,
  CostBreakdown,
} from "@/types/activity-blocks";

const zeroCost: CostBreakdown = { inputTokens: 0, outputTokens: 0, totalUSD: 0 };

function makeActivity(overrides: Partial<PolishedActivity> = {}): PolishedActivity {
  return {
    source: "generated",
    title: "Test Activity",
    framing: "",
    task: "",
    success_signal: "",
    prompt: "",
    bloom_level: "apply",
    time_weight: "moderate",
    grouping: "individual",
    phase: "work-time",
    activity_category: "making",
    lesson_structure_role: "core",
    response_type: "text",
    materials_needed: ["paper"],
    ...overrides,
  };
}

function makePhase(label: string, durationMinutes: number, activities: PolishedActivity[]): TimedPhase {
  return {
    label,
    phaseId: label.toLowerCase().replace(/\s+/g, "-"),
    activities,
    durationMinutes,
    isFlexible: false,
  };
}

function makeUnit(activities: PolishedActivity[]): TimedUnit {
  // Single-phase fixture so section[0] in the resulting page IS our test
  // activity. Avoids having phase placeholders pollute the flat sections
  // array (the output adapter concats all phase activities in order).
  const lesson: TimedLesson = {
    position: 0,
    label: "Lesson 1",
    description: "Test lesson",
    learningGoal: "Learn things",
    activities,
    phases: [makePhase("work-time", 30, activities)],
    totalMinutes: 30,
  };
  const request: GenerationRequest = {
    topic: "Test Topic",
    unitType: "design",
    lessonCount: 1,
    gradeLevel: "Year 8",
    framework: "IB_MYP",
    constraints: {
      availableResources: [],
      periodMinutes: 60,
      workshopAccess: true,
      softwareAvailable: [],
    },
  };
  return {
    request,
    lessons: [lesson],
    polishMetrics: {
      transitionsAdded: 0,
      crossReferencesAdded: 0,
      familiarityAdaptations: 0,
      scaffoldingProgressions: 0,
      totalTokensUsed: 0,
      totalCost: { ...zeroCost, timeMs: 0 },
      polishTimeMs: 0,
    },
    interactionMap: [],
    timingMetrics: {
      totalDurationMinutes: 50,
      lessonDurations: [50],
      adjustmentsMade: 0,
    },
  };
}

describe("output-adapter — Lever 1 v2 slot composition", () => {
  it("passes framing/task/success_signal through to ActivitySection", () => {
    const v2Activity = makeActivity({
      framing: "Today we explore Newton's laws.",
      task: "Roll each racer down the ramp and observe.",
      success_signal: "Submit one conclusion sentence.",
    });
    const unit = makeUnit([v2Activity]);
    const result = timedUnitToContentData(unit, [], { ...zeroCost, timeMs: 0 });
    const page = result.contentData.pages?.[0];
    const section = page?.content?.sections?.[0];
    expect(section?.framing).toBe("Today we explore Newton's laws.");
    expect(section?.task).toBe("Roll each racer down the ramp and observe.");
    expect(section?.success_signal).toBe("Submit one conclusion sentence.");
  });

  it("composes legacy prompt from the three slots when present (Lesson #38 — exact value)", () => {
    const v2Activity = makeActivity({
      framing: "F",
      task: "T",
      success_signal: "S",
      prompt: "ignored when slots present",
    });
    const unit = makeUnit([v2Activity]);
    const result = timedUnitToContentData(unit, [], { ...zeroCost, timeMs: 0 });
    const section = result.contentData.pages?.[0]?.content?.sections?.[0];
    expect(section?.prompt).toBe("F\n\nT\n\nS");
  });

  it("falls back to legacy activity.prompt when all three slots are empty", () => {
    const legacyActivity = makeActivity({
      framing: "",
      task: "",
      success_signal: "",
      prompt: "Legacy single-blob fallback prompt.",
    });
    const unit = makeUnit([legacyActivity]);
    const result = timedUnitToContentData(unit, [], { ...zeroCost, timeMs: 0 });
    const section = result.contentData.pages?.[0]?.content?.sections?.[0];
    expect(section?.prompt).toBe("Legacy single-blob fallback prompt.");
    expect(section?.framing).toBeUndefined();
    expect(section?.task).toBeUndefined();
    expect(section?.success_signal).toBeUndefined();
  });

  it("composes from partial slots (only framing + task, no signal)", () => {
    const partial = makeActivity({
      framing: "Framing.",
      task: "Task.",
      success_signal: "",
    });
    const unit = makeUnit([partial]);
    const result = timedUnitToContentData(unit, [], { ...zeroCost, timeMs: 0 });
    const section = result.contentData.pages?.[0]?.content?.sections?.[0];
    expect(section?.prompt).toBe("Framing.\n\nTask.");
    expect(section?.framing).toBe("Framing.");
    expect(section?.task).toBe("Task.");
    expect(section?.success_signal).toBeUndefined();
  });
});
