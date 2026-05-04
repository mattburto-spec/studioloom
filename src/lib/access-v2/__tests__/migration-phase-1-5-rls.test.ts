/**
 * Asserts the shape of Phase 1.5 RLS migrations (4 pairs).
 *
 * Migrations:
 *   20260429130730_phase_1_5_students_self_read.sql
 *     — adds "Students read own row" via auth.uid() = user_id
 *
 *   20260429130731_phase_1_5_competency_assessments_student_rewrite.sql
 *     — REPLACES broken students_read_own + students_create_self
 *       (was: student_id = auth.uid(); now: auth.uid() → user_id chain)
 *
 *   20260429130732_phase_1_5_quest_journeys_student_rewrite.sql
 *     — REPLACES 4 broken policies on quest_journeys + quest_milestones +
 *       quest_evidence (was: student_id::text = JWT sub; now: auth.uid() chain)
 *
 *   20260429130733_phase_1_5_design_conversations_student_rewrite.sql
 *     — REPLACES 2 broken policies on design_conversations + turns
 *       (was: student_id = auth.uid(); now: auth.uid() chain)
 *
 * Each test asserts EXACT clause shape (Lesson #38) — NOT just "policy exists":
 *   - DROP POLICY IF EXISTS guards on rewritten policies
 *   - CREATE POLICY uses the auth.uid() → students.user_id → students.id chain
 *   - The wrong shape `student_id = auth.uid()` is NOT in the new SQL (negative control)
 *   - .down.sql restores the original broken shapes (so revert is faithful)
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

/**
 * Strip both line-comments (`--`) and COMMENT ON POLICY documentation strings
 * from SQL so negative-control regex tests don't false-match on quoted prose.
 *
 * COMMENT ON POLICY ... IS '...';  ← single-quoted multi-line string can
 * legitimately reference the broken pattern in WHY-narrative form. The
 * actual policy DDL above the COMMENT is what matters.
 */
function stripCommentsAndDocStrings(sql: string): string {
  // Strip -- single-line comments
  const noLineComments = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  // Strip COMMENT ON ... IS '...'; blocks (greedy match within a single
  // semicolon terminator; SQL comments don't contain semicolons normally
  // but the apostrophes in the quoted text might. Use [^;]* which stops
  // at the first ; — adequate for our migrations).
  return noLineComments.replace(/COMMENT ON [^;]*?IS\s+'[^']*';/gs, "");
}

// ─────────────────────────────────────────────────────────────────────────
// Mig 1 — students_self_read
// ─────────────────────────────────────────────────────────────────────────

