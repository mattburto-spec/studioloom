-- Rollback for: add_student_facing_comment
-- Pairs with: 20260428065351_add_student_facing_comment.sql

ALTER TABLE student_tile_grades
  DROP COLUMN IF EXISTS student_facing_comment;
