/**
 * E1: Unit Import — Reconstruction Logic
 *
 * Takes full ingestion pipeline result, detects lesson boundaries,
 * assembles into StudioLoom unit structure with match report.
 *
 * Key insight: For unit IMPORT, we use ALL enriched sections (not just
 * extracted activity blocks) to preserve the full lesson structure. The
 * extraction step filters to activities-only, which is correct for the
 * block library but loses lesson structure (a 12-lesson unit plan where
 * most sections are "instruction" collapses to 1 lesson with 3 blocks).
 */

import type { IngestionPipelineResult, ExtractedBlock, EnrichedSection } from "./types";

// ─── Types ───

export interface ReconstructedLesson {
  title: string;
  learningGoal: string;
  blocks: ExtractedBlock[];
  matchPercentage: number;
  originalIndex: number;
}

export interface ReconstructionResult {
  lessons: ReconstructedLesson[];
  overallMatchPercentage: number;
  totalBlocks: number;
  unmatchedBlocks: ExtractedBlock[];
  metadata: {
    detectedLessonCount: number;
    sequenceConfidence: number;
    assessmentPoints: number[];
  };
}

// ─── Section → Block helpers ───

/** Clean up a heading for use as a block title. */
function cleanTitle(heading: string): string {
  return heading
    .replace(/^#+\s*/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .trim()
    .slice(0, 120);
}

/** Short description from section content. */
function shortDescription(content: string): string {
  const firstSentence = content.split(/[.!?]\s/)[0];
  if (firstSentence && firstSentence.length <= 200) return firstSentence + ".";
  return content.slice(0, 200).trim() + "...";
}

/** Convert an enriched section into an ExtractedBlock for reconstruction. */
function sectionToBlock(section: EnrichedSection): ExtractedBlock {
  return {
    tempId: crypto.randomUUID(),
    title: cleanTitle(section.heading),
    description: shortDescription(section.content),
    prompt: section.content.slice(0, 500),
    bloom_level: section.bloom_level,
    time_weight: section.time_weight,
    grouping: section.grouping,
    phase: section.phase,
    activity_category: section.activity_category,
    materials: section.materials || [],
    scaffolding_notes: section.scaffolding_notes,
    udl_hints: section.udl_hints,
    teaching_approach: section.teaching_approach,
    source_section_index: section.index,
    piiFlags: [],
    copyrightFlag: "unknown",
  };
}

// ─── Lesson Boundary Detection ───

/** Pattern matching lesson/week/day headings in block titles */
const LESSON_TITLE_RE = /^(?:Lesson|Week|Weeks|Day|Session|Module|Part|Unit)\s+\d/i;

/**
 * Detect lesson boundaries from extracted blocks.
 * Heuristics (in priority order):
 * 1. Block title starts with lesson/week/day keyword + number
 * 2. Blocks with phase "opening" or activity_category "warmup" start a new lesson
 * 3. Large section_index gaps (>3) suggest lesson boundaries
 * 4. First block always starts lesson 1
 */
function detectLessonBoundaries(blocks: ExtractedBlock[]): number[][] {
  if (blocks.length === 0) return [];

  const lessons: number[][] = [[0]];

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const prevBlock = blocks[i - 1];

    // Title-based: block title matches lesson/week/day heading pattern
    const titleStartsLesson = LESSON_TITLE_RE.test(block.title);

    const isNewLesson =
      titleStartsLesson ||
      block.phase === "opening" ||
      block.activity_category === "warmup" ||
      (block.source_section_index - prevBlock.source_section_index > 3);

    if (isNewLesson) {
      lessons.push([i]);
    } else {
      lessons[lessons.length - 1].push(i);
    }
  }

  return lessons;
}

/**
 * Compute a match quality percentage for a lesson group.
 * Based on: bloom diversity, phase coverage, time_weight variety.
 */
function computeLessonMatch(blocks: ExtractedBlock[]): number {
  if (blocks.length === 0) return 0;

  let score = 50; // Base score

  // Bloom diversity bonus (max +20)
  const blooms = new Set(blocks.map(b => b.bloom_level));
  score += Math.min(blooms.size * 7, 20);

  // Phase coverage bonus (max +15)
  const phases = new Set(blocks.map(b => b.phase));
  score += Math.min(phases.size * 5, 15);

  // Activity count bonus (max +15)
  score += Math.min(blocks.length * 3, 15);

  return Math.min(score, 100);
}

/**
 * Detect assessment-heavy lessons (high evaluate/create bloom levels).
 */
function detectAssessmentPoints(lessons: ReconstructedLesson[]): number[] {
  return lessons
    .map((lesson, i) => {
      const assessmentBlocks = lesson.blocks.filter(
        b => b.bloom_level === "evaluate" || b.bloom_level === "create" || b.activity_category === "assessment"
      );
      return assessmentBlocks.length >= 1 ? i : -1;
    })
    .filter(i => i >= 0);
}

// ─── Main Reconstruction ───

/**
 * Reconstruct a unit from ingestion pipeline output.
 *
 * Uses ALL enriched sections (not just extracted activity blocks) so that a
 * 12-lesson unit plan with mostly instructional text still shows 12 lessons.
 * Sections classified as "metadata" are skipped (title pages, copyright, etc.)
 * but instruction, activity, assessment, and unknown sections all become blocks.
 * Falls back to extraction.blocks when no enriched sections are available.
 */
