/**
 * Asserts the shape of migration 20260505032750_task_system_v1_schema.sql.
 *
 * Project: Task System Architecture v1 (TG.0B)
 * Brief:   docs/projects/task-system-architecture.md
 * TG.0A pre-flight: docs/projects/task-system-tg0a-preflight.md
 *
 * Six new tables + 1 ALTER on assessment_records. Purely additive
 * per OQ-2 sign-off (no backfill — legacy dummy data deleted in TG.0K).
 *
 * Negative-control note (Lesson #38): tests assert EXPECTED VALUES not
 * just non-null. Renames or shape changes must update the test. The
 * Cowork spec corrections this brief absorbed (submissions split out,
 * weight on edge, polymorphic source, version-based resubmissions,
 * cross-unit support) are all checkable here.
 *
 * Negative-control note (Lesson #61): partial indexes use STABLE
 * predicates (`WHERE unit_id IS NOT NULL`, `WHERE confirmed = true`,
 * `WHERE is_published = true`, `WHERE source_kind = 'task'`) — not
 * NOW()/CURRENT_DATE/random. IMMUTABLE-predicate trap doesn't apply.
 *
 * Real-database round-trip verification runs against prod via Supabase
 * SQL Editor AFTER this shape test passes locally + the migration applies.
 * Per Lesson #68 (probe before INSERT), TG.0C will probe
 * information_schema.columns to confirm the schema landed correctly
 * before any seed data writes.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const TIMESTAMP = "20260505032750";

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

/** Strip SQL line comments so prose in header blocks doesn't trigger assertions */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("Migration: 20260505032750_task_system_v1_schema (UP)", () => {
  const sql = loadMigration("_task_system_v1_schema.sql");
  const sqlBody = stripSqlComments(sql);

  describe("creates 5 new tables (TG.0B re-attempt — student_tile_grades was already live)", () => {
    it("assessment_tasks (the unified primitive)", () => {
      expect(sqlBody).toMatch(/CREATE TABLE IF NOT EXISTS assessment_tasks/);
    });
    it("task_lesson_links (Cowork correction #2)", () => {
      expect(sqlBody).toMatch(/CREATE TABLE IF NOT EXISTS task_lesson_links/);
    });
    it("task_criterion_weights (Cowork correction #3)", () => {
      expect(sqlBody).toMatch(
        /CREATE TABLE IF NOT EXISTS task_criterion_weights/
      );
    });
    it("submissions (polymorphic source_kind)", () => {
      expect(sqlBody).toMatch(/CREATE TABLE IF NOT EXISTS submissions/);
    });
    it("grade_entries (per-criterion scores)", () => {
      expect(sqlBody).toMatch(/CREATE TABLE IF NOT EXISTS grade_entries/);
    });
    it("does NOT recreate student_tile_grades (preserves existing 26-column G1 schema)", () => {
      // Path A: schema-registry was wrong about status='dropped'. Table is live.
      // Migration ALTERs instead of CREATEs to preserve existing G1 work.
      expect(sqlBody).not.toMatch(/CREATE TABLE IF NOT EXISTS student_tile_grades/);
    });
  });

  describe("ALTERs 2 existing tables (Path A — preserve schemas)", () => {
    it("ALTER TABLE student_tile_grades ADD COLUMN task_id (the missing FK)", () => {
      expect(sqlBody).toMatch(
        /ALTER TABLE student_tile_grades[\s\S]*?ADD COLUMN IF NOT EXISTS task_id UUID/
      );
    });
    it("student_tile_grades.task_id REFERENCES assessment_tasks", () => {
      expect(sqlBody).toMatch(
        /ALTER TABLE student_tile_grades[\s\S]*?REFERENCES assessment_tasks\(id\) ON DELETE CASCADE/
      );
    });
    it("student_tile_grades.task_id is NULLABLE in v1 (existing rows aren't orphaned)", () => {
      // No `ALTER COLUMN task_id SET NOT NULL` should appear in this migration
      expect(sqlBody).not.toMatch(
        /ALTER TABLE student_tile_grades[\s\S]*?ALTER COLUMN task_id SET NOT NULL/
      );
    });
    it("idx_student_tile_grades_task partial index on non-null", () => {
      expect(sqlBody).toMatch(
        /CREATE INDEX IF NOT EXISTS idx_student_tile_grades_task[\s\S]*?WHERE task_id IS NOT NULL/
      );
    });
    it("does NOT touch existing student_tile_grades RLS policies", () => {
      // No CREATE POLICY for student_tile_grades — existing policies stay
      expect(sqlBody).not.toMatch(/CREATE POLICY[^\n]*student_tile_grades/);
    });
    it("does NOT add trigger_student_tile_grades_updated_at (existing trigger stays)", () => {
      expect(sqlBody).not.toMatch(/CREATE TRIGGER trigger_student_tile_grades_updated_at/);
    });
  });

  describe("assessment_tasks shape", () => {
    it("school_id is NOT NULL (multi-tenancy gate)", () => {
      expect(sqlBody).toMatch(
        /school_id UUID NOT NULL REFERENCES schools\(id\)/
      );
    });
    it("unit_id is NULLABLE (cross-unit summative — Cowork correction #6)", () => {
      // unit_id should NOT have NOT NULL; just REFERENCES units(id)
      const unitIdLine = sqlBody.match(
        /unit_id UUID REFERENCES units\(id\) ON DELETE CASCADE,?/
      );
      expect(unitIdLine).not.toBeNull();
    });
    it("task_type CHECK includes formative + summative + peer + self", () => {
      expect(sqlBody).toMatch(
        /task_type IN \('formative', 'summative', 'peer', 'self'\)/
      );
    });
    it("status CHECK is draft + published + closed (NOT submission states)", () => {
      // Cowork correction #1: task status separate from submission status.
      // Task's status enum should NOT include submitted/graded/returned.
      expect(sqlBody).toMatch(/CHECK \(status IN \('draft', 'published', 'closed'\)\)/);
    });
    it("config JSONB exists (Cowork correction #4 — extension point)", () => {
      expect(sqlBody).toMatch(
        /config JSONB NOT NULL DEFAULT '\{\}'::jsonb/
      );
    });
    it("created_by FK to auth.users", () => {
      expect(sqlBody).toMatch(
        /created_by UUID NOT NULL REFERENCES auth\.users\(id\)/
      );
    });
  });

  describe("task_lesson_links shape (many-to-many)", () => {
    it("composite primary key on (task_id, unit_id, page_id)", () => {
      expect(sqlBody).toMatch(/PRIMARY KEY \(task_id, unit_id, page_id\)/);
    });
    it("page_id is TEXT (matches units.content_data.pages[].id pattern)", () => {
      expect(sqlBody).toMatch(/page_id TEXT NOT NULL/);
    });
  });

  describe("task_criterion_weights shape (Cowork correction #3)", () => {
    it("composite primary key on (task_id, criterion_key)", () => {
      expect(sqlBody).toMatch(/PRIMARY KEY \(task_id, criterion_key\)/);
    });
    it("weight is INTEGER 0-100", () => {
      expect(sqlBody).toMatch(
        /weight INTEGER NOT NULL DEFAULT 100[\s\S]*?CHECK \(weight BETWEEN 0 AND 100\)/
      );
    });
    it("rubric_descriptors JSONB present", () => {
      expect(sqlBody).toMatch(/rubric_descriptors JSONB/);
    });
  });

  describe("submissions shape (polymorphic + versioned)", () => {
    it("source_kind CHECK includes task + milestone + project", () => {
      expect(sqlBody).toMatch(
        /CHECK \(source_kind IN \('task', 'milestone', 'project'\)\)/
      );
    });
    it("source_id UUID NOT NULL (FK enforcement is app-layer)", () => {
      expect(sqlBody).toMatch(/source_id UUID NOT NULL/);
    });
    it("version + version_of_submission_id (Cowork correction #5)", () => {
      expect(sqlBody).toMatch(/version INTEGER NOT NULL DEFAULT 1/);
      expect(sqlBody).toMatch(
        /version_of_submission_id UUID REFERENCES submissions\(id\)/
      );
    });
    it("self_assessment JSONB (Hattie d=1.33 scaffold per OQ-3)", () => {
      expect(sqlBody).toMatch(/self_assessment JSONB,/);
    });
    it("status enum is draft + submitted + graded + returned", () => {
      expect(sqlBody).toMatch(
        /CHECK \(status IN \('draft', 'submitted', 'graded', 'returned'\)\)/
      );
    });
    it("UNIQUE constraint on (source_kind, source_id, student_id, version)", () => {
      expect(sqlBody).toMatch(
        /UNIQUE\(source_kind, source_id, student_id, version\)/
      );
    });
  });

  describe("grade_entries shape", () => {
    it("submission_id FK with CASCADE", () => {
      expect(sqlBody).toMatch(
        /submission_id UUID NOT NULL REFERENCES submissions\(id\) ON DELETE CASCADE/
      );
    });
    it("is_published BOOLEAN default false (separate from task.status)", () => {
      expect(sqlBody).toMatch(/is_published BOOLEAN NOT NULL DEFAULT false/);
    });
    it("UNIQUE on (submission_id, criterion_key)", () => {
      expect(sqlBody).toMatch(/UNIQUE\(submission_id, criterion_key\)/);
    });
  });

  // student_tile_grades shape assertions removed — the table predates this
  // migration. ALTER assertions live in §"ALTERs 2 existing tables" above.

  describe("assessment_records.task_id (TG.0A F1 amendment)", () => {
    it("ALTER TABLE assessment_records ADD COLUMN task_id present", () => {
      expect(sqlBody).toMatch(
        /ALTER TABLE assessment_records[\s\S]*?ADD COLUMN IF NOT EXISTS task_id UUID/
      );
    });
    it("task_id REFERENCES assessment_tasks with CASCADE", () => {
      expect(sqlBody).toMatch(
        /ADD COLUMN IF NOT EXISTS task_id UUID[\s\S]*?REFERENCES assessment_tasks\(id\) ON DELETE CASCADE/
      );
    });
    it("task_id is NULLABLE in v1 (NOT NULL deferred to TG.0K follow-up)", () => {
      // No `ALTER COLUMN task_id SET NOT NULL` should appear in this migration.
      expect(sqlBody).not.toMatch(
        /ALTER TABLE assessment_records[\s\S]*?ALTER COLUMN task_id SET NOT NULL/
      );
    });
    it("idx_assessment_records_task partial index on non-null", () => {
      expect(sqlBody).toMatch(
        /CREATE INDEX IF NOT EXISTS idx_assessment_records_task[\s\S]*?WHERE task_id IS NOT NULL/
      );
    });
  });

  describe("RLS — enabled on the 5 new tables (student_tile_grades skipped: already enabled)", () => {
    const newTables = [
      "assessment_tasks",
      "task_lesson_links",
      "task_criterion_weights",
      "submissions",
      "grade_entries",
    ];
    for (const table of newTables) {
      it(`${table} has ROW LEVEL SECURITY enabled`, () => {
        const re = new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        expect(sqlBody).toMatch(re);
      });
    }
    it("student_tile_grades RLS is NOT re-enabled (existing G1 RLS preserved)", () => {
      expect(sqlBody).not.toMatch(/ALTER TABLE student_tile_grades ENABLE ROW LEVEL SECURITY/);
    });
  });

  describe("RLS — uses is_school_admin() helper (Lesson #64 — SECURITY DEFINER)", () => {
    it("at least 5 policies invoke public.is_school_admin", () => {
      const matches = sqlBody.match(/public\.is_school_admin/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("updated_at triggers (only the 2 new tables that need them)", () => {
    it("trigger on assessment_tasks", () => {
      expect(sqlBody).toMatch(
        /CREATE TRIGGER trigger_assessment_tasks_updated_at[\s\S]*?BEFORE UPDATE ON assessment_tasks/
      );
    });
    it("trigger on submissions", () => {
      expect(sqlBody).toMatch(
        /CREATE TRIGGER trigger_submissions_updated_at[\s\S]*?BEFORE UPDATE ON submissions/
      );
    });
    it("does NOT add trigger on student_tile_grades (existing G1 trigger stays)", () => {
      expect(sqlBody).not.toMatch(
        /CREATE TRIGGER trigger_student_tile_grades_updated_at/
      );
    });
  });

  describe("Sanity DO block at end", () => {
    it("DO block raises NOTICE on success", () => {
      expect(sqlBody).toMatch(
        /RAISE NOTICE 'Migration task_system_v1_schema applied OK/
      );
    });
    it("DO block asserts 5 new tables exist (TG.0B re-attempt)", () => {
      expect(sqlBody).toMatch(/expected 5 new tables/);
    });
    it("DO block asserts assessment_records.task_id column added", () => {
      expect(sqlBody).toMatch(
        /assessment_records\.task_id column missing/
      );
    });
    it("DO block asserts student_tile_grades.task_id column added", () => {
      expect(sqlBody).toMatch(
        /student_tile_grades\.task_id column missing/
      );
    });
  });
});

describe("Migration: 20260505032750_task_system_v1_schema (DOWN)", () => {
  const downSql = loadMigration("_task_system_v1_schema.down.sql");
  const downSqlBody = stripSqlComments(downSql);

  describe("safety preconditions", () => {
    it("refuses if assessment_tasks has rows", () => {
      expect(downSqlBody).toMatch(/Refusing rollback: assessment_tasks has/);
    });
    it("refuses if assessment_records.task_id is NOT NULL", () => {
      expect(downSqlBody).toMatch(
        /Refusing rollback: assessment_records\.task_id is NOT NULL/
      );
    });
    it("refuses if student_tile_grades.task_id is NOT NULL", () => {
      expect(downSqlBody).toMatch(
        /Refusing rollback: student_tile_grades\.task_id is NOT NULL/
      );
    });
    it("refuses if any submissions reference non-task source", () => {
      expect(downSqlBody).toMatch(/Inquiry-mode is live/);
    });
  });

  describe("drop order (reverse dependency)", () => {
    it("drops grade_entries before submissions", () => {
      const geIdx = downSqlBody.indexOf("DROP TABLE IF EXISTS grade_entries");
      const subIdx = downSqlBody.indexOf("DROP TABLE IF EXISTS submissions");
      expect(geIdx).toBeGreaterThan(0);
      expect(subIdx).toBeGreaterThan(geIdx);
    });
    it("drops submissions before assessment_tasks", () => {
      const subIdx = downSqlBody.indexOf("DROP TABLE IF EXISTS submissions");
      const atIdx = downSqlBody.indexOf("DROP TABLE IF EXISTS assessment_tasks");
      expect(atIdx).toBeGreaterThan(subIdx);
    });
  });

  describe("removes task_id from BOTH ALTERed tables", () => {
    it("drops idx_assessment_records_task", () => {
      expect(downSqlBody).toMatch(/DROP INDEX IF EXISTS idx_assessment_records_task/);
    });
    it("drops idx_student_tile_grades_task", () => {
      expect(downSqlBody).toMatch(/DROP INDEX IF EXISTS idx_student_tile_grades_task/);
    });
    it("drops assessment_records.task_id", () => {
      expect(downSqlBody).toMatch(
        /ALTER TABLE assessment_records[\s\S]*?DROP COLUMN IF EXISTS task_id/
      );
    });
    it("drops student_tile_grades.task_id", () => {
      expect(downSqlBody).toMatch(
        /ALTER TABLE student_tile_grades[\s\S]*?DROP COLUMN IF EXISTS task_id/
      );
    });
  });

  describe("does NOT drop existing tables/infrastructure", () => {
    it("does NOT drop student_tile_grades (predates this migration)", () => {
      expect(downSqlBody).not.toMatch(/DROP TABLE IF EXISTS student_tile_grades(?!_)/);
    });
    it("final assertion verifies student_tile_grades still exists", () => {
      expect(downSqlBody).toMatch(
        /Rollback safety violation: student_tile_grades was dropped/
      );
    });
    it("does NOT drop set_updated_at function (shared with class_units etc.)", () => {
      expect(downSqlBody).not.toMatch(/DROP FUNCTION[\s\S]*?set_updated_at/);
    });
  });
});
