-- Migration: add_ai_comment_draft
-- Created: 20260508124359 UTC
--
-- WHY: G3.1 — let Haiku draft the student-facing comment alongside the
--   score + evidence quote. Persist the AI draft separately from the
--   live student_facing_comment so the teacher can come back later +
--   review without losing the suggestion. Once the teacher edits +
--   clicks "Send to student", the value transfers to
--   student_facing_comment (existing column from G2.3) and the student
--   sees it. The draft column stays for audit/diff purposes (was the
--   AI helpful?).
--
-- IMPACT:
--   - student_tile_grades gains TEXT column ai_comment_draft.
--
-- ROLLBACK: paired .down.sql drops the column.

ALTER TABLE student_tile_grades
  ADD COLUMN IF NOT EXISTS ai_comment_draft TEXT;
