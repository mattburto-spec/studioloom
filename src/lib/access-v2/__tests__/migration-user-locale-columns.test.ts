/**
 * Asserts the shape of migration 20260428132944_user_locale_columns.sql.
 *
 * Phase: Access Model v2 Phase 0.2 (Option A scope — locale only)
 *
 * Sub-task 0.2 narrowed from the original brief after pre-flight audit
 * caught that mig 005_lms_integration.sql already added external_id /
 * external_provider / last_synced_at to students + classes under
 * different names than the v2 plan called for. SIS canonicalisation
 * deferred to Phase 6 cutover audit. This migration ships locale only.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260428132944';

function loadMigration(suffix: string): string {
  const all = fs.readdirSync(MIGRATIONS_DIR);
  const file = all.find(
    (f) => f.startsWith(TIMESTAMP) && f.endsWith(suffix)
  );
  if (!file) {
    throw new Error(
      `Migration with timestamp ${TIMESTAMP} and suffix ${suffix} not found in ${MIGRATIONS_DIR}`
    );
  }
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
}

describe('Migration: 20260428132944_user_locale_columns', () => {
  const sql = loadMigration('_user_locale_columns.sql');

  it('adds locale column to teachers with en default + NOT NULL', () => {
    expect(sql).toMatch(
      /ALTER TABLE teachers\s+ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'/
    );
  });

  it('adds locale column to students with en default + NOT NULL', () => {
    expect(sql).toMatch(
      /ALTER TABLE students\s+ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'/
    );
  });

  it('does NOT add SIS columns (sis_source / external_id) — deferred per mig 005 prior art', () => {
    expect(sql).not.toMatch(/sis_source/);
    expect(sql).not.toMatch(/ADD COLUMN external_id/);
    expect(sql).not.toMatch(/ADD COLUMN last_synced_at/);
  });

  it('contains a DO $$ sanity check for both columns', () => {
    expect(sql).toContain('DO $$');
    expect(sql).toContain("table_name='teachers'");
    expect(sql).toContain("table_name='students'");
    expect(sql).toContain("column_name='locale'");
  });

  it('contains no DROP / DELETE / TRUNCATE statements (destructive guard)', () => {
    expect(sql).not.toMatch(/^\s*DROP\s/im);
    expect(sql).not.toMatch(/^\s*DELETE\s/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\s/im);
  });
});

describe('Migration: 20260428132944_user_locale_columns down script', () => {
  const sql = loadMigration('_user_locale_columns.down.sql');

  it('drops teachers.locale', () => {
    expect(sql).toContain(
      'ALTER TABLE teachers DROP COLUMN IF EXISTS locale'
    );
  });

  it('drops students.locale', () => {
    expect(sql).toContain(
      'ALTER TABLE students DROP COLUMN IF EXISTS locale'
    );
  });
});
