-- Rollback for: fix_grading_v1_page_id_type
-- Pairs with: 20260428024002_fix_grading_v1_page_id_type.sql
--
-- Reverses page_id from TEXT back to UUID. Safe only while the column is
-- empty or contains only valid UUID strings — non-UUID values would fail
-- the cast.

ALTER TABLE student_tile_grades
  ALTER COLUMN page_id TYPE UUID USING page_id::UUID;
