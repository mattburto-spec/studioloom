import { describe, it, expect } from "vitest";
import {
  stage0_validateInput,
  stage1_retrieveBlocks,
  stage2_assembleSequence,
  stage3_fillGaps,
  stage4_polish,
  stage5_applyTiming,
  stage6_scoreQuality,
  runSimulatedPipeline,
} from "../pipeline";
import type { GenerationRequest } from "@/types/activity-blocks";

// =========================================================================
// Shared fixture
// =========================================================================

const DESIGN_REQUEST: GenerationRequest = {
  topic: "Sustainable Packaging Design",
  unitType: "design",
  lessonCount: 6,
  gradeLevel: "year-9",
  framework: "IB_MYP",
  constraints: {
    availableResources: ["cardboard", "recycled materials", "3d-printer"],
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

// =========================================================================
// Stage 0: Input Validation
// =========================================================================

describe("stage0_validateInput", () => {
  it("returns the request and a FormatProfile", () => {
    const result = stage0_validateInput(DESIGN_REQUEST);
    expect(result.request).toBe(DESIGN_REQUEST);
    expect(result.profile.type).toBe("design");
    expect(result.cost.estimatedCostUSD).toBe(0);
  });

  it("falls back to design for unknown unit type", () => {
    const result = stage0_validateInput({ ...DESIGN_REQUEST, unitType: "alien" });
    expect(result.profile.type).toBe("design");
  });
});

// =========================================================================
// Stage 1: Block Retrieval
// =========================================================================

describe("stage1_retrieveBlocks", () => {
  it("returns candidates from fixture blocks", () => {
    const { profile } = stage0_validateInput(DESIGN_REQUEST);
    const result = stage1_retrieveBlocks(DESIGN_REQUEST, profile);

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.retrievalMetrics.totalBlocksSearched).toBeGreaterThan(0);
    expect(result.retrievalMetrics.retrievalCost.estimatedCostUSD).toBe(0);
  });

  it("returns different candidates for different profiles", () => {
    const designProfile = stage0_validateInput(DESIGN_REQUEST).profile;
    const serviceProfile = stage0_validateInput(SERVICE_REQUEST).profile;

    const designResult = stage1_retrieveBlocks(DESIGN_REQUEST, designProfile);
    const serviceResult = stage1_retrieveBlocks(SERVICE_REQUEST, serviceProfile);

    // Design should boost "making" blocks, service should suppress them
    const designMaking = designResult.candidates.filter(
      (c) => c.block.activity_category === "making"
    );
    const serviceMaking = serviceResult.candidates.filter(
      (c) => c.block.activity_category === "making"
    );

    // Service suppresses making — those blocks should score lower or be filtered out
    if (serviceMaking.length > 0 && designMaking.length > 0) {
      expect(serviceMaking[0].relevanceScore).toBeLessThanOrEqual(
        designMaking[0].relevanceScore
      );
    }
  });
});

// =========================================================================
// Stage 2: Sequence Assembly
// =========================================================================

describe("stage2_assembleSequence", () => {
  it("produces correct number of lessons", () => {
    const { profile } = stage0_validateInput(DESIGN_REQUEST);
    const retrieval = stage1_retrieveBlocks(DESIGN_REQUEST, profile);
    const result = stage2_assembleSequence(retrieval, profile);

    expect(result.lessons).toHaveLength(6);
    expect(result.sequenceMetrics.totalSlots).toBeGreaterThanOrEqual(6);
    expect(result.sequenceMetrics.fillRate).toBeGreaterThanOrEqual(0);
    expect(result.sequenceMetrics.fillRate).toBeLessThanOrEqual(1);
  });

  it("tracks fill rate correctly", () => {
    const { profile } = stage0_validateInput(DESIGN_REQUEST);
    const retrieval = stage1_retrieveBlocks(DESIGN_REQUEST, profile);
    const result = stage2_assembleSequence(retrieval, profile);

    const { filledFromLibrary, gapsToGenerate, totalSlots } = result.sequenceMetrics;
    expect(filledFromLibrary + gapsToGenerate).toBe(totalSlots);
  });

  it("handles empty block library (all gaps)", () => {
    const { profile } = stage0_validateInput(DESIGN_REQUEST);
    const emptyRetrieval = stage1_retrieveBlocks(
      { ...DESIGN_REQUEST, topic: "xyznonexistent" },
      profile
    );
    // Even with no perfect matches, some fixture blocks may have base score > 0.2
    const result = stage2_assembleSequence(emptyRetrieval, profile);
    expect(result.lessons).toHaveLength(6);
  });
});

// =========================================================================
// Stage 3: Gap Fill
// =========================================================================

describe("stage3_fillGaps", () => {
  it("fills all gaps with [GENERATED] markers", () => {
    const { profile } = stage0_validateInput(DESIGN_REQUEST);
    const retrieval = stage1_retrieveBlocks(DESIGN_REQUEST, profile);
    const assembled = stage2_assembleSequence(retrieval, profile);
    const filled = stage3_fillGaps(assembled, profile);

    expect(filled.lessons).toHaveLength(6);
    for (const lesson of filled.lessons) {
      expect(lesson.activities.length).toBeGreaterThan(0);
      expect(lesson.learningGoal).toBeTruthy();
      for (const act of lesson.activities) {
        expect(act.title).toBeTruthy();
        expect(act.prompt).toBeTruthy();
        if (act.source === "generated") {
          expect(act.title).toContain("[GENERATED]");
        }
      }
    }
    expect(filled.generationMetrics.totalCost.estimatedCostUSD).toBe(0);
  });
});

// =========================================================================
// Stage 4: Polish
// =========================================================================

describe("stage4_polish", () => {
  it("adds transitions with [POLISHED] markers", () => {
    const { profile } = stage0_validateInput(DESIGN_REQUEST);
    const retrieval = stage1_retrieveBlocks(DESIGN_REQUEST, profile);
    const assembled = stage2_assembleSequence(retrieval, profile);
    const filled = stage3_fillGaps(assembled, profile);
    const polished = stage4_polish(filled, profile);

    expect(polished.polishMetrics.transitionsAdded).toBeGreaterThan(0);
    // First activity of first lesson should NOT have a transition
    expect(polished.lessons[0].activities[0].transitionIn).toBeUndefined();
    // Other activities should have transitions
    if (polished.lessons.length > 1) {
      expect(polished.lessons[1].activities[0].transitionIn).toContain("[POLISHED]");
    }
  });
});

// =========================================================================
// Stage 5: Timing
// =========================================================================

describe("stage5_applyTiming", () => {
  it("assigns timing to all lessons", () => {
    const { profile } = stage0_validateInput(DESIGN_REQUEST);
    const retrieval = stage1_retrieveBlocks(DESIGN_REQUEST, profile);
    const assembled = stage2_assembleSequence(retrieval, profile);
    const filled = stage3_fillGaps(assembled, profile);
    const polished = stage4_polish(filled, profile);
    const timed = stage5_applyTiming(polished, profile);

    expect(timed.lessons).toHaveLength(6);
    for (const lesson of timed.lessons) {
      expect(lesson.totalMinutes).toBe(60); // matches constraint
      expect(lesson.phases.length).toBeGreaterThan(0);
      expect(lesson.extensions!.length).toBeGreaterThan(0);
    }
    expect(timed.timingMetrics.timingSource).toBe("starter_default");
    expect(timed.timingMetrics.timingCost.estimatedCostUSD).toBe(0);
  });
});

// =========================================================================
// Stage 6: Quality Scoring
// =========================================================================

describe("stage6_scoreQuality", () => {
  it("returns a valid QualityReport", () => {
    const { profile } = stage0_validateInput(DESIGN_REQUEST);
    const retrieval = stage1_retrieveBlocks(DESIGN_REQUEST, profile);
    const assembled = stage2_assembleSequence(retrieval, profile);
    const filled = stage3_fillGaps(assembled, profile);
    const polished = stage4_polish(filled, profile);
    const timed = stage5_applyTiming(polished, profile);
    const report = stage6_scoreQuality(timed, profile);

    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(10);
    expect(report.dimensions.cognitiveRigour.score).toBeGreaterThanOrEqual(0);
    expect(report.dimensions.studentAgency.score).toBeGreaterThanOrEqual(0);
    expect(report.dimensions.teacherCraft.score).toBeGreaterThanOrEqual(0);
    expect(report.costSummary.totalCost.estimatedCostUSD).toBe(0);
  });
});

// =========================================================================
// Full Pipeline
// =========================================================================

describe("runSimulatedPipeline", () => {
  it("runs design pipeline end-to-end", () => {
    const result = runSimulatedPipeline(DESIGN_REQUEST);

    expect(result.timedUnit.lessons).toHaveLength(6);
    expect(result.qualityReport.overallScore).toBeGreaterThan(0);
    expect(Object.keys(result.stageTimings)).toHaveLength(7); // stages 0-6
  });

  it("runs service pipeline end-to-end", () => {
    const result = runSimulatedPipeline(SERVICE_REQUEST);

    expect(result.timedUnit.lessons).toHaveLength(8);
    expect(result.qualityReport.overallScore).toBeGreaterThan(0);
  });

  it("handles 1-lesson unit", () => {
    const result = runSimulatedPipeline({ ...DESIGN_REQUEST, lessonCount: 1 });
    expect(result.timedUnit.lessons).toHaveLength(1);
  });

  it("handles 20-lesson unit", () => {
    const result = runSimulatedPipeline({ ...DESIGN_REQUEST, lessonCount: 20 });
    expect(result.timedUnit.lessons).toHaveLength(20);
  });

  it("FormatProfile injection changes behavior", () => {
    const designResult = runSimulatedPipeline(DESIGN_REQUEST);
    const serviceResult = runSimulatedPipeline(SERVICE_REQUEST);

    // Different profiles should produce different overall scores
    // because pulse weights differ (design CR=0.40 vs service CR=0.25)
    // and different lesson counts produce different block distributions
    expect(designResult.qualityReport.overallScore).not.toBe(
      serviceResult.qualityReport.overallScore
    );
  });

  it("all CostBreakdowns show zero cost (simulator mode)", () => {
    const result = runSimulatedPipeline(DESIGN_REQUEST);
    expect(result.qualityReport.costSummary.totalCost.estimatedCostUSD).toBe(0);
    for (const stage of Object.values(result.qualityReport.costSummary.perStageCost)) {
      expect(stage.estimatedCostUSD).toBe(0);
    }
  });
});
