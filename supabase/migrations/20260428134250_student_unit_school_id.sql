-- Migration: student_unit_school_id
-- Created: 20260428134250 UTC
-- Phase: Access Model v2 Phase 0.3 (Option A scope — add + backfill,
--   tighten to NOT NULL deferred to Phase 0.8)
--
-- WHY: Students and units don't currently know which school they belong
--   to. Resolving school context today requires walking
--     students.class_id → classes.teacher_id → teachers.school_id
--   for every query — fragile, expensive, and doesn't survive students
--   moving between classes within the same school. Same shape applies
--   to units (author_teacher_id chain). Adding direct school_id columns
--   makes school-scoped RLS in Phase 1 a single-column predicate.
-- IMPACT: students gains school_id (UUID, FK schools.id, ON DELETE SET
--   NULL, nullable). units gains school_id (same shape). Two partial
--   indexes (only when populated). Backfill via teacher chain — rows
--   where the teacher has NULL school_id stay NULL (orphan teachers
--   handled in Phase 0.8 personal-school creation cascade).
-- ROLLBACK: paired .down.sql drops both columns + both indexes.
--
-- Backfill chain mirrors the established pattern in mig
-- 20260428074205_machine_profiles_school_scoped (machines.teacher_id →
-- teachers.school_id) and the FU-P plan for classes.school_id.
--
-- Tighten to NOT NULL is NOT in this migration. After Phase 0.8 ensures
-- every teacher has school_id (orphan teachers get auto-created personal
-- schools), Phase 0.8's wrap-up migration finalises NULLs and tightens
-- students.school_id + units.school_id + classes.school_id to NOT NULL
-- in one transaction.
--
-- units has TWO author identity columns (mig 007 author_teacher_id +
-- mig 023 teacher_id, both → auth.users(id)). They may or may not be
-- in sync per row. Backfill uses COALESCE(author_teacher_id, teacher_id)
-- so either being set is sufficient. Reconciling the two columns is a
-- separate cleanup, not Phase 0.3 scope.

-- ============================================================
-- 1. Add nullable FK columns
-- ============================================================
-- ON DELETE SET NULL — same pattern as classes.school_id (mig 117),
-- machine_profiles.school_id (mig 093), fabricators.school_id (mig 097).
-- If a school is deleted (admin cleanup), students/units stay alive but
-- become school-orphaned. Phase 1+ RLS rewrites handle the edge case.

ALTER TABLE students
  ADD COLUMN school_id UUID NULL
    REFERENCES schools(id) ON DELETE SET NULL;

ALTER TABLE units
  ADD COLUMN school_id UUID NULL
    REFERENCES schools(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Partial indexes — only useful when populated
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_students_school_id
  ON students(school_id)
  WHERE school_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_units_school_id
  ON units(school_id)
  WHERE school_id IS NOT NULL;

-- ============================================================
-- 3. Backfill from teacher chain
-- ============================================================
-- students.school_id ← students.class_id → classes.teacher_id → teachers.school_id
-- Rows where the matched teacher has NULL school_id stay NULL.
-- (Phase 0.8 creates personal schools for those orphan teachers and
-- re-runs the cascade.)

UPDATE students s
SET school_id = t.school_id
FROM classes c, teachers t
WHERE s.school_id IS NULL
  AND s.class_id = c.id
  AND c.teacher_id = t.id
  AND t.school_id IS NOT NULL;

-- units.school_id ← COALESCE(units.author_teacher_id, units.teacher_id) → teachers.school_id
-- Two author columns coexist (mig 007 + mig 023). Either being set is
-- enough. Reconciliation is out of scope.

UPDATE units u
SET school_id = t.school_id
FROM teachers t
WHERE u.school_id IS NULL
  AND COALESCE(u.author_teacher_id, u.teacher_id) = t.id
  AND t.school_id IS NOT NULL;

-- ============================================================
-- 4. Sanity check + row-count report
-- ============================================================

DO $$
DECLARE
  total_students INTEGER;
  populated_students INTEGER;
  total_units INTEGER;
  populated_units INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='students' AND column_name='school_id'
  ) THEN
    RAISE EXCEPTION 'Migration student_unit_school_id failed: students.school_id missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='units' AND column_name='school_id'
  ) THEN
    RAISE EXCEPTION 'Migration student_unit_school_id failed: units.school_id missing';
  END IF;

  SELECT COUNT(*), COUNT(school_id) INTO total_students, populated_students FROM students;
  SELECT COUNT(*), COUNT(school_id) INTO total_units, populated_units FROM units;

  RAISE NOTICE 'Migration student_unit_school_id applied OK';
  RAISE NOTICE '  students: % total, % with school_id (% orphan — phase 0.8 cascade)',
    total_students, populated_students, total_students - populated_students;
  RAISE NOTICE '  units:    % total, % with school_id (% orphan — phase 0.8 cascade)',
    total_units, populated_units, total_units - populated_units;
END $$;
