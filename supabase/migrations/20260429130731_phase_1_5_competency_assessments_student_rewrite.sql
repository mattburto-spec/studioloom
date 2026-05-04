-- Phase 1.5 — competency_assessments: rewrite student-side RLS policies
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-1-brief.md §4.5
-- Date: 29 April 2026 PM
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY (audit finding from Phase 1.5 pre-flight)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Migration 030 (new_metrics) added two student-side policies that compare
-- `student_id = auth.uid()`:
--
--   CREATE POLICY "students_read_own"
--     ON competency_assessments FOR SELECT
--     USING (student_id = auth.uid());
--
--   CREATE POLICY "students_create_self"
--     ON competency_assessments FOR INSERT
--     WITH CHECK (student_id = auth.uid() AND source = 'student_self');
--
-- These were forward-declared in Phase 0 assuming `students.id == auth.users.id`.
-- That assumption is wrong: Phase 1.1a added `students.user_id` as a SEPARATE
-- column. After Phase 1.1b backfill:
--
--   - students.id     = student PK (UUID generated at student creation)
--   - students.user_id = auth.users.id (the linked Supabase Auth identity)
--   - auth.uid()       = current auth.users.id
--
-- So `student_id = auth.uid()` compares students.id (one UUID) to
-- auth.users.id (a different UUID). They are never equal. The policy
-- has been silently denying student access since the JWT-based auth
-- ever shipped.
--
-- It "worked" until now because the legacy custom-token student auth
-- bypasses RLS (admin client, service role). The moment Phase 1.4c
-- routes start using RLS-respecting clients, these policies return
-- empty results for every student.
--
-- ───────────────────────────────────────────────────────────────────────────
-- FIX
-- ───────────────────────────────────────────────────────────────────────────
--
-- Replace the two broken policies with auth.uid()-via-students.user_id
-- chain:
--
--   USING (
--     student_id IN (
--       SELECT id FROM students WHERE user_id = auth.uid()
--     )
--   )
--
-- This evaluates: "does the current auth.users.id own a students row
-- whose id matches this competency_assessment.student_id?". Subquery
-- is fast — students.user_id is indexed (idx_students_user_id, partial
-- WHERE user_id IS NOT NULL — Phase 1.1a).
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - Replaces 2 broken policies on `competency_assessments` with corrected versions
-- - Existing "teachers_manage_observations" policy untouched
-- - No data change
-- - Service-role admin client bypasses RLS regardless of policy state
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql restores the original (broken) policies. Use only
-- if Phase 1.5 RLS shipment needs a full revert; legacy admin client
-- access keeps working regardless.

-- Drop the broken policies (idempotent — IF EXISTS guards).
DROP POLICY IF EXISTS "students_read_own" ON competency_assessments;
DROP POLICY IF EXISTS "students_create_self" ON competency_assessments;

-- Recreate with auth.uid() → students.user_id → students.id chain.

CREATE POLICY "students_read_own"
  ON competency_assessments
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "students_create_self"
  ON competency_assessments
  FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
    AND source = 'student_self'
  );

COMMENT ON POLICY "students_read_own" ON competency_assessments IS
  'Phase 1.5 — Rewritten from broken (student_id = auth.uid()) to use the auth.uid() → students.user_id → students.id chain. The original assumed students.id == auth.users.id which was never true.';
COMMENT ON POLICY "students_create_self" ON competency_assessments IS
  'Phase 1.5 — Rewritten from broken (student_id = auth.uid()) to use the auth.uid() → students.user_id → students.id chain. WITH CHECK enforces source=student_self for self-INSERTs.';
