-- Rollback for: competency_assessments_event_type
-- Pairs with: 20260515051247_competency_assessments_event_type.sql

DROP INDEX IF EXISTS idx_ca_student_unit_event;

ALTER TABLE competency_assessments
  DROP COLUMN IF EXISTS event_type;
