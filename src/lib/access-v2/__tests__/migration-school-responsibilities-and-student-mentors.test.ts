/**
 * Asserts the shape of migration 20260428214735_school_responsibilities_and_student_mentors.sql.
 *
 * Phase: Access Model v2 Phase 0.6c
 *
 * Two seams:
 *   - school_responsibilities — programme coordinator assignments
 *     (PP/PYP/CAS/MYP/DP/Service/safeguarding)
 *   - student_mentors         — student-specific cross-program mentorship
 *     with polymorphic mentor identity (auth.users FK works for teachers,
 *     community_members, guardians once Phase 1 + auth seams land)
 *
 * Resolves FU-MENTOR-SCOPE P1 (cross-program teacher-mentor 403 today).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260428214735';

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

const RESPONSIBILITY_TYPES = [
  'pp_coordinator',
  'pyp_coordinator',
  'cas_coordinator',
  'myp_coordinator',
  'dp_coordinator',
  'service_coordinator',
  'safeguarding_lead',
] as const;

const MENTOR_PROGRAMMES = [
  'pp',
  'pypx',
  'cas',
  'service',
  'myp_personal_project',
  'open',
] as const;

describe('Migration: 20260428214735_school_responsibilities_and_student_mentors', () => {
  const sql = loadMigration(
    '_school_responsibilities_and_student_mentors.sql'
  );

  // ---- school_responsibilities ----

  it('creates school_responsibilities with school+teacher CASCADE FKs', () => {
    expect(sql).toMatch(
      /CREATE TABLE school_responsibilities[\s\S]+school_id UUID NOT NULL REFERENCES schools\(id\) ON DELETE CASCADE/
    );
    expect(sql).toMatch(
      /teacher_id UUID NOT NULL REFERENCES teachers\(id\) ON DELETE CASCADE/
    );
  });

  it('responsibility_type CHECK enumerates exactly 7 documented values', () => {
    for (const v of RESPONSIBILITY_TYPES) {
      expect(sql).toContain(`'${v}'`);
    }
    const checkClause = sql.match(
      /responsibility_type TEXT NOT NULL\s+CHECK\s*\(responsibility_type IN \([\s\S]+?\)\s*\)/
    );
    expect(checkClause).toBeTruthy();
    // Confirm count via the matched clause
    const matches = checkClause![0].match(/'\w+'/g) || [];
    expect(matches.length).toBe(7);
  });

  it('school_responsibilities has scope_jsonb defaulting to {}', () => {
    expect(sql).toMatch(
      /school_responsibilities[\s\S]+scope_jsonb JSONB NOT NULL DEFAULT '{}'/
    );
  });

  it('school_responsibilities has soft-delete via deleted_at', () => {
    expect(sql).toMatch(
      /school_responsibilities[\s\S]+deleted_at TIMESTAMPTZ NULL/
    );
  });

  it('does NOT add UNIQUE constraint on school_responsibilities — multiple coords per programme allowed', () => {
    // Allow PRIMARY KEY but no other UNIQUE on school_responsibilities
    const tableBlock = sql.match(
      /CREATE TABLE school_responsibilities[\s\S]+?\n\);/
    );
    expect(tableBlock).toBeTruthy();
    // Inside the table block: no standalone UNIQUE clause
    expect(tableBlock![0]).not.toMatch(/^\s*UNIQUE\s*\(/m);
  });

  it('creates active-only index on (school_id, responsibility_type)', () => {
    expect(sql).toContain('idx_school_responsibilities_active_lookup');
    expect(sql).toMatch(
      /idx_school_responsibilities_active_lookup[\s\S]+ON school_responsibilities\(school_id, responsibility_type\)\s+WHERE deleted_at IS NULL/
    );
  });

  it('creates reverse-lookup index on teacher_id', () => {
    expect(sql).toContain('idx_school_responsibilities_teacher');
    expect(sql).toMatch(
      /idx_school_responsibilities_teacher[\s\S]+WHERE deleted_at IS NULL/
    );
  });

  // ---- student_mentors ----

  it('creates student_mentors with student CASCADE FK', () => {
    expect(sql).toMatch(
      /CREATE TABLE student_mentors[\s\S]+student_id UUID NOT NULL REFERENCES students\(id\) ON DELETE CASCADE/
    );
  });

  it('student_mentors uses polymorphic mentor_user_id REFERENCES auth.users', () => {
    expect(sql).toMatch(
      /mentor_user_id UUID NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/
    );
  });

  it('programme CHECK enumerates exactly 6 documented values', () => {
    for (const v of MENTOR_PROGRAMMES) {
      expect(sql).toContain(`'${v}'`);
    }
    const checkClause = sql.match(
      /programme TEXT NOT NULL\s+CHECK\s*\(programme IN \([\s\S]+?\)\s*\)/
    );
    expect(checkClause).toBeTruthy();
    const matches = checkClause![0].match(/'\w+'/g) || [];
    expect(matches.length).toBe(6);
  });

  it('student_mentors has soft-delete via deleted_at', () => {
    expect(sql).toMatch(
      /student_mentors[\s\S]+deleted_at TIMESTAMPTZ NULL/
    );
  });

  it('creates student-programme lookup index', () => {
    expect(sql).toContain('idx_student_mentors_student_programme');
    expect(sql).toMatch(
      /idx_student_mentors_student_programme[\s\S]+ON student_mentors\(student_id, programme\)\s+WHERE deleted_at IS NULL/
    );
  });

  it('creates mentor-side lookup index', () => {
    expect(sql).toContain('idx_student_mentors_mentor');
    expect(sql).toMatch(
      /idx_student_mentors_mentor[\s\S]+ON student_mentors\(mentor_user_id\)\s+WHERE deleted_at IS NULL/
    );
  });

  // ---- RLS ----

  it('enables RLS on both tables', () => {
    expect(sql).toContain(
      'ALTER TABLE school_responsibilities ENABLE ROW LEVEL SECURITY'
    );
    expect(sql).toContain(
      'ALTER TABLE student_mentors ENABLE ROW LEVEL SECURITY'
    );
  });

  it('school_responsibilities scopes via teachers.school_id', () => {
    expect(sql).toContain('school_responsibilities_school_read');
    expect(sql).toMatch(/FROM teachers t\s+WHERE t\.id = auth\.uid\(\)/);
  });

  it('student_mentors mentor self-read policy uses auth.uid()', () => {
    expect(sql).toContain('student_mentors_mentor_self_read');
    expect(sql).toMatch(/USING \(mentor_user_id = auth\.uid\(\)\)/);
  });

  it('student_mentors school-teacher read uses students.school_id chain (Phase 0.3 column)', () => {
    expect(sql).toContain('student_mentors_school_teacher_read');
    expect(sql).toMatch(/JOIN teachers t ON t\.school_id = s\.school_id/);
  });

  it('creates exactly 3 SELECT policies — INSERT/UPDATE/DELETE deny-by-default', () => {
    const policyCount = (sql.match(/CREATE POLICY/g) || []).length;
    expect(policyCount).toBe(3);
    expect(sql).not.toMatch(/FOR INSERT/i);
    expect(sql).not.toMatch(/FOR UPDATE/i);
    expect(sql).not.toMatch(/FOR DELETE/i);
  });

  // ---- Sanity check ----

  it('contains DO $$ block validating both tables exist', () => {
    expect(sql).toContain('DO $$');
    expect(sql).toContain("table_name = 'school_responsibilities'");
    expect(sql).toContain("table_name = 'student_mentors'");
  });

  // ---- Destructive guard ----

  it('contains no top-level DROP TABLE / DELETE / TRUNCATE', () => {
    expect(sql).not.toMatch(/^\s*DROP TABLE\s/im);
    expect(sql).not.toMatch(/^\s*DELETE\s/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\s/im);
  });
});

describe('Migration: 20260428214735_school_responsibilities_and_student_mentors down script', () => {
  const sql = loadMigration(
    '_school_responsibilities_and_student_mentors.down.sql'
  );

  it('drops both tables CASCADE', () => {
    expect(sql).toContain(
      'DROP TABLE IF EXISTS student_mentors CASCADE'
    );
    expect(sql).toContain(
      'DROP TABLE IF EXISTS school_responsibilities CASCADE'
    );
  });

  it('drops student_mentors before school_responsibilities (consistent with creation order)', () => {
    const sm = sql.indexOf('DROP TABLE IF EXISTS student_mentors');
    const sr = sql.indexOf('DROP TABLE IF EXISTS school_responsibilities');
    expect(sm).toBeLessThan(sr);
  });
});
