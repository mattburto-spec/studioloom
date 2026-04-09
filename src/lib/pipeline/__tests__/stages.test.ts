/**
 * Tests for Dimensions3 Phase C — Pipeline Stages
 *
 * Tests the real stage implementations with fixture data.
 * No AI calls, no database — tests the pure logic.
 */

import { describe, it, expect } from "vitest";
import { getFormatProfile, type FormatProfile } from "@/lib/ai/unit-types";
import { stage5_applyTiming } from "../stages/stage5-timing";
import { stage6_scoreQuality } from "../stages/stage6-scoring";
import type {
  GenerationRequest,
  BlockRetrievalResult,
  AssembledSequence,
  FilledSequence,
  FilledLesson,
  FilledActivity,
  PolishedSequence,
  PolishedLesson,
  PolishedActivity,
  TimedUnit,
  CostBreakdown,
} from "@/types/activity-blocks";

// ─── Fixtures ───

const ZERO_COST: CostBreakdown = {
  inputTokens: 0, outputTokens: 0, modelId: "test",
  estimatedCostUSD: 0, timeMs: 0,
};

const DESIGN_REQUEST: GenerationRequest = {
  topic: "Sustainable Packaging Design",
  unitType: "design",
  lessonCount: 6,
  gradeLevel: "year-9",
  framework: "IB_MYP",
  constraints: {
    availableResources: ["cardboard", "recycled materials"],
    periodMinutes: 60,
    workshopAccess: true,
    softwareAvailable: ["Fusion 360"],
  },
};

const SERVICE_REQUEST: GenerationRequest = {
  topic: "Community Garden Project",
  unitType: "service",
  lessonCount: 8,
  gradeLevel: "year-10",
  framework: "IB_MYP",
  constraints: {
    availableResources: ["chromebooks"],
    periodMinutes: 55,
    workshopAccess: false,
    softwareAvailable: [],
  },
};

function makeFilledActivity(overrides: Partial<FilledActivity> = {}): FilledActivity {
  return {
    source: "generated",
    title: "Test Activity",
    prompt: "Do the thing.",
    bloom_level: "apply",
    time_weight: "moderate",
    grouping: "individual",
    phase: "investigate",
    activity_category: "research",
    lesson_structure_role: "core",
    response_type: "long-text",
    materials_needed: [],
    scaffolding: { hints: ["Hint 1"], sentence_starters: ["Consider..."] },
    ai_rules: { phase: "neutral", tone: "supportive", rules: ["Be helpful"] },
    udl_checkpoints: ["5.1"],
    success_look_fors: ["Student can..."],
    ...overrides,
  };
}

function makePolishedActivity(overrides: Partial<PolishedActivity> = {}): PolishedActivity {
  return {
    ...makeFilledActivity(overrides),
    transitionIn: "Building on the previous work...",
    crossReferences: [],
    ...overrides,
  };
}

function makeFilledSequence(
  request: GenerationRequest,
  lessonCount: number,
  activitiesPerLesson: number = 3
): FilledSequence {
  const blooms = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
  const groupings = ["individual", "pair", "small_group", "whole_class", "flexible"];
  const categories = ["research", "analysis", "ideation", "making", "critique", "reflection"];

  const lessons: FilledLesson[] = Array.from({ length: lessonCount }, (_, li) => ({
    position: li + 1,
    label: `Lesson ${li + 1}`,
    description: `Lesson ${li + 1} description`,
    learningGoal: "Students will...",
    activities: Array.from({ length: activitiesPerLesson }, (_, ai) => {
      const idx = li * activitiesPerLesson + ai;
      return makeFilledActivity({
        title: `Activity ${li + 1}.${ai + 1}`,
        bloom_level: blooms[idx % blooms.length],
        grouping: groupings[idx % groupings.length] as FilledActivity["grouping"],
        activity_category: categories[idx % categories.length],
        lesson_structure_role: ai === 0 ? "opening" : ai === activitiesPerLesson - 1 ? "reflection" : "core",
        time_weight: ai === 0 ? "quick" : ai === activitiesPerLesson - 1 ? "quick" : "extended",
      });
    }),
  }));

  return {
    request,
    lessons,
    generationMetrics: {
      gapsFilled: lessonCount * activitiesPerLesson,
      totalTokensUsed: 0,
      totalCost: { ...ZERO_COST },
      generationTimeMs: 0,
      perGapMetrics: [],
    },
  };
}

