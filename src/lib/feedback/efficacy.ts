/**
 * Task D2: Efficacy Computation
 *
 * Computes efficacy scores for activity blocks based on real usage signals.
 * Changes go to the approval queue — never applied directly.
 */

import type { EfficacyResult, EfficacySignals } from "./types";
import { aggregateSignals, getBlocksForRecomputation } from "./signals";
import { validateEfficacyChange } from "./guardrails";

// ─── Core Formula ───

/**
 * Compute efficacy score from aggregated signals.
 * Formula from spec line ~607.
 *
 * efficacy = (
 *   0.30 * kept_rate +
 *   0.25 * completion_rate +
 *   0.20 * time_accuracy +
 *   0.10 * (1 - deletion_rate) +
 *   0.10 * pace_score +
 *   0.05 * (1 - edit_rate)
 * ) * 100
 */
export function computeEfficacyScore(signals: EfficacySignals): number {
  const raw =
    0.30 * signals.keptRate +
    0.25 * signals.completionRate +
    0.20 * signals.timeAccuracy +
    0.10 * (1 - signals.deletionRate) +
    0.10 * signals.paceScore +
    0.05 * (1 - signals.editRate);

  return Math.round(raw * 100 * 10) / 10; // one decimal
}

/**
 * Determine confidence level based on evidence count.
 */
export function getConfidence(evidenceCount: number): "low" | "medium" | "high" {
  if (evidenceCount >= 20) return "high";
  if (evidenceCount >= 8) return "medium";
  return "low";
}

// ─── Batch Computation ───

type SupabaseClient = { from: (table: string) => any; rpc: (fn: string, args: Record<string, unknown>) => any };

/**
 * Compute efficacy for a single block. Returns null if insufficient evidence.
 */
export async function computeBlockEfficacy(
  supabase: SupabaseClient,
  blockId: string,
  blockTitle: string,
  currentScore: number,
  timeWeight: string
): Promise<EfficacyResult | null> {
  const signals = await aggregateSignals(supabase, blockId, timeWeight);

  if (signals.evidenceCount < 3) return null;

  const proposedScore = computeEfficacyScore(signals);
  const scoreDelta = proposedScore - currentScore;

  // Skip if change is negligible
  if (Math.abs(scoreDelta) < 1) return null;

  return {
    blockId,
    blockTitle,
    currentScore,
    proposedScore,
    scoreDelta,
    signals,
    confidence: getConfidence(signals.evidenceCount),
  };
}

/**
 * Run batch efficacy computation for all eligible blocks for a teacher.
 * Returns proposed adjustments (does NOT apply them).
 */
export async function runEfficacyBatch(
  supabase: SupabaseClient,
  teacherId: string,
  minEvidence: number = 3
): Promise<EfficacyResult[]> {
  const blocks = await getBlocksForRecomputation(supabase, teacherId, minEvidence);
  const results: EfficacyResult[] = [];

  for (const block of blocks) {
    const result = await computeBlockEfficacy(
      supabase,
      block.id,
      block.title,
      block.efficacy_score,
      block.time_weight
    );
    if (result) {
      // Validate against guardrails
      const validation = validateEfficacyChange(block.efficacy_score, result.proposedScore);
      if (validation.clampedValue !== result.proposedScore) {
        result.proposedScore = validation.clampedValue;
        result.scoreDelta = validation.clampedValue - result.currentScore;
      }
      results.push(result);
    }
  }

  return results;
}

/**
 * Convert efficacy results to proposal rows for the feedback_proposals table.
 */
export function efficacyToProposals(
  results: EfficacyResult[]
): Array<{
  block_id: string;
  proposal_type: "efficacy_adjustment";
  field: string;
  current_value: number;
  proposed_value: number;
  evidence_count: number;
  evidence_summary: string;
  signal_breakdown: Record<string, number>;
  reasoning: Record<string, number>;
  requires_manual_approval: boolean;
  guardrail_flags: string[];
  status: "pending";
}> {
  return results.map(r => {
    const validation = validateEfficacyChange(r.currentScore, r.proposedScore);
    return {
      block_id: r.blockId,
      proposal_type: "efficacy_adjustment" as const,
      field: "efficacy_score",
      current_value: r.currentScore,
      proposed_value: r.proposedScore,
      evidence_count: r.signals.evidenceCount,
      evidence_summary: buildEvidenceSummary(r),
      signal_breakdown: r.signals.signalBreakdown,
      reasoning: {
        keptRate: r.signals.keptRate,
        completionRate: r.signals.completionRate,
        timeAccuracy: r.signals.timeAccuracy,
        deletionRate: r.signals.deletionRate,
        paceScore: r.signals.paceScore,
        editRate: r.signals.editRate,
      },
      requires_manual_approval: !validation.valid || r.confidence === "low",
      guardrail_flags: validation.flags,
      status: "pending" as const,
    };
  });
}

function buildEvidenceSummary(r: EfficacyResult): string {
  const parts: string[] = [];
  const s = r.signals;

  if (s.signalBreakdown.teacherInteractions > 0) {
    parts.push(`${s.signalBreakdown.teacherInteractions} teacher interactions (${Math.round(s.keptRate * 100)}% kept)`);
  }
  if (s.signalBreakdown.studentCompletions > 0) {
    parts.push(`${s.signalBreakdown.studentCompletions} student uses (${Math.round(s.completionRate * 100)}% completion)`);
  }
  if (s.signalBreakdown.timeObservations > 0) {
    parts.push(`time accuracy ${Math.round(s.timeAccuracy * 100)}%`);
  }
  if (s.signalBreakdown.paceFeedbackCount > 0) {
    parts.push(`${s.signalBreakdown.paceFeedbackCount} pace feedback`);
  }

  return parts.length > 0 ? parts.join(", ") : "Insufficient evidence detail";
}
