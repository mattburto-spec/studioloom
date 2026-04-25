/**
 * Schema contract tests for migration 117 (classes.school_id reservation).
 *
 * Mirrors fabricators-school-id-schema.test.ts. Static-analysis only;
 * live DB probe runs out-of-band when Matt applies via Supabase SQL
 * editor.
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

const UP = read("117_classes_school_id_reserved.sql");
const DOWN = read("117_classes_school_id_reserved.down.sql");

describe("Migration 117 — classes.school_id reservation (UP)", () => {
  it("adds school_id as a nullable FK to schools(id) with idempotent guard", () => {
    expect(UP).toMatch(
      /ALTER TABLE classes[\s\S]*?ADD COLUMN IF NOT EXISTS school_id UUID NULL[\s\S]*?REFERENCES schools\(id\) ON DELETE SET NULL/
    );
  });

  it("creates a partial index on school_id (non-null only)", () => {
    expect(UP).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_classes_school_id[\s\S]*?WHERE school_id IS NOT NULL/
    );
  });

  it("does NOT touch RLS policies (those flip in FU-P-2)", () => {
    expect(UP).not.toMatch(/CREATE POLICY[\s\S]*?ON classes/);
    expect(UP).not.toMatch(/DROP POLICY[\s\S]*?ON classes/);
    expect(UP).not.toMatch(/ALTER POLICY[\s\S]*?ON classes/);
  });

  it("does NOT use DO/DECLARE verify blocks (Lesson #51)", () => {
    expect(UP).not.toMatch(/DO \$\$[\s\S]*DECLARE/);
  });

  it("references the FU-P plan in the file header", () => {
    expect(UP).toMatch(/fu-p-access-model-v2-plan\.md/);
  });

  it("documents the four sister school_id reservations (093/097/113/116)", () => {
    // Quick way to assert the migration contextualises itself in
    // the broader pattern — important for future-Matt reading the
    // file without a full archaeology session.
    expect(UP).toMatch(/093/);
    expect(UP).toMatch(/097/);
    expect(UP).toMatch(/113/);
    expect(UP).toMatch(/116/);
  });
});

describe("Migration 117 — DOWN rollback", () => {
  it("drops the school_id column with idempotent guard", () => {
    expect(DOWN).toMatch(/ALTER TABLE classes DROP COLUMN IF EXISTS school_id/);
  });
});
