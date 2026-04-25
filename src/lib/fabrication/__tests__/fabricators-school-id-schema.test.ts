/**
 * Schema contract tests for migration 116 (fabricators.school_id reservation).
 *
 * Mirrors fabrication-labs-schema.test.ts. Static-analysis tests —
 * read the migration file at test time, assert key text patterns are
 * present. Live DB probe runs out-of-band (Matt applies via Supabase
 * SQL editor; same pattern as 113 + 114).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "supabase",
  "migrations"
);

function read(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
}

const UP = read("116_fabricators_school_id_reserved.sql");
const DOWN = read("116_fabricators_school_id_reserved.down.sql");

describe("Migration 116 — fabricators.school_id reservation (UP)", () => {
  it("adds school_id as a nullable FK to schools(id) with idempotent guard", () => {
    expect(UP).toMatch(
      /ALTER TABLE fabricators[\s\S]*?ADD COLUMN IF NOT EXISTS school_id UUID NULL[\s\S]*?REFERENCES schools\(id\) ON DELETE SET NULL/
    );
  });

  it("creates a partial index on school_id (non-null only)", () => {
    expect(UP).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_fabricators_school_id[\s\S]*?WHERE school_id IS NOT NULL/
    );
  });

  it("does NOT touch RLS policies (those flip in FU-P-2)", () => {
    // The migration deliberately leaves all existing fabricators_*
    // policies intact. Anyone re-reading the file should see no
    // ALTER POLICY / DROP POLICY / CREATE POLICY on fabricators.
    expect(UP).not.toMatch(/CREATE POLICY[\s\S]*?ON fabricators/);
    expect(UP).not.toMatch(/DROP POLICY[\s\S]*?ON fabricators/);
    expect(UP).not.toMatch(/ALTER POLICY[\s\S]*?ON fabricators/);
  });

  it("does NOT use DO/DECLARE verify blocks (Lesson #51)", () => {
    expect(UP).not.toMatch(/DO \$\$[\s\S]*DECLARE/);
  });

  it("references the FU-P plan in the file header", () => {
    expect(UP).toMatch(/fu-p-access-model-v2-plan\.md/);
  });
});

describe("Migration 116 — DOWN rollback", () => {
  it("drops the school_id column with idempotent guard", () => {
    expect(DOWN).toMatch(
      /ALTER TABLE fabricators DROP COLUMN IF EXISTS school_id/
    );
  });
});
