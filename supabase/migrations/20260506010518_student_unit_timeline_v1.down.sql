-- Rollback for: student_unit_timeline_v1
-- Pairs with: 20260506010518_student_unit_timeline_v1.sql
--
-- Same safety pattern as student_unit_kanban_v1 down (AG.2.1):
-- refuses if non-trivial student data exists.

-- ============================================================
-- 1. Safety precondition
-- ============================================================
DO $$
DECLARE
  v_row_count INT;
  v_nonempty_count INT;
BEGIN
  SELECT COUNT(*) INTO v_row_count FROM student_unit_timeline;
  IF v_row_count = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_nonempty_count
  FROM student_unit_timeline
  WHERE jsonb_array_length(milestones) > 0;

  IF v_nonempty_count > 0 THEN
    RAISE EXCEPTION
      'Refusing rollback: % student_unit_timeline row(s) have non-empty '
      'milestones. Student work. TRUNCATE student_unit_timeline CASCADE '
      'first if intentional.',
      v_nonempty_count;
  END IF;

  RAISE NOTICE
    'Rollback proceeding: % rows present but all have empty milestones. '
    'No student work at risk.',
    v_row_count;
END $$;

-- ============================================================
-- 2. Drop trigger (function is shared — leave it)
-- ============================================================
DROP TRIGGER IF EXISTS trigger_student_unit_timeline_updated_at ON student_unit_timeline;

-- ============================================================
-- 3. Drop table (CASCADE cleans up indexes + RLS + FK references)
-- ============================================================
DROP TABLE IF EXISTS student_unit_timeline CASCADE;

-- ============================================================
-- 4. Final assertion
-- ============================================================
DO $$
DECLARE
  v_still_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_unit_timeline'
  ) INTO v_still_exists;
  IF v_still_exists THEN
    RAISE EXCEPTION 'Rollback failed: student_unit_timeline table still present';
  END IF;

  RAISE NOTICE 'Rollback student_unit_timeline_v1 complete.';
END $$;
