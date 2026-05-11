-- Rollback for: student_unit_project_specs
-- Pairs with: 20260511083114_student_unit_project_specs.sql
--
-- Drops the student_unit_project_specs table.
--
-- SAFETY GUARD:
--   Refuses if any row has archetype_id set (= student work in progress).
--   archetype_id is the first thing populated when a student picks Q0,
--   so it's the canonical "row has student work" signal.
--
-- To force rollback when student data exists:
--   TRUNCATE student_unit_project_specs CASCADE;  -- explicit data loss
--   Then re-run this rollback.

-- ============================================================
-- 1. Safety precondition
-- ============================================================
DO $$
DECLARE
  v_row_count INT;
  v_with_work_count INT;
BEGIN
  SELECT COUNT(*) INTO v_row_count FROM student_unit_project_specs;
  IF v_row_count = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_with_work_count
  FROM student_unit_project_specs
  WHERE archetype_id IS NOT NULL;

  IF v_with_work_count > 0 THEN
    RAISE EXCEPTION
      'Refusing rollback: % student_unit_project_specs row(s) have archetype_id set. '
      'This is student work. TRUNCATE student_unit_project_specs CASCADE first if '
      'this is intentional.',
      v_with_work_count;
  END IF;

  RAISE NOTICE
    'Rollback proceeding: % rows present but none have archetype_id set. '
    'No student work at risk.',
    v_row_count;
END $$;

-- ============================================================
-- 2. Drop trigger (function is shared — leave it)
-- ============================================================
DROP TRIGGER IF EXISTS trigger_student_unit_project_specs_updated_at ON student_unit_project_specs;

-- ============================================================
-- 3. Drop the table (CASCADE cleans up indexes + RLS)
-- ============================================================
DROP TABLE IF EXISTS student_unit_project_specs CASCADE;

-- ============================================================
-- 4. Final assertion
-- ============================================================
DO $$
DECLARE
  v_still_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_unit_project_specs'
  ) INTO v_still_exists;
  IF v_still_exists THEN
    RAISE EXCEPTION 'Rollback failed: student_unit_project_specs table still present';
  END IF;

  RAISE NOTICE 'Rollback student_unit_project_specs complete.';
END $$;
