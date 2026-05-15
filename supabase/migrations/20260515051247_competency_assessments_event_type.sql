-- Migration: competency_assessments_event_type
-- Created: 20260515051247 UTC
--
-- WHY: teacher writes to competency_assessments currently all use
-- source='teacher_observation' regardless of which UI surface produced
-- the row. Calibration sessions (the deliberate 2-min chat flow in
-- /teacher/units/.../attention) are conceptually distinct from ad-hoc
-- observations made via Teaching Mode or NM Results inline rating, but
-- we have no way to tell them apart in the history. This column lets
-- us badge calibration rows in the UI and filter/report on them later.
--
-- IMPACT:
--   - competency_assessments gains `event_type TEXT NOT NULL DEFAULT 'observation'`
--     with a CHECK constraint on ('observation','calibration').
--   - All existing rows backfill to 'observation' via the DEFAULT.
--   - Index added on (student_id, unit_id, event_type) to keep the
--     drill-down + calibration-history filters fast.
--   - No RLS policy changes — existing teacher_observation policy
--     already covers all rows regardless of event_type.
--
-- ROLLBACK: paired .down.sql drops the column + index.

ALTER TABLE competency_assessments
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'observation'
  CHECK (event_type IN ('observation', 'calibration'));

CREATE INDEX IF NOT EXISTS idx_ca_student_unit_event
  ON competency_assessments(student_id, unit_id, event_type);
