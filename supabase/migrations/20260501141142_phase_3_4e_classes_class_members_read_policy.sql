-- Phase 3.4e — classes SELECT policy for class_members (mid-smoke hotfix)
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-3-brief.md §4 Phase 3.4 (compressed)
-- Date: 1 May 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- THE BUG (surfaced during Phase 3.5 smoke Scenario 2)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Phase 3.4c expanded /api/teacher/dashboard to read class_members instead
-- of classes.teacher_id. The query uses a PostgREST inner-join:
--
--   .from("class_members")
--   .select("class_id, role, classes!inner(id, name, code, framework, ...)")
--   .eq("member_user_id", teacherId)
--
-- PostgREST embeds run the embedded table's RLS in the same auth context.
-- The classes table has only ONE teacher-side RLS policy from migration 001:
--
--   "Teachers manage own classes" USING (auth.uid() = teacher_id)
--
-- A co_teacher of a class they don't own (the entire point of Phase 3) has
-- a class_members row but NOT classes.teacher_id ownership. The classes!inner
-- embed evaluates classes RLS, returns NULL for the co-taught class, and
-- !inner drops the membership row → co_teacher sees only their own classes
-- on dashboard. Phase 3 capability gain doesn't surface.
--
-- Same recursion-class as Phase 1.4 CS-2 (Lesson #64): policy on table A
-- joins through table B, table B's RLS doesn't grant visibility, the join
-- returns null, the higher-level query loses rows.
--
-- ───────────────────────────────────────────────────────────────────────────
-- THE FIX
-- ───────────────────────────────────────────────────────────────────────────
--
-- Add a NEW SELECT policy on classes that grants read access to anyone
-- with an active class_members row for that class. Uses the Phase 3.1
-- has_class_role(_class_id, _required_role) SECURITY DEFINER helper —
-- which bypasses class_members RLS internally so this policy is
-- recursion-safe.
--
-- Postgres applies multiple SELECT policies via OR semantics — the new
-- policy adds visibility for class members WITHOUT removing the existing
-- "Teachers manage own classes" policy. Lead teachers continue to see
-- their classes via teacher_id; co_teachers / dept_heads / mentors /
-- lab_techs / observers see them via class_members.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One new SELECT-only policy on classes table
-- - "Teachers manage own classes" policy unaffected (covers SELECT/INSERT/
--   UPDATE/DELETE for legacy lead_teacher path)
-- - "Students read own enrolled classes" (Phase 1.4 CS-1) unaffected
-- - PostgREST classes!inner embeds now return rows for class_members
-- - No data change
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql DROPs the new policy. Co-teachers lose dashboard
-- visibility on shared classes; lead_teacher path unchanged.

CREATE POLICY "Class members read their classes"
  ON classes
  FOR SELECT
  USING (
    public.has_class_role(id)
  );

COMMENT ON POLICY "Class members read their classes" ON classes IS
  'Phase 3.4e — grants SELECT to anyone with an active class_members row for the class. Uses public.has_class_role(id) SECURITY DEFINER helper to bypass class_members RLS internally (recursion-safe). Coexists with "Teachers manage own classes" via Postgres OR-semantics — lead_teacher path unchanged. Closes the PostgREST classes!inner embed gap surfaced in Phase 3.5 smoke Scenario 2.';

-- Sanity check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'classes'
      AND policyname = 'Class members read their classes'
  ) THEN
    RAISE EXCEPTION 'Migration failed: policy "Class members read their classes" missing on classes';
  END IF;
  RAISE NOTICE 'Migration phase_3_4e_classes_class_members_read_policy applied OK';
END $$;
