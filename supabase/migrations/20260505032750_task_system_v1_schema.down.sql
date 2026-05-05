-- Rollback for: task_system_v1_schema
-- Pairs with: 20260505032750_task_system_v1_schema.sql
--
-- Drops the 6 new tables in reverse dependency order + drops the
-- assessment_records.task_id column.
--
-- SAFETY GUARDS:
--   1. Refuses if any non-empty assessment_tasks rows exist (would
--      orphan grade_entries / submissions / student_tile_grades)
--   2. Refuses if assessment_records.task_id column is NOT NULL
--      (means TG.0K already locked the constraint)
--   3. Refuses if any submissions rows have source_kind != 'task'
--      (means inquiry-mode is live)

-- ============================================================
-- 1. Safety preconditions
-- ============================================================
DO $$
DECLARE
  v_task_row_count INT;
  v_task_id_not_null BOOLEAN;
  v_inquiry_submission_count INT;
BEGIN
  SELECT COUNT(*) INTO v_task_row_count FROM assessment_tasks;
  IF v_task_row_count > 0 THEN
    RAISE EXCEPTION 'Refusing rollback: assessment_tasks has % row(s). '
                    'Manual review required before dropping. Use '
                    'TRUNCATE assessment_tasks CASCADE if intentional.',
                    v_task_row_count;
  END IF;

  SELECT (is_nullable = 'NO') INTO v_task_id_not_null
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'assessment_records'
    AND column_name = 'task_id';
  IF v_task_id_not_null = true THEN
    RAISE EXCEPTION 'Refusing rollback: assessment_records.task_id is NOT NULL. '
                    'A later migration (TG.0K follow-up) locked the constraint. '
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
-- 2. Drop triggers (must precede table drops)
-- ============================================================
DROP TRIGGER IF EXISTS trigger_student_tile_grades_updated_at ON student_tile_grades;
DROP TRIGGER IF EXISTS trigger_submissions_updated_at ON submissions;
DROP TRIGGER IF EXISTS trigger_assessment_tasks_updated_at ON assessment_tasks;

-- Note: set_updated_at() function is shared with other tables (class_units etc.).
-- Don't drop it — leave for those consumers.

-- ============================================================
-- 3. Drop assessment_records.task_id (TG.0A F1 amendment rollback)
-- ============================================================
DROP INDEX IF EXISTS idx_assessment_records_task;

ALTER TABLE assessment_records
  DROP COLUMN IF EXISTS task_id;

-- ============================================================
-- 4. Drop the 6 new tables in reverse dependency order
-- ============================================================
DROP TABLE IF EXISTS student_tile_grades;
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
  v_remaining INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('assessment_tasks', 'task_lesson_links',
                        'task_criterion_weights', 'submissions',
                        'grade_entries', 'student_tile_grades');
  IF v_remaining != 0 THEN
    RAISE EXCEPTION 'Rollback failed: % task-system tables still present', v_remaining;
  END IF;

  RAISE NOTICE 'Rollback task_system_v1_schema complete: 6 tables dropped, '
               'assessment_records.task_id column removed, 3 triggers removed.';
END $$;
