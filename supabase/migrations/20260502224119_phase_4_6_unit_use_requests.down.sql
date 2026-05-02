-- Rollback for: phase_4_6_unit_use_requests
-- Pairs with: 20260502224119_phase_4_6_unit_use_requests.sql
--
-- Refuses if any active (pending) requests exist OR any units have
-- non-NULL forked_from_* (would lose attribution). Manual cleanup
-- required to force rollback.

-- 1. Safety checks
DO $$
DECLARE
  v_active_count INT;
  v_forked_count INT;
BEGIN
  SELECT COUNT(*) INTO v_active_count
  FROM unit_use_requests
  WHERE status = 'pending';
  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'Rollback aborted: % pending unit_use_requests exist',
                    v_active_count;
  END IF;

  SELECT COUNT(*) INTO v_forked_count
  FROM units
  WHERE forked_from_author_id IS NOT NULL;
  IF v_forked_count > 0 THEN
    RAISE EXCEPTION 'Rollback aborted: % units have forked_from_author_id '
                    'set (would lose attribution data). Clear that column '
                    'first if you really want to revert.', v_forked_count;
  END IF;
END $$;

-- 2. Drop policies + indexes + table
DROP POLICY IF EXISTS "uur_requester_self_read"        ON unit_use_requests;
DROP POLICY IF EXISTS "uur_author_self_read"           ON unit_use_requests;
DROP POLICY IF EXISTS "uur_admin_read"                 ON unit_use_requests;
DROP POLICY IF EXISTS "uur_requester_insert"           ON unit_use_requests;
DROP POLICY IF EXISTS "uur_author_or_requester_update" ON unit_use_requests;

DROP INDEX IF EXISTS idx_uur_unique_pending;
DROP INDEX IF EXISTS idx_uur_requester_created;
DROP INDEX IF EXISTS idx_uur_author_pending;
DROP INDEX IF EXISTS idx_uur_unit_status;

DROP TABLE IF EXISTS unit_use_requests;

-- 3. Drop units column (the existing forked_from from mig 007 is kept)
ALTER TABLE units DROP COLUMN IF EXISTS forked_from_author_id;
