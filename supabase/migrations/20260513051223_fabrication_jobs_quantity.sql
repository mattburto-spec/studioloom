-- Migration: fabrication_jobs_quantity
-- Created: 20260513051223 UTC
-- Phase: Preflight quantity-per-job (Option A, 13 May 2026)
--
-- WHY: Students often need multiple copies of the same part (4 wheels,
--   2 axles) but the current schema is one file = one job. Forces them
--   to submit 4 identical jobs that the teacher then reviews and
--   approves 4 times. Add a quantity column so a single submission
--   means "print N copies of this file".
--
-- IMPACT:
--   - fabrication_jobs gains `quantity INT NOT NULL DEFAULT 1`
--   - CHECK constraint enforces 1 ≤ quantity ≤ 20 (sanity bound;
--     beyond 20 is a workshop-policy conversation not a print job).
--   - Existing rows backfill to 1 via the DEFAULT.
--   - No RLS / index changes — quantity is a display value, not a
--     filter axis.
--
-- ROLLBACK: paired .down.sql drops the column. Safety guard refuses
--   if any row has quantity > 1 (= real student submission would be
--   silently downgraded to 1 copy on revert).

ALTER TABLE fabrication_jobs
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1
    CHECK (quantity >= 1 AND quantity <= 20);

COMMENT ON COLUMN fabrication_jobs.quantity IS
  'Number of identical copies the student wants printed/cut from this '
  'file. Default 1. Bound 1..20 (workshop-policy soft ceiling). Display '
  'only — scanner still scans the single source file. Lab tech prints '
  'N copies and marks the single job complete.';

-- Sanity check
DO $$
DECLARE
  v_col_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fabrication_jobs'
      AND column_name = 'quantity'
  ) INTO v_col_exists;
  IF NOT v_col_exists THEN
    RAISE EXCEPTION 'Migration failed: fabrication_jobs.quantity column not created';
  END IF;
  RAISE NOTICE 'Migration fabrication_jobs_quantity applied OK';
END $$;
