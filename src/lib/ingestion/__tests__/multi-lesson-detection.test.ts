/**
 * Tests for multi-lesson detection fixes:
 * 1. Bold-heading promotion in DOCX extraction
 * 2. Week/Lesson heading detection in parseDocument
 * 3. Title-based lesson boundary detection in reconstructUnit
 */
import { describe, it, expect } from "vitest";
import { parseDocument } from "../parse";
import { reconstructUnit } from "../unit-import";
import type { IngestionPipelineResult, ExtractedBlock, ExtractionResult, ModerationStageResult } from "../types";
import type { CostBreakdown } from "@/types/activity-blocks";

const ZERO_COST: CostBreakdown = {
  inputTokens: 0,
  outputTokens: 0,
  modelId: "none",
  estimatedCostUSD: 0,
  timeMs: 0,
};

// =========================================================================
// Bold-heading promotion (tested via sectionsToMarkdown round-trip)
// =========================================================================

describe("promoteBoldToHeadings via DOCX extraction", () => {
  // We can't easily test extractFromDOCX without a real DOCX buffer,
  // but we CAN test the flow through parseDocument with the markdown
  // that sectionsToMarkdown would produce after bold promotion.

  it("parseDocument detects Week headings from promoted bold text", () => {
    // After bold promotion, the markdown would look like this:
    const markdown = [
      "# Week 1: Introduction to Biomimicry",
      "",
      "Students explore how nature inspires design.",
      "",
      "# Week 2: Research Phase",
      "",
      "Students research specific biomimicry examples.",
      "",
      "# Week 3: Design Sprint",
      "",
      "Students design their own nature-inspired solutions.",
    ].join("\n");

    const result = parseDocument(markdown);
    expect(result.sections.length).toBeGreaterThanOrEqual(3);
    expect(result.sections[0].heading).toContain("Week 1");
    expect(result.sections[1].heading).toContain("Week 2");
    expect(result.sections[2].heading).toContain("Week 3");
  });

  it("parseDocument detects Lesson headings from promoted bold text", () => {
    const markdown = [
      "# Lesson 1: What is Biomimicry?",
      "",
      "Introduction to biomimicry concepts.",
      "",
      "# Lesson 2: Nature's Designs",
      "",
      "Exploring designs found in nature.",
      "",
      "# Lesson 3: Prototyping",
      "",
      "Building initial prototypes.",
    ].join("\n");

    const result = parseDocument(markdown);
    expect(result.sections.length).toBeGreaterThanOrEqual(3);
    expect(result.sections[0].heading).toContain("Lesson 1");
    expect(result.sections[1].heading).toContain("Lesson 2");
    expect(result.sections[2].heading).toContain("Lesson 3");
  });
});

// =========================================================================
// Lesson boundary detection
// =========================================================================

function makeBlock(overrides: Partial<ExtractedBlock> & { title: string; source_section_index: number }): ExtractedBlock {
  return {
    tempId: crypto.randomUUID(),
    description: "Test activity",
    prompt: "Do the activity",
    bloom_level: "apply",
    time_weight: "moderate",
    grouping: "individual",
    phase: "explore",
    activity_category: "hands_on",
    materials: [],
    piiFlags: [],
    copyrightFlag: "own",
    ...overrides,
  };
}

function makeIngestionResult(blocks: ExtractedBlock[]): IngestionPipelineResult {
  const extraction: ExtractionResult = {
    blocks,
    totalSectionsProcessed: blocks.length,
    activitySectionsFound: blocks.length,
    piiDetected: false,
    cost: ZERO_COST,
  };
  const moderation: ModerationStageResult = {
    blocks: blocks.map(b => ({ ...b, moderationStatus: "approved" as const })),
    cost: ZERO_COST,
    approvedCount: blocks.length,
    flaggedCount: 0,
    pendingCount: 0,
  };
  return {
    dedup: { isDuplicate: false, fileHash: "test", cost: ZERO_COST },
    parse: { title: "Test", sections: [], totalWordCount: 0, headingCount: 0, cost: ZERO_COST },
    classification: {
      documentType: "unit_plan",
      confidence: 0.9,
      confidences: { documentType: 0.9 },
      topic: "Design",
      sections: [],
      cost: ZERO_COST,
    },
    analysis: {
      classification: {
        documentType: "unit_plan",
        confidence: 0.9,
        confidences: { documentType: 0.9 },
        topic: "Design",
        sections: [],
        cost: ZERO_COST,
      },
      enrichedSections: [],
      cost: ZERO_COST,
    },
    extraction,
    moderation,
    totalCost: ZERO_COST,
    totalTimeMs: 0,
  };
}

