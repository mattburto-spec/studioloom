/**
 * Asserts the shape of migration 20260502031121_phase_4_2_school_domains.sql.
 *
 * Phase: Access Model v2 Phase 4.2 (schema + helper functions)
 *
 * Three concrete artefacts:
 *   1. school_domains table (5 cols: id, school_id, domain, verified, added_by, created_at)
 *   2. is_free_email_domain(TEXT) IMMUTABLE — blocklist function
 *   3. lookup_school_by_domain(TEXT) STABLE SECURITY DEFINER — pre-login lookup
 *
 * RLS: 4 policies (SELECT/INSERT/UPDATE/DELETE) gated on
 * current_teacher_school_id() — same-school teacher CRUD.
 *
 * SECURITY DEFINER lockdown:
 *   - REVOKE FROM PUBLIC on both functions
 *   - GRANT TO anon, authenticated, service_role on both
 *   - SET search_path = public, pg_temp on both (Lesson #64 search_path lock)
 *
 * Free-email blocklist must include the 10+ most common providers + the
 * Chinese providers Matt's prospects use (qq.com, 163.com, 126.com).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260502031121';

function loadMigration(suffix: string): string {
  const all = fs.readdirSync(MIGRATIONS_DIR);
  const file = all.find(
    (f) => f.startsWith(TIMESTAMP) && f.endsWith(suffix)
  );
  if (!file) {
    throw new Error(
      `Migration with timestamp ${TIMESTAMP} and suffix ${suffix} not found`
    );
  }
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
}

describe('Migration: 20260502031121_phase_4_2_school_domains', () => {
  const sql = loadMigration('_phase_4_2_school_domains.sql');

  // ─── Table shape ─────────────────────────────────────────────────

  describe('school_domains table', () => {
    it('declares CREATE TABLE IF NOT EXISTS school_domains', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS school_domains/);
    });

    it('has all 6 expected columns', () => {
      expect(sql).toMatch(/id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
      expect(sql).toMatch(
        /school_id UUID NOT NULL REFERENCES schools\(id\) ON DELETE CASCADE/
      );
      expect(sql).toMatch(/domain TEXT NOT NULL/);
      expect(sql).toMatch(/verified BOOLEAN NOT NULL DEFAULT false/);
      expect(sql).toMatch(
        /added_by UUID REFERENCES auth\.users\(id\) ON DELETE SET NULL/
      );
      expect(sql).toMatch(/created_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/);
    });

    it('declares unique index on lower(domain) — case-insensitive global uniqueness', () => {
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX[\s\S]*idx_school_domains_domain_lower[\s\S]*lower\(domain\)/
      );
    });

    it('declares school_id index for fast list-by-school lookups', () => {
      expect(sql).toMatch(/idx_school_domains_school_id[\s\S]*\(school_id\)/);
    });
  });

  // ─── RLS ─────────────────────────────────────────────────────────

  describe('RLS policies', () => {
    it('enables RLS on school_domains', () => {
      expect(sql).toMatch(/ALTER TABLE school_domains ENABLE ROW LEVEL SECURITY/);
    });

    it('has 4 policies covering SELECT/INSERT/UPDATE/DELETE', () => {
      expect(sql).toMatch(/school_domains_school_teacher_select[\s\S]*FOR SELECT/);
      expect(sql).toMatch(/school_domains_school_teacher_insert[\s\S]*FOR INSERT/);
      expect(sql).toMatch(/school_domains_school_teacher_update[\s\S]*FOR UPDATE/);
      expect(sql).toMatch(/school_domains_school_teacher_delete[\s\S]*FOR DELETE/);
    });

    it('all policies gate on current_teacher_school_id() — same-school CRUD', () => {
      const matches = sql.match(/current_teacher_school_id\(\)/g);
      expect(matches?.length).toBeGreaterThanOrEqual(4); // ≥1 per policy + helper refs
    });
  });

  // ─── is_free_email_domain function ───────────────────────────────

  describe('is_free_email_domain function', () => {
    it('declares CREATE OR REPLACE FUNCTION public.is_free_email_domain', () => {
      expect(sql).toMatch(
        /CREATE OR REPLACE FUNCTION public\.is_free_email_domain\(_domain TEXT\)/
      );
    });

    it('is IMMUTABLE (deterministic, plan-cacheable)', () => {
      // Match in is_free_email_domain block specifically
      const block = sql.match(
        /CREATE OR REPLACE FUNCTION public\.is_free_email_domain[\s\S]*?\$\$;/
      );
      expect(block?.[0]).toMatch(/IMMUTABLE/);
    });

    it('locks search_path = public, pg_temp', () => {
      const block = sql.match(
        /CREATE OR REPLACE FUNCTION public\.is_free_email_domain[\s\S]*?\$\$;/
      );
      expect(block?.[0]).toMatch(/SET search_path = public, pg_temp/);
    });

    it('REVOKEs from PUBLIC then GRANTs to anon, authenticated, service_role', () => {
      expect(sql).toMatch(
        /REVOKE EXECUTE ON FUNCTION public\.is_free_email_domain\(TEXT\) FROM PUBLIC/
      );
      expect(sql).toMatch(
        /GRANT EXECUTE ON FUNCTION public\.is_free_email_domain\(TEXT\) TO anon, authenticated, service_role/
      );
    });

    it('blocklist includes major Western providers', () => {
      expect(sql).toMatch(/'gmail\.com'/);
      expect(sql).toMatch(/'outlook\.com'/);
      expect(sql).toMatch(/'hotmail\.com'/);
      expect(sql).toMatch(/'yahoo\.com'/);
      expect(sql).toMatch(/'icloud\.com'/);
    });

    it('blocklist includes major Chinese providers (Matt prospect-region critical)', () => {
      expect(sql).toMatch(/'qq\.com'/);
      expect(sql).toMatch(/'163\.com'/);
      expect(sql).toMatch(/'126\.com'/);
    });

    it('blocklist includes privacy/secondary providers (proton, fastmail, gmx)', () => {
      expect(sql).toMatch(/'proton\.me'/);
      expect(sql).toMatch(/'fastmail\.com'/);
      expect(sql).toMatch(/'gmx\.com'/);
    });
  });

  // ─── lookup_school_by_domain function ────────────────────────────

  describe('lookup_school_by_domain function', () => {
    it('declares CREATE OR REPLACE FUNCTION public.lookup_school_by_domain', () => {
      expect(sql).toMatch(
        /CREATE OR REPLACE FUNCTION public\.lookup_school_by_domain\(_domain TEXT\)/
      );
    });

    it('returns NARROW projection (school_id, school_name) — never added_by/verified/created_at', () => {
      expect(sql).toMatch(
        /lookup_school_by_domain[\s\S]*RETURNS TABLE \(school_id UUID, school_name TEXT\)/
      );
    });

    it('is STABLE SECURITY DEFINER with locked search_path (Lesson #64)', () => {
      const block = sql.match(
        /CREATE OR REPLACE FUNCTION public\.lookup_school_by_domain[\s\S]*?\$\$;/
      );
      expect(block?.[0]).toMatch(/STABLE/);
      expect(block?.[0]).toMatch(/SECURITY DEFINER/);
      expect(block?.[0]).toMatch(/SET search_path = public, pg_temp/);
    });

    it('joins schools with verified=true filter', () => {
      const block = sql.match(
        /CREATE OR REPLACE FUNCTION public\.lookup_school_by_domain[\s\S]*?\$\$;/
      );
      expect(block?.[0]).toMatch(/sd\.verified = true/);
    });

    it('filters out non-active schools (status check)', () => {
      const block = sql.match(
        /CREATE OR REPLACE FUNCTION public\.lookup_school_by_domain[\s\S]*?\$\$;/
      );
      expect(block?.[0]).toMatch(/s\.status = 'active'/);
    });

    it('short-circuits on free-email domains (defence-in-depth)', () => {
      const block = sql.match(
        /CREATE OR REPLACE FUNCTION public\.lookup_school_by_domain[\s\S]*?\$\$;/
      );
      expect(block?.[0]).toMatch(/NOT public\.is_free_email_domain\(_domain\)/);
    });

    it('LIMITs to 1 row (single canonical match per domain)', () => {
      const block = sql.match(
        /CREATE OR REPLACE FUNCTION public\.lookup_school_by_domain[\s\S]*?\$\$;/
      );
      expect(block?.[0]).toMatch(/LIMIT 1/);
    });

    it('REVOKEs from PUBLIC then GRANTs to anon, authenticated, service_role', () => {
      expect(sql).toMatch(
        /REVOKE EXECUTE ON FUNCTION public\.lookup_school_by_domain\(TEXT\) FROM PUBLIC/
      );
      expect(sql).toMatch(
        /GRANT EXECUTE ON FUNCTION public\.lookup_school_by_domain\(TEXT\) TO anon, authenticated, service_role/
      );
    });

    it('uses case-insensitive domain comparison (lower-on-both-sides)', () => {
      const block = sql.match(
        /CREATE OR REPLACE FUNCTION public\.lookup_school_by_domain[\s\S]*?\$\$;/
      );
      expect(block?.[0]).toMatch(/lower\(sd\.domain\) = lower\(_domain\)/);
    });
  });

  // ─── Sanity DO block ─────────────────────────────────────────────

  describe('sanity check', () => {
    it('asserts table exists', () => {
      expect(sql).toMatch(
        /information_schema\.tables[\s\S]*table_name = 'school_domains'/
      );
    });

    it('asserts function exists in pg_proc', () => {
      expect(sql).toMatch(
        /pg_proc[\s\S]*proname = 'lookup_school_by_domain'/
      );
    });

    it('asserts gmail.com blocklist works (live function call)', () => {
      expect(sql).toMatch(
        /SELECT public\.is_free_email_domain\('gmail\.com'\) INTO v_blocklist_test/
      );
    });
  });

  // ─── DOWN script ─────────────────────────────────────────────────

  describe('paired DOWN script', () => {
    const downSql = loadMigration('_phase_4_2_school_domains.down.sql');

    it('drops functions in order then table', () => {
      const dropFns = downSql.indexOf('DROP FUNCTION IF EXISTS public.lookup_school_by_domain');
      const dropBlock = downSql.indexOf('DROP FUNCTION IF EXISTS public.is_free_email_domain');
      const dropTable = downSql.indexOf('DROP TABLE IF EXISTS school_domains');
      expect(dropFns).toBeGreaterThan(-1);
      expect(dropBlock).toBeGreaterThan(-1);
      expect(dropTable).toBeGreaterThan(dropFns); // table after functions
    });

    it('uses IF EXISTS — idempotent rollback', () => {
      expect(downSql).toMatch(/DROP FUNCTION IF EXISTS/);
      expect(downSql).toMatch(/DROP TABLE IF EXISTS/);
    });
  });
});
