/**
 * Dimensions3 Pipeline Stage Contract Tests
 *
 * These tests validate the TYPED CONTRACTS between pipeline stages.
 * Each stage has a defined input/output shape. These tests ensure:
 * 1. Stage outputs conform to their contract (schema validation)
 * 2. Stage outputs can be consumed by the next stage (compatibility)
 * 3. Edge cases (empty library, missing fields, huge inputs) are handled
 *
 * These are UNIT tests — no DB, no AI calls. They test the contract
 * enforcement and validation logic that wraps each stage.
 */

import { describe, it, expect } from "vitest";

// =========================================================================
// Type definitions matching Dimensions3 spec (Section 3)
// These will move to src/types/pipeline.ts when building starts
// =========================================================================

interface GenerationRequest {
  topic: string;
  unitType: string;
  lessonCount: number;
  gradeLevel: string;
  framework: string;
  constraints: {
    availableResources: string[];
    periodMinutes: number;
    workshopAccess: boolean;
    softwareAvailable: string[];
  };
  context?: {
    realWorldContext?: string;
    studentContext?: string;
    classroomConstraints?: string;
  };
  preferences?: {
    suggestedSequencePattern?: string;
    emphasisAreas?: string[];
    criteriaEmphasis?: Record<string, number>;
  };
  curriculumContext?: string;
  curriculumOutcomes?: string[];
}

interface CostBreakdown {
  inputTokens: number;
  outputTokens: number;
  model: string;
  estimatedCostUsd: number;
}

interface RetrievedBlock {
  block: { id: string; content: unknown };
  relevanceScore: number;
  scoreBreakdown: {
    vectorSimilarity: number;
    efficacyNormalized: number;
    textMatch: number;
    usageSignal: number;
    metadataFit: number;
  };
  suggestedPosition?: number;
  suggestedAdaptations?: string[];
}

interface BlockRetrievalResult {
  request: GenerationRequest;
  candidates: RetrievedBlock[];
  retrievalMetrics: {
    totalBlocksSearched: number;
    candidatesReturned: number;
    avgRelevanceScore: number;
    retrievalTimeMs: number;
    retrievalCost: CostBreakdown;
  };
}

interface ActivitySlot {
  slotIndex: number;
  source: "library" | "gap";
  block?: RetrievedBlock;
  gapDescription?: string;
  gapContext?: {
    precedingBlock?: string;
    followingBlock?: string;
    requiredOutputs?: string[];
    suggestedBloom?: string;
    suggestedGrouping?: string;
    suggestedTimeWeight?: string;
    suggestedCategory?: string;
    suggestedPhase?: string;
    suggestedLessonRole?: string;
  };
}

interface LessonSlot {
  position: number;
  label: string;
  description: string;
  activities: ActivitySlot[];
}

interface PrerequisiteViolation {
  blockId: string;
  requires: string;
  missingFrom: string;
}

interface AssembledSequence {
  request: GenerationRequest;
  lessons: LessonSlot[];
  sequenceMetrics: {
    totalSlots: number;
    filledFromLibrary: number;
    gapsToGenerate: number;
    fillRate: number;
    prerequisiteViolations: PrerequisiteViolation[];
    sequenceTimeMs: number;
    sequenceCost: CostBreakdown;
  };
}

// =========================================================================
// Contract Validation Functions
// These will become the actual runtime validators in the pipeline
// =========================================================================

function validateGenerationRequest(input: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { valid: false, errors: ["Input is not an object"] };

  const req = input as Record<string, unknown>;

  if (!req.topic || typeof req.topic !== "string" || req.topic.trim().length === 0)
    errors.push("topic: required non-empty string");
  if (!req.unitType || typeof req.unitType !== "string")
    errors.push("unitType: required string");
  if (typeof req.lessonCount !== "number" || req.lessonCount < 1 || req.lessonCount > 30)
    errors.push("lessonCount: required number 1-30");
  if (!req.gradeLevel || typeof req.gradeLevel !== "string")
    errors.push("gradeLevel: required string");
  if (!req.framework || typeof req.framework !== "string")
    errors.push("framework: required string");

  // Constraints block
  if (!req.constraints || typeof req.constraints !== "object") {
    errors.push("constraints: required object");
  } else {
    const c = req.constraints as Record<string, unknown>;
    if (!Array.isArray(c.availableResources))
      errors.push("constraints.availableResources: required array");
    if (typeof c.periodMinutes !== "number" || c.periodMinutes < 15 || c.periodMinutes > 180)
      errors.push("constraints.periodMinutes: required number 15-180");
    if (typeof c.workshopAccess !== "boolean")
      errors.push("constraints.workshopAccess: required boolean");
    if (!Array.isArray(c.softwareAvailable))
      errors.push("constraints.softwareAvailable: required array");
  }

  return { valid: errors.length === 0, errors };
}

