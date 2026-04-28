-- Migration: soft_delete_and_unit_version_refs
-- Created: 20260428135317 UTC
-- Phase: Access Model v2 Phase 0.4
--
-- WHY: Two forward-compat seams in one migration —
--   (1) soft-delete on identity tables (students, teachers, units) so a
--       deletion is reversible and downstream FKs can still resolve to
--       a tombstone row. Currently NIS pilot would need destructive
--       deletes; soft-delete unblocks audit-log reconstruction +
--       FERPA-style "right to be forgotten" via Phase 5 endpoints.
--   (2) unit_version_id FK on submission-shaped tables so a student's
--       graded work resolves to the unit content as it existed at
--       submission time, not whatever the teacher edited it to later.
--       The unit_versions table (mig 040 unit forking) already exists
--       with auto-snapshot trigger (mig 081) — this migration just
--       wires the FK reference. No new versioning system.
-- IMPACT: 3 deleted_at columns + 7 unit_version_id columns. No indexes
--   (Lesson #44 — speculative until query patterns warrant; deleted_at
--   filtering is mostly "WHERE IS NULL" which doesn't benefit from a
--   regular index, partial WHERE NOT NULL is for the rare audit query).
--   No RLS changes — column-level access matches row-level.
-- ROLLBACK: paired .down.sql drops all 10 columns. No backfill data to
--   reverse — every column ships NULL on every row.
--
-- Existing soft-delete patterns are NOT touched:
--   classes.is_archived (mig 033)
--   knowledge_items.is_archived (mig 017)
--   activity_blocks.is_archived + activity_blocks.archived_at (mig 060+072)
-- Mixed patterns (BOOLEAN flag vs TIMESTAMPTZ) — harmonisation deferred to
-- Phase 6 cutover audit (or post-pilot follow-up). Adding deleted_at
-- alongside would create a third pattern; not worth it.
--
-- No backfill. NULL is the correct semantic for both new columns:
--   deleted_at NULL = "not deleted"
--   unit_version_id NULL = "legacy submission, resolve to current unit
--                          content" — semantically equivalent to "no
--                          snapshot was taken at submission time"
-- Future submissions (Phase 5+) populate unit_version_id at write time.

-- ============================================================
-- 1. Soft-delete on identity tables
-- ============================================================

ALTER TABLE students ADD COLUMN deleted_at TIMESTAMPTZ NULL;
ALTER TABLE teachers ADD COLUMN deleted_at TIMESTAMPTZ NULL;
ALTER TABLE units    ADD COLUMN deleted_at TIMESTAMPTZ NULL;

-- ============================================================
-- 2. unit_version_id on submission-shaped tables
-- ============================================================
-- ON DELETE SET NULL — if a unit_versions row is deleted (admin cleanup),
-- the submission stays alive but loses its snapshot reference, falling
-- back to current unit content. Same pattern as classes.school_id +
-- machine_profiles.school_id.

ALTER TABLE assessment_records
  ADD COLUMN unit_version_id UUID NULL
    REFERENCES unit_versions(id) ON DELETE SET NULL;

ALTER TABLE competency_assessments
  ADD COLUMN unit_version_id UUID NULL
    REFERENCES unit_versions(id) ON DELETE SET NULL;

ALTER TABLE portfolio_entries
  ADD COLUMN unit_version_id UUID NULL
    REFERENCES unit_versions(id) ON DELETE SET NULL;

ALTER TABLE student_progress
  ADD COLUMN unit_version_id UUID NULL
    REFERENCES unit_versions(id) ON DELETE SET NULL;

ALTER TABLE gallery_submissions
  ADD COLUMN unit_version_id UUID NULL
    REFERENCES unit_versions(id) ON DELETE SET NULL;

ALTER TABLE fabrication_jobs
  ADD COLUMN unit_version_id UUID NULL
    REFERENCES unit_versions(id) ON DELETE SET NULL;

ALTER TABLE student_tool_sessions
  ADD COLUMN unit_version_id UUID NULL
    REFERENCES unit_versions(id) ON DELETE SET NULL;

-- ============================================================
-- 3. Sanity check
-- ============================================================

DO $$
DECLARE
  expected_columns TEXT[] := ARRAY[
    'students.deleted_at',
    'teachers.deleted_at',
    'units.deleted_at',
    'assessment_records.unit_version_id',
    'competency_assessments.unit_version_id',
    'portfolio_entries.unit_version_id',
    'student_progress.unit_version_id',
    'gallery_submissions.unit_version_id',
    'fabrication_jobs.unit_version_id',
    'student_tool_sessions.unit_version_id'
  ];
  pair TEXT;
  table_name_var TEXT;
  col_name TEXT;
BEGIN
  FOREACH pair IN ARRAY expected_columns LOOP
    table_name_var := split_part(pair, '.', 1);
    col_name := split_part(pair, '.', 2);
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_name = table_name_var
        AND c.column_name = col_name
    ) THEN
      RAISE EXCEPTION 'Migration soft_delete_and_unit_version_refs failed: %.% missing', table_name_var, col_name;
    END IF;
  END LOOP;
  RAISE NOTICE 'Migration soft_delete_and_unit_version_refs applied OK: 3 deleted_at + 7 unit_version_id columns added';
END $$;
