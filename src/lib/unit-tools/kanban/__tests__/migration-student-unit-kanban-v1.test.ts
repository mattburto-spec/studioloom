/**
 * Asserts the shape of migration 20260506000324_student_unit_kanban_v1.sql.
 *
 * Project: AG.2 Kanban tool foundation (CO2 Racers agency unit)
 * Brief:   docs/units/co2-racers-build-brief.md §AG.2.1
 *
 * Per Lesson #38: assertions check expected values, not just non-null.
 * Per Lesson #67: validate WIP-limit-on-Doing CHECK constraint shape.
 * Per Lesson #72: confirm teachers.id (not user_id) in RLS policy.
 *
 * Real-database round-trip verification runs against prod via Supabase
 * SQL Editor AFTER this shape test passes locally.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const TIMESTAMP = "20260506000324";

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
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("Migration: 20260506000324_student_unit_kanban_v1 (UP)", () => {
  const sql = loadMigration("_student_unit_kanban_v1.sql");
  const sqlBody = stripSqlComments(sql);

  describe("creates student_unit_kanban table", () => {
    it("table created with IF NOT EXISTS", () => {
      expect(sqlBody).toMatch(/CREATE TABLE IF NOT EXISTS student_unit_kanban/);
    });

    it("primary key UUID with default gen_random_uuid()", () => {
      expect(sqlBody).toMatch(
        /id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/
      );
    });

    it("student_id FK to students(id) with CASCADE delete", () => {
      expect(sqlBody).toMatch(
        /student_id UUID NOT NULL REFERENCES students\(id\) ON DELETE CASCADE/
      );
    });

    it("unit_id FK to units(id) with CASCADE delete", () => {
      expect(sqlBody).toMatch(
        /unit_id\s+UUID NOT NULL REFERENCES units\(id\)\s+ON DELETE CASCADE/
      );
    });

    it("UNIQUE(student_id, unit_id) — one kanban per student per unit", () => {
      expect(sqlBody).toMatch(/UNIQUE\(student_id, unit_id\)/);
    });
  });

  describe("cards JSONB column", () => {
    it("cards JSONB NOT NULL DEFAULT empty array", () => {
      expect(sqlBody).toMatch(
        /cards JSONB NOT NULL DEFAULT '\[\]'::jsonb/
      );
    });
  });

  describe("denormalized count columns (for cheap dashboard summary queries)", () => {
    it("backlog_count INTEGER NOT NULL with non-negative CHECK", () => {
      expect(sqlBody).toMatch(
        /backlog_count\s+INTEGER NOT NULL DEFAULT 0 CHECK \(backlog_count\s+>= 0\)/
      );
    });
    it("this_class_count INTEGER NOT NULL with non-negative CHECK", () => {
      expect(sqlBody).toMatch(
        /this_class_count INTEGER NOT NULL DEFAULT 0 CHECK \(this_class_count >= 0\)/
      );
    });
    it("doing_count INTEGER NOT NULL with non-negative CHECK", () => {
      expect(sqlBody).toMatch(
        /doing_count\s+INTEGER NOT NULL DEFAULT 0 CHECK \(doing_count\s+>= 0\)/
      );
    });
    it("done_count INTEGER NOT NULL with non-negative CHECK", () => {
      expect(sqlBody).toMatch(
        /done_count\s+INTEGER NOT NULL DEFAULT 0 CHECK \(done_count\s+>= 0\)/
      );
    });
  });

  describe("WIP limit constraint (Cowork pedagogical research)", () => {
    it("wip_limit_doing default 1, range 1-3", () => {
      expect(sqlBody).toMatch(
        /wip_limit_doing INTEGER NOT NULL DEFAULT 1[\s\S]*?CHECK \(wip_limit_doing BETWEEN 1 AND 3\)/
      );
    });
  });

  describe("last_move_at column (drives Attention-Rotation Panel staleness)", () => {
    it("last_move_at TIMESTAMPTZ — nullable for never-touched boards", () => {
      expect(sqlBody).toMatch(/last_move_at TIMESTAMPTZ/);
      // Should NOT be NOT NULL — null = never touched
      expect(sqlBody).not.toMatch(/last_move_at TIMESTAMPTZ NOT NULL/);
    });
  });

  describe("indexes", () => {
    it("primary lookup index on (student_id, unit_id)", () => {
      expect(sqlBody).toMatch(
        /CREATE INDEX IF NOT EXISTS idx_student_unit_kanban_student_unit\s+ON student_unit_kanban\(student_id, unit_id\)/
      );
    });
    it("teacher dashboard index on (unit_id)", () => {
      expect(sqlBody).toMatch(
        /CREATE INDEX IF NOT EXISTS idx_student_unit_kanban_unit\s+ON student_unit_kanban\(unit_id\)/
      );
    });
    it("staleness index on (unit_id, last_move_at) — partial, NULLS LAST, non-null only", () => {
      expect(sqlBody).toMatch(
        /idx_student_unit_kanban_last_move[\s\S]*?ON student_unit_kanban\(unit_id, last_move_at DESC NULLS LAST\)[\s\S]*?WHERE last_move_at IS NOT NULL/
      );
    });
  });

  describe("RLS — teachers read same-school via class_units join", () => {
    it("RLS enabled on the table", () => {
      expect(sqlBody).toMatch(
        /ALTER TABLE student_unit_kanban ENABLE ROW LEVEL SECURITY/
      );
    });

    it("teacher_read policy uses teachers.id pattern via classes.teacher_id (Lesson #72)", () => {
      // The policy joins classes.teacher_id = auth.uid(). teachers.id IS auth.users.id 1:1.
      // No teachers.user_id reference anywhere (Lesson #72 from 5 May 2026).
      expect(sqlBody).toMatch(
        /CREATE POLICY "student_unit_kanban_teacher_read"[\s\S]*?c\.teacher_id = auth\.uid\(\)/
      );
      expect(sqlBody).not.toMatch(/teachers[\s\S]{0,100}user_id/);
    });

    it("teacher_read joins through class_units → classes (active classes only)", () => {
      expect(sqlBody).toMatch(/FROM class_units cu/);
      expect(sqlBody).toMatch(/JOIN classes c ON c\.id = cu\.class_id/);
      expect(sqlBody).toMatch(/cu\.is_active = true/);
    });

    it("platform admin escape hatch present", () => {
      expect(sqlBody).toMatch(
        /\(SELECT is_platform_admin FROM user_profiles WHERE id = auth\.uid\(\)\) = true/
      );
    });

    it("no SELECT/INSERT/UPDATE student-side policy (token sessions bypass RLS via service role)", () => {
      // Comment explicitly documents this; check the ARCHITECTURAL choice
      expect(sql).toContain("Lesson #4");
      expect(sql).toContain("token session");
      // Only the teacher_read policy should exist
      const policyCount = (sql.match(/CREATE POLICY/g) || []).length;
      expect(policyCount).toBe(1);
    });
  });

  describe("updated_at trigger (reuses shared set_updated_at function)", () => {
    it("trigger created on UPDATE", () => {
      expect(sqlBody).toMatch(
        /CREATE TRIGGER trigger_student_unit_kanban_updated_at[\s\S]*?BEFORE UPDATE ON student_unit_kanban/
      );
    });
    it("uses CREATE OR REPLACE for the shared function (safe in fresh env)", () => {
      expect(sqlBody).toMatch(/CREATE OR REPLACE FUNCTION set_updated_at/);
    });
  });

  describe("Sanity DO block at end", () => {
    it("asserts table created", () => {
      expect(sqlBody).toMatch(/student_unit_kanban table not created/);
    });
    it("asserts at least 3 indexes", () => {
      expect(sqlBody).toMatch(/expected at least 3 indexes/);
    });
    it("asserts at least 1 RLS policy", () => {
      expect(sqlBody).toMatch(/expected at least 1 RLS policy/);
    });
    it("RAISE NOTICE on success", () => {
      expect(sqlBody).toMatch(
        /RAISE NOTICE 'Migration student_unit_kanban_v1 applied OK/
      );
    });
  });
});

describe("Migration: 20260506000324_student_unit_kanban_v1 (DOWN)", () => {
  const sql = loadMigration("_student_unit_kanban_v1.down.sql");
  const sqlBody = stripSqlComments(sql);

  describe("safety preconditions", () => {
    it("refuses if any row has non-empty cards (student work protection)", () => {
      expect(sql).toContain("non-empty cards");
      expect(sqlBody).toMatch(/jsonb_array_length\(cards\) > 0/);
      expect(sqlBody).toMatch(/RAISE EXCEPTION/);
    });
    it("allows rollback when all rows have empty cards (just defaults)", () => {
      expect(sqlBody).toMatch(/Rollback proceeding[\s\S]*?empty cards arrays/);
    });
  });

  describe("drop sequence", () => {
    it("drops trigger first (function preserved as shared)", () => {
      expect(sqlBody).toMatch(
        /DROP TRIGGER IF EXISTS trigger_student_unit_kanban_updated_at/
      );
      expect(sqlBody).not.toMatch(/DROP FUNCTION.*set_updated_at/);
    });
    it("drops the table with CASCADE", () => {
      expect(sqlBody).toMatch(/DROP TABLE IF EXISTS student_unit_kanban CASCADE/);
    });
  });

  describe("final assertion", () => {
    it("verifies table is gone post-rollback", () => {
      expect(sqlBody).toMatch(
        /Rollback failed: student_unit_kanban table still present/
      );
    });
  });
});