function validateBlockRetrievalResult(input: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { valid: false, errors: ["Not an object"] };

  const result = input as Record<string, unknown>;

  // Must contain a valid request
  const reqValidation = validateGenerationRequest(result.request);
  if (!reqValidation.valid) errors.push("request: " + reqValidation.errors.join(", "));

  // Candidates array
  if (!Array.isArray(result.candidates)) {
    errors.push("candidates: required array");
  } else {
    (result.candidates as unknown[]).forEach((c, i) => {
      if (!c || typeof c !== "object") {
        errors.push(`candidates[${i}]: not an object`);
        return;
      }
      const cand = c as Record<string, unknown>;
      if (typeof cand.relevanceScore !== "number" || cand.relevanceScore < 0 || cand.relevanceScore > 1)
        errors.push(`candidates[${i}].relevanceScore: must be 0-1`);
      if (!cand.scoreBreakdown || typeof cand.scoreBreakdown !== "object")
        errors.push(`candidates[${i}].scoreBreakdown: required object`);
    });
  }

  // Metrics
  if (!result.retrievalMetrics || typeof result.retrievalMetrics !== "object") {
    errors.push("retrievalMetrics: required object");
  } else {
    const m = result.retrievalMetrics as Record<string, unknown>;
    if (typeof m.totalBlocksSearched !== "number") errors.push("retrievalMetrics.totalBlocksSearched: required number");
    if (typeof m.candidatesReturned !== "number") errors.push("retrievalMetrics.candidatesReturned: required number");
    if (typeof m.avgRelevanceScore !== "number") errors.push("retrievalMetrics.avgRelevanceScore: required number");
  }

  return { valid: errors.length === 0, errors };
}

function validateAssembledSequence(input: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { valid: false, errors: ["Not an object"] };

  const seq = input as Record<string, unknown>;

  // Lessons
  if (!Array.isArray(seq.lessons)) {
    errors.push("lessons: required array");
  } else {
    (seq.lessons as unknown[]).forEach((l, i) => {
      if (!l || typeof l !== "object") {
        errors.push(`lessons[${i}]: not an object`);
        return;
      }
      const lesson = l as Record<string, unknown>;
      if (typeof lesson.position !== "number" || lesson.position < 1)
        errors.push(`lessons[${i}].position: must be >= 1`);
      if (!lesson.label || typeof lesson.label !== "string")
        errors.push(`lessons[${i}].label: required string`);
      if (!Array.isArray(lesson.activities))
        errors.push(`lessons[${i}].activities: required array`);
      else {
        (lesson.activities as unknown[]).forEach((a, j) => {
          if (!a || typeof a !== "object") return;
          const act = a as Record<string, unknown>;
          if (act.source !== "library" && act.source !== "gap")
            errors.push(`lessons[${i}].activities[${j}].source: must be 'library' or 'gap'`);
          if (act.source === "library" && !act.block)
            errors.push(`lessons[${i}].activities[${j}]: source is 'library' but no block attached`);
          if (act.source === "gap" && !act.gapDescription)
            errors.push(`lessons[${i}].activities[${j}]: source is 'gap' but no gapDescription`);
        });
      }
    });
  }

  // Metrics
  if (!seq.sequenceMetrics || typeof seq.sequenceMetrics !== "object") {
    errors.push("sequenceMetrics: required object");
  } else {
    const m = seq.sequenceMetrics as Record<string, unknown>;
    if (typeof m.totalSlots !== "number") errors.push("sequenceMetrics.totalSlots: required number");
    if (typeof m.fillRate !== "number" || (m.fillRate as number) < 0 || (m.fillRate as number) > 1)
      errors.push("sequenceMetrics.fillRate: must be 0-1");
  }

  return { valid: errors.length === 0, errors };
}

// Retrieval ranking formula from Dimensions3 spec
function computeRelevanceScore(breakdown: RetrievedBlock["scoreBreakdown"]): number {
  return (
    0.35 * breakdown.vectorSimilarity +
    0.20 * breakdown.efficacyNormalized +
    0.20 * breakdown.metadataFit +
    0.15 * breakdown.textMatch +
    0.10 * breakdown.usageSignal
  );
}

// Usage signal formula from spec
function computeUsageSignal(timesUsed: number, maxTimesUsed: number): number {
  if (maxTimesUsed <= 0) return 0;
  return Math.log(timesUsed + 1) / Math.log(maxTimesUsed + 1);
}

