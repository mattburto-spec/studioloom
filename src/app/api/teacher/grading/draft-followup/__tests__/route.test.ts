/**
 * TFL.3 C.3 — POST /api/teacher/grading/draft-followup source-static
 * guards.
 *
 * Pins:
 *   - requireTeacher gate (security-overview.md hard rule)
 *   - Ownership check (grade.class.teacher_id === auth.teacherId)
 *     prevents drafting follow-ups against another teacher's thread
 *   - Loads turn history, original teacher body, student response,
 *     tile prompt + criterion before calling the helper
 *   - Calls generateAiFollowup with the right shape
 *   - PII restore via restoreStudentName on the response body
 *   - Sentinel pass-through (NO_FOLLOWUP_SENTINEL skips restore)
 *   - Returns the 4-field draftBody / promptVariant / modelVersion /
 *     promptVersion shape the inbox expects
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/teacher/grading/draft-followup — auth + ownership", () => {
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
});

describe("/api/teacher/grading/draft-followup — pre-call guards", () => {
  it("400 when grade_id is missing from body", () => {
    expect(src).toMatch(/grade_id required/);
  });

  it("400 when latest turn is NOT a student reply (inbox bug surfaces)", () => {
    expect(src).toMatch(/Latest turn is not a student reply/);
  });
});

describe("/api/teacher/grading/draft-followup — context loading", () => {
  it("loads thread turns ordered DESC to pick latest student + latest teacher", () => {
    expect(src).toMatch(/\.from\("tile_feedback_turns"\)/);
    expect(src).toMatch(/\.eq\("grade_id",\s*gradeId\)/);
    expect(src).toMatch(/\.order\("sent_at",\s*\{\s*ascending:\s*false\s*\}\)/);
  });

  it("strips <p>...</p> wrapper from B.1's backfilled teacher body before passing to the helper", () => {
    // The B.1 backfill + sync trigger wrap plain text in <p>...</p>.
    // The follow-up prompt wants plain text reasoning, not HTML.
    expect(src).toMatch(
      /\.replace\(\/\^<p>\/,\s*""\)\.replace\(\/<\\\/p>\$\/,\s*""\)/,
    );
  });

  it("loads the student's response text from student_progress.responses[tile_id]", () => {
    expect(src).toMatch(/\.from\("student_progress"\)/);
    expect(src).toMatch(/responses\[grade\.tile_id\]/);
  });

  it("loads the tile prompt + criterion from class_units + extractTilesFromPage (resolve overrides)", () => {
    expect(src).toMatch(/resolveClassUnitContent/);
    expect(src).toMatch(/extractTilesFromPage/);
  });
});

describe("/api/teacher/grading/draft-followup — PII restore", () => {
  it("loads student display_name AFTER the auth check (never reaches Haiku)", () => {
    expect(src).toMatch(/\.from\("students"\)/);
    expect(src).toMatch(/display_name/);
    // Student name lookup happens BEFORE the Haiku call but is only
    // used POST-response via restoreStudentName.
    expect(src).toMatch(
      /import\s*\{\s*restoreStudentName\s*\}\s*from\s*"@\/lib\/security\/student-name-placeholder"/,
    );
    expect(src).toMatch(/restoreStudentName\(result\.draftBody,\s*realName\)/);
  });

  it("does NOT push the real name into the AiFollowupInput", () => {
    // The helper's input shape forbids a name field. The route
    // assembles input without studentName/displayName/etc.
    const inputBlock =
      src.match(/const input:\s*AiFollowupInput\s*=\s*\{[\s\S]*?\};/)?.[0] ??
      "";
    expect(inputBlock).not.toMatch(/displayName/);
    expect(inputBlock).not.toMatch(/studentName/);
    expect(inputBlock).not.toMatch(/realName/);
  });

  it("NO_FOLLOWUP_SENTINEL bypasses restoreStudentName (sentinel pass-through)", () => {
    expect(src).toMatch(
      /result\.draftBody\s*===\s*NO_FOLLOWUP_SENTINEL[\s\S]*?\?\s*NO_FOLLOWUP_SENTINEL/,
    );
  });
});

describe("/api/teacher/grading/draft-followup — response shape", () => {
  it("returns draftBody + promptVariant + modelVersion + promptVersion", () => {
    expect(src).toMatch(/draftBody/);
    expect(src).toMatch(/promptVariant:\s*result\.promptVariant/);
    expect(src).toMatch(/modelVersion:\s*result\.modelVersion/);
    expect(src).toMatch(/promptVersion:\s*result\.promptVersion/);
  });

  it("502 on Haiku/helper error (matches Lesson #39 routing convention)", () => {
    expect(src).toMatch(/status:\s*502/);
    expect(src).toMatch(/Failed to draft follow-up/);
  });
});
