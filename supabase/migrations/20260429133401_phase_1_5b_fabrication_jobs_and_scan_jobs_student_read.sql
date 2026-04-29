-- Phase 1.5b — fabrication_jobs + fabrication_scan_jobs: student self-read
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-1-brief.md §4.5 (additive)
-- Date: 29 April 2026 PM
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- `fabrication_jobs` (mig 095) is the parent table; `fabrication_scan_jobs`
-- (mig 096) is the worker queue. Both have RLS enabled. fabrication_jobs
-- has teacher-side policies (`fabrication_jobs_select_teacher`,
-- `fabrication_jobs_update_teacher`); fabrication_scan_jobs is
-- `rls_enabled_no_policy` per scanner-reports/rls-coverage.json (one of
-- the FU-FF-class drifts).
--
-- Students currently access these via the admin client. Once Phase 1.4
-- Preflight student routes switch to RLS-respecting clients, students
-- need self-read policies on both tables.
--
-- Schema chain:
--   fabrication_scan_jobs.job_revision_id
--     → fabrication_job_revisions.id
--       (.job_id → fabrication_jobs.id)
--   fabrication_jobs.student_id → students.id
--   students.user_id → auth.users.id
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One new SELECT-only policy on `fabrication_jobs` (canonical auth.uid() chain)
-- - One new SELECT-only policy on `fabrication_scan_jobs` (joins through
--   fabrication_job_revisions + fabrication_jobs to reach the student_id)
-- - Existing teacher-side policies on fabrication_jobs unaffected
-- - No data change
--
-- Triple-nested subquery on fabrication_scan_jobs has overhead, but:
--   - students rarely query scan_jobs directly (denormalised status fields
--     on fabrication_jobs cover most use cases)
--   - student route loads typically pull <50 rows
--   - all FK columns are indexed (job_revision_id, job_id, student_id, user_id)
-- Acceptable for v1; revisit if profiling shows hot path.
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql drops both policies. Safe — admin-client paths still work.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. fabrication_jobs — student self-read
-- ───────────────────────────────────────────────────────────────────────────

CREATE POLICY fabrication_jobs_select_student
  ON fabrication_jobs
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY fabrication_jobs_select_student ON fabrication_jobs IS
  'Phase 1.5b — Students can SELECT their own fabrication jobs via auth.uid() → students.user_id → students.id chain.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. fabrication_scan_jobs — student self-read (closes one rls-coverage drift)
-- ───────────────────────────────────────────────────────────────────────────

CREATE POLICY fabrication_scan_jobs_select_student
  ON fabrication_scan_jobs
  FOR SELECT
  USING (
    job_revision_id IN (
      SELECT jr.id FROM fabrication_job_revisions jr
      JOIN fabrication_jobs fj ON fj.id = jr.job_id
      WHERE fj.student_id IN (
        SELECT id FROM students WHERE user_id = auth.uid()
      )
    )
  );

COMMENT ON POLICY fabrication_scan_jobs_select_student ON fabrication_scan_jobs IS
  'Phase 1.5b — Students can SELECT scan jobs for their own fabrication jobs (joins through fabrication_job_revisions + fabrication_jobs). Closes one rls-coverage drift entry.';
