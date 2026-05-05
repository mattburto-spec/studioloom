-- Rollback for: fabrication_jobs_preferred_color
-- Pairs with: 20260505010732_fabrication_jobs_preferred_color.sql

ALTER TABLE fabrication_jobs
  DROP COLUMN IF EXISTS preferred_color;
