-- Phase 3.1 — three SECURITY DEFINER permission helpers
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-3-brief.md §4 Phase 3.1 + §3.4 + §3.5
-- Date: 1 May 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Phase 0.6c + 0.7a created class_members, school_responsibilities,
-- and student_mentors with scoped RLS. Phase 0.8a backfilled
-- class_members.lead_teacher rows for every active class. The Phase 3
-- can(actor, action, resource) helper (TypeScript) needs three
-- Postgres readers to consult these tables:
--
--   has_class_role(class_id, required_role?)
--   has_school_responsibility(school_id, required_type?)
--   has_student_mentorship(student_id, required_programme?)
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY SECURITY DEFINER (Lesson #64)
-- ───────────────────────────────────────────────────────────────────────────
--
-- These helpers will eventually be called from RLS policies on adjacent
-- tables. class_members itself has RLS that joins through teachers.
-- school_responsibilities + student_mentors join through teachers and
-- students (both with RLS). Without SECURITY DEFINER, any policy that
-- calls one of these helpers risks the same recursion class as Phase
-- 1.4 CS-2 (`classes ↔ class_students` cycle, broken via
-- public.is_teacher_of_class). Pre-empting the issue here.
--
-- SECURITY DEFINER + SET search_path = public, pg_temp is the
-- standard Supabase-Postgres lockdown — Lesson #62 + the
-- is_teacher_of_class exemplar (migration 20260430015239).
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - Three new SECURITY DEFINER functions in public schema
-- - REVOKE EXECUTE FROM PUBLIC + GRANT TO authenticated, service_role
-- - No data change
-- - No existing policy uses these helpers yet — Phase 3.4 callsite
--   migration introduces consumers via the can() helper
-- - Phase 3.5 smoke verifies semantics match the master spec §2.7
--   Decision 7 (preserve verifyTeacherCanManageStudent base)
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql DROPs all three functions. No table data touched.
-- Safe to roll back any time before Phase 3.4 wires consumers; once
-- routes call can() (which calls these), rollback requires reverting
-- those routes too OR flipping auth.permission_helper_rollout = false
-- to fall back to the legacy helper path.

-- ─── 1. has_class_role ───────────────────────────────────────────────────
--
-- Returns true iff auth.uid() has an active (removed_at IS NULL)
-- class_members row for the given class_id, optionally matching
-- required_role. NULL required_role means "any role".
--
-- Default arg = NULL so callers can write either:
--   has_class_role(class_id)              -- "any role"
--   has_class_role(class_id, 'co_teacher') -- specific role

CREATE OR REPLACE FUNCTION public.has_class_role(
  _class_id UUID,
  _required_role TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_members
    WHERE class_id = _class_id
      AND member_user_id = auth.uid()
      AND removed_at IS NULL
      AND (_required_role IS NULL OR role = _required_role)
  );
$$;

COMMENT ON FUNCTION public.has_class_role(UUID, TEXT) IS
  'Phase 3.1 — returns true iff auth.uid() has an active class_members row for the given class_id, optionally matching required_role. SECURITY DEFINER bypasses class_members RLS internally so the helper is callable from policies on adjacent tables. Default required_role NULL means "any role".';

REVOKE EXECUTE ON FUNCTION public.has_class_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_class_role(UUID, TEXT) TO authenticated, service_role;

-- ─── 2. has_school_responsibility ────────────────────────────────────────
--
-- Returns true iff auth.uid() has an active (deleted_at IS NULL)
-- school_responsibilities row for the given school_id, optionally
-- matching required_type.
--
-- The teachers.id = auth.uid() join is the canonical chain — Phase 1
-- already aligned teachers.id with auth.users.id (mig 081 + Phase 0
-- backfill); auth.uid() returns auth.users.id which equals teachers.id
-- for every prod row.

CREATE OR REPLACE FUNCTION public.has_school_responsibility(
  _school_id UUID,
  _required_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM school_responsibilities
    WHERE school_id = _school_id
      AND teacher_id = auth.uid()
      AND deleted_at IS NULL
      AND (_required_type IS NULL OR responsibility_type = _required_type)
  );
$$;

COMMENT ON FUNCTION public.has_school_responsibility(UUID, TEXT) IS
  'Phase 3.1 — returns true iff auth.uid() has an active school_responsibilities row for the given school_id, optionally matching required_type. SECURITY DEFINER bypasses school_responsibilities RLS internally. Default required_type NULL means "any responsibility".';

REVOKE EXECUTE ON FUNCTION public.has_school_responsibility(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_school_responsibility(UUID, TEXT) TO authenticated, service_role;

-- ─── 3. has_student_mentorship ───────────────────────────────────────────
--
-- Returns true iff auth.uid() has an active (deleted_at IS NULL)
-- student_mentors row for the given student_id, optionally matching
-- required_programme.
--
-- mentor_user_id is FK to auth.users(id) — polymorphic-ready for
-- teacher / community_member / guardian per master spec §8.6 item 8.

CREATE OR REPLACE FUNCTION public.has_student_mentorship(
  _student_id UUID,
  _required_programme TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM student_mentors
    WHERE student_id = _student_id
      AND mentor_user_id = auth.uid()
      AND deleted_at IS NULL
      AND (_required_programme IS NULL OR programme = _required_programme)
  );
$$;

COMMENT ON FUNCTION public.has_student_mentorship(UUID, TEXT) IS
  'Phase 3.1 — returns true iff auth.uid() has an active student_mentors row for the given student_id, optionally matching required_programme. SECURITY DEFINER bypasses student_mentors RLS internally. Polymorphic mentor_user_id accepts teacher / community_member / guardian via auth.users. Default required_programme NULL means "any programme".';

REVOKE EXECUTE ON FUNCTION public.has_student_mentorship(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_student_mentorship(UUID, TEXT) TO authenticated, service_role;

-- ─── 4. Sanity check ─────────────────────────────────────────────────────

DO $$
BEGIN
  -- Existence
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_class_role'
  ) THEN
    RAISE EXCEPTION 'Migration failed: public.has_class_role missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_school_responsibility'
  ) THEN
    RAISE EXCEPTION 'Migration failed: public.has_school_responsibility missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'has_student_mentorship'
  ) THEN
    RAISE EXCEPTION 'Migration failed: public.has_student_mentorship missing';
  END IF;

  -- Phase 0.8a backfill assertion: every active class has a lead_teacher row.
  -- If any class is missing one, has_class_role returns false for the
  -- legitimate lead_teacher and locks them out. Per Phase 3 brief §8 risk row.
  IF EXISTS (
    SELECT 1 FROM classes c
    WHERE c.is_archived IS NOT TRUE
      AND c.teacher_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM class_members cm
        WHERE cm.class_id = c.id
          AND cm.role = 'lead_teacher'
          AND cm.removed_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'Phase 0.8a backfill gap: at least one active class lacks a lead_teacher class_members row. Phase 3.1 cannot proceed safely. Run scripts/access-v2/backfill-missing-lead-teachers.sql or rerun Phase 0.8a first.';
  END IF;

  RAISE NOTICE 'Migration phase_3_1_permission_helpers applied OK: 3 SECURITY DEFINER functions + Phase 0.8a backfill assertion green';
END $$;
