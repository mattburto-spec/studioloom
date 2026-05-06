/**
 * Asserts the shape of migration 20260506010518_student_unit_timeline_v1.sql.
 *
 * Project: AG.3 Timeline tool foundation (CO2 Racers agency unit)
 * Brief:   docs/units/co2-racers-build-brief.md §AG.3.1
 *
 * Per Lesson #38 + #67 + #72.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const TIMESTAMP = "20260506010518";

function loadMigration(suffix: string): string {
  const all = fs.readdirSync(MIGRATIONS_DIR);
  const file = all.find((f) => f.startsWith(TIMESTAMP) && f.endsWith(suffix));
  if (!file) {
    throw new Error(
      `Migration with timestamp ${TIMESTAMP} and suffix ${suffix} not found`
    );
  }
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
}

function stripSqlComments(sql: string): string {
  return sql.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
}

describe("Migration: 20260506010518_student_unit_timeline_v1 (UP)", () => {
  const sql = loadMigration("_student_unit_timeline_v1.sql");
  const sqlBody = stripSqlComments(sql);

  describe("table shape", () => {
    it("creates student_unit_timeline with IF NOT EXISTS", () => {
      expect(sqlBody).toMatch(/CREATE TABLE IF NOT EXISTS student_unit_timeline/);
    });
    it("PK UUID with gen_random_uuid()", () => {
      expect(sqlBody).toMatch(/id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
    });
    it("student_id FK CASCADE", () => {
      expect(sqlBody).toMatch(
        /student_id UUID NOT NULL REFERENCES students\(id\) ON DELETE CASCADE/
      );
    });
    it("unit_id FK CASCADE", () => {
      expect(sqlBody).toMatch(
        /unit_id\s+UUID NOT NULL REFERENCES units\(id\)\s+ON DELETE CASCADE/
      );
    });
    it("UNIQUE(student_id, unit_id)", () => {
      expect(sqlBody).toMatch(/UNIQUE\(student_id, unit_id\)/);
    });
  });

  describe("milestones JSONB column", () => {
    it("milestones JSONB NOT NULL DEFAULT empty array", () => {
      expect(sqlBody).toMatch(
        /milestones JSONB NOT NULL DEFAULT '\[\]'::jsonb/
      );
    });
  });

  describe("denormalized summary columns", () => {
    it("next_milestone_label TEXT (nullable)", () => {
      expect(sqlBody).toMatch(/next_milestone_label\s+TEXT/);
      expect(sqlBody).not.toMatch(/next_milestone_label\s+TEXT NOT NULL/);
    });
    it("next_milestone_target_date DATE (nullable)", () => {
      expect(sqlBody).toMatch(/next_milestone_target_date DATE/);
      expect(sqlBody).not.toMatch(/next_milestone_target_date DATE NOT NULL/);
    });
    it("pending_count INTEGER NOT NULL with non-negative CHECK", () => {
      expect(sqlBody).toMatch(
        /pending_count INTEGER NOT NULL DEFAULT 0 CHECK \(pending_count >= 0\)/
      );
    });
    it("done_count INTEGER NOT NULL with non-negative CHECK", () => {
      expect(sqlBody).toMatch(
        /done_count\s+INTEGER NOT NULL DEFAULT 0 CHECK \(done_count\s+>= 0\)/
      );
    });
    it("race_date DATE (nullable)", () => {
      expect(sqlBody).toMatch(/race_date DATE/);
    });
    it("last_updated_at TIMESTAMPTZ (nullable for never-touched)", () => {
      expect(sqlBody).toMatch(/last_updated_at TIMESTAMPTZ/);
      expect(sqlBody).not.toMatch(/last_updated_at TIMESTAMPTZ NOT NULL/);
    });
  });

  describe("indexes", () => {
    it("primary lookup (student_id, unit_id)", () => {
      expect(sqlBody).toMatch(
        /idx_student_unit_timeline_student_unit\s+ON student_unit_timeline\(student_id, unit_id\)/
      );
    });
    it("teacher dashboard (unit_id)", () => {
      expect(sqlBody).toMatch(
        /idx_student_unit_timeline_unit\s+ON student_unit_timeline\(unit_id\)/
      );
    });
    it("upcoming-milestone partial index", () => {
      expect(sqlBody).toMatch(
        /idx_student_unit_timeline_next_target[\s\S]*?ON student_unit_timeline\(unit_id, next_milestone_target_date ASC NULLS LAST\)[\s\S]*?WHERE next_milestone_target_date IS NOT NULL/
      );
    });
  });

  describe("RLS — teacher read mirrors AG.2 Kanban pattern", () => {
    it("RLS enabled", () => {
      expect(sqlBody).toMatch(
        /ALTER TABLE student_unit_timeline ENABLE ROW LEVEL SECURITY/
      );
    });
    it("uses classes.teacher_id = auth.uid() (Lesson #72 — no user_id pattern)", () => {
      expect(sqlBody).toMatch(/c\.teacher_id = auth\.uid\(\)/);
      expect(sqlBody).not.toMatch(/teachers[\s\S]{0,80}user_id/);
    });
    it("joins via class_units → classes (active classes only)", () => {
      expect(sqlBody).toMatch(/FROM class_units cu/);
      expect(sqlBody).toMatch(/JOIN classes c ON c\.id = cu\.class_id/);
      expect(sqlBody).toMatch(/cu\.is_active = true/);
    });
    it("platform admin escape hatch present", () => {
      expect(sqlBody).toMatch(
        /\(SELECT is_platform_admin FROM user_profiles WHERE id = auth\.uid\(\)\) = true/
      );
    });
    it("only one policy (no student-side under token-session pattern)", () => {
      const count = (sql.match(/CREATE POLICY/g) || []).length;
      expect(count).toBe(1);
    });
  });

  describe("trigger (reuses shared set_updated_at function)", () => {
    it("trigger on UPDATE", () => {
      expect(sqlBody).toMatch(
        /CREATE TRIGGER trigger_student_unit_timeline_updated_at[\s\S]*?BEFORE UPDATE ON student_unit_timeline/
      );
    });
    it("CREATE OR REPLACE for the shared function", () => {
      expect(sqlBody).toMatch(/CREATE OR REPLACE FUNCTION set_updated_at/);
    });
  });

  describe("Sanity DO block", () => {
    it("asserts table created", () => {
      expect(sqlBody).toMatch(/student_unit_timeline table not created/);
    });
    it("asserts ≥3 indexes", () => {
      expect(sqlBody).toMatch(/expected at least 3 indexes/);
    });
    it("asserts ≥1 RLS policy", () => {
      expect(sqlBody).toMatch(/expected at least 1 RLS policy/);
    });
    it("RAISE NOTICE on success", () => {
      expect(sqlBody).toMatch(
        /RAISE NOTICE 'Migration student_unit_timeline_v1 applied OK/
      );
    });
  });
});

describe("Migration: 20260506010518_student_unit_timeline_v1 (DOWN)", () => {
  const sql = loadMigration("_student_unit_timeline_v1.down.sql");
  const sqlBody = stripSqlComments(sql);

  it("refuses if any row has non-empty milestones (student work protection)", () => {
    // SQL string-concat splits "non-empty milestones" across lines — match each part
    expect(sql).toContain("non-empty");
    expect(sqlBody).toMatch(/jsonb_array_length\(milestones\) > 0/);
    expect(sqlBody).toMatch(/RAISE EXCEPTION/);
  });

  it("drops trigger + table; preserves shared function", () => {
    expect(sqlBody).toMatch(/DROP TRIGGER IF EXISTS trigger_student_unit_timeline_updated_at/);
    expect(sqlBody).toMatch(/DROP TABLE IF EXISTS student_unit_timeline CASCADE/);
    expect(sqlBody).not.toMatch(/DROP FUNCTION.*set_updated_at/);
  });

  it("final assertion verifies table is gone", () => {
    expect(sqlBody).toMatch(
      /Rollback failed: student_unit_timeline table still present/
    );
  });
});
