-- Migration: handpatch_handle_new_teacher_skip_students_search_path
-- Created: 20260511085324 UTC
--
-- WHY: Production was running migration-001's original `handle_new_teacher`
-- function (unqualified `teachers`, no `SET search_path`, no `EXCEPTION
-- WHEN others`). The Access v2 migrations that fixed this
-- (20260501103415 + 20260502102745 + 20260502105711) were never applied
-- to prod — part of the still-open FU-PROD-MIGRATION-BACKLOG-AUDIT (P1).
-- The bug bit on 11 May 2026 when a teacher tried to add a student via
-- /teacher/classes/[classId]: every auth.users INSERT (since Phase 1.1d
-- shipped on 29 April) was hitting `ERROR: relation "teachers" does not
-- exist` because Supabase Auth's connection runs without `public` in
-- search_path. The error propagated up through provisionStudentAuthUser →
-- the route returned 500 → the UI silently swallowed it.
--
-- This migration codifies the SQL that was applied to prod by hand on
-- 11 May 2026 to unblock student creation. It is the same body as
-- migration 20260502105711_phase_4_3_y minus the auto-personal-school
-- INSERT (which depends on other Access v2 migrations not yet in prod).
-- A future audit-close migration can extend this to add the personal-
-- school behaviour once the schools entity work is reconciled.
--
-- The function:
--   1. Skips student auth.users rows (Lesson #65) via the
--      raw_app_meta_data->>'user_type'='student' guard.
--   2. Uses fully-qualified public.teachers (Lesson #66) so it works
--      even if the caller's search_path lacks `public`.
--   3. SET search_path = public, pg_temp on the function definition
--      itself (defence in depth).
--   4. EXCEPTION WHEN others to ensure no future trigger failure can
--      propagate out of auth.users INSERT and block student/teacher
--      creation at the API surface again.
--
-- IMPACT: replaces public.handle_new_teacher() definition. No table
-- changes, no data changes. Trigger on auth.users (named
-- `on_auth_user_created`) continues to point at this function via name
-- and picks up the new body automatically.
--
-- ROLLBACK: paired .down.sql restores migration-001's buggy version.
-- This will re-break student INSERTs and email/password teacher signups,
-- but the down path exists for completeness. Do not run unless you have
-- a specific reason to revert.
--
-- HISTORY:
--   - 11 May 2026 ~08:30 UTC: SQL applied by hand to prod via Supabase
--     SQL Editor after diagnostic session with Claude. Verified fix by
--     successful student creation via /teacher/classes/[classId] modal.
--   - 11 May 2026 ~08:53 UTC: this migration file checked in to repo
--     so the repo state matches what's deployed.

CREATE OR REPLACE FUNCTION public.handle_new_teacher()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Skip student auth.users rows (Lesson #65)
  IF (NEW.raw_app_meta_data->>'user_type') = 'student' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.teachers (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email::text, '@', 1)),
    NEW.email::text
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'handle_new_teacher failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Sanity check — assert the function has all four safety properties
-- the WHY block above promises.
DO $$
DECLARE
  v_def TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc
  WHERE proname = 'handle_new_teacher'
    AND pronamespace = 'public'::regnamespace;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Migration handpatch failed: handle_new_teacher function missing';
  END IF;

  IF v_def NOT LIKE '%user_type%' THEN
    RAISE EXCEPTION 'Migration handpatch failed: user_type guard missing (Lesson #65)';
  END IF;

  IF v_def NOT LIKE '%public.teachers%' THEN
    RAISE EXCEPTION 'Migration handpatch failed: public.teachers schema qualifier missing (Lesson #66)';
  END IF;

  IF v_def NOT LIKE '%search_path%' THEN
    RAISE EXCEPTION 'Migration handpatch failed: SET search_path missing';
  END IF;

  IF v_def NOT LIKE '%EXCEPTION%' THEN
    RAISE EXCEPTION 'Migration handpatch failed: EXCEPTION WHEN others block missing';
  END IF;

  RAISE NOTICE 'Migration handpatch_handle_new_teacher_skip_students_search_path applied OK';
END $$;
