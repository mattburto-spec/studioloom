-- Rollback for: task_system_v1_schema
-- Pairs with: 20260505032750_task_system_v1_schema.sql
--
-- Drops the 5 NEW tables in reverse dependency order + DROPs the
-- task_id column from the 2 ALTERed tables (student_tile_grades,
-- assessment_records).
--
-- TG.0B re-attempt finding: student_tile_grades existed pre-migration
-- with 26 columns from G1 work. Down migration ONLY removes what THIS
-- migration added — does NOT drop the 26-column table.
--
-- SAFETY GUARDS:
--   1. Refuses if any non-empty assessment_tasks rows exist (would
--      orphan grade_entries / submissions; student_tile_grades.task_id
--      becomes orphaned but column drop handles that)
--   2. Refuses if assessment_records.task_id column is NOT NULL
--      (means TG.0K already locked the constraint)
--   3. Refuses if student_tile_grades.task_id is NOT NULL (same)
--   4. Refuses if any submissions rows have source_kind != 'task'
--      (means inquiry-mode is live)

-- ============================================================
-- 1. Safety preconditions
-- ============================================================
DO $$
DECLARE
  v_task_row_count INT;
  v_assessment_records_task_id_not_null BOOLEAN;
  v_student_tile_grades_task_id_not_null BOOLEAN;
  v_inquiry_submission_count INT;
BEGIN
  SELECT COUNT(*) INTO v_task_row_count FROM assessment_tasks;
  IF v_task_row_count > 0 THEN
    RAISE EXCEPTION 'Refusing rollback: assessment_tasks has % row(s). '
                    'Manual review required before dropping. Use '
                    'TRUNCATE assessment_tasks CASCADE if intentional.',
                    v_task_row_count;
  END IF;

  SELECT (is_nullable = 'NO') INTO v_assessment_records_task_id_not_null
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'assessment_records'
    AND column_name = 'task_id';
  IF v_assessment_records_task_id_not_null = true THEN
    RAISE EXCEPTION 'Refusing rollback: assessment_records.task_id is NOT NULL. '
                    'A later migration (TG.0K follow-up) locked the constraint. '
                    'Roll back that migration first.';
  END IF;

  SELECT (is_nullable = 'NO') INTO v_student_tile_grades_task_id_not_null
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'student_tile_grades'
    AND column_name = 'task_id';
  IF v_student_tile_grades_task_id_not_null = true THEN
    RAISE EXCEPTION 'Refusing rollback: student_tile_grades.task_id is NOT NULL. '
                    'A later migration locked the constraint. '
                    'Roll back that migration first.';
  END IF;

  SELECT COUNT(*) INTO v_inquiry_submission_count
  FROM submissions
  WHERE source_kind != 'task';
  IF v_inquiry_submission_count > 0 THEN
    RAISE EXCEPTION 'Refusing rollback: % submissions row(s) reference non-task source. '
                    'Inquiry-mode is live. Roll back inquiry-mode '
                    'tables first.', v_inquiry_submission_count;
  END IF;
END $$;

-- ============================================================
-- 2. Drop triggers added by THIS migration (the 5 new tables only)
-- ============================================================
-- student_tile_grades trigger predates this migration — leave it.
DROP TRIGGER IF EXISTS trigger_submissions_updated_at ON submissions;
DROP TRIGGER IF EXISTS trigger_assessment_tasks_updated_at ON assessment_tasks;

-- Note: set_updated_at() function is shared with other tables (class_units etc.).
-- Don't drop it — leave for those consumers.

-- ============================================================
-- 3. Drop task_id columns (the 2 ALTERed tables)
-- ============================================================
-- assessment_records — TG.0A F1 amendment rollback
DROP INDEX IF EXISTS idx_assessment_records_task;
ALTER TABLE assessment_records
  DROP COLUMN IF EXISTS task_id;

-- student_tile_grades — Path A ALTER rollback (preserves the 26-column G1 schema)
DROP INDEX IF EXISTS idx_student_tile_grades_task;
ALTER TABLE student_tile_grades
  DROP COLUMN IF EXISTS task_id;

-- ============================================================
-- 4. Drop the 5 new tables in reverse dependency order
-- ============================================================
-- (student_tile_grades NOT dropped — it predates this migration)
DROP TABLE IF EXISTS grade_entries;
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS task_criterion_weights;
DROP TABLE IF EXISTS task_lesson_links;
DROP TABLE IF EXISTS assessment_tasks;

-- ============================================================
-- 5. Final assertion
-- ============================================================
DO $$
DECLARE
  v_remaining_new INT;
  v_student_tile_grades_still_there BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_remaining_new
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('assessment_tasks', 'task_lesson_links',
                        'task_criterion_weights', 'submissions',
                        'grade_entries');
  IF v_remaining_new != 0 THEN
    RAISE EXCEPTION 'Rollback failed: % new tables still present', v_remaining_new;
  END IF;

  -- student_tile_grades MUST still be present (predates this migration)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_tile_grades'
  ) INTO v_student_tile_grades_still_there;
  IF NOT v_student_tile_grades_still_there THEN
    RAISE EXCEPTION 'Rollback safety violation: student_tile_grades was dropped. '
                    'Migration only ALTERed it; rollback should NOT remove it.';
  END IF;

  RAISE NOTICE 'Rollback task_system_v1_schema complete: 5 new tables dropped, '
               'task_id column removed from assessment_records + student_tile_grades, '
               '2 triggers removed. student_tile_grades 26-column G1 schema preserved.';
END $$;
