import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * TFL.1 hotfix migration shape test.
 *
 * Pairs with `20260509222601_add_bump_student_seen_comment_at_rpc.sql`.
 * The hotfix exists because the original TFL.1.2 inline UPDATE used
 * `new Date().toISOString()` from Node, which raced the BEFORE-UPDATE
 * trigger's `now()` and left `student_seen_comment_at` ~100–200ms
 * BEHIND `updated_at` on a fresh receipt — chip rendered "Seen the
 * older version" instead of "Seen the latest".
 *
 * The fix: route the bump through a SECURITY DEFINER SQL function so
 * SET clause and trigger updated_at both derive from the same Postgres
 * `now()` (transaction-start time, identical across both).
 *
 * What this test pins:
 *   - Function name + arg list (route depends on the exact RPC name).
 *   - SECURITY DEFINER (route uses service-role, function needs to
 *     bypass RLS the same way the inline .update() did).
 *   - search_path locked to pg_catalog, public (Lesson #66 — without
 *     this, a SECURITY DEFINER function can be hijacked by a search-
 *     path attack).
 *   - REVOKE from PUBLIC/anon/authenticated, GRANT to service_role
 *     (Lesson #52 — least privilege for definer functions).
 *   - Body filters non-null + non-empty student_facing_comment (so
 *     empty rows can never receive a false receipt — same contract
 *     the inline UPDATE had).
 *   - Body uses `now()` for the timestamp (the whole point of the fix).
 *   - Down migration drops the function with IF EXISTS.
 */

const UP_PATH = path.resolve(
  __dirname,
  "../../../../supabase/migrations/20260509222601_add_bump_student_seen_comment_at_rpc.sql",
);
const DOWN_PATH = path.resolve(
  __dirname,
  "../../../../supabase/migrations/20260509222601_add_bump_student_seen_comment_at_rpc.down.sql",
);

const sql = readFileSync(UP_PATH, "utf8");
const downSql = readFileSync(DOWN_PATH, "utf8");

// Strip SQL line comments so prose explaining the fix doesn't trip
// pattern assertions. Block comments aren't used in the file.
const code = sql.replace(/--[^\n]*/g, "");

describe("TFL.1 hotfix migration: 20260509222601_add_bump_student_seen_comment_at_rpc.sql", () => {
  it("creates the bump_student_seen_comment_at(UUID, UUID, TEXT) function", () => {
    expect(code).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+bump_student_seen_comment_at\s*\(/i,
    );
    expect(code).toMatch(/p_student_id\s+UUID/i);
    expect(code).toMatch(/p_unit_id\s+UUID/i);
    expect(code).toMatch(/p_page_id\s+TEXT/i);
    expect(code).toMatch(/RETURNS\s+void/i);
  });

  it("declares SECURITY DEFINER with search_path locked (Lesson #66)", () => {
    expect(code).toMatch(/SECURITY\s+DEFINER/i);
    expect(code).toMatch(/SET\s+search_path\s*=\s*pg_catalog\s*,\s*public/i);
  });

  it("uses Postgres now() for the timestamp — the whole point of the fix", () => {
    // Body must SET student_seen_comment_at = now() — DB-side time, not
    // anything the caller passes in.
    expect(code).toMatch(
      /SET\s+student_seen_comment_at\s*=\s*now\(\)/i,
    );
    // No timestamp arg in the function signature — caller can't poison
    // the value with a JS-generated time.
    const sigMatch = code.match(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+bump_student_seen_comment_at\s*\(([^)]*)\)/i,
    );
    expect(sigMatch).not.toBeNull();
    const args = sigMatch?.[1] ?? "";
    expect(args).not.toMatch(/TIMESTAMP/i);
  });

  it("filters rows with non-null AND non-empty student_facing_comment", () => {
    // Same contract the inline UPDATE had — receipts only fire on rows
    // the student is actually reading.
    expect(code).toMatch(/student_facing_comment\s+IS\s+NOT\s+NULL/i);
    expect(code).toMatch(/student_facing_comment\s*<>\s*''/);
  });

  it("scopes the UPDATE to (student_id, unit_id, page_id) — never other students", () => {
    expect(code).toMatch(/student_id\s*=\s*p_student_id/i);
    expect(code).toMatch(/unit_id\s*=\s*p_unit_id/i);
    expect(code).toMatch(/page_id\s*=\s*p_page_id/i);
  });

  it("revokes from PUBLIC/anon/authenticated and grants only to service_role (Lesson #52)", () => {
    expect(code).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+bump_student_seen_comment_at[^;]*FROM\s+PUBLIC/i,
    );
    expect(code).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+bump_student_seen_comment_at[^;]*FROM\s+anon/i,
    );
    expect(code).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+bump_student_seen_comment_at[^;]*FROM\s+authenticated/i,
    );
    expect(code).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+bump_student_seen_comment_at[^;]*TO\s+service_role/i,
    );
  });

  it("contains no destructive statements (DROP TABLE/DELETE/TRUNCATE)", () => {
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });
});

describe("TFL.1 hotfix down migration: 20260509222601_add_bump_student_seen_comment_at_rpc.down.sql", () => {
  it("drops the function with IF EXISTS (idempotent)", () => {
    expect(downSql).toMatch(
      /DROP\s+FUNCTION\s+IF\s+EXISTS\s+bump_student_seen_comment_at\s*\(\s*UUID\s*,\s*UUID\s*,\s*TEXT\s*\)/i,
    );
  });
});
