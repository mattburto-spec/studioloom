-- Phase 1.5b — student_progress: add student self-read policy
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-1-brief.md §4.5 (additive)
-- Date: 29 April 2026 PM
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Migration 001 created `student_progress` with one teacher-side policy:
--
--   CREATE POLICY "Teachers read student progress"
--     ON student_progress FOR SELECT
--     USING (student_id IN (
--       SELECT s.id FROM students s
--       JOIN classes c ON s.class_id = c.id
--       WHERE c.teacher_id = auth.uid()
--     ));
--
-- No student-side policy exists. Today this works because student-facing
-- routes use the admin client (bypass RLS). After Phase 1.4 client-switch,
-- those routes will fail to read progress unless we add a student policy.
--
-- ───────────────────────────────────────────────────────────────────────────
-- FIX
-- ───────────────────────────────────────────────────────────────────────────
--
-- Add SELECT policy: students can read their own progress rows via the
-- canonical auth.uid() → students.user_id → students.id chain.
--
-- INSERT/UPDATE/DELETE on student_progress stay admin-client-only for
-- now — Phase 1.4 mutation routes (Batch B) will decide per-route
-- whether to grant student INSERT via RLS or keep admin-client (the
-- mutation paths often involve cross-checks that are simpler in
-- application code than in RLS).
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One new SELECT-only policy on `student_progress` table
-- - Existing "Teachers read student progress" policy unaffected
-- - No data change

CREATE POLICY "Students read own progress"
  ON student_progress
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Students read own progress" ON student_progress IS
  'Phase 1.5b — Students authenticated via Supabase Auth can SELECT their own progress rows. INSERT/UPDATE/DELETE remain admin-client-only; per-route mutation policies decided in Phase 1.4 Batch B.';
