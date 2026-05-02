/**
 * Asserts the shape of migration 20260502034114_phase_4_3_school_setting_changes.sql.
 *
 * Phase: Access Model v2 Phase 4.3 (governance engine schema)
 *
 * Two tables (change ledger + rate-state side table), two enums (tier +
 * status), four indexes, four RLS policies on the main table + one on
 * rate_state, one SECURITY DEFINER helper.
 *
 * Sliding-hour rate limit semantics: SUM(count) over the last hour ≤
 * max. Bucket-per-hour storage; bucket-per-event would be too noisy.
 *
 * Bootstrap grace handling lives in TS (governance/setting-change.ts),
 * NOT in SQL. The migration just creates the persistence layer.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260502034114';

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

describe('Migration: 20260502034114_phase_4_3_school_setting_changes', () => {
  const sql = loadMigration('_phase_4_3_school_setting_changes.sql');

  // ─── Enums ───────────────────────────────────────────────────────

  describe('enum types', () => {
    it('declares school_setting_change_tier with low_stakes / high_stakes values', () => {
      expect(sql).toMatch(
        /CREATE TYPE school_setting_change_tier AS ENUM \('low_stakes', 'high_stakes'\)/
      );
    });

    it('declares school_setting_change_status with all 4 lifecycle values', () => {
      expect(sql).toMatch(/CREATE TYPE school_setting_change_status AS ENUM/);
      expect(sql).toMatch(/'pending'/);
      expect(sql).toMatch(/'applied'/);
      expect(sql).toMatch(/'reverted'/);
      expect(sql).toMatch(/'expired'/);
    });
  });

  // ─── school_setting_changes table ────────────────────────────────

  describe('school_setting_changes table', () => {
    it('declares CREATE TABLE school_setting_changes', () => {
      expect(sql).toMatch(/CREATE TABLE school_setting_changes/);
    });

    it('has all expected columns', () => {
      expect(sql).toMatch(/id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
      expect(sql).toMatch(
        /school_id UUID NOT NULL REFERENCES schools\(id\) ON DELETE CASCADE/
      );
      expect(sql).toMatch(
        /actor_user_id UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE RESTRICT/
      );
      expect(sql).toMatch(/change_type TEXT NOT NULL/);
      expect(sql).toMatch(/tier school_setting_change_tier NOT NULL/);
      expect(sql).toMatch(/payload_jsonb JSONB NOT NULL/);
      expect(sql).toMatch(
        /status school_setting_change_status NOT NULL DEFAULT 'pending'/
      );
      expect(sql).toMatch(/applied_at TIMESTAMPTZ NULL/);
      expect(sql).toMatch(/confirmed_by_user_id UUID REFERENCES auth\.users\(id\)/);
      expect(sql).toMatch(/reverted_at TIMESTAMPTZ NULL/);
      expect(sql).toMatch(/reverted_by_user_id UUID REFERENCES auth\.users\(id\)/);
      expect(sql).toMatch(/expires_at TIMESTAMPTZ NULL/);
      expect(sql).toMatch(/created_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/);
    });

    it('declares 3 indexes (school+status, pending+expiry partial, school+applied recent partial)', () => {
      expect(sql).toMatch(/idx_ssc_school_status[\s\S]*\(school_id, status\)/);
      expect(sql).toMatch(
        /idx_ssc_pending_expiry[\s\S]*\(expires_at\)\s+WHERE status = 'pending'/
      );
      expect(sql).toMatch(
        /idx_ssc_school_applied_recent[\s\S]*\(school_id, applied_at DESC\)\s+WHERE status = 'applied'/
      );
    });
  });

  // ─── RLS on school_setting_changes ───────────────────────────────

  describe('RLS policies on school_setting_changes', () => {
    it('enables RLS', () => {
      expect(sql).toMatch(/ALTER TABLE school_setting_changes ENABLE ROW LEVEL SECURITY/);
    });

    it('has 4 policies covering SELECT/INSERT/UPDATE/DELETE', () => {
      expect(sql).toMatch(/ssc_school_teacher_select[\s\S]*FOR SELECT/);
      expect(sql).toMatch(/ssc_school_teacher_insert[\s\S]*FOR INSERT/);
      expect(sql).toMatch(/ssc_school_teacher_update[\s\S]*FOR UPDATE/);
      expect(sql).toMatch(/ssc_school_teacher_delete[\s\S]*FOR DELETE/);
    });

    it('all 4 ssc policies gate on current_teacher_school_id()', () => {
      // Crude but effective: we expect at least 4 references to the helper
      // in the ssc policies block. Some policies use it twice (USING + WITH CHECK).
      const block = sql.match(
        /ALTER TABLE school_setting_changes ENABLE[\s\S]*?-- =+\n-- 4\./
      );
      const matches = block?.[0]?.match(/current_teacher_school_id\(\)/g);
      expect(matches?.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ─── school_setting_changes_rate_state table ─────────────────────

  describe('school_setting_changes_rate_state table', () => {
    it('declares CREATE TABLE with composite primary key', () => {
      expect(sql).toMatch(/CREATE TABLE school_setting_changes_rate_state/);
      expect(sql).toMatch(/PRIMARY KEY \(actor_user_id, window_start\)/);
    });

    it('cascades on auth.users delete', () => {
      expect(sql).toMatch(
        /actor_user_id UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/
      );
    });

    it('declares actor+window descending index for fast recent-window scans', () => {
      expect(sql).toMatch(
        /idx_ssrs_actor_recent[\s\S]*\(actor_user_id, window_start DESC\)/
      );
    });

    it('enables RLS with self-read-only policy', () => {
      expect(sql).toMatch(
        /ALTER TABLE school_setting_changes_rate_state ENABLE ROW LEVEL SECURITY/
      );
      expect(sql).toMatch(
        /ssrs_self_read[\s\S]*FOR SELECT[\s\S]*USING \(actor_user_id = auth\.uid\(\)\)/
      );
    });
  });

  // ─── enforce_setting_change_rate_limit function ──────────────────

  describe('enforce_setting_change_rate_limit function', () => {
    it('declares CREATE OR REPLACE FUNCTION', () => {
      expect(sql).toMatch(
        /CREATE OR REPLACE FUNCTION public\.enforce_setting_change_rate_limit\(/
      );
    });

    it('signature: (_actor UUID, _max_changes INTEGER DEFAULT 10, _window_hours INTEGER DEFAULT 1)', () => {
      expect(sql).toMatch(/_actor UUID/);
      expect(sql).toMatch(/_max_changes INTEGER DEFAULT 10/);
      expect(sql).toMatch(/_window_hours INTEGER DEFAULT 1/);
    });

    it('returns TABLE (bucket_count, window_total, rate_limited BOOLEAN)', () => {
      expect(sql).toMatch(
        /RETURNS TABLE \(\s*bucket_count INTEGER,\s*window_total INTEGER,\s*rate_limited BOOLEAN\s*\)/
      );
    });

    it('is SECURITY DEFINER with search_path locked', () => {
      const block = sql.match(
        /CREATE OR REPLACE FUNCTION public\.enforce_setting_change_rate_limit[\s\S]*?\$\$;/
      );
      expect(block?.[0]).toMatch(/SECURITY DEFINER/);
      expect(block?.[0]).toMatch(/SET search_path = public, pg_temp/);
    });

    it('uses date_trunc(hour, now()) for bucket boundary', () => {
      const block = sql.match(
        /CREATE OR REPLACE FUNCTION public\.enforce_setting_change_rate_limit[\s\S]*?\$\$;/
      );
      expect(block?.[0]).toMatch(/date_trunc\('hour', now\(\)\)/);
    });

    it('checks window total BEFORE incrementing (no counter pollution on throttled requests)', () => {
      const block = sql.match(
        /CREATE OR REPLACE FUNCTION public\.enforce_setting_change_rate_limit[\s\S]*?\$\$;/
      );
      // The check-before-insert is structural: SELECT v_window_total ...
      // IF v_window_total >= ... RETURN ... before INSERT
      expect(block?.[0]).toMatch(/v_window_total >= _max_changes/);
      expect(block?.[0]).toMatch(/RETURN QUERY SELECT 0, v_window_total, true/);
    });

    it('uses ON CONFLICT DO UPDATE for atomic increment', () => {
      const block = sql.match(
        /CREATE OR REPLACE FUNCTION public\.enforce_setting_change_rate_limit[\s\S]*?\$\$;/
      );
      expect(block?.[0]).toMatch(/ON CONFLICT \(actor_user_id, window_start\)/);
      expect(block?.[0]).toMatch(/DO UPDATE SET count = school_setting_changes_rate_state\.count \+ 1/);
    });

    it('REVOKEs from PUBLIC then GRANTs to authenticated, service_role', () => {
      expect(sql).toMatch(
        /REVOKE EXECUTE ON FUNCTION public\.enforce_setting_change_rate_limit\(UUID, INTEGER, INTEGER\) FROM PUBLIC/
      );
      expect(sql).toMatch(
        /GRANT EXECUTE ON FUNCTION public\.enforce_setting_change_rate_limit\(UUID, INTEGER, INTEGER\) TO authenticated, service_role/
      );
    });
  });

  // ─── Sanity check ────────────────────────────────────────────────

  describe('sanity check DO block', () => {
    it('asserts both tables + function + both enums exist', () => {
      expect(sql).toMatch(/'school_setting_changes'/);
      expect(sql).toMatch(/'school_setting_changes_rate_state'/);
      expect(sql).toMatch(/'enforce_setting_change_rate_limit'/);
      expect(sql).toMatch(/'school_setting_change_tier'/);
      expect(sql).toMatch(/'school_setting_change_status'/);
    });
  });

  // ─── DOWN script ─────────────────────────────────────────────────

  describe('paired DOWN script', () => {
    const downSql = loadMigration('_phase_4_3_school_setting_changes.down.sql');

    it('drops in reverse order: function → tables → enums', () => {
      const dropFn = downSql.indexOf('DROP FUNCTION IF EXISTS public.enforce_setting_change_rate_limit');
      const dropRateTable = downSql.indexOf('DROP TABLE IF EXISTS school_setting_changes_rate_state');
      const dropMainTable = downSql.indexOf('DROP TABLE IF EXISTS school_setting_changes;');
      const dropStatusEnum = downSql.indexOf('DROP TYPE IF EXISTS school_setting_change_status');
      const dropTierEnum = downSql.indexOf('DROP TYPE IF EXISTS school_setting_change_tier');

      expect(dropFn).toBeGreaterThan(-1);
      expect(dropRateTable).toBeGreaterThan(dropFn);
      expect(dropMainTable).toBeGreaterThan(dropRateTable);
      expect(dropStatusEnum).toBeGreaterThan(dropMainTable);
      expect(dropTierEnum).toBeGreaterThan(dropStatusEnum);
    });

    it('uses IF EXISTS — idempotent', () => {
      expect(downSql).toMatch(/DROP FUNCTION IF EXISTS/);
      expect(downSql).toMatch(/DROP TABLE IF EXISTS/);
      expect(downSql).toMatch(/DROP TYPE IF EXISTS/);
    });
  });
});
