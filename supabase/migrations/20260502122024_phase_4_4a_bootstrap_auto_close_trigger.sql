-- Phase 4.4a — bootstrap auto-close trigger on teachers
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-4-brief.md §4 Phase 4.4 + §3.8 Q6
-- Date: 2 May 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Master spec §8.3 + §3.8 Q6: every school has a "bootstrap grace window"
-- (schools.bootstrap_expires_at). While the window is OPEN, the lone teacher
-- can apply high-stakes settings instantly (no 2-teacher confirm needed —
-- they have nobody to confirm with). The window closes by EITHER:
--
--   1. 7-day expiry (set explicitly when the school was created)
--   2. A 2nd teacher joining the school (count goes 1 → 2)
--
-- Once closed, the window does NOT reopen even if the 2nd teacher leaves
-- (Q6 sign-off — prevents invite-fire gaming). If the school becomes
-- single-teacher again, governance becomes "lone-teacher post-bootstrap"
-- mode: high-stakes proposals sit in `pending` until a 2nd teacher joins.
--
-- This migration adds an AFTER INSERT trigger on teachers that fires
-- ONCE per school, the moment the count goes 1 → 2. It sets
-- schools.bootstrap_expires_at = now() if and only if it's currently
-- NULL or in the future (i.e., the window is still open).
--
-- The Phase 4.3 governance helper (proposeSchoolSettingChange) already
-- reads schools.bootstrap_expires_at to decide effectiveTier; this trigger
-- is what closes the window in real time so subsequent proposals start
-- following the 2-tier rule.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - 1 NEW FUNCTION: public.tg_close_bootstrap_on_second_teacher()
-- - 1 NEW TRIGGER: on teachers AFTER INSERT FOR EACH ROW
-- - No schema changes, no data changes (only state changes on future inserts)
-- - Idempotent — CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER
-- - Backfills NOT needed: existing schools with 2+ teachers already past
--   the 7-day window (Phase 0 backfilled bootstrap_expires_at = now() for
--   any teacher whose school had >1 active teacher at backfill time)
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql DROPs the trigger + function. Existing
-- schools.bootstrap_expires_at values are NOT reset on rollback (no
-- harm — the window state is correct, the trigger just won't re-close
-- it on future inserts).

CREATE OR REPLACE FUNCTION public.tg_close_bootstrap_on_second_teacher()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_active_teacher_count INTEGER;
BEGIN
  -- Only fire when the new teacher is actually attached to a school
  -- (school_id NOT NULL). The handle_new_teacher trigger from Phase 4.3.y
  -- now creates a personal school per teacher, so school_id is NEVER
  -- NULL post-trigger. Guard regardless for safety.
  IF NEW.school_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip for soft-deleted teachers (deleted_at column exists per Phase
  -- 4.3.z consolidation; Loominary's soft-delete shouldn't trigger).
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Count ACTIVE teachers in this school (excluding soft-deleted).
  -- AFTER INSERT context: NEW.id is already in the table, so this counts
  -- the new teacher too.
  SELECT COUNT(*) INTO v_active_teacher_count
  FROM public.teachers
  WHERE school_id = NEW.school_id
    AND deleted_at IS NULL;

  -- Only close the bootstrap window when the count goes 1 → 2 (i.e., the
  -- count is now exactly 2). For counts >= 3 the window is already
  -- closed (or was never open if Phase 0 backfilled).
  --
  -- Q6 sign-off: once closed, NEVER reopen. This trigger ONLY closes the
  -- window — it cannot reopen one that's already past now(). Use a
  -- conditional UPDATE so we only flip the value when it's currently
  -- NULL or in the future.
  IF v_active_teacher_count = 2 THEN
    UPDATE public.schools
    SET bootstrap_expires_at = now()
    WHERE id = NEW.school_id
      AND (bootstrap_expires_at IS NULL OR bootstrap_expires_at > now());
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.tg_close_bootstrap_on_second_teacher()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tg_close_bootstrap_on_second_teacher()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.tg_close_bootstrap_on_second_teacher() IS
  'Closes schools.bootstrap_expires_at when teacher count goes 1→2. Phase 4.4a.';

-- Drop trigger if it exists (idempotent rerun support), then create
DROP TRIGGER IF EXISTS tg_teachers_close_bootstrap_on_insert ON public.teachers;

CREATE TRIGGER tg_teachers_close_bootstrap_on_insert
  AFTER INSERT ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_close_bootstrap_on_second_teacher();

-- ============================================================
-- Sanity check
-- ============================================================
DO $$
DECLARE
  v_function_exists BOOLEAN;
  v_trigger_exists BOOLEAN;
  v_def TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'tg_close_bootstrap_on_second_teacher'
      AND pronamespace = 'public'::regnamespace
  ) INTO v_function_exists;
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'Migration failed: tg_close_bootstrap_on_second_teacher function missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'tg_teachers_close_bootstrap_on_insert'
      AND tgrelid = 'public.teachers'::regclass
      AND NOT tgisinternal
  ) INTO v_trigger_exists;
  IF NOT v_trigger_exists THEN
    RAISE EXCEPTION 'Migration failed: tg_teachers_close_bootstrap_on_insert trigger missing';
  END IF;

  -- Lesson #66 belt-and-braces: confirm SET search_path is locked
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc
  WHERE proname = 'tg_close_bootstrap_on_second_teacher'
    AND pronamespace = 'public'::regnamespace;
  IF v_def NOT LIKE '%SET search_path = public, pg_temp%'
     AND v_def NOT LIKE '%SET search_path TO ''public'', ''pg_temp''%' THEN
    RAISE EXCEPTION 'Migration failed: tg_close_bootstrap_on_second_teacher missing search_path lockdown (Lesson #66)';
  END IF;

  RAISE NOTICE 'Migration phase_4_4a_bootstrap_auto_close_trigger applied OK';
END $$;
