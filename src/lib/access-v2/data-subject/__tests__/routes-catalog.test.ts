/**
 * Phase 5.4 route catalog — assert wire-up of /api/v1/student/[id]/export
 * + /api/v1/student/[id] DELETE. Greppable acceptance test (Lesson #38).
 *
 * Both routes:
 *   - Live under /api/v1/ (master spec §3 item #38 — API versioning seam)
 *   - Auth-gate: isPlatformAdmin OR verifyTeacherCanManageStudent
 *   - Cache-Control: private, no-store
 *   - Use the §5.4 lib helpers (buildStudentExport, softDeleteStudent)
 *   - Audit emit on success (export-route does it directly; delete route
 *     delegates to softDeleteStudent which does it inside)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSrc(rel: string): string {
  return readFileSync(resolve(__dirname, "../../../../..", rel), "utf-8");
}

describe("Phase 5.4 — /api/v1/student/[id]/export route", () => {
  const src = readSrc("src/app/api/v1/student/[id]/export/route.ts");

  it("exports GET (not POST)", () => {
    expect(src).toMatch(/export async function GET\(/);
    expect(src).not.toMatch(/export async function (POST|PATCH|DELETE)\(/);
  });

  it("validates student id with UUID regex", () => {
    expect(src).toMatch(/UUID_RE\s*=[\s\S]*?\/\^\[0-9a-f\]\{8\}-/);
    expect(src).toContain('"Invalid student id"');
  });

  it("auth: isPlatformAdmin OR verifyTeacherCanManageStudent", () => {
    expect(src).toContain(
      'import { isPlatformAdmin } from "@/lib/auth/require-platform-admin"',
    );
    expect(src).toContain(
      'import { verifyTeacherCanManageStudent } from "@/lib/auth/verify-teacher-unit"',
    );
    expect(src).toMatch(/await isPlatformAdmin\(user\.id\)/);
    expect(src).toMatch(/await verifyTeacherCanManageStudent\(user\.id, studentId\)/);
  });

  it("returns 401 unauthorized / 403 forbidden / 404 not-found", () => {
    expect(src).toMatch(/status: 401/);
    expect(src).toMatch(/status: 403/);
    expect(src).toMatch(/status: 404/);
  });

  it("emits audit_event 'student.data_export.requested' BEFORE building export", () => {
    expect(src).toContain('action: "student.data_export.requested"');
    expect(src).toContain('failureMode: "throw"');
    expect(src).toContain('severity: "warn"');
    // Order check: audit happens before buildStudentExport
    const auditPos = src.indexOf('"student.data_export.requested"');
    const buildPos = src.indexOf("buildStudentExport(");
    expect(auditPos).toBeGreaterThan(0);
    expect(buildPos).toBeGreaterThan(auditPos);
  });

  it("response headers include Content-Disposition + Cache-Control private", () => {
    expect(src).toMatch(/Content-Disposition/);
    expect(src).toMatch(/attachment; filename="student-/);
    expect(src).toMatch(/"Cache-Control": "private, no-store"/);
  });
});

describe("Phase 5.4 — /api/v1/student/[id] DELETE route", () => {
  const src = readSrc("src/app/api/v1/student/[id]/route.ts");

  it("exports DELETE (not GET)", () => {
    expect(src).toMatch(/export async function DELETE\(/);
    expect(src).not.toMatch(/export async function (GET|POST|PATCH)\(/);
  });

  it("requires ?confirm=true query param (defence in depth)", () => {
    expect(src).toMatch(/confirm = request\.nextUrl\.searchParams\.get\("confirm"\)/);
    expect(src).toMatch(/if \(confirm !== "true"\)/);
    expect(src).toContain('"Confirmation required"');
  });

  it("auth: same gate as export route (isPlatformAdmin OR verifyTeacherCanManageStudent)", () => {
    expect(src).toContain(
      'import { isPlatformAdmin } from "@/lib/auth/require-platform-admin"',
    );
    expect(src).toContain(
      'import { verifyTeacherCanManageStudent } from "@/lib/auth/verify-teacher-unit"',
    );
  });

  it("delegates to softDeleteStudent lib helper (not inline)", () => {
    expect(src).toContain(
      'import { softDeleteStudent } from "@/lib/access-v2/data-subject/delete-student"',
    );
    expect(src).toMatch(
      /await softDeleteStudent\(adminClient, studentId, user\.id\)/,
    );
  });

  it("returns 200 with scheduled_deletion_id + scheduled_hard_delete_at on success", () => {
    expect(src).toContain("scheduled_deletion_id");
    expect(src).toContain("scheduled_hard_delete_at");
    expect(src).toContain("already_scheduled");
  });

  it("maps softDeleteStudent reasons to status codes (404 for not_found, 500 for db_error)", () => {
    expect(src).toMatch(
      /result\.reason === "student_not_found" \? 404 : 500/,
    );
  });

  it("Cache-Control: private, no-store on every response", () => {
    expect(src).toContain('"Cache-Control": "private, no-store"');
  });
});

describe("Phase 5.4 catalog — both routes live under /api/v1/", () => {
  it("export route lives at the v1 path (API versioning seam — master spec §3 item 38)", () => {
    // The very fact that readSrc('src/app/api/v1/student/[id]/export/route.ts')
    // succeeded above is the assertion. This test makes the contract explicit.
    expect(() =>
      readSrc("src/app/api/v1/student/[id]/export/route.ts"),
    ).not.toThrow();
  });

  it("delete route lives at the v1 path", () => {
    expect(() =>
      readSrc("src/app/api/v1/student/[id]/route.ts"),
    ).not.toThrow();
  });
});
