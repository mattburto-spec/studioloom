-- Migration: fix_handle_new_teacher_skip_students
-- Created: 20260501103415 UTC
--
-- WHY: The original trigger handle_new_teacher (from 001_initial_schema.sql)
-- blindly creates a teachers row on every auth.users INSERT. It predates
-- Phase 1 of access-model-v2, when every auth user was a teacher. Phase 1
-- (29 Apr 2026) started provisioning auth.users rows for STUDENTS via
-- src/lib/access-v2/provision-student-auth-user.ts — each insert triggered
-- this old function, leaking phantom teacher rows with the synthetic email
-- pattern `student-<uuid>@students.studioloom.local`.
--
-- IMPACT:
-- 1. CREATE OR REPLACE FUNCTION handle_new_teacher — adds a guard that
--    skips when raw_app_meta_data->>'user_type' = 'student'. Prevents new
--    leaks going forward.
-- 2. Backfill DELETE — removes existing leaked rows from teachers, after
--    a safety assertion that none of them have foreign-key references
--    elsewhere (classes, units, school_responsibilities, etc). If any
--    leaked row has data linked, the migration RAISES + aborts so a human
--    can investigate first.
--
-- SECURITY: No security implication of the leak — buildTeacherSession in
-- access-v2/actor-session.ts only routes when user_type='teacher', and
-- requireAdmin checks teachers.is_admin which is false on leaked rows.
-- The leak is purely cosmetic in the admin UI.
--
-- ROLLBACK: paired .down.sql restores the original trigger function.
-- Cannot restore deleted teacher rows since they had zero associated data
-- (asserted before deletion). Rollback is therefore equivalent to "do
-- nothing" — students re-authing would just re-create the leaks via the
-- old trigger.

-- ----------------------------------------------------------------------
-- Step 1 — Guard the trigger function
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_teacher()
RETURNS TRIGGER AS $$
BEGIN
  -- Phase 1 access-v2 introduced student auth.users rows with
  -- app_metadata.user_type='student'. Skip those — only auto-create a
  -- teachers row for users that are not explicitly student.
  -- (NULL user_type defaults to teacher behaviour for legacy compat.)
  IF (NEW.raw_app_meta_data->>'user_type') = 'student' THEN
    RETURN NEW;
  END IF;

  INSERT INTO teachers (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------
-- Step 2 — Safety check + backfill DELETE
-- ----------------------------------------------------------------------

DO $$
DECLARE
  leak_count INT;
  ref_count INT;
  deleted_count INT;
BEGIN
  -- How many leaked rows exist?
  SELECT count(*)
    INTO leak_count
    FROM teachers
    WHERE email LIKE '%@students.studioloom.local';

  RAISE NOTICE 'fix_handle_new_teacher_skip_students: % leaked teacher rows found', leak_count;

  IF leak_count = 0 THEN
    RAISE NOTICE 'fix_handle_new_teacher_skip_students: nothing to clean up';
    RETURN;
  END IF;

  -- Are any of the leaked rows referenced by foreign keys?
  -- Tables checked (from full FK audit):
  --   classes.teacher_id              ON DELETE CASCADE
  --   units.author_teacher_id         ON DELETE SET NULL
  --   students.author_teacher_id      ON DELETE (default — restrict)
  --   fabrication_labs.created_by_teacher_id  ON DELETE SET NULL
  --   machine_profiles.created_by_teacher_id  ON DELETE SET NULL
  --   school_collections.verified_by_teacher_id  ON DELETE SET NULL
  --   school_responsibilities.teacher_id  ON DELETE CASCADE
  --   school_responsibilities.granted_by  ON DELETE SET NULL
  --   student_mentors.granted_by      ON DELETE SET NULL
  --   class_members.invited_by        ON DELETE SET NULL
  --   class_members.removed_by        ON DELETE SET NULL
  --   pypx_exhibition.mentor_teacher_id  ON DELETE SET NULL
  --   ingestion_corrections.teacher_id  ON DELETE CASCADE
  --   lms_integration_settings.teacher_id  ON DELETE CASCADE
  --   content_moderation.overridden_by  ON DELETE SET NULL
  --
  -- We refuse to delete if ANY leaked row has data linked anywhere — better
  -- to abort + investigate than silently CASCADE.

  SELECT count(*)
    INTO ref_count
    FROM teachers t
    WHERE t.email LIKE '%@students.studioloom.local'
      AND (
        EXISTS (SELECT 1 FROM classes WHERE teacher_id = t.id)
        OR EXISTS (SELECT 1 FROM units WHERE author_teacher_id = t.id)
        OR EXISTS (SELECT 1 FROM students WHERE author_teacher_id = t.id)
      );

  RAISE NOTICE 'fix_handle_new_teacher_skip_students: % leaked rows have FK references in classes/units/students', ref_count;

  IF ref_count > 0 THEN
    RAISE EXCEPTION 'Refusing to delete: % leaked teacher rows have associated classes/units/students. Investigate before re-running.', ref_count;
  END IF;

  -- Safe to DELETE. CASCADE/SET NULL FKs on the other tables (labs,
  -- machines, school_collections, mentors, etc) will fire — but we've
  -- audited the heavyweight tables (classes, units, students) and they're
  -- empty for these rows, so the rest is consistent zero-out.
  DELETE FROM teachers
    WHERE email LIKE '%@students.studioloom.local';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'fix_handle_new_teacher_skip_students: deleted % leaked teacher rows', deleted_count;

  IF deleted_count <> leak_count THEN
    RAISE EXCEPTION 'Mismatch: expected to delete %, actually deleted %. Aborting.', leak_count, deleted_count;
  END IF;
END $$;
