-- Rollback for: machine_profiles_school_scoped
-- Pairs with: 20260428074205_machine_profiles_school_scoped.sql
--
-- Restores teacher-scoped RLS + indexes. Keeps the school_id backfill
-- + created_by_teacher_id column in place — those are additive + can
-- co-exist with teacher-scoped access. Only the access-control
-- surfaces revert.

-- 1. Restore teacher-scoped RLS policies (mig 093 versions).
DROP POLICY IF EXISTS machine_profiles_select_teacher ON machine_profiles;
CREATE POLICY machine_profiles_select_teacher
  ON machine_profiles
  FOR SELECT
  USING (
    is_system_template = true
    OR teacher_id = auth.uid()
  );

DROP POLICY IF EXISTS machine_profiles_insert_teacher ON machine_profiles;
CREATE POLICY machine_profiles_insert_teacher
  ON machine_profiles
  FOR INSERT
  WITH CHECK (
    teacher_id = auth.uid()
    AND is_system_template = false
  );

DROP POLICY IF EXISTS machine_profiles_update_teacher ON machine_profiles;
CREATE POLICY machine_profiles_update_teacher
  ON machine_profiles
  FOR UPDATE
  USING (
    teacher_id = auth.uid()
    AND is_system_template = false
  )
  WITH CHECK (
    teacher_id = auth.uid()
    AND is_system_template = false
  );

DROP POLICY IF EXISTS machine_profiles_delete_teacher ON machine_profiles;
CREATE POLICY machine_profiles_delete_teacher
  ON machine_profiles
  FOR DELETE
  USING (
    teacher_id = auth.uid()
    AND is_system_template = false
  );

-- 2. Restore teacher-scoped indexes (mig 093 + 118 shapes).
DROP INDEX IF EXISTS idx_machine_profiles_school_id;
DROP INDEX IF EXISTS uq_machine_profiles_lab_name_active;

CREATE INDEX IF NOT EXISTS idx_machine_profiles_teacher_id
  ON machine_profiles(teacher_id)
  WHERE teacher_id IS NOT NULL;

-- mig 118 shape: (teacher_id, lab_id, name) WHERE is_active = true
CREATE UNIQUE INDEX IF NOT EXISTS idx_machine_profiles_teacher_lab_name_active
  ON machine_profiles(teacher_id, lab_id, name)
  WHERE is_active = true;

-- 3. Drop the school_id NOT NULL CHECK constraint (idempotent).
ALTER TABLE machine_profiles
  DROP CONSTRAINT IF EXISTS machine_profile_school_for_non_template;

-- 4. Keep created_by_teacher_id column + index — additive, harmless
--    on rollback. Drop in a follow-up if needed.
-- 5. Keep school_id backfill — values are real + correct, harmless.
