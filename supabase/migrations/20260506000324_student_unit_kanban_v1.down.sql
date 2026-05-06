-- Rollback for: student_unit_kanban_v1
-- Pairs with: 20260506000324_student_unit_kanban_v1.sql
--
-- Drops the student_unit_kanban table.
--
-- SAFETY GUARD:
--   Refuses if non-trivial student data exists (any row with at least
--   one card in the cards array). This is student work — losing it
--   would be ~irreversible.
--
-- To force rollback when student data exists:
--   TRUNCATE student_unit_kanban CASCADE;  -- explicit data loss
--   Then re-run this rollback.

-- ============================================================
-- 1. Safety precondition
-- ============================================================
DO $$
DECLARE
  v_row_count INT;
  v_nonempty_count INT;
BEGIN
  SELECT COUNT(*) INTO v_row_count FROM student_unit_kanban;
  IF v_row_count = 0 THEN
    -- Empty — safe to drop without further checks
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_nonempty_count
  FROM student_unit_kanban
  WHERE jsonb_array_length(cards) > 0;

  IF v_nonempty_count > 0 THEN
    RAISE EXCEPTION
      'Refusing rollback: % student_unit_kanban row(s) have non-empty cards. '
      'This is student work. TRUNCATE student_unit_kanban CASCADE first if '
      'this is intentional.',
      v_nonempty_count;
  END IF;

  RAISE NOTICE
    'Rollback proceeding: % rows present but all have empty cards arrays. '
    'No student work at risk.',
    v_row_count;
END $$;

-- ============================================================
-- 2. Drop trigger (function is shared — leave it)
-- ============================================================
DROP TRIGGER IF EXISTS trigger_student_unit_kanban_updated_at ON student_unit_kanban;

-- Note: set_updated_at() is shared with assessment_tasks, submissions, and
-- other tables via TG.0B + earlier migrations. Don't drop it.

-- ============================================================
-- 3. Drop the table (CASCADE cleans up indexes + RLS + FK references)
-- ============================================================
DROP TABLE IF EXISTS student_unit_kanban CASCADE;

-- ============================================================
-- 4. Final assertion
-- ============================================================
DO $$
DECLARE
  v_still_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_unit_kanban'
  ) INTO v_still_exists;
  IF v_still_exists THEN
    RAISE EXCEPTION 'Rollback failed: student_unit_kanban table still present';
  END IF;

  RAISE NOTICE 'Rollback student_unit_kanban_v1 complete.';
END $$;
