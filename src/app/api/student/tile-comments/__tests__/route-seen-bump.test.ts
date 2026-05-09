/**
 * TFL.1.2 + TFL.1 hotfix — source-static guards for /api/student/tile-comments.
 *
 * Same shape as the timeline / kanban route tests. Per Lesson #38 +
 * #71: this repo doesn't run route handlers under vitest (no Next
 * runtime); we assert pattern + ordering against the source string.
 *
 * The TFL.1 contract (post-hotfix migration 20260509222601):
 *   1. Auth gate runs FIRST (requireStudentSession before any DB call).
 *   2. The seen-receipt RPC runs BEFORE the SELECT.
 *   3. The bump goes through the SECURITY DEFINER SQL function
 *      `bump_student_seen_comment_at(p_student_id, p_unit_id, p_page_id)`
 *      — NOT an inline `.update({ student_seen_comment_at: ... })` from
 *      Node — so both `student_seen_comment_at` and the BEFORE-UPDATE
 *      trigger's `updated_at` derive from the same Postgres `now()` and
 *      can never race. The original JS-vs-DB clock skew bug landed
 *      `student_seen_comment_at` ~100–200ms BEFORE `updated_at` and
 *      produced spurious "seen the older version" tooltips on a fresh
 *      receipt.
 *   4. The function (defined in the migration, asserted in the
 *      migration test) filters rows with non-null + non-empty
 *      student_facing_comment so empty-string rows never get a false
 *      receipt.
 *   5. No write to student_tile_grade_events (receipts aren't audit-
 *      worthy at the per-load grain).
 *   6. The route does NOT call `new Date().toISOString()` for the seen
 *      timestamp — that's the bug that was just fixed; pinning it in a
 *      regression assertion so a future hand-edit can't silently bring
 *      it back.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/student/tile-comments — module hygiene", () => {
  it("uses requireStudentSession for auth (Lesson #4)", () => {
    expect(src).toContain('from "@/lib/access-v2/actor-session"');
    expect(src).toContain("requireStudentSession");
  });

  it("uses createAdminClient (service-role) for DB access", () => {
    expect(src).toContain("createAdminClient");
  });

  it("does not write to the audit log table for read receipts", () => {
    // Receipts are not audit-worthy at the per-load grain — would
    // explode student_tile_grade_events. Strip comments so a docstring
    // mentioning the table name in passing doesn't trip the assertion;
    // we want to catch actual `.from("student_tile_grade_events")`
    // calls, not prose.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toContain("student_tile_grade_events");
  });
});

describe("/api/student/tile-comments — TFL.1.2 read-receipt write (RPC, post-hotfix)", () => {
  it("bumps student_seen_comment_at via the bump_student_seen_comment_at RPC", () => {
    // The hotfix routes the bump through a SECURITY DEFINER SQL function
    // so SET clause + trigger updated_at derive from the same now().
    // Inline .update({ student_seen_comment_at: ... }) is the BUG path
    // that just got removed — assert it stays gone.
    expect(src).toContain('.rpc("bump_student_seen_comment_at"');
    expect(src).toContain("p_student_id");
    expect(src).toContain("p_unit_id");
    expect(src).toContain("p_page_id");
  });

  it("does NOT generate the seen-at timestamp from Node (regression guard for the JS-vs-DB clock skew bug)", () => {
    // The original TFL.1.2 used `new Date().toISOString()` and shipped
    // it across the wire. Postgres `now()` then fired ~100–200ms later
    // in the BEFORE-UPDATE trigger, leaving seen_at < updated_at on a
    // fresh receipt. Code-only check (so the comment block above can
    // mention the bug pattern without tripping the assertion).
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/new\s+Date\(\)\.toISOString\(\)/);
    expect(codeOnly).not.toMatch(
      /\.update\(\s*\{\s*student_seen_comment_at\s*:/,
    );
  });

  it("scopes the RPC to (student_id, unit_id, page_id) — never other students", () => {
    // Find the rpc(...) call payload. Match across the call so the
    // assertion survives whitespace + key ordering changes.
    const rpcCall = src.match(
      /\.rpc\(\s*"bump_student_seen_comment_at"\s*,\s*\{[\s\S]*?\}\s*\)/,
    );
    expect(rpcCall).not.toBeNull();
    const payload = rpcCall?.[0] ?? "";
    expect(payload).toMatch(/p_student_id\s*:\s*session\.studentId/);
    expect(payload).toMatch(/p_unit_id\s*:\s*unitId/);
    expect(payload).toMatch(/p_page_id\s*:\s*pageId/);
  });

  it("runs the RPC BEFORE the SELECT (so the response reflects the just-written timestamp on a refresh race)", () => {
    const rpcAt = src.indexOf('.rpc("bump_student_seen_comment_at"');
    const selectAt = src.indexOf(
      '.select("tile_id, page_id, student_facing_comment',
    );
    expect(rpcAt).toBeGreaterThan(-1);
    expect(selectAt).toBeGreaterThan(-1);
    expect(rpcAt).toBeLessThan(selectAt);
  });

  it("auth gate still precedes any DB call (no RPC on the 401 path)", () => {
    const authGateAt = src.indexOf("requireStudentSession");
    const firstRpcAt = src.indexOf(".rpc(");
    expect(authGateAt).toBeGreaterThan(-1);
    expect(firstRpcAt).toBeGreaterThan(-1);
    expect(authGateAt).toBeLessThan(firstRpcAt);
    // And the early-return on session error precedes the rpc call.
    const earlyReturnAt = src.indexOf("session instanceof NextResponse");
    expect(earlyReturnAt).toBeLessThan(firstRpcAt);
  });
});
