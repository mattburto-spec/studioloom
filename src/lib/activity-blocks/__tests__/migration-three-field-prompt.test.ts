/**
 * Asserts the shape of migration 20260504020826_activity_three_field_prompt.sql.
 *
 * Project: Lesson Quality Lever 1 — Slot Fields (sub-phase 1B)
 * Brief:   docs/projects/lesson-quality-lever-1-slot-fields.md
 *
 * Pure additive — 4 new columns on activity_blocks. Existing prompt
 * column stays NOT NULL (transition window — removal gated 30 days
 * post-Lever-1, separate future phase).
 *
 * Negative-control note (Lesson #38): tests assert EXPECTED VALUES not
 * just non-null. Renames or shape changes must update the test.
 *
 * Negative-control note (Lesson #61): no partial indexes added in this
 * migration, so the IMMUTABLE-predicate trap doesn't apply here. If
 * future sub-phases add an index on framing/task/success_signal, port
 * the same Lesson #61 guard from migration-phase-1-1a.test.ts.
 *
 * Real-database round-trip verification (the brief's actual 1B gate —
 * INSERT/SELECT exact values) runs against prod via Supabase SQL Editor
 * AFTER this shape test passes locally. See the migration's VERIFY
 * comment block for the round-trip script.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const TIMESTAMP = "20260504020826";

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

/**
 * Strip SQL line comments (`-- ...`) so assertions about "this column is
 * not touched" don't fire on prose mentions in the WHY/IMPACT/VERIFY
 * header comment blocks.
 */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("Migration: 20260504020826_activity_three_field_prompt", () => {
  const sql = loadMigration("_activity_three_field_prompt.sql");
  const downSql = loadMigration("_activity_three_field_prompt.down.sql");
  const sqlBody = stripSqlComments(sql);
  const downSqlBody = stripSqlComments(downSql);

  // ---- Forward migration ----

  describe("forward (.sql)", () => {
    it("targets the activity_blocks table only", () => {
      // Only one ALTER TABLE statement, and it targets activity_blocks
      const alterMatches = sql.match(/ALTER TABLE\s+\w+/g) ?? [];
      expect(alterMatches).toHaveLength(1);
      expect(alterMatches[0]).toBe("ALTER TABLE activity_blocks");
    });

    it("adds framing as nullable TEXT", () => {
      expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS framing TEXT(\b|,)/);
      // No NOT NULL on framing
      expect(sql).not.toMatch(/framing TEXT NOT NULL/);
    });

    it("adds task as nullable TEXT", () => {
      expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS task TEXT(\b|,)/);
      expect(sql).not.toMatch(/task TEXT NOT NULL/);
    });

    it("adds success_signal as nullable TEXT", () => {
      expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS success_signal TEXT(\b|,)/);
      expect(sql).not.toMatch(/success_signal TEXT NOT NULL/);
    });

    it("adds backfill_needs_review as BOOLEAN NOT NULL DEFAULT false", () => {
      expect(sql).toMatch(
        /ADD COLUMN IF NOT EXISTS backfill_needs_review BOOLEAN NOT NULL DEFAULT false/
      );
    });

    it("uses idempotent IF NOT EXISTS guards on every ADD COLUMN (Lesson #24)", () => {
      const addColumnMatches = sql.match(/ADD COLUMN(?! IF NOT EXISTS)/g);
      expect(addColumnMatches).toBeNull();
    });

    it("does NOT touch the legacy prompt column (transition window)", () => {
      // No DROP / ALTER / RENAME on prompt — check stripped body so prose
      // mentions in header comments don't trip the assertion.
      expect(sqlBody).not.toMatch(/DROP COLUMN(?: IF EXISTS)? prompt\b/);
      expect(sqlBody).not.toMatch(/ALTER COLUMN prompt\b/);
      expect(sqlBody).not.toMatch(/RENAME COLUMN prompt\b/);
    });

    it("does NOT alter content_fingerprint or its UNIQUE constraint (1C must not recompute)", () => {
      expect(sqlBody).not.toMatch(/content_fingerprint/);
    });

    it("adds COMMENT ON COLUMN for each of the 4 new columns", () => {
      expect(sql).toMatch(/COMMENT ON COLUMN activity_blocks\.framing IS/);
      expect(sql).toMatch(/COMMENT ON COLUMN activity_blocks\.task IS/);
      expect(sql).toMatch(
        /COMMENT ON COLUMN activity_blocks\.success_signal IS/
      );
      expect(sql).toMatch(
        /COMMENT ON COLUMN activity_blocks\.backfill_needs_review IS/
      );
    });

    it("adds NO new indexes (slot fields are not search dimensions in v1)", () => {
      expect(sql).not.toMatch(/CREATE INDEX/i);
    });

    it("adds NO new RLS policies (additive nullable cols inherit existing row policies)", () => {
      expect(sql).not.toMatch(/CREATE POLICY/i);
      expect(sql).not.toMatch(/ALTER POLICY/i);
    });

    it("adds NO new triggers", () => {
      expect(sql).not.toMatch(/CREATE TRIGGER/i);
    });
  });

  // ---- Rollback migration ----

  describe("rollback (.down.sql)", () => {
    it("targets the activity_blocks table only", () => {
      const alterMatches = downSql.match(/ALTER TABLE\s+\w+/g) ?? [];
      expect(alterMatches).toHaveLength(1);
      expect(alterMatches[0]).toBe("ALTER TABLE activity_blocks");
    });

    it("drops framing", () => {
      expect(downSql).toMatch(/DROP COLUMN IF EXISTS framing/);
    });

    it("drops task", () => {
      expect(downSql).toMatch(/DROP COLUMN IF EXISTS task/);
    });

    it("drops success_signal", () => {
      expect(downSql).toMatch(/DROP COLUMN IF EXISTS success_signal/);
    });

    it("drops backfill_needs_review", () => {
      expect(downSql).toMatch(/DROP COLUMN IF EXISTS backfill_needs_review/);
    });

    it("does NOT drop the legacy prompt column", () => {
      expect(downSqlBody).not.toMatch(/DROP COLUMN(?: IF EXISTS)? prompt\b/);
    });

    it("uses idempotent IF EXISTS guards on every DROP", () => {
      const dropColumnMatches = downSql.match(/DROP COLUMN(?! IF EXISTS)/g);
      expect(dropColumnMatches).toBeNull();
    });

    it("documents that rollback is destructive once 1C has populated data", () => {
      expect(downSql).toMatch(/DESTRUCTIVE/);
    });
  });
});
