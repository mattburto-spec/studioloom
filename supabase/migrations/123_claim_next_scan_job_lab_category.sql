-- Migration 123: extend claim_next_scan_job RPC to return lab_id +
-- machine_category alongside machine_profile_id.
--
-- Phase 8.1d-24. After 8.1d-22 made fabrication_jobs.machine_profile_id
-- nullable, the Python scanner blew up on category-only jobs because:
--   1. The RPC still returned only machine_profile_id (now sometimes
--      NULL).
--   2. ClaimedJob carried that None forward into
--      load_machine_profile() which sent the literal string "None"
--      to PostgREST → 22P02 invalid_text_representation:
--      'invalid input syntax for type uuid: "None"'.
--
-- This migration teaches the RPC to return the row's lab_id +
-- machine_category so the scanner can pick a surrogate machine
-- profile for category-only jobs (any active machine in that lab +
-- category) without an extra round-trip.
--
-- Idempotent — uses CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION claim_next_scan_job(p_worker_id TEXT)
RETURNS TABLE (
  scan_job_id          UUID,
  job_id               UUID,
  job_revision_id      UUID,
  storage_path         TEXT,
  file_type            TEXT,
  machine_profile_id   UUID,    -- nullable post-120
  lab_id               UUID,    -- 8.1d-24: NEW
  machine_category     TEXT,    -- 8.1d-24: NEW ('3d_printer' / 'laser_cutter')
  student_id           UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scan_job_id UUID;
BEGIN
  SELECT sj.id INTO v_scan_job_id
  FROM fabrication_scan_jobs sj
  WHERE sj.status = 'pending'
  ORDER BY sj.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_scan_job_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE fabrication_scan_jobs
  SET status = 'running',
      locked_by = p_worker_id,
      locked_at = NOW(),
      attempt_count = attempt_count + 1
  WHERE id = v_scan_job_id;

  RETURN QUERY
  SELECT
    sj.id                AS scan_job_id,
    fj.id                AS job_id,
    fjr.id               AS job_revision_id,
    fjr.storage_path     AS storage_path,
    fj.file_type         AS file_type,
    fj.machine_profile_id AS machine_profile_id,
    fj.lab_id            AS lab_id,
    fj.machine_category  AS machine_category,
    fj.student_id        AS student_id
  FROM fabrication_scan_jobs sj
  JOIN fabrication_job_revisions fjr ON fjr.id = sj.job_revision_id
  JOIN fabrication_jobs fj           ON fj.id  = fjr.job_id
  WHERE sj.id = v_scan_job_id;
END;
$$;

-- Re-grant to service_role (CREATE OR REPLACE preserves existing
-- grants, but be explicit so an audit reads cleanly).
REVOKE EXECUTE ON FUNCTION claim_next_scan_job(TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION claim_next_scan_job(TEXT) TO service_role;

COMMENT ON FUNCTION claim_next_scan_job(TEXT) IS
'Phase 2A scan-queue claim RPC. 8.1d-24 extended return shape to include lab_id + machine_category so the worker can resolve a surrogate machine profile for category-only jobs (machine_profile_id IS NULL post-migration 120).';
