-- Migration 095: fabrication_jobs + fabrication_job_revisions + RLS
--
-- Preflight Phase 1A-3. The core submission tables.
--
-- Two tables:
--   fabrication_jobs           — one row per logical submission
--   fabrication_job_revisions  — one row per upload attempt (versioned)
--
-- Retention model (D-04): when status transitions to 'completed' / 'rejected',
-- `retention_clock_started_at` is set by application code (Phase 2+). A daily
-- cron deletes raw file from Storage at day 30 and NULLs `storage_path` on
-- revisions. Scan results + thumbnails retained indefinitely. Cron itself
-- lands in Phase 9 — this migration only provides the column.
--
-- RLS model:
--   Teacher SELECT/UPDATE sees jobs where:
--     (a) teacher_id = auth.uid()  (direct ownership, covers NULL class_id)
--     OR
--     (b) class_id is in teacher's classes
--
--   This is NOT the full Lesson #29 UNION pattern (junction + legacy student
--   cross-join) because we have a direct teacher_id column — there's no
--   student-mediated ambiguity here. The fallback to direct ownership via
--   teacher_id covers NULL-class_id cases cleanly.
--
--   Students (token session, auth.uid() IS NULL) and Fabricators (separate
--   auth table, Phase 1A-5) write via service role with API-level scope
--   enforcement. No INSERT/DELETE policies are declared for the regular
--   authenticated role.
--
-- Refs:
--   - Spec:      docs/projects/fabrication-pipeline.md §11
--   - Decisions: docs/projects/fabrication/phase-0-decisions.md (D-04 retention, D-06 no work_items FK)
--   - Lessons:   #4 (student token auth), #24 (idempotent guards), #29 (related but not identical), #38 (verify expected values), #45 (surgical)
--
-- Note on lab_tech_picked_up_by:
--   Stored as raw UUID — no FK to fabricators(id) because that table lands in
--   migration 097 (1A-5). Adding the FK later is a separate, optional hardening
--   step; v1 enforces validity at the application layer.

-- ============================================================
-- 1. Table: fabrication_jobs
-- ============================================================

CREATE TABLE IF NOT EXISTS fabrication_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership / scope
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,

  -- Machine scope (RESTRICT: can't delete profile while jobs reference it)
  machine_profile_id UUID NOT NULL REFERENCES machine_profiles(id),

  -- File metadata
  file_type TEXT NOT NULL CHECK (file_type IN ('stl', 'svg')),
  original_filename TEXT NOT NULL,

  -- Workflow state (spec §11 status diagram)
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded',
    'scanning',
    'needs_revision',
    'pending_approval',
    'approved',
    'picked_up',
    'completed',
    'rejected',
    'cancelled'
  )),

  current_revision INT NOT NULL DEFAULT 1,

  -- Denormalised scan results from latest revision (query speed)
  latest_scan_results JSONB,
  scan_ruleset_version TEXT,

  -- Soft-gate acknowledgements: [{rule_id, ack_at}]
  acknowledged_warnings JSONB,

  -- Teacher review
  teacher_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  teacher_reviewed_at TIMESTAMPTZ,
  teacher_review_note TEXT,

  -- Lab-tech pickup (Fabricator id — FK added in future hardening)
  lab_tech_picked_up_by UUID,
  lab_tech_picked_up_at TIMESTAMPTZ,

  -- Completion
  completion_status TEXT CHECK (completion_status IS NULL OR completion_status IN (
    'printed', 'cut', 'failed'
  )),
  completion_note TEXT,
  completed_at TIMESTAMPTZ,

  -- Retention clock (D-04): set when status → 'completed' / 'rejected'
  retention_clock_started_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes: fabrication_jobs
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_fabrication_jobs_teacher_status
  ON fabrication_jobs(teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_fabrication_jobs_student_status
  ON fabrication_jobs(student_id, status);

CREATE INDEX IF NOT EXISTS idx_fabrication_jobs_class_id
  ON fabrication_jobs(class_id)
  WHERE class_id IS NOT NULL;

-- Lab tech queue: "what's approved for this machine?"
CREATE INDEX IF NOT EXISTS idx_fabrication_jobs_machine_status
  ON fabrication_jobs(machine_profile_id, status);

-- Retention cron scan target
CREATE INDEX IF NOT EXISTS idx_fabrication_jobs_retention
  ON fabrication_jobs(retention_clock_started_at)
  WHERE retention_clock_started_at IS NOT NULL;

-- ============================================================
-- 3. updated_at trigger: fabrication_jobs
-- ============================================================

DROP TRIGGER IF EXISTS trigger_fabrication_jobs_updated_at ON fabrication_jobs;
CREATE TRIGGER trigger_fabrication_jobs_updated_at
  BEFORE UPDATE ON fabrication_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. Table: fabrication_job_revisions
-- ============================================================

CREATE TABLE IF NOT EXISTS fabrication_job_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES fabrication_jobs(id) ON DELETE CASCADE,
  revision_number INT NOT NULL,

  -- storage_path NULLABLE: set on upload, NULLed by retention cron at day 30 (D-04)
  storage_path TEXT,
  thumbnail_path TEXT,
  file_size_bytes BIGINT,

  -- Scan lifecycle
  scan_started_at TIMESTAMPTZ,
  scan_completed_at TIMESTAMPTZ,
  scan_ruleset_version TEXT,
  scan_results JSONB,
  scan_status TEXT CHECK (scan_status IS NULL OR scan_status IN (
    'pending', 'running', 'done', 'error'
  )),
  scan_error TEXT,

  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (job_id, revision_number)
);

