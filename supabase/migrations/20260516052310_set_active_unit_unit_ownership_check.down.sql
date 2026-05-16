-- Rollback for: set_active_unit_unit_ownership_check
-- Pairs with: 20260516052310_set_active_unit_unit_ownership_check.sql
--
-- WARNING: rolling back this migration RE-OPENS the privilege escalation
-- gap closed by Block C (FU-SEC-SET-ACTIVE-UNIT-MISSING-UNIT-OWNERSHIP-CHECK).
-- After this rollback runs, any authenticated teacher can call
-- set_active_unit with any unit_id (including foreign teachers' private
-- units) and attach it to one of their own classes. Only roll back if
-- you also intend to roll back 20260515220845 (the entire helper).
--
-- Restores the function body that existed BEFORE this migration:
-- single auth gate (is_teacher_of_class only), no unit-ownership check.
-- Mirrors the body shipped in migration 20260515220845.

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
