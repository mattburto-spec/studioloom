-- Migration: student_tile_grades_resolved_at
-- Created: 20260512023440 UTC
--
-- WHY: TFL.3 C.3.3 — persistent "Mark resolved" intent for inbox
--   threads. When the AI returns NO_FOLLOWUP_SENTINEL on a got_it
--   reply (or the teacher decides the thread is closed), the inbox
--   surfaces a "Mark resolved" button. Before this migration
--   resolutions lived in browser localStorage — survived reload on
--   the same device but didn't follow the teacher across school +
--   home machines. Matt smoke 12 May 2026.
--
-- IMPACT:
--   - student_tile_grades.resolved_at TIMESTAMPTZ NULL.
--     NULL = thread still open (reply_waiting OR drafted OR no_draft).
--     Non-NULL = teacher explicitly closed the thread at that wall-
--     clock time. The inbox-loader filter hides items where
--     resolved_at IS NOT NULL UNLESS a NEW student reply landed with
--     sent_at > resolved_at (pedagogically: a fresh reply re-opens
--     the thread).
--   - student_tile_grades.resolved_by UUID NULL — FK to auth.users
--     for audit ("which teacher closed this"). Always == the class's
--     teacher_id in current single-teacher-per-class model; included
--     for future co-teacher scoping (Access Model v2).
--   - No DEFAULT (Lesson #38). NULL = never-resolved is correct for
--     every existing + future row.
--   - Partial index on resolved_at WHERE NOT NULL — keeps it small
--     (most rows are unresolved) while still supporting the loader's
--     filter.
--   - No RLS change. student_tile_grades RLS already covers; the
--     resolve route uses service-role behind requireTeacher().
--
-- ROLLBACK: paired .down.sql drops both columns + the index. Lossy —
--   resolution timestamps disappear on rollback, but no orphan-data
--   hazard (no FK consumers outside this table).

ALTER TABLE student_tile_grades
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS resolved_by UUID NULL
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS student_tile_grades_resolved_at_idx
  ON student_tile_grades (resolved_at)
  WHERE resolved_at IS NOT NULL;
