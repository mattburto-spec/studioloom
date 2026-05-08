-- Rollback for: add_score_na
-- Pairs with: 20260508214312_add_score_na.sql

ALTER TABLE student_tile_grades
  DROP COLUMN IF EXISTS score_na;
