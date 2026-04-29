-- Phase 1.4 CS-1 — classes: add student self-read policy via class_students
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-14-client-switch-brief.md §4 (CS-1)
-- Date: 30 April 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Migration 001 created `classes` with ONE policy:
--
--   CREATE POLICY "Teachers manage own classes"
--     ON classes FOR ALL USING (auth.uid() = teacher_id);
--
-- No student-side policy exists. Today this works because student-facing
-- routes use the admin client (bypasses RLS). The moment Phase 1.4
-- client-switch flips a route to createServerSupabaseClient(), every
-- query like `from("classes").select(...).eq("id", classId)` returns
-- ZERO rows for an authenticated student — they have no
-- "Teachers manage own classes" match.
--
-- This blocks at minimum:
--   - /api/student/me/unit-context (reads classes directly)
--   - /api/student/units (joins to classes via PostgREST embed)
--   - Any future student route that resolves class info
--
-- Audit finding from the CS-1 brief — flagged as "❌ NO STUDENT POLICY"
-- in the supporting-table coverage map.
--
-- ───────────────────────────────────────────────────────────────────────────
-- FIX
-- ───────────────────────────────────────────────────────────────────────────
--
-- Add SELECT policy: a student can read a class iff they have a
-- class_students row joining their student record (via students.user_id
-- = auth.uid()) to that class. This is the canonical Phase-1 chain
-- (auth.uid() → students.user_id → students.id → class_students.class_id),
-- consistent with Phase 1.5 + 1.5b policies.
--
-- Indexes already in place: students.user_id (idx_students_user_id),
-- class_students.student_id (PK + index from 041), class_students.class_id
-- (PK + index from 041). Subquery is well-indexed.
--
-- INSERT/UPDATE/DELETE on classes stay teacher-only — students can't
-- modify class metadata. The existing "Teachers manage own classes"
-- policy covers all four cmds for teachers; this new policy is
-- SELECT-only and additive (Postgres RLS uses OR-semantics across
-- same-cmd policies; the teacher SELECT is unaffected).
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One new SELECT-only policy on `classes` table
-- - Existing "Teachers manage own classes" policy unaffected
-- - No data change
-- - Teacher SELECT remains unchanged (OR-semantics)

CREATE POLICY "Students read own enrolled classes"
  ON classes
  FOR SELECT
  USING (
    id IN (
      SELECT cs.class_id
      FROM class_students cs
      WHERE cs.student_id IN (
        SELECT id FROM students WHERE user_id = auth.uid()
      )
    )
  );

COMMENT ON POLICY "Students read own enrolled classes" ON classes IS
  'Phase 1.4 CS-1 — Students authenticated via Supabase Auth can SELECT classes they are enrolled in via the class_students junction. Canonical chain auth.uid() → students.user_id → class_students. INSERT/UPDATE/DELETE remain teacher-only via the "Teachers manage own classes" policy.';
