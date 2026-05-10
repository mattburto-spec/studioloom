import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * TFL.2 Pass B sub-phase B.1 — migration shape test.
 *
 * Pairs with `20260510101533_tfl2_b1_tile_feedback_turns.sql`. Pins
 * the contracts the rest of Pass B's sub-phases will rely on:
 *
 *   - Table shape (columns, types, NOT NULL where required, PK on id)
 *   - Discriminated-union CHECK constraint (teacher row OR student row)
 *   - Index on (grade_id, sent_at) — the canonical access pattern is
 *     "all turns for a grade row, ordered by time"
 *   - RLS enabled, service_role full, teachers SELECT own classes
 *   - Backfill copies non-empty student_facing_comment values into
 *     teacher turns 1:1
 *   - Sync trigger fires AFTER INSERT/UPDATE on student_facing_comment
 *     and uses SECURITY DEFINER + locked search_path (Lesson #66)
 *   - Down migration drops trigger → function → table in order
 *
 * Lesson #38: assert exact patterns, not "the file is non-empty".
 * Drift in any of these surfaces would break B.2/B.3/B.4 silently;
 * the static check fails fast at the migration layer.
 */

const UP_PATH = path.resolve(
  __dirname,
  "../../../../supabase/migrations/20260510101533_tfl2_b1_tile_feedback_turns.sql",
);
const DOWN_PATH = path.resolve(
  __dirname,
  "../../../../supabase/migrations/20260510101533_tfl2_b1_tile_feedback_turns.down.sql",
);

const sql = readFileSync(UP_PATH, "utf8");
const downSql = readFileSync(DOWN_PATH, "utf8");

// Strip SQL line comments + block comments so prose mentioning
// keywords doesn't trip pattern assertions.
const code = sql
  .replace(/--[^\n]*/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");

describe("TFL.2 B.1 migration: tile_feedback_turns table shape", () => {
  it("creates the tile_feedback_turns table with IF NOT EXISTS (idempotent)", () => {
    expect(code).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+tile_feedback_turns/i,
    );
  });

  it("has id (UUID PK), grade_id (UUID NOT NULL FK CASCADE), role (TEXT NOT NULL CHECK)", () => {
    expect(code).toMatch(
      /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
    );
    expect(code).toMatch(
      /grade_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+student_tile_grades\(id\)\s+ON\s+DELETE\s+CASCADE/i,
    );
    expect(code).toMatch(
      /role\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(\s*role\s+IN\s*\(\s*'teacher'\s*,\s*'student'\s*\)\s*\)/i,
    );
  });

  it("has teacher fields (author_id NULL FK, body_html NULL, edited_at NULL)", () => {
    expect(code).toMatch(
      /author_id\s+UUID\s+NULL\s+REFERENCES\s+auth\.users\(id\)/i,
    );
    expect(code).toMatch(/body_html\s+TEXT\s+NULL/i);
    expect(code).toMatch(/edited_at\s+TIMESTAMPTZ\s+NULL/i);
  });

  it("has student fields (sentiment with CHECK enum, reply_text NULL)", () => {
    expect(code).toMatch(
      /sentiment\s+TEXT\s+NULL\s+CHECK\s*\(\s*sentiment\s+IN\s*\(\s*'got_it'\s*,\s*'not_sure'\s*,\s*'pushback'\s*\)\s*\)/i,
    );
    expect(code).toMatch(/reply_text\s+TEXT\s+NULL/i);
  });

  it("sent_at is TIMESTAMPTZ NOT NULL DEFAULT now()", () => {
    expect(code).toMatch(
      /sent_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i,
    );
  });

  it("CHECK constraint enforces teacher-OR-student discriminated union", () => {
    // The constraint must reject mixed rows (teacher fields AND
    // student fields populated together) AND empty rows (neither
    // populated). Both halves of the OR present.
    expect(code).toMatch(/CONSTRAINT\s+teacher_or_student\s+CHECK/i);
    // Teacher half: role='teacher', author_id + body_html non-null,
    // sentiment + reply_text null.
    expect(code).toMatch(/role\s*=\s*'teacher'/i);
    expect(code).toMatch(/author_id\s+IS\s+NOT\s+NULL/i);
    expect(code).toMatch(/body_html\s+IS\s+NOT\s+NULL/i);
    // Student half: role='student', sentiment non-null, teacher
    // fields null.
    expect(code).toMatch(/role\s*=\s*'student'/i);
    expect(code).toMatch(/sentiment\s+IS\s+NOT\s+NULL/i);
  });

  it("creates the (grade_id, sent_at) composite index", () => {
    expect(code).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_tile_feedback_turns_grade_sent[\s\S]*?\(grade_id,\s*sent_at\)/i,
    );
  });
});

