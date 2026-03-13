-- Migration 004: Per-page due dates (replaces per-criterion due dates)
-- Each page (A1-D4) can have its own due date instead of just per-strand

-- Add JSONB column for per-page due dates
-- Structure: { "A1": "2026-04-01", "A2": "2026-04-08", ... }
ALTER TABLE class_units
  ADD COLUMN IF NOT EXISTS page_due_dates JSONB NOT NULL DEFAULT '{}';

-- Drop the old per-strand columns
ALTER TABLE class_units
  DROP COLUMN IF EXISTS strand_a_due_date,
  DROP COLUMN IF EXISTS strand_b_due_date,
  DROP COLUMN IF EXISTS strand_c_due_date,
  DROP COLUMN IF EXISTS strand_d_due_date;
