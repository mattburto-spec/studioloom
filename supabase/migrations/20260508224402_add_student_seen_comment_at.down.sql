-- Rollback for: add_student_seen_comment_at
-- Pairs with: 20260508224402_add_student_seen_comment_at.sql

ALTER TABLE student_tile_grades
  DROP COLUMN IF EXISTS student_seen_comment_at;
