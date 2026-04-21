-- Migration 104: claim_next_scan_job RPC for the Preflight scanner worker
--
-- Preflight Phase 2A-6a. Adds one Postgres function that the Python worker
-- calls each poll cycle. The function atomically claims the oldest pending
-- row in fabrication_scan_jobs using SELECT ... FOR UPDATE SKIP LOCKED so
-- multiple worker instances (future scaling) cannot grab the same row.
--
-- The worker side stays simple: one RPC call per poll, returns either a
-- single joined row or zero rows. Joining job_revisions + fabrication_jobs
-- here means the worker needs no follow-up reads to dispatch a scan.
--
-- Refs:
--   - Brief:    docs/projects/preflight-phase-2a-brief.md (2A-6a infrastructure)
--   - Spec:     docs/projects/fabrication-pipeline.md §12 (worker infra)
--   - Tables:   095_fabrication_jobs.sql (fabrication_scan_jobs +
--               fabrication_job_revisions + fabrication_jobs)
--   - Lessons:  #51 (no DO blocks), #45 (surgical change)

-- ============================================================
-- 1. Function: claim_next_scan_job
-- ============================================================
-- Claims one pending scan job and marks it 'running'. Returns NULL row
-- when the queue is empty.
--
-- p_worker_id: opaque worker identifier (e.g. Fly machine id) recorded
-- on fabrication_scan_jobs.locked_by for ops visibility.
--
-- Returns: scan_job_id, job_id, job_revision_id, storage_path, file_type,
-- machine_profile_id — everything the worker needs to dispatch a scan
-- without re-querying.

CREATE OR REPLACE FUNCTION claim_next_scan_job(p_worker_id TEXT)
RETURNS TABLE (
  scan_job_id          UUID,
  job_id               UUID,
  job_revision_id      UUID,
  storage_path         TEXT,
  file_type            TEXT,
  machine_profile_id   UUID,
  student_id           UUID
)
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as table owner; bypasses RLS (deny-all on scan_jobs)
SET search_path = public
AS $$
DECLARE
  v_scan_job_id UUID;
BEGIN
  -- Lock + read one pending row.
  SELECT sj.id INTO v_scan_job_id
  FROM fabrication_scan_jobs sj
  WHERE sj.status = 'pending'
  ORDER BY sj.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_scan_job_id IS NULL THEN
    RETURN;
  END IF;

  -- Mark as running while we still hold the row lock.
  UPDATE fabrication_scan_jobs
  SET status = 'running',
      locked_by = p_worker_id,
      locked_at = NOW(),
      attempt_count = attempt_count + 1
  WHERE id = v_scan_job_id;

  -- Return the joined row the worker needs.
  RETURN QUERY
  SELECT
    sj.id            AS scan_job_id,
    fj.id            AS job_id,
    fjr.id           AS job_revision_id,
    fjr.storage_path AS storage_path,
    fj.file_type     AS file_type,
    fj.machine_profile_id AS machine_profile_id,
    fj.student_id    AS student_id
  FROM fabrication_scan_jobs sj
  JOIN fabrication_job_revisions fjr ON fjr.id = sj.job_revision_id
  JOIN fabrication_jobs fj           ON fj.id  = fjr.job_id
  WHERE sj.id = v_scan_job_id;
END;
$$;

-- Grant: only the service-role can call this. The worker uses the
-- service-role key. Authenticated/anon users have no business claiming
-- scan jobs.
REVOKE EXECUTE ON FUNCTION claim_next_scan_job(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_next_scan_job(TEXT) TO service_role;

COMMENT ON FUNCTION claim_next_scan_job(TEXT) IS
  'Preflight scanner worker poll. Atomically claims one pending '
  'fabrication_scan_jobs row using FOR UPDATE SKIP LOCKED, marks it '
  'running, returns joined fields the worker needs to dispatch a scan. '
  'Service-role only. See docs/projects/preflight-phase-2a-brief.md.';

-- ============================================================
-- 2. Post-apply verification (run as separate queries)
-- ============================================================
-- Per Lesson #51, no DO blocks — verify outside the migration.
--
--   -- (a) Function exists
--   SELECT proname, pronargs FROM pg_proc WHERE proname = 'claim_next_scan_job';
--
--   -- (b) Permissions: service_role has EXECUTE, public does not
--   SELECT grantee, privilege_type
--   FROM information_schema.routine_privileges
--   WHERE specific_schema = 'public' AND routine_name = 'claim_next_scan_job';
--
--   -- (c) Smoke test — should return 0 rows on an empty queue
--   SELECT * FROM claim_next_scan_job('verify-test');
