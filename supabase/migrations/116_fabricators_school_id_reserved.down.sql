-- Migration 116 DOWN: drop fabricators.school_id reservation.
--
-- Drops the column. Index goes with it via CASCADE. Order doesn't
-- matter (no dependent tables reference fabricators.school_id yet —
-- FU-P will add those references later, AFTER this migration's
-- column has been promoted to NOT NULL).

ALTER TABLE fabricators DROP COLUMN IF EXISTS school_id;