describe("TFL.2 B.1 migration: RLS", () => {
  it("enables RLS on the table", () => {
    expect(code).toMatch(
      /ALTER\s+TABLE\s+tile_feedback_turns\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
    );
  });

  it("grants service_role FOR ALL", () => {
    expect(code).toMatch(
      /CREATE\s+POLICY\s+tfl2_service_role_full[\s\S]*?FOR\s+ALL[\s\S]*?TO\s+service_role/i,
    );
  });

  it("grants authenticated FOR SELECT only via class ownership join", () => {
    // The join chain pinned: grade_id → student_tile_grades → class_id
    // → classes.teacher_id = auth.uid(). Drift in this chain would
    // either leak rows across teachers or silently deny SELECTs.
    const policyMatch = code.match(
      /CREATE\s+POLICY\s+tfl2_teacher_select_own_classes[\s\S]*?(?=CREATE\s+POLICY|$)/i,
    );
    expect(policyMatch).not.toBeNull();
    const policy = policyMatch?.[0] ?? "";
    expect(policy).toMatch(/FOR\s+SELECT/i);
    expect(policy).toMatch(/TO\s+authenticated/i);
    expect(policy).toMatch(/student_tile_grades\s+stg/i);
    expect(policy).toMatch(/c\.teacher_id\s*=\s*auth\.uid\(\)/i);
  });
});

describe("TFL.2 B.1 migration: backfill", () => {
  it("inserts one teacher turn per student_tile_grades row with non-empty student_facing_comment", () => {
    // Filter both halves: NOT NULL AND <> '' so empty strings don't
    // produce empty turns. Same contract as the existing chip + bell
    // readers (which strip empty comments).
    expect(code).toMatch(
      /INSERT\s+INTO\s+tile_feedback_turns[\s\S]*?SELECT[\s\S]*?FROM\s+student_tile_grades\s+stg[\s\S]*?WHERE\s+stg\.student_facing_comment\s+IS\s+NOT\s+NULL[\s\S]*?AND\s+stg\.student_facing_comment\s*<>\s*''/i,
    );
  });

  it("backfilled rows are role='teacher' with body wrapped in <p>...</p>", () => {
    expect(code).toMatch(/'teacher'\s+AS\s+role/i);
    expect(code).toMatch(
      /'<p>'\s*\|\|\s*stg\.student_facing_comment\s*\|\|\s*'<\/p>'/i,
    );
  });

  it("sent_at coalesces updated_at then created_at", () => {
    expect(code).toMatch(
      /COALESCE\(stg\.updated_at,\s*stg\.created_at\)\s+AS\s+sent_at/i,
    );
  });

  it("author_id coalesces graded_by then teacher_id (graded_by may be NULL on early rows)", () => {
    expect(code).toMatch(
      /COALESCE\(stg\.graded_by,\s*stg\.teacher_id\)\s+AS\s+author_id/i,
    );
  });
});