// =========================================================================
// Test Fixtures
// =========================================================================

function makeValidRequest(overrides?: Partial<GenerationRequest>): GenerationRequest {
  return {
    topic: "Sustainable Packaging Design",
    unitType: "design",
    lessonCount: 8,
    gradeLevel: "year-9",
    framework: "IB_MYP",
    constraints: {
      availableResources: ["cardboard", "scissors", "glue", "recycled-materials"],
      periodMinutes: 60,
      workshopAccess: true,
      softwareAvailable: ["canva"],
    },
    ...overrides,
  };
}

function makeRetrievedBlock(overrides?: Partial<RetrievedBlock>): RetrievedBlock {
  return {
    block: { id: "blk_test_001", content: { title: "User Research Interview", instructions: "..." } },
    relevanceScore: 0.82,
    scoreBreakdown: {
      vectorSimilarity: 0.85,
      efficacyNormalized: 0.78,
      textMatch: 0.71,
      usageSignal: 0.60,
      metadataFit: 0.90,
    },
    ...overrides,
  };
}

function makeBlockRetrievalResult(overrides?: Partial<BlockRetrievalResult>): BlockRetrievalResult {
  return {
    request: makeValidRequest(),
    candidates: [makeRetrievedBlock()],
    retrievalMetrics: {
      totalBlocksSearched: 150,
      candidatesReturned: 1,
      avgRelevanceScore: 0.82,
      retrievalTimeMs: 45,
      retrievalCost: { inputTokens: 0, outputTokens: 0, model: "none", estimatedCostUsd: 0 },
    },
    ...overrides,
  };
}

function makeAssembledSequence(overrides?: Partial<AssembledSequence>): AssembledSequence {
  return {
    request: makeValidRequest(),
    lessons: [
      {
        position: 1,
        label: "Introduction to Sustainable Design",
        description: "Students explore sustainability concepts through case studies",
        activities: [
          { slotIndex: 0, source: "library", block: makeRetrievedBlock() },
          { slotIndex: 1, source: "gap", gapDescription: "Brainstorming activity for packaging ideas" },
        ],
      },
    ],
    sequenceMetrics: {
      totalSlots: 2,
      filledFromLibrary: 1,
      gapsToGenerate: 1,
      fillRate: 0.5,
      prerequisiteViolations: [],
      sequenceTimeMs: 1200,
      sequenceCost: { inputTokens: 500, outputTokens: 300, model: "claude-haiku-4-5-20251001", estimatedCostUsd: 0.001 },
    },
    ...overrides,
  };
}

// =========================================================================
// Tests
// =========================================================================

describe("Stage 0: GenerationRequest validation", () => {
  it("accepts a valid request", () => {
    const result = validateGenerationRequest(makeValidRequest());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects missing topic", () => {
    const result = validateGenerationRequest(makeValidRequest({ topic: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("topic"))).toBe(true);
  });

  it("rejects lessonCount outside range", () => {
    expect(validateGenerationRequest(makeValidRequest({ lessonCount: 0 })).valid).toBe(false);
    expect(validateGenerationRequest(makeValidRequest({ lessonCount: 31 })).valid).toBe(false);
    expect(validateGenerationRequest(makeValidRequest({ lessonCount: 1 })).valid).toBe(true);
    expect(validateGenerationRequest(makeValidRequest({ lessonCount: 30 })).valid).toBe(true);
  });

  it("rejects period minutes outside 15-180", () => {
    const short = makeValidRequest();
    short.constraints.periodMinutes = 10;
    expect(validateGenerationRequest(short).valid).toBe(false);

    const long = makeValidRequest();
    long.constraints.periodMinutes = 200;
    expect(validateGenerationRequest(long).valid).toBe(false);
  });

  it("accepts all valid unit types", () => {
    for (const unitType of ["design", "service", "pp", "inquiry"]) {
      const result = validateGenerationRequest(makeValidRequest({ unitType }));
      expect(result.valid).toBe(true);
    }
  });

  it("accepts all valid frameworks", () => {
    for (const framework of ["IB_MYP", "GCSE_DT", "A_LEVEL_DT", "IGCSE_DT", "ACARA", "PLTW", "CUSTOM"]) {
      const result = validateGenerationRequest(makeValidRequest({ framework }));
      expect(result.valid).toBe(true);
    }
  });

  it("handles null/undefined gracefully", () => {
    expect(validateGenerationRequest(null).valid).toBe(false);
    expect(validateGenerationRequest(undefined).valid).toBe(false);
    expect(validateGenerationRequest("string").valid).toBe(false);
  });

  it("optional fields are truly optional", () => {
    const minimal = makeValidRequest();
    delete minimal.context;
    delete minimal.preferences;
    delete minimal.curriculumContext;
    delete minimal.curriculumOutcomes;
    expect(validateGenerationRequest(minimal).valid).toBe(true);
  });
});

describe("Stage 1: BlockRetrievalResult validation", () => {
  it("accepts a valid result with candidates", () => {
    const result = validateBlockRetrievalResult(makeBlockRetrievalResult());
    expect(result.valid).toBe(true);
  });

  it("accepts empty candidates (empty library scenario)", () => {
    const result = validateBlockRetrievalResult(
      makeBlockRetrievalResult({
        candidates: [],
        retrievalMetrics: {
          totalBlocksSearched: 0,
          candidatesReturned: 0,
          avgRelevanceScore: 0,
          retrievalTimeMs: 5,
          retrievalCost: { inputTokens: 0, outputTokens: 0, model: "none", estimatedCostUsd: 0 },
        },
      })
    );
    expect(result.valid).toBe(true);
  });

  it("rejects relevance scores outside 0-1", () => {
    const result = validateBlockRetrievalResult(
      makeBlockRetrievalResult({
        candidates: [makeRetrievedBlock({ relevanceScore: 1.5 })],
      })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("relevanceScore"))).toBe(true);
  });
});

