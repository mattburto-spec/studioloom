/**
 * Asserts the shape of migration 20260429073552_phase_1_1a_student_user_id_column.sql.
 *
 * Phase: Access Model v2 Phase 1.1a (column add only — no data change)
 *
 * One ALTER TABLE adding students.user_id (UUID NULL, FK auth.users(id),
 * ON DELETE SET NULL), one partial index, one COMMENT.
 *
 * Negative-control note (Lesson #38): tests assert EXPECTED VALUES not
 * just non-null. The exact ON DELETE clause, the IF NOT EXISTS guard, and
 * the partial index predicate are checked literally — a rename or shape
 * change must update the test.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260429073552';

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

describe('Migration: 20260429073552_phase_1_1a_student_user_id_column', () => {
  const sql = loadMigration('_phase_1_1a_student_user_id_column.sql');
  const downSql = loadMigration('_phase_1_1a_student_user_id_column.down.sql');

  // ---- Forward migration ----

  it('adds students.user_id as UUID NULL FK to auth.users with ON DELETE SET NULL', () => {
    expect(sql).toMatch(/ALTER TABLE students/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS user_id UUID NULL/);
    expect(sql).toMatch(/REFERENCES auth\.users\(id\) ON DELETE SET NULL/);
  });

  it('uses idempotent IF NOT EXISTS guard on the column add (Lesson #24)', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS user_id/);
  });

  it('creates a partial index on (user_id) WHERE user_id IS NOT NULL (Lesson #61: IMMUTABLE predicate)', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_students_user_id\s+ON students\(user_id\)\s+WHERE user_id IS NOT NULL/
    );
    // Ensure the predicate doesn't accidentally use a non-IMMUTABLE function (e.g., now())
    const indexBlock = sql.match(/CREATE INDEX[^;]+;/)?.[0] ?? '';
    expect(indexBlock).not.toMatch(/now\(\)|current_timestamp|current_date/i);
  });

  it('adds a column comment pointing at the backfill script', () => {
    expect(sql).toMatch(/COMMENT ON COLUMN students\.user_id IS/);
    expect(sql).toMatch(/scripts\/access-v2\/backfill-student-auth-users\.ts/);
  });

  it('does NOT contain destructive operations (DROP / DELETE / TRUNCATE)', () => {
    // Defensive guard: this migration is column-add only.
    // Match only at start of a statement to avoid catching the comment header
    // (which references "drops the column" in a sentence).
    const lines = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    expect(lines).not.toMatch(/\bDROP\s+(TABLE|COLUMN|CONSTRAINT|POLICY|TRIGGER|INDEX)/i);
    expect(lines).not.toMatch(/\bDELETE\s+FROM/i);
    expect(lines).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('does NOT touch other tables (Lesson #45: surgical changes)', () => {
    const lines = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    // Only ALTER TABLE on students, COMMENT on students.user_id, CREATE INDEX on students.
    const otherAlterTable = lines.match(/ALTER TABLE\s+(\w+)/g) ?? [];
    for (const m of otherAlterTable) {
      expect(m).toMatch(/ALTER TABLE\s+students\b/);
    }
    const otherCommentOn = lines.match(/COMMENT ON\s+(\w+)\s+(\S+)/g) ?? [];
    for (const m of otherCommentOn) {
      expect(m).toMatch(/COMMENT ON\s+COLUMN\s+students\.user_id\b/);
    }
  });

  // ---- Rollback migration ----

  it('rollback drops the index AND the column', () => {
    expect(downSql).toMatch(/DROP INDEX IF EXISTS idx_students_user_id/);
    expect(downSql).toMatch(/ALTER TABLE students DROP COLUMN IF EXISTS user_id/);
  });

  it('rollback uses IF EXISTS guards (idempotent)', () => {
    expect(downSql).toMatch(/DROP INDEX IF EXISTS/);
    expect(downSql).toMatch(/DROP COLUMN IF EXISTS/);
  });
});
