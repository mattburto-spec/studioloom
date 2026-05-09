/**
 * Phase 5.6 catalog — teacher audit-log view route.
 *
 * Asserts the wire-up + behavioural contracts of
 * /api/v1/teacher/students/[id]/audit-log via greppable tests against the
 * route source. The route's runtime behaviour is unit-test-covered by the
 * extensive Phase 5.4 routes-catalog pattern; this catalog locks in the
 * Phase 5.6-specific contract (auth gate parity with §5.4, pagination
 * shape, dedup across actor + target queries, audit-skip marker).
 *
 * Lessons applied: #38 (assert specific values via grep, not non-null).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSrc(rel: string): string {
  return readFileSync(resolve(__dirname, "../../../..", rel), "utf-8");
}

const ROUTE_PATH =
  "src/app/api/v1/teacher/students/[id]/audit-log/route.ts";

describe("Phase 5.6 — /api/v1/teacher/students/[id]/audit-log route", () => {
  const src = readSrc(ROUTE_PATH);

  it("exports GET (read-only, not a mutation)", () => {
    expect(src).toMatch(/export async function GET\(/);
    expect(src).not.toMatch(/export async function (POST|PATCH|DELETE|PUT)\(/);
  });

  it("validates student id with UUID regex", () => {
    expect(src).toMatch(/UUID_RE\s*=[\s\S]*?\/\^\[0-9a-f\]\{8\}-/);
    expect(src).toContain('"Invalid student id"');
  });

  it("auth gate parity with §5.4 — isPlatformAdmin OR verifyTeacherCanManageStudent", () => {
    expect(src).toContain(
      'import { isPlatformAdmin } from "@/lib/auth/require-platform-admin"',
    );
    expect(src).toContain(
      'import { verifyTeacherCanManageStudent } from "@/lib/auth/verify-teacher-unit"',
    );
    // S3 (10 May 2026): role gate via requireTeacher() replaces bare
    // auth.getUser() — teacherId is destructured from the auth result and
    // passed to the platform-admin + cross-class manageability checks.
    expect(src).toContain(
      'import { requireTeacher } from "@/lib/auth/require-teacher"',
    );
    expect(src).toMatch(/await isPlatformAdmin\(teacherId\)/);
    expect(src).toMatch(
      /await verifyTeacherCanManageStudent\(teacherId, studentId\)/,
    );
  });

  it("returns 401 unauthenticated / 403 forbidden / 404 not-found / 400 bad params", () => {
    expect(src).toMatch(/status: 400/);
    // 401 + 403 now come from requireTeacher() helper (returns hard-coded
    // NextResponse with those status codes), so they're not literal in this
    // route file but still wired via `if (auth.error) return auth.error`.
    expect(src).toContain("requireTeacher(request)");
    expect(src).toMatch(/status: 404/);
  });

  it("pagination: ?limit (default 50, max 200) + ?before cursor (ISO timestamp)", () => {
    expect(src).toContain("DEFAULT_LIMIT = 50");
    expect(src).toContain("MAX_LIMIT = 200");
    expect(src).toMatch(/params\.get\("limit"\)/);
    expect(src).toMatch(/params\.get\("before"\)/);
    expect(src).toMatch(/Date\.parse\(before\)/);
    expect(src).toContain('"Invalid before cursor"');
  });

  it("two queries combined (actor + target) for dedup across both surfaces", () => {
    expect(src).toMatch(/\.eq\("actor_id", studentId\)/);
    expect(src).toMatch(/\.eq\("target_table", "students"\)/);
    expect(src).toMatch(/\.eq\("target_id", studentId\)/);
    // Both queries fire in parallel
    expect(src).toMatch(/Promise\.all\(\[/);
    // Dedup by id
    expect(src).toMatch(/seen\.has\(row\.id\)/);
  });

  it("response shape includes student_id + events[] + next_cursor", () => {
    expect(src).toContain("student_id: studentId,");
    expect(src).toContain("events,");
    expect(src).toContain("next_cursor: nextCursor,");
  });

  it("Cache-Control: private, no-store on every response", () => {
    expect(src).toContain('"Cache-Control": "private, no-store"');
  });

  it("audit-skip marker present (read-only GET, not a mutation route)", () => {
    expect(src).toMatch(/audit-skip:[^\n]*read-only GET/);
  });
});
