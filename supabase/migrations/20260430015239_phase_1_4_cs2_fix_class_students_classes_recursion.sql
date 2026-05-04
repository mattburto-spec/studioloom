-- Phase 1.4 CS-2 hotfix #2 — break classes ↔ class_students RLS recursion
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-14-client-switch-brief.md
-- Date: 30 April 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- THE BUG (surfaced after the first hotfix landed)
-- ───────────────────────────────────────────────────────────────────────────
--
-- The first CS-2 hotfix (20260430010922) broke the students ↔ class_students
-- cycle via SECURITY DEFINER. Test2's me/support-settings then started
-- returning real data. But me/unit-context still failed:
--
--   ERROR: 42P17: infinite recursion detected in policy for relation "classes"
--
-- Different cycle, same shape:
--
--   1. SELECT FROM classes  →  RLS evaluates "Students read own enrolled
--      classes" (CS-1 added) USING `id IN (SELECT cs.class_id FROM
--      class_students cs WHERE cs.student_id IN (...))`
--   2. Subquery hits class_students  →  RLS evaluates ALL class_students
--      policies, including "Teachers manage class_students" USING
--      `class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())`
--   3. That subquery hits classes  →  RLS evaluates again  →  recursion
--
-- The teacher-side class_students policy has been there since migration
-- 041 (when class_students was created). It went unused under SSR client
-- because no student-side policy ever read classes via the same path
-- until CS-1 added "Students read own enrolled classes". Once both
-- existed, the cycle was inevitable.
--
-- ───────────────────────────────────────────────────────────────────────────
-- THE FIX — second SECURITY DEFINER helper
-- ───────────────────────────────────────────────────────────────────────────
--
-- Same pattern as the first hotfix. Extract the recursive subquery into a
-- SECURITY DEFINER function that bypasses RLS internally.
--
-- The new helper public.is_teacher_of_class(class_uuid) returns true iff
-- auth.uid() owns that class (matches the existing
-- "Teachers manage own classes" policy on classes itself, but reusable
-- across class_students, class_units, and any other table that needs to
-- check teacher-of-class membership).
--
-- ───────────────────────────────────────────────────────────────────────────
-- SCOPE
-- ───────────────────────────────────────────────────────────────────────────
--
-- This fixes the immediate classes ↔ class_students cycle. Other tables
-- with similar `class_id IN (SELECT id FROM classes WHERE teacher_id =
-- auth.uid())` patterns (class_units, student_progress, etc.) still have
-- latent recursion potential when their owner table also has a student-
-- side policy that reads classes. They'll surface as more routes switch
-- to SSR client. Tracked in FU-AV2-RLS-SECURITY-DEFINER-AUDIT (P2).
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One new SECURITY DEFINER function: public.is_teacher_of_class(uuid)
-- - "Teachers manage class_students" policy DROPPED + RECREATED to use it
-- - Same semantic as before (teacher access to enrollments in their classes)
-- - No data change

-- ─── 1. SECURITY DEFINER helper ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_teacher_of_class(class_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM classes
    WHERE id = class_uuid AND teacher_id = auth.uid()
  )
$$;

COMMENT ON FUNCTION public.is_teacher_of_class(uuid) IS
  'Phase 1.4 CS-2 — breaks classes <-> class_students RLS recursion. Returns true iff auth.uid() owns the class. SECURITY DEFINER bypasses RLS on classes when called from another tables policy. Reusable for any table that needs teacher-of-class checks.';

REVOKE EXECUTE ON FUNCTION public.is_teacher_of_class(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid) TO authenticated;

-- ─── 2. Rewrite "Teachers manage class_students" to use the helper ───────

DROP POLICY "Teachers manage class_students" ON class_students;

CREATE POLICY "Teachers manage class_students"
  ON class_students
  FOR ALL
  USING (public.is_teacher_of_class(class_id))
  WITH CHECK (public.is_teacher_of_class(class_id));

COMMENT ON POLICY "Teachers manage class_students" ON class_students IS
  'Phase 1.4 CS-2 hotfix #2 — rewritten 30 Apr 2026. Uses SECURITY DEFINER helper public.is_teacher_of_class(class_id) instead of inlined subquery into classes. Breaks the classes <-> class_students recursion cycle.';
