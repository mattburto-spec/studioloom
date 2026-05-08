-- Rollback for: add_ai_comment_draft
-- Pairs with: 20260508124359_add_ai_comment_draft.sql

ALTER TABLE student_tile_grades
  DROP COLUMN IF EXISTS ai_comment_draft;
