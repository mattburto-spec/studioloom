/**
 * Asserts the shape of migration 20260428220303_ai_budgets_and_state.sql.
 *
 * Phase: Access Model v2 Phase 0.7b
 *
 * Two tables for the per-student AI token-budget system:
 *   - ai_budgets       — per-subject (student/class/school) token-cap overrides
 *   - ai_budget_state  — per-student running counter (tokens_used_today,
 *                        reset_at, last_warning_sent_at)
 *
 * Cascade resolution Phase 5 reads:
 *   tier default → school override → class override → student override
 *   (tighter wins)
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260428220303';

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

describe('Migration: 20260428220303_ai_budgets_and_state', () => {
  const sql = loadMigration('_ai_budgets_and_state.sql');

  // ---- ai_budgets shape ----

  it('creates ai_budgets with polymorphic subject (3 subject_type values)', () => {
    expect(sql).toMatch(/CREATE TABLE ai_budgets/);
    expect(sql).toContain(
      "subject_type IN ('student','class','school')"
    );
  });

  it('ai_budgets.daily_token_cap CHECK >= 0 (allows 0 to disable)', () => {
    expect(sql).toMatch(
      /daily_token_cap INTEGER NOT NULL\s+CHECK \(daily_token_cap >= 0\)/
    );
  });

  it('ai_budgets has set_by FK auth.users + reason audit fields', () => {
    expect(sql).toMatch(
      /set_by UUID NULL REFERENCES auth\.users\(id\) ON DELETE SET NULL/
    );
    expect(sql).toContain('reason TEXT NULL');
  });

  it('ai_budgets enforces UNIQUE(subject_id, subject_type)', () => {
    expect(sql).toContain('UNIQUE (subject_id, subject_type)');
  });

  it('ai_budgets has subject_type filter index', () => {
    expect(sql).toContain('idx_ai_budgets_type');
    expect(sql).toMatch(
      /idx_ai_budgets_type[\s\S]+ON ai_budgets\(subject_type\)/
    );
  });

  // ---- ai_budget_state shape ----

  it('ai_budget_state PK is student_id REFERENCES students CASCADE', () => {
    expect(sql).toMatch(
      /student_id UUID PRIMARY KEY REFERENCES students\(id\) ON DELETE CASCADE/
    );
  });

  it('tokens_used_today defaults 0 + CHECK >= 0', () => {
    expect(sql).toMatch(
      /tokens_used_today INTEGER NOT NULL DEFAULT 0\s+CHECK \(tokens_used_today >= 0\)/
    );
  });

  it('reset_at is NOT NULL TIMESTAMPTZ (no default — set by app/cron)', () => {
    expect(sql).toMatch(/reset_at TIMESTAMPTZ NOT NULL/);
    expect(sql).not.toMatch(/reset_at TIMESTAMPTZ NOT NULL DEFAULT/);
  });

  it('last_warning_sent_at is nullable for nag throttling', () => {
    expect(sql).toMatch(/last_warning_sent_at TIMESTAMPTZ NULL/);
  });

  it('has reset_at b-tree index for cron queries (no partial predicate — now() is not IMMUTABLE)', () => {
    expect(sql).toContain('idx_ai_budget_state_due_reset');
    // The CREATE INDEX statement itself ends in a `;` immediately after
    // the column list — no WHERE clause. Comments may mention WHERE for
    // documentation purposes; we only care about the DDL shape.
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_ai_budget_state_due_reset\s+ON ai_budget_state\(reset_at\)\s*;/
    );
  });

  // ---- RLS ----

  it('enables RLS on both tables', () => {
    expect(sql).toContain('ALTER TABLE ai_budgets ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain(
      'ALTER TABLE ai_budget_state ENABLE ROW LEVEL SECURITY'
    );
  });

  it('ai_budgets RLS uses CASE on subject_type for cascade-aware school scoping', () => {
    expect(sql).toContain('ai_budgets_school_teacher_read');
    expect(sql).toMatch(/CASE subject_type/);
    expect(sql).toContain("WHEN 'school' THEN");
    expect(sql).toContain("WHEN 'class' THEN");
    expect(sql).toContain("WHEN 'student' THEN");
  });

  it('ai_budget_state has student-self-read policy', () => {
    expect(sql).toContain('ai_budget_state_student_self_read');
    expect(sql).toMatch(/USING \(student_id = auth\.uid\(\)\)/);
  });

  it('ai_budget_state has school-teacher-read policy via students.school_id (Phase 0.3)', () => {
    expect(sql).toContain('ai_budget_state_school_teacher_read');
    expect(sql).toMatch(/JOIN teachers t ON t\.school_id = s\.school_id/);
  });

  it('creates exactly 3 SELECT policies — no INSERT/UPDATE/DELETE policies', () => {
    const policyCount = (sql.match(/CREATE POLICY/g) || []).length;
    expect(policyCount).toBe(3);
    expect(sql).not.toMatch(/FOR INSERT/i);
    expect(sql).not.toMatch(/FOR UPDATE/i);
    expect(sql).not.toMatch(/FOR DELETE/i);
  });

  it('both tables have COMMENT documenting cascade + counter semantics', () => {
    expect(sql).toContain('COMMENT ON TABLE ai_budgets');
    expect(sql).toContain('COMMENT ON TABLE ai_budget_state');
    expect(sql).toMatch(/cascade|tier default|tighter wins/i);
  });

  // ---- Sanity check ----

  it('contains DO $$ block validating both tables', () => {
    expect(sql).toContain('DO $$');
    expect(sql).toContain("table_name = 'ai_budgets'");
    expect(sql).toContain("table_name = 'ai_budget_state'");
  });

  // ---- Destructive guard ----

  it('contains no top-level DROP TABLE / DELETE / TRUNCATE', () => {
    expect(sql).not.toMatch(/^\s*DROP TABLE\s/im);
    expect(sql).not.toMatch(/^\s*DELETE\s/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\s/im);
  });
});

describe('Migration: 20260428220303_ai_budgets_and_state down script', () => {
  const sql = loadMigration('_ai_budgets_and_state.down.sql');

  it('drops both tables CASCADE in dependency-reverse order', () => {
    expect(sql).toContain('DROP TABLE IF EXISTS ai_budget_state CASCADE');
    expect(sql).toContain('DROP TABLE IF EXISTS ai_budgets CASCADE');
    const stateIdx = sql.indexOf('DROP TABLE IF EXISTS ai_budget_state');
    const budgetsIdx = sql.indexOf('DROP TABLE IF EXISTS ai_budgets');
    expect(stateIdx).toBeLessThan(budgetsIdx);
  });
});
