-- Rollback for: student_unit_success_criteria
-- Pairs with: 20260511142235_student_unit_success_criteria.sql
--
-- SAFETY GUARD:
--   Refuses if any row has slot_1 set (= success signal, canonical "row
--   has student work" signal — slot_1 is the first thing populated).
--
-- To force rollback when student data exists:
--   TRUNCATE student_unit_success_criteria CASCADE;  -- explicit data loss

DO $$
DECLARE
  v_row_count INT;
  v_with_work_count INT;
BEGIN
  SELECT COUNT(*) INTO v_row_count FROM student_unit_success_criteria;
  IF v_row_count = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_with_work_count
  FROM student_unit_success_criteria
  WHERE slot_1 IS NOT NULL;

  IF v_with_work_count > 0 THEN
    RAISE EXCEPTION
      'Refusing rollback: % student_unit_success_criteria row(s) have slot_1 set. '
      'This is student work. TRUNCATE student_unit_success_criteria CASCADE first if '
      'this is intentional.',
      v_with_work_count;
  END IF;

  RAISE NOTICE
    'Rollback proceeding: % rows present but none have slot_1 set. '
    'No student work at risk.',
    v_row_count;
END $$;

DROP TRIGGER IF EXISTS trigger_student_unit_success_criteria_updated_at ON student_unit_success_criteria;
DROP TABLE IF EXISTS student_unit_success_criteria CASCADE;

DO $$
DECLARE
  v_still_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_unit_success_criteria'
  ) INTO v_still_exists;
  IF v_still_exists THEN
    RAISE EXCEPTION 'Rollback failed: student_unit_success_criteria table still present';
  END IF;
  RAISE NOTICE 'Rollback student_unit_success_criteria complete.';
END $$;
