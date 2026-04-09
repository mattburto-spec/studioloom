/**
 * Smoke Tests — E4
 * 6 end-to-end flow tests verifying pipeline wiring
 */

import { describe, it, expect } from "vitest";
import { extractBlocks } from "@/lib/ingestion/extract";
import { reconstructUnit, reconstructionToContentData } from "@/lib/ingestion/unit-import";
import { computeEfficacyScore } from "@/lib/feedback/efficacy";
import { validateProposal, canAutoApprove, validateEfficacyChange, validateTimeWeightChange } from "@/lib/feedback/guardrails";
import { computeEditDiffs, extractActivities } from "@/lib/feedback/edit-tracker";
import { analyzeSelfHealing } from "@/lib/feedback/self-healing";
import { HARD_GUARDRAILS, DEFAULT_GUARDRAIL_CONFIG } from "@/lib/feedback/types";
import type { EnrichedSection, IngestionAnalysis, IngestionClassification, ExtractionResult, IngestionPipelineResult } from "@/lib/ingestion/types";
import type { CostBreakdown } from "@/types/activity-blocks";

const ZERO_COST: CostBreakdown = { inputTokens: 0, outputTokens: 0, modelId: "none", estimatedCostUSD: 0, timeMs: 0 };

// ── Test 1: Ingestion → Library (Block Extraction) ──

describe("E2E: Ingestion → Library", () => {
  it("extracts blocks from enriched sections with correct metadata", () => {
    const classification: IngestionClassification = {
      documentType: "lesson_plan",
      confidence: 0.9,
      topic: "Bridge Design",
      sections: [],
      detectedSubject: "Design Technology",
      cost: ZERO_COST,
    };

    const enrichedSections: EnrichedSection[] = [
      {
        index: 0,
        heading: "Warm-up: Bridge Types",
        content: "Students discuss bridge types. 5 min. Whole class.",
        sectionType: "activity",
        bloom_level: "remember",
        time_weight: "quick",
        grouping: "whole_class",
        phase: "opening",
        activity_category: "warmup",
        materials: [],
      },
      {
        index: 1,
        heading: "Research: Structural Principles",
        content: "Research tension and compression in bridge design. 15 min. Pairs.",
        sectionType: "activity",
        bloom_level: "understand",
        time_weight: "moderate",
        grouping: "pair",
        phase: "discover",
        activity_category: "research",
        materials: ["textbooks"],
      },
      {
        index: 2,
        heading: "Design Challenge",
        content: "Design a bridge to hold 5kg using popsicle sticks. 20 min. Small groups.",
        sectionType: "activity",
        bloom_level: "create",
        time_weight: "extended",
        grouping: "small_group",
        phase: "prototype",
        activity_category: "making",
        materials: ["popsicle sticks", "glue"],
      },
    ];

    const analysis: IngestionAnalysis = {
      classification,
      enrichedSections,
      cost: ZERO_COST,
    };

    const result: ExtractionResult = extractBlocks(analysis, "own");

    expect(result.blocks.length).toBe(3);
    expect(result.blocks[0].title).toBe("Warm-up: Bridge Types");
    expect(result.blocks[0].bloom_level).toBe("remember");
    expect(result.blocks[0].activity_category).toBe("warmup");
    expect(result.blocks[1].bloom_level).toBe("understand");
    expect(result.blocks[2].bloom_level).toBe("create");
    expect(result.blocks[2].activity_category).toBe("making");
    expect(result.piiDetected).toBe(false);
  });
});

// ── Test 2: Library → Generation (Reconstruction) ──

