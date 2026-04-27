-- Migration 123 down: revert claim_next_scan_job to the pre-8.1d-24
-- return shape (no lab_id / machine_category). Only useful if you
-- ALSO roll back 120 + the scanner code that consumes the new
-- columns; otherwise the worker will crash on category-only jobs.

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

REVOKE EXECUTE ON FUNCTION claim_next_scan_job(TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION claim_next_scan_job(TEXT) TO service_role;
