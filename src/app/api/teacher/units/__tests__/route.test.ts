/**
 * Source-static guard for /api/teacher/units POST create case.
 *
 * Migration 20260428222049_phase_0_8b tightened units.school_id to NOT NULL on
 * prod (29 Apr 2026). The create-case insert payload didn't include school_id
 * and silently 500'd when teachers tried to create / import units.
 *
 * This test asserts the fix is still in place: the route reads
 * teachers.school_id at the top of the create case, guards the orphan-teacher
 * branch, and includes school_id in the insertPayload literal.
 *
 * Scope: create case ONLY. Fork case + 12 sister-table writers (classes,
 * students) intentionally not fixed here — see
 * docs/projects/units-school-id-investigation-29-apr.md and the access-v2
 * Phase 1 §4.0 fold-in proposal for the broader audit.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "route.ts"),
  "utf-8"
);

describe("/api/teacher/units POST create case — school_id hotfix", () => {
  it("looks up teachers.school_id before building the insert payload", () => {
    const lookupIdx = src.indexOf('.from("teachers")');
    const insertPayloadIdx = src.indexOf("const insertPayload");
    expect(lookupIdx).toBeGreaterThan(0);
    expect(insertPayloadIdx).toBeGreaterThan(lookupIdx);
  });

  it("selects school_id from the teachers row", () => {
    expect(src).toMatch(/\.from\("teachers"\)\s*\.select\("school_id"\)/);
  });

  it("returns 500 when the authed teacher has no school_id", () => {
    expect(src).toContain("Teacher missing school context");
  });

  it("includes school_id in the create-case insertPayload", () => {
    const insertPayloadIdx = src.indexOf("const insertPayload");
    const closingBrace = src.indexOf("};", insertPayloadIdx);
    const payloadLiteral = src.slice(insertPayloadIdx, closingBrace);
    expect(payloadLiteral).toContain("school_id: teacherRow.school_id");
    expect(payloadLiteral).toContain("author_teacher_id: teacherId");
    expect(payloadLiteral).toContain("teacher_id: teacherId");
  });

  it("flags the post-Phase-1 cleanup site so it isn't forgotten", () => {
    expect(src).toContain("TODO(access-v2 §4.0)");
  });
});