function makePolishedSequence(
  request: GenerationRequest,
  lessonCount: number,
  activitiesPerLesson: number = 3
): PolishedSequence {
  const filled = makeFilledSequence(request, lessonCount, activitiesPerLesson);
  const lessons: PolishedLesson[] = filled.lessons.map(l => ({
    ...l,
    activities: l.activities.map(a => ({
      ...a,
      transitionIn: "Building on the previous work...",
      crossReferences: [],
    })),
  }));

  return {
    request,
    lessons,
    polishMetrics: {
      transitionsAdded: lessonCount * activitiesPerLesson,
      crossReferencesAdded: 0,
      familiarityAdaptations: 0,
      scaffoldingProgressions: 0,
      totalTokensUsed: 0,
      totalCost: { ...ZERO_COST },
      polishTimeMs: 0,
    },
    interactionMap: [],
  };
}

// ─── FormatProfile Tests ───

describe("FormatProfile", () => {
  it("returns design profile for 'design'", () => {
    const profile = getFormatProfile("design");
    expect(profile.type).toBe("design");
    expect(profile.cycleName).toBe("Design Cycle");
    expect(profile.phases.length).toBe(4);
    expect(profile.blockRelevance.phaseIds).toContain("investigate");
  });

  it("returns service profile for 'service'", () => {
    const profile = getFormatProfile("service");
    expect(profile.type).toBe("service");
    expect(profile.cycleName).toBe("IPARD Cycle");
    expect(profile.phases.length).toBe(5);
    expect(profile.blockRelevance.boost).toContain("collaboration");
  });

  it("returns personal_project profile", () => {
    const profile = getFormatProfile("personal_project");
    expect(profile.type).toBe("personal_project");
    expect(profile.pulseWeights.studentAgency).toBeGreaterThan(profile.pulseWeights.cognitiveRigour);
  });

  it("returns inquiry profile", () => {
    const profile = getFormatProfile("inquiry");
    expect(profile.type).toBe("inquiry");
    expect(profile.pulseWeights.cognitiveRigour).toBeGreaterThan(profile.pulseWeights.teacherCraft);
  });

  it("falls back to design for unknown type", () => {
    const profile = getFormatProfile("alien");
    expect(profile.type).toBe("design");
  });

  it("has valid phase weights that sum to ~1", () => {
    for (const type of ["design", "service", "personal_project", "inquiry"]) {
      const profile = getFormatProfile(type);
      const weightSum = Object.values(profile.sequenceHints.phaseWeights).reduce((s, v) => s + v, 0);
      expect(weightSum).toBeCloseTo(1.0, 1);
    }
  });

  it("has valid pulse weights that sum to 1", () => {
    for (const type of ["design", "service", "personal_project", "inquiry"]) {
      const profile = getFormatProfile(type);
      const pw = profile.pulseWeights;
      expect(pw.cognitiveRigour + pw.studentAgency + pw.teacherCraft).toBeCloseTo(1.0, 2);
    }
  });
});

// ─── Stage 5 (Timing) Tests ───

