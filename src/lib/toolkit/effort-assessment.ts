/**
 * Shared Effort Assessment — Language-Tier Aware
 *
 * Client-side effort level classification that adjusts word count thresholds
 * based on the student's ELL (English Language Learner) tier.
 *
 * Research basis: docs/research/student-influence-factors.md
 * - Language proficiency moderates EVERY text-based metric
 * - Current effort-gating penalises ELL students for lower word counts
 * - Word count thresholds must scale with language proficiency tier
 *
 * ELL Tiers (from StudioLoom's 3-tier scaffolding system):
 *   Tier 1 (Beginning/Emerging): Just starting English acquisition
 *   Tier 2 (Developing/Intermediate): Conversational but limited academic English
 *   Tier 3 (Proficient/Advanced): Near-native or native fluency
 *
 * Reasoning/specificity markers still count at full weight for all tiers —
 * an ELL student who uses "because" in a 4-word sentence is showing effort.
 */

import type { EffortLevel } from "./types";

export type ELLTier = 1 | 2 | 3;

/**
 * Word count thresholds per ELL tier.
 * Tier 3 (proficient) uses the original defaults.
 * Tier 2 gets ~70% of the thresholds.
 * Tier 1 gets ~50% of the thresholds.
 */
const THRESHOLDS: Record<ELLTier, { low: number; medium: number; detail: number }> = {
  1: { low: 3, medium: 5, detail: 8 },     // Beginning: 50% of default
  2: { low: 4, medium: 7, detail: 11 },     // Developing: ~70% of default
  3: { low: 6, medium: 10, detail: 15 },    // Proficient: original defaults
};

/**
 * Reasoning markers — language-independent logical connectors.
 * These indicate structural thinking regardless of vocabulary level.
 */
const REASONING_PATTERN = /\b(because|since|so that|in order to|this would|this could|which means|that way|if.*then|therefore|as a result)\b/i;

/**
 * Specificity markers — evidence of concrete thinking.
 */
const SPECIFICITY_PATTERN = /\b(for example|such as|like|using|made of|instead of|rather than|compared to|specifically|particularly)\b/i;

/**
 * Assess effort level for a student's text input.
 *
 * @param text - The student's text input
 * @param ellTier - ELL tier (1=beginning, 2=developing, 3=proficient). Defaults to 3.
 * @returns EffortLevel - "low", "medium", or "high"
 */
export function assessEffort(text: string, ellTier: ELLTier = 3): EffortLevel {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const t = THRESHOLDS[ellTier] || THRESHOLDS[3];

  const hasReasoning = REASONING_PATTERN.test(text);
  const hasSpecifics = SPECIFICITY_PATTERN.test(text);
  const hasDetail = words >= t.detail;

  // Below minimum threshold = low effort (adjusted for tier)
  if (words < t.low) return "low";

  // High effort: detailed + linguistic markers (any 2 of 3 criteria)
  if (
    (hasDetail && hasSpecifics) ||
    (hasDetail && hasReasoning) ||
    (hasSpecifics && hasReasoning)
  ) {
    return "high";
  }

  // Medium effort: reasonable length OR has markers
  if (words >= t.medium || hasSpecifics || hasReasoning) return "medium";

  return "low";
}

/**
 * Depth dots (1-3) based on effort level.
 */
export function effortToDepth(effort: EffortLevel): number {
  switch (effort) {
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
  }
}

/**
 * Micro-feedback messages per effort level.
 * Used by toolkit components for instant client-side toast feedback.
 */
export const MICRO_FEEDBACK: Record<EffortLevel, { emoji: string; messages: string[] }> = {
  high: {
    emoji: "✦",
    messages: ["Deep thinking!", "Great detail!", "Strong reasoning!", "Specific and clear!", "Well thought out!"],
  },
  medium: {
    emoji: "→",
    messages: ["Good — keep pushing!", "Nice start!", "Getting there!", "Building momentum!"],
  },
  low: {
    emoji: "↑",
    messages: ["Try adding more detail", "Can you be more specific?", "What exactly would that look like?"],
  },
};

/**
 * Get a random micro-feedback message for the given effort level.
 */
export function getRandomMicroFeedback(effort: EffortLevel): { emoji: string; message: string } {
  const fb = MICRO_FEEDBACK[effort];
  const message = fb.messages[Math.floor(Math.random() * fb.messages.length)];
  return { emoji: fb.emoji, message };
}

// =========================================================================
// Meaningful Word Counting — for reflections and long-form text
// =========================================================================

/**
 * Common English filler/function words that don't indicate meaningful effort.
 * Shared across ContractForm, FinalReflection, SharingPhaseView, etc.
 */
const FILLER_WORDS = new Set([
  "i", "the", "a", "an", "is", "was", "it", "my", "to", "and", "or", "of",
  "in", "for", "that", "this", "with", "be", "are", "am", "we", "he", "she",
  "they", "me", "you", "us", "do", "did", "has", "have", "had", "not", "no",
  "so", "but", "if", "on", "at", "by", "up", "as", "all", "can", "will",
]);

/**
 * Count meaningful words (excluding filler/function words).
 * Used for reflection effort-gating where we need students to write
 * substantive text, not just filler.
 */
export function countMeaningfulWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !FILLER_WORDS.has(w.toLowerCase()))
    .length;
}

/**
 * Meaningful word thresholds per ELL tier for reflection-style text.
 * Used by reflection components, contract forms, and sharing views.
 *
 * Tier 3 (proficient) uses the original thresholds.
 * Tier 2 gets ~65% of the thresholds.
 * Tier 1 gets ~40% of the thresholds.
 */
const MEANINGFUL_WORD_THRESHOLDS: Record<ELLTier, { min: number; good: number; deep: number }> = {
  1: { min: 3, good: 6, deep: 8 },      // Beginning: ~40%
  2: { min: 5, good: 10, deep: 13 },     // Developing: ~65%
  3: { min: 8, good: 15, deep: 20 },     // Proficient: original
};

/**
 * Get meaningful word thresholds for a given ELL tier.
 * Use these to set the "gate" before showing confidence sliders, etc.
 */
export function getMeaningfulWordThresholds(ellTier: ELLTier = 3) {
  return MEANINGFUL_WORD_THRESHOLDS[ellTier] || MEANINGFUL_WORD_THRESHOLDS[3];
}
