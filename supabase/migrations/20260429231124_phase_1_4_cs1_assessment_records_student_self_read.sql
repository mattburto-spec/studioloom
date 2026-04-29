-- Phase 1.4 CS-1 — assessment_records: add student self-read policy
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-14-client-switch-brief.md §4 (CS-1)
-- Date: 30 April 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Migration 019 created `assessment_records` with two policies:
--
--   CREATE POLICY "Teachers manage assessments for their students"
--     ON assessment_records FOR ALL
--     USING (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()));
--
--   CREATE POLICY "Service role full access assessments"
--     ON assessment_records FOR ALL
--     USING (auth.role() = 'service_role');
--
-- No student-side policy exists. /api/student/grades reads this table
-- via createAdminClient() — works today only because admin client
-- bypasses RLS. Post-client-switch, students would silently get an
-- empty grades page.
--
-- Audit finding from the CS-1 brief — flagged as "❌ NO STUDENT POLICY".
--
-- ───────────────────────────────────────────────────────────────────────────
-- FIX
-- ───────────────────────────────────────────────────────────────────────────
--
-- Add SELECT policy: a student can read assessment_records rows where
-- they are the subject student (student_id matches their record),
-- AND only published (non-draft) ones. Draft assessments are
-- teacher-only — the route already filters to is_draft=false at the
-- API level; this policy enforces it at the data layer too.
--
-- Canonical chain: auth.uid() → students.user_id → students.id =
-- assessment_records.student_id. Indexed via idx_students_user_id and
-- the existing assessment_records primary key on student_id.
--
-- INSERT/UPDATE/DELETE remain teacher-only (existing policy unchanged).
-- Students cannot modify their own grades.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One new SELECT-only policy on `assessment_records` table
-- - Existing "Teachers manage assessments for their students" policy unaffected
-- - Existing "Service role full access assessments" policy unaffected
-- - Filters to is_draft=false — students see published grades only
-- - No data change

CREATE POLICY "Students read own published assessments"
  ON assessment_records
  FOR SELECT
  USING (
    is_draft = false
    AND student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Students read own published assessments" ON assessment_records IS
  'Phase 1.4 CS-1 — Students authenticated via Supabase Auth can SELECT their own published (non-draft) assessment records. Canonical chain auth.uid() → students.user_id → students.id. Drafts remain teacher-only via the "Teachers manage assessments for their students" policy.';
