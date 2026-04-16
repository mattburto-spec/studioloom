/**
 * Tests for multi-lesson detection fixes:
 * 1. Bold-heading promotion in DOCX extraction (Phase 1 + Phase 2)
 * 2. Week/Lesson heading detection in parseDocument
 * 3. Title-based lesson boundary detection in reconstructUnit
 * 4. Scheme-of-work documents with mixed heading styles + bold lesson headings
 */
import { describe, it, expect } from "vitest";
import { parseDocument } from "../parse";
import { reconstructUnit } from "../unit-import";
import {
  _promoteLessonHeadings as promoteLessonHeadings,
  _processTablesInHtml as processTablesInHtml,
} from "../document-extract";
import type { IngestionPipelineResult, ExtractedBlock, EnrichedSection, ExtractionResult, ModerationStageResult } from "../types";
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

/** Convert a test block into a fake enriched section so reconstructUnit() sees them. */
function blockToEnrichedSection(block: ExtractedBlock): EnrichedSection {
  return {
    index: block.source_section_index,
    heading: block.title,
    content: block.description || block.prompt || "",
    sectionType: "activity",
    bloom_level: block.bloom_level,
    time_weight: block.time_weight,
    grouping: block.grouping,
    phase: block.phase,
    activity_category: block.activity_category,
    materials: block.materials || [],
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
  // Build enriched sections from blocks — reconstructUnit prefers these over extraction.blocks
  const enrichedSections: EnrichedSection[] = blocks.map(blockToEnrichedSection);
  const classificationObj = {
    documentType: "unit_plan" as const,
    confidence: 0.9,
    confidences: { documentType: 0.9 },
    topic: "Design",
    sections: [] as never[],
    cost: ZERO_COST,
  };
  return {
    dedup: { isDuplicate: false, fileHash: "test", cost: ZERO_COST },
    parse: { title: "Test", sections: [], totalWordCount: 0, headingCount: 0, cost: ZERO_COST },
    classification: classificationObj,
    analysis: {
      classification: classificationObj,
      enrichedSections,
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

// =========================================================================
// Enriched-section reconstruction (uses ALL sections, not just activities)
// =========================================================================

describe("reconstructUnit — enriched section reconstruction", () => {
  it("uses all enriched sections, not just extraction blocks", () => {
    // Simulate a 12-lesson document where only 3 sections are activities.
    // Extraction would produce 3 blocks, but enriched sections has all 12.
    const enrichedSections: EnrichedSection[] = Array.from({ length: 12 }, (_, i) => ({
      index: i,
      heading: `Lesson ${i + 1}: Topic ${i + 1}`,
      content: `Content for lesson ${i + 1} with detailed instructions.`,
      sectionType: i % 4 === 0 ? "activity" as const : "instruction" as const,
      bloom_level: "understand",
      time_weight: "moderate",
      grouping: "individual",
      phase: "investigate",
      activity_category: i % 4 === 0 ? "research" : "documentation",
      materials: [],
    }));

    // Extraction only found the 3 activity sections
    const activityBlocks = enrichedSections
      .filter(s => s.sectionType === "activity")
      .map(s => makeBlock({
        title: s.heading,
        source_section_index: s.index,
      }));

    const ingestion = makeIngestionResult(activityBlocks);
    // Override enriched sections to include all 12
    ingestion.analysis.enrichedSections = enrichedSections;

    const result = reconstructUnit(ingestion);

    // Should see 12 lessons (one per Lesson N heading), not 3
    expect(result.lessons.length).toBe(12);
    expect(result.totalBlocks).toBe(12);
    expect(result.lessons[0].title).toBe("Lesson 1: Topic 1");
    expect(result.lessons[11].title).toBe("Lesson 12: Topic 12");
  });

  it("skips metadata sections", () => {
    const enrichedSections: EnrichedSection[] = [
      { index: 0, heading: "Title Page", content: "Unit plan cover", sectionType: "metadata", bloom_level: "remember", time_weight: "quick", grouping: "individual", phase: "plan", activity_category: "documentation", materials: [] },
      { index: 1, heading: "Lesson 1: Intro", content: "Intro activity", sectionType: "activity", bloom_level: "understand", time_weight: "moderate", grouping: "whole_class", phase: "investigate", activity_category: "research", materials: [] },
      { index: 2, heading: "Copyright Notice", content: "All rights reserved", sectionType: "metadata", bloom_level: "remember", time_weight: "quick", grouping: "individual", phase: "plan", activity_category: "documentation", materials: [] },
      { index: 3, heading: "Lesson 2: Design", content: "Design task", sectionType: "activity", bloom_level: "create", time_weight: "extended", grouping: "pair", phase: "create", activity_category: "making", materials: ["paper"] },
    ];

    const ingestion = makeIngestionResult([]);
    ingestion.analysis.enrichedSections = enrichedSections;

    const result = reconstructUnit(ingestion);

    // Only 2 non-metadata sections
    expect(result.totalBlocks).toBe(2);
    expect(result.lessons.length).toBe(2);
    expect(result.lessons[0].title).toBe("Lesson 1: Intro");
    expect(result.lessons[1].title).toBe("Lesson 2: Design");
  });

  it("falls back to extraction blocks when no enriched sections", () => {
    const blocks = [
      makeBlock({ title: "Activity 1", source_section_index: 0 }),
      makeBlock({ title: "Activity 2", source_section_index: 1 }),
    ];

    const ingestion = makeIngestionResult(blocks);
    // Clear enriched sections to trigger fallback
    ingestion.analysis.enrichedSections = [];

    const result = reconstructUnit(ingestion);

    expect(result.totalBlocks).toBe(2);
    expect(result.lessons.length).toBe(1);
  });

  it("instruction sections with Week headings still split into lessons", () => {
    // This is the key scenario: a teacher uploads a DOCX where each week's
    // content is classified as "instruction" (not activity) by Pass B.
    const enrichedSections: EnrichedSection[] = [
      { index: 0, heading: "Unit Overview", content: "12-week biomimicry unit", sectionType: "instruction", bloom_level: "remember", time_weight: "quick", grouping: "whole_class", phase: "plan", activity_category: "documentation", materials: [] },
      { index: 1, heading: "Week 1: Introduction to Biomimicry", content: "Explore nature's designs", sectionType: "instruction", bloom_level: "understand", time_weight: "moderate", grouping: "whole_class", phase: "investigate", activity_category: "research", materials: [] },
      { index: 2, heading: "Lesson 1: What is Biomimicry?", content: "Discuss examples", sectionType: "activity", bloom_level: "understand", time_weight: "moderate", grouping: "whole_class", phase: "investigate", activity_category: "research", materials: [] },
      { index: 3, heading: "Lesson 2: Nature Walk", content: "Outdoor observation", sectionType: "activity", bloom_level: "apply", time_weight: "extended", grouping: "small_group", phase: "investigate", activity_category: "research", materials: ["sketchbook"] },
      { index: 4, heading: "Week 2: Research Phase", content: "Deep dive into examples", sectionType: "instruction", bloom_level: "analyze", time_weight: "moderate", grouping: "individual", phase: "investigate", activity_category: "research", materials: [] },
      { index: 5, heading: "Lesson 3: Case Studies", content: "Analyse real products", sectionType: "activity", bloom_level: "analyze", time_weight: "extended", grouping: "pair", phase: "investigate", activity_category: "analysis", materials: ["case study handouts"] },
      { index: 6, heading: "Lesson 4: Research Presentation", content: "Present findings", sectionType: "activity", bloom_level: "evaluate", time_weight: "extended", grouping: "individual", phase: "evaluate", activity_category: "presentation", materials: [] },
    ];

    const ingestion = makeIngestionResult([]);
    ingestion.analysis.enrichedSections = enrichedSections;

    const result = reconstructUnit(ingestion);

    // Should detect Week 1, Lesson 1, Lesson 2, Week 2, Lesson 3, Lesson 4 boundaries
    // (Unit Overview stays in first lesson since it doesn't match LESSON_TITLE_RE)
    expect(result.lessons.length).toBeGreaterThanOrEqual(5);

    // Check specific lesson titles preserved
    const titles = result.lessons.map(l => l.title);
    expect(titles.some(t => t.includes("Week 1"))).toBe(true);
    expect(titles.some(t => t.includes("Lesson 2"))).toBe(true);
    expect(titles.some(t => t.includes("Week 2"))).toBe(true);
    expect(titles.some(t => t.includes("Lesson 4"))).toBe(true);
  });
});

// =========================================================================
// Phase 1 bold-heading promotion (lesson headings WITHIN existing headings)
// =========================================================================

describe("promoteLessonHeadings (Phase 1 — always-on)", () => {
  it("promotes bold Lesson N paragraphs even when heading tags exist", () => {
    // Simulates a scheme_of_work with 3 real headings + bold lesson sub-headings
    const html = `
      <h2>Introduction</h2>
      <p>Unit overview for 12 × 72-minute lessons.</p>
      <p><strong>Lesson 1: Materials Overview</strong></p>
      <p>Students explore different material types.</p>
      <p><strong>Lesson 2: Natural vs Synthetic</strong></p>
      <p>Comparing material properties.</p>
      <h2>Task Description</h2>
      <p>Design a biomimicry pouch.</p>
      <p><strong>Lesson 3: Research Phase</strong></p>
      <p>Investigate biomimicry examples.</p>
      <h2>Assessment</h2>
      <p>Submission requirements.</p>
    `;
    const result = promoteLessonHeadings(html);

    // Bold Lesson N headings should become <h3>
    expect(result).toContain("<h3>Lesson 1: Materials Overview</h3>");
    expect(result).toContain("<h3>Lesson 2: Natural vs Synthetic</h3>");
    expect(result).toContain("<h3>Lesson 3: Research Phase</h3>");
    // Existing <h2> headings should be untouched
    expect(result).toContain("<h2>Introduction</h2>");
    expect(result).toContain("<h2>Task Description</h2>");
  });

  it("promotes bold Week N paragraphs", () => {
    const html = `
      <h1>Unit Plan</h1>
      <p><strong>Week 1: Introduction</strong></p>
      <p>Content here.</p>
      <p><strong>Week 2: Development</strong></p>
      <p>More content.</p>
      <p><strong>Weeks 3-4: Production</strong></p>
      <p>Build phase.</p>
    `;
    const result = promoteLessonHeadings(html);

    expect(result).toContain("<h3>Week 1: Introduction</h3>");
    expect(result).toContain("<h3>Week 2: Development</h3>");
    expect(result).toContain("<h3>Weeks 3-4: Production</h3>");
  });

  it("promotes bold-start + tail pattern for lesson headings", () => {
    // <p><strong>Lesson 5</strong>: Testing and Evaluation</p>
    const html = `
      <h2>Overview</h2>
      <p><strong>Lesson 5</strong>: Testing and Evaluation</p>
      <p>Students test their prototypes.</p>
    `;
    const result = promoteLessonHeadings(html);

    expect(result).toContain("<h3>Lesson 5 : Testing and Evaluation</h3>");
  });

  it("does NOT promote non-lesson bold text", () => {
    const html = `
      <h2>Introduction</h2>
      <p><strong>Important: Read this first</strong></p>
      <p><strong>Materials Needed</strong></p>
      <p>Cardboard, glue, scissors.</p>
    `;
    const result = promoteLessonHeadings(html);

    // These should NOT be promoted (don't match Lesson/Week/Day patterns)
    expect(result).not.toContain("<h3>Important: Read this first</h3>");
    expect(result).not.toContain("<h3>Materials Needed</h3>");
  });

  it("12-lesson scheme_of_work produces 12 promoted headings", () => {
    // Simulates the exact bug: 3 real headings + 12 bold lesson headings
    const lessonParagraphs = Array.from({ length: 12 }, (_, i) =>
      `<p><strong>Lesson ${i + 1}: Activity ${i + 1}</strong></p>\n<p>Students do activity ${i + 1}.</p>`
    ).join("\n");

    const html = `
      <h2>Introduction</h2>
      <p>A 4-week Product Design course (12 × 72-minute lessons).</p>
      ${lessonParagraphs}
      <h2>Assessment</h2>
      <p>Portfolio submission required.</p>
    `;
    const result = promoteLessonHeadings(html);

    // All 12 lesson headings should be promoted
    for (let i = 1; i <= 12; i++) {
      expect(result).toContain(`<h3>Lesson ${i}: Activity ${i}</h3>`);
    }
    // Original headings untouched
    expect(result).toContain("<h2>Introduction</h2>");
    expect(result).toContain("<h2>Assessment</h2>");
  });
});

// =========================================================================
// Table-aware extraction (Phase 0 — schedule tables expanded to sections)
// =========================================================================

describe("processTablesInHtml — schedule table extraction", () => {
  it("expands a Week × Lesson grid into heading+content blocks", () => {
    const html = `
      <p>Some intro text</p>
      <table><thead>
        <tr>
          <th><p><strong>Week(s)</strong></p></th>
          <th><p><strong>Lesson 1</strong></p></th>
          <th><p><strong>Lesson 2</strong></p></th>
          <th><p><strong>Lesson 3</strong></p></th>
        </tr>
        <tr>
          <th><p><strong>1</strong></p><p>Design Brief</p></th>
          <th><p>Introduction activities and class expectations.</p></th>
          <th><p>Nature walk drawing exercise with leaves.</p></th>
          <th><p>Pressed flowers drawing and orthogonal sketching.</p></th>
        </tr>
        <tr>
          <th><p><strong>2</strong></p><p>Production</p></th>
          <th><p>Plastic bag experiments and fusing techniques.</p></th>
          <th><p>Sewing machine demonstration and practice.</p></th>
          <th><p>Sample creation and seam types exploration.</p></th>
        </tr>
      </thead></table>
      <p>Assessment section follows.</p>
    `;

    const result = processTablesInHtml(html);

    // Should produce 6 lesson headings (2 weeks × 3 lessons)
    expect(result).toContain("<h3>Week 1 - Lesson 1: Design Brief</h3>");
    expect(result).toContain("<h3>Week 1 - Lesson 2: Design Brief</h3>");
    expect(result).toContain("<h3>Week 1 - Lesson 3: Design Brief</h3>");
    expect(result).toContain("<h3>Week 2 - Lesson 1: Production</h3>");
    expect(result).toContain("<h3>Week 2 - Lesson 2: Production</h3>");
    expect(result).toContain("<h3>Week 2 - Lesson 3: Production</h3>");

    // Content should be preserved
    expect(result).toContain("Introduction activities and class expectations.");
    expect(result).toContain("Sewing machine demonstration and practice.");

    // Non-table content should be untouched
    expect(result).toContain("Some intro text");
    expect(result).toContain("Assessment section follows.");
  });

  it("expands combined week ranges like '3 & 4' into separate weeks", () => {
    const html = `
      <table><thead>
        <tr><th>Week(s)</th><th>Lesson 1</th><th>Lesson 2</th></tr>
        <tr>
          <th><p><strong>3 &amp; 4</strong></p><p>Advanced Production</p></th>
          <th><p>Zipper insertion and lapped method techniques.</p></th>
          <th><p>Self-paced practical work and construction.</p></th>
        </tr>
      </thead></table>
    `;

    const result = processTablesInHtml(html);

    // "3 & 4" should expand into Week 3 AND Week 4 (same lessons repeated)
    expect(result).toContain("<h3>Week 3 - Lesson 1: Advanced Production</h3>");
    expect(result).toContain("<h3>Week 3 - Lesson 2: Advanced Production</h3>");
    expect(result).toContain("<h3>Week 4 - Lesson 1: Advanced Production</h3>");
    expect(result).toContain("<h3>Week 4 - Lesson 2: Advanced Production</h3>");
    expect(result).toContain("Zipper insertion and lapped method techniques.");

    // Should produce 4 headings total (2 weeks × 2 lessons)
    const h3Count = (result.match(/<h3>/g) || []).length;
    expect(h3Count).toBe(4);
  });

  it("includes differentiation column content when present", () => {
    const html = `
      <table><thead>
        <tr>
          <th>Week(s)</th>
          <th>Lesson 1</th>
          <th>What variations are possible for student with different needs?</th>
        </tr>
        <tr>
          <th><p><strong>1</strong></p><p>Introduction</p></th>
          <th><p>Main lesson activity content here with detail.</p></th>
          <th><p>Provide templates and exemplars for struggling students.</p></th>
        </tr>
      </thead></table>
    `;

    const result = processTablesInHtml(html);

    expect(result).toContain("Differentiation: Provide templates and exemplars for struggling students.");
  });

  it("skips empty/trivial cells (< 10 chars)", () => {
    const html = `
      <table><thead>
        <tr><th>Week</th><th>Lesson 1</th><th>Lesson 2</th></tr>
        <tr>
          <th><p><strong>1</strong></p><p>Topic</p></th>
          <th><p>Full lesson content with lots of detail here.</p></th>
          <th><p>Short.</p></th>
        </tr>
      </thead></table>
    `;

    const result = processTablesInHtml(html);

    // Lesson 1 should appear (long content)
    expect(result).toContain("Week 1 - Lesson 1");
    // Lesson 2 should be skipped (< 10 chars)
    expect(result).not.toContain("Week 1 - Lesson 2");
  });

  it("unwraps non-schedule tables preserving inner HTML", () => {
    const html = `
      <table><thead>
        <tr>
          <th><p><strong>Unit Title: Product Design</strong></p></th>
          <th><p><strong>Duration: 4 weeks</strong></p></th>
        </tr>
        <tr>
          <th colspan="2"><p><strong>Unit Overview:</strong></p><p>Students explore materials.</p></th>
        </tr>
      </thead></table>
    `;

    const result = processTablesInHtml(html);

    // Table tags should be removed
    expect(result).not.toContain("<table");
    expect(result).not.toContain("<tr");
    expect(result).not.toContain("<th");

    // Inner HTML (paragraphs, bold) should be preserved
    expect(result).toContain("<p><strong>Unit Title: Product Design</strong></p>");
    expect(result).toContain("<p><strong>Unit Overview:</strong></p>");
    expect(result).toContain("<p>Students explore materials.</p>");
  });

  it("handles Session N column headers", () => {
    const html = `
      <table><thead>
        <tr><th>Day</th><th>Session 1</th><th>Session 2</th></tr>
        <tr>
          <th><p><strong>1</strong></p><p>Orientation</p></th>
          <th><p>Morning session with team building activities.</p></th>
          <th><p>Afternoon session with skills assessment.</p></th>
        </tr>
      </thead></table>
    `;

    const result = processTablesInHtml(html);

    expect(result).toContain("<h3>Week 1 - Session 1: Orientation</h3>");
    expect(result).toContain("<h3>Week 1 - Session 2: Orientation</h3>");
  });

  it("handles mixed content — table + non-table paragraphs", () => {
    const html = `
      <p><strong>Learning Timeline</strong></p>
      <ul><li>Design brief context here.</li></ul>
      <table><thead>
        <tr><th>Week(s)</th><th>Lesson 1</th></tr>
        <tr>
          <th><p><strong>1</strong></p><p>Intro</p></th>
          <th><p>Getting to know you activities and expectations.</p></th>
        </tr>
      </thead></table>
      <p><strong>Assessment Rubric</strong></p>
      <table><thead>
        <tr><th>Criteria</th><th>Achievement</th></tr>
        <tr><th>Outstanding work</th><th>Extending</th></tr>
      </thead></table>
    `;

    const result = processTablesInHtml(html);

    // Schedule table expanded
    expect(result).toContain("<h3>Week 1 - Lesson 1: Intro</h3>");

    // Non-schedule content preserved
    expect(result).toContain("<strong>Learning Timeline</strong>");
    expect(result).toContain("Design brief context here.");
    expect(result).toContain("<strong>Assessment Rubric</strong>");

    // Rubric table unwrapped (not a schedule table)
    expect(result).toContain("Outstanding work");
    expect(result).toContain("Extending");
  });

  it("real-world biomimicry DOCX pattern: 4 weeks × 3 lessons = 12 sections", () => {
    // Simulate the exact structure from the Biomimicry[95].docx
    // Document says "4 weeks (12 x 72 minute lessons)" — weeks 3 & 4 share
    // a row but each week has its own 3 class periods.
    const html = `
      <table><thead>
        <tr>
          <th><p><strong>Week(s) </strong></p></th>
          <th><p><strong>Lesson 1</strong></p><p><em>Include a list of teaching and learning activities</em></p></th>
          <th><p><strong>Lesson 2</strong></p><p><em>Include a list of teaching and learning activities</em></p></th>
          <th><p><strong>Lesson 3</strong></p><p><em>Include a list of teaching and learning activities</em></p></th>
          <th><p><strong>What variations are possible for student with different needs?</strong></p></th>
        </tr>
        <tr>
          <th><p><strong>1</strong></p><p>Plastic Zip Pouch – DESIGN BRIEF &amp; VISUALISTAION</p></th>
          <th><ul><li>Getting to know you activities such as: roll call games, name that tool!</li><li>Establish guidelines and class expectations</li></ul></th>
          <th><ul><li>Walk the school grounds and collect leaves/natural matter</li><li>Drawing exercise on shape and form</li></ul></th>
          <th><ul><li>Look at pressed flowers and leaves</li><li>Drawing exercise to trace/transpose shapes</li></ul></th>
          <th><p>Grid paper Drawing templates Drafting shapes with chalk on fabric</p></th>
        </tr>
        <tr>
          <th><p><strong>2</strong></p><p>Plastic Zip Pouch - PRODUCTION</p></th>
          <th><ul><li>Plastic bag ban discussion</li><li>Students research lifecycle of a plastic bag</li></ul></th>
          <th><ul><li>Students continue to experiment with plastic</li><li>Demonstrate sewing machine operation</li></ul></th>
          <th><ul><li>Create a fused plastic sample</li><li>Create sample seams</li></ul></th>
          <th><p>Partner pairs for prac Chalk on fabric for sewing guides</p></th>
        </tr>
        <tr>
          <th><p><strong>3 &amp; 4</strong></p><p>Plastic Zip Pouch - PRODUCTION</p></th>
          <th><ul><li>Zipper insertion, lapped method</li><li>Students continue construction</li></ul></th>
          <th><ul><li>Facilitate and support students through self-paced practical work</li><li>Constructing the pouch</li></ul></th>
          <th><p>Extension – lined pouch and additional features for advanced students</p></th>
          <th></th>
        </tr>
      </thead></table>
    `;

    const result = processTablesInHtml(html);

    // Week 1: 3 lessons
    expect(result).toContain("Week 1 - Lesson 1");
    expect(result).toContain("Week 1 - Lesson 2");
    expect(result).toContain("Week 1 - Lesson 3");
    // Week 2: 3 lessons
    expect(result).toContain("Week 2 - Lesson 1");
    expect(result).toContain("Week 2 - Lesson 2");
    expect(result).toContain("Week 2 - Lesson 3");
    // Week 3 & 4 expanded into separate weeks: 3 + 3 = 6 lessons
    expect(result).toContain("Week 3 - Lesson 1: Plastic Zip Pouch - PRODUCTION");
    expect(result).toContain("Week 3 - Lesson 2: Plastic Zip Pouch - PRODUCTION");
    expect(result).toContain("Week 4 - Lesson 1: Plastic Zip Pouch - PRODUCTION");
    expect(result).toContain("Week 4 - Lesson 2: Plastic Zip Pouch - PRODUCTION");

    // Week descriptions in headings
    expect(result).toContain("DESIGN BRIEF");
    expect(result).toContain("PRODUCTION");

    // Count <h3> tags — should be at least 11 (12th might be skipped if < 10 chars)
    const h3Count = (result.match(/<h3>/g) || []).length;
    expect(h3Count).toBeGreaterThanOrEqual(11);

    // Differentiation content should appear in Week 1 and 2 lessons
    expect(result).toContain("Differentiation:");
  });
});
