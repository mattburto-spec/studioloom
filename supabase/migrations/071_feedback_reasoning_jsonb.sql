-- Migration 071: Add reasoning JSONB column to feedback_proposals
-- Part of Dimensions3 Phase 3, §5.2 required behaviour #3
--
-- Stores the 6 formula input values (keptRate, completionRate,
-- timeAccuracy, deletionRate, paceScore, editRate) in each proposal
-- so the UI can explain WHY a score change was proposed.

ALTER TABLE feedback_proposals
  ADD COLUMN IF NOT EXISTS reasoning JSONB;

COMMENT ON COLUMN feedback_proposals.reasoning IS
  'Formula input values: keptRate, completionRate, timeAccuracy, deletionRate, paceScore, editRate';
