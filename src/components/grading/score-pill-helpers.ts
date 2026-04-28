/**
 * Pure helpers backing the ScorePill atom. Extracted so tests can assert
 * exact classnames + state classification (Lesson #38 — verify expected
 * values, not just non-null) without needing a DOM render harness.
 */

import type { GradingScale } from "@/lib/constants";

/**
 * Visual states. The "overridden" state is data, not visual — render-wise
 * it is identical to "confirmed". The audit row in `student_tile_grade_events`
 * captures the source distinction (teacher_confirm vs teacher_override).
 */
export type ScorePillState = "empty" | "ai-suggested" | "confirmed" | "overridden";

/**
 * Score-tier semantic colour. Tier thresholds match the prototype at
 * docs/prototypes/grading-v2/grading-v2.jsx:250.
 *   pct < 0.4   → red    (Emerging)
 *   pct < 0.6   → amber  (Developing)
 *   pct < 0.8   → teal   (Achieving)
 *   pct >= 0.8  → violet (Mastering)
 */
export type ScoreTier = "red" | "amber" | "teal" | "violet";

export interface ScorePillInput {
  /** Live score on the tile, null if not yet set. */
  score: number | null;
  /** Has the teacher confirmed this score (clicked Confirm or otherwise)? */
  confirmed: boolean;
  /** AI's suggested score, null if AI hasn't run yet. */
  aiPreScore: number | null;
}

/**
 * Classify a tile-grade row into one of four visual states.
 *
 * Truth table:
 *   score=null, confirmed=false                → empty
 *   score=ai,   confirmed=false (ai available) → ai-suggested
 *   score=set,  confirmed=true,  score===ai    → confirmed
 *   score=set,  confirmed=true,  score!==ai    → overridden
 *   score=set,  confirmed=true,  ai=null       → confirmed (no override possible without a baseline)
 */
export function classifyScorePillState(input: ScorePillInput): ScorePillState {
  const { score, confirmed, aiPreScore } = input;
  if (score === null) return "empty";
  if (!confirmed) return "ai-suggested";
  if (aiPreScore !== null && score !== aiPreScore) return "overridden";
  return "confirmed";
}

/**
 * Map a normalized score (0–1) to a tier. Returns "red" for null/zero,
 * because we never colour a null score with the high tier.
 */
export function getScoreTier(score: number | null, max: number): ScoreTier {
  if (score === null || max <= 0) return "red";
  const pct = score / max;
  if (pct < 0.4) return "red";
  if (pct < 0.6) return "amber";
  if (pct < 0.8) return "teal";
  return "violet";
}

/**
 * Static Tailwind class lookup. Tailwind's JIT can't read interpolated
 * class strings, so every class that ships must appear literally in source.
 * Each tier holds the four utility-class fragments the pill needs.
 */
const TIER_CLASSES: Record<ScoreTier, {
  bgSolid: string;
  bgGhost: string;
  borderSolid: string;
  borderGhost: string;
  textOnGhost: string;
}> = {
  red: {
    bgSolid: "bg-red-500",
    bgGhost: "bg-red-500/10",
    borderSolid: "border-red-500",
    borderGhost: "border-red-500/35",
    textOnGhost: "text-red-500",
  },
  amber: {
    bgSolid: "bg-amber-500",
    bgGhost: "bg-amber-500/10",
    borderSolid: "border-amber-500",
    borderGhost: "border-amber-500/35",
    textOnGhost: "text-amber-600",
  },
  teal: {
    bgSolid: "bg-teal-500",
    bgGhost: "bg-teal-500/10",
    borderSolid: "border-teal-500",
    borderGhost: "border-teal-500/35",
    textOnGhost: "text-teal-600",
  },
  violet: {
    bgSolid: "bg-violet-600",
    bgGhost: "bg-violet-600/10",
    borderSolid: "border-violet-600",
    borderGhost: "border-violet-600/35",
    textOnGhost: "text-violet-700",
  },
};

/**
 * Base classes shared by every variant — shape, typography, layout. Returned
 * separately so tests can assert state-specific fragments without coupling
 * to the layout primitives.
 */
export const SCORE_PILL_BASE_CLASSES =
  "inline-flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 " +
  "text-[11.5px] font-extrabold border transition";

/**
 * Compose the variant classes for a given (state, tier) pair. Returned as a
 * single space-joined string, deterministic per input. Tests assert exact
 * strings so any unintended visual change shows up as a failing assertion.
 */
export function getScorePillVariantClasses(state: ScorePillState, tier: ScoreTier): string {
  const t = TIER_CLASSES[tier];

  if (state === "confirmed" || state === "overridden") {
    return [t.bgSolid, t.borderSolid, "text-white", "border-solid"].join(" ");
  }

  if (state === "ai-suggested") {
    return [t.bgGhost, t.borderGhost, t.textOnGhost, "border-dashed"].join(" ");
  }

  // empty
  return [t.bgGhost, t.borderGhost, t.textOnGhost, "border-dashed", "opacity-50"].join(" ");
}

/**
 * Convenience composer used by the React component itself — base + variant
 * in one call.
 */
export function getScorePillClasses(state: ScorePillState, tier: ScoreTier): string {
  return `${SCORE_PILL_BASE_CLASSES} ${getScorePillVariantClasses(state, tier)}`;
}

/**
 * Format the score for display. Empty state shows the scale's minimum as a
 * placeholder (e.g. "1" for MYP, "0%" for percentage). Otherwise delegates
 * to the scale's own formatter so framework-specific suffixes (`%`) and
 * letter mappings (ACARA's `A`/`B`/`C`/`D`/`E`) render correctly.
 */
export function formatScoreForPill(score: number | null, scale: GradingScale): string {
  if (score === null) return scale.formatDisplay(scale.min);
  return scale.formatDisplay(score);
}
