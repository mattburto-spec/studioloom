-- Rollback for: fabrication_labs
-- Pairs with: 20260427134953_fabrication_labs.sql
-- Phase: Preflight Phase 8-1 (school-scoped lab ownership)
--
-- Reverses the up migration. Order matters: drop policies before
-- the helper function (policies reference it); drop columns
-- before the table they reference; drop the table last.
--
-- Backfill rollback is implicit — when the table goes, all
-- backfilled lab rows die with it. Source data on
-- machine_profiles / classes / teachers is preserved (we only
-- added columns, not modified existing data).

-- ============================================================
-- 1. RLS policies
-- ============================================================
DROP POLICY IF EXISTS "Teachers read same-school labs"         ON fabrication_labs;
DROP POLICY IF EXISTS "Teachers insert labs into their school" ON fabrication_labs;
DROP POLICY IF EXISTS "Teachers update same-school labs"       ON fabrication_labs;
DROP POLICY IF EXISTS "Teachers delete same-school labs"       ON fabrication_labs;

-- ============================================================
-- 2. Helper function (only safe to drop after policies are gone)
-- ============================================================
DROP FUNCTION IF EXISTS current_teacher_school_id();

-- ============================================================
-- 3. New columns on existing tables
-- ============================================================
-- Drop in reverse-add order. Indexes on these columns drop
-- automatically with the column.
ALTER TABLE teachers          DROP COLUMN IF EXISTS default_lab_id;
ALTER TABLE classes           DROP COLUMN IF EXISTS default_lab_id;
ALTER TABLE machine_profiles  DROP COLUMN IF EXISTS lab_id;

-- ============================================================
-- 4. Drop the table itself
-- ============================================================
-- CASCADE catches any objects we may have missed (shouldn't be
-- any after the explicit drops above, but defence in depth).
DROP TABLE IF EXISTS fabrication_labs CASCADE;
