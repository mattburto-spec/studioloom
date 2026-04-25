-- Migration 117 DOWN: drop classes.school_id reservation.
--
-- Drops the column. Index goes with it via CASCADE. No dependent
-- tables yet (FU-P will add references later, AFTER this column is
-- promoted to NOT NULL).

ALTER TABLE classes DROP COLUMN IF EXISTS school_id;
