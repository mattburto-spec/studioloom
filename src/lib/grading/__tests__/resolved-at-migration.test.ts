/**
 * TFL.3 C.3.3 — migration 20260512023440 source-static guards.
 *
 * Source-static checks against the SQL file (no live DB) — pins the
 * column types + index shape so a future edit can't drop NULL
 * default or remove the partial index without the build failing.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const MIG_DIR = join(__dirname, "../../../..", "supabase/migrations");
const upSql = readFileSync(
  join(MIG_DIR, "20260512023440_student_tile_grades_resolved_at.sql"),
  "utf-8",
);
const downSql = readFileSync(
  join(MIG_DIR, "20260512023440_student_tile_grades_resolved_at.down.sql"),
  "utf-8",
);

// Strip `--` comments before assertions so the comment-block doesn't
// false-positive negative regexes.
const upSqlCode = upSql
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n");

describe("migration 20260512023440 — up", () => {
  it("adds resolved_at as TIMESTAMPTZ NULL (no DEFAULT, Lesson #38)", () => {
    expect(upSqlCode).toMatch(/resolved_at\s+TIMESTAMPTZ\s+NULL/i);
    // Specifically NO `DEFAULT` clause on resolved_at — leaves all
    // existing rows + new rows as NULL (open).
    expect(upSqlCode).not.toMatch(/resolved_at\s+TIMESTAMPTZ[^,]*DEFAULT/i);
  });

  it("adds resolved_by as UUID NULL with FK to auth.users + ON DELETE SET NULL", () => {
    expect(upSql).toMatch(/resolved_by\s+UUID\s+NULL/i);
    expect(upSql).toMatch(
      /REFERENCES\s+auth\.users\(id\)\s+ON DELETE SET NULL/i,
    );
  });

  it("uses IF NOT EXISTS guards (re-runnable on partially-applied prod)", () => {
    expect(upSql).toMatch(/ADD COLUMN IF NOT EXISTS resolved_at/i);
    expect(upSql).toMatch(/ADD COLUMN IF NOT EXISTS resolved_by/i);
  });

  it("creates a partial index on resolved_at WHERE NOT NULL (keeps it small)", () => {
    expect(upSql).toMatch(
      /CREATE INDEX IF NOT EXISTS student_tile_grades_resolved_at_idx[\s\S]*?ON student_tile_grades \(resolved_at\)[\s\S]*?WHERE resolved_at IS NOT NULL/i,
    );
  });
});

describe("migration 20260512023440 — down (rollback)", () => {
  it("drops the partial index BEFORE dropping the columns", () => {
    const idxPos = downSql.search(/DROP INDEX/i);
    const colPos = downSql.search(/DROP COLUMN/i);
    expect(idxPos).toBeGreaterThanOrEqual(0);
    expect(colPos).toBeGreaterThanOrEqual(0);
    expect(idxPos).toBeLessThan(colPos);
  });

  it("drops both resolved_at + resolved_by columns", () => {
    expect(downSql).toMatch(/DROP COLUMN IF EXISTS resolved_at/i);
    expect(downSql).toMatch(/DROP COLUMN IF EXISTS resolved_by/i);
  });
});
