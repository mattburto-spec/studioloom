-- Phase 4.2 — school_domains table + lookup_school_by_domain helper
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-4-brief.md §4 Phase 4.2
-- Date: 2 May 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Phase 4 makes signup auto-suggestion work via email-domain → school
-- mapping. A teacher signing up with @nis.org.cn auto-matches Nanjing
-- International School if the domain is on file. This is the single
-- biggest dedup lever (master spec §8.2 layer 2).
--
-- Two access patterns for school_domains:
--
--   1. Authenticated same-school teachers manage their school's domain
--      list (RLS policy: school_id = current_teacher_school_id()).
--   2. UNAUTHENTICATED signup-time lookup ("which school owns @nis.org.cn?")
--      runs BEFORE login, so it can't use the standard authenticated RLS
--      path. A SECURITY DEFINER function exposes a NARROW projection
--      (school_id, name only — never added_by, created_at, verification
--      metadata) and bakes in the free-email-provider blocklist so a
--      malicious actor can't claim "I own gmail.com so all gmail users
--      are part of my school."
--
-- Free-email blocklist is at the DB level (defence-in-depth): even if a
-- route forgets to filter, the DB returns NULL for known consumer
-- domains. Initial list covers the 10 most common providers; expandable
-- via Phase 4.4 super-admin UI in a future patch.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - NEW TABLE: school_domains (id, school_id, domain, verified, added_by, created_at)
-- - 2 indexes: unique on lower(domain) (one domain → one school globally),
--   plus school_id for fast list-by-school
-- - RLS: same-school teacher CRUD via current_teacher_school_id()
-- - NEW FUNCTION: lookup_school_by_domain(_domain TEXT) RETURNS TABLE
--   SECURITY DEFINER, NARROW projection, free-email blocklist baked in
-- - REVOKE FROM PUBLIC + GRANT TO anon, authenticated (per Lesson #52)
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql DROPs function then table. School-domain rows are
-- lost on rollback — no dependent data; no cascade risk.

-- ============================================================
-- 1. Table
-- ============================================================

CREATE TABLE IF NOT EXISTS school_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One domain canonically maps to one school globally (case-insensitive).
-- Two schools claiming the same domain is a data integrity bug — not
-- something we resolve via "first wins" implicit behaviour.
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_domains_domain_lower
  ON school_domains (lower(domain));

CREATE INDEX IF NOT EXISTS idx_school_domains_school_id
  ON school_domains (school_id);

COMMENT ON TABLE school_domains IS
  'Email domain → school mapping for signup auto-suggest. Phase 4.2.';

-- ============================================================
-- 2. RLS — same-school teacher CRUD
-- ============================================================

ALTER TABLE school_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_domains_school_teacher_select
  ON school_domains FOR SELECT TO authenticated
  USING (school_id = current_teacher_school_id());

CREATE POLICY school_domains_school_teacher_insert
  ON school_domains FOR INSERT TO authenticated
  WITH CHECK (school_id = current_teacher_school_id());

CREATE POLICY school_domains_school_teacher_update
  ON school_domains FOR UPDATE TO authenticated
  USING (school_id = current_teacher_school_id())
  WITH CHECK (school_id = current_teacher_school_id());

CREATE POLICY school_domains_school_teacher_delete
  ON school_domains FOR DELETE TO authenticated
  USING (school_id = current_teacher_school_id());

-- Service role bypasses RLS implicitly — required for the SECURITY DEFINER
-- lookup function below. No explicit service-role policy needed.

-- ============================================================
-- 3. Free-email-provider blocklist
-- ============================================================
--
-- Used by lookup_school_by_domain to short-circuit before the schools
-- table read. Covers the 10 most common consumer email providers (Q1
-- 2026 data). A malicious user trying to claim @gmail.com as "their
-- school's domain" can still INSERT a school_domains row (the unique
-- index will block the second attempt; the FIRST attempt succeeds) —
-- but the LOOKUP path NEVER returns gmail.com, so the welcome wizard
-- auto-suggest can't be exploited to steer fresh signups into the
-- wrong school.
--
-- Expandable via Phase 4.4 super-admin UI patch (FU-AV2-FREE-EMAIL-LIST
-- if needed); for now hard-coded.

CREATE OR REPLACE FUNCTION public.is_free_email_domain(_domain TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT lower(_domain) = ANY (ARRAY[
    'gmail.com',
    'googlemail.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'yahoo.com',
    'yahoo.co.uk',
    'icloud.com',
    'me.com',
    'mac.com',
    'qq.com',
    '163.com',
    '126.com',
    'sina.com',
    'foxmail.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
    'fastmail.com',
    'fastmail.fm',
    'tutanota.com',
    'gmx.com',
    'gmx.de',
    'mail.ru',
    'yandex.com',
    'yandex.ru'
  ]::TEXT[]);
$$;

REVOKE EXECUTE ON FUNCTION public.is_free_email_domain(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_free_email_domain(TEXT) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.is_free_email_domain(TEXT) IS
  'Free-email-provider blocklist. Used by lookup_school_by_domain to prevent abuse. Phase 4.2.';

-- ============================================================
-- 4. SECURITY DEFINER lookup (callable pre-login)
-- ============================================================
--
-- Returns AT MOST ONE row, projection limited to (school_id, school_name).
-- NEVER exposes added_by / created_at / verified flag — those leak
-- internal admin data to unauthenticated callers.
--
-- Returns 0 rows for:
--   - free-email domains (gmail.com, etc.)
--   - unverified school_domains rows (verified = false)
--   - missing schools (FK ON DELETE CASCADE handles dangling rows)
--   - case mismatch resolved via lower()-on-both-sides

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
GRANT EXECUTE ON FUNCTION public.lookup_school_by_domain(TEXT) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.lookup_school_by_domain(TEXT) IS
  'Pre-login school auto-suggest. NARROW projection, free-email blocklist enforced. Phase 4.2.';

-- ============================================================
-- 5. Sanity check
-- ============================================================

DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_function_exists BOOLEAN;
  v_blocklist_test BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'school_domains'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: school_domains table missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'lookup_school_by_domain' AND pronamespace = 'public'::regnamespace
  ) INTO v_function_exists;
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'Migration failed: lookup_school_by_domain function missing';
  END IF;

  SELECT public.is_free_email_domain('gmail.com') INTO v_blocklist_test;
  IF NOT v_blocklist_test THEN
    RAISE EXCEPTION 'Migration failed: gmail.com not blocklisted by is_free_email_domain';
  END IF;

  RAISE NOTICE 'Migration phase_4_2_school_domains applied OK';
END $$;
