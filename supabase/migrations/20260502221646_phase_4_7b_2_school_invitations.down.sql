-- Rollback for: phase_4_7b_2_school_invitations
-- Pairs with: 20260502221646_phase_4_7b_2_school_invitations.sql
--
-- ROLLBACK ORDER:
--   1. Refuse if active invitations exist (would lose data)
--   2. Drop policies + table
--   3. Restore lookup_school_by_domain to the original 2-column return

-- 1. Safety check
DO $$
DECLARE
  v_active_count INT;
BEGIN
  SELECT COUNT(*) INTO v_active_count
  FROM school_invitations
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'Rollback aborted: % active (un-accepted, un-revoked) '
                    'invitation(s) exist. Revoke or accept them before '
                    'reverting.', v_active_count;
  END IF;
END $$;

-- 2. Drop policies + indexes + table
DROP POLICY IF EXISTS "school_invitations_admin_read"   ON school_invitations;
DROP POLICY IF EXISTS "school_invitations_token_read"   ON school_invitations;
DROP POLICY IF EXISTS "school_invitations_admin_insert" ON school_invitations;
DROP POLICY IF EXISTS "school_invitations_admin_update" ON school_invitations;
DROP INDEX IF EXISTS idx_school_invitations_unique_active;
DROP INDEX IF EXISTS idx_school_invitations_school_created;
DROP INDEX IF EXISTS idx_school_invitations_token_active;
DROP TABLE IF EXISTS school_invitations;

-- 2b. Drop teacher_access_requests.school_id column + index
DROP INDEX IF EXISTS idx_teacher_access_requests_school_status;
ALTER TABLE teacher_access_requests DROP COLUMN IF EXISTS school_id;

-- 3. Restore lookup_school_by_domain to original 2-column return
DROP FUNCTION IF EXISTS public.lookup_school_by_domain(TEXT);

CREATE OR REPLACE FUNCTION public.lookup_school_by_domain(_domain TEXT)
RETURNS TABLE (school_id UUID, school_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.name
  FROM school_domains sd
  JOIN schools s ON s.id = sd.school_id
  WHERE lower(sd.domain) = lower(_domain)
    AND sd.verified = true
    AND s.status = 'active'
    AND NOT public.is_free_email_domain(_domain)
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_school_by_domain(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_school_by_domain(TEXT)
  TO anon, authenticated, service_role;
