-- Phase 1.5b — class_students: parallel student-read policy via auth.uid() chain
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-1-brief.md §4.5 (additive)
-- Date: 29 April 2026 PM
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Migration 041 added "Students read own enrollments" on class_students.
-- That policy joins through `student_sessions` (the legacy custom-token
-- auth path):
--
--   CREATE POLICY "Students read own enrollments"
--     ON class_students FOR SELECT
--     USING (student_id IN (
--       SELECT ss.student_id FROM student_sessions ss
--       WHERE ss.expires_at > NOW()
--     ));
--
-- Phase 1 introduces Supabase Auth as a parallel auth path. Students
-- logged in via the new flow have `auth.uid() = students.user_id`, but
-- they don't have a row in `student_sessions` (legacy table). So the
-- existing policy returns 0 rows for them.
--
-- This adds a SECOND, parallel policy via `auth.uid()`. Postgres applies
-- RLS policies with OR semantics across same-table same-cmd policies,
-- so both auth paths grant access:
--
--   - Legacy student (student_sessions row valid)  → existing policy applies
--   - New Supabase Auth student (auth.uid() set)   → new policy applies
--
-- The legacy policy stays callable until Phase 6 deletes the
-- student_sessions table.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One new SELECT-only policy on `class_students` table
-- - Existing "Students read own enrollments" policy unaffected
-- - "Teachers manage class_students" policy unaffected
-- - No data change

CREATE POLICY "Students read own enrollments via auth.uid"
  ON class_students
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Students read own enrollments via auth.uid" ON class_students IS
  'Phase 1.5b — Parallel student-read policy via auth.uid() chain (sister to the legacy "Students read own enrollments" policy that joins through student_sessions). Both coexist via Postgres RLS OR-semantics; legacy policy is removed in Phase 6 cutover.';
