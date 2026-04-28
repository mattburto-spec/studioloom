-- Rollback for: restore_fabrication_jobs_lab_fk
-- Pairs with: 20260428041707_restore_fabrication_jobs_lab_fk.sql

ALTER TABLE fabrication_jobs
  DROP CONSTRAINT IF EXISTS fabrication_jobs_lab_id_fkey;

NOTIFY pgrst, 'reload schema';