describe("TFL.2 B.1 migration: sync trigger", () => {
  it("creates sync_tile_feedback_from_comment as SECURITY DEFINER with locked search_path (Lesson #66)", () => {
    expect(code).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+sync_tile_feedback_from_comment\(\)/i,
    );
    expect(code).toMatch(/SECURITY\s+DEFINER/i);
    expect(code).toMatch(/SET\s+search_path\s*=\s*pg_catalog\s*,\s*public/i);
  });

  it("REVOKEs from PUBLIC + anon + authenticated (least privilege per Lesson #52)", () => {
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

  it("trigger fires AFTER INSERT OR UPDATE OF student_facing_comment", () => {
    // OF student_facing_comment is the load-bearing detail — without
    // it, the trigger would fire on EVERY UPDATE (including score
    // changes, ai_pre_score writes, NA flips, etc.) and either
    // double-write turns or silently no-op. Pinning the column list.
    expect(code).toMatch(
      /CREATE\s+TRIGGER\s+trg_sync_tile_feedback_from_comment[\s\S]*?AFTER\s+INSERT\s+OR\s+UPDATE\s+OF\s+student_facing_comment\s+ON\s+student_tile_grades/i,
    );
    expect(code).toMatch(
      /FOR\s+EACH\s+ROW[\s\S]*?EXECUTE\s+FUNCTION\s+sync_tile_feedback_from_comment\(\)/i,
    );
  });

  it("function body short-circuits when comment is unchanged + when new value is null/empty", () => {
    // Both guards prevent the trigger from running its logic on
    // no-op writes (e.g. an UPDATE that touches score but not the
    // comment) or on legitimate "delete the comment" flows.
    expect(code).toMatch(
      /NEW\.student_facing_comment\s+IS\s+NOT\s+DISTINCT\s+FROM\s+OLD\.student_facing_comment/i,
    );
    expect(code).toMatch(
      /NEW\.student_facing_comment\s+IS\s+NULL\s+OR\s+NEW\.student_facing_comment\s*=\s*''/i,
    );
  });

  it("function INSERTs a new teacher turn when no prior turn exists, else UPDATEs the latest one", () => {
    // The two branches: latest_teacher_turn_id IS NULL → INSERT;
    // ELSE → UPDATE. Drift here would either always-INSERT (creating
    // duplicate turns on edits) or always-UPDATE (losing original
    // sent_at on a brand-new comment).
    expect(code).toMatch(
      /IF\s+latest_teacher_turn_id\s+IS\s+NULL\s+THEN[\s\S]*?INSERT\s+INTO\s+tile_feedback_turns[\s\S]*?ELSE[\s\S]*?UPDATE\s+tile_feedback_turns/i,
    );
    // The UPDATE branch must bump edited_at — that's how the chip
    // tooltip differentiates "edited since seen" from "first sent".
    expect(code).toMatch(/edited_at\s*=\s*now\(\)/i);
  });

  it("contains no destructive statements (DROP TABLE / DELETE / TRUNCATE)", () => {
    // Up migration is purely additive. DROP TRIGGER on student_tile_
    // grades (which doesn't exist yet for this migration's trigger)
    // is fine — but a DROP TABLE here would corrupt downstream data.
    expect(code).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(code).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(code).not.toMatch(/\bTRUNCATE\b/i);
  });
});

describe("TFL.2 B.1 down migration: rollback shape", () => {
  it("drops the trigger first (before the function it calls)", () => {
    // Order matters: dropping the function while the trigger still
    // exists would error. The down migration must drop in reverse
    // order of creation.
    const dropTriggerIdx = downSql.indexOf("DROP TRIGGER");
    const dropFunctionIdx = downSql.indexOf("DROP FUNCTION");
    const dropTableIdx = downSql.indexOf("DROP TABLE");
    expect(dropTriggerIdx).toBeGreaterThan(-1);
    expect(dropFunctionIdx).toBeGreaterThan(-1);
    expect(dropTableIdx).toBeGreaterThan(-1);
    expect(dropTriggerIdx).toBeLessThan(dropFunctionIdx);
    expect(dropFunctionIdx).toBeLessThan(dropTableIdx);
  });

  it("every drop uses IF EXISTS (idempotent re-run)", () => {
    expect(downSql).toMatch(/DROP\s+TRIGGER\s+IF\s+EXISTS/i);
    expect(downSql).toMatch(/DROP\s+FUNCTION\s+IF\s+EXISTS/i);
    expect(downSql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS/i);
  });

  it("DROP TABLE uses CASCADE so the index + RLS policies go with it", () => {
    expect(downSql).toMatch(/DROP\s+TABLE\s+IF\s+EXISTS\s+tile_feedback_turns\s+CASCADE/i);
  });
});
