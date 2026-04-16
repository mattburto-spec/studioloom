/**
 * Stage I-1: Deterministic Parsing (no AI)
 *
 * Extracts heading structure, paragraph breaks, section boundaries.
 * Produces structured document sections with positional metadata.
 */

import type { CostBreakdown } from "@/types/activity-blocks";
import type { ParsedSection, ParseResult } from "./types";

const ZERO_COST: CostBreakdown = {
  inputTokens: 0,
  outputTokens: 0,
  modelId: "none",
  estimatedCostUSD: 0,
  timeMs: 0,
};

// Patterns for detecting time references (e.g., "10 min", "15 minutes", "1 hour")
const DURATION_PATTERN = /\b\d+\s*(?:min(?:ute)?s?|hr|hours?)\b/i;

// Heading patterns for markdown-style and plain-text documents
const HEADING_PATTERNS = [
  /^(#{1,6})\s+(.+)$/,                     // Markdown headings
  /^([A-Z][A-Za-z\s&,:-]{2,80})$/,         // ALL-CAPS-ish short lines as headings
  /^(?:Section|Part|Chapter|Module|Lesson|Activity|Stage|Step|Phase|Task)\s*\d*[.:]\s*(.+)$/i,
  /^(?:Week|Weeks|Day|Session|Period|Lesson|Module|Part|Unit)\s+\d+/i,  // Numbered week/lesson headings
];

/** Count words in a string. */
function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Detect if a line looks like a heading. Returns [level, text] or null. */
function detectHeading(line: string): [number, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return null;

  // Markdown heading
  const mdMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
  if (mdMatch) return [mdMatch[1].length, mdMatch[2].trim()];

  // Numbered section heading (e.g., "Activity 1: Warm Up")
  const sectionMatch = trimmed.match(
    /^(?:Section|Part|Chapter|Module|Lesson|Activity|Stage|Step|Phase|Task)\s*\d*[.:]\s*(.+)$/i
  );
  if (sectionMatch) return [2, trimmed];

  // Week/Day/Session numbered heading — common in teacher unit plans
  // e.g., "Week 1", "Lesson 3", "Weeks 1-2: Design Sprint", "Day 5"
  if (
    /^(?:Week|Weeks|Day|Session|Period|Lesson|Module|Part|Unit)\s+\d+/i.test(trimmed) &&
    wordCount(trimmed) <= 12
  ) {
    return [2, trimmed];
  }

  // Short uppercase line (likely a heading)
  if (
    trimmed.length <= 80 &&
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]/.test(trimmed) &&
    wordCount(trimmed) <= 10
  ) {
    return [2, trimmed];
  }

  // Short bold-like line (starts with ** in markdown)
  const boldMatch = trimmed.match(/^\*\*(.+)\*\*$/);
  if (boldMatch && boldMatch[1].length <= 80) {
    return [3, boldMatch[1].trim()];
  }

  return null;
}

/** Check if a line contains list item markers. */
function isListItem(line: string): boolean {
  return /^\s*[-•*]\s/.test(line) || /^\s*\d+[.)]\s/.test(line);
}

/**
 * Parse raw text into structured sections.
 * Non-AI: uses heading detection + paragraph breaks.
 */
export function parseDocument(rawText: string): ParseResult {
  const lines = rawText.split("\n");
  const sections: ParsedSection[] = [];
  let currentHeading = "Introduction";
  let currentLevel = 1;
  let currentContent: string[] = [];
  let sectionIndex = 0;
  let firstHeading: string | null = null;

  function flushSection() {
    const content = currentContent.join("\n").trim();
    if (content.length > 0) {
      const hasListItems = currentContent.some(isListItem);
      // Check both heading and content for duration patterns
      const fullText = currentHeading + " " + content;
      sections.push({
        index: sectionIndex++,
        heading: currentHeading,
        content,
        level: currentLevel,
        wordCount: wordCount(content),
        hasListItems,
        hasDuration: DURATION_PATTERN.test(fullText),
      });
    }
    currentContent = [];
  }

  for (const line of lines) {
    const heading = detectHeading(line);
    if (heading) {
      flushSection();
      currentLevel = heading[0];
      currentHeading = heading[1];
      if (firstHeading === null) firstHeading = heading[1];
    } else {
      currentContent.push(line);
    }
  }

  // Flush last section
  flushSection();

  // Derive title: prefer the first detected heading, then first section heading, then first line
  const title =
    firstHeading ||
    (sections.length > 0
      ? sections[0].heading
      : rawText.trim().split("\n")[0]?.slice(0, 100) || "Untitled");

  const totalWordCount = sections.reduce((sum, s) => sum + s.wordCount, 0);

  return {
    title,
    sections,
    totalWordCount,
    headingCount: sections.length,
    cost: ZERO_COST,
  };
}
