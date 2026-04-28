-- Migration: restore_fabrication_jobs_lab_fk
-- Created: 20260428041707 UTC
-- Phase: Preflight Phase 8.1d-37 (recovery follow-up)
--
-- WHY: When the Phase 8-1 prod recovery (28 Apr) ran
--   `DROP TABLE fabrication_labs CASCADE` to undo the OLD 24 Apr
--   teacher-scoped schema before applying the new school-scoped
--   migration, the cascade dropped the FK constraint
--   `fabrication_jobs_lab_id_fkey` that migration 120 had
--   originally created. The new schema migration
--   (20260427134953_fabrication_labs.sql) recreates fabrication_labs
--   but does NOT touch fabrication_jobs.lab_id (that column is owned
--   by migration 120, not Phase 8-1).
--
--   Symptom: PostgREST's schema cache lost the relationship between
--   fabrication_jobs and fabrication_labs. The /fab/queue/printer
--   page rendered with "Fabricator queue lookup failed: Could not
--   find a relationship between 'fabrication_jobs' and
--   'fabrication_labs' in the schema cache" because the queue's
--   listFabricatorQueue join `fabrication_labs(name)` couldn't
--   auto-resolve.
--
--   This migration restores the FK constraint with the same shape
--   migration 120 originally specified (ON DELETE SET NULL: if a
--   lab is deleted, jobs fall back to "no lab" rather than cascading
--   the deletion).
--
-- IDEMPOTENT: guarded with NOT EXISTS so re-running is safe — Matt
--   already ran the equivalent ALTER manually in prod via the
--   Supabase SQL Editor; this DO block no-ops on the second
--   application.
--
-- IMPACT: adds 1 FK constraint on fabrication_jobs(lab_id). No
--   data changes. PostgREST refreshes its schema cache (notified
--   below) so the embedded-select queries work again.
--
-- ROLLBACK: paired .down.sql drops the constraint.
--
-- BRIEF: docs/projects/preflight-phase-8-1-prod-smoke.md (section
--   on recovery — "DROP TABLE CASCADE side effects").

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fabrication_jobs_lab_id_fkey'
  ) THEN
    ALTER TABLE fabrication_jobs
      ADD CONSTRAINT fabrication_jobs_lab_id_fkey
      FOREIGN KEY (lab_id) REFERENCES fabrication_labs(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Notify PostgREST to refresh its schema cache so the new FK is
-- visible to embedded-select queries (e.g. fabrication_labs(name)
-- in listFabricatorQueue).
NOTIFY pgrst, 'reload schema';
