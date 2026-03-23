-- Migration 044: Add cycle_day_events JSONB to school_timetable
-- Stores authoritative cycle day markers from iCal import
-- so persistent calendar view uses the same data as fresh import.

ALTER TABLE school_timetable
ADD COLUMN IF NOT EXISTS cycle_day_events JSONB DEFAULT '[]';

-- Also add a comment for documentation
COMMENT ON COLUMN school_timetable.cycle_day_events IS 'Authoritative cycle day markers from iCal import. Array of {date, cycleDay, summary}.';
