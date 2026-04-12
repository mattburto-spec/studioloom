-- Migration 070: Add ON DELETE CASCADE to feedback FK constraints
-- Part of Dimensions3 Phase 3, §5.1
--
-- When an activity_block is deleted, its feedback_proposals and
-- feedback_audit_log rows should cascade-delete rather than orphan
-- or block the parent delete with a FK violation.

ALTER TABLE feedback_proposals
  DROP CONSTRAINT IF EXISTS feedback_proposals_block_id_fkey,
  ADD CONSTRAINT feedback_proposals_block_id_fkey
    FOREIGN KEY (block_id) REFERENCES activity_blocks(id) ON DELETE CASCADE;

ALTER TABLE feedback_audit_log
  DROP CONSTRAINT IF EXISTS feedback_audit_log_block_id_fkey,
  ADD CONSTRAINT feedback_audit_log_block_id_fkey
    FOREIGN KEY (block_id) REFERENCES activity_blocks(id) ON DELETE CASCADE;
