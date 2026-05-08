-- Migration: fabrication_jobs_pilot_override
-- Created: 20260508021922 UTC
-- Phase: Preflight Pilot Mode P1 (8 May 2026)
--
-- WHY: During the early Preflight pilot the scanner can false-
--   positive a fine model into a BLOCK rule and trap the student
--   in a re-upload loop with no escape. Pilot Mode is a temporary
--   posture (controlled by `PILOT_MODE_ENABLED` constant in
--   src/lib/fabrication/pilot-mode.ts) where students can override
--   blocking rules with a strong-warning explicit-acknowledge UX.
--   The override is logged on the job so teachers and developers
--   can see what was overridden and use the data to tune the
--   ruleset before flipping pilot mode off.
--
-- IMPACT:
--   ADD COLUMN fabrication_jobs.pilot_override_at TIMESTAMPTZ NULL
--     - NULL means: no override used (normal path).
--     - Set means: student clicked "Override and proceed" with at
--       least one BLOCK rule firing on the current revision.
--     - Overwritten on each subsequent override (stores the most
--       recent override timestamp, not the first).
--   ADD COLUMN fabrication_jobs.pilot_override_rule_ids TEXT[] NULL
--     - The list of rule IDs that were force-acknowledged at
--       override time (e.g. ["R-STL-01", "R-STL-04"]). Lets the
--       dev review surface flag *which* rules students are
--       overriding most, for ruleset tuning.
--
-- ROLLBACK: paired .down.sql drops both columns.
--
-- DEPS: 098 (fabrication_jobs base table).

ALTER TABLE fabrication_jobs
  ADD COLUMN IF NOT EXISTS pilot_override_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pilot_override_rule_ids TEXT[] NULL;

COMMENT ON COLUMN fabrication_jobs.pilot_override_at IS
  'Timestamp when student used Pilot Mode "Override and proceed" to bypass BLOCK-severity rules. NULL = no override used. Set only when PILOT_MODE_ENABLED=true at submit time and >=1 BLOCK rule fired. Pilot Mode flag controlled in src/lib/fabrication/pilot-mode.ts.';

COMMENT ON COLUMN fabrication_jobs.pilot_override_rule_ids IS
  'Rule IDs (e.g. R-STL-01) that were force-acknowledged at override time. Used by /admin/preflight/flagged to surface which rules students override most often, driving ruleset tuning before Pilot Mode is disabled.';
