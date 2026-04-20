-- Migration 100: students.fabrication_notify_email — Preflight opt-out preference
--
-- Preflight Phase 1B-1-3. One NOT NULL DEFAULT true column on the existing
-- students table. Default=true preserves backward compat (existing students
-- opt-in automatically). Student UI toggle lands Phase 1B-2.
--
-- Safety: ADD COLUMN with DEFAULT on Postgres 11+ is a metadata-only change
-- (no table rewrite). Safe on hot tables in a single transaction.
--
-- Refs:
--   - Brief:      docs/projects/preflight-phase-1b-1-brief.md (1B-1-3)
--   - Candidates: docs/projects/fabrication/migration-098-candidates.md (098e)
--   - Lessons:    #24 (idempotent guards), #45 (surgical), #51 (no DO blocks)

-- ============================================================
-- 1. ADD COLUMN (idempotent guard)
-- ============================================================

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS fabrication_notify_email BOOLEAN NOT NULL DEFAULT true;

-- ============================================================
-- 2. Column documentation
-- ============================================================

COMMENT ON COLUMN students.fabrication_notify_email IS
  'Student opt-out toggle for Preflight fabrication-job email notifications '
  '(candidate 098e). Defaults true so existing students keep receiving '
  'submission / approval / pickup emails. Phase 1B-2 adds a student-facing '
  'UI toggle; worker checks this column before dispatching notifications.';

-- ============================================================
-- 3. Post-apply verification (run as separate queries in the dashboard)
-- ============================================================
-- No DO block per Lesson #51.
--
--   -- (a) Column shape
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'students' AND column_name = 'fabrication_notify_email';
--   -- Expected 1 row: fabrication_notify_email | boolean | NO | true
--
--   -- (b) Comment present
--   SELECT pg_catalog.col_description(
--            (SELECT oid FROM pg_catalog.pg_class WHERE relname='students'),
--            (SELECT ordinal_position FROM information_schema.columns
--               WHERE table_name='students' AND column_name='fabrication_notify_email')
--          );
--   -- Expected: comment starting "Student opt-out toggle…"
--
--   -- (c) All existing students defaulted to true (backfill correctness)
--   SELECT
--     COUNT(*) FILTER (WHERE fabrication_notify_email = true)  AS opted_in,
--     COUNT(*) FILTER (WHERE fabrication_notify_email = false) AS opted_out,
--     COUNT(*)                                                  AS total
--   FROM students;
--   -- Expected: opted_in = total; opted_out = 0
--
--   -- (d) RLS unchanged — no policy added here
--   SELECT COUNT(*) FROM pg_policies WHERE tablename = 'students';
--   -- Expected: same count as before this migration (no change)
