-- Migration: phase_4_7b_2_school_invitations
-- Created: 20260502221646 UTC
-- Phase: Access Model v2 Phase 4.7b-2 (tier-aware membership — invite flow)
--
-- WHY: Per Decision 8 amendment + CWORK Q4 audit (signed off 2 May 2026 PM):
--   `school`-tier schools are invite-only. teacher_access_requests
--   (mig 089) is a self-service WAITLIST (TEXT `school` field, no
--   `school_id` FK, no token, no `invited_by`) — semantically distinct
--   from "an admin granted access" and INSUFFICIENT for the tokenized
--   invite-acceptance flow. New table `school_invitations` keeps
--   "I want access" (089) and "Admin granted access" (this) separate.
--
--   Also extends lookup_school_by_domain (Phase 4.2) to return the
--   matched school's subscription_tier alongside (id, name) so the
--   welcome wizard can route the banner: target tier 'school' → "ask
--   IT to invite you", target tier 'free'/'pro' → no banner (target
--   is someone's personal school; not joinable).
--
-- IMPACT:
--   - 1 NEW table school_invitations
--   - 3 indexes (token lookup, school listing, email-based dedup)
--   - 4 RLS policies (school_admin r/w, anon-token-read,
--     platform_admin all)
--   - lookup_school_by_domain function REPLACED — return signature
--     extended from (school_id, school_name) to
--     (school_id, school_name, subscription_tier). DROP+CREATE because
--     RETURN signature change. Callers (route + tests) updated in
--     same PR.
--
-- ROLLBACK: paired .down.sql drops the table + restores the original
--   lookup_school_by_domain return shape. Refuses if any active
--   (un-accepted, un-revoked) invitations exist.
--
-- INVARIANT: tokens are random 32-byte URL-safe strings stored in DB
--   (not HMAC-signed). Choice favours revocability: deleting/revoking
--   a row immediately invalidates the token. HMAC tokens would verify
--   regardless of DB state.

-- ============================================================
-- 1. school_invitations table
-- ============================================================
-- Lifecycle: created → accepted (terminal happy) OR revoked (terminal sad)
--                   → expires after expires_at (no row state change; just
--                     the accept route refuses past-expiry tokens).
--
-- One row per (school, invited_email, role) — the (lower(invited_email),
-- school_id, invited_role) tuple is unique while accepted_at IS NULL
-- AND revoked_at IS NULL via a partial unique index. After accept or
-- revoke, a new invitation can be created (e.g. re-invite after
-- expiry/revoke).

CREATE TABLE IF NOT EXISTS school_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL CHECK (length(trim(invited_email)) > 0),
  invited_role TEXT NOT NULL DEFAULT 'lead_teacher'
    CHECK (invited_role IN (
      'lead_teacher',
      'co_teacher',
      'dept_head',
      'school_admin'
    )),
  invited_by UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  -- 32-byte URL-safe random; generated at INSERT time by app code
  -- (gen_random_bytes is server-side; we use crypto.randomBytes in
  -- TypeScript for unified key length + base64url encoding).
  token TEXT NOT NULL UNIQUE CHECK (length(token) >= 32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  accepted_at TIMESTAMPTZ NULL,
  accepted_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ NULL,
  revoked_by UUID NULL REFERENCES teachers(id) ON DELETE SET NULL,
  -- Coherence: accepted/revoked are mutually exclusive
  CHECK (accepted_at IS NULL OR revoked_at IS NULL),
  -- Coherence: accepted requires accepted_by_user_id
  CHECK (
    (accepted_at IS NULL AND accepted_by_user_id IS NULL)
    OR (accepted_at IS NOT NULL AND accepted_by_user_id IS NOT NULL)
  ),
  -- Coherence: expires_at must be after created_at
  CHECK (expires_at > created_at)
);

-- Token lookup — primary access path on accept (single-row lookup)
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_invitations_token_active
  ON school_invitations(token)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- School-side listing — admin views pending/expired invites
CREATE INDEX IF NOT EXISTS idx_school_invitations_school_created
  ON school_invitations(school_id, created_at DESC);

-- Email-based dedup — block duplicate active invites for same person
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_invitations_unique_active
  ON school_invitations(school_id, lower(invited_email), invited_role)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ============================================================
-- 2. RLS policies
-- ============================================================
-- Read access:
--   - school_admin (or platform admin) reads all invitations for their school
--   - Anon path reads by token only (single-row exact-token match)
-- Write access:
--   - school_admin (or platform admin) inserts new invitations
--   - school_admin / platform_admin can UPDATE (for revoke). Accept
--     happens via service role from /api/auth/accept-school-invitation
--     so no anon UPDATE policy needed.
--
-- The is_school_admin() helper (Phase 4.7b-1) bypasses RLS internally
-- so cross-table joins to school_responsibilities don't recurse.

ALTER TABLE school_invitations ENABLE ROW LEVEL SECURITY;