export function reconstructUnit(ingestion: IngestionPipelineResult): ReconstructionResult {
  // Prefer enriched sections (full document) over extracted blocks (activity-only)
  const enrichedSections = ingestion.analysis?.enrichedSections ?? [];
  const usableSections = enrichedSections.filter(
    (s) => s.sectionType !== "metadata"
  );

  // Build blocks from all usable sections, or fall back to extraction blocks
  const blocks: ExtractedBlock[] =
    usableSections.length > 0
      ? usableSections.map(sectionToBlock)
      : ingestion.extraction.blocks;

  if (blocks.length === 0) {
    return {
      lessons: [],
      overallMatchPercentage: 0,
      totalBlocks: 0,
      unmatchedBlocks: [],
      metadata: { detectedLessonCount: 0, sequenceConfidence: 0, assessmentPoints: [] },
    };
  }

  // Sort by source_section_index
  const sorted = [...blocks].sort((a, b) => a.source_section_index - b.source_section_index);
  const lessonGroups = detectLessonBoundaries(sorted);

  const lessons: ReconstructedLesson[] = lessonGroups.map((group, idx) => {
    const lessonBlocks = group.map(i => sorted[i]);
    const firstBlock = lessonBlocks[0];

    // Derive lesson title: use the block's own heading when it already names
    // the lesson/week (e.g. "Week 2: Prototyping"), otherwise prefix with
    // "Lesson N:"
    let title: string;
    if (!firstBlock) {
      title = `Lesson ${idx + 1}`;
    } else if (LESSON_TITLE_RE.test(firstBlock.title)) {
      title = firstBlock.title;
    } else {
      title = `Lesson ${idx + 1}: ${firstBlock.title.split(":").pop()?.trim() || firstBlock.title}`;
    }

    return {
      title,
      learningGoal: firstBlock
        ? `Students will ${firstBlock.bloom_level} through ${firstBlock.activity_category} activities`
        : "",
      blocks: lessonBlocks,
      matchPercentage: computeLessonMatch(lessonBlocks),
      originalIndex: idx,
    };
  });

  // All blocks are matched in this implementation
  const unmatchedBlocks: ExtractedBlock[] = [];

  const matchPercentages = lessons.map(l => l.matchPercentage);
  const overallMatch = matchPercentages.length > 0
    ? Math.round(matchPercentages.reduce((a, b) => a + b, 0) / matchPercentages.length)
    : 0;

  // Sequence confidence based on section_index ordering
  const indices = sorted.map(b => b.source_section_index);
  let ordered = 0;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] >= indices[i - 1]) ordered++;
  }
  const sequenceConfidence = indices.length > 1 ? ordered / (indices.length - 1) : 1;

  const assessmentPoints = detectAssessmentPoints(lessons);

  return {
    lessons,
    overallMatchPercentage: overallMatch,
    totalBlocks: blocks.length,
    unmatchedBlocks,
    metadata: {
      detectedLessonCount: lessons.length,
      sequenceConfidence: Math.round(sequenceConfidence * 100) / 100,
      assessmentPoints,
    },
  };
}

// ─── Content Data Conversion ───

/**
 * Map enriched time_weight to a duration estimate in minutes.
 */
function timeWeightToMinutes(tw: string): number {
  switch (tw) {
    case "quick": return 5;
    case "moderate": return 15;
    case "extended": return 25;
    default: return 10;
  }
}

/**
 * Map time_weight strings to the TimeWeight type expected by ActivitySection.
 */
function normalizeTimeWeight(tw: string): "quick" | "moderate" | "extended" {
  if (tw === "quick" || tw === "moderate" || tw === "extended") return tw;
  return "moderate";
}

/**
 * Convert reconstruction result to StudioLoom UnitContentDataV2 format.
 *
 * Each lesson becomes a UnitPage with type "lesson" and a nested content
 * object matching the PageContent interface (title, learningGoal, sections[]).
 * Each block becomes an ActivitySection with prompt, bloom_level, timeWeight,
 * grouping, and durationMinutes.
 */
export function reconstructionToContentData(result: ReconstructionResult): {
  version: 2;
  pages: Array<{
    id: string;
    type: "lesson";
    title: string;
    content: {
      title: string;
      learningGoal: string;
      sections: Array<{
        prompt: string;
        responseType: string;
        durationMinutes: number;
        bloom_level?: string;
        timeWeight?: string;
        grouping?: string;
        criterionTags?: string[];
      }>;
    };
  }>;
} {
  return {
    version: 2,
    pages: result.lessons.map((lesson, i) => ({
      id: `import_p${i}`,
      type: "lesson" as const,
      title: lesson.title,
      content: {
        title: lesson.title,
        learningGoal: lesson.learningGoal,
        sections: lesson.blocks.map(block => ({
          prompt: block.description || block.title,
          responseType: "text",
          durationMinutes: timeWeightToMinutes(block.time_weight),
          bloom_level: block.bloom_level || undefined,
          timeWeight: normalizeTimeWeight(block.time_weight),
          grouping: block.grouping || undefined,
        })),
      },
    })),
  };
}
