-- Migration 120: fabrication_jobs.machine_profile_id becomes optional;
-- lab_id + machine_category promoted to required first-class columns.
--
-- Phase 8.1d-22. Today every job is bound to a specific machine on
-- submission. Matt's S3 smoke feedback (27 Apr): "we have 2x P1P
-- and 1x P1S but they all print the same really and students don't
-- know the difference. ideally the fabricator sees just 3D printing
-- or laser cutting jobs coming in, some may specify a machine but
-- in most cases they won't, and then in fabricator mode they can
-- drag a job to an empty machine."
--
-- Schema shift:
--   - machine_profile_id  NOT NULL → NULL  (fabricator can leave it
--                                           pending until pickup)
--   - lab_id              NEW, NOT NULL    (every job belongs to a
--                                           lab — fabricator at
--                                           "3rd floor" only sees
--                                           jobs sent there)
--   - machine_category    NEW, NOT NULL    (printer / laser — drives
--                                           the per-category view)
--
-- The fabricator-side flow becomes:
--   1. Job arrives. machine_profile_id is null → it sits in the
--      "Any [category]" lane for that lab.
--   2. Fab clicks "Send to → P1S" → assign-machine endpoint sets
--      machine_profile_id. Job moves to that machine's lane.
--   3. Fab picks up + completes as before.
--
-- Existing jobs with machine_profile_id stay bound — backwards
-- compatible. The new flow is opt-in on the student side via the
-- 8.1d-22 picker change ("Any 3D printer in [lab]" default).
--
-- Migration is strictly additive on the schema (one column dropped
-- a NOT NULL, two columns added). Backfill plan:
--   1. UPDATE lab_id + machine_category from JOIN through
--      machine_profiles for jobs whose machine has them.
--   2. Fallback for orphan-machine jobs (lab_id IS NULL on the
--      machine — rare post-8.1d-2 but possible): set lab_id to the
--      teacher's default lab.
--   3. Verify zero NULLs before flipping NOT NULL.

-- ============================================================
-- 1. Add columns (nullable initially so the backfill can run)
-- ============================================================

ALTER TABLE fabrication_jobs
  ADD COLUMN IF NOT EXISTS lab_id UUID,
  ADD COLUMN IF NOT EXISTS machine_category TEXT;

-- Add the FK + CHECK constraints up front. They don't fire on
-- pre-existing rows (rows without lab_id are still nullable until
-- step 4 below), but adding them now means new INSERTs during the
-- migration window respect them.
DO $$ BEGIN
  -- Skip if already present (idempotent rerun safety).
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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fabrication_jobs_machine_category_check'
  ) THEN
    ALTER TABLE fabrication_jobs
      ADD CONSTRAINT fabrication_jobs_machine_category_check
      CHECK (machine_category IN ('3d_printer', 'laser_cutter'));
  END IF;
END $$;

-- ============================================================
-- 2. Backfill — primary pass: from the bound machine
-- ============================================================
-- Most jobs (probably 100% before this migration) have a non-null
-- machine_profile_id; copy lab_id + machine_category from there.

UPDATE fabrication_jobs job
SET
  lab_id = mp.lab_id,
  machine_category = mp.machine_category
FROM machine_profiles mp
WHERE job.machine_profile_id = mp.id
  AND (job.lab_id IS NULL OR job.machine_category IS NULL);

-- ============================================================
-- 3. Backfill — fallback: orphan-machine jobs use teacher's default lab
-- ============================================================
-- A machine with NULL lab_id (orphan from a deleted lab — see
-- Phase 8.1d cascade SET NULL behaviour) leaves its jobs without a
-- lab after step 2. Slot them into the teacher's default lab so the
-- migration can flip lab_id to NOT NULL. Teacher's default lab is
-- guaranteed to exist post-Phase-8 backfill (migration 114).

UPDATE fabrication_jobs job
SET lab_id = lab.id
FROM fabrication_labs lab
WHERE job.lab_id IS NULL
  AND lab.teacher_id = job.teacher_id
  AND lab.is_default = true;

-- machine_category is harder to fall back on if even the machine
-- row is gone (deleted or NULL category). Defensive default: rows
-- whose machine has NULL machine_category get '3d_printer' since
-- printers are the dominant case. Any flagged drift surfaces in
-- the post-migration probe below.

UPDATE fabrication_jobs job
SET machine_category = '3d_printer'
WHERE job.machine_category IS NULL;

-- ============================================================
-- 4. Verify zero NULLs before flipping NOT NULL
-- ============================================================
-- Hard-fail the migration here if backfill missed anything. Better
-- to bail than to flip NOT NULL on a partial backfill and then
-- need a forensic recovery.

DO $$
DECLARE
  null_lab_count INT;
  null_cat_count INT;
BEGIN
  SELECT COUNT(*) INTO null_lab_count
  FROM fabrication_jobs WHERE lab_id IS NULL;
  SELECT COUNT(*) INTO null_cat_count
  FROM fabrication_jobs WHERE machine_category IS NULL;
  IF null_lab_count > 0 THEN
    RAISE EXCEPTION
      'Migration 120 backfill incomplete: % rows have NULL lab_id. '
      'Investigate before retrying.', null_lab_count;
  END IF;
  IF null_cat_count > 0 THEN
    RAISE EXCEPTION
      'Migration 120 backfill incomplete: % rows have NULL machine_category. '
      'Investigate before retrying.', null_cat_count;
  END IF;
END $$;

-- ============================================================
-- 5. Flip the constraints
-- ============================================================

ALTER TABLE fabrication_jobs
  ALTER COLUMN lab_id           SET NOT NULL,
  ALTER COLUMN machine_category SET NOT NULL,
  ALTER COLUMN machine_profile_id DROP NOT NULL;

-- ============================================================
-- 6. Indexes for the new query patterns
-- ============================================================
-- Fab queue groups by (lab_id, machine_category, machine_profile_id IS NULL).
-- Index covering the first two columns supports the per-category
-- per-lab "Any X" lane queries.

CREATE INDEX IF NOT EXISTS idx_fabrication_jobs_lab_category
  ON fabrication_jobs (lab_id, machine_category);

-- Index on jobs that haven't been assigned to a specific machine
-- (the fab queue's "Any X" lane). Partial — most jobs SHOULD have
-- a machine binding eventually so the index stays small.
CREATE INDEX IF NOT EXISTS idx_fabrication_jobs_unassigned
  ON fabrication_jobs (lab_id, machine_category)
  WHERE machine_profile_id IS NULL;

-- ============================================================
-- Sanity probes (run separately in Supabase dashboard):
--   SELECT machine_category, COUNT(*) FROM fabrication_jobs
--   GROUP BY machine_category;
--   -- expect: 3d_printer | N, laser_cutter | M
--
--   SELECT COUNT(*) FILTER (WHERE machine_profile_id IS NULL) AS unassigned,
--          COUNT(*) FILTER (WHERE machine_profile_id IS NOT NULL) AS bound
--   FROM fabrication_jobs;
--   -- pre-migration: bound = total, unassigned = 0
--   -- post-migration: same (no row should be unassigned after a
--   --                       backfill — only NEW jobs from the new
--   --                       student-picker flow create unassigned)
-- ============================================================
