-- Migration 096: fabrication_scan_jobs queue table + RLS (deny-all)
--
-- Preflight Phase 1A-4. Work queue consumed by the Python scanner worker
-- (Fly.io, arrives in Phase 2). One row per scan attempt.
--
-- Relationship with fabrication_job_revisions.scan_status:
--   This table = the work queue, mutable, source of truth for worker state.
--   fabrication_job_revisions.scan_status = cached denormalization for
--     teacher-dashboard display (avoids JOIN under teacher RLS).
--   Worker updates both on each state transition (write-through). Worker is
--   the only writer; never updated from the app layer.
--
-- RLS: deny-all for authenticated users. Service role (scanner worker, admin
-- backfills) bypasses RLS entirely. No teacher/student/fabricator needs this
-- table. Pattern is intentional and parallels student_sessions /
-- ai_model_config — will surface on scan-rls-coverage as "rls_enabled_no_policy"
-- but that's correct behaviour. Documented here + in schema-registry.
--
-- Refs:
--   - Spec:     docs/projects/fabrication-pipeline.md §12 (worker infra)
--   - Brief:    docs/projects/preflight-phase-1a-brief.md (1A-4)
--   - Decisions: D-10 (WIRING draft)
--   - Lessons:  #24 (idempotent), #44 (simplicity — only columns the worker needs),
--              #45 (surgical — no speculative auto-retry backoff config here)

-- ============================================================
-- 1. Create table
-- ============================================================

CREATE TABLE IF NOT EXISTS fabrication_scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_revision_id UUID NOT NULL REFERENCES fabrication_job_revisions(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'done', 'error'
  )),

  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,

  -- Worker lease
  locked_by TEXT,                  -- Fly.io machine id or equivalent worker identifier
  locked_at TIMESTAMPTZ,           -- when the worker took the lease; used for stale-lease recovery

  error_detail TEXT,               -- last error message if status = 'error'

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================

-- Queue polling index: worker picks next pending job
CREATE INDEX IF NOT EXISTS idx_fabrication_scan_jobs_queue
  ON fabrication_scan_jobs(created_at)
  WHERE status = 'pending';

-- Stale-lease recovery: find running jobs locked longer than threshold
CREATE INDEX IF NOT EXISTS idx_fabrication_scan_jobs_running_leases
  ON fabrication_scan_jobs(locked_at)
  WHERE status = 'running';

-- Max one active (pending or running) job per revision — prevents double-scan races
CREATE UNIQUE INDEX IF NOT EXISTS uq_fabrication_scan_jobs_active_per_revision
  ON fabrication_scan_jobs(job_revision_id)
  WHERE status IN ('pending', 'running');

-- ============================================================
-- 3. updated_at trigger
-- ============================================================

DROP TRIGGER IF EXISTS trigger_fabrication_scan_jobs_updated_at ON fabrication_scan_jobs;
CREATE TRIGGER trigger_fabrication_scan_jobs_updated_at
  BEFORE UPDATE ON fabrication_scan_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. RLS: deny-all
-- ============================================================
-- Deliberately no policies. Service role bypasses RLS; authenticated users
-- get no access. Matches the pattern documented in FU-FF (ai_model_config,
-- student_sessions). The scan-rls-coverage scanner will flag this as
-- `rls_enabled_no_policy` — that's intentional, not drift.

ALTER TABLE fabrication_scan_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Post-apply verification (run in dashboard separately)
-- ============================================================
--   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'fabrication_scan_jobs';
--   -- Expect: fabrication_scan_jobs | t
--
--   SELECT COUNT(*) FROM pg_policies WHERE tablename = 'fabrication_scan_jobs';
--   -- Expect: 0  (deny-all pattern — service role bypasses)
--
--   SELECT COUNT(*) FROM fabrication_scan_jobs;
--   -- Expect: 0
--
--   -- Unique index enforces one-active-per-revision (run after 1A-5 + seed data exists;
--   -- for now just verify its existence):
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'fabrication_scan_jobs'
--   ORDER BY indexname;
--   -- Expect 4: primary key + 3 indexes
--   --   fabrication_scan_jobs_pkey
--   --   idx_fabrication_scan_jobs_queue
--   --   idx_fabrication_scan_jobs_running_leases
--   --   uq_fabrication_scan_jobs_active_per_revision