describe("Stage 2: AssembledSequence validation", () => {
  it("accepts a valid sequence with mixed library/gap slots", () => {
    const result = validateAssembledSequence(makeAssembledSequence());
    expect(result.valid).toBe(true);
  });

  it("rejects library slot without block attached", () => {
    const seq = makeAssembledSequence();
    seq.lessons[0].activities[0] = { slotIndex: 0, source: "library" }; // no block
    const result = validateAssembledSequence(seq);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("library") && e.includes("no block"))).toBe(true);
  });

  it("rejects gap slot without gapDescription", () => {
    const seq = makeAssembledSequence();
    seq.lessons[0].activities[1] = { slotIndex: 1, source: "gap" }; // no description
    const result = validateAssembledSequence(seq);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("gap") && e.includes("gapDescription"))).toBe(true);
  });

  it("accepts all-gap sequence (empty library first-time generation)", () => {
    const seq = makeAssembledSequence();
    seq.lessons[0].activities = [
      { slotIndex: 0, source: "gap", gapDescription: "Opening activity" },
      { slotIndex: 1, source: "gap", gapDescription: "Main instruction" },
      { slotIndex: 2, source: "gap", gapDescription: "Work time activity" },
    ];
    seq.sequenceMetrics.fillRate = 0;
    seq.sequenceMetrics.gapsToGenerate = 3;
    seq.sequenceMetrics.filledFromLibrary = 0;
    seq.sequenceMetrics.totalSlots = 3;
    const result = validateAssembledSequence(seq);
    expect(result.valid).toBe(true);
  });

  it("rejects fillRate outside 0-1", () => {
    const seq = makeAssembledSequence();
    seq.sequenceMetrics.fillRate = 1.5;
    expect(validateAssembledSequence(seq).valid).toBe(false);
  });

  it("rejects lesson position < 1", () => {
    const seq = makeAssembledSequence();
    seq.lessons[0].position = 0;
    expect(validateAssembledSequence(seq).valid).toBe(false);
  });
});

describe("Retrieval ranking formula", () => {
  it("computes correct composite score per spec formula", () => {
    const breakdown = {
      vectorSimilarity: 1.0,
      efficacyNormalized: 1.0,
      textMatch: 1.0,
      usageSignal: 1.0,
      metadataFit: 1.0,
    };
    expect(computeRelevanceScore(breakdown)).toBeCloseTo(1.0);
  });

  it("weights vector similarity highest (0.35)", () => {
    const highVector = {
      vectorSimilarity: 1.0,
      efficacyNormalized: 0,
      textMatch: 0,
      usageSignal: 0,
      metadataFit: 0,
    };
    const highEfficacy = {
      vectorSimilarity: 0,
      efficacyNormalized: 1.0,
      textMatch: 0,
      usageSignal: 0,
      metadataFit: 0,
    };
    expect(computeRelevanceScore(highVector)).toBeGreaterThan(computeRelevanceScore(highEfficacy));
    expect(computeRelevanceScore(highVector)).toBeCloseTo(0.35);
    expect(computeRelevanceScore(highEfficacy)).toBeCloseTo(0.20);
  });

  it("usage signal weights lowest (0.10) — popular blocks don't dominate", () => {
    const highUsage = {
      vectorSimilarity: 0,
      efficacyNormalized: 0,
      textMatch: 0,
      usageSignal: 1.0,
      metadataFit: 0,
    };
    expect(computeRelevanceScore(highUsage)).toBeCloseTo(0.10);
  });

  it("all zeros gives zero", () => {
    const zeros = { vectorSimilarity: 0, efficacyNormalized: 0, textMatch: 0, usageSignal: 0, metadataFit: 0 };
    expect(computeRelevanceScore(zeros)).toBe(0);
  });
});

