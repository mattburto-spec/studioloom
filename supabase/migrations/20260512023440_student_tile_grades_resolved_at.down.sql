-- Rollback for: student_tile_grades_resolved_at
-- Pairs with: 20260512023440_student_tile_grades_resolved_at.sql

DROP INDEX IF EXISTS student_tile_grades_resolved_at_idx;

ALTER TABLE student_tile_grades
  DROP COLUMN IF EXISTS resolved_at,
  DROP COLUMN IF EXISTS resolved_by;