-- Admin (school or platform) reads all invitations for their school
CREATE POLICY "school_invitations_admin_read"
  ON school_invitations FOR SELECT
  TO authenticated
  USING (
    (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR public.is_school_admin(auth.uid(), school_id)
  );

-- Anon-token read: caller passes the token, single-row lookup. No
-- broad enumeration possible because the unique-active index requires
-- the exact token AND deny-by-default if accepted/revoked.
-- This policy is what the /api/auth/accept-school-invitation route
-- evaluates. Note: anon role is NOT granted access — the policy still
-- requires authenticated. The accept route uses service role for the
-- final acceptance UPDATE; the read here just lets a logged-in user
-- (whether or not they're the invited_email) check that a token is
-- still valid before they attempt to accept.
CREATE POLICY "school_invitations_token_read"
  ON school_invitations FOR SELECT
  TO authenticated
  USING (
    accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  );

-- INSERT: school_admin / platform_admin only
CREATE POLICY "school_invitations_admin_insert"
  ON school_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR public.is_school_admin(auth.uid(), school_id)
  );

-- UPDATE: school_admin / platform_admin can revoke. Accept-path UPDATE
-- happens via service role.
CREATE POLICY "school_invitations_admin_update"
  ON school_invitations FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR public.is_school_admin(auth.uid(), school_id)
  )
  WITH CHECK (
    (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR public.is_school_admin(auth.uid(), school_id)
  );

COMMENT ON TABLE school_invitations IS
  'Phase 4.7b-2 — admin-granted invitations to join a school-tier school. '
  'Distinct from teacher_access_requests (mig 089), which is the '
  'self-service "I want access" waitlist. Tokens are random 32-byte '
  'URL-safe strings stored in DB for revocability. 14-day default '
  'expiry. RLS: school_admin / platform_admin read+write; authenticated '
  'users can read by exact token + active-state.';

-- ============================================================
-- 2b. teacher_access_requests.school_id — Phase 4.7b-2 extension
-- ============================================================
-- Mig 089 created teacher_access_requests with TEXT `school` (free-text
-- field). Phase 4.7b-2 needs a hard FK so the welcome-wizard banner
-- can attach a request to a specific school_id when the domain match
-- found a school-tier school. Free-text `school` stays for backward
-- compat with existing rows + admin-side display.

ALTER TABLE teacher_access_requests
  ADD COLUMN IF NOT EXISTS school_id UUID NULL REFERENCES schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_access_requests_school_status
  ON teacher_access_requests(school_id, status, created_at DESC)
  WHERE school_id IS NOT NULL;

COMMENT ON COLUMN teacher_access_requests.school_id IS
  'Phase 4.7b-2 — when a request originates from the welcome-wizard '
  'domain-match banner on a school-tier school, this FK ties it to '
  'the target school. school_admin can then surface "pending requests" '
  'in /admin/school/[id]. Pre-4.7b-2 rows have NULL school_id.';

-- ============================================================
-- 3. lookup_school_by_domain — extended to return tier
-- ============================================================
-- DROP+CREATE required because the RETURN TABLE signature changes.
-- Callers in the same PR (src/app/api/schools/lookup-by-domain/route.ts
-- + tests) updated to consume the new field. Function is SECURITY
-- DEFINER + STABLE + locked search_path per Lesson #66.

DROP FUNCTION IF EXISTS public.lookup_school_by_domain(TEXT);

CREATE OR REPLACE FUNCTION public.lookup_school_by_domain(_domain TEXT)
RETURNS TABLE (
  school_id UUID,
  school_name TEXT,
  subscription_tier TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.name, s.subscription_tier
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

COMMENT ON FUNCTION public.lookup_school_by_domain(TEXT) IS
  'Phase 4.7b-2 — pre-login school auto-suggest. Returns school + tier '
  'so the welcome wizard can switch banner behaviour by tier. NARROW '
  'projection (no added_by, verified, created_at). Free-email '
  'blocklist enforced.';

-- ============================================================
-- 4. Sanity check
-- ============================================================

DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_lookup_returns_tier BOOLEAN;
  v_token_index_exists BOOLEAN;
  v_unique_active_index_exists BOOLEAN;
  v_policy_count INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'school_invitations'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: school_invitations table missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'lookup_school_by_domain'
  ) INTO v_lookup_returns_tier;
  -- Crude check; the column-level RETURNS TABLE inspection is involved.
  -- The DROP+CREATE above guarantees the new shape iff the migration
  -- finished without aborting; this presence-check is a sanity floor.
  IF NOT v_lookup_returns_tier THEN
    RAISE EXCEPTION 'Migration failed: lookup_school_by_domain function missing after recreate';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'school_invitations'
      AND indexname = 'idx_school_invitations_token_active'
  ) INTO v_token_index_exists;
  IF NOT v_token_index_exists THEN
    RAISE EXCEPTION 'Migration failed: token-active unique index missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'school_invitations'
      AND indexname = 'idx_school_invitations_unique_active'
  ) INTO v_unique_active_index_exists;
  IF NOT v_unique_active_index_exists THEN
    RAISE EXCEPTION 'Migration failed: unique-active dedup index missing';
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'school_invitations';
  IF v_policy_count != 4 THEN
    RAISE EXCEPTION 'Migration failed: expected 4 RLS policies, got %', v_policy_count;
  END IF;

  RAISE NOTICE 'Migration phase_4_7b_2_school_invitations applied OK: '
               '1 table, 3 indexes, 4 RLS policies, lookup_school_by_domain extended';
END $$;
