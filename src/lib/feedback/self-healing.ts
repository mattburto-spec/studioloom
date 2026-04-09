/**
 * Task D4: Self-Healing Proposals
 *
 * Detects when block metadata is wrong based on usage patterns
 * and proposes corrections. All proposals go to the approval queue.
 */

import type { SelfHealingProposal, HealingTrigger } from "./types";
import { validateTimeWeightChange } from "./guardrails";

// ─── Constants ───

const TIME_WEIGHT_RANGES: Record<string, { min: number; max: number; default: number }> = {
  quick: { min: 3, max: 10, default: 6 },
  moderate: { min: 8, max: 22, default: 14 },
  extended: { min: 18, max: 45, default: 25 },
  flexible: { min: 3, max: 45, default: 15 },
};

const TIME_WEIGHT_ORDER = ["quick", "moderate", "extended", "flexible"];

const THRESHOLDS = {
  /** Minimum uses before time_weight mismatch triggers */
  timeWeightMinUses: 8,
  /** Deviation percentage to trigger time_weight proposal */
  timeWeightDeviationPercent: 50,
  /** Minimum uses before completion rate triggers */
  completionMinUses: 10,
  /** Completion rate floor */
  completionRateFloor: 0.30,
  /** Minimum uses before deletion rate triggers */
  deletionMinUses: 5,
  /** Deletion rate ceiling */
  deletionRateCeiling: 0.70,
};

// ─── Time Weight Mismatch Detection ───

/**
 * Detect if a block's avg_time_spent consistently differs from its time_weight.
 */
export function detectTimeWeightMismatch(block: {
  id: string;
  title: string;
  time_weight: string;
  avg_time_spent: number | null;
  times_used: number;
}): SelfHealingProposal | null {
  if (!block.avg_time_spent || block.times_used < THRESHOLDS.timeWeightMinUses) {
    return null;
  }

  const expected = TIME_WEIGHT_RANGES[block.time_weight];
  if (!expected) return null;

  const avgTime = block.avg_time_spent;
  const deviation = Math.abs(avgTime - expected.default) / expected.default;

  if (deviation <= THRESHOLDS.timeWeightDeviationPercent / 100) {
    return null;
  }

  // Determine which time_weight the avg_time_spent actually fits
  let bestFit = block.time_weight;
  let bestDistance = Infinity;

  for (const [weight, range] of Object.entries(TIME_WEIGHT_RANGES)) {
    if (weight === "flexible") continue; // Don't propose flexible
    const distance = Math.abs(avgTime - range.default);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestFit = weight;
    }
  }

  // Same weight = no change needed
  if (bestFit === block.time_weight) return null;

  // Validate one-step constraint
  const validation = validateTimeWeightChange(block.time_weight, bestFit);
  if (!validation.valid) {
    // Propose one step toward the best fit
    const currentIdx = TIME_WEIGHT_ORDER.indexOf(block.time_weight);
    const targetIdx = TIME_WEIGHT_ORDER.indexOf(bestFit);
    if (currentIdx === -1 || targetIdx === -1) return null;
    bestFit = TIME_WEIGHT_ORDER[currentIdx + (targetIdx > currentIdx ? 1 : -1)];
    if (!bestFit || bestFit === block.time_weight) return null;
  }

  return {
    blockId: block.id,
    blockTitle: block.title,
    trigger: "time_weight_mismatch",
    field: "time_weight",
    currentValue: block.time_weight,
    proposedValue: bestFit,
    evidence: {
      observationCount: block.times_used,
      avgValue: avgTime,
      expectedValue: expected.default,
      deviationPercent: Math.round(deviation * 100),
    },
    evidenceSummary: `Block tagged '${block.time_weight}' (expected ~${expected.default} min) but students average ${avgTime.toFixed(1)} min across ${block.times_used} uses. Proposed: change to '${bestFit}'.`,
  };
}

// ─── Low Completion Rate Detection ───

/**
 * Detect blocks with consistently low completion rates.
 */
