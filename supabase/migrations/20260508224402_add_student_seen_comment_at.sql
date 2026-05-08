-- Migration: add_student_seen_comment_at
-- Created: 20260508224402 UTC
--
-- WHY: TFL.1 — read receipts on per-tile teacher feedback. Captures the
--   timestamp of the student's most recent lesson view that surfaced
--   this comment. Drives the teacher's marking-page row chip ("seen" /
--   "unread" / amber after 48h) so teachers can tell whether to follow
--   up. NULL = student has never opened the lesson since the comment
--   landed. Compared against `updated_at` in UI to flag "seen the OLD
--   version" when the teacher edits the comment after a prior view.
--
-- IMPACT:
--   - student_tile_grades.student_seen_comment_at TIMESTAMPTZ NULL.
--   - No DEFAULT (Lesson #38). NULL = unread is the natural starting
--     state for every existing + future row; no conditional backfill
--     needed.
--   - Bumped by GET /api/student/tile-comments on each lesson load
--     (one round-trip; idempotent).
--   - No RLS change. student_tile_grades RLS already covers the column;
--     the API uses service-role and gates by requireStudentSession.
--
-- ROLLBACK: paired .down.sql drops the column. Lossy — receipts disappear
--   on rollback, but no orphan-data hazard (no FK consumers).

ALTER TABLE student_tile_grades
  ADD COLUMN IF NOT EXISTS student_seen_comment_at TIMESTAMPTZ NULL;
