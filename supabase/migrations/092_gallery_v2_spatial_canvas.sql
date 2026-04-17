-- Migration 092: Gallery v2 — Spatial canvas foundation (GV2-1)
-- Adds display_mode to rounds (grid|canvas) and canvas_x/canvas_y to submissions.
-- Class-scoped only; public access arrives in migration 093 (GV2-2).
-- Spec: docs/projects/gallery-v2.md §10 "GV2-1"

BEGIN;

-- gallery_rounds.display_mode (default 'grid' so existing rounds are unchanged)
DO $$
BEGIN
  ALTER TABLE gallery_rounds
    ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'grid'
    CHECK (display_mode IN ('grid', 'canvas'));
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'gallery_rounds.display_mode already exists — skipping';
END $$;

-- gallery_submissions.canvas_x, canvas_y — nullable, NO default.
-- Lesson #38: NULL means "not yet positioned, use auto-layout fallback".
-- Never use DEFAULT with a conditional backfill (and we have no backfill here).
DO $$
BEGIN
  ALTER TABLE gallery_submissions
    ADD COLUMN canvas_x NUMERIC;
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'gallery_submissions.canvas_x already exists — skipping';
END $$;

DO $$
BEGIN
  ALTER TABLE gallery_submissions
    ADD COLUMN canvas_y NUMERIC;
EXCEPTION WHEN duplicate_column THEN
  RAISE NOTICE 'gallery_submissions.canvas_y already exists — skipping';
END $$;

-- Verify expected values (Lesson #38 — assert distribution, not just non-null)
-- Expected: all existing rounds have display_mode='grid' (via DEFAULT), all
-- existing submissions have NULL canvas_x/y (no backfill, nullable columns).
DO $$
DECLARE
  wrong_mode_count INT;
  wrong_xy_count INT;
BEGIN
  SELECT COUNT(*) INTO wrong_mode_count
    FROM gallery_rounds WHERE display_mode != 'grid';
  SELECT COUNT(*) INTO wrong_xy_count
    FROM gallery_submissions WHERE canvas_x IS NOT NULL OR canvas_y IS NOT NULL;
  RAISE NOTICE 'Verify: rounds with non-grid mode = % (expected 0), submissions with non-null xy = % (expected 0)',
    wrong_mode_count, wrong_xy_count;
  IF wrong_mode_count > 0 THEN
    RAISE EXCEPTION 'Unexpected non-grid rounds — expected 0, got %', wrong_mode_count;
  END IF;
  IF wrong_xy_count > 0 THEN
    RAISE EXCEPTION 'Unexpected non-null canvas positions — expected 0, got %', wrong_xy_count;
  END IF;
END $$;

COMMIT;
