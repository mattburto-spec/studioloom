import { describe, test, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase/migrations/078_moderation_log_dual_visibility.sql'
);

describe('Migration 078 — FU-N Dual-Visibility RLS (SQL-parse)', () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  });

  // --- 1. File exists and is substantial ---
  test('migration file exists and is non-trivial', () => {
    expect(sql.length).toBeGreaterThan(500);
  });

  // --- 2. DROP POLICY IF EXISTS guards (idempotent from day one) ---
  test('drops existing SELECT policy before recreating', () => {
    expect(sql).toContain(
      'DROP POLICY IF EXISTS student_moderation_log_teacher_select'
    );
  });

  test('drops existing UPDATE policy before recreating', () => {
    expect(sql).toContain(
      'DROP POLICY IF EXISTS student_moderation_log_teacher_update'
    );
  });

  // --- 3. Exactly 2 CREATE POLICY statements (SELECT + UPDATE, no scope creep) ---
  test('creates exactly 2 policies', () => {
    const createPolicyMatches = sql.match(/CREATE POLICY/gi);
    expect(createPolicyMatches).not.toBeNull();
    expect(createPolicyMatches!.length).toBe(2);
  });

  // --- 4. SELECT policy has both paths ---
  test('SELECT policy has class_id primary path', () => {
    // Extract the SELECT policy block
    const selectBlock = sql.slice(
      sql.indexOf('CREATE POLICY student_moderation_log_teacher_select'),
      sql.indexOf('CREATE POLICY student_moderation_log_teacher_update')
    );
    expect(selectBlock).toContain('FOR SELECT');
    expect(selectBlock).toContain(
      'class_id IN'
    );
    expect(selectBlock).toContain(
      "SELECT id FROM classes WHERE teacher_id = auth.uid()"
    );
  });

  test('SELECT policy has NULL-class_id fallback with student_id UNION', () => {
    const selectBlock = sql.slice(
      sql.indexOf('CREATE POLICY student_moderation_log_teacher_select'),
      sql.indexOf('CREATE POLICY student_moderation_log_teacher_update')
    );
    // Must have the OR + NULL check
    expect(selectBlock).toContain('class_id IS NULL AND student_id IN');
    // Junction path (class_students)
    expect(selectBlock).toContain('FROM class_students cs');
    expect(selectBlock).toContain('JOIN classes c ON cs.class_id = c.id');
    expect(selectBlock).toContain("c.teacher_id = auth.uid()");
    // UNION keyword
    expect(selectBlock).toContain('UNION');
    // Legacy path (students.class_id)
    expect(selectBlock).toContain('FROM students s');
    expect(selectBlock).toContain('JOIN classes c ON s.class_id = c.id');
  });

  // --- 5. UPDATE policy mirrors SELECT structure ---
  test('UPDATE policy has both class_id and student_id paths in USING clause', () => {
    const updateBlock = sql.slice(
      sql.indexOf('CREATE POLICY student_moderation_log_teacher_update')
    );
    expect(updateBlock).toContain('FOR UPDATE');
    // USING clause
    expect(updateBlock).toContain('class_id IN');
    expect(updateBlock).toContain('class_id IS NULL AND student_id IN');
    expect(updateBlock).toContain('FROM class_students cs');
    expect(updateBlock).toContain('UNION');
    expect(updateBlock).toContain('FROM students s');
  });

  test('UPDATE policy has WITH CHECK clause matching USING', () => {
    const updateBlock = sql.slice(
      sql.indexOf('CREATE POLICY student_moderation_log_teacher_update')
    );
    expect(updateBlock).toContain('WITH CHECK');
    // WITH CHECK must also have both paths
    const withCheckBlock = updateBlock.slice(updateBlock.indexOf('WITH CHECK'));
    expect(withCheckBlock).toContain('class_id IN');
    expect(withCheckBlock).toContain('class_id IS NULL AND student_id IN');
    expect(withCheckBlock).toContain('UNION');
  });

  // --- 6. FU-N Option C comment block present ---
  test('contains FU-N Option C provenance comment', () => {
    expect(sql).toContain('FU-N Option C');
    expect(sql).toContain('Lesson #29 UNION pattern');
  });

  // --- 7. Peer table documented as not affected ---
  test('documents that content_moderation_log (067) is unaffected', () => {
    expect(sql).toContain('content_moderation_log');
    expect(sql).toContain('no class_id column');
    expect(sql).toContain('service-role-only');
  });

  // --- 8. No destructive operations ---
  test('does NOT contain DROP TABLE or TRUNCATE', () => {
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
  });
});
