/**
 * GET /api/student/tile-feedback — source-static guards.
 *
 * TFL.2 Pass B sub-phase B.2. The route is the entry point for the
 * student lesson page's <TeacherFeedback /> wiring. Tests pin:
 *
 *   - Auth gate runs FIRST (requireStudentSession before any DB call).
 *   - TFL.1 read-receipt RPC fires BEFORE the loader runs, so the
 *     "seen at" timestamp covers the same load that returns turns
 *     (matches the legacy /api/student/tile-comments contract).
 *   - The bump uses the SECURITY DEFINER RPC, NOT an inline
 *     `.update()` — pin against the JS-vs-DB clock-skew bug from
 *     the TFL.1 hotfix (PR #147).
 *   - Returns `{ threadsByTileId }` shape that matches the
 *     useTileFeedbackThreads hook's expectation.
 *   - Required query params (unitId, pageId) gated with 400.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/student/tile-feedback — module hygiene", () => {
  it("uses requireStudentSession for auth (Lesson #4)", () => {
    expect(src).toContain('from "@/lib/access-v2/actor-session"');
    expect(src).toContain("requireStudentSession");
  });

  it("uses createAdminClient (service-role) for DB access", () => {
    expect(src).toContain("createAdminClient");
  });

  it("imports loadTileFeedbackThreads helper (single source of truth on the query)", () => {
    // B.3: import also includes `type TileFeedbackResult` for the
    // route's local result variable. Both names + the source path.
    expect(src).toMatch(
      /import\s*\{[\s\S]*?loadTileFeedbackThreads[\s\S]*?\}[\s\S]*?from\s*"@\/lib\/grading\/tile-feedback-loader"/,
    );
  });
});

describe("/api/student/tile-feedback — read-receipt + load order", () => {
  it("auth gate runs before any DB call", () => {
    const authGateAt = src.indexOf("requireStudentSession");
    const firstDbCall = Math.min(
      ...[".rpc(", ".from(", "loadTileFeedbackThreads"]
        .map((s) => src.indexOf(s))
        .filter((i) => i > -1),
    );
    expect(authGateAt).toBeGreaterThan(-1);
    expect(authGateAt).toBeLessThan(firstDbCall);
  });

  it("query-param check (unitId + pageId required) precedes the first DB CALL (not import)", () => {
    // Anchor the "first DB call" on patterns that only appear in
    // executable code, NOT imports. `.rpc(` + `db.rpc` only appear in
    // the body; `loadTileFeedbackThreads(` (with paren) is a call
    // not the import.
    const paramCheckAt = src.indexOf("unitId and pageId required");
    const dbCallSites = [
      src.indexOf(".rpc("),
      src.search(/loadTileFeedbackThreads\s*\(/),
    ].filter((i) => i > -1);
    expect(dbCallSites.length).toBeGreaterThan(0);
    const firstDbCall = Math.min(...dbCallSites);
    expect(paramCheckAt).toBeGreaterThan(-1);
    expect(paramCheckAt).toBeLessThan(firstDbCall);
  });

  it("TFL.1 read-receipt RPC fires BEFORE the loader runs", () => {
    const rpcAt = src.indexOf('.rpc("bump_student_seen_comment_at"');
    const loaderAt = src.indexOf("loadTileFeedbackThreads(");
    expect(rpcAt).toBeGreaterThan(-1);
    expect(loaderAt).toBeGreaterThan(-1);
    expect(rpcAt).toBeLessThan(loaderAt);
  });

  it("RPC payload is (p_student_id, p_unit_id, p_page_id) — same shape as the legacy /tile-comments route", () => {
    expect(src).toMatch(/p_student_id:\s*session\.studentId/);
    expect(src).toMatch(/p_unit_id:\s*unitId/);
    expect(src).toMatch(/p_page_id:\s*pageId/);
  });

  it("does NOT inline-update student_seen_comment_at via JS-stamped time (TFL.1 hotfix regression guard)", () => {
    // Strip comments so doc references to the bug pattern don't
    // trip the assertion.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/new\s+Date\(\)\.toISOString\(\)/);
    expect(codeOnly).not.toMatch(
      /\.update\(\s*\{\s*student_seen_comment_at\s*:/,
    );
  });
});

describe("/api/student/tile-feedback — response shape", () => {
  it("returns the TileFeedbackResult shape (threadsByTileId + gradeIdByTileId, B.3)", () => {
    // B.3: response now carries both maps. The route returns the
    // loader result directly via NextResponse.json(result).
    expect(src).toMatch(/return\s+NextResponse\.json\(\s*result\s*\)/);
    // Source must mention both shape members so a future "let me
    // simplify" edit can't silently drop one.
    expect(src).toContain("TileFeedbackResult");
  });

  it("missing query params return 400 with the exact copy the route documents", () => {
    expect(src).toMatch(/error:\s*"unitId and pageId required"/);
    expect(src).toMatch(/status:\s*400/);
  });

  it("loader errors return 500 (parent catches, surfaces error message)", () => {
    expect(src).toMatch(/status:\s*500/);
    expect(src).toMatch(/Failed to load tile feedback threads/);
  });
});

describe("/api/student/tile-feedback — orphan-grade filter (14 May 2026)", () => {
  it("resolves the rendered page content + passes validTileIds to the loader", () => {
    expect(src).toMatch(
      /loadTileFeedbackThreads\(\s*\n?\s*db,\s*\n?\s*session\.studentId,\s*\n?\s*unitId,\s*\n?\s*pageId,\s*\n?\s*validTileIds,/,
    );
  });

  it("computes validTileIds via class_students → class_units → extractTilesFromPage", () => {
    expect(src).toMatch(/from\("class_students"\)/);
    expect(src).toMatch(/from\("class_units"\)/);
    expect(src).toMatch(/resolveClassUnitContent/);
    expect(src).toMatch(/extractTilesFromPage\(page,\s*\{\}\)/);
  });

  it("falls back to validTileIds=null on any resolution failure (no-op filter, backwards-compatible)", () => {
    expect(src).toMatch(/validTileIds\s*=\s*null/);
  });

  it("filters to ACTIVE class enrollments (is_active=true) when resolving the class", () => {
    expect(src).toMatch(/\.eq\("is_active",\s*true\)/);
  });
});
