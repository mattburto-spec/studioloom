-- Migration: phase_0_8a_backfill
-- Created: 20260428221516 UTC
-- Phase: Access Model v2 Phase 0.8a (data-changing)
--
-- WHY: Closes the cascade Phase 0.3 left half-finished + seeds the
--   class_members table Phase 0.7a created empty. Four sequenced
--   data writes —
--
--   1. Orphan teachers → personal schools. Each teacher with NULL
--      school_id gets a freshly-created `(Personal School)` school
--      and their school_id populated. Default country='CN' (most
--      orphans are Matt-test rows; teachers edit later via Phase 4
--      school registration). source='user_submitted' per mig 085 enum.
--      Each row gets ITS OWN personal school — multi-Matt prod data
--      is preserved as 3 separate teachers + 3 personal schools per
--      §6 Risks row. NIS-staffed teachers (school_id=636ff4fc-...) are
--      NOT touched.
--
--   2. students.school_id orphan tail. Phase 0.3 backfilled where
--      teacher.school_id IS NOT NULL. Now that all teachers have
--      school_id (step 1), re-run the same UPDATE to catch the rest.
--
--   3. units.school_id orphan tail. Same logic.
--
--   4. class_members.lead_teacher seed. For every active class with
--      teacher_id NOT NULL, INSERT a class_members row with
--      role='lead_teacher'. Idempotent NOT EXISTS guard so re-running
--      doesn't duplicate.
--
-- IMPACT: Real data writes against teachers, schools, students, units,
--   class_members. No schema changes. RAISE NOTICE counts at every
--   step so the Supabase apply log shows what happened. Hard
--   RAISE EXCEPTION at the end if any school_id NULL remains —
--   prevents the 0.8b NOT NULL tighten from applying on dirty state.
-- ROLLBACK: paired .down.sql is a best-effort undo (can't fully
--   reverse the personal-school INSERTs without losing the new
--   teachers→school links — see down script for limitations).
--
-- This migration is the data-changing one. The reset is schema only.
-- It writes inside a single implicit transaction (Supabase apply
-- wraps the file in BEGIN/COMMIT). If any step RAISES, the whole
-- thing rolls back and Matt can investigate before re-applying.

DO $$
DECLARE
  -- Step counters
  orphan_teachers_before INTEGER;
  orphan_teachers_after  INTEGER;
  schools_created        INTEGER := 0;
  rec                    RECORD;
  new_school_id          UUID;
  new_school_name        TEXT;

  -- Cascade counters
  orphan_students_before INTEGER;
  orphan_students_after  INTEGER;
  students_updated       INTEGER;
  orphan_units_before    INTEGER;
  orphan_units_after     INTEGER;
  units_updated          INTEGER;

  -- class_members seed counter
  members_inserted       INTEGER;
