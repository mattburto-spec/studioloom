-- Rollback for: unit_briefs_diagram_url
-- Pairs with: 20260513133345_unit_briefs_diagram_url.sql
--
-- SAFETY GUARD:
--   Refuses rollback if any row has diagram_url set — that's a teacher-
--   uploaded asset. The storage object would be orphaned (Storage rows
--   don't FK back to this column), so we'd silently strand files.
--
-- To force rollback when diagram_url values exist:
--   UPDATE unit_briefs SET diagram_url = NULL; -- explicit, then either
--                                              -- delete the files via
--                                              -- the Storage console
--                                              -- or accept orphans.

DO $$
DECLARE
  v_with_diagram_count INT;
BEGIN
  -- Only check the count if the column exists — if rollback was already
  -- partially run, the column may be gone, in which case there's nothing
  -- to guard against.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'unit_briefs'
      AND column_name = 'diagram_url'
  ) THEN
    EXECUTE 'SELECT COUNT(*) FROM unit_briefs WHERE diagram_url IS NOT NULL'
      INTO v_with_diagram_count;

    IF v_with_diagram_count > 0 THEN
      RAISE EXCEPTION
        'Refusing rollback: % unit_briefs row(s) have diagram_url set. '
        'UPDATE unit_briefs SET diagram_url = NULL; first '
        '(and clean up the storage objects manually) if this is intentional.',
        v_with_diagram_count;
    END IF;
  END IF;
END $$;

ALTER TABLE public.unit_briefs
  DROP COLUMN IF EXISTS diagram_url;

DO $$
DECLARE
  v_still_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'unit_briefs'
      AND column_name = 'diagram_url'
  ) INTO v_still_exists;
  IF v_still_exists THEN
    RAISE EXCEPTION 'Rollback failed: diagram_url column still present';
  END IF;
  RAISE NOTICE 'Rollback unit_briefs_diagram_url complete.';
END $$;