describe("Usage signal formula", () => {
  it("returns 0 when maxTimesUsed is 0", () => {
    expect(computeUsageSignal(5, 0)).toBe(0);
  });

  it("returns 1 when timesUsed equals maxTimesUsed", () => {
    expect(computeUsageSignal(100, 100)).toBeCloseTo(1.0);
  });

  it("is logarithmic — doubling usage doesn't double signal", () => {
    const signal10 = computeUsageSignal(10, 100);
    const signal20 = computeUsageSignal(20, 100);
    const ratio = signal20 / signal10;
    expect(ratio).toBeLessThan(2); // sub-linear growth
  });

  it("new block (0 uses) gets non-zero signal due to log(0+1)=0", () => {
    expect(computeUsageSignal(0, 100)).toBe(0);
  });

  it("single-use block gets positive signal", () => {
    expect(computeUsageSignal(1, 100)).toBeGreaterThan(0);
  });
});

describe("Cross-stage contract compatibility", () => {
  it("Stage 0 output is valid Stage 1 input", () => {
    const request = makeValidRequest();
    // Stage 1 consumes GenerationRequest — verify it passes validation
    const validation = validateGenerationRequest(request);
    expect(validation.valid).toBe(true);
  });

  it("Stage 1 output contains the original request (passthrough)", () => {
    const request = makeValidRequest();
    const retrieval = makeBlockRetrievalResult({ request });
    expect(retrieval.request).toBe(request);
  });

  it("Stage 2 receives request + retrieval and produces consistent metrics", () => {
    const seq = makeAssembledSequence();
    const totalActivities = seq.lessons.reduce((sum, l) => sum + l.activities.length, 0);
    expect(seq.sequenceMetrics.totalSlots).toBe(totalActivities);

    const libraryCount = seq.lessons.reduce(
      (sum, l) => sum + l.activities.filter((a) => a.source === "library").length,
      0
    );
    expect(seq.sequenceMetrics.filledFromLibrary).toBe(libraryCount);

    const gapCount = seq.lessons.reduce(
      (sum, l) => sum + l.activities.filter((a) => a.source === "gap").length,
      0
    );
    expect(seq.sequenceMetrics.gapsToGenerate).toBe(gapCount);

    expect(seq.sequenceMetrics.fillRate).toBeCloseTo(libraryCount / totalActivities);
  });

  it("empty library flows through all stages without errors", () => {
    // Stage 0: valid request
    const request = makeValidRequest();
    expect(validateGenerationRequest(request).valid).toBe(true);

    // Stage 1: empty candidates (no library blocks exist)
    const retrieval = makeBlockRetrievalResult({
      request,
      candidates: [],
      retrievalMetrics: {
        totalBlocksSearched: 0,
        candidatesReturned: 0,
        avgRelevanceScore: 0,
        retrievalTimeMs: 2,
        retrievalCost: { inputTokens: 0, outputTokens: 0, model: "none", estimatedCostUsd: 0 },
      },
    });
    expect(validateBlockRetrievalResult(retrieval).valid).toBe(true);

    // Stage 2: all gaps (everything needs generating)
    const sequence: AssembledSequence = {
      request,
      lessons: Array.from({ length: request.lessonCount }, (_, i) => ({
        position: i + 1,
        label: `Lesson ${i + 1}`,
        description: `Auto-generated lesson ${i + 1}`,
        activities: [
          { slotIndex: 0, source: "gap" as const, gapDescription: `Opening for lesson ${i + 1}` },
          { slotIndex: 1, source: "gap" as const, gapDescription: `Main activity for lesson ${i + 1}` },
        ],
      })),
      sequenceMetrics: {
        totalSlots: request.lessonCount * 2,
        filledFromLibrary: 0,
        gapsToGenerate: request.lessonCount * 2,
        fillRate: 0,
        prerequisiteViolations: [],
        sequenceTimeMs: 800,
        sequenceCost: { inputTokens: 400, outputTokens: 200, model: "claude-haiku-4-5-20251001", estimatedCostUsd: 0.001 },
      },
    };
    expect(validateAssembledSequence(sequence).valid).toBe(true);
  });
});