export function detectLowCompletion(block: {
  id: string;
  title: string;
  avg_completion_rate: number | null;
  times_used: number;
}): SelfHealingProposal | null {
  if (
    block.avg_completion_rate === null ||
    block.times_used < THRESHOLDS.completionMinUses
  ) {
    return null;
  }

  if (block.avg_completion_rate >= THRESHOLDS.completionRateFloor) {
    return null;
  }

  return {
    blockId: block.id,
    blockTitle: block.title,
    trigger: "low_completion_rate",
    field: "scaffolding",
    currentValue: "current",
    proposedValue: "needs_review",
    evidence: {
      observationCount: block.times_used,
      avgValue: block.avg_completion_rate,
      expectedValue: THRESHOLDS.completionRateFloor,
      deviationPercent: Math.round(
        ((THRESHOLDS.completionRateFloor - block.avg_completion_rate) / THRESHOLDS.completionRateFloor) * 100
      ),
    },
    evidenceSummary: `Completion rate ${Math.round(block.avg_completion_rate * 100)}% across ${block.times_used} uses is below ${Math.round(THRESHOLDS.completionRateFloor * 100)}% threshold. Scaffolding review recommended.`,
  };
}

// ─── High Deletion Rate Detection ───

/**
 * Detect blocks that teachers consistently delete.
 */
export function detectHighDeletion(block: {
  id: string;
  title: string;
  times_used: number;
  times_edited: number;
  times_skipped: number;
  efficacy_score: number;
}): SelfHealingProposal | null {
  if (block.times_used < THRESHOLDS.deletionMinUses) {
    return null;
  }

  // Deletion rate approximation: times_skipped / times_used
  const deletionRate = block.times_skipped / block.times_used;
  if (deletionRate < THRESHOLDS.deletionRateCeiling) {
    return null;
  }

  return {
    blockId: block.id,
    blockTitle: block.title,
    trigger: "high_deletion_rate",
    field: "quality_review",
    currentValue: block.efficacy_score,
    proposedValue: "flagged",
    evidence: {
      observationCount: block.times_used,
      avgValue: deletionRate,
      expectedValue: 1 - THRESHOLDS.deletionRateCeiling,
      deviationPercent: Math.round(deletionRate * 100),
    },
    evidenceSummary: `Deleted/skipped ${Math.round(deletionRate * 100)}% of the time across ${block.times_used} uses. Quality review recommended.`,
  };
}

// ─── Batch Analysis ───

/**
 * Run self-healing analysis on all eligible blocks for a teacher.
 * Returns proposals for the approval queue.
 */
export function analyzeSelfHealing(
  blocks: Array<{
    id: string;
    title: string;
    time_weight: string;
    bloom_level: string | null;
    avg_time_spent: number | null;
    avg_completion_rate: number | null;
    times_used: number;
    times_edited: number;
    times_skipped: number;
    efficacy_score: number;
  }>
): SelfHealingProposal[] {
  const proposals: SelfHealingProposal[] = [];

  for (const block of blocks) {
    const timeProposal = detectTimeWeightMismatch(block);
    if (timeProposal) proposals.push(timeProposal);

    const completionProposal = detectLowCompletion(block);
    if (completionProposal) proposals.push(completionProposal);

    const deletionProposal = detectHighDeletion(block);
    if (deletionProposal) proposals.push(deletionProposal);
  }

  return proposals;
}

/**
 * Convert self-healing proposals to DB rows for feedback_proposals table.
 */
export function healingToProposals(
  proposals: SelfHealingProposal[]
): Array<{
  block_id: string;
  proposal_type: "self_healing";
  field: string;
  current_value: unknown;
  proposed_value: unknown;
  evidence_count: number;
  evidence_summary: string;
  signal_breakdown: Record<string, number>;
  requires_manual_approval: boolean;
  guardrail_flags: string[];
  status: "pending";
}> {
  return proposals.map(p => ({
    block_id: p.blockId,
    proposal_type: "self_healing" as const,
    field: p.field,
    current_value: p.currentValue,
    proposed_value: p.proposedValue,
    evidence_count: p.evidence.observationCount,
    evidence_summary: p.evidenceSummary,
    signal_breakdown: {
      observations: p.evidence.observationCount,
      avgValue: p.evidence.avgValue,
      expectedValue: p.evidence.expectedValue,
    },
    requires_manual_approval: true, // Self-healing always requires review
    guardrail_flags: p.trigger === "time_weight_mismatch"
      ? [`Time weight deviation: ${p.evidence.deviationPercent}%`]
      : [],
    status: "pending" as const,
  }));
}
