/**
 * Task D3 (part 1): Guardrail Validation
 *
 * Hard guardrails that CANNOT be overridden from admin UI.
 * Only code changes can modify these limits.
 */

import { HARD_GUARDRAILS, DEFAULT_GUARDRAIL_CONFIG, type GuardrailConfig } from "./types";

// ─── Efficacy Score Guardrails ───

export interface EfficacyValidation {
  valid: boolean;
  clampedValue: number;
  flags: string[];
}

/**
 * Validate an efficacy score change. Clamps to [10, 95] per cycle.
 */
export function validateEfficacyChange(
  currentScore: number,
  proposedScore: number
): EfficacyValidation {
  const flags: string[] = [];
  let clamped = proposedScore;

  if (proposedScore < HARD_GUARDRAILS.minEfficacy) {
    clamped = HARD_GUARDRAILS.minEfficacy;
    flags.push(`Clamped from ${proposedScore} to ${HARD_GUARDRAILS.minEfficacy} (floor)`);
  }

  if (proposedScore > HARD_GUARDRAILS.maxEfficacy) {
    clamped = HARD_GUARDRAILS.maxEfficacy;
    flags.push(`Clamped from ${proposedScore} to ${HARD_GUARDRAILS.maxEfficacy} (ceiling)`);
  }

  return {
    valid: flags.length === 0,
    clampedValue: clamped,
    flags,
  };
}

// ─── Time Weight Guardrails ───

const TIME_WEIGHT_ORDER = HARD_GUARDRAILS.timeWeightSteps;

/**
 * Validate a time_weight change. Can only move one step per cycle.
 * Returns null if the change is invalid.
 */
export function validateTimeWeightChange(
  current: string,
  proposed: string
): { valid: boolean; reason?: string } {
  const currentIdx = TIME_WEIGHT_ORDER.indexOf(current as typeof TIME_WEIGHT_ORDER[number]);
  const proposedIdx = TIME_WEIGHT_ORDER.indexOf(proposed as typeof TIME_WEIGHT_ORDER[number]);

  if (currentIdx === -1 || proposedIdx === -1) {
    return { valid: false, reason: `Unknown time_weight value: ${current} or ${proposed}` };
  }

  const distance = Math.abs(proposedIdx - currentIdx);
  if (distance > 1) {
    return {
      valid: false,
      reason: `time_weight can only change one step per cycle (${current}→${proposed} is ${distance} steps)`,
    };
  }

  return { valid: true };
}

// ─── Field-Level Guardrails ───

/**
 * Check if a field change requires manual approval.
 */
export function requiresManualApproval(field: string): boolean {
  return (HARD_GUARDRAILS.alwaysManualFields as readonly string[]).includes(field);
}

/**
 * Validate metadata change percentage.
 * No more than 20% of a block's metadata can change in a single cycle.
 */
export function validateMetadataChangePercent(
  changedFieldCount: number,
  totalFieldCount: number
): { valid: boolean; changePercent: number; reason?: string } {
  if (totalFieldCount === 0) return { valid: true, changePercent: 0 };

  const changePercent = Math.round((changedFieldCount / totalFieldCount) * 100);
  if (changePercent > HARD_GUARDRAILS.maxMetadataChangePercent) {
    return {
      valid: false,
      changePercent,
      reason: `${changePercent}% metadata change exceeds ${HARD_GUARDRAILS.maxMetadataChangePercent}% limit`,
    };
  }

  return { valid: true, changePercent };
}

// ─── Auto-Approve Logic ───

/**
 * Determine if a proposal can be auto-approved based on config.
 */
export function canAutoApprove(
  config: GuardrailConfig,
  field: string,
  evidenceCount: number,
  scoreDelta: number
): boolean {
  if (!config.autoApproveEnabled) return false;
  if (requiresManualApproval(field)) return false;
  if (evidenceCount < config.minEvidenceForAutoApprove) return false;
  if (Math.abs(scoreDelta) > config.maxScoreChangeForAutoApprove) return false;

  return true;
}

/**
 * Validate a complete proposal against all guardrails.
 */
export function validateProposal(proposal: {
  field: string;
  currentValue: unknown;
  proposedValue: unknown;
  evidenceCount: number;
}): {
  valid: boolean;
  requiresManual: boolean;
  flags: string[];
} {
  const flags: string[] = [];
  let valid = true;
  const requiresManual = requiresManualApproval(proposal.field);

  if (requiresManual) {
    flags.push(`Field '${proposal.field}' always requires manual approval`);
  }

  if (proposal.field === "efficacy_score") {
    const result = validateEfficacyChange(
      proposal.currentValue as number,
      proposal.proposedValue as number
    );
    flags.push(...result.flags);
    if (!result.valid) valid = false;
  }

  if (proposal.field === "time_weight") {
    const result = validateTimeWeightChange(
      proposal.currentValue as string,
      proposal.proposedValue as string
    );
    if (!result.valid) {
      valid = false;
      if (result.reason) flags.push(result.reason);
    }
  }

  return { valid, requiresManual: requiresManual || !valid, flags };
}
