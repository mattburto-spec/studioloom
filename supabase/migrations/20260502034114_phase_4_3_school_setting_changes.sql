-- Phase 4.3 — school_setting_changes governance engine
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-4-brief.md §4 Phase 4.3
-- Date: 2 May 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Phase 4 makes school-level settings self-governing under flat membership
-- (§8.3 master spec). No school admin role; instead a two-tier rule keyed
-- to the change itself:
--
--   low-stakes  → instant apply + audit-logged + 7-day revert window
--   high-stakes → require 2nd teacher's confirm within 48h or expire
--
-- Tier resolution is CONTEXT-AWARE (§3.8 Q2 sign-off): a school_domains
-- row added by the teacher whose email matches auto-confirms (low); a
-- 51% AI-budget jump escalates to high; safeguarding contacts always
-- require 2-teacher confirm. Resolvers live in TS (governance/tier-resolvers.ts);
-- the persisted `tier` column is the resolved value at propose-time.
--
-- This migration ships the persistence layer:
--   1. school_setting_changes table (the change ledger)
--   2. school_setting_changes_rate_state table (10-changes-per-hour sliding window)
--   3. RLS gating via current_teacher_school_id()
--   4. SECURITY DEFINER helper: enforce_setting_change_rate_limit(actor)
--      — atomic check+increment, returns rate_limited bool
--
-- Bootstrap grace exception (§3.8 Q6): when schools.bootstrap_expires_at
-- IS NULL OR > now() (single-teacher mode), the helper that creates
-- changes (proposeSchoolSettingChange in TS) treats high-stakes as
-- low-stakes — single-teacher schools auto-confirm. Once 2nd teacher
-- joins (sets bootstrap_expires_at = now() via trigger added in §4.4),
-- the 2-tier rule activates. Once closed, never reopens.
--
-- Version stamping (§3.9 item 14): payload_jsonb shape documented in
-- src/lib/access-v2/governance/types.ts (PayloadV1). Schema-side it's
-- just JSONB; app layer enforces the shape contract.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - 2 NEW TABLES: school_setting_changes, school_setting_changes_rate_state
-- - 2 NEW ENUMs: school_setting_change_tier, school_setting_change_status
-- - 4 NEW INDEXES (school+status, pending+expiry, school+applied recent,
--   rate-state actor+window)
-- - 4 NEW RLS policies on school_setting_changes (SELECT/INSERT/UPDATE/DELETE)
-- - 1 NEW RLS policy on rate_state (self-read only)
-- - 1 NEW FUNCTION: enforce_setting_change_rate_limit(_actor, _max, _window_hours)
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql DROPs functions, tables, types in reverse order.

-- ============================================================
-- 1. ENUMs
-- ============================================================

CREATE TYPE school_setting_change_tier AS ENUM ('low_stakes', 'high_stakes');

CREATE TYPE school_setting_change_status AS ENUM (
  'pending',   -- high-stakes proposal awaiting 2nd-teacher confirm
  'applied',   -- low-stakes (instant) OR confirmed high-stakes
  'reverted',  -- reverted within 7-day window (low-stakes only)
  'expired'    -- high-stakes 48h window passed without confirm
);

-- ============================================================
-- 2. school_setting_changes table
-- ============================================================

CREATE TABLE school_setting_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Who proposed
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  -- What changed: free-form discriminator (e.g. 'name', 'period_bells',
  -- 'add_school_domain', 'safeguarding_contacts'). Resolver in
  -- governance/tier-resolvers.ts maps change_type → tier.
  change_type TEXT NOT NULL,

  -- Resolved tier at propose-time. Persisted for audit clarity even
  -- though the resolver is the source of truth.
  tier school_setting_change_tier NOT NULL,

  -- PayloadV1 shape (governance/types.ts):
  --   { version: 1, before_at_propose: <T>, after: <T>, scope?: {...} }
  payload_jsonb JSONB NOT NULL,

  -- Lifecycle status
  status school_setting_change_status NOT NULL DEFAULT 'pending',

  -- Low-stakes: now() at insert
  -- High-stakes: NULL until 2nd-teacher confirm flips it
  applied_at TIMESTAMPTZ NULL,

  -- Who confirmed (high-stakes only; populated when applied_at flips)
  confirmed_by_user_id UUID REFERENCES auth.users(id),

  -- 7-day revert window: any same-school teacher can revert
  reverted_at TIMESTAMPTZ NULL,
  reverted_by_user_id UUID REFERENCES auth.users(id),

  -- High-stakes pending: 48h from created_at
  -- Low-stakes: NULL (no expiry)
  expires_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ssc_school_status
  ON school_setting_changes (school_id, status);

CREATE INDEX idx_ssc_pending_expiry
  ON school_setting_changes (expires_at)
  WHERE status = 'pending';

-- For "revertable in last 7 days" lookups in §4.4 settings page
CREATE INDEX idx_ssc_school_applied_recent
  ON school_setting_changes (school_id, applied_at DESC)
  WHERE status = 'applied';

COMMENT ON TABLE school_setting_changes IS
  'Governance ledger: every school-level setting change goes through here. Phase 4.3.';

-- ============================================================
-- 3. RLS — same-school teacher CRUD
-- ============================================================

ALTER TABLE school_setting_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY ssc_school_teacher_select
  ON school_setting_changes FOR SELECT TO authenticated
  USING (school_id = current_teacher_school_id());

CREATE POLICY ssc_school_teacher_insert
  ON school_setting_changes FOR INSERT TO authenticated
  WITH CHECK (school_id = current_teacher_school_id());