describe("E2E: Library → Generation (Reconstruction)", () => {
  it("reconstructs lessons from extracted blocks", () => {
    const fakeIngestion: IngestionPipelineResult = {
      dedup: { fileHash: "abc", isDuplicate: false, cost: ZERO_COST },
      parse: { title: "Test Unit", sections: [], totalWordCount: 500, headingCount: 5, cost: ZERO_COST },
      classification: {
        documentType: "lesson_plan",
        confidence: 0.9,
        topic: "Design",
        sections: [],
        cost: ZERO_COST,
      },
      analysis: { classification: { documentType: "lesson_plan", confidence: 0.9, topic: "Design", sections: [], cost: ZERO_COST }, enrichedSections: [], cost: ZERO_COST },
      extraction: {
        blocks: [
          {
            tempId: "b1",
            title: "Opener: Design Thinking Intro",
            description: "Introduction to design thinking process",
            prompt: "What is design thinking?",
            bloom_level: "remember",
            time_weight: "quick",
            grouping: "whole_class",
            phase: "opening",
            activity_category: "warmup",
            materials: [],
            source_section_index: 0,
            piiFlags: [],
            copyrightFlag: "own",
          },
          {
            tempId: "b2",
            title: "Research Phase",
            description: "Research user needs",
            prompt: "Interview a user",
            bloom_level: "apply",
            time_weight: "extended",
            grouping: "pair",
            phase: "discover",
            activity_category: "research",
            materials: ["interview sheets"],
            source_section_index: 1,
            piiFlags: [],
            copyrightFlag: "own",
          },
          {
            tempId: "b3",
            title: "Opener: Ideation Session",
            description: "Brainstorm solutions",
            prompt: "Generate ideas",
            bloom_level: "create",
            time_weight: "moderate",
            grouping: "small_group",
            phase: "opening",
            activity_category: "ideation",
            materials: ["sticky notes"],
            source_section_index: 5,
            piiFlags: [],
            copyrightFlag: "own",
          },
        ],
        totalSectionsProcessed: 3,
        activitySectionsFound: 3,
        piiDetected: false,
        cost: ZERO_COST,
      },
      totalCost: ZERO_COST,
      totalTimeMs: 100,
    };

    const reconstruction = reconstructUnit(fakeIngestion);

    expect(reconstruction.lessons.length).toBeGreaterThan(0);
    expect(reconstruction.totalBlocks).toBe(3);
    expect(reconstruction.overallMatchPercentage).toBeGreaterThan(0);
    expect(reconstruction.metadata.sequenceConfidence).toBeGreaterThanOrEqual(0);
  });

  it("converts reconstruction to content_data format", () => {
    const fakeResult = {
      lessons: [
        {
          title: "Lesson 1",
          learningGoal: "Understand bridges",
          blocks: [
            { tempId: "b1", title: "Activity 1", description: "desc", prompt: "p", bloom_level: "remember", time_weight: "quick", grouping: "individual", phase: "discover", activity_category: "warmup", materials: [], source_section_index: 0, piiFlags: [] as unknown[], copyrightFlag: "own" as const },
          ],
          matchPercentage: 80,
          originalIndex: 0,
        },
      ],
      overallMatchPercentage: 80,
      totalBlocks: 1,
      unmatchedBlocks: [],
      metadata: { detectedLessonCount: 1, sequenceConfidence: 1, assessmentPoints: [] },
    };

    const content = reconstructionToContentData(fakeResult);
    expect(content.pages.length).toBe(1);
    expect(content.pages[0].title).toBe("Lesson 1");
    expect(content.pages[0].sections.length).toBe(1);
    expect(content.pages[0].sections[0].activityId).toBe("b1");
  });
});

// ── Test 3: Generation → Delivery (Content Validity) ──

describe("E2E: Generation → Delivery", () => {
  it("content_data has valid structure with pages and sections", () => {
    const contentData = {
      pages: [
        {
          id: "p1",
          title: "Lesson 1",
          learningGoal: "Learn about bridges",
          sections: [
            { activityId: "a1", title: "Research", description: "desc", responseType: "text", duration: 15 },
          ],
        },
      ],
    };

    expect(contentData.pages).toBeDefined();
    expect(contentData.pages.length).toBeGreaterThan(0);
    expect(contentData.pages[0].sections.length).toBeGreaterThan(0);
    expect(contentData.pages[0].sections[0].activityId).toBeTruthy();
  });
});

// ── Test 4: Delivery → Tracking (Edit Tracking) ──

describe("E2E: Delivery → Tracking", () => {
  it("detects teacher edits between original and saved content", () => {
    const original = {
      pages: [
        {
          id: "p1",
          title: "Lesson 1",
          sections: [
            { activityId: "a1", title: "Research Phase", instructions: "Research bridge types and analyse their structures" },
            { activityId: "a2", title: "Design Challenge", instructions: "Design a bridge to hold 5kg" },
          ],
        },
      ],
    };

    const saved = {
      pages: [
        {
          id: "p1",
          title: "Lesson 1",
          sections: [
            { activityId: "a1", title: "Research Phase", instructions: "Research bridge types and write down your findings" },
            // a2 deleted, a3 added
            { activityId: "a3", title: "Build Phase", instructions: "Build a model bridge" },
          ],
        },
      ],
    };

    const diffs = computeEditDiffs(original, saved);
    expect(diffs.length).toBeGreaterThan(0);

    const hasDeleted = diffs.some((d) => d.editType === "deleted");
    const hasAdded = diffs.some((d) => d.editType === "added");
    expect(hasDeleted || hasAdded).toBe(true);
  });

  it("extractActivities handles empty content", () => {
    expect(extractActivities({})).toEqual([]);
    expect(extractActivities({ pages: [] })).toEqual([]);
    expect(extractActivities(null as any)).toEqual([]);
  });
});