describe("Migration: 20260429130730_phase_1_5_students_self_read", () => {
  const sql = loadMigration("20260429130730", "_phase_1_5_students_self_read.sql");
  const downSql = loadMigration("20260429130730", "_phase_1_5_students_self_read.down.sql");

  it('creates "Students read own row" SELECT policy on students', () => {
    expect(sql).toMatch(
      /CREATE POLICY "Students read own row"\s+ON students\s+FOR SELECT/
    );
  });

  it("uses auth.uid() = user_id (NOT auth.uid() = id — that would be the bug)", () => {
    // Strip comment lines so we don't false-match the WHY narrative
    const code = sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(code).toMatch(/user_id\s*=\s*auth\.uid\(\)/);
    expect(code).not.toMatch(/^[^-]*\bid\s*=\s*auth\.uid\(\)/m); // non-comment lines
  });

  it("rollback drops the policy", () => {
    expect(downSql).toMatch(/DROP POLICY IF EXISTS "Students read own row" ON students/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Mig 2 — competency_assessments rewrite
// ─────────────────────────────────────────────────────────────────────────

describe("Migration: 20260429130731_phase_1_5_competency_assessments_student_rewrite", () => {
  const sql = loadMigration("20260429130731", "_phase_1_5_competency_assessments_student_rewrite.sql");
  const downSql = loadMigration("20260429130731", "_phase_1_5_competency_assessments_student_rewrite.down.sql");

  it("DROPs the 2 broken existing policies before recreating", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "students_read_own" ON competency_assessments/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "students_create_self" ON competency_assessments/);
  });

  it("recreates students_read_own with auth.uid() → user_id chain", () => {
    // The new clause should contain SELECT id FROM students WHERE user_id = auth.uid()
    expect(sql).toMatch(
      /CREATE POLICY "students_read_own"[\s\S]+?ON competency_assessments[\s\S]+?FOR SELECT[\s\S]+?student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
  });

  it("recreates students_create_self with auth.uid() → user_id chain AND source check", () => {
    expect(sql).toMatch(
      /CREATE POLICY "students_create_self"[\s\S]+?WITH CHECK[\s\S]+?student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
    expect(sql).toMatch(/source = 'student_self'/);
  });

  it("the new SQL does NOT contain the original broken pattern (student_id = auth.uid()) in policy definitions", () => {
    // Strip line-comments AND COMMENT ON POLICY blocks (which legitimately
    // contain quoted documentation of the broken pattern).
    const code = stripCommentsAndDocStrings(sql);
    expect(code).not.toMatch(/student_id\s*=\s*auth\.uid\(\)/);
  });

  it("rollback restores the original broken shapes (faithful revert)", () => {
    expect(downSql).toMatch(/USING \(student_id = auth\.uid\(\)\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Mig 3 — quest_journeys + milestones + evidence rewrite
// ─────────────────────────────────────────────────────────────────────────

describe("Migration: 20260429130732_phase_1_5_quest_journeys_student_rewrite", () => {
  const sql = loadMigration("20260429130732", "_phase_1_5_quest_journeys_student_rewrite.sql");
  const downSql = loadMigration("20260429130732", "_phase_1_5_quest_journeys_student_rewrite.down.sql");

  it("DROPs all 4 broken policies before recreating", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS quest_journeys_student_select/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS quest_journeys_student_update/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS quest_milestones_student/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS quest_evidence_student/);
  });

  it("recreates quest_journeys SELECT + UPDATE policies with auth.uid() chain", () => {
    expect(sql).toMatch(
      /CREATE POLICY quest_journeys_student_select[\s\S]+?FOR SELECT[\s\S]+?student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
    expect(sql).toMatch(
      /CREATE POLICY quest_journeys_student_update[\s\S]+?FOR UPDATE[\s\S]+?student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
  });

  it("recreates quest_milestones + quest_evidence with nested chain via quest_journeys", () => {
    // milestone/evidence join through quest_journeys
    expect(sql).toMatch(
      /CREATE POLICY quest_milestones_student[\s\S]+?journey_id IN \(\s*SELECT id FROM quest_journeys[\s\S]+?student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
    expect(sql).toMatch(
      /CREATE POLICY quest_evidence_student[\s\S]+?journey_id IN \(\s*SELECT id FROM quest_journeys[\s\S]+?student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
  });

  it("the new SQL does NOT contain the original broken JWT-claim pattern", () => {
    const code = sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(code).not.toMatch(/current_setting\('request\.jwt\.claims'/);
    expect(code).not.toMatch(/student_id::text\s*=\s*current_setting/);
  });

  it("rollback restores all 4 original broken shapes", () => {
    expect(downSql).toMatch(/student_id::text = current_setting\('request\.jwt\.claims'/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Mig 4 — design_conversations + turns rewrite
// ─────────────────────────────────────────────────────────────────────────

describe("Migration: 20260429130733_phase_1_5_design_conversations_student_rewrite", () => {
  const sql = loadMigration("20260429130733", "_phase_1_5_design_conversations_student_rewrite.sql");
  const downSql = loadMigration("20260429130733", "_phase_1_5_design_conversations_student_rewrite.down.sql");

  it("DROPs the 2 broken policies before recreating", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Students can manage own conversations"/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Students can manage own conversation turns"/);
  });

  it("recreates conversation policy with auth.uid() chain in BOTH USING and WITH CHECK", () => {
    expect(sql).toMatch(
      /CREATE POLICY "Students can manage own conversations"[\s\S]+?ON design_conversations[\s\S]+?USING \(\s*student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
    expect(sql).toMatch(
      /WITH CHECK \(\s*student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
  });

  it("recreates conversation_turns policy with nested chain via design_conversations", () => {
    expect(sql).toMatch(
      /CREATE POLICY "Students can manage own conversation turns"[\s\S]+?conversation_id IN \(\s*SELECT id FROM design_conversations[\s\S]+?student_id IN \(\s*SELECT id FROM students WHERE user_id = auth\.uid\(\)/
    );
  });

  it("the new SQL does NOT contain the original broken pattern in policy definitions", () => {
    const code = stripCommentsAndDocStrings(sql);
    expect(code).not.toMatch(/student_id\s*=\s*auth\.uid\(\)/);
  });

  it("rollback restores the original broken shapes", () => {
    expect(downSql).toMatch(/student_id = auth\.uid\(\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Cross-migration: shared properties (Lesson #45 — surgical changes)
// ─────────────────────────────────────────────────────────────────────────

describe("Phase 1.5 RLS — cross-migration invariants", () => {
  const allMigrations = [
    "20260429130730_phase_1_5_students_self_read.sql",
    "20260429130731_phase_1_5_competency_assessments_student_rewrite.sql",
    "20260429130732_phase_1_5_quest_journeys_student_rewrite.sql",
    "20260429130733_phase_1_5_design_conversations_student_rewrite.sql",
  ].map((name) => fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf-8"));

  it("none of them touch teacher-side policies (Lesson #45 — surgical scope)", () => {
    for (const sql of allMigrations) {
      const code = sql
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join("\n");
      // Teacher policies are named "Teachers ..." or "teachers_..."
      expect(code).not.toMatch(/CREATE POLICY "Teachers/);
      expect(code).not.toMatch(/CREATE POLICY teachers_/);
      expect(code).not.toMatch(/DROP POLICY[^;]*"Teachers/);
      expect(code).not.toMatch(/DROP POLICY[^;]*teachers_/);
    }
  });

  it("none of them DELETE rows or DROP tables (Lesson #45 — destructive guards)", () => {
    for (const sql of allMigrations) {
      const code = sql
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join("\n");
      expect(code).not.toMatch(/\bDELETE FROM\b/i);
      expect(code).not.toMatch(/\bDROP TABLE\b/i);
      expect(code).not.toMatch(/\bTRUNCATE\b/i);
    }
  });

  it("each rewritten policy uses the canonical chain `SELECT id FROM students WHERE user_id = auth.uid()`", () => {
    // mig 1 doesn't use the chain (it's the foundational students self-read).
    // mig 2/3/4 should all contain the chain at least once.
    const rewriteMigrations = allMigrations.slice(1);
    for (const sql of rewriteMigrations) {
      expect(sql).toMatch(/SELECT id FROM students WHERE user_id = auth\.uid\(\)/);
    }
  });
});
