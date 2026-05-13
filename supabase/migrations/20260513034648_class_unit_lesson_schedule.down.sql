-- Rollback for: class_unit_lesson_schedule
-- Pairs with: 20260513034648_class_unit_lesson_schedule.sql

-- Safety guard: refuse to drop if any rows exist (teacher scheduling work).
DO $$
DECLARE
  v_count INT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'class_unit_lesson_schedule'
  ) THEN
    SELECT COUNT(*) INTO v_count FROM class_unit_lesson_schedule;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Rollback refused: % rows in class_unit_lesson_schedule '
                      '(teacher scheduling work). Truncate first if intentional.', v_count;
    END IF;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_class_unit_lesson_schedule_updated_at
  ON class_unit_lesson_schedule;
DROP TABLE IF EXISTS class_unit_lesson_schedule;
-- Note: set_updated_at() is shared with many other tables — do NOT drop.
