export { trackEdits, computeEditDiffs, summarizeDiffs, extractActivities, computeDiffPercentage, classifyEdit } from "./edit-tracker";
export { computeEfficacyScore, computeBlockEfficacy, runEfficacyBatch, efficacyToProposals, getConfidence } from "./efficacy";
export { aggregateSignals, getBlocksForRecomputation, getBlockUsageStats } from "./signals";
export { validateEfficacyChange, validateTimeWeightChange, requiresManualApproval, validateMetadataChangePercent, canAutoApprove, validateProposal } from "./guardrails";
export { detectTimeWeightMismatch, detectLowCompletion, detectHighDeletion, analyzeSelfHealing, healingToProposals } from "./self-healing";
export * from "./types";
