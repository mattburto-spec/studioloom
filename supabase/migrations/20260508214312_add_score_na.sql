-- Migration: add_score_na
-- Created: 20260508214312 UTC
--
-- WHY: Polish-3 — let teachers mark a tile "NA" (not applicable) instead
--   of forcing every cell to carry a number. Some lessons have content-only
--   tiles, formative-only check-ins, or activities the student wasn't in
--   class for. Today the workflow is "leave it null and don't confirm",
--   which mixes ungraded with NA in queries + makes the coverage heatmap
--   wrong (the tile shows up as "needs grading" forever).
--
-- IMPACT:
--   - student_tile_grades.score_na BOOLEAN NOT NULL DEFAULT false.
--   - When true: score is null, confirmed = true, the row is "intentionally
--     ungraded". Rollup helper excludes NA rows from criterion averages;
--     coverage heatmap counts NA as covered.
--
-- ROLLBACK: paired .down.sql drops the column.

ALTER TABLE student_tile_grades
  ADD COLUMN IF NOT EXISTS score_na BOOLEAN NOT NULL DEFAULT false;
