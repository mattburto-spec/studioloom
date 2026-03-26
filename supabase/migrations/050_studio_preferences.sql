-- Migration 050: Studio preferences (mentor + theme)
-- Adds mentor_id and theme_id columns to students table.
-- These are selected during the "Set Up Your Studio" onboarding flow.
-- NULL = student hasn't completed onboarding yet (triggers the flow on first login).

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS mentor_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS theme_id TEXT DEFAULT NULL;

-- Validation via CHECK constraints
ALTER TABLE students
  ADD CONSTRAINT chk_mentor_id CHECK (mentor_id IS NULL OR mentor_id IN ('kit', 'sage', 'spark')),
  ADD CONSTRAINT chk_theme_id CHECK (theme_id IS NULL OR theme_id IN ('clean', 'bold', 'warm', 'dark'));

COMMENT ON COLUMN students.mentor_id IS 'Selected AI mentor personality (kit/sage/spark). NULL = onboarding not completed.';
COMMENT ON COLUMN students.theme_id IS 'Selected visual theme (clean/bold/warm/dark). NULL = onboarding not completed.';
