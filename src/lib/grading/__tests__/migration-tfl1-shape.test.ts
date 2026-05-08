import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * TFL.1 migration shape test.
 *
 * Lesson #38 — "ADD COLUMN DEFAULT silently overrides subsequent
 * conditional UPDATEs in the same migration." For columns that are
 * meant to start NULL (no conditional backfill), the safe shape is
 * "ADD COLUMN ... NULL" with NO DEFAULT clause. The brief locked this
 * in for student_seen_comment_at.
 *
 * This test asserts the SQL string the migration commits, not just
 * the runtime effect — catches a future "let me add DEFAULT now() for
 * convenience" footgun before it reaches prod.
 */

const MIGRATION_PATH = path.resolve(
  __dirname,
  "../../../../supabase/migrations/20260508224402_add_student_seen_comment_at.sql",
);
const DOWN_PATH = path.resolve(
  __dirname,
  "../../../../supabase/migrations/20260508224402_add_student_seen_comment_at.down.sql",
);

const sql = readFileSync(MIGRATION_PATH, "utf8");
const downSql = readFileSync(DOWN_PATH, "utf8");

describe("TFL.1 migration: 20260508224402_add_student_seen_comment_at.sql", () => {
  it("adds the student_seen_comment_at column on student_tile_grades", () => {
    expect(sql).toMatch(/ALTER TABLE\s+student_tile_grades/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+student_seen_comment_at\s+TIMESTAMPTZ/i);
  });

  it("declares the column as NULL — no DEFAULT clause (Lesson #38)", () => {
    // Strip comments so a comment mentioning DEFAULT (e.g. "no DEFAULT")
    // doesn't trip the assertion.
    const stripped = sql.replace(/--[^\n]*/g, "");
    expect(stripped).toMatch(/student_seen_comment_at\s+TIMESTAMPTZ\s+NULL\s*;/i);
    // Hard guard: no "DEFAULT" token anywhere in non-comment SQL.
    expect(stripped).not.toMatch(/\bDEFAULT\b/i);
  });

  it("contains no destructive statements (DROP/DELETE/TRUNCATE)", () => {
    const stripped = sql.replace(/--[^\n]*/g, "");
    expect(stripped).not.toMatch(/\bDROP\b/i);
    expect(stripped).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(stripped).not.toMatch(/\bTRUNCATE\b/i);
  });
});

describe("TFL.1 down migration: 20260508224402_add_student_seen_comment_at.down.sql", () => {
  it("drops the column the up migration added", () => {
    expect(downSql).toMatch(
      /ALTER TABLE\s+student_tile_grades\s+DROP COLUMN IF EXISTS\s+student_seen_comment_at/i,
    );
  });
});