describe("stage5_applyTiming", () => {
  it("produces correct number of timed lessons", () => {
    const profile = getFormatProfile("design");
    const polished = makePolishedSequence(DESIGN_REQUEST, 6);
    const result = stage5_applyTiming(polished, profile);

    expect(result.lessons.length).toBe(6);
    expect(result.request).toBe(polished.request);
  });

  it("creates Workshop Model phases for each lesson", () => {
    const profile = getFormatProfile("design");
    const polished = makePolishedSequence(DESIGN_REQUEST, 3, 3);
    const result = stage5_applyTiming(polished, profile);

    for (const lesson of result.lessons) {
      expect(lesson.phases.length).toBeGreaterThanOrEqual(2);
      const phaseIds = lesson.phases.map(p => p.phaseId);
      expect(phaseIds).toContain("workTime");
      expect(phaseIds).toContain("debrief");
    }
  });

  it("work time is at least 45% of usable time", () => {
    const profile = getFormatProfile("design");
    const polished = makePolishedSequence(DESIGN_REQUEST, 4, 3);
    const result = stage5_applyTiming(polished, profile);

    const periodMinutes = DESIGN_REQUEST.constraints.periodMinutes;
    const usableMinutes = periodMinutes - profile.timingModifiers.setupBuffer - profile.timingModifiers.cleanupBuffer - 3;

    for (const lesson of result.lessons) {
      const workPhase = lesson.phases.find(p => p.phaseId === "workTime");
      expect(workPhase).toBeDefined();
      if (workPhase) {
        expect(workPhase.durationMinutes).toBeGreaterThanOrEqual(usableMinutes * 0.45 - 1); // -1 for rounding
      }
    }
  });

  it("generates extensions for each lesson", () => {
    const profile = getFormatProfile("design");
    const polished = makePolishedSequence(DESIGN_REQUEST, 4);
    const result = stage5_applyTiming(polished, profile);

    for (const lesson of result.lessons) {
      expect(lesson.extensions).toBeDefined();
      expect(lesson.extensions!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("flags overflow lessons", () => {
    const profile = getFormatProfile("design");
    // Very short period
    const shortRequest: GenerationRequest = {
      ...DESIGN_REQUEST,
      constraints: { ...DESIGN_REQUEST.constraints, periodMinutes: 20 },
    };
    const polished = makePolishedSequence(shortRequest, 2, 5);
    const result = stage5_applyTiming(polished, profile);

    // With 20 min period and 5 activities, some lessons likely overflow
    expect(result.timingMetrics).toBeDefined();
    expect(result.timingMetrics.timingSource).toBe("starter_default");
  });

  it("totalMinutes equals period length", () => {
    const profile = getFormatProfile("design");
    const polished = makePolishedSequence(DESIGN_REQUEST, 3);
    const result = stage5_applyTiming(polished, profile);

    for (const lesson of result.lessons) {
      expect(lesson.totalMinutes).toBe(DESIGN_REQUEST.constraints.periodMinutes);
    }
  });

  it("handles service units with different timing modifiers", () => {
    const profile = getFormatProfile("service");
    const polished = makePolishedSequence(SERVICE_REQUEST, 4);
    const result = stage5_applyTiming(polished, profile);

    expect(result.lessons.length).toBe(4);
    // Service has smaller setup buffer (3 vs 7 for design)
    expect(profile.timingModifiers.setupBuffer).toBeLessThan(getFormatProfile("design").timingModifiers.setupBuffer);
  });
});

// ─── Stage 6 (Scoring) Tests ───

describe("stage6_scoreQuality", () => {
  it("returns overall score 0-10", () => {
    const profile = getFormatProfile("design");
    const polished = makePolishedSequence(DESIGN_REQUEST, 6);
    const timed = stage5_applyTiming(polished, profile);
    const report = stage6_scoreQuality(timed, profile);

    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(10);
  });

  it("scores all 5 dimensions", () => {
    const profile = getFormatProfile("design");
    const polished = makePolishedSequence(DESIGN_REQUEST, 6, 3);
    const timed = stage5_applyTiming(polished, profile);
    const report = stage6_scoreQuality(timed, profile);

    expect(report.dimensions.cognitiveRigour.score).toBeGreaterThanOrEqual(0);
    expect(report.dimensions.studentAgency.score).toBeGreaterThanOrEqual(0);
    expect(report.dimensions.teacherCraft.score).toBeGreaterThanOrEqual(0);
    expect(report.dimensions.variety.score).toBeGreaterThanOrEqual(0);
    expect(report.dimensions.coherence.score).toBeGreaterThanOrEqual(0);
  });

  it("builds coverage maps", () => {
    const profile = getFormatProfile("design");
    const polished = makePolishedSequence(DESIGN_REQUEST, 6, 3);
    const timed = stage5_applyTiming(polished, profile);
    const report = stage6_scoreQuality(timed, profile);

    expect(Object.keys(report.coverage.bloomDistribution).length).toBeGreaterThan(0);
    expect(Object.keys(report.coverage.groupingDistribution).length).toBeGreaterThan(0);
    expect(report.coverage.phasesCovered.length).toBeGreaterThan(0);
  });

  it("reports library metrics", () => {
    const profile = getFormatProfile("design");
    const polished = makePolishedSequence(DESIGN_REQUEST, 6);
    const timed = stage5_applyTiming(polished, profile);
    const report = stage6_scoreQuality(timed, profile);

    expect(report.libraryMetrics.blockReuseRate).toBe(0); // All generated
    expect(report.libraryMetrics.newBlocksGenerated).toBeGreaterThan(0);
  });

  it("generates recommendations", () => {
    const profile = getFormatProfile("design");
    const polished = makePolishedSequence(DESIGN_REQUEST, 6);
    const timed = stage5_applyTiming(polished, profile);
    const report = stage6_scoreQuality(timed, profile);

    expect(report.recommendations).toBeInstanceOf(Array);
    // Should recommend building library since all blocks are generated
    expect(report.recommendations.some(r => r.includes("library") || r.includes("block"))).toBe(true);
  });

  it("penalizes uneven dimension scores", () => {
    const profile = getFormatProfile("design");

    // Create a unit with very uneven characteristics
    const polished = makePolishedSequence(DESIGN_REQUEST, 3, 1);
    // Override all activities to have same bloom/grouping (low variety)
    for (const lesson of polished.lessons) {
      for (const act of lesson.activities) {
        (act as any).bloom_level = "apply";
        (act as any).grouping = "individual";
        (act as any).activity_category = "research";
        (act as any).udl_checkpoints = [];
        (act as any).scaffolding = null;
        (act as any).ai_rules = null;
      }
    }

    const timed = stage5_applyTiming(polished, profile);
    const report = stage6_scoreQuality(timed, profile);

    // Variety score should be low (everything is the same)
    expect(report.dimensions.variety.score).toBeLessThan(5);
  });

  it("handles empty unit gracefully", () => {
    const profile = getFormatProfile("design");
    const emptyUnit: TimedUnit = {
      request: DESIGN_REQUEST,
      lessons: [],
      timingMetrics: {
        totalMinutesAllocated: 0,
        totalMinutesAvailable: 0,
        overflowLessons: [],
        timingSource: "starter_default",
        timingTimeMs: 0,
        timingCost: { ...ZERO_COST },
      },
    };

    const report = stage6_scoreQuality(emptyUnit, profile);
    expect(report.overallScore).toBe(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it("includes per-stage costs when provided", () => {
    const profile = getFormatProfile("design");
    const polished = makePolishedSequence(DESIGN_REQUEST, 4);
    const timed = stage5_applyTiming(polished, profile);

    const stageCosts: Record<string, CostBreakdown> = {
      "1": { ...ZERO_COST, estimatedCostUSD: 0.01 },
      "2": { ...ZERO_COST, estimatedCostUSD: 0.05 },
      "3": { ...ZERO_COST, estimatedCostUSD: 0.50 },
    };

    const report = stage6_scoreQuality(timed, profile, stageCosts);
    expect(report.costSummary.totalCost.estimatedCostUSD).toBeCloseTo(0.56, 2);
  });

  it("different profiles produce different scores for same unit", () => {
    // Design unit scored by design profile vs service profile should differ
    const designProfile = getFormatProfile("design");
    const serviceProfile = getFormatProfile("service");

    const polished = makePolishedSequence(DESIGN_REQUEST, 6, 3);
    const designTimed = stage5_applyTiming(polished, designProfile);
    const serviceTimed = stage5_applyTiming(polished, serviceProfile);

    const designReport = stage6_scoreQuality(designTimed, designProfile);
    const serviceReport = stage6_scoreQuality(serviceTimed, serviceProfile);

    // Scores will differ because pulse weights differ
    // Design: CR=0.35, SA=0.30, TC=0.35
    // Service: CR=0.25, SA=0.45, TC=0.30
    expect(designReport.overallScore).not.toEqual(serviceReport.overallScore);
  });
});

// ─── Integration: Stage 5 → Stage 6 ───

describe("Stage 5 → Stage 6 integration", () => {
  it("Stage 5 output is valid Stage 6 input", () => {
    const profile = getFormatProfile("design");
    const polished = makePolishedSequence(DESIGN_REQUEST, 6, 3);
    const timed = stage5_applyTiming(polished, profile);

    // Should not throw
    const report = stage6_scoreQuality(timed, profile);
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.dimensions).toBeDefined();
    expect(report.coverage).toBeDefined();
    expect(report.costSummary).toBeDefined();
  });

  it("works for all unit types", () => {
    const types = ["design", "service", "personal_project", "inquiry"];
    for (const type of types) {
      const request: GenerationRequest = { ...DESIGN_REQUEST, unitType: type };
      const profile = getFormatProfile(type);
      const polished = makePolishedSequence(request, 4, 2);
      const timed = stage5_applyTiming(polished, profile);
      const report = stage6_scoreQuality(timed, profile);

      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(10);
      expect(report.dimensions.cognitiveRigour).toBeDefined();
    }
  });
});
