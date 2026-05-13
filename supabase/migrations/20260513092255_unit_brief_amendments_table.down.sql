-- Rollback for: unit_brief_amendments_table
-- Pairs with: 20260513092255_unit_brief_amendments_table.sql
--
-- SAFETY GUARD:
--   Refuses if any row exists. Amendments are by definition iteration
--   history that students may have already seen; rolling back blind
--   would silently rewrite that history.
--
-- To force rollback when amendments exist:
--   DELETE FROM unit_brief_amendments;   -- explicit data loss
--   -- (then re-run the .down.sql)

DO $$
DECLARE
  v_row_count INT;
BEGIN
  SELECT COUNT(*) INTO v_row_count FROM unit_brief_amendments;

  IF v_row_count > 0 THEN
    RAISE EXCEPTION
      'Refusing rollback: % unit_brief_amendments row(s) present. '
      'Amendments are part of unit iteration history. '
      'DELETE FROM unit_brief_amendments; first if this is intentional.',
      v_row_count;
  END IF;

  RAISE NOTICE 'Rollback proceeding: unit_brief_amendments is empty.';
END $$;

DROP TABLE IF EXISTS unit_brief_amendments CASCADE;

DO $$
DECLARE
  v_still_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'unit_brief_amendments'
  ) INTO v_still_exists;
  IF v_still_exists THEN
    RAISE EXCEPTION 'Rollback failed: unit_brief_amendments table still present';
  END IF;
  RAISE NOTICE 'Rollback unit_brief_amendments complete.';
END $$;
