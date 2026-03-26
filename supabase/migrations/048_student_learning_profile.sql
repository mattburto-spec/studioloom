-- Migration 048: Student Learning Profile (intake survey)
-- Adds a JSONB column to students for lightweight self-reported profile data.
-- Research-backed (Hattie effect sizes): languages spoken → ELL scaffolding,
-- countries lived in → cultural background, feedback preference → private/public.
-- Collected once at first login via 3-question onboarding survey.

ALTER TABLE students
ADD COLUMN IF NOT EXISTS learning_profile JSONB DEFAULT NULL;

-- learning_profile shape:
-- {
--   "languages_at_home": ["English", "Mandarin"],
--   "countries_lived_in": ["Australia", "China"],
--   "feedback_preference": "private" | "public",
--   "collected_at": "2026-03-26T..."
-- }

COMMENT ON COLUMN students.learning_profile IS 'Self-reported intake survey: languages, countries, feedback preference. Collected once at first login. Feeds AI scaffolding and peer grouping.';
