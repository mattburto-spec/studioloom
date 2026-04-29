/**
 * Asserts the shape of Phase 1.4 CS-1 migrations (3 pairs).
 *
 * CS-1 closes 3 audit findings before any route switches to the
 * RLS-respecting SSR client:
 *   - classes: NO student-side policy (ADD)
 *   - assessment_records: NO student-side policy (ADD)
 *   - student_badges: BROKEN policy using old custom-token sentinel (REWRITE)
 *
 * Brief: docs/projects/access-model-v2-phase-14-client-switch-brief.md §4
 *
 * Migrations:
 *   20260429231118_phase_1_4_cs1_classes_student_self_read.sql
 *   20260429231124_phase_1_4_cs1_assessment_records_student_self_read.sql
 *   20260429231130_phase_1_4_cs1_student_badges_rewrite.sql
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
// Mig 1 — classes student self-read (ADDITIVE)
// ─────────────────────────────────────────────────────────────────────────

describe("Migration: 20260429231118_phase_1_4_cs1_classes_student_self_read", () => {
  const sql = loadMigration(
    "20260429231118",
    "_phase_1_4_cs1_classes_student_self_read.sql"
  );
  const downSql = loadMigration(
    "20260429231118",
    "_phase_1_4_cs1_classes_student_self_read.down.sql"
  );

  it('creates "Students read own enrolled classes" SELECT policy on classes', () => {
    expect(sql).toMatch(
      /CREATE POLICY "Students read own enrolled classes"\s+ON classes\s+FOR SELECT/
    );
  });

  it("uses the canonical chain via class_students junction", () => {
    // id (classes.id) IN (SELECT cs.class_id FROM class_students cs WHERE cs.student_id IN (SELECT id FROM students WHERE user_id = auth.uid()))
    expect(sql).toMatch(/id IN \(\s*SELECT cs\.class_id\s+FROM class_students cs/);
    expect(sql).toMatch(
      /cs\.student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
  });

  it("does NOT drop the existing teacher policy (additive)", () => {
    const code = stripCommentsAndDocStrings(sql);
    expect(code).not.toMatch(/DROP POLICY/);
  });

  it("rollback drops only the new policy", () => {
    expect(downSql).toMatch(
      /DROP POLICY IF EXISTS "Students read own enrolled classes" ON classes/
    );
    // Make sure rollback doesn't accidentally drop the teacher policy
    const downCode = stripCommentsAndDocStrings(downSql);
    expect(downCode).not.toMatch(/DROP POLICY[^;]*Teachers manage/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Mig 2 — assessment_records student self-read (ADDITIVE, draft-filtered)
// ─────────────────────────────────────────────────────────────────────────

describe("Migration: 20260429231124_phase_1_4_cs1_assessment_records_student_self_read", () => {
  const sql = loadMigration(
    "20260429231124",
    "_phase_1_4_cs1_assessment_records_student_self_read.sql"
  );
  const downSql = loadMigration(
    "20260429231124",
    "_phase_1_4_cs1_assessment_records_student_self_read.down.sql"
  );

  it('creates "Students read own published assessments" SELECT policy on assessment_records', () => {
    expect(sql).toMatch(
      /CREATE POLICY "Students read own published assessments"\s+ON assessment_records\s+FOR SELECT/
    );
  });

  it("filters drafts at the policy layer (is_draft = false)", () => {
    expect(sql).toMatch(/is_draft = false/);
  });

  it("uses the canonical auth.uid() → students.user_id → students.id chain", () => {
    expect(sql).toMatch(
      /student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
  });

  it("does NOT drop the existing teacher policy (additive)", () => {
    const code = stripCommentsAndDocStrings(sql);
    expect(code).not.toMatch(/DROP POLICY/);
  });

  it("rollback drops only the new policy", () => {
    expect(downSql).toMatch(
      /DROP POLICY IF EXISTS "Students read own published assessments" ON assessment_records/
    );
    const downCode = stripCommentsAndDocStrings(downSql);
    expect(downCode).not.toMatch(/DROP POLICY[^;]*Teachers manage assessments/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Mig 3 — student_badges REWRITE (broken-policy fix)
// ─────────────────────────────────────────────────────────────────────────

describe("Migration: 20260429231130_phase_1_4_cs1_student_badges_rewrite", () => {
  const sql = loadMigration(
    "20260429231130",
    "_phase_1_4_cs1_student_badges_rewrite.sql"
  );
  const downSql = loadMigration(
    "20260429231130",
    "_phase_1_4_cs1_student_badges_rewrite.down.sql"
  );

  it("DROPs the original broken student_badges_read_own policy", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS student_badges_read_own ON student_badges/);
  });

  it("CREATEs the replacement student_badges_read_own using the canonical chain", () => {
    expect(sql).toMatch(
      /CREATE POLICY student_badges_read_own ON student_badges\s+FOR SELECT/
    );
    // Note: ::text cast on RHS — student_badges.student_id is TEXT (column-type
    // drift from migration 035; see FU-AV2-STUDENT-BADGES-COLUMN-TYPE).
    expect(sql).toMatch(
      /student_id IN \(\s*SELECT id::text FROM students WHERE user_id = auth\.uid\(\)/
    );
  });

  it("removes the broken custom-token sentinel patterns", () => {
    const code = stripCommentsAndDocStrings(sql);
    expect(code).not.toMatch(/current_setting\('app\.student_id'/);
    expect(code).not.toMatch(/request\.jwt\.claims.*sub/);
  });

  it("does NOT touch the teacher-side policies (untouched by rewrite)", () => {
    const code = stripCommentsAndDocStrings(sql);
    expect(code).not.toMatch(/student_badges_teacher_read/);
    expect(code).not.toMatch(/student_badges_teacher_insert/);
  });

  it("rollback restores the ORIGINAL broken policy text (preserves rollback fidelity)", () => {
    expect(downSql).toMatch(/DROP POLICY IF EXISTS student_badges_read_own ON student_badges/);
    // The rollback intentionally restores the broken pattern — see down.sql comment
    expect(downSql).toMatch(/current_setting\('app\.student_id'/);
    expect(downSql).toMatch(/request\.jwt\.claims/);
  });
});
