/**
 * Dimensions3 Phase D — Feedback System Types
 *
 * Types for the teacher edit tracker, efficacy computation,
 * approval queue, and self-healing proposals.
 */

// ─── Edit Tracking ───

export type EditType =
  | "kept"
  | "rewritten"
  | "scaffolding_changed"
  | "reordered"
  | "deleted"
  | "added";

export interface ActivityDiff {
  activityId: string;
  activityTitle: string;
  editType: EditType;
  diffPercentage: number;
  sourceBlockId: string | null;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  position: { before: number; after: number | null };
}

export interface EditTrackingResult {
  generationRunId: string;
  unitId: string;
  diffs: ActivityDiff[];
  summary: {
    kept: number;
    rewritten: number;
    scaffoldingChanged: number;
    reordered: number;
    deleted: number;
    added: number;
    totalOriginal: number;
    totalAfter: number;
  };
  computedAt: string;
}

// ─── Efficacy ───

export interface EfficacySignals {
  blockId: string;
  keptRate: number;
  deletionRate: number;
  editRate: number;
  completionRate: number;
  timeAccuracy: number;
  paceScore: number;
  evidenceCount: number;
  signalBreakdown: {
    teacherInteractions: number;
    studentCompletions: number;
    timeObservations: number;
    paceFeedbackCount: number;
  };
}

export interface EfficacyResult {
  blockId: string;
  blockTitle: string;
  currentScore: number;
  proposedScore: number;
  scoreDelta: number;
  signals: EfficacySignals;
  confidence: "low" | "medium" | "high";
}

// ─── Proposals & Approval Queue ───

export type ProposalType = "efficacy_adjustment" | "self_healing" | "metadata_correction";
export type ProposalStatus = "pending" | "approved" | "rejected" | "modified";

export interface FeedbackProposal {
  id: string;
  blockId: string;
  blockTitle: string;
  proposalType: ProposalType;
  status: ProposalStatus;

  // What's proposed
  field: string; // "efficacy_score" | "time_weight" | "bloom_level" | etc.
  currentValue: unknown;
  proposedValue: unknown;

  // Evidence
  evidenceCount: number;
  evidenceSummary: string;
  signalBreakdown: Record<string, number>;

  // Guardrail checks
  requiresManualApproval: boolean;
  guardrailFlags: string[];

  // Resolution
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolvedValue: unknown;
  resolutionNote: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  proposalId: string;
  blockId: string;
  action: "approved" | "rejected" | "modified" | "auto_approved";
  field: string;
  previousValue: unknown;
  newValue: unknown;
  evidenceCount: number;
  resolvedBy: string | null;
  note: string | null;
  createdAt: string;
}

// ─── Self-Healing ───

export type HealingTrigger =
  | "time_weight_mismatch"
  | "low_completion_rate"
  | "high_deletion_rate";

export interface SelfHealingProposal {
  blockId: string;
  blockTitle: string;
  trigger: HealingTrigger;
  field: string;
  currentValue: unknown;
  proposedValue: unknown;
  evidence: {
    observationCount: number;
    avgValue: number;
    expectedValue: number;
    deviationPercent: number;
  };
  evidenceSummary: string;
}

// ─── Guardrails ───

export interface GuardrailConfig {
  /** Auto-approve OFF by default */
  autoApproveEnabled: boolean;
  /** Minimum evidence count for auto-approve */
  minEvidenceForAutoApprove: number;
  /** Max score change per cycle for auto-approve */
  maxScoreChangeForAutoApprove: number;
}

export const DEFAULT_GUARDRAIL_CONFIG: GuardrailConfig = {
  autoApproveEnabled: false,
  minEvidenceForAutoApprove: 20,
  maxScoreChangeForAutoApprove: 10,
};

/** Hard limits — cannot be overridden from UI */
export const HARD_GUARDRAILS = {
  minEfficacy: 10,
  maxEfficacy: 95,
  maxMetadataChangePercent: 20,
  timeWeightSteps: ["quick", "moderate", "extended", "flexible"] as const,
  alwaysManualFields: ["bloom_level", "phase", "activity_category"] as const,
} as const;
