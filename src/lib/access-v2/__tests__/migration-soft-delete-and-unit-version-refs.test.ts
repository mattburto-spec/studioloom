/**
 * Asserts the shape of migration 20260428135317_soft_delete_and_unit_version_refs.sql.
 *
 * Phase: Access Model v2 Phase 0.4
 *
 * Two seams in one migration:
 *   - deleted_at TIMESTAMPTZ NULL on students, teachers, units (3 tables)
 *   - unit_version_id UUID NULL FK unit_versions(id) ON DELETE SET NULL
 *     on 7 submission-shaped tables
 *
 * No indexes (Lesson #44 — speculative until query patterns warrant).
 * No backfill — NULL is the correct semantic for both new columns.
 *
 * Existing soft-delete patterns (classes.is_archived, knowledge_items.is_archived,
 * activity_blocks.is_archived/archived_at) NOT touched — harmonisation deferred
 * to Phase 6.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260428135317';

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

const SOFT_DELETE_TABLES = ['students', 'teachers', 'units'] as const;
const UNIT_VERSION_TABLES = [
  'assessment_records',
  'competency_assessments',
  'portfolio_entries',
  'student_progress',
  'gallery_submissions',
  'fabrication_jobs',
  'student_tool_sessions',
] as const;

describe('Migration: 20260428135317_soft_delete_and_unit_version_refs', () => {
  const sql = loadMigration('_soft_delete_and_unit_version_refs.sql');

  // ---- Soft-delete column shape ----

  for (const table of SOFT_DELETE_TABLES) {
    it(`adds ${table}.deleted_at as nullable TIMESTAMPTZ`, () => {
      const re = new RegExp(
        `ALTER TABLE ${table}\\s+ADD COLUMN deleted_at TIMESTAMPTZ NULL`
      );
      expect(sql).toMatch(re);
    });
  }

  // ---- unit_version_id column shape (7 tables) ----

  for (const table of UNIT_VERSION_TABLES) {
    it(`adds ${table}.unit_version_id as nullable UUID FK to unit_versions ON DELETE SET NULL`, () => {
      const re = new RegExp(
        `ALTER TABLE ${table}\\s+ADD COLUMN unit_version_id UUID NULL\\s+REFERENCES unit_versions\\(id\\) ON DELETE SET NULL`
      );
      expect(sql).toMatch(re);
    });
  }

  // ---- Negative-presence: existing soft-delete tables NOT touched ----

  it('does NOT touch classes.is_archived', () => {
    expect(sql).not.toMatch(/ALTER TABLE classes\s+ADD COLUMN deleted_at/);
  });

  it('does NOT touch knowledge_items.is_archived', () => {
    expect(sql).not.toMatch(
      /ALTER TABLE knowledge_items\s+ADD COLUMN deleted_at/
    );
  });

  it('does NOT touch activity_blocks (already has is_archived + archived_at)', () => {
    expect(sql).not.toMatch(
      /ALTER TABLE activity_blocks\s+ADD COLUMN deleted_at/
    );
  });

  // ---- No speculative indexes (Lesson #44) ----

  it('does NOT create any indexes (deferred until query patterns warrant)', () => {
    expect(sql).not.toMatch(/CREATE INDEX/i);
  });

  // ---- DO $$ sanity check ----

  it('contains DO $$ block validating all 10 columns', () => {
    expect(sql).toContain('DO $$');
    expect(sql).toContain('expected_columns');
    expect(sql).toContain('information_schema.columns');
    expect(sql).toContain('split_part(pair, ');
  });

  it('lists all 10 expected columns in the sanity check', () => {
    for (const t of SOFT_DELETE_TABLES) {
      expect(sql).toContain(`'${t}.deleted_at'`);
    }
    for (const t of UNIT_VERSION_TABLES) {
      expect(sql).toContain(`'${t}.unit_version_id'`);
    }
  });

  // ---- Destructive guard ----

  it('contains no DROP / DELETE / TRUNCATE statements (destructive guard)', () => {
    expect(sql).not.toMatch(/^\s*DROP\s/im);
    expect(sql).not.toMatch(/^\s*DELETE\s/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\s/im);
  });
});

describe('Migration: 20260428135317_soft_delete_and_unit_version_refs down script', () => {
  const sql = loadMigration('_soft_delete_and_unit_version_refs.down.sql');

  it('drops all 3 deleted_at columns', () => {
    for (const table of SOFT_DELETE_TABLES) {
      expect(sql).toContain(
        `ALTER TABLE ${table}`
      );
      expect(sql).toContain('DROP COLUMN IF EXISTS deleted_at');
    }
  });

  it('drops all 7 unit_version_id columns', () => {
    for (const table of UNIT_VERSION_TABLES) {
      const re = new RegExp(
        `ALTER TABLE ${table}\\s+DROP COLUMN IF EXISTS unit_version_id`
      );
      expect(sql).toMatch(re);
    }
  });
});
