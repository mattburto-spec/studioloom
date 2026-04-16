-- Migration 086: Allow 'ai_upload' as a timetable source
--
-- The school_timetable.source column has a CHECK constraint limiting
-- values to ('manual', 'ical'). The onboarding wizard now creates
-- timetables from AI-parsed uploads and needs 'ai_upload' as a valid
-- source value.

ALTER TABLE school_timetable DROP CONSTRAINT IF EXISTS school_timetable_source_check;
ALTER TABLE school_timetable ADD CONSTRAINT school_timetable_source_check
  CHECK (source IN ('manual', 'ical', 'ai_upload'));
