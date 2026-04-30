-- Phase 1.4 CS-2 hotfix — break students ↔ class_students RLS recursion
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-14-client-switch-brief.md
-- Date: 30 April 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- THE BUG (surfaced via Phase 1.4 CS-2 prod smoke)
-- ───────────────────────────────────────────────────────────────────────────
--
-- After CS-2 switched two routes to the RLS-respecting SSR client, queries
-- against students started failing with:
--
--   ERROR: 42P17: infinite recursion detected in policy for relation "students"
--
-- The recursion cycle:
--
--   1. SELECT * FROM students  →  RLS evaluates ALL policies (OR-combined)
--   2. "Teachers manage students" USING clause has subquery:
--        id IN (SELECT cs.student_id FROM class_students cs JOIN classes c
--               ON cs.class_id = c.id WHERE c.teacher_id = auth.uid())
--   3. Postgres evaluates that subquery → triggers RLS on class_students
--   4. Phase 1.5b's "Students read own enrollments via auth.uid" policy on
--      class_students has its own subquery:
--        student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
--   5. That triggers RLS on students → BACK TO STEP 1 → recursion
--
-- This was always a latent bug in our Phase 1.5/1.5b/CS-1 policies. Every
-- prior test used createAdminClient() (RLS bypass), so the cycle never
-- evaluated. CS-2 is the first time SSR client touches RLS-enforced
-- students policies — recursion fires immediately.
--
-- ───────────────────────────────────────────────────────────────────────────
-- THE FIX — SECURITY DEFINER helper function
-- ───────────────────────────────────────────────────────────────────────────
--
-- The standard Supabase pattern for cross-table RLS subqueries: wrap the
-- recursive logic in a SECURITY DEFINER function. The function runs as
-- its owner (postgres role) which bypasses RLS on the tables it queries
-- internally. The cycle breaks because the inner class_students lookup
-- inside the function does NOT re-trigger RLS.
--
-- We rewrite "Teachers manage students" to call is_teacher_of_student(id)
-- instead of inlining the subquery. The semantic is identical — a teacher
-- can manage a student iff:
--   (a) the student's class belongs to the teacher (legacy class_id), OR
--   (b) the teacher authored the student row, OR
--   (c) the student is enrolled (via class_students junction) in any
--       class the teacher owns.
--
-- ───────────────────────────────────────────────────────────────────────────
-- SCOPE
-- ───────────────────────────────────────────────────────────────────────────
--
-- This fixes the immediate students ↔ class_students cycle (the one CS-2
-- hit). Other Phase 1.5/1.5b/CS-1 policies that contain
-- `... IN (SELECT id FROM students WHERE user_id = auth.uid())` subqueries
-- still have latent recursion potential when called from contexts where
-- students RLS triggers re-entry. They'll surface as we switch more
-- routes to SSR client. Filed as FU-AV2-RLS-SECURITY-DEFINER-AUDIT (P2)
-- to do a comprehensive sweep.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One new SECURITY DEFINER function: public.is_teacher_of_student(uuid)
-- - "Teachers manage students" policy DROPPED + RECREATED to use the function
-- - Same semantic as before (teacher access to their students)
-- - Function ownership: postgres (default for migrations); EXECUTE granted
--   to authenticated role only
-- - No data change

-- ─── 1. SECURITY DEFINER helper ───────────────────────────────────────────
-- Returns true iff the current auth.uid() is a teacher who has access to
-- the given student via any of the three legacy + new paths.

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(student_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = student_uuid
      AND (
        s.class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())
        OR s.author_teacher_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM class_students cs
          JOIN classes c ON cs.class_id = c.id
          WHERE cs.student_id = s.id AND c.teacher_id = auth.uid()
        )
      )
  )
$$;

COMMENT ON FUNCTION public.is_teacher_of_student(uuid) IS
  'Phase 1.4 CS-2 — breaks students <-> class_students RLS recursion. Returns true iff auth.uid() is a teacher with access to the given student via legacy class_id, author_teacher_id, or class_students junction. SECURITY DEFINER bypasses RLS on the tables this function queries internally.';

-- Lock down execute privileges. authenticated role is the only caller
-- (SSR client + RLS context). PUBLIC has no execute by default after
-- REVOKE; GRANT explicitly to authenticated.
REVOKE EXECUTE ON FUNCTION public.is_teacher_of_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_student(uuid) TO authenticated;

-- ─── 2. Rewrite "Teachers manage students" to use the helper ──────────────

DROP POLICY "Teachers manage students" ON students;

CREATE POLICY "Teachers manage students"
  ON students
  FOR ALL
  USING (public.is_teacher_of_student(id))
  WITH CHECK (public.is_teacher_of_student(id));

COMMENT ON POLICY "Teachers manage students" ON students IS
  'Phase 1.4 CS-2 — rewritten 30 Apr 2026. Uses SECURITY DEFINER helper public.is_teacher_of_student(id) instead of inlined subquery. Breaks the students <-> class_students RLS recursion cycle. Semantic identical to original.';
