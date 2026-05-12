/**
 * TFL.3 C.4 — POST /api/teacher/grading/regenerate-draft source-static
 * guards.
 *
 * Pins:
 *   - requireTeacher gate
 *   - ownership check (klass.teacher_id === auth.teacherId)
 *   - 400 missing grade_id / current_draft / invalid directive
 *   - 400 ask_text required when directive === "ask"
 *   - 404 grade not found
 *   - PII round-trip: real → placeholder before helper call, restore
 *     real on the response
 *   - Returns { draftBody, directive, modelVersion, promptVersion }
 *   - audit-skip annotation (no DB writes, returns AI output only)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/teacher/grading/regenerate-draft — auth + ownership", () => {
  it("gates with requireTeacher", () => {
    expect(src).toMatch(
      /import\s*\{\s*requireTeacher\s*\}\s*from\s*"@\/lib\/auth\/require-teacher"/,
    );
    expect(src).toMatch(/const auth\s*=\s*await\s+requireTeacher\(request\)/);
    expect(src).toMatch(/if\s*\(auth\.error\)\s*return\s+auth\.error/);
  });

  it("403 when grade belongs to another teacher", () => {
    expect(src).toMatch(/klass\.teacher_id\s*!==\s*teacherId/);
    expect(src).toMatch(/status:\s*403/);
    expect(src).toMatch(/Forbidden/);
  });

  it("404 when grade row doesn't exist", () => {
    expect(src).toMatch(/Grade not found/);
    expect(src).toMatch(/status:\s*404/);
  });
});

describe("/api/teacher/grading/regenerate-draft — input validation", () => {
  it("400 missing grade_id", () => {
    expect(src).toMatch(/grade_id required/);
  });

  it("400 missing current_draft (nothing to tweak)", () => {
    expect(src).toMatch(/current_draft required \(nothing to tweak\)/);
  });

  it("400 when directive isn't one of the 4 valid values", () => {
    expect(src).toMatch(/VALID_DIRECTIVES:\s*RegenerateDirective\[\]/);
    expect(src).toMatch(
      /"shorter"[\s\S]*?"warmer"[\s\S]*?"sharper"[\s\S]*?"ask"/,
    );
    expect(src).toMatch(/directive must be one of/);
  });

  it("400 when directive === 'ask' but ask_text is empty", () => {
    expect(src).toMatch(/ask_text required when directive === 'ask'/);
  });
});

describe("/api/teacher/grading/regenerate-draft — PII round-trip", () => {
  it("loads student display_name AFTER the auth check (never reaches Haiku)", () => {
    expect(src).toMatch(/\.from\("students"\)/);
    expect(src).toMatch(/display_name/);
  });

  it("imports STUDENT_NAME_PLACEHOLDER + restoreStudentName from the placeholder primitive", () => {
    expect(src).toMatch(
      /import\s*\{[\s\S]*?STUDENT_NAME_PLACEHOLDER[\s\S]*?restoreStudentName[\s\S]*?\}\s*from\s*"@\/lib\/security\/student-name-placeholder"/,
    );
  });

  it("swaps real-name → placeholder on the inbound currentDraft (regex global, case-insensitive)", () => {
    expect(src).toMatch(/\.replace\(\s*new RegExp\(escapedName,\s*"gi"\)/);
  });

  it("escapes regex specials in the real name (e.g. 'O'Brien' style)", () => {
    expect(src).toMatch(
      /escapedName\s*=\s*realName\.replace\(\/\[\.\*\+\?\^\$\{\}\(\)\|\[\\\]\\\\\]\/g/,
    );
  });

  it("restoreStudentName on the response body before returning", () => {
    expect(src).toMatch(/restoreStudentName\(result\.draftBody,\s*realName\)/);
  });

  it("does NOT push the real name into the RegenerateDraftInput", () => {
    const inputBlock =
      src.match(/const input:\s*RegenerateDraftInput\s*=\s*\{[\s\S]*?\};/)?.[0] ??
      "";
    expect(inputBlock).not.toMatch(/displayName/);
    expect(inputBlock).not.toMatch(/studentName/);
    expect(inputBlock).not.toMatch(/realName/);
  });
});

describe("/api/teacher/grading/regenerate-draft — response shape", () => {
  it("returns draftBody + directive + modelVersion + promptVersion", () => {
    expect(src).toMatch(/draftBody,?/);
    expect(src).toMatch(/directive:\s*result\.directive/);
    expect(src).toMatch(/modelVersion:\s*result\.modelVersion/);
    expect(src).toMatch(/promptVersion:\s*result\.promptVersion/);
  });

  it("502 on Haiku/helper error", () => {
    expect(src).toMatch(/status:\s*502/);
    expect(src).toMatch(/Failed to regenerate draft/);
  });
});

describe("/api/teacher/grading/regenerate-draft — audit-skip annotation", () => {
  it("carries the audit-skip annotation (no DB mutation)", () => {
    expect(src).toMatch(/\/\/ audit-skip:/);
  });
});
