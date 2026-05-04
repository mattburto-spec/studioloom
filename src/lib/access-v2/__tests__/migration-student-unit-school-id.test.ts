/**
 * Asserts the shape of migration 20260428134250_student_unit_school_id.sql.
 *
 * Phase: Access Model v2 Phase 0.3 (Option A scope)
 *
 * Adds students.school_id + units.school_id as nullable FKs to schools(id),
 * with partial indexes and backfill from the teacher chain. NOT NULL
 * tightening is deliberately deferred to Phase 0.8 (orphan-teacher
 * personal-school creation runs first, then a wrap-up migration tightens
 * NULLs across students + units + classes in one transaction).
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260428134250';

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

describe('Migration: 20260428134250_student_unit_school_id', () => {
  const sql = loadMigration('_student_unit_school_id.sql');

  // ---- Column adds ----

  it('adds students.school_id as nullable UUID FK to schools', () => {
    expect(sql).toMatch(
      /ALTER TABLE students\s+ADD COLUMN school_id UUID NULL\s+REFERENCES schools\(id\) ON DELETE SET NULL/
    );
  });

  it('adds units.school_id as nullable UUID FK to schools', () => {
    expect(sql).toMatch(
      /ALTER TABLE units\s+ADD COLUMN school_id UUID NULL\s+REFERENCES schools\(id\) ON DELETE SET NULL/
    );
  });

  // ---- Indexes ----

  it('creates idx_students_school_id as a partial index (WHERE school_id IS NOT NULL)', () => {
    expect(sql).toContain('idx_students_school_id');
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_students_school_id[\s\S]+WHERE school_id IS NOT NULL/
    );
  });

  it('creates idx_units_school_id as a partial index (WHERE school_id IS NOT NULL)', () => {
    expect(sql).toContain('idx_units_school_id');
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_units_school_id[\s\S]+WHERE school_id IS NOT NULL/
    );
  });

  // ---- Backfill ----

  it('backfills students.school_id from class.teacher.school_id chain', () => {
    expect(sql).toContain('UPDATE students');
    expect(sql).toContain('FROM classes c, teachers t');
    expect(sql).toContain('s.class_id = c.id');
    expect(sql).toContain('c.teacher_id = t.id');
    expect(sql).toContain('t.school_id IS NOT NULL');
  });

  it('backfills units.school_id via COALESCE(author_teacher_id, teacher_id) chain', () => {
    expect(sql).toContain('UPDATE units');
    expect(sql).toContain(
      'COALESCE(u.author_teacher_id, u.teacher_id) = t.id'
    );
    expect(sql).toContain('t.school_id IS NOT NULL');
  });

  it('only backfills rows where school_id IS NULL (idempotent)', () => {
    // Both UPDATE statements must guard with WHERE school_id IS NULL
    const updates = sql.match(/UPDATE \w+ \w+\s+SET school_id = t\.school_id[\s\S]+?WHERE/g);
    expect(updates).toBeTruthy();
    expect(updates!.length).toBe(2);
    // Each update must include "s.school_id IS NULL" or "u.school_id IS NULL"
    expect(sql).toMatch(/s\.school_id IS NULL/);
    expect(sql).toMatch(/u\.school_id IS NULL/);
  });

  // ---- NOT NULL deferral ----

  it('does NOT tighten to NOT NULL (deferred to Phase 0.8)', () => {
    expect(sql).not.toMatch(/ALTER COLUMN school_id SET NOT NULL/);
    expect(sql).not.toMatch(/ALTER COLUMN school_id DROP DEFAULT/);
  });

  // ---- Sanity check + reporting ----

  it('contains DO $$ block with row-count reporting', () => {
    expect(sql).toContain('DO $$');
    expect(sql).toContain("table_name='students'");
    expect(sql).toContain("table_name='units'");
    expect(sql).toContain('RAISE NOTICE');
    expect(sql).toContain('orphan');
  });

  // ---- Destructive guard ----

  it('contains no DROP / DELETE / TRUNCATE statements (destructive guard)', () => {
    expect(sql).not.toMatch(/^\s*DROP\s/im);
    expect(sql).not.toMatch(/^\s*DELETE\s/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\s/im);
  });
});

describe('Migration: 20260428134250_student_unit_school_id down script', () => {
  const sql = loadMigration('_student_unit_school_id.down.sql');

  it('drops both indexes', () => {
    expect(sql).toContain('DROP INDEX IF EXISTS idx_units_school_id');
    expect(sql).toContain('DROP INDEX IF EXISTS idx_students_school_id');
  });

  it('drops both columns', () => {
    expect(sql).toContain(
      'ALTER TABLE units DROP COLUMN IF EXISTS school_id'
    );
    expect(sql).toContain(
      'ALTER TABLE students DROP COLUMN IF EXISTS school_id'
    );
  });

  it('drops indexes BEFORE columns (indexes reference columns)', () => {
    const dropIndex = sql.indexOf('DROP INDEX IF EXISTS');
    const dropColumn = sql.indexOf('DROP COLUMN IF EXISTS');
    expect(dropIndex).toBeGreaterThan(-1);
    expect(dropColumn).toBeGreaterThan(-1);
    expect(dropIndex).toBeLessThan(dropColumn);
  });
});
