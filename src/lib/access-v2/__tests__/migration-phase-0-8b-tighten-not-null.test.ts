/**
 * Asserts the shape of migration 20260428222049_phase_0_8b_tighten_not_null.sql.
 *
 * Phase: Access Model v2 Phase 0.8b (schema change — NOT NULL tighten)
 *
 * Tightens students.school_id + units.school_id + classes.school_id to
 * NOT NULL after Phase 0.8a backfill. Pre-flight RAISE EXCEPTION guards
 * fail loudly with actionable error messages if any column has NULL rows.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260428222049';

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

const COLUMNS_TIGHTENED = [
  { table: 'students', column: 'school_id' },
  { table: 'units', column: 'school_id' },
  { table: 'classes', column: 'school_id' },
] as const;

describe('Migration: 20260428222049_phase_0_8b_tighten_not_null', () => {
  const sql = loadMigration('_phase_0_8b_tighten_not_null.sql');

  // ---- Pre-flight guards ----

  it('counts NULL rows for all 3 columns BEFORE tightening', () => {
    expect(sql).toContain(
      'SELECT COUNT(*) INTO null_students FROM students WHERE school_id IS NULL'
    );
    expect(sql).toContain(
      'SELECT COUNT(*) INTO null_units    FROM units    WHERE school_id IS NULL'
    );
    expect(sql).toContain(
      'SELECT COUNT(*) INTO null_classes  FROM classes  WHERE school_id IS NULL'
    );
  });

  it('RAISES EXCEPTION with actionable message if any column has NULLs', () => {
    expect(sql).toMatch(
      /RAISE EXCEPTION[\s\S]+'Phase 0\.8b: cannot tighten students\.school_id NOT NULL/
    );
    expect(sql).toMatch(
      /RAISE EXCEPTION[\s\S]+'Phase 0\.8b: cannot tighten units\.school_id NOT NULL/
    );
    expect(sql).toMatch(
      /RAISE EXCEPTION[\s\S]+'Phase 0\.8b: cannot tighten classes\.school_id NOT NULL/
    );
  });

  it('classes.school_id error message documents that mig 117 reserved it nullable + suggests manual backfill', () => {
    expect(sql).toMatch(/mig 117/);
    expect(sql).toMatch(
      /UPDATE classes SET school_id = \(SELECT t\.school_id FROM teachers t WHERE t\.id = classes\.teacher_id\)/
    );
  });

  // ---- ALTER COLUMN SET NOT NULL ----

  for (const { table, column } of COLUMNS_TIGHTENED) {
    it(`runs ALTER TABLE ${table} ALTER COLUMN ${column} SET NOT NULL`, () => {
      const re = new RegExp(
        `ALTER TABLE ${table}\\s+ALTER COLUMN ${column} SET NOT NULL`
      );
      expect(sql).toMatch(re);
    });
  }

  it('runs the 3 ALTERs at top level (not inside a DO block — the failure surfaces cleanly)', () => {
    // The pre-flight DO block ends; then the 3 ALTERs are bare; then
    // a sanity-check DO block. Verify the ALTERs aren't inside a DO.
    const altersStart = sql.indexOf(
      'ALTER TABLE students ALTER COLUMN school_id SET NOT NULL'
    );
    const preflightEnd = sql.indexOf(
      "Tightening to NOT NULL.';"
    );
    expect(altersStart).toBeGreaterThan(preflightEnd);
    // Confirm the three ALTERs come BEFORE the sanity DO $$ block
    const sanityDo = sql.lastIndexOf('DO $$');
    const lastAlter = sql.lastIndexOf(
      'ALTER TABLE classes  ALTER COLUMN school_id SET NOT NULL'
    );
    expect(lastAlter).toBeLessThan(sanityDo);
  });

  // ---- Sanity-check DO block ----

  it('post-tighten sanity check verifies is_nullable=NO via information_schema', () => {
    expect(sql).toContain('information_schema.columns');
    expect(sql).toContain("is_nullable != 'NO'");
    expect(sql).toMatch(/RAISE EXCEPTION 'Phase 0\.8b: %\.% is still nullable/);
  });

  it('emits final DONE NOTICE with all 3 columns named', () => {
    expect(sql).toContain('[Phase 0.8b] DONE');
    expect(sql).toContain('students.school_id');
    expect(sql).toContain('units.school_id');
    expect(sql).toContain('classes.school_id');
  });

  // ---- Destructive guard ----

  it('contains no DROP TABLE / DELETE / TRUNCATE', () => {
    expect(sql).not.toMatch(/^\s*DROP TABLE\s/im);
    expect(sql).not.toMatch(/^\s*DELETE\s/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\s/im);
  });
});

describe('Migration: 20260428222049_phase_0_8b_tighten_not_null down script', () => {
  const sql = loadMigration('_phase_0_8b_tighten_not_null.down.sql');

  for (const { table, column } of COLUMNS_TIGHTENED) {
    it(`drops NOT NULL on ${table}.${column}`, () => {
      const re = new RegExp(
        `ALTER TABLE ${table}\\s+ALTER COLUMN ${column} DROP NOT NULL`
      );
      expect(sql).toMatch(re);
    });
  }

  it('reverses in opposite order to the forward (classes first, students last)', () => {
    const c = sql.indexOf('ALTER TABLE classes');
    const u = sql.indexOf('ALTER TABLE units');
    const s = sql.indexOf('ALTER TABLE students');
    expect(c).toBeLessThan(u);
    expect(u).toBeLessThan(s);
  });
});
