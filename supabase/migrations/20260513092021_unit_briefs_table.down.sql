-- Rollback for: unit_briefs_table
-- Pairs with: 20260513092021_unit_briefs_table.sql
--
-- SAFETY GUARD:
--   Refuses if any row has teacher work present, defined as:
--     brief_text IS NOT NULL OR constraints <> '{}'::jsonb
--   These are the two columns a teacher fills in via /teacher/units/[unitId]/brief.
--
-- To force rollback when teacher work exists:
--   DELETE FROM unit_briefs;        -- explicit data loss
--   -- (then re-run the .down.sql)

DO $$
DECLARE
  v_row_count       INT;
  v_with_work_count INT;
BEGIN
  SELECT COUNT(*) INTO v_row_count FROM unit_briefs;
  IF v_row_count = 0 THEN
    RAISE NOTICE 'Rollback proceeding: unit_briefs is empty.';
  ELSE
    SELECT COUNT(*) INTO v_with_work_count
    FROM unit_briefs
    WHERE brief_text IS NOT NULL OR constraints <> '{}'::jsonb;

    IF v_with_work_count > 0 THEN
      RAISE EXCEPTION
        'Refusing rollback: % unit_briefs row(s) have teacher work present '
        '(brief_text or non-empty constraints). DELETE FROM unit_briefs; first '
        'if this is intentional.',
        v_with_work_count;
    END IF;

    RAISE NOTICE
      'Rollback proceeding: % unit_briefs row(s) present but no teacher work. '
      'No data at risk.',
      v_row_count;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_unit_briefs_updated_at ON unit_briefs;
DROP TABLE IF EXISTS unit_briefs CASCADE;

DO $$
DECLARE
  v_still_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'unit_briefs'
  ) INTO v_still_exists;
  IF v_still_exists THEN
    RAISE EXCEPTION 'Rollback failed: unit_briefs table still present';
  END IF;
  RAISE NOTICE 'Rollback unit_briefs complete.';
END $$;
