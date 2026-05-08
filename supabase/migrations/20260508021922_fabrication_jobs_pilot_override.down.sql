-- Rollback for: fabrication_jobs_pilot_override
-- Pairs with: 20260508021922_fabrication_jobs_pilot_override.sql

ALTER TABLE fabrication_jobs
  DROP COLUMN IF EXISTS pilot_override_at,
  DROP COLUMN IF EXISTS pilot_override_rule_ids;