BEGIN
  -- ============================================================
  -- 1. Orphan teachers → personal schools
  -- ============================================================
  SELECT COUNT(*) INTO orphan_teachers_before
    FROM teachers WHERE school_id IS NULL;
  RAISE NOTICE '[Phase 0.8a] Orphan teachers (NULL school_id) BEFORE: %', orphan_teachers_before;

  FOR rec IN
    SELECT id, name, email FROM teachers WHERE school_id IS NULL
  LOOP
    new_school_name :=
      COALESCE(NULLIF(rec.name, ''), split_part(COALESCE(rec.email, 'unknown@unknown.local'), '@', 1))
      || ' (Personal School)';

    INSERT INTO schools (name, country, source)
    VALUES (new_school_name, 'CN', 'user_submitted')
    RETURNING id INTO new_school_id;

    UPDATE teachers SET school_id = new_school_id WHERE id = rec.id;

    schools_created := schools_created + 1;
  END LOOP;

  SELECT COUNT(*) INTO orphan_teachers_after
    FROM teachers WHERE school_id IS NULL;
  RAISE NOTICE '[Phase 0.8a] Personal schools created: %', schools_created;
  RAISE NOTICE '[Phase 0.8a] Orphan teachers AFTER: %', orphan_teachers_after;

  IF orphan_teachers_after > 0 THEN
    RAISE EXCEPTION 'Phase 0.8a: % orphan teachers remain after personal-school cascade. Check teacher rows with NULL school_id.', orphan_teachers_after;
  END IF;

  -- ============================================================
  -- 2. students.school_id orphan tail (mirrors Phase 0.3 UPDATE)
  -- ============================================================
  SELECT COUNT(*) INTO orphan_students_before
    FROM students WHERE school_id IS NULL;
  RAISE NOTICE '[Phase 0.8a] Orphan students (NULL school_id) BEFORE: %', orphan_students_before;

  WITH updated AS (
    UPDATE students s
    SET school_id = t.school_id
    FROM classes c, teachers t
    WHERE s.school_id IS NULL
      AND s.class_id = c.id
      AND c.teacher_id = t.id
      AND t.school_id IS NOT NULL
    RETURNING s.id
  )
  SELECT COUNT(*) INTO students_updated FROM updated;
  RAISE NOTICE '[Phase 0.8a] students.school_id rows updated: %', students_updated;

  SELECT COUNT(*) INTO orphan_students_after
    FROM students WHERE school_id IS NULL;
  RAISE NOTICE '[Phase 0.8a] Orphan students AFTER: %', orphan_students_after;

  IF orphan_students_after > 0 THEN
    RAISE EXCEPTION 'Phase 0.8a: % orphan students remain. Likely cause: students with class_id pointing to deleted classes, or classes with NULL teacher_id.', orphan_students_after;
  END IF;

  -- ============================================================
  -- 3. units.school_id orphan tail (mirrors Phase 0.3 UPDATE)
  -- ============================================================
  SELECT COUNT(*) INTO orphan_units_before
    FROM units WHERE school_id IS NULL;
  RAISE NOTICE '[Phase 0.8a] Orphan units (NULL school_id) BEFORE: %', orphan_units_before;

  WITH updated AS (
    UPDATE units u
    SET school_id = t.school_id
    FROM teachers t
    WHERE u.school_id IS NULL
      AND COALESCE(u.author_teacher_id, u.teacher_id) = t.id
      AND t.school_id IS NOT NULL
    RETURNING u.id
  )
  SELECT COUNT(*) INTO units_updated FROM updated;
  RAISE NOTICE '[Phase 0.8a] units.school_id rows updated: %', units_updated;

  SELECT COUNT(*) INTO orphan_units_after
    FROM units WHERE school_id IS NULL;
  RAISE NOTICE '[Phase 0.8a] Orphan units AFTER: %', orphan_units_after;

  IF orphan_units_after > 0 THEN
    RAISE EXCEPTION 'Phase 0.8a: % orphan units remain. Likely cause: units with NULL author_teacher_id AND NULL teacher_id (no identifiable owner).', orphan_units_after;
  END IF;

  -- ============================================================
  -- 4. class_members.lead_teacher seed
  -- ============================================================
  WITH inserted AS (
    INSERT INTO class_members (class_id, member_user_id, role, accepted_at)
    SELECT
      c.id,
      c.teacher_id,
      'lead_teacher',
      COALESCE(c.created_at, now())
    FROM classes c
    WHERE c.teacher_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM class_members cm
        WHERE cm.class_id = c.id
          AND cm.member_user_id = c.teacher_id
          AND cm.role = 'lead_teacher'
          AND cm.removed_at IS NULL
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO members_inserted FROM inserted;
  RAISE NOTICE '[Phase 0.8a] class_members.lead_teacher rows inserted: %', members_inserted;

  -- ============================================================
  -- Final summary + classes.school_id check (NOT NULL prep for 0.8b)
  -- ============================================================
  IF EXISTS (SELECT 1 FROM classes WHERE school_id IS NULL) THEN
    DECLARE
      classes_orphan INTEGER;
    BEGIN
      SELECT COUNT(*) INTO classes_orphan FROM classes WHERE school_id IS NULL;
      RAISE NOTICE '[Phase 0.8a] WARNING: % classes still have NULL school_id. Phase 0.8b NOT NULL tighten will fail until these are populated. Likely cause: classes with NULL teacher_id (no owner to derive school from).', classes_orphan;
    END;
  END IF;

  RAISE NOTICE '[Phase 0.8a] DONE — orphan teachers: %, schools created: %, students updated: %, units updated: %, class_members seeded: %',
    orphan_teachers_before, schools_created, students_updated, units_updated, members_inserted;
END $$;