-- ============================================================
-- 5. Indexes: fabrication_job_revisions
-- ============================================================

-- Scanner queue polling (pending/running lookups)
CREATE INDEX IF NOT EXISTS idx_fabrication_job_revisions_scan_status
  ON fabrication_job_revisions(scan_status)
  WHERE scan_status IN ('pending', 'running');

-- (job_id, revision_number) already uniquely indexed via UNIQUE constraint.

-- ============================================================
-- 6. RLS: fabrication_jobs (teacher SELECT + UPDATE)
-- ============================================================

ALTER TABLE fabrication_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fabrication_jobs_select_teacher ON fabrication_jobs;
CREATE POLICY fabrication_jobs_select_teacher
  ON fabrication_jobs
  FOR SELECT
  USING (
    teacher_id = auth.uid()
    OR
    (class_id IS NOT NULL AND class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS fabrication_jobs_update_teacher ON fabrication_jobs;
CREATE POLICY fabrication_jobs_update_teacher
  ON fabrication_jobs
  FOR UPDATE
  USING (
    teacher_id = auth.uid()
    OR
    (class_id IS NOT NULL AND class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    ))
  )
  WITH CHECK (
    teacher_id = auth.uid()
    OR
    (class_id IS NOT NULL AND class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    ))
  );

-- No INSERT/DELETE policies: those paths are service-role only.
-- Students, fabricators, and scanner worker write via service role.

-- ============================================================
-- 7. RLS: fabrication_job_revisions (teacher SELECT — inherits via parent)
-- ============================================================

ALTER TABLE fabrication_job_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fabrication_job_revisions_select_teacher ON fabrication_job_revisions;
CREATE POLICY fabrication_job_revisions_select_teacher
  ON fabrication_job_revisions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fabrication_jobs j
      WHERE j.id = fabrication_job_revisions.job_id
        AND (
          j.teacher_id = auth.uid()
          OR
          (j.class_id IS NOT NULL AND j.class_id IN (
            SELECT id FROM classes WHERE teacher_id = auth.uid()
          ))
        )
    )
  );

-- No other policies: all writes via service role (scanner worker, app code).

-- ============================================================
-- 8. Post-apply verification (run as separate queries in the dashboard)
-- ============================================================
-- Skipping DO $$ blocks (Supabase dashboard parser issue from 093). Instead:
--
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('fabrication_jobs', 'fabrication_job_revisions');
--   -- Expect both | t
--
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename IN ('fabrication_jobs', 'fabrication_job_revisions')
--   ORDER BY tablename, cmd, policyname;
--   -- Expect 3 rows total:
--   --   fabrication_jobs            | fabrication_jobs_select_teacher            | SELECT
--   --   fabrication_jobs            | fabrication_jobs_update_teacher            | UPDATE
--   --   fabrication_job_revisions   | fabrication_job_revisions_select_teacher   | SELECT
--
--   SELECT COUNT(*) FROM fabrication_jobs;                   -- Expect 0
--   SELECT COUNT(*) FROM fabrication_job_revisions;          -- Expect 0
--
--   -- CHECK on status enum (inside BEGIN/ROLLBACK):
--   BEGIN;
--     INSERT INTO fabrication_jobs (teacher_id, student_id, machine_profile_id, file_type, original_filename, status)
--     VALUES (gen_random_uuid(), gen_random_uuid(), (SELECT id FROM machine_profiles LIMIT 1), 'stl', 't.stl', 'bogus_status');
--     -- Expect ERROR: violates check constraint on status
--   ROLLBACK;
