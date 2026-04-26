-- Migration 120 down: reverse the column adds + restore NOT NULL on
-- machine_profile_id.
--
-- WARNING: data loss if any post-120 jobs were submitted with
-- machine_profile_id IS NULL — those rows would fail the NOT NULL
-- restore. The rollback path is intentionally hard: don't roll
-- back unless you've also backfilled machine_profile_id for every
-- "Any X" job (e.g. by deleting them or assigning them all to a
-- placeholder machine).

DROP INDEX IF EXISTS idx_fabrication_jobs_unassigned;
DROP INDEX IF EXISTS idx_fabrication_jobs_lab_category;

ALTER TABLE fabrication_jobs
  ALTER COLUMN machine_profile_id SET NOT NULL;

ALTER TABLE fabrication_jobs
  DROP CONSTRAINT IF EXISTS fabrication_jobs_machine_category_check,
  DROP CONSTRAINT IF EXISTS fabrication_jobs_lab_id_fkey;

ALTER TABLE fabrication_jobs
  DROP COLUMN IF EXISTS lab_id,
  DROP COLUMN IF EXISTS machine_category;
