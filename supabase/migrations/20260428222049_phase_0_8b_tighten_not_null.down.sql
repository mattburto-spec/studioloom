-- Rollback for: phase_0_8b_tighten_not_null
-- Pairs with: 20260428222049_phase_0_8b_tighten_not_null.sql
-- Phase: Access Model v2 Phase 0.8b
--
-- Reverses the NOT NULL tighten. Existing data is preserved.

ALTER TABLE classes  ALTER COLUMN school_id DROP NOT NULL;
ALTER TABLE units    ALTER COLUMN school_id DROP NOT NULL;
ALTER TABLE students ALTER COLUMN school_id DROP NOT NULL;
