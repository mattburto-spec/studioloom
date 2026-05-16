-- Migration: set_active_unit_unit_ownership_check
-- Created: 20260516052310 UTC
--
-- WHY: Closes FU-SEC-SET-ACTIVE-UNIT-MISSING-UNIT-OWNERSHIP-CHECK (P1 in
-- docs/security/security-plan.md). The function `public.set_active_unit`
-- shipped in migration 20260515220845 only checks `is_teacher_of_class`
-- on the target class. It does NOT check anything about target_unit_uuid,
-- so any authenticated teacher can attach any unit_id (including foreign
-- teachers' un-published private units) to one of their own classes,
-- bypassing the fork flow + fork_count attribution + publish gate. This
-- migration adds a SECOND auth gate inside the function body, between
-- the existing is_teacher_of_class check and the deactivate-others
-- UPDATE. Design choice (Cowork sign-off, Block C brief): Option B —
-- caller must own the target unit (units.author_teacher_id = auth.uid())
-- OR the unit must be marked is_published = true. Matches the existing
-- fork-from-library affordance: published units in the library can be
-- attached directly; private/unpublished units owned by other teachers
-- are blocked.
--
-- IMPACT: CREATE OR REPLACE FUNCTION public.set_active_unit(uuid, uuid)
-- preserving the existing signature, SECURITY DEFINER, search_path
-- lockdown, REVOKE/GRANT, and INSERT-ON-CONFLICT mutation shape. Adds
-- one new IF NOT EXISTS block + one extended COMMENT + extended Lesson
-- #66 sanity DO-block. No new schema, no new RLS, no app-code change
-- (the wrapper's discriminated-union return surfaces SQLSTATE 42501
-- regardless of which gate fires; the existing toast text covers both).
-- No new columns or indexes touched.
--
-- ROLLBACK: paired .down.sql restores the prior function body (single
-- auth gate only). Idempotent CREATE OR REPLACE — no DROP. Rolling back
-- this migration without rolling back 20260515220845 leaves the
-- function in its prior state with the privilege gap re-opened.

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
  -- Authorization gate 1: caller must be the teacher of the class.
  -- SECURITY DEFINER bypasses RLS so the gate must live in the function body.
  IF NOT public.is_teacher_of_class(class_uuid) THEN
    RAISE EXCEPTION 'set_active_unit: not teacher of class %', class_uuid
      USING ERRCODE = '42501';
  END IF;

  -- Authorization gate 2 (Block C, FU-SEC-SET-ACTIVE-UNIT-MISSING-UNIT-OWNERSHIP-CHECK):
  -- caller must own the target unit OR the unit must be published.
  -- Without this gate, any teacher could attach any unit_id (including
  -- foreign teachers' private units) to one of their own classes,
  -- bypassing the fork flow + fork_count attribution + publish gate.
  -- Option B per Cowork sign-off: authored-or-published.
  IF NOT EXISTS (
    SELECT 1 FROM units
     WHERE id = target_unit_uuid
       AND (author_teacher_id = auth.uid() OR is_published = true)
  ) THEN
    RAISE EXCEPTION 'set_active_unit: cannot attach unit % (caller does not own it and it is not published)', target_unit_uuid
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
  'Atomically activates target_unit_uuid as the active unit for class_uuid, deactivating any other active rows. INSERT ON CONFLICT — creates the class_units row if missing. Two-gate authorization: (1) caller must be teacher of the class via is_teacher_of_class, (2) caller must own the target unit (author_teacher_id = auth.uid()) OR the unit must be published (is_published = true). Both gates raise 42501 on failure. SECURITY DEFINER + locked search_path per Lesson #64. Closes the gap created by class_units_one_active_per_class partial unique index — callers must use this RPC instead of direct is_active upserts. Gate 2 added by FU-SEC-SET-ACTIVE-UNIT-MISSING-UNIT-OWNERSHIP-CHECK (Block C, 16 May 2026).';

REVOKE ALL ON FUNCTION public.set_active_unit(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_unit(uuid, uuid) TO authenticated;

-- Sanity check (Lesson #66 — bake safety properties into the migration).
-- Refuses to apply if SECURITY DEFINER, search_path lockdown, the
-- is_teacher_of_class auth gate, or the new unit-ownership gate are
-- missing. Matches the assertion shape from migration
-- 20260502102745_phase_4_3_x_fix_handle_new_teacher_search_path.
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
    RAISE EXCEPTION 'Migration failed: set_active_unit missing is_teacher_of_class auth gate (gate 1)';
  END IF;

  -- Block C: assert the new unit-ownership gate is present in pg_get_functiondef.
  -- Three independent assertions cover the three load-bearing pieces of the
  -- IF NOT EXISTS subquery — if any one is missing the gate is broken.
  IF v_def NOT LIKE '%author_teacher_id = auth.uid()%' THEN
    RAISE EXCEPTION 'Migration failed: set_active_unit missing unit-ownership gate (author_teacher_id check)';
  END IF;

  IF v_def NOT LIKE '%is_published = true%' THEN
    RAISE EXCEPTION 'Migration failed: set_active_unit missing unit-ownership gate (is_published clause)';
  END IF;

  IF v_def NOT LIKE '%cannot attach unit%' THEN
    RAISE EXCEPTION 'Migration failed: set_active_unit missing unit-ownership gate (RAISE EXCEPTION message)';
  END IF;

  RAISE NOTICE 'Migration set_active_unit_unit_ownership_check applied OK';
END $$;
