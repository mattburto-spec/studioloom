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
--
-- Phase 8.1d-39 (audit MED-6, retroactive guard added 28 Apr):
-- the original Phase 8-1 draft created `fabrication_labs` in
-- migration 113. After 27 Apr's school-scoped revision deleted
-- 113 and replaced it with a timestamp-prefixed migration that
-- sorts AFTER 120 in lex order, this DO block was at risk of
-- failing on fresh-install runs ("relation fabrication_labs does
-- not exist"). The added guard skips the FK creation if the
-- target table doesn't exist yet — the follow-up migration
-- 20260428041707_restore_fabrication_jobs_lab_fk.sql then adds
-- the constraint after fabrication_labs is created. Existing
-- prod databases already have the FK from 25 Apr's apply; this
-- guard is a no-op for them (the NOT EXISTS check at the
-- constraint level catches that case).
DO $$ BEGIN
  -- Skip if the target table doesn't exist yet (fresh-install
  -- ordering — see header comment for the full story).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'fabrication_labs'
  ) THEN
    RAISE NOTICE 'Skipping fabrication_jobs_lab_id_fkey creation '
      'in migration 120: fabrication_labs table does not exist '
      'yet (fresh install). The FK will be added by '
      '20260428041707_restore_fabrication_jobs_lab_fk.sql once '
      'the labs table is created.';
  -- Skip if already present (idempotent rerun safety).
  ELSIF NOT EXISTS (
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
-- 2-3. Backfill — wrapped in fresh-install guard (8.1d-39 audit MED-6).
-- ============================================================
-- The entire backfill block is wrapped in a check for
-- fabrication_labs existence, AND the fallback block ALSO checks
-- for fabrication_labs.teacher_id + is_default columns existing.
-- Why:
--   - Fresh install: fabrication_labs doesn't exist → no jobs to
--     backfill (0 rows in fabrication_jobs) → entire block is a
--     safe no-op.
--   - Prod re-run: fabrication_labs may exist but with the new
--     school-scoped schema (no teacher_id, no is_default) — block
--     is no-op there too because jobs already have lab_id set.
--   - Original 25 Apr apply: both legacy columns existed, backfill
--     ran successfully → all jobs got lab_id.
-- The COLUMN existence check uses information_schema.columns; the
-- fresh-install COLUMN check uses pg_class because column lookups
-- on a missing table return 0 rows (safe), but explicit table
-- check makes the intent obvious.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'fabrication_labs'
  ) THEN
    -- Step 2: primary backfill from machine_profiles
    UPDATE fabrication_jobs job
    SET
      lab_id = mp.lab_id,
      machine_category = mp.machine_category
    FROM machine_profiles mp
    WHERE job.machine_profile_id = mp.id
      AND (job.lab_id IS NULL OR job.machine_category IS NULL);

    -- Step 3: fallback to teacher's default lab — only runs if the
    -- legacy columns exist (24 Apr schema). Post-revision (27 Apr
    -- school-scoped) these columns are gone, so the fallback is a
    -- no-op. Existing jobs missing lab_id at that point would be
    -- handled by the new Phase 8-1 backfill migration instead.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'fabrication_labs'
        AND column_name = 'is_default'
    ) THEN
      UPDATE fabrication_jobs job
      SET lab_id = lab.id
      FROM fabrication_labs lab
      WHERE job.lab_id IS NULL
        AND lab.teacher_id = job.teacher_id
        AND lab.is_default = true;
    END IF;

    -- machine_category fallback: independent of fabrication_labs.
    UPDATE fabrication_jobs job
    SET machine_category = '3d_printer'
    WHERE job.machine_category IS NULL;
  ELSE
    RAISE NOTICE 'Skipping migration 120 backfill: fabrication_labs '
      'table does not exist yet (fresh install). The new Phase 8-1 '
      'backfill (20260427135108_backfill_fabrication_labs.sql) will '
      'handle lab_id population once the labs table is created.';
  END IF;
END $$;

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
