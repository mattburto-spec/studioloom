/**
 * TFL.1.2 — source-static guards for /api/student/tile-comments.
 *
 * Same shape as the timeline / kanban route tests. Per Lesson #38 +
 * #71: this repo doesn't run route handlers under vitest (no Next
 * runtime); we assert pattern + ordering against the source string.
 *
 * The TFL.1 contract:
 *   1. Auth gate runs FIRST (requireStudentSession before any DB call).
 *   2. The seen-receipt UPDATE runs BEFORE the SELECT.
 *   3. The UPDATE filters rows with non-null + non-empty
 *      student_facing_comment (no false receipts on tiles with no
 *      teacher comment).
 *   4. The UPDATE writes student_seen_comment_at = a fresh ISO string.
 *   5. No write to student_tile_grade_events (receipts aren't audit-
 *      worthy at the per-load grain).
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

describe("/api/student/tile-comments — TFL.1.2 read-receipt write", () => {
  it("bumps student_seen_comment_at on the row (UPDATE call)", () => {
    expect(src).toContain("student_seen_comment_at");
    // The new value is a fresh ISO timestamp, not a literal — assert the
    // shape rather than the value.
    expect(src).toMatch(/new Date\(\)\.toISOString\(\)/);
    expect(src).toMatch(
      /\.update\(\s*\{\s*student_seen_comment_at\s*:\s*\w+\s*\}/,
    );
  });

  it("filters the UPDATE to rows with a non-null AND non-empty student_facing_comment", () => {
    // Both filters required: .not("student_facing_comment", "is", null)
    // catches the SQL NULL case; .neq("student_facing_comment", "") catches
    // the empty-string case the GET also strips. Without both, an empty-
    // string row gets a false "seen" timestamp.
    const updateBlock = src.match(
      /\.update\([\s\S]*?\.not\([\s\S]*?\.neq\([\s\S]*?\)/,
    );
    expect(updateBlock).not.toBeNull();
    expect(updateBlock?.[0]).toContain('"student_facing_comment", "is", null');
    expect(updateBlock?.[0]).toContain('"student_facing_comment", ""');
  });

  it("scopes the UPDATE to (student_id, unit_id, page_id) — never other students", () => {
    const updateBlock = src.match(/\.update\([\s\S]*?\.not\(/);
    expect(updateBlock).not.toBeNull();
    const block = updateBlock?.[0] ?? "";
    expect(block).toContain('.eq("student_id"');
    expect(block).toContain('.eq("unit_id"');
    expect(block).toContain('.eq("page_id"');
  });

  it("runs the UPDATE BEFORE the SELECT (so the response reflects the just-written timestamp on a refresh race)", () => {
    // First .update(...) appearance must precede the .select("tile_id, …")
    // appearance. Using indexOf — order matters here.
    const updateAt = src.indexOf(
      '.update({ student_seen_comment_at',
    );
    const selectAt = src.indexOf(
      '.select("tile_id, page_id, student_facing_comment',
    );
    expect(updateAt).toBeGreaterThan(-1);
    expect(selectAt).toBeGreaterThan(-1);
    expect(updateAt).toBeLessThan(selectAt);
  });

  it("auth gate still precedes any DB call (no UPDATE on the 401 path)", () => {
    const authGateAt = src.indexOf("requireStudentSession");
    const firstUpdateAt = src.indexOf(".update(");
    expect(authGateAt).toBeGreaterThan(-1);
    expect(firstUpdateAt).toBeGreaterThan(-1);
    expect(authGateAt).toBeLessThan(firstUpdateAt);
    // And the early-return on session error precedes the update.
    const earlyReturnAt = src.indexOf("session instanceof NextResponse");
    expect(earlyReturnAt).toBeLessThan(firstUpdateAt);
  });
});
