/**
 * Asserts the shape of migration 20260428214009_school_collections_and_guardians.sql.
 *
 * Phase: Access Model v2 Phase 0.6a
 *
 * Four forward-compat tables, schema only:
 *   - school_resources          — polymorphic people/place/thing collection
 *   - school_resource_relations — graph between resources
 *   - guardians                  — parent/guardian records
 *   - student_guardians         — many-to-many junction
 *
 * RLS enabled on all four with Phase-0-baseline "teachers in same school can read"
 * policies. INSERT/UPDATE/DELETE deny-by-default until Phase 3 expands.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260428214009';

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

describe('Migration: 20260428214009_school_collections_and_guardians', () => {
  const sql = loadMigration('_school_collections_and_guardians.sql');

  // ---- school_resources ----

  it('creates school_resources with school_id FK CASCADE', () => {
    expect(sql).toMatch(
      /CREATE TABLE school_resources[\s\S]+school_id UUID NOT NULL REFERENCES schools\(id\) ON DELETE CASCADE/
    );
  });

  it('school_resources.resource_type CHECK enumerates 4 values', () => {
    expect(sql).toContain(
      "resource_type IN ('person','place','thing','organization')"
    );
  });

  it('school_resources.visibility CHECK enumerates 3 values + defaults school', () => {
    expect(sql).toMatch(
      /visibility TEXT NOT NULL DEFAULT 'school'[\s\S]+CHECK \(visibility IN \('school','class','private'\)\)/
    );
  });

  it('school_resources.consent_status CHECK enumerates 4 values + defaults pending', () => {
    expect(sql).toMatch(
      /consent_status TEXT NOT NULL DEFAULT 'pending'[\s\S]+CHECK \(consent_status IN \('pending','granted','revoked','expired'\)\)/
    );
  });

  it('school_resources includes details_jsonb + contact_info_jsonb + tags TEXT[]', () => {
    expect(sql).toContain("details_jsonb JSONB NOT NULL DEFAULT '{}'");
    expect(sql).toContain("contact_info_jsonb JSONB NOT NULL DEFAULT '{}'");
    expect(sql).toMatch(/tags TEXT\[\] NOT NULL DEFAULT ARRAY\[\]::TEXT\[\]/);
  });

  it('school_resources class_id is nullable FK to classes', () => {
    expect(sql).toMatch(
      /class_id UUID NULL REFERENCES classes\(id\) ON DELETE CASCADE/
    );
  });

  it('school_resources has 4 indexes including GIN on tags', () => {
    expect(sql).toContain('idx_school_resources_school');
    expect(sql).toContain('idx_school_resources_type');
    expect(sql).toContain('idx_school_resources_class');
    expect(sql).toMatch(/idx_school_resources_tags[\s\S]+USING GIN\(tags\)/);
  });

  // ---- school_resource_relations ----

  it('creates school_resource_relations with both FKs CASCADE', () => {
    expect(sql).toMatch(
      /from_resource_id UUID NOT NULL REFERENCES school_resources\(id\) ON DELETE CASCADE/
    );
    expect(sql).toMatch(
      /to_resource_id UUID NOT NULL REFERENCES school_resources\(id\) ON DELETE CASCADE/
    );
  });

  it('school_resource_relations.relation_type CHECK enumerates 5 values', () => {
    expect(sql).toContain(
      "relation_type IN ('works_at','located_at','partners_with','member_of','reports_to')"
    );
  });

  it('school_resource_relations forbids self-loops + dedupes by triple', () => {
    expect(sql).toContain('CHECK (from_resource_id <> to_resource_id)');
    expect(sql).toContain(
      'UNIQUE (from_resource_id, to_resource_id, relation_type)'
    );
  });

  // ---- guardians ----

  it('creates guardians with school_id FK CASCADE', () => {
    expect(sql).toMatch(
      /CREATE TABLE guardians[\s\S]+school_id UUID NOT NULL REFERENCES schools\(id\) ON DELETE CASCADE/
    );
  });

  it('guardians.relationship_type allows NULL or 8 enum values', () => {
    expect(sql).toContain(
      "relationship_type IS NULL OR relationship_type IN"
    );
    expect(sql).toContain(
      "'mother','father','parent','step_parent','grandparent','guardian','foster_parent','other'"
    );
  });

  it('guardians has lower(email) partial index', () => {
    expect(sql).toMatch(
      /idx_guardians_email_lower[\s\S]+ON guardians\(LOWER\(email\)\) WHERE email IS NOT NULL/
    );
  });

  // ---- student_guardians ----

  it('creates student_guardians with composite PK + both FKs CASCADE', () => {
    expect(sql).toMatch(
      /student_id UUID NOT NULL REFERENCES students\(id\) ON DELETE CASCADE/
    );
    expect(sql).toMatch(
      /guardian_id UUID NOT NULL REFERENCES guardians\(id\) ON DELETE CASCADE/
    );
    expect(sql).toContain('PRIMARY KEY (student_id, guardian_id)');
  });

  it('student_guardians enforces at most one primary guardian per student via partial unique index', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_student_guardians_one_primary[\s\S]+ON student_guardians\(student_id\) WHERE is_primary = true/
    );
  });

  it('student_guardians.is_primary + receives_reports default correctly', () => {
    expect(sql).toContain('is_primary BOOLEAN NOT NULL DEFAULT false');
    expect(sql).toContain('receives_reports BOOLEAN NOT NULL DEFAULT true');
  });

  // ---- RLS ----

  it('enables RLS on all 4 tables', () => {
    expect(sql).toContain('ALTER TABLE school_resources ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE school_resource_relations ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE guardians ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY');
  });

  it('creates exactly 4 SELECT policies (one per table) — INSERT/UPDATE/DELETE deny-by-default', () => {
    const policyCount = (sql.match(/CREATE POLICY/g) || []).length;
    expect(policyCount).toBe(4);
    // None should be FOR INSERT / UPDATE / DELETE in this migration
    expect(sql).not.toMatch(/FOR INSERT/i);
    expect(sql).not.toMatch(/FOR UPDATE/i);
    expect(sql).not.toMatch(/FOR DELETE/i);
  });

  it('school_resources SELECT scopes via teachers.school_id = my school', () => {
    expect(sql).toContain('school_resources_school_read');
    expect(sql).toMatch(/FROM teachers t\s+WHERE t\.id = auth\.uid\(\)/);
  });

  it('student_guardians SELECT scopes via classes.teacher_id = me', () => {
    expect(sql).toContain('student_guardians_via_student');
    expect(sql).toMatch(/c\.teacher_id = auth\.uid\(\)/);
  });

  // ---- Sanity check ----

  it('contains DO $$ block validating all 4 tables exist', () => {
    expect(sql).toContain('DO $$');
    for (const t of [
      'school_resources',
      'school_resource_relations',
      'guardians',
      'student_guardians',
    ]) {
      expect(sql).toContain(`'${t}'`);
    }
  });

  // ---- Destructive guard ----

  it('contains no top-level DROP TABLE / DELETE / TRUNCATE statements', () => {
    expect(sql).not.toMatch(/^\s*DROP TABLE\s/im);
    expect(sql).not.toMatch(/^\s*DELETE\s/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\s/im);
  });
});

describe('Migration: 20260428214009_school_collections_and_guardians down script', () => {
  const sql = loadMigration('_school_collections_and_guardians.down.sql');

  it('drops all 4 tables with CASCADE', () => {
    for (const t of [
      'student_guardians',
      'school_resource_relations',
      'guardians',
      'school_resources',
    ]) {
      expect(sql).toContain(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
  });

  it('drops dependents BEFORE parents (student_guardians/relations before guardians/resources)', () => {
    const sg = sql.indexOf('DROP TABLE IF EXISTS student_guardians');
    const srr = sql.indexOf(
      'DROP TABLE IF EXISTS school_resource_relations'
    );
    const g = sql.indexOf('DROP TABLE IF EXISTS guardians');
    const sr = sql.indexOf('DROP TABLE IF EXISTS school_resources');
    expect(sg).toBeLessThan(g);
    expect(srr).toBeLessThan(sr);
  });
});