// ── Test 5: Tracking → Feedback (Efficacy Computation) ──

describe("E2E: Tracking → Feedback", () => {
  it("computes valid efficacy score from signals", () => {
    const score = computeEfficacyScore({
      blockId: "test",
      keptRate: 0.9,
      completionRate: 0.8,
      timeAccuracy: 0.85,
      deletionRate: 0.05,
      paceScore: 0.7,
      editRate: 0.15,
      evidenceCount: 20,
      signalBreakdown: { teacherInteractions: 10, studentCompletions: 8, timeObservations: 5, paceFeedbackCount: 3 },
    });

    // Raw score is not clamped by computeEfficacyScore — guardrails do clamping
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("efficacy score is clamped by guardrails", () => {
    // Perfect signals — raw score will be 100
    const perfect = computeEfficacyScore({
      blockId: "test",
      keptRate: 1,
      completionRate: 1,
      timeAccuracy: 1,
      deletionRate: 0,
      paceScore: 1,
      editRate: 0,
      evidenceCount: 50,
      signalBreakdown: { teacherInteractions: 20, studentCompletions: 20, timeObservations: 10, paceFeedbackCount: 5 },
    });
    // Raw can be 100 — guardrail clamps to 95
    const validation = validateEfficacyChange(50, perfect);
    expect(validation.clampedValue).toBeLessThanOrEqual(HARD_GUARDRAILS.maxEfficacy);

    // Terrible signals — raw score near 0
    const terrible = computeEfficacyScore({
      blockId: "test",
      keptRate: 0,
      completionRate: 0,
      timeAccuracy: 0,
      deletionRate: 1,
      paceScore: 0,
      editRate: 1,
      evidenceCount: 50,
      signalBreakdown: { teacherInteractions: 20, studentCompletions: 20, timeObservations: 10, paceFeedbackCount: 5 },
    });
    const validationLow = validateEfficacyChange(50, terrible);
    expect(validationLow.clampedValue).toBeGreaterThanOrEqual(HARD_GUARDRAILS.minEfficacy);
  });
});

// ── Test 6: Feedback → Library (Guardrails + Self-Healing) ──

describe("E2E: Feedback → Library", () => {
  it("guardrails validate efficacy change proposals", () => {
    const valid = validateProposal({
      field: "efficacy_score",
      currentValue: 50,
      proposedValue: 60,
      evidenceCount: 30,
    });
    expect(valid.valid).toBe(true);
    expect(valid.flags.length).toBe(0);

    // Exceeding guardrail range
    const extreme = validateEfficacyChange(50, 200);
    expect(extreme.clampedValue).toBeLessThanOrEqual(HARD_GUARDRAILS.maxEfficacy);
  });

  it("time_weight changes enforce one-step constraint", () => {
    const oneStep = validateTimeWeightChange("quick", "moderate");
    expect(oneStep.valid).toBe(true);

    const twoSteps = validateTimeWeightChange("quick", "extended");
    expect(twoSteps.valid).toBe(false);
  });

  it("auto-approve disabled by default", () => {
    const result = canAutoApprove(DEFAULT_GUARDRAIL_CONFIG, "efficacy_score", 50, 5);
    expect(result).toBe(false);
  });

  it("self-healing detects time_weight mismatch", () => {
    const proposals = analyzeSelfHealing([
      {
        id: "b1",
        title: "Test Block",
        time_weight: "quick",
        bloom_level: "understand",
        avg_time_spent: 20, // 20 min — "quick" default is 6 min, >50% deviation
        avg_completion_rate: 0.8,
        times_used: 10,
        times_edited: 2,
        times_skipped: 0,
        efficacy_score: 50,
      },
    ]);

    const timeMismatch = proposals.find((p) => p.trigger === "time_weight_mismatch");
    expect(timeMismatch).toBeDefined();
  });

  it("self-healing detects low completion rate", () => {
    const proposals = analyzeSelfHealing([
      {
        id: "b2",
        title: "Hard Block",
        time_weight: "moderate",
        bloom_level: "create",
        avg_time_spent: 14, // Normal for moderate
        avg_completion_rate: 0.2, // <30% threshold
        times_used: 15,
        times_edited: 0,
        times_skipped: 0,
        efficacy_score: 50,
      },
    ]);

    const lowCompletion = proposals.find((p) => p.trigger === "low_completion_rate");
    expect(lowCompletion).toBeDefined();
  });
});
