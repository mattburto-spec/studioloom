/**
 * Stage I-4: Block Extraction (no AI)
 *
 * Each enriched section with sectionType 'activity' becomes a candidate
 * Activity Block. Metadata populated from Pass B enrichment.
 * PII scan + copyright flag applied.
 */

import type { CostBreakdown } from "@/types/activity-blocks";
import type {
  IngestionAnalysis,
  EnrichedSection,
  ExtractedBlock,
  ExtractionResult,
  CopyrightFlag,
} from "./types";
import { scanForPII } from "./pii-scan";

const ZERO_COST: CostBreakdown = {
  inputTokens: 0,
  outputTokens: 0,
  modelId: "none",
  estimatedCostUSD: 0,
  timeMs: 0,
};

/**
 * Generate a title from a section heading.
 * Cleans up markdown artifacts and truncates.
 */
function deriveTitle(heading: string): string {
  return heading
    .replace(/^#+\s*/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .trim()
    .slice(0, 120);
}

/**
 * Generate a short description from section content.
 */
function deriveDescription(content: string): string {
  const firstSentence = content.split(/[.!?]\s/)[0];
  if (firstSentence && firstSentence.length <= 200) return firstSentence + ".";
  return content.slice(0, 200).trim() + "...";
}

/**
 * Extract a usable prompt/instruction from the section content.
 * For activities, this is the student-facing instruction.
 */
function derivePrompt(section: EnrichedSection): string {
  // If the content is short, use it directly
  if (section.content.length <= 500) return section.content;

  // Otherwise, try to extract the instructional part
  const lines = section.content.split("\n").filter((l) => l.trim());

  // Look for instruction-like lines
  const instructionLines = lines.filter(
    (l) =>
      /^[-•*]\s/.test(l.trim()) || // List items
      /^\d+[.)]\s/.test(l.trim()) || // Numbered steps
      /^(?:students?|learners?|you)\s/i.test(l.trim()) // Student-directed
  );

  if (instructionLines.length > 0) {
    return instructionLines.join("\n").slice(0, 500);
  }

  return section.content.slice(0, 500);
}

/**
 * Extract Activity Blocks from enriched sections.
 */
export function extractBlocks(
  analysis: IngestionAnalysis,
  copyrightFlag: CopyrightFlag = "unknown"
): ExtractionResult {
  const blocks: ExtractedBlock[] = [];
  let activitySectionsFound = 0;

  for (const section of analysis.enrichedSections) {
    // Only extract blocks from activity and assessment sections
    if (section.sectionType !== "activity" && section.sectionType !== "assessment") {
      continue;
    }

    activitySectionsFound++;

    const piiFlags = scanForPII(section.content);

    const block: ExtractedBlock = {
      tempId: crypto.randomUUID(),
      title: deriveTitle(section.heading),
      description: deriveDescription(section.content),
      prompt: derivePrompt(section),
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
      piiFlags,
      copyrightFlag,
    };

    blocks.push(block);
  }

  return {
    blocks,
    totalSectionsProcessed: analysis.enrichedSections.length,
    activitySectionsFound,
    piiDetected: blocks.some((b) => b.piiFlags.length > 0),
    cost: ZERO_COST,
  };
}
