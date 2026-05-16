-- Migration: fix_handle_new_teacher_check_user_metadata_bucket
-- Created: 20260516044909 UTC
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- The 11 May handpatch (20260511085324_handpatch_handle_new_teacher_skip_
-- students_search_path) added the user_type='student' guard intended to
-- close Lesson #65 (phantom teacher rows from student auth.users INSERTs).
-- Function definition in prod is correct: guard present, search_path
-- locked, schema-qualified writes, EXCEPTION-WHEN-others.
--
-- BUT — discovered 16 May 2026 — the guard never actually fires for student
-- auth.users INSERTs because of a Supabase Auth (gotrue) timing behaviour:
-- gotrue performs the INSERT into auth.users FIRST with empty
-- raw_app_meta_data, then UPDATEs the row to set raw_app_meta_data with the
-- caller-supplied app_metadata. The AFTER INSERT trigger fires on the INSERT,
-- so the trigger sees NEW.raw_app_meta_data = '{}' and the
-- NEW.raw_app_meta_data->>'user_type' check returns NULL, never 'student'.
-- Guard misses. Row falls through to INSERT INTO public.teachers.
--
-- Diagnostic evidence (16 May 2026 prod queries):
--   Q1 — function definition is correct (handpatch landed)
--   Q2 — handpatch applied 2026-05-11 08:30 UTC per applied_migrations
--   Q3 — 53 phantom teacher rows with synthetic-email pattern, all
--        post-handpatch (earliest 2026-05-11 08:39, latest 2026-05-14 23:54)
--   Q4 — phantom auth.users rows show {user_type: 'student', ...} in
--        raw_app_meta_data AT QUERY TIME (set by gotrue's follow-up UPDATE)
--   Q5 — 0 FK references across all 17 columns pointing at teachers(id),
--        confirming phantoms are pure orphans
--
-- The fix: read BOTH metadata buckets. raw_user_meta_data IS populated in
-- the original INSERT (the sibling handle_new_user_profile trigger reads
-- raw_user_meta_data and works correctly — that's why
-- provision-student-auth-user.ts intentionally sets user_type in BOTH
-- buckets). Adding `OR (NEW.raw_user_meta_data->>'user_type') = 'student'`
-- closes the timing hole.
--
-- Sister Lessons: #65 (old triggers + new user types), #66 (search_path
-- lockdown), #83 (applied_migrations log). New Lesson #92 banked alongside
-- this migration: "trigger guards on auth.users AFTER INSERT must read
-- raw_user_meta_data, not raw_app_meta_data, because gotrue late-binds
-- app_metadata via a follow-up UPDATE the trigger does not see."
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - Replaces public.handle_new_teacher() definition. No table changes,
--   no data changes. Trigger on auth.users (named on_auth_user_created)
--   continues to point at this function via name and picks up the new
--   body automatically.
-- - Stops phantom-row creation for ALL future student auth.users inserts.
-- - Existing 53 phantom rows are NOT cleaned up here — that's a separate
--   migration (filed alongside this one) so the trigger fix can ship and
--   stop the bleeding before any data DELETE.
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql restores the 11 May handpatch body (single-bucket
-- guard). Reverting will re-open the trigger bug — every new student
-- provisioned via auth.admin.createUser will create a phantom teacher
-- row again. Do NOT roll back unless the new body is provably wrong.

CREATE OR REPLACE FUNCTION public.handle_new_teacher()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Skip student auth.users rows.
  --
  -- Read BOTH metadata buckets. gotrue late-binds raw_app_meta_data via a
  -- follow-up UPDATE the AFTER INSERT trigger does not see, so
  -- raw_app_meta_data is '{}' at trigger time. raw_user_meta_data IS
  -- populated in the original INSERT (verified — sibling
  -- handle_new_user_profile trigger relies on this and works correctly,
  -- and provision-student-auth-user.ts intentionally sets user_type in
  -- both buckets to support both reader patterns).
  --
  -- The OR is belt-and-braces: today raw_user_meta_data is the load-bearing
  -- check; raw_app_meta_data stays as a forward-compat fallback in case a
  -- future caller sets app_metadata only.
  --
  -- Lesson #65, #92.
  IF (NEW.raw_app_meta_data->>'user_type') = 'student'
     OR (NEW.raw_user_meta_data->>'user_type') = 'student' THEN
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

-- Sanity check — assert the function has all five safety properties.
DO $$
DECLARE
  v_def TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc
  WHERE proname = 'handle_new_teacher'
    AND pronamespace = 'public'::regnamespace;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Migration failed: handle_new_teacher function missing';
  END IF;

  -- Property 1: BOTH metadata buckets checked (Lesson #92 — the new bit)
  IF v_def NOT LIKE '%raw_app_meta_data->>''user_type''%' THEN
    RAISE EXCEPTION 'Migration failed: raw_app_meta_data guard missing';
  END IF;

  IF v_def NOT LIKE '%raw_user_meta_data->>''user_type''%' THEN
    RAISE EXCEPTION 'Migration failed: raw_user_meta_data guard missing (Lesson #92)';
  END IF;

  -- Property 2: schema-qualified writes (Lesson #66)
  IF v_def NOT LIKE '%public.teachers%' THEN
    RAISE EXCEPTION 'Migration failed: public.teachers schema qualifier missing (Lesson #66)';
  END IF;

  -- Property 3: search_path lockdown (Lesson #66)
  IF v_def NOT LIKE '%search_path%' THEN
    RAISE EXCEPTION 'Migration failed: SET search_path missing (Lesson #66)';
  END IF;

  -- Property 4: EXCEPTION-WHEN-others (defensive — Lesson #65 sibling)
  IF v_def NOT LIKE '%EXCEPTION%' THEN
    RAISE EXCEPTION 'Migration failed: EXCEPTION WHEN others block missing';
  END IF;

  RAISE NOTICE 'Migration fix_handle_new_teacher_check_user_metadata_bucket applied OK';
END $$;
