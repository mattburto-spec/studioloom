-- Rollback for: phase_4_9_dept_head_triggers
-- Pairs with: 20260502233618_phase_4_9_dept_head_triggers.sql
--
-- Refuses if any auto_dept_head class_members rows or active dept_head
-- responsibilities exist (would lose the auto-tag mapping). Also
-- restores school_responsibilities CHECK to the 8-value enum from
-- Phase 4.7b-1 (without dept_head).

DO $$
DECLARE
  v_auto_count INT;
  v_dept_head_resp_count INT;
BEGIN
  SELECT COUNT(*) INTO v_auto_count
  FROM class_members
  WHERE source = 'auto_dept_head' AND removed_at IS NULL;
  IF v_auto_count > 0 THEN
    RAISE EXCEPTION 'Rollback aborted: % active auto_dept_head class_members '
                    'rows exist (revoke responsibilities first).',
                    v_auto_count;
  END IF;

  SELECT COUNT(*) INTO v_dept_head_resp_count
  FROM school_responsibilities
  WHERE responsibility_type = 'dept_head' AND deleted_at IS NULL;
  IF v_dept_head_resp_count > 0 THEN
    RAISE EXCEPTION 'Rollback aborted: % active dept_head responsibilities '
                    'exist (soft-delete them first).',
                    v_dept_head_resp_count;
  END IF;
END $$;

-- 1. Drop triggers + functions
DROP TRIGGER IF EXISTS tg_classes_resync_dept_heads_on_department_change ON classes;
DROP TRIGGER IF EXISTS tg_classes_auto_tag_dept_heads_on_insert ON classes;
DROP TRIGGER IF EXISTS tg_school_responsibility_dept_head_revoke ON school_responsibilities;
DROP TRIGGER IF EXISTS tg_school_responsibility_dept_head_insert ON school_responsibilities;

DROP FUNCTION IF EXISTS public.tg_resync_class_members_on_department_change();
DROP FUNCTION IF EXISTS public.tg_auto_tag_dept_head_on_class_insert();
DROP FUNCTION IF EXISTS public.tg_remove_dept_head_class_members_on_revoke();
DROP FUNCTION IF EXISTS public.tg_auto_tag_dept_head_on_responsibility_insert();

-- 2. Restore school_responsibilities CHECK enum to Phase 4.7b-1 state (8 values)
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
    'safeguarding_lead',
    'school_admin'
  ));

-- 3. Drop columns + indexes
DROP INDEX IF EXISTS idx_classes_school_dept;
ALTER TABLE classes DROP COLUMN IF EXISTS department;

ALTER TABLE school_responsibilities DROP COLUMN IF EXISTS department;

DROP INDEX IF EXISTS idx_class_members_source_auto_dept_head;
ALTER TABLE class_members DROP COLUMN IF EXISTS source;
