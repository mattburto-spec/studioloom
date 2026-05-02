-- Phase 4.3.y — handle_new_teacher auto-creates personal school per Decision 2
--
-- Project: Access Model v2 (mid-Phase-4 spillover hotfix)
-- Brief: docs/projects/access-model-v2-phase-4-brief.md (banner-test smoke
--        surfaced the gap when banner-test-1 hit 'Teacher missing school
--        context' on /teacher/welcome step 3)
-- Date: 2 May 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Master spec Decision 2 (signed off 25 Apr): "School entity: AUTO-CREATE
-- personal school per teacher during Phase 0 backfill. Every teacher gets
-- school_id populated from day one."
--
-- Phase 0 backfill DID this for existing teachers (Phase 0.8a created
-- personal schools for orphan teachers + class_members.lead_teacher rows).
-- BUT the handle_new_teacher trigger from 001_initial_schema (and re-fixed
-- May-1 / May-2) does NOT extend the pattern to NEW teachers signing up
-- post-Phase-0. Future teachers come in with school_id = NULL.
--
-- Surfaced 2 May 2026 during Phase 4.2 banner-test smoke. banner-test-1
-- created via Supabase Auth dashboard → handle_new_teacher trigger created
-- a teachers row with school_id = NULL. /teacher/welcome step-3 create-class
-- failed with 500 'Teacher missing school context.' Decision 2 was paper-only.
--
-- This migration extends handle_new_teacher to:
--   1. Create the teacher's personal school in the SAME transaction
--   2. Set teachers.school_id to that personal school's id
--
-- The personal school is named "{Teacher Name}'s School", country='??'
-- (unknown until teacher edits in /teacher/welcome step 1), source='auto',
-- verified=false. Teachers can later switch to a real school via the
-- welcome wizard (Bug B fix wires the PATCH) or via /teacher/settings
-- (existing route).
--
-- WHY 'auto' source: matches the existing CHECK enum if we add 'auto'.
-- Need to also extend the schools.source CHECK constraint to allow 'auto'.
-- Alternative: reuse 'user_submitted' which already exists. Going with
-- 'user_submitted' — cleaner: no constraint change, semantically correct
-- (the school was 'submitted' by the trigger acting on behalf of the
-- teacher), and Phase 4 super-admin tooling can promote to verified
-- separately if needed.
--
-- The Bug B fix on the welcome wizard (separate commit) ensures that
-- when a teacher picks a REAL school via SchoolPicker, teachers.school_id
-- gets re-PATCHed to that real school. The personal school remains in
-- the schools table as an orphan — Phase 4 super-admin tooling can clean
-- it up later (or merge it into the chosen real school).
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - Replaces public.handle_new_teacher() function definition
-- - Each NEW teacher signup now creates 1 personal school + 1 teacher row
--   in a single transaction (atomic — either both succeed or both roll back)
-- - Existing teachers unchanged (function only fires on auth.users INSERT)
-- - Idempotent — CREATE OR REPLACE FUNCTION
-- - PRESERVES Lesson #66: SET search_path locked, public.teachers qualifier
-- - PRESERVES Lesson #65: user_type='student' guard
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql restores the May-2 body (with search_path lockdown but
-- without auto-personal-school logic). Personal schools created by the
-- new trigger persist (no cascade on rollback) — that's correct, those
-- schools belong to real teachers and shouldn't be deleted.

CREATE OR REPLACE FUNCTION public.handle_new_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_teacher_name TEXT;
  v_personal_school_id UUID;
BEGIN
  -- Phase 1.1d guard (Lesson #65): student auth.users rows must not
  -- auto-create a teacher row. raw_app_meta_data->>'user_type' = 'student'
  -- is the canonical marker.
  IF (NEW.raw_app_meta_data->>'user_type') = 'student' THEN
    RETURN NEW;
  END IF;

  -- Compute teacher name once — used for both the teachers row + the
  -- personal school's name.
  v_teacher_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Phase 4.3.y — Decision 2: auto-create the personal school in the
  -- same transaction. country='ZZ' is the ISO 3166 'unknown territory'
  -- code (assigned to applications, won't collide with real countries).
  --
  -- Personal school name includes the first 8 chars of the user_id as
  -- a disambiguator — the schools table has a unique constraint on
  -- (normalized_name, country), so two teachers named "Matt" both
  -- creating "Matt's School" with country='ZZ' would collide. The 8-char
  -- suffix is short, unique, and visually marks the school as personal.
  -- Once the teacher picks a real school via /teacher/welcome step 1,
  -- the welcome wizard PATCHes teachers.school_id away from this row.
  INSERT INTO public.schools (name, city, country, source, verified, created_by)
  VALUES (
    v_teacher_name || '''s School (' || substr(NEW.id::text, 1, 8) || ')',
    NULL,
    'ZZ',
    'user_submitted',
    false,
    NEW.id
  )
  RETURNING id INTO v_personal_school_id;

  -- Schema-qualified write (Lesson #66): defence-in-depth even with
  -- search_path locked. Set school_id to the personal school we just
  -- created — so step-3 create-class and downstream school-scoped reads
  -- always have a school context to work with, even before the teacher
  -- picks a real school.
  INSERT INTO public.teachers (id, name, email, school_id)
  VALUES (
    NEW.id,
    v_teacher_name,
    NEW.email,
    v_personal_school_id
  );
  RETURN NEW;
END;
$function$;

-- Sanity check
DO $$
DECLARE
  v_def TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc
  WHERE proname = 'handle_new_teacher'
    AND pronamespace = 'public'::regnamespace;

  IF v_def NOT LIKE '%SET search_path = public, pg_temp%'
     AND v_def NOT LIKE '%SET search_path TO ''public'', ''pg_temp''%' THEN
    RAISE EXCEPTION 'Migration failed: handle_new_teacher missing search_path lockdown (Lesson #66 regression)';
  END IF;

  IF v_def NOT LIKE '%public.teachers%' THEN
    RAISE EXCEPTION 'Migration failed: handle_new_teacher not using public.teachers qualifier';
  END IF;

  IF v_def NOT LIKE '%public.schools%' THEN
    RAISE EXCEPTION 'Migration failed: handle_new_teacher not creating personal school (Decision 2)';
  END IF;

  IF v_def NOT LIKE '%user_type%' THEN
    RAISE EXCEPTION 'Migration failed: handle_new_teacher missing user_type guard (Lesson #65 regression)';
  END IF;

  RAISE NOTICE 'Migration phase_4_3_y_handle_new_teacher_auto_personal_school applied OK';
END $$;
