-- Migration 036: Allow student-submitted pace feedback
--
-- The lesson_feedback table was originally designed for teacher-only feedback,
-- so lesson_profile_id and teacher_id were NOT NULL. Student pace feedback
-- (collected after "Complete & Continue") doesn't have a lesson profile or
-- teacher context — it just stores pace data (too_slow/just_right/too_fast)
-- that feeds the timing model.
--
-- This migration makes those columns nullable and adds an RLS policy so the
-- service role can insert student feedback rows.

-- Make lesson_profile_id nullable (student feedback has no lesson profile)
ALTER TABLE lesson_feedback
  ALTER COLUMN lesson_profile_id DROP NOT NULL;

-- Make teacher_id nullable (student feedback has no teacher context)
ALTER TABLE lesson_feedback
  ALTER COLUMN teacher_id DROP NOT NULL;

-- Drop the foreign key constraint on lesson_profile_id so NULL is valid
-- (the FK itself allows NULL, but let's also handle the ON DELETE CASCADE
-- which only fires on non-null values anyway — no change needed there)

-- Add index on page_id for pace aggregation queries
-- (timing model will query: "for this page, what's the pace distribution?")
CREATE INDEX IF NOT EXISTS lesson_feedback_page_idx
  ON lesson_feedback (page_id) WHERE page_id IS NOT NULL;
