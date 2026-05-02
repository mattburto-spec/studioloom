-- Rollback for: phase_4_7b_1_school_admin_role
-- Pairs with: 20260502215604_phase_4_7b_1_school_admin_role.sql
--
-- ROLLBACK ORDER:
--   1. Drop INSERT policy
--   2. Drop helper functions
--   3. Restore original CHECK enum (without 'school_admin')
--      → REFUSES if any school_admin rows exist (would create
--        constraint-violating data). Use cleanup script first.
--
-- This rollback is intended for fresh-prod / pre-grant scenarios. If
-- school_admin rows exist when rollback runs, the safety check below
-- raises and aborts. To force rollback: DELETE the school_admin rows
-- first (with audit_events row noting the manual cleanup).

-- 1. INSERT policy
DROP POLICY IF EXISTS "school_responsibilities_school_admin_insert_gate"
  ON school_responsibilities;

-- 2. Helper functions
DROP FUNCTION IF EXISTS public.can_grant_school_admin(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_school_admin(UUID, UUID);

-- 3. Safety check before reverting CHECK enum
DO $$
DECLARE
  v_school_admin_count INT;
BEGIN
  SELECT COUNT(*) INTO v_school_admin_count
  FROM school_responsibilities
  WHERE responsibility_type = 'school_admin'
    AND deleted_at IS NULL;

  IF v_school_admin_count > 0 THEN
    RAISE EXCEPTION 'Rollback aborted: % active school_admin row(s) exist. '
                    'Delete or soft-delete them before reverting the CHECK enum.',
                    v_school_admin_count;
  END IF;
END $$;

-- 3b. Revert CHECK enum to original 7-value list
ALTER TABLE school_responsibilities
  DROP CONSTRAINT IF EXISTS school_responsibilities_responsibility_type_check;

ALTER TABLE school_responsibilities
  ADD CONSTRAINT school_responsibilities_responsibility_type_check
  CHECK (responsibility_type IN (
    'pp_coordinator',
    'pyp_coordinator',
    'cas_coordinator',
    'myp_coordinator',
    'dp_coordinator',
    'service_coordinator',
    'safeguarding_lead'
  ));
