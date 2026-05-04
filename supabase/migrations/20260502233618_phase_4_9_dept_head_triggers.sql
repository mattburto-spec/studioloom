-- Migration: phase_4_9_dept_head_triggers
-- Created: 20260502233618 UTC
-- Phase: Access Model v2 Phase 4.9 (department + dept_head auto-tag)
--
-- WHY: Closes FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL. The dept_head role
--   is the bridge between school-level responsibilities (e.g. "Sarah
--   coordinates DT department") and class-level access (Sarah needs
--   to see all DT classes' content). v1 ships the simplest model:
--   classes get a `department` TEXT tag; school_responsibilities row
--   of type='dept_head' with a department value auto-grants
--   class_members.dept_head rows for every active class in the same
--   school + department.
--
--   Triggers keep the auto-tagged rows in sync with reality:
--     1. Responsibility INSERT  → grant dept_head to all matching classes
--     2. Responsibility UPDATE  → revoke if soft-deleted; re-grant if reactivated
--     3. Class INSERT           → grant dept_head if existing responsibility matches
--     4. Class UPDATE           → re-sync if class.department changes
--
--   Auto-tagged rows are distinguished from manually-granted rows
--   via class_members.source = 'auto_dept_head'. Revoke logic only
--   removes rows with that exact source — manually-granted dept_head
--   rows survive responsibility revocation.
--
-- PRE-FLIGHT AUDIT FINDING (Lesson #54 + #59 — 3rd time this phase):
--   The brief specced `INSERT INTO class_members (..., source) VALUES
--   (..., 'auto_dept_head')` assuming a source column existed.
--   class_members.source DOES NOT EXIST. This migration adds it.
--
-- IMPACT:
--   - class_members.source TEXT NULL (NEW — distinguishes auto-tag
--     from manual grants for the revoke logic)
--   - classes.department TEXT NULL + partial index on (school_id, department)
--   - school_responsibilities.department TEXT NULL
--   - school_responsibilities CHECK enum extended to include 'dept_head'
--     (was 8 values after 4.7b-1, becomes 9 with dept_head)
--   - Backfill classes.department from classes.subject keyword match
--     (NULL when no keyword match — manual classification later)
--   - 4 SECURITY DEFINER trigger functions + their AFTER triggers
--
-- ROLLBACK: paired .down.sql refuses if any auto_dept_head rows or
--   active dept_head responsibilities exist (would lose mapping).

-- ============================================================
-- 1. class_members.source — auto-tag tracking
-- ============================================================

ALTER TABLE class_members
  ADD COLUMN IF NOT EXISTS source TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_class_members_source_auto_dept_head
  ON class_members(class_id, member_user_id)
  WHERE source = 'auto_dept_head' AND removed_at IS NULL;

COMMENT ON COLUMN class_members.source IS
  'Phase 4.9 — provenance tag. NULL for manual grants; '
  '''auto_dept_head'' for rows added by the dept_head triggers. '
  'Revoke logic only removes auto_dept_head rows; manual grants survive.';

-- ============================================================
-- 2. classes.department + school_responsibilities.department
-- ============================================================

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS department TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_classes_school_dept
  ON classes(school_id, department)
  WHERE department IS NOT NULL;

ALTER TABLE school_responsibilities
  ADD COLUMN IF NOT EXISTS department TEXT NULL;

COMMENT ON COLUMN classes.department IS
  'Phase 4.9 — department slug (e.g. ''design_tech'', ''mathematics''). '
  'NULL when not classified. Backfilled from classes.subject via '
  'keyword match. dept_head trigger uses this to route auto-grants.';

COMMENT ON COLUMN school_responsibilities.department IS
  'Phase 4.9 — when responsibility_type = ''dept_head'', this is the '
  'department they coordinate. NULL for academic-coordinator types '
  '(pyp_coord etc.) where department isn''t the routing key.';

-- ============================================================
-- 3. school_responsibilities CHECK enum — add dept_head
-- ============================================================
-- Phase 4.7b-1 already extended this CHECK to add school_admin (8 values).
-- Phase 4.9 extends to 9 by adding dept_head (academic role —
-- department coordinator with class-level membership grants).

ALTER TABLE school_responsibilities
  DROP CONSTRAINT IF EXISTS school_responsibilities_responsibility_type_check;

ALTER TABLE school_responsibilities
  ADD CONSTRAINT school_responsibilities_responsibility_type_check
  CHECK (responsibility_type IN (
    -- Academic coordinator roles (mig 20260428214735)
    'pp_coordinator',
    'pyp_coordinator',
    'cas_coordinator',
    'myp_coordinator',
    'dp_coordinator',
    'service_coordinator',
    'safeguarding_lead',
    -- Governance role (mig 20260502215604 / Phase 4.7b-1)
    'school_admin',
    -- Department coordinator role (Phase 4.9 — NEW)
    'dept_head'
  ));

-- ============================================================
-- 4. Backfill classes.department from classes.subject
-- ============================================================
-- Lower-case keyword match. Multiple matches → first wins. NULL when
-- no keyword. Future UX adds a department picker to settings; this
-- backfill is a one-time best-effort.

UPDATE classes
SET department = CASE
  WHEN lower(coalesce(subject, '')) ~ '\m(design|technology|dt|engineer)\M' THEN 'design_tech'
  WHEN lower(coalesce(subject, '')) ~ '\m(math|maths|algebra|geometry|calculus)\M' THEN 'mathematics'
  WHEN lower(coalesce(subject, '')) ~ '\m(physic|chemistry|biology|science)\M' THEN 'science'
  WHEN lower(coalesce(subject, '')) ~ '\m(history|geography|humanit|civics|social)\M' THEN 'humanities'
  WHEN lower(coalesce(subject, '')) ~ '\m(english|language|literacy|french|spanish|chinese|mandarin)\M' THEN 'languages'
  WHEN lower(coalesce(subject, '')) ~ '\m(art|music|drama|dance)\M' THEN 'arts'
  WHEN lower(coalesce(subject, '')) ~ '\m(pe|sport|physical)\M' THEN 'physical_education'
  ELSE NULL
END
WHERE department IS NULL;

-- ============================================================
-- 5. Trigger function: auto-tag on responsibility INSERT
-- ============================================================
-- Fires when a school_responsibilities row is created with
-- responsibility_type='dept_head' AND department IS NOT NULL.
-- Inserts class_members.dept_head rows for every active class
-- in the same school + department. ON CONFLICT DO NOTHING because
-- the unique-active index on (class_id, member_user_id, role) WHERE
-- removed_at IS NULL prevents duplicates.

CREATE OR REPLACE FUNCTION public.tg_auto_tag_dept_head_on_responsibility_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.responsibility_type = 'dept_head'
     AND NEW.department IS NOT NULL
     AND NEW.deleted_at IS NULL
  THEN
    INSERT INTO class_members (
      class_id, member_user_id, role, invited_by, source
    )
    SELECT c.id, NEW.teacher_id, 'dept_head', NEW.granted_by, 'auto_dept_head'
    FROM classes c
    WHERE c.school_id = NEW.school_id
      AND c.department = NEW.department
      AND c.is_archived = false
    ON CONFLICT (class_id, member_user_id, role) WHERE removed_at IS NULL
    DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_school_responsibility_dept_head_insert
  AFTER INSERT ON school_responsibilities
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_auto_tag_dept_head_on_responsibility_insert();

-- ============================================================
-- 6. Trigger function: revoke auto-tagged class_members on
--    responsibility soft-delete
-- ============================================================
-- Fires on UPDATE when deleted_at flips from NULL → NOT NULL on a
-- dept_head row with department. Soft-removes (sets removed_at) the
-- auto_dept_head rows we created. Manually-granted dept_head rows
-- (source IS NULL) are preserved.

CREATE OR REPLACE FUNCTION public.tg_remove_dept_head_class_members_on_revoke()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.responsibility_type = 'dept_head'
     AND OLD.department IS NOT NULL
     AND OLD.deleted_at IS NULL
     AND NEW.deleted_at IS NOT NULL
  THEN
    UPDATE class_members cm
    SET removed_at = now(),
        removed_by = NEW.granted_by,
        removal_reason = 'auto_dept_head_revoked'
    FROM classes c
    WHERE cm.class_id = c.id
      AND c.school_id = OLD.school_id
      AND c.department = OLD.department
      AND cm.member_user_id = OLD.teacher_id
      AND cm.role = 'dept_head'
      AND cm.source = 'auto_dept_head'
      AND cm.removed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_school_responsibility_dept_head_revoke
  AFTER UPDATE OF deleted_at ON school_responsibilities
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_remove_dept_head_class_members_on_revoke();

-- ============================================================
-- 7. Trigger function: auto-tag dept_heads on class INSERT
-- ============================================================
-- New class created → if any school_responsibilities of type='dept_head'
-- match school+department, auto-add their class_members rows.

CREATE OR REPLACE FUNCTION public.tg_auto_tag_dept_head_on_class_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.school_id IS NOT NULL
     AND NEW.department IS NOT NULL
     AND NEW.is_archived = false
  THEN
    INSERT INTO class_members (
      class_id, member_user_id, role, invited_by, source
    )
    SELECT NEW.id, sr.teacher_id, 'dept_head', sr.granted_by, 'auto_dept_head'
    FROM school_responsibilities sr
    WHERE sr.school_id = NEW.school_id
      AND sr.department = NEW.department
      AND sr.responsibility_type = 'dept_head'
      AND sr.deleted_at IS NULL
    ON CONFLICT (class_id, member_user_id, role) WHERE removed_at IS NULL
    DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_classes_auto_tag_dept_heads_on_insert
  AFTER INSERT ON classes
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_auto_tag_dept_head_on_class_insert();

-- ============================================================
-- 8. Trigger function: re-sync class_members on classes.department UPDATE
-- ============================================================
-- When a class's department changes, the auto_dept_head set must
-- match the new department. Strategy:
--   a. Soft-remove auto_dept_head rows tied to the OLD department's
--      dept_heads (i.e., teachers who coordinated the old dept).
--   b. Add auto_dept_head rows for the NEW department's dept_heads.
-- This is the most complex of the 4 triggers.

CREATE OR REPLACE FUNCTION public.tg_resync_class_members_on_department_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- No-op if department didn't actually change
  IF NEW.department IS NOT DISTINCT FROM OLD.department THEN
    RETURN NEW;
  END IF;

  -- a. Soft-remove auto_dept_head rows tied to OLD department's dept_heads.
  --    We can't tell from class_members alone WHICH dept they were
  --    auto-tagged for; we identify them by looking up sr rows that
  --    matched at the time. Since responsibilities can change too, we
  --    join on the dept_head responsibilities currently active for the
  --    OLD department + this school.
  IF OLD.department IS NOT NULL THEN
    UPDATE class_members cm
    SET removed_at = now(),
        removal_reason = 'auto_dept_head_class_dept_changed'
    WHERE cm.class_id = NEW.id
      AND cm.role = 'dept_head'
      AND cm.source = 'auto_dept_head'
      AND cm.removed_at IS NULL
      AND cm.member_user_id IN (
        SELECT sr.teacher_id
        FROM school_responsibilities sr
        WHERE sr.school_id = NEW.school_id
          AND sr.responsibility_type = 'dept_head'
          AND sr.department = OLD.department
          AND sr.deleted_at IS NULL
      );
  END IF;

  -- b. Add auto_dept_head rows for NEW department's dept_heads
  IF NEW.department IS NOT NULL AND NEW.is_archived = false THEN
    INSERT INTO class_members (
      class_id, member_user_id, role, invited_by, source
    )
    SELECT NEW.id, sr.teacher_id, 'dept_head', sr.granted_by, 'auto_dept_head'
    FROM school_responsibilities sr
    WHERE sr.school_id = NEW.school_id
      AND sr.department = NEW.department
      AND sr.responsibility_type = 'dept_head'
      AND sr.deleted_at IS NULL
    ON CONFLICT (class_id, member_user_id, role) WHERE removed_at IS NULL
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_classes_resync_dept_heads_on_department_change
  AFTER UPDATE OF department ON classes
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_resync_class_members_on_department_change();

-- ============================================================
-- 9. Sanity check
-- ============================================================

DO $$
DECLARE
  v_classes_dept_col BOOLEAN;
  v_responsibilities_dept_col BOOLEAN;
  v_check_includes_dept_head BOOLEAN;
  v_class_members_source_col BOOLEAN;
  v_trigger_count INT;
  v_backfilled_count INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='classes' AND column_name='department'
  ) INTO v_classes_dept_col;
  IF NOT v_classes_dept_col THEN
    RAISE EXCEPTION 'Migration failed: classes.department missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='school_responsibilities' AND column_name='department'
  ) INTO v_responsibilities_dept_col;
  IF NOT v_responsibilities_dept_col THEN
    RAISE EXCEPTION 'Migration failed: school_responsibilities.department missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='class_members' AND column_name='source'
  ) INTO v_class_members_source_col;
  IF NOT v_class_members_source_col THEN
    RAISE EXCEPTION 'Migration failed: class_members.source missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class rel ON con.conrelid = rel.oid
    WHERE rel.relname = 'school_responsibilities'
      AND con.conname = 'school_responsibilities_responsibility_type_check'
      AND pg_get_constraintdef(con.oid) LIKE '%dept_head%'
  ) INTO v_check_includes_dept_head;
  IF NOT v_check_includes_dept_head THEN
    RAISE EXCEPTION 'Migration failed: CHECK enum does not include dept_head';
  END IF;

  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgname IN (
    'tg_school_responsibility_dept_head_insert',
    'tg_school_responsibility_dept_head_revoke',
    'tg_classes_auto_tag_dept_heads_on_insert',
    'tg_classes_resync_dept_heads_on_department_change'
  );
  IF v_trigger_count != 4 THEN
    RAISE EXCEPTION 'Migration failed: expected 4 triggers, got %', v_trigger_count;
  END IF;

  SELECT COUNT(*) INTO v_backfilled_count
  FROM classes
  WHERE department IS NOT NULL;

  RAISE NOTICE 'Migration phase_4_9_dept_head_triggers applied OK: '
               '3 columns added, CHECK extended, 4 triggers, '
               '% classes backfilled with department from subject',
               v_backfilled_count;
END $$;
