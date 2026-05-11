-- Rollback for: student_unit_product_briefs
-- Pairs with: 20260511142232_student_unit_product_briefs.sql
--
-- SAFETY GUARD:
--   Refuses if any row has archetype_id set (= student work in progress).
--   archetype_id is populated when Q0 is picked, the canonical "row has
--   student work" signal.
--
-- To force rollback when student data exists:
--   TRUNCATE student_unit_product_briefs CASCADE;  -- explicit data loss

DO $$
DECLARE
  v_row_count INT;
  v_with_work_count INT;
BEGIN
  SELECT COUNT(*) INTO v_row_count FROM student_unit_product_briefs;
  IF v_row_count = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_with_work_count
  FROM student_unit_product_briefs
  WHERE archetype_id IS NOT NULL;

  IF v_with_work_count > 0 THEN
    RAISE EXCEPTION
      'Refusing rollback: % student_unit_product_briefs row(s) have archetype_id set. '
      'This is student work. TRUNCATE student_unit_product_briefs CASCADE first if '
      'this is intentional.',
      v_with_work_count;
  END IF;

  RAISE NOTICE
    'Rollback proceeding: % rows present but none have archetype_id set. '
    'No student work at risk.',
    v_row_count;
END $$;

DROP TRIGGER IF EXISTS trigger_student_unit_product_briefs_updated_at ON student_unit_product_briefs;
DROP TABLE IF EXISTS student_unit_product_briefs CASCADE;

DO $$
DECLARE
  v_still_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_unit_product_briefs'
  ) INTO v_still_exists;
  IF v_still_exists THEN
    RAISE EXCEPTION 'Rollback failed: student_unit_product_briefs table still present';
  END IF;
  RAISE NOTICE 'Rollback student_unit_product_briefs complete.';
END $$;