describe("detectLessonBoundaries — title-based detection", () => {
  it("splits blocks by Lesson N titles", () => {
    const blocks = [
      makeBlock({ title: "Lesson 1: Introduction", source_section_index: 0 }),
      makeBlock({ title: "Research Activity", source_section_index: 1 }),
      makeBlock({ title: "Lesson 2: Design Brief", source_section_index: 3 }),
      makeBlock({ title: "Brainstorm Session", source_section_index: 4 }),
      makeBlock({ title: "Lesson 3: Prototyping", source_section_index: 6 }),
      makeBlock({ title: "Build Activity", source_section_index: 7 }),
    ];

    const result = reconstructUnit(makeIngestionResult(blocks));
    expect(result.lessons.length).toBe(3);
    expect(result.lessons[0].title).toBe("Lesson 1: Introduction");
    expect(result.lessons[0].blocks.length).toBe(2);
    expect(result.lessons[1].title).toBe("Lesson 2: Design Brief");
    expect(result.lessons[1].blocks.length).toBe(2);
    expect(result.lessons[2].title).toBe("Lesson 3: Prototyping");
    expect(result.lessons[2].blocks.length).toBe(2);
  });

  it("splits blocks by Week N titles", () => {
    const blocks = [
      makeBlock({ title: "Week 1: Research", source_section_index: 0 }),
      makeBlock({ title: "Explore Activity", source_section_index: 1 }),
      makeBlock({ title: "Week 2: Design", source_section_index: 3 }),
      makeBlock({ title: "Create Activity", source_section_index: 4 }),
    ];

    const result = reconstructUnit(makeIngestionResult(blocks));
    expect(result.lessons.length).toBe(2);
    expect(result.lessons[0].title).toBe("Week 1: Research");
    expect(result.lessons[1].title).toBe("Week 2: Design");
  });

  it("splits blocks by Day N titles", () => {
    const blocks = [
      makeBlock({ title: "Day 1: Warm Up", source_section_index: 0 }),
      makeBlock({ title: "Day 2: Deep Dive", source_section_index: 2 }),
      makeBlock({ title: "Day 3: Reflection", source_section_index: 4 }),
    ];

    const result = reconstructUnit(makeIngestionResult(blocks));
    expect(result.lessons.length).toBe(3);
    expect(result.lessons[0].title).toBe("Day 1: Warm Up");
    expect(result.lessons[1].title).toBe("Day 2: Deep Dive");
    expect(result.lessons[2].title).toBe("Day 3: Reflection");
  });

  it("does not split on non-lesson titles", () => {
    const blocks = [
      makeBlock({ title: "Research Activity", source_section_index: 0 }),
      makeBlock({ title: "Brainstorm Session", source_section_index: 1 }),
      makeBlock({ title: "Prototype Build", source_section_index: 2 }),
    ];

    const result = reconstructUnit(makeIngestionResult(blocks));
    // All blocks should be in one lesson (no title-based splits, no section gaps)
    expect(result.lessons.length).toBe(1);
    expect(result.lessons[0].blocks.length).toBe(3);
  });

  it("still splits on phase=opening even without title match", () => {
    const blocks = [
      makeBlock({ title: "Activity A", source_section_index: 0 }),
      makeBlock({ title: "Activity B", source_section_index: 1, phase: "opening" }),
      makeBlock({ title: "Activity C", source_section_index: 2 }),
    ];

    const result = reconstructUnit(makeIngestionResult(blocks));
    expect(result.lessons.length).toBe(2);
  });

  it("preserves original lesson title from Week heading", () => {
    const blocks = [
      makeBlock({ title: "Week 3: Iteration and Testing", source_section_index: 5 }),
      makeBlock({ title: "Test Protocol", source_section_index: 6 }),
    ];

    const result = reconstructUnit(makeIngestionResult(blocks));
    // Should use the original Week heading, not "Lesson 1: Iteration and Testing"
    expect(result.lessons[0].title).toBe("Week 3: Iteration and Testing");
  });

  it("handles mixed lesson numbering correctly", () => {
    const blocks = [
      makeBlock({ title: "Lesson 1: Intro", source_section_index: 0 }),
      makeBlock({ title: "Group Work", source_section_index: 1 }),
      makeBlock({ title: "Lesson 2: Research", source_section_index: 3 }),
      makeBlock({ title: "Week 2 Activity", source_section_index: 4 }),
      makeBlock({ title: "Lesson 3: Design", source_section_index: 6 }),
    ];

    const result = reconstructUnit(makeIngestionResult(blocks));
    // Lesson 1 (2 blocks), Lesson 2 (1 block), Week 2 (1 block), Lesson 3 (1 block)
    expect(result.lessons.length).toBe(4);
  });

  it("reports correct metadata counts", () => {
    const blocks = [
      makeBlock({ title: "Lesson 1: Explore", source_section_index: 0, bloom_level: "understand" }),
      makeBlock({ title: "Lesson 2: Create", source_section_index: 2, bloom_level: "create", activity_category: "assessment" }),
      makeBlock({ title: "Lesson 3: Reflect", source_section_index: 4, bloom_level: "evaluate" }),
    ];

    const result = reconstructUnit(makeIngestionResult(blocks));
    expect(result.metadata.detectedLessonCount).toBe(3);
    expect(result.totalBlocks).toBe(3);
    // Lessons with evaluate/create bloom or assessment category should be assessment points
    expect(result.metadata.assessmentPoints.length).toBeGreaterThanOrEqual(1);
  });
});
