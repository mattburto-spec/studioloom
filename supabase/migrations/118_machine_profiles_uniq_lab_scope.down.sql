-- Migration 118 down: restore the pre-118 (teacher_id, name) unique index.
--
-- WARNING: rolling back when the system has post-118 data may cause
-- the recreate to fail with 23505 if any teacher has duplicate
-- (teacher_id, name) rows across labs OR has a deactivated machine
-- whose name collides with an active one. Both situations are
-- legitimate post-118 — they're exactly what 118 was permitting.
-- The rollback path is intended for emergency revert only; in
-- normal flow we move forward with another migration.

DROP INDEX IF EXISTS uq_machine_profiles_teacher_lab_name;

CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_profiles_teacher_name
  ON machine_profiles (teacher_id, name)
  WHERE teacher_id IS NOT NULL;
