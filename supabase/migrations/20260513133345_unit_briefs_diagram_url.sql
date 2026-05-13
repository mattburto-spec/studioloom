-- Migration: unit_briefs_diagram_url
-- Created: 20260513133345 UTC
-- Phase: Unit Briefs Foundation Phase B.5 — spec diagram upload
--
-- WHY: Teachers asked (during Phase B smoke) to attach a spec diagram
--   to a brief — a reference sketch / mood board / annotated photo that
--   anchors the design intent visually alongside the prose brief and
--   structured constraints. One diagram per brief, teacher-authored,
--   replaces on re-upload.
--
-- IMPACT:
--   1 NEW column on public.unit_briefs:
--     - diagram_url TEXT NULL — relative proxy URL of the form
--       /api/storage/unit-images/<unitId>/brief-diagram-<ts>.jpg
--       NULL = no diagram. Storage lives in the existing `unit-images`
--       Supabase bucket (same auth scope as unit thumbnails — students
--       enrolled in any class with the unit assigned can read; teachers
--       with verifyTeacherHasUnit can read; platform admins read all).
--       No new bucket needed.
--
-- IDEMPOTENCE: ADD COLUMN IF NOT EXISTS — safe to re-run.
-- No DEFAULT (Lesson #38: ADD COLUMN DEFAULT silently overrides
-- conditional UPDATEs). New rows naturally take NULL; the app sets the
-- column on first successful upload.
--
-- ROLLBACK: paired .down.sql drops the column. Safety guard refuses if
--   any row has diagram_url set (= teacher uploaded a diagram).

ALTER TABLE public.unit_briefs
  ADD COLUMN IF NOT EXISTS diagram_url TEXT;

COMMENT ON COLUMN public.unit_briefs.diagram_url IS
  'Relative storage-proxy URL for a teacher-uploaded spec diagram. '
  'Format: /api/storage/unit-images/<unitId>/brief-diagram-<timestamp>.jpg. '
  'NULL when no diagram has been uploaded. One diagram per unit; '
  're-upload replaces both the storage file and this column.';

-- Sanity check (Lesson #38: assert expected shape, not just non-null)
DO $$
DECLARE
  v_col_exists BOOLEAN;
  v_is_nullable TEXT;
  v_data_type TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'unit_briefs'
      AND column_name = 'diagram_url'
  ) INTO v_col_exists;
  IF NOT v_col_exists THEN
    RAISE EXCEPTION 'Migration failed: unit_briefs.diagram_url column not created';
  END IF;

  SELECT is_nullable, data_type INTO v_is_nullable, v_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'unit_briefs'
    AND column_name = 'diagram_url';

  IF v_is_nullable <> 'YES' THEN
    RAISE EXCEPTION 'Migration failed: diagram_url must be nullable, got %', v_is_nullable;
  END IF;
  IF v_data_type <> 'text' THEN
    RAISE EXCEPTION 'Migration failed: diagram_url must be TEXT, got %', v_data_type;
  END IF;

  RAISE NOTICE 'Migration unit_briefs_diagram_url applied OK: nullable TEXT column added';
END $$;
