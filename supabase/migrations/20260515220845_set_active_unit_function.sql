-- Migration: set_active_unit_function
-- Created: 20260515220845 UTC
--
-- WHY: The partial unique index class_units_one_active_per_class (migration
-- 20260515214045) enforces "at most one is_active=true row per class". With
-- the constraint in place, callers that blindly UPSERT is_active=true will
-- 23505-violate when a different unit is already active for the class.
-- This migration adds the atomic helper that callers must use instead:
-- public.set_active_unit(class_uuid, target_unit_uuid). It deactivates any
-- other active rows and activates the target in a single transaction, so
-- the constraint is never tripped. See docs/decisions-log.md entry "One
-- active unit per class enforced at DB level" (16 May 2026) which calls
-- out the "atomic helper that deactivates other rows in the same
-- transaction" requirement.
--
-- IMPACT: New SECURITY DEFINER function public.set_active_unit(uuid, uuid).
-- search_path locked to public, pg_temp (Lesson #64). Authorization gated
-- via public.is_teacher_of_class (existing helper, Phase 1.4 CS-2). REVOKE
-- ALL FROM PUBLIC then GRANT EXECUTE TO authenticated. Function uses
-- INSERT ON CONFLICT so callers don't need to pre-check row existence.
-- No data change. No RLS policy change.
--
-- ROLLBACK: paired .down.sql drops the function. Callers will revert to
-- direct upserts and hit 23505 on cross-unit activation. Rolling back this
-- migration without also rolling back 20260515214045 leaves the partial
-- unique index live without an atomic helper.

CREATE OR REPLACE FUNCTION public.set_active_unit(
  class_uuid uuid,
  target_unit_uuid uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Authorization: caller must be the teacher of the class.
  -- SECURITY DEFINER bypasses RLS so the gate must live in the function body.
  IF NOT public.is_teacher_of_class(class_uuid) THEN
    RAISE EXCEPTION 'set_active_unit: not teacher of class %', class_uuid
      USING ERRCODE = '42501';
  END IF;

  -- Deactivate any other active units for this class.
  -- Constraint class_units_one_active_per_class would otherwise
  -- reject the INSERT below if a different unit is currently active.
  UPDATE class_units
     SET is_active = false
   WHERE class_id = class_uuid
     AND unit_id <> target_unit_uuid
     AND is_active = true;

  -- Activate the target unit (insert the row if it doesn't exist yet).
  INSERT INTO class_units (class_id, unit_id, is_active)
  VALUES (class_uuid, target_unit_uuid, true)
  ON CONFLICT (class_id, unit_id) DO UPDATE SET is_active = true;
END;
$$;

COMMENT ON FUNCTION public.set_active_unit(uuid, uuid) IS
  'Atomically activates target_unit_uuid as the active unit for class_uuid, deactivating any other active rows. INSERT ON CONFLICT — creates the class_units row if missing. Authorization gated via is_teacher_of_class. SECURITY DEFINER + locked search_path per Lesson #64. Closes the gap created by class_units_one_active_per_class partial unique index — callers must use this RPC instead of direct is_active upserts.';

REVOKE ALL ON FUNCTION public.set_active_unit(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_unit(uuid, uuid) TO authenticated;

-- Sanity check (Lesson #66 — bake safety properties into the migration).
-- Refuses to apply if SECURITY DEFINER, search_path lockdown, or the
-- is_teacher_of_class auth gate are missing. Matches the assertion shape
-- from migration 20260502102745_phase_4_3_x_fix_handle_new_teacher_search_path.
DO $$
DECLARE
  v_def TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc
  WHERE proname = 'set_active_unit'
    AND pronamespace = 'public'::regnamespace
    AND pg_get_function_identity_arguments(oid) = 'class_uuid uuid, target_unit_uuid uuid';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Migration failed: set_active_unit(uuid, uuid) was not created';
  END IF;

  IF v_def NOT LIKE '%SECURITY DEFINER%' THEN
    RAISE EXCEPTION 'Migration failed: set_active_unit missing SECURITY DEFINER';
  END IF;

  IF v_def NOT LIKE '%SET search_path = public, pg_temp%'
     AND v_def NOT LIKE '%SET search_path TO ''public'', ''pg_temp''%' THEN
    RAISE EXCEPTION 'Migration failed: set_active_unit missing search_path lockdown';
  END IF;

  IF v_def NOT LIKE '%is_teacher_of_class(class_uuid)%' THEN
    RAISE EXCEPTION 'Migration failed: set_active_unit missing is_teacher_of_class auth gate';
  END IF;

  RAISE NOTICE 'Migration set_active_unit_function applied OK';
END $$;
