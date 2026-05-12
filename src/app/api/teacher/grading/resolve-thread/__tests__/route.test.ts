/**
 * TFL.3 C.3.3 — POST /api/teacher/grading/resolve-thread
 * source-static guards.
 *
 * Pins:
 *   - requireTeacher gate
 *   - Ownership check (grade.class.teacher_id === auth.teacherId)
 *   - 400 missing grade_id
 *   - 404 grade not found
 *   - 403 grade belongs to another teacher
 *   - UPDATE writes resolved_at + resolved_by
 *   - Default `resolved` is true; can pass false for undo
 *   - logAuditEvent emits grading.thread_resolved / *_undone
 *     (action name pinned)
 *   - soft-sentry failureMode (audit hiccup doesn't roll back)
 *   - Returns { ok: true, resolvedAt } on 200
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/teacher/grading/resolve-thread — auth + ownership", () => {
  it("gates with requireTeacher (NOT bare auth.getUser)", () => {
    expect(src).toMatch(
      /import\s*\{\s*requireTeacher\s*\}\s*from\s*"@\/lib\/auth\/require-teacher"/,
    );
    expect(src).toMatch(/const auth\s*=\s*await\s+requireTeacher\(request\)/);
    expect(src).toMatch(/if\s*\(auth\.error\)\s*return\s+auth\.error/);
  });

  it("verifies grade belongs to teacher's class (403 on mismatch)", () => {
    expect(src).toMatch(/klass\.teacher_id\s*!==\s*teacherId/);
    expect(src).toMatch(/status:\s*403/);
    expect(src).toMatch(/Forbidden/);
  });

  it("returns 404 when grade row doesn't exist", () => {
    expect(src).toMatch(/Grade not found/);
    expect(src).toMatch(/status:\s*404/);
  });

  it("returns 400 when grade_id is missing", () => {
    expect(src).toMatch(/grade_id required/);
  });
});

describe("/api/teacher/grading/resolve-thread — write path", () => {
  it("UPDATEs student_tile_grades.resolved_at + resolved_by", () => {
    expect(src).toMatch(
      /\.from\("student_tile_grades"\)[\s\S]*?\.update\(\{[\s\S]*?resolved_at:\s*resolvedAt[\s\S]*?resolved_by:[\s\S]*?teacherId/,
    );
  });

  it("default action stamps resolved_at = new Date().toISOString()", () => {
    expect(src).toMatch(
      /const resolvedAt\s*=\s*wantResolved\s*\?\s*new Date\(\)\.toISOString\(\)\s*:\s*null/,
    );
  });

  it("supports an undo path (body.resolved === false → clears columns)", () => {
    expect(src).toMatch(/const wantResolved\s*=\s*body\.resolved\s*!==\s*false/);
    // When clearing, both columns go null.
    expect(src).toMatch(
      /resolved_by:\s*wantResolved\s*\?\s*teacherId\s*:\s*null/,
    );
  });

  it("returns { ok: true, resolvedAt } with 200", () => {
    expect(src).toMatch(
      /NextResponse\.json\(\s*\{\s*ok:\s*true,\s*resolvedAt\s*\}\s*,\s*\{\s*status:\s*200\s*\}/,
    );
  });
});

describe("/api/teacher/grading/resolve-thread — audit log", () => {
  it("calls logAuditEvent with grading.thread_resolved action", () => {
    expect(src).toMatch(
      /import\s*\{\s*logAuditEvent\s*\}\s*from\s*"@\/lib\/access-v2\/audit-log"/,
    );
    expect(src).toMatch(/action:\s*wantResolved[\s\S]*?"grading\.thread_resolved"/);
    expect(src).toMatch(/"grading\.thread_resolve_undone"/);
  });

  it("uses soft-sentry failureMode so a logging hiccup doesn't fail the call", () => {
    expect(src).toMatch(/failureMode:\s*"soft-sentry"/);
  });

  it("payload includes grade_id, student_id, class_id, tile_id, resolved_at", () => {
    expect(src).toMatch(
      /payload:\s*\{[\s\S]*?grade_id[\s\S]*?student_id[\s\S]*?class_id[\s\S]*?tile_id[\s\S]*?resolved_at/,
    );
  });
});
