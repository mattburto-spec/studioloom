/**
 * Asserts the shape of migration 20260428142618_user_profiles.sql.
 *
 * Phase: Access Model v2 Phase 0.5 (Option B chosen 28 Apr 2026)
 *
 * Centralised platform-role storage for every Supabase auth user.
 * Separate user_profiles table extending auth.users via FK (Supabase
 * recommendation + matches existing teachers pattern from mig 001).
 *
 * Ships with 6-value user_type enum from day one:
 *   student / teacher / fabricator / platform_admin / community_member / guardian
 * The first 4 have code paths in v2; the last 2 match schema seams
 * landing in Phase 0.6 (school_resources, guardians + student_guardians).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260428142618';

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

const EXPECTED_USER_TYPES = [
  'student',
  'teacher',
  'fabricator',
  'platform_admin',
  'community_member',
  'guardian',
] as const;

describe('Migration: 20260428142618_user_profiles', () => {
  const sql = loadMigration('_user_profiles.sql');

  // ---- Table shape ----

  it('creates user_profiles with id PK referencing auth.users ON DELETE CASCADE', () => {
    expect(sql).toMatch(
      /CREATE TABLE user_profiles[\s\S]+id UUID PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE CASCADE/
    );
  });

  it('user_type defaults to student + NOT NULL', () => {
    expect(sql).toMatch(
      /user_type TEXT NOT NULL DEFAULT 'student'/
    );
  });

  it('CHECK constraint enumerates all 6 user_type values', () => {
    for (const v of EXPECTED_USER_TYPES) {
      expect(sql).toContain(`'${v}'`);
    }
    // The CHECK clause itself
    expect(sql).toMatch(/CHECK\s*\(\s*user_type IN/);
  });

  it('is_platform_admin BOOLEAN NOT NULL DEFAULT false', () => {
    expect(sql).toMatch(
      /is_platform_admin BOOLEAN NOT NULL DEFAULT false/
    );
  });

  it('has created_at + updated_at TIMESTAMPTZ NOT NULL DEFAULT now()', () => {
    expect(sql).toMatch(/created_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/);
    expect(sql).toMatch(/updated_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/);
  });

  // ---- Indexes ----

  it('creates idx_user_profiles_user_type', () => {
    expect(sql).toContain('idx_user_profiles_user_type');
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_user_profiles_user_type[\s\S]+ON user_profiles\(user_type\)/
    );
  });

  it('creates idx_user_profiles_platform_admin as a partial index', () => {
    expect(sql).toContain('idx_user_profiles_platform_admin');
    expect(sql).toMatch(/WHERE is_platform_admin = true/);
  });

  // ---- Trigger ----

  it('creates handle_new_user_profile function with SECURITY DEFINER', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION handle_new_user_profile');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain("SET search_path = public");
  });

  it('trigger reads raw_user_meta_data->>user_type with student fallback', () => {
    expect(sql).toContain("raw_user_meta_data ->> 'user_type'");
    expect(sql).toContain("'student'");
    expect(sql).toContain('COALESCE');
  });

  it('trigger uses ON CONFLICT (id) DO NOTHING for idempotency', () => {
    expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
  });

  it('drops + creates on_auth_user_profile_created AFTER INSERT trigger', () => {
    expect(sql).toContain(
      'DROP TRIGGER IF EXISTS on_auth_user_profile_created ON auth.users'
    );
    expect(sql).toMatch(
      /CREATE TRIGGER on_auth_user_profile_created\s+AFTER INSERT ON auth\.users/
    );
  });

  // ---- Backfill ----

  it('backfills user_profiles from existing teachers with user_type=teacher', () => {
    expect(sql).toContain('INSERT INTO user_profiles');
    expect(sql).toContain('FROM teachers');
    expect(sql).toContain("'teacher'");
    expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
  });

  // ---- RLS ----

  it('enables RLS on user_profiles', () => {
    expect(sql).toContain('ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY');
  });

  it('creates self-read SELECT policy', () => {
    expect(sql).toContain('user_profiles_self_read');
    expect(sql).toMatch(/USING \(id = auth\.uid\(\)\)/);
  });

  it('creates platform_admin-anywhere SELECT policy', () => {
    expect(sql).toContain('user_profiles_platform_admin_read');
    expect(sql).toContain('is_platform_admin = true');
  });

  it('does NOT create INSERT/UPDATE/DELETE policies (deny by default — only trigger + service role write)', () => {
    expect(sql).not.toMatch(/FOR INSERT/i);
    expect(sql).not.toMatch(/FOR UPDATE/i);
    // FOR DELETE: cascade-only is the design, no explicit policy
    const policyCount = (sql.match(/CREATE POLICY/g) || []).length;
    expect(policyCount).toBe(2); // exactly the two SELECT policies
  });

  // ---- Sanity check ----

  it('contains DO $$ block validating table existence + backfill row counts', () => {
    expect(sql).toContain('DO $$');
    expect(sql).toContain("table_name = 'user_profiles'");
    expect(sql).toContain('teachers');
    expect(sql).toContain("user_type = 'teacher'");
  });

  // ---- Destructive guard ----

  it('contains no top-level DROP TABLE / DELETE / TRUNCATE', () => {
    expect(sql).not.toMatch(/^\s*DROP TABLE\s/im);
    expect(sql).not.toMatch(/^\s*DELETE\s/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\s/im);
  });
});

describe('Migration: 20260428142618_user_profiles down script', () => {
  const sql = loadMigration('_user_profiles.down.sql');

  it('drops trigger + function + table in reverse order', () => {
    expect(sql).toContain(
      'DROP TRIGGER IF EXISTS on_auth_user_profile_created ON auth.users'
    );
    expect(sql).toContain('DROP FUNCTION IF EXISTS handle_new_user_profile()');
    expect(sql).toContain('DROP TABLE IF EXISTS user_profiles CASCADE');
  });

  it('drops trigger BEFORE function (function referenced by trigger)', () => {
    const dropTrigger = sql.indexOf('DROP TRIGGER');
    const dropFunction = sql.indexOf('DROP FUNCTION');
    const dropTable = sql.indexOf('DROP TABLE');
    expect(dropTrigger).toBeGreaterThan(-1);
    expect(dropTrigger).toBeLessThan(dropFunction);
    expect(dropFunction).toBeLessThan(dropTable);
  });
});
