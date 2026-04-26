-- Migration 119 down: drop machine_brand column.
--
-- WARNING: data loss. Any teacher-customised brand values that
-- weren't recoverable from machine_model (the heuristic backfill's
-- gaps) are gone after this rollback. Use only for emergency
-- revert.

ALTER TABLE machine_profiles DROP COLUMN IF EXISTS machine_brand;