CREATE POLICY ssc_school_teacher_update
  ON school_setting_changes FOR UPDATE TO authenticated
  USING (school_id = current_teacher_school_id())
  WITH CHECK (school_id = current_teacher_school_id());

-- DELETE not exposed via teacher routes — append-only audit trail. The
-- policy is defensive in case service-role ops needs surgical cleanup.
CREATE POLICY ssc_school_teacher_delete
  ON school_setting_changes FOR DELETE TO authenticated
  USING (school_id = current_teacher_school_id());

-- ============================================================
-- 4. school_setting_changes_rate_state — sliding-hour counter
-- ============================================================
--
-- Per §3.9 item 17: 10 changes per hour per teacher. Sliding-hour
-- semantics implemented via hourly buckets — SUM(count) over the last
-- hour ≤ 10. Bucket-per-event would be high-cardinality; bucket-per-hour
-- is small (one row per (actor, hour)) with index-fast lookups.

CREATE TABLE school_setting_changes_rate_state (
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Truncated to hour: date_trunc('hour', now())
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (actor_user_id, window_start)
);

CREATE INDEX idx_ssrs_actor_recent
  ON school_setting_changes_rate_state (actor_user_id, window_start DESC);

ALTER TABLE school_setting_changes_rate_state ENABLE ROW LEVEL SECURITY;

-- Self-read only — actors can see their own rate-limit state for UX
-- ("you have 3 changes left this hour" hints if useful). Writes only via
-- the SECURITY DEFINER helper below.
CREATE POLICY ssrs_self_read
  ON school_setting_changes_rate_state FOR SELECT TO authenticated
  USING (actor_user_id = auth.uid());

COMMENT ON TABLE school_setting_changes_rate_state IS
  'Sliding-hour rate limit state for school_setting_changes. Phase 4.3.';

-- ============================================================
-- 5. enforce_setting_change_rate_limit helper
-- ============================================================
--
-- SECURITY DEFINER: returns rate_limit decision atomically. If under
-- cap, increments the actor's hourly bucket and returns rate_limited=false.
-- If at cap, does NOT increment and returns rate_limited=true.
--
-- INSERT ... ON CONFLICT DO UPDATE handles the race where two
-- concurrent calls both see "no row" and try to INSERT — the second
-- becomes an UPDATE.

CREATE OR REPLACE FUNCTION public.enforce_setting_change_rate_limit(
  _actor UUID,
  _max_changes INTEGER DEFAULT 10,
  _window_hours INTEGER DEFAULT 1
)
RETURNS TABLE (
  bucket_count INTEGER,
  window_total INTEGER,
  rate_limited BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bucket TIMESTAMPTZ := date_trunc('hour', now());
  v_bucket_count INTEGER;
  v_window_total INTEGER;
  v_window_start TIMESTAMPTZ := now() - (_window_hours || ' hours')::INTERVAL;
BEGIN
  -- Sum across the sliding window BEFORE incrementing. If we're already
  -- at cap, return rate_limited=true without incrementing (avoids
  -- polluting the counter with throttled requests).
  SELECT COALESCE(SUM(count), 0)::INTEGER INTO v_window_total
  FROM school_setting_changes_rate_state
  WHERE actor_user_id = _actor
    AND window_start >= v_window_start;

  IF v_window_total >= _max_changes THEN
    RETURN QUERY SELECT 0, v_window_total, true;
    RETURN;
  END IF;

  -- Atomic increment of current bucket
  INSERT INTO school_setting_changes_rate_state (actor_user_id, window_start, count)
  VALUES (_actor, v_bucket, 1)
  ON CONFLICT (actor_user_id, window_start)
  DO UPDATE SET count = school_setting_changes_rate_state.count + 1
  RETURNING count INTO v_bucket_count;

  -- Recompute post-increment for accuracy
  SELECT COALESCE(SUM(count), 0)::INTEGER INTO v_window_total
  FROM school_setting_changes_rate_state
  WHERE actor_user_id = _actor
    AND window_start >= v_window_start;

  RETURN QUERY SELECT v_bucket_count, v_window_total, false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_setting_change_rate_limit(UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_setting_change_rate_limit(UUID, INTEGER, INTEGER) TO authenticated, service_role;

COMMENT ON FUNCTION public.enforce_setting_change_rate_limit(UUID, INTEGER, INTEGER) IS
  'Sliding-hour rate-limit check + increment. 10/hr default. Phase 4.3.';

-- ============================================================
-- 6. Sanity check
-- ============================================================

DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_rate_table_exists BOOLEAN;
  v_function_exists BOOLEAN;
  v_tier_enum_exists BOOLEAN;
  v_status_enum_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'school_setting_changes'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: school_setting_changes table missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'school_setting_changes_rate_state'
  ) INTO v_rate_table_exists;
  IF NOT v_rate_table_exists THEN
    RAISE EXCEPTION 'Migration failed: school_setting_changes_rate_state table missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'enforce_setting_change_rate_limit'
      AND pronamespace = 'public'::regnamespace
  ) INTO v_function_exists;
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'Migration failed: enforce_setting_change_rate_limit function missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'school_setting_change_tier'
  ) INTO v_tier_enum_exists;
  SELECT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'school_setting_change_status'
  ) INTO v_status_enum_exists;
  IF NOT v_tier_enum_exists OR NOT v_status_enum_exists THEN
    RAISE EXCEPTION 'Migration failed: enum types missing';
  END IF;

  RAISE NOTICE 'Migration phase_4_3_school_setting_changes applied OK';
END $$;
