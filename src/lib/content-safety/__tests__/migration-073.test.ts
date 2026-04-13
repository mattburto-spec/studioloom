import { describe, test, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_MODERATION_STATUSES,
  ALL_SEVERITIES,
  ALL_MODERATION_LAYERS,
  ALL_CONTENT_SOURCES,
} from '../types';

const MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase/migrations/073_content_safety.sql'
);

describe('Migration 073 — Content Safety Schema', () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  });

  // --- File exists and is substantial ---
  test('migration file exists and is non-empty', () => {
    expect(sql.length).toBeGreaterThan(500);
  });

  // --- Table and ALTER presence ---
  test('creates student_content_moderation_log table', () => {
    expect(sql).toMatch(/CREATE TABLE\s+(IF NOT EXISTS\s+)?(public\.)?student_content_moderation_log/i);
  });

  test('alters student_progress table', () => {
    expect(sql).toMatch(/ALTER TABLE\s+(public\.)?student_progress/i);
  });

  test('adds moderation_status column to student_progress', () => {
    expect(sql).toMatch(/moderation_status/);
  });

  test('adds moderation_flags JSONB column to student_progress', () => {
    expect(sql).toMatch(/moderation_flags\s+JSONB/i);
  });

  test('handles duplicate_column gracefully (Lesson #24)', () => {
    // Migration should use DO $$ BEGIN ... EXCEPTION WHEN duplicate_column
    expect(sql).toMatch(/duplicate_column/i);
  });

  // --- Cross-reference: CHECK constraints match types.ts (Lesson #38) ---
  test('moderation_status CHECK includes all ModerationStatus values', () => {
    for (const status of ALL_MODERATION_STATUSES) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  test('severity CHECK matches ALL_SEVERITIES from types.ts', () => {
    for (const severity of ALL_SEVERITIES) {
      expect(sql).toContain(`'${severity}'`);
    }
  });

  test('moderation_layer CHECK matches ALL_MODERATION_LAYERS from types.ts', () => {
    for (const layer of ALL_MODERATION_LAYERS) {
      expect(sql).toContain(`'${layer}'`);
    }
  });

  test('content_source CHECK matches ALL_CONTENT_SOURCES from types.ts', () => {
    for (const source of ALL_CONTENT_SOURCES) {
      expect(sql).toContain(`'${source}'`);
    }
  });

  // --- All expected columns on student_content_moderation_log ---
  test('student_content_moderation_log has all required columns', () => {
    const requiredColumns = [
      'class_id',
      'student_id',
      'content_source',
      'content_hash',
      'moderation_layer',
      'flags',
      'overall_result',
      'severity',
      'action_taken',
      'teacher_reviewed',
      'teacher_action',
      'teacher_reviewed_at',
      'raw_ai_response',
      'created_at',
    ];
    for (const col of requiredColumns) {
      expect(sql).toContain(col);
    }
  });

  // --- Indexes ---
  test('creates all three indexes', () => {
    expect(sql).toMatch(/idx_student_moderation_log_class_severity/i);
    expect(sql).toMatch(/idx_student_moderation_log_student/i);
    expect(sql).toMatch(/idx_student_moderation_log_unreviewed/i);
  });

  test('unreviewed index is a partial index (WHERE teacher_reviewed = false)', () => {
    expect(sql).toMatch(/WHERE\s+teacher_reviewed\s*=\s*false/i);
  });

  // --- RLS ---
  test('enables row level security on student_content_moderation_log', () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });

  test('creates at least two RLS policies (SELECT + UPDATE for teachers)', () => {
    const policyMatches = sql.match(/CREATE POLICY/gi);
    expect(policyMatches).not.toBeNull();
    expect(policyMatches!.length).toBeGreaterThanOrEqual(2);
  });

  // --- Safety checks ---
  test('does NOT contain DROP TABLE or DELETE (destructive guard)', () => {
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  test('does NOT contain TRUNCATE (destructive guard)', () => {
    expect(sql).not.toMatch(/TRUNCATE/i);
  });

  // --- Cross-reference: overall_result excludes 'pending' ---
  test('overall_result CHECK does NOT include pending (completed moderation is never pending)', () => {
    // Extract the CHECK constraint for overall_result specifically.
    // overall_result should only allow clean/flagged/blocked — NOT pending.
    // The semantic distinction: moderation_status on student_progress can be
    // 'pending' (awaiting moderation), but overall_result on the log means
    // moderation happened and produced a verdict.
    const overallResultLine = sql.match(/overall_result[^;]*CHECK\s*\([^)]+\)/i);
    if (overallResultLine) {
      // 'pending' appears elsewhere in the SQL (student_progress CHECK), so
      // we only verify it's absent from this specific CHECK constraint.
      expect(overallResultLine[0]).not.toContain("'pending'");
    }
  });
});
