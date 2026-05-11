import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * TFL.2 Pass B sub-phase B.4 — migration shape test.
 *
 * Pairs with `20260511094231_tfl2_b4_trigger_inserts_on_student_latest.sql`.
 * Pins the trigger function rewrite that closes the teacher loop:
 *
 *   - Function still SECURITY DEFINER + search_path locked (Lesson #66)
 *   - REVOKE pattern preserved (Lesson #52)
 *   - Function NOW inspects the LATEST turn regardless of role
 *     (vs B.1's latest-teacher-turn only)
 *   - When latest is student OR no prior turns → INSERT new teacher turn
 *   - When latest is teacher → UPDATE in place (pre-reply editing)
 *   - Trigger row in pg_trigger NOT recreated (function-only swap via
 *     CREATE OR REPLACE FUNCTION); trigger keeps the same name and
 *     firing condition from B.1
 *   - Down migration restores the B.1 body verbatim
 */

const UP_PATH = path.resolve(
  __dirname,
  "../../../../supabase/migrations/20260511094231_tfl2_b4_trigger_inserts_on_student_latest.sql",
);
const DOWN_PATH = path.resolve(
  __dirname,
  "../../../../supabase/migrations/20260511094231_tfl2_b4_trigger_inserts_on_student_latest.down.sql",
);

const sql = readFileSync(UP_PATH, "utf8");
const downSql = readFileSync(DOWN_PATH, "utf8");

// Strip line + block comments so prose doesn't trip pattern asserts.
const code = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");

describe("TFL.2 B.4 migration: trigger function rewrite", () => {
  it("uses CREATE OR REPLACE FUNCTION (function-only swap; trigger row stays)", () => {
    expect(code).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+sync_tile_feedback_from_comment\(\)/i,
    );
    // Drift guard: the migration must NOT recreate the trigger row —
    // dropping it would lose any future schema changes attached to it.
    expect(code).not.toMatch(/CREATE\s+TRIGGER\s+trg_sync_tile_feedback_from_comment/i);
    expect(code).not.toMatch(/DROP\s+TRIGGER/i);
  });

  it("preserves SECURITY DEFINER + locked search_path (Lesson #66)", () => {
    expect(code).toMatch(/SECURITY\s+DEFINER/i);
    expect(code).toMatch(/SET\s+search_path\s*=\s*pg_catalog\s*,\s*public/i);
  });

  it("preserves the REVOKE pattern from PUBLIC + anon + authenticated (Lesson #52)", () => {
    expect(code).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+sync_tile_feedback_from_comment\(\)\s+FROM\s+PUBLIC/i,
    );
    expect(code).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+sync_tile_feedback_from_comment\(\)\s+FROM\s+anon/i,
    );
    expect(code).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+sync_tile_feedback_from_comment\(\)\s+FROM\s+authenticated/i,
    );
  });
});

describe("TFL.2 B.4 migration: INSERT-on-student-latest logic (the B.4 behavior change)", () => {
  it("inspects the LATEST turn regardless of role (vs B.1's latest-teacher-only)", () => {
    // B.1 query: WHERE grade_id = NEW.id AND role = 'teacher' ORDER BY sent_at DESC
    // B.4 query: WHERE grade_id = NEW.id ORDER BY sent_at DESC (no role filter)
    // The function body must declare BOTH latest_turn_id AND
    // latest_turn_role — the role is the load-bearing discriminator.
    expect(code).toMatch(/latest_turn_id\s+UUID/i);
    expect(code).toMatch(/latest_turn_role\s+TEXT/i);
    expect(code).toMatch(
      /SELECT\s+id\s*,\s*role\s+INTO\s+latest_turn_id\s*,\s*latest_turn_role/i,
    );
    // The lookup must NOT filter by role — drift here would mean we're
    // back to the B.1 "ignore student turns" behavior.
    const lookupMatch = code.match(
      /SELECT\s+id\s*,\s*role\s+INTO[\s\S]*?LIMIT\s+1/i,
    );
    expect(lookupMatch).not.toBeNull();
    const lookupBlock = lookupMatch?.[0] ?? "";
    expect(lookupBlock).toMatch(/WHERE\s+grade_id\s*=\s*NEW\.id/i);
    expect(lookupBlock).toMatch(/ORDER\s+BY\s+sent_at\s+DESC/i);
    expect(lookupBlock).not.toMatch(/AND\s+role\s*=/i);
  });

  it("INSERTs when latest_turn_id IS NULL OR latest_turn_role = 'student'", () => {
    // The "no prior turns OR latest is student" branch is the B.4
    // semantic upgrade. Both halves of the OR pinned so a future edit
    // can't accidentally drop one and break the loop closure.
    expect(code).toMatch(
      /IF\s+latest_turn_id\s+IS\s+NULL\s+OR\s+latest_turn_role\s*=\s*'student'\s+THEN/i,
    );
    expect(code).toMatch(/INSERT\s+INTO\s+tile_feedback_turns/i);
  });

  it("UPDATEs the latest teacher turn (with edited_at bump) when latest_turn_role IS teacher", () => {
    // The ELSE branch maintains B.1's pre-reply editing behavior.
    // edited_at = now() so the chip tooltip can surface "(edited)".
    expect(code).toMatch(
      /UPDATE\s+tile_feedback_turns[\s\S]*?body_html\s*=[\s\S]*?edited_at\s*=\s*now\(\)/i,
    );
  });

  it("short-circuits unchanged + null/empty new values (preserved from B.1)", () => {
    expect(code).toMatch(
      /NEW\.student_facing_comment\s+IS\s+NOT\s+DISTINCT\s+FROM\s+OLD\.student_facing_comment/i,
    );
    expect(code).toMatch(
      /NEW\.student_facing_comment\s+IS\s+NULL\s+OR\s+NEW\.student_facing_comment\s*=\s*''/i,
    );
  });

  it("contains no destructive statements (DROP TABLE / DELETE / TRUNCATE / DROP TRIGGER)", () => {
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDROP\s+TRIGGER\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });
});

describe("TFL.2 B.4 down migration: restores B.1 body verbatim", () => {
  it("uses CREATE OR REPLACE FUNCTION (same function name)", () => {
    expect(downSql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+sync_tile_feedback_from_comment\(\)/i,
    );
  });

  it("restores the latest-teacher-turn-only query (B.1 behavior)", () => {
    // The rollback's lookup filters BY role='teacher' — that's the
    // B.1 query shape. Pin it so a drifted rollback can't silently
    // ship the B.4 body twice.
    expect(downSql).toMatch(
      /SELECT\s+id\s+INTO\s+latest_teacher_turn_id[\s\S]*?WHERE\s+grade_id\s*=\s*NEW\.id\s+AND\s+role\s*=\s*'teacher'/i,
    );
  });

  it("preserves SECURITY DEFINER + search_path + REVOKE pattern in rollback", () => {
    expect(downSql).toMatch(/SECURITY\s+DEFINER/i);
    expect(downSql).toMatch(/SET\s+search_path\s*=\s*pg_catalog\s*,\s*public/i);
    expect(downSql).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+sync_tile_feedback_from_comment\(\)\s+FROM\s+PUBLIC/i,
    );
  });

  it("does NOT drop the trigger or function row (function-only swap)", () => {
    expect(downSql).not.toMatch(/DROP\s+TRIGGER/i);
    expect(downSql).not.toMatch(/DROP\s+FUNCTION/i);
  });
});
