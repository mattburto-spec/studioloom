/**
 * Asserts the shape of Phase 1.5b additive RLS migrations (4 pairs).
 *
 * All 4 are ADDITIVE — they don't replace existing policies, just add
 * student-side policies via the canonical auth.uid() chain. Closes:
 *   - FU-FF (student_sessions explicit deny-all)
 *   - One rls-coverage drift (fabrication_scan_jobs)
 *
 * Migrations:
 *   20260429133359_phase_1_5b_class_students_self_read_authuid.sql
 *   20260429133400_phase_1_5b_student_progress_self_read.sql
 *   20260429133401_phase_1_5b_fabrication_jobs_and_scan_jobs_student_read.sql
 *   20260429133402_phase_1_5b_student_sessions_deny_all.sql
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

function loadMigration(timestampPrefix: string, suffix: string): string {
  const all = fs.readdirSync(MIGRATIONS_DIR);
  const file = all.find((f) => f.startsWith(timestampPrefix) && f.endsWith(suffix));
  if (!file) {
    throw new Error(
      `Migration with timestamp ${timestampPrefix} and suffix ${suffix} not found`
    );
  }
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
}

function stripCommentsAndDocStrings(sql: string): string {
  const noLineComments = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  return noLineComments.replace(/COMMENT ON [^;]*?IS\s+'[^']*';/gs, "");
}

// ─────────────────────────────────────────────────────────────────────────
// Mig 1 — class_students_self_read_authuid (ADDITIVE)
// ─────────────────────────────────────────────────────────────────────────

describe("Migration: 20260429133359_phase_1_5b_class_students_self_read_authuid", () => {
  const sql = loadMigration("20260429133359", "_phase_1_5b_class_students_self_read_authuid.sql");
  const downSql = loadMigration("20260429133359", "_phase_1_5b_class_students_self_read_authuid.down.sql");

  it('creates "Students read own enrollments via auth.uid" SELECT policy on class_students', () => {
    expect(sql).toMatch(
      /CREATE POLICY "Students read own enrollments via auth\.uid"\s+ON class_students\s+FOR SELECT/
    );
  });

  it("uses the auth.uid() → students.user_id chain", () => {
    expect(sql).toMatch(
      /student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
  });

  it("does NOT drop the existing legacy policy (additive)", () => {
    const code = stripCommentsAndDocStrings(sql);
    expect(code).not.toMatch(/DROP POLICY/);
  });

  it("rollback drops only the new policy", () => {
    expect(downSql).toMatch(
      /DROP POLICY IF EXISTS "Students read own enrollments via auth\.uid" ON class_students/
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Mig 2 — student_progress_self_read
// ─────────────────────────────────────────────────────────────────────────

describe("Migration: 20260429133400_phase_1_5b_student_progress_self_read", () => {
  const sql = loadMigration("20260429133400", "_phase_1_5b_student_progress_self_read.sql");
  const downSql = loadMigration("20260429133400", "_phase_1_5b_student_progress_self_read.down.sql");

  it('creates "Students read own progress" SELECT policy on student_progress', () => {
    expect(sql).toMatch(
      /CREATE POLICY "Students read own progress"\s+ON student_progress\s+FOR SELECT/
    );
  });

  it("uses the auth.uid() → students.user_id chain", () => {
    expect(sql).toMatch(
      /student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
  });

  it("is SELECT-only (does NOT grant student INSERT/UPDATE/DELETE)", () => {
    const code = stripCommentsAndDocStrings(sql);
    expect(code).not.toMatch(/CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE|ALL)/);
  });

  it("does NOT drop the existing teacher-side policy (additive)", () => {
    const code = stripCommentsAndDocStrings(sql);
    expect(code).not.toMatch(/DROP POLICY/);
  });

  it("rollback drops only the new policy", () => {
    expect(downSql).toMatch(/DROP POLICY IF EXISTS "Students read own progress" ON student_progress/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Mig 3 — fabrication_jobs + fabrication_scan_jobs student-read
// ─────────────────────────────────────────────────────────────────────────

describe("Migration: 20260429133401_phase_1_5b_fabrication_jobs_and_scan_jobs_student_read", () => {
  const sql = loadMigration("20260429133401", "_phase_1_5b_fabrication_jobs_and_scan_jobs_student_read.sql");
  const downSql = loadMigration("20260429133401", "_phase_1_5b_fabrication_jobs_and_scan_jobs_student_read.down.sql");

  it("creates fabrication_jobs_select_student SELECT policy with auth.uid() chain", () => {
    expect(sql).toMatch(
      /CREATE POLICY fabrication_jobs_select_student\s+ON fabrication_jobs\s+FOR SELECT[\s\S]+?student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
  });

  it("creates fabrication_scan_jobs_select_student with triple-nested chain", () => {
    expect(sql).toMatch(
      /CREATE POLICY fabrication_scan_jobs_select_student\s+ON fabrication_scan_jobs\s+FOR SELECT[\s\S]+?job_revision_id IN \([\s\S]+?fabrication_job_revisions[\s\S]+?fabrication_jobs[\s\S]+?student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
  });

  it("does NOT touch existing teacher-side policies (additive)", () => {
    const code = stripCommentsAndDocStrings(sql);
    expect(code).not.toMatch(/DROP POLICY/);
    expect(code).not.toMatch(/fabrication_jobs_select_teacher/);
    expect(code).not.toMatch(/fabrication_jobs_update_teacher/);
  });

  it("rollback drops both new policies", () => {
    expect(downSql).toMatch(/DROP POLICY IF EXISTS fabrication_jobs_select_student ON fabrication_jobs/);
    expect(downSql).toMatch(/DROP POLICY IF EXISTS fabrication_scan_jobs_select_student ON fabrication_scan_jobs/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Mig 4 — student_sessions_deny_all (closes FU-FF)
// ─────────────────────────────────────────────────────────────────────────

describe("Migration: 20260429133402_phase_1_5b_student_sessions_deny_all", () => {
  const sql = loadMigration("20260429133402", "_phase_1_5b_student_sessions_deny_all.sql");
  const downSql = loadMigration("20260429133402", "_phase_1_5b_student_sessions_deny_all.down.sql");

  it("creates explicit deny-all policy with USING (false) AND WITH CHECK (false)", () => {
    expect(sql).toMatch(
      /CREATE POLICY "student_sessions_deny_all"\s+ON student_sessions\s+FOR ALL[\s\S]+?USING \(false\)[\s\S]+?WITH CHECK \(false\)/
    );
  });

  it("does NOT contain any auth.uid() reference (deny-all should be unconditional)", () => {
    const code = stripCommentsAndDocStrings(sql);
    expect(code).not.toMatch(/auth\.uid\(\)/);
  });

  it("rollback drops the deny-all policy", () => {
    expect(downSql).toMatch(/DROP POLICY IF EXISTS "student_sessions_deny_all" ON student_sessions/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Cross-migration invariants
// ─────────────────────────────────────────────────────────────────────────

describe("Phase 1.5b — cross-migration invariants", () => {
  const allMigrations = [
    "20260429133359_phase_1_5b_class_students_self_read_authuid.sql",
    "20260429133400_phase_1_5b_student_progress_self_read.sql",
    "20260429133401_phase_1_5b_fabrication_jobs_and_scan_jobs_student_read.sql",
    "20260429133402_phase_1_5b_student_sessions_deny_all.sql",
  ].map((name) => fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf-8"));

  it("none of them touch teacher-side policies (Lesson #45 — surgical scope)", () => {
    for (const sql of allMigrations) {
      const code = stripCommentsAndDocStrings(sql);
      expect(code).not.toMatch(/CREATE POLICY "Teachers/);
      expect(code).not.toMatch(/CREATE POLICY teachers_/);
      expect(code).not.toMatch(/DROP POLICY[^;]*"Teachers/);
      expect(code).not.toMatch(/DROP POLICY[^;]*teachers_/);
    }
  });

  it("none of them DROP, DELETE, or TRUNCATE", () => {
    for (const sql of allMigrations) {
      const code = stripCommentsAndDocStrings(sql);
      expect(code).not.toMatch(/\bDELETE FROM\b/i);
      expect(code).not.toMatch(/\bDROP TABLE\b/i);
      expect(code).not.toMatch(/\bTRUNCATE\b/i);
      expect(code).not.toMatch(/\bDROP POLICY\b/i); // additive only
    }
  });

  it("3 of 4 use the canonical auth.uid() → students.user_id chain (deny-all is intentional exception)", () => {
    // Migrations 1, 2, 3 — chain expected
    const chainMigrations = allMigrations.slice(0, 3);
    for (const sql of chainMigrations) {
      expect(sql).toMatch(/SELECT id FROM students WHERE user_id = auth\.uid\(\)/);
    }
    // Migration 4 (deny-all) does NOT use the chain — verified in mig-specific test
  });
});
