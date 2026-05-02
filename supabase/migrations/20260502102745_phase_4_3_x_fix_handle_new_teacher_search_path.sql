-- Phase 4.3.x — fix handle_new_teacher search_path + qualified table reference
--
-- Project: Access Model v2 (mid-Phase-4 spillover hotfix)
-- Brief: docs/projects/access-model-v2-phase-4-brief.md (Phase 4.2 banner-test
--        smoke surfaced the regression)
-- Date: 2 May 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- The May-1 rewrite migration `20260501103415_fix_handle_new_teacher_skip_students.sql`
-- — which added the `user_type='student'` guard to fix the phantom-rows
-- bug (Lesson #65) — accidentally dropped two safety properties from the
-- function:
--
--   1. SET search_path = public, pg_temp  — REQUIRED for SECURITY DEFINER
--      functions to reliably resolve unqualified table names. Without it,
--      the function inherits the search_path of the calling session.
--      Supabase Auth's INSERT context does NOT include public in the
--      default search_path, so `INSERT INTO teachers (...)` failed with
--      `ERROR: relation "teachers" does not exist`.
--
--   2. Schema-qualified table reference (public.teachers) — defence-in-depth
--      even with search_path locked.
--
-- Surfaced 2 May 2026 during Phase 4.2 banner-test smoke when Matt tried to
-- create a fresh test teacher via the Supabase Auth dashboard and got
-- "Database error creating new user" with the underlying Postgres log
-- showing `relation "teachers" does not exist` for every email/password
-- signup attempt.
--
-- This migration RESTORES both properties. Same body as the May-1 fix +
-- the two safety lines re-applied.
--
-- Lesson #64 sibling: SECURITY DEFINER rewrites MUST re-apply search_path
-- lockdown. The original 001-era function had it; the May-1 rewrite
-- stripped it inadvertently. Same family of bugs as the policies-can-claim-
-- correctness pattern. Filed as Lesson candidate #66 in lessons-learned.md.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - Replaces public.handle_new_teacher() function definition (CREATE OR REPLACE)
-- - No schema changes; no data changes
-- - Fixes ALL email/password teacher signups (failing in prod since 1 May)
-- - Idempotent — safe to run multiple times
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql restores the May-1 (broken) body. NOT RECOMMENDED to
-- roll back — that body breaks teacher signup. Only useful if a future
-- regression appears and we need to bisect.

CREATE OR REPLACE FUNCTION public.handle_new_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- Phase 1.1d guard (preserved from May-1 fix): student auth.users rows
  -- (provisioned via provision-student-auth-user.ts) must not auto-create
  -- a teacher row. raw_app_meta_data->>'user_type' = 'student' is the
  -- canonical marker.
  IF (NEW.raw_app_meta_data->>'user_type') = 'student' THEN
    RETURN NEW;
  END IF;

  -- Schema-qualified write: defence-in-depth even with search_path locked.
  -- COALESCE prefers explicit raw_user_meta_data.name (set by invite
  -- flows + signup forms); falls back to the email's local-part.
  INSERT INTO public.teachers (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
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
    RAISE EXCEPTION 'Migration failed: handle_new_teacher missing search_path lockdown';
  END IF;

  IF v_def NOT LIKE '%public.teachers%' THEN
    RAISE EXCEPTION 'Migration failed: handle_new_teacher not using public.teachers qualifier';
  END IF;

  RAISE NOTICE 'Migration phase_4_3_x_fix_handle_new_teacher_search_path applied OK';
END $$;
