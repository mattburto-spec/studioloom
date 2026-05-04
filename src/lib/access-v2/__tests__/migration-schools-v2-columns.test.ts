/**
 * Asserts the shape of migration 20260428125547_schools_v2_columns.sql.
 *
 * Phase: Access Model v2 Phase 0.1
 *
 * Cross-references the SQL text against the spec in
 * docs/projects/access-model-v2-phase-0-brief.md sub-task 0.1. Checks
 * exact column defaults, CHECK constraint values, index names, and
 * destructive-guard absence (Lesson #38 — assert expected values, not
 * just non-null).
 *
 * The pair (.sql + .down.sql) is verified together so reversal is
 * guaranteed by the same suite.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260428125547';

function loadMigration(suffix: string): string {
  const all = fs.readdirSync(MIGRATIONS_DIR);
  const file = all.find(
    (f) =>
      f.startsWith(TIMESTAMP) && f.endsWith(suffix)
  );
  if (!file) {
    throw new Error(
      `Migration with timestamp ${TIMESTAMP} and suffix ${suffix} not found in ${MIGRATIONS_DIR}`
    );
  }
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
}

describe('Migration: 20260428125547_schools_v2_columns', () => {
  const sql = loadMigration('_schools_v2_columns.sql');

  it('adds status column with active default + 4-state CHECK', () => {
    expect(sql).toContain("ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
    expect(sql).toContain(
      "status IN ('active','dormant','archived','merged_into')"
    );
  });

  it('adds region column defaulting to default', () => {
    expect(sql).toContain(
      "ADD COLUMN region TEXT NOT NULL DEFAULT 'default'"
    );
  });

  it('adds bootstrap_expires_at as nullable timestamptz', () => {
    expect(sql).toContain('ADD COLUMN bootstrap_expires_at TIMESTAMPTZ NULL');
  });

  it('adds subscription_tier with pilot default + 5-tier CHECK', () => {
    expect(sql).toContain(
      "ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'pilot'"
    );
    expect(sql).toContain(
      "subscription_tier IN ('pilot','free','starter','pro','school')"
    );
  });

  it('adds timezone defaulting to Asia/Shanghai', () => {
    expect(sql).toContain(
      "ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai'"
    );
  });

  it('adds default_locale defaulting to en', () => {
    expect(sql).toContain(
      "ADD COLUMN default_locale TEXT NOT NULL DEFAULT 'en'"
    );
  });

  it('creates idx_schools_status_active as a partial index excluding active rows', () => {
    expect(sql).toContain('idx_schools_status_active');
    expect(sql).toContain("WHERE status != 'active'");
  });

  it('creates idx_schools_subscription_tier', () => {
    expect(sql).toContain('idx_schools_subscription_tier');
  });

  it('contains a DO $$ sanity check block', () => {
    expect(sql).toContain('DO $$');
    expect(sql).toContain('information_schema.columns');
    expect(sql).toContain("table_name='schools'");
  });

  it('contains no DROP / DELETE / TRUNCATE statements (destructive guard)', () => {
    expect(sql).not.toMatch(/^\s*DROP\s/im);
    expect(sql).not.toMatch(/^\s*DELETE\s/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\s/im);
  });
});

describe('Migration: 20260428125547_schools_v2_columns down script', () => {
  const sql = loadMigration('_schools_v2_columns.down.sql');

  it('drops both indexes', () => {
    expect(sql).toContain('DROP INDEX IF EXISTS idx_schools_status_active');
    expect(sql).toContain(
      'DROP INDEX IF EXISTS idx_schools_subscription_tier'
    );
  });

  it('drops all 6 columns', () => {
    expect(sql).toContain('DROP COLUMN IF EXISTS default_locale');
    expect(sql).toContain('DROP COLUMN IF EXISTS timezone');
    expect(sql).toContain('DROP COLUMN IF EXISTS subscription_tier');
    expect(sql).toContain('DROP COLUMN IF EXISTS bootstrap_expires_at');
    expect(sql).toContain('DROP COLUMN IF EXISTS region');
    expect(sql).toContain('DROP COLUMN IF EXISTS status');
  });

  it('drops indexes BEFORE the ALTER TABLE block (indexes reference columns)', () => {
    const dropIndex = sql.indexOf('DROP INDEX IF EXISTS');
    const dropColumn = sql.indexOf('DROP COLUMN IF EXISTS');
    expect(dropIndex).toBeGreaterThan(-1);
    expect(dropColumn).toBeGreaterThan(-1);
    expect(dropIndex).toBeLessThan(dropColumn);
  });
});
