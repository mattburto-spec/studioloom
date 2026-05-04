-- Migration: phase_4_7b_1_school_admin_role
-- Created: 20260502215604 UTC
-- Phase: Access Model v2 Phase 4.7b-1 (tier-aware membership — schema +
--   role matrices)
--
-- WHY: Per Decision 8 amendment (master spec line 336, signed off 2 May
--   2026 PM): tier-aware membership requires a `school_admin` role on
--   `school`-tier schools. school_admin = the school's IT manager; can
--   invite teachers, edit high-stakes settings, propose/reject merges.
--   Implementation reuses the existing `school_responsibilities` RBAC
--   table — no new entity. New responsibility_type value: 'school_admin'.
--
--   DUAL-PURPOSE NOTE (per CWORK Q3 review): responsibility_type value
--   space now spans:
--     - Academic roles: pp_coordinator / pyp_coordinator / cas_coordinator
--                       / myp_coordinator / dp_coordinator /
--                       service_coordinator / safeguarding_lead
--     - Governance roles: school_admin (NEW)
--   Future values must declare which category they belong to here.
--
-- IMPACT:
--   - school_responsibilities.responsibility_type CHECK enum gains
--     'school_admin' (8 → 9 values).
--   - 1 NEW SECURITY DEFINER helper: is_school_admin(user, school) →
--     boolean (STABLE, search_path locked per Lessons #64 + #66).
--   - 1 NEW SECURITY DEFINER helper: can_grant_school_admin(user, school)
--     → boolean. Encapsulates the 3-branch grant rule:
--       (a) platform admin
--       (b) existing school_admin of same school
--       (c) bootstrap-grace exception: school is school-tier, in
--           bootstrap window, no school_admin exists yet (initial-grant
--           path; matches Stripe-upgrade webhook flow per Decision 9).
--   - 1 NEW INSERT policy on school_responsibilities for school_admin.
--     Other types stay deny-by-default (service-role-only inserts).
--
-- ROLLBACK: paired .down.sql drops both helpers + the INSERT policy +
--   reverts the CHECK enum (FAILS if any school_admin rows exist; the
--   .down.sql refuses on data presence).
--
-- INVARIANT: `school_admin` is granted, never self-promoted by any
--   non-platform-admin teacher except in the bootstrap-grace exception.
--   Test in 4.7b-1 tests: every non-permitted INSERT path must return
--   a policy-denial, not silent insert.

-- ============================================================
-- 1. Extend responsibility_type CHECK enum
-- ============================================================

ALTER TABLE school_responsibilities
  DROP CONSTRAINT IF EXISTS school_responsibilities_responsibility_type_check;

ALTER TABLE school_responsibilities
  ADD CONSTRAINT school_responsibilities_responsibility_type_check
  CHECK (responsibility_type IN (
    -- Academic roles (existing, mig 20260428214735)
    'pp_coordinator',
    'pyp_coordinator',
    'cas_coordinator',
    'myp_coordinator',
    'dp_coordinator',
    'service_coordinator',
    'safeguarding_lead',
    -- Governance roles (NEW — Phase 4.7b-1)
    'school_admin'
  ));

-- ============================================================
-- 2. is_school_admin() — SECURITY DEFINER helper for can.ts
-- ============================================================
-- Returns true iff p_user_id has an active school_admin row for
-- p_school_id. Used by can.ts step 5 (programme coordinator scope) to
-- award SCHOOL_ADMIN_ACTIONS without re-entering RLS on
-- school_responsibilities (which has school-wide read but no read
-- policy for the inserter's own row in unusual contexts).

CREATE OR REPLACE FUNCTION public.is_school_admin(
  p_user_id UUID,
  p_school_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM school_responsibilities
    WHERE teacher_id = p_user_id
      AND school_id = p_school_id
      AND responsibility_type = 'school_admin'
      AND deleted_at IS NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_school_admin(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_school_admin(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.is_school_admin(UUID, UUID) IS
  'Phase 4.7b-1 — true iff user has active school_admin responsibility '
  'for the school. SECURITY DEFINER + locked search_path per Lessons '
  '#64 + #66. Called by can.ts and by RLS policies on tier-gated tables.';

-- ============================================================
-- 3. can_grant_school_admin() — INSERT-policy authorization helper
-- ============================================================
-- Returns true iff p_user_id is allowed to INSERT a school_admin row
-- for p_school_id. Three branches:
--   (a) platform admin (is_platform_admin = true on user_profiles)
--   (b) existing school_admin of the same school (governance ladder)
--   (c) bootstrap-grace: school is `school` tier, bootstrap_expires_at
--       is in the future, AND no school_admin row exists for the school
--       yet (initial-grant path — typically the Stripe upgrade webhook
--       creates the first school_admin row; or, for NIS pre-Stripe,
--       Matt-as-platform-admin manually grants via branch (a)).
--
-- Wrapping the whole rule in one SECURITY DEFINER function keeps the
-- RLS policy simple (one boolean) and avoids any cross-table RLS
-- recursion concern (Lesson #64 sibling).

CREATE OR REPLACE FUNCTION public.can_grant_school_admin(
  p_user_id UUID,
  p_school_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_platform_admin BOOLEAN;
  v_is_existing_admin BOOLEAN;
  v_school_tier TEXT;
  v_bootstrap_expires_at TIMESTAMPTZ;
  v_existing_admin_count INT;
BEGIN
  -- Branch (a): platform admin always
  SELECT is_platform_admin INTO v_is_platform_admin
  FROM user_profiles WHERE id = p_user_id;
  IF v_is_platform_admin = true THEN
    RETURN true;
  END IF;

  -- Branch (b): existing school_admin of this school
  SELECT EXISTS (
    SELECT 1 FROM school_responsibilities
    WHERE teacher_id = p_user_id
      AND school_id = p_school_id
      AND responsibility_type = 'school_admin'
      AND deleted_at IS NULL
  ) INTO v_is_existing_admin;
  IF v_is_existing_admin = true THEN
    RETURN true;
  END IF;

  -- Branch (c): bootstrap-grace exception
  SELECT subscription_tier, bootstrap_expires_at
    INTO v_school_tier, v_bootstrap_expires_at
  FROM schools WHERE id = p_school_id;

  IF v_school_tier = 'school'
     AND v_bootstrap_expires_at IS NOT NULL
     AND v_bootstrap_expires_at > now()
  THEN
    SELECT COUNT(*) INTO v_existing_admin_count
    FROM school_responsibilities
    WHERE school_id = p_school_id
      AND responsibility_type = 'school_admin'
      AND deleted_at IS NULL;
    IF v_existing_admin_count = 0 THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_grant_school_admin(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_grant_school_admin(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.can_grant_school_admin(UUID, UUID) IS
  'Phase 4.7b-1 — INSERT-policy authorization for school_admin role. '
  'Returns true if user is platform admin OR existing school_admin OR '
  'qualifies for bootstrap-grace initial grant. SECURITY DEFINER + '
  'locked search_path per Lesson #66.';

-- ============================================================
-- 4. INSERT policy on school_responsibilities — school_admin gate
-- ============================================================
-- Existing policy state: SELECT exists (school_responsibilities_school_read);
-- INSERT/UPDATE/DELETE deny-by-default. This migration ADDS an INSERT
-- policy that allows school_admin INSERTs when the inserter is
-- authorized (per can_grant_school_admin). Other responsibility types
-- (academic coordinators, future dept_head) remain deny-by-default —
-- they're inserted via service role from admin tooling.

CREATE POLICY "school_responsibilities_school_admin_insert_gate"
  ON school_responsibilities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Only this policy gates school_admin INSERTs. Non-school_admin
    -- types fall through (no other INSERT policy → deny-by-default).
    responsibility_type = 'school_admin'
    AND public.can_grant_school_admin(auth.uid(), school_id)
  );

COMMENT ON POLICY "school_responsibilities_school_admin_insert_gate"
  ON school_responsibilities IS
  'Phase 4.7b-1 — gates INSERT for school_admin role. Allows when '
  'inserter is platform admin / existing school_admin / qualifies '
  'for bootstrap-grace. Other responsibility types remain '
  'deny-by-default (service-role-only inserts).';

-- ============================================================
-- 5. Sanity check
-- ============================================================

DO $$
DECLARE
  v_check_includes_school_admin BOOLEAN;
  v_is_school_admin_exists BOOLEAN;
  v_can_grant_exists BOOLEAN;
  v_insert_policy_exists BOOLEAN;
BEGIN
  -- CHECK enum includes 'school_admin'?
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class rel ON con.conrelid = rel.oid
    WHERE rel.relname = 'school_responsibilities'
      AND con.conname = 'school_responsibilities_responsibility_type_check'
      AND pg_get_constraintdef(con.oid) LIKE '%school_admin%'
  ) INTO v_check_includes_school_admin;

  -- Helpers exist with SECURITY DEFINER?
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_school_admin' AND prosecdef = true
  ) INTO v_is_school_admin_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'can_grant_school_admin' AND prosecdef = true
  ) INTO v_can_grant_exists;

  -- INSERT policy exists?
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'school_responsibilities'
      AND policyname = 'school_responsibilities_school_admin_insert_gate'
      AND cmd = 'INSERT'
  ) INTO v_insert_policy_exists;

  IF NOT v_check_includes_school_admin THEN
    RAISE EXCEPTION 'Migration failed: CHECK enum does not include school_admin';
  END IF;
  IF NOT v_is_school_admin_exists THEN
    RAISE EXCEPTION 'Migration failed: is_school_admin() helper missing OR not SECURITY DEFINER';
  END IF;
  IF NOT v_can_grant_exists THEN
    RAISE EXCEPTION 'Migration failed: can_grant_school_admin() helper missing OR not SECURITY DEFINER';
  END IF;
  IF NOT v_insert_policy_exists THEN
    RAISE EXCEPTION 'Migration failed: INSERT policy school_responsibilities_school_admin_insert_gate missing';
  END IF;

  RAISE NOTICE 'Migration phase_4_7b_1_school_admin_role applied OK: '
               'CHECK enum +1 value, 2 helpers, 1 INSERT policy';
END $$;
