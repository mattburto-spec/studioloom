-- Migration: add_student_facing_comment
-- Created: 20260428065351 UTC
--
-- WHY: G2.3 — anchored inline feedback. Teachers can attach a per-tile
--   comment that the student sees inside their lesson. The new field
--   sits on student_tile_grades alongside the existing teacher-private
--   `override_note` (so we keep the (student, unit, page, tile, class)
--   grain rather than introducing a new table). One comment per tile
--   per student, replaced on edit, visible to the student as soon as
--   it's saved (no separate release toggle in v1 — the row's existence
--   plus a non-null comment IS the contract).
--
-- IMPACT:
--   - student_tile_grades gains TEXT column student_facing_comment.
--   - No new RLS policies. Students don't use Supabase Auth (custom
--     session tokens) — the student-side read API gates by session
--     token + student_id match, then queries via service role.
--
-- ROLLBACK: paired .down.sql drops the column. Any comments are lost.

ALTER TABLE student_tile_grades
  ADD COLUMN IF NOT EXISTS student_facing_comment TEXT;
