/**
 * Asserts the shape of migration 20260428214403_consents.sql.
 *
 * Phase: Access Model v2 Phase 0.6b
 *
 * Single forward-compat table for FERPA / GDPR / PIPL / COPPA consent
 * tracking. Polymorphic subject identity (subject_id + subject_type).
 * RLS deny-all-by-default until Phase 5 wires self-read +
 * teacher-in-school-read.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260428214403';

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

describe('Migration: 20260428214403_consents', () => {
  const sql = loadMigration('_consents.sql');

  it('creates consents table with UUID PK and gen_random_uuid default', () => {
    expect(sql).toMatch(
      /CREATE TABLE consents[\s\S]+id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/
    );
  });

  it('subject_type CHECK enumerates exactly 4 values (no fabricator/platform_admin in CHECK clause)', () => {
    expect(sql).toContain(
      "subject_type IN ('student','teacher','guardian','community_member')"
    );
    // Pin: the literal CHECK clause for subject_type does NOT include
    // fabricator or platform_admin. (The migration's prose comments may
    // mention them as explicitly excluded — that's fine; we only care
    // about the SQL constraint shape.)
    const checkClause = sql.match(
      /subject_type\s+TEXT\s+NOT NULL\s+CHECK\s*\([^)]+\)/
    );
    expect(checkClause).toBeTruthy();
    expect(checkClause![0]).not.toContain("'fabricator'");
    expect(checkClause![0]).not.toContain("'platform_admin'");
  });

  it('consent_type CHECK enumerates 5 documented values', () => {
    for (const v of [
      'media_release',
      'ai_usage',
      'directory_visibility',
      'community_resource_contact',
      'third_party_share',
    ]) {
      expect(sql).toContain(`'${v}'`);
    }
  });

  it('basis CHECK enumerates 4 legal-basis values', () => {
    expect(sql).toContain(
      "basis IN ('opt_in','opt_out','parental','institutional')"
    );
  });

  it('granted_by + revoked_by reference auth.users with ON DELETE SET NULL', () => {
    expect(sql).toMatch(
      /granted_by UUID NULL REFERENCES auth\.users\(id\) ON DELETE SET NULL/
    );
    expect(sql).toMatch(
      /revoked_by UUID NULL REFERENCES auth\.users\(id\) ON DELETE SET NULL/
    );
  });

  it('scope_jsonb defaults to empty object', () => {
    expect(sql).toContain("scope_jsonb JSONB NOT NULL DEFAULT '{}'");
  });

  it('CHECK constraint enforces granted_at/revoked_at coherence', () => {
    expect(sql).toContain('granted_at IS NULL AND revoked_at IS NULL');
    expect(sql).toContain('revoked_at >= granted_at');
  });

  it('does NOT add a UNIQUE constraint on (subject, type) — history preserved', () => {
    expect(sql).not.toMatch(
      /UNIQUE\s*\(\s*subject_id\s*,\s*subject_type\s*,\s*consent_type/
    );
  });

  it('creates lookup index by (subject_id, subject_type, consent_type, created_at DESC)', () => {
    expect(sql).toContain('idx_consents_subject_lookup');
    expect(sql).toMatch(
      /idx_consents_subject_lookup[\s\S]+\(subject_id, subject_type, consent_type, created_at DESC\)/
    );
  });

  it('creates partial index for active-only consent queries', () => {
    expect(sql).toContain('idx_consents_active');
    expect(sql).toMatch(/WHERE revoked_at IS NULL/);
  });

  it('enables RLS', () => {
    expect(sql).toContain('ALTER TABLE consents ENABLE ROW LEVEL SECURITY');
  });

  it('creates exactly 1 deny-all-phase-0 RLS policy', () => {
    const policyCount = (sql.match(/CREATE POLICY/g) || []).length;
    expect(policyCount).toBe(1);
    expect(sql).toContain('consents_deny_all_phase_0');
    expect(sql).toMatch(/USING \(false\)/);
    expect(sql).toMatch(/WITH CHECK \(false\)/);
  });

  it('documents the deny-all policy intent via COMMENT', () => {
    expect(sql).toContain('COMMENT ON POLICY');
    expect(sql).toContain('rls-deny-all');
  });

  it('contains DO $$ block validating table + policy presence', () => {
    expect(sql).toContain('DO $$');
    expect(sql).toContain("table_name = 'consents'");
    expect(sql).toContain('pg_policies');
    expect(sql).toContain('consents_deny_all_phase_0');
  });

  it('contains no top-level DROP TABLE / DELETE / TRUNCATE', () => {
    expect(sql).not.toMatch(/^\s*DROP TABLE\s/im);
    expect(sql).not.toMatch(/^\s*DELETE\s/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\s/im);
  });
});

describe('Migration: 20260428214403_consents down script', () => {
  const sql = loadMigration('_consents.down.sql');

  it('drops the consents table CASCADE', () => {
    expect(sql).toContain('DROP TABLE IF EXISTS consents CASCADE');
  });
});
