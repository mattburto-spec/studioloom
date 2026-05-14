/**
 * Class DJ — student classId resolution wiring guards.
 *
 * The student lesson page needs to know which class context the
 * student is currently in for a given unit — Class DJ + future live
 * blocks scope their state per (class, unit, page, activityId).
 *
 * This route is the resolver: GET /api/student/class-for-unit/[unitId]
 * returns { classId } from the student's active enrollments.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROUTE_SRC = readFileSync(
  join(__dirname, "..", "route.ts"),
  "utf-8",
);
const LESSON_PAGE_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "(student)",
    "unit",
    "[unitId]",
    "[pageId]",
    "page.tsx",
  ),
  "utf-8",
);
const ACTIVITY_CARD_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "..",
    "components",
    "student",
    "ActivityCard.tsx",
  ),
  "utf-8",
);

describe("GET /api/student/class-for-unit/[unitId]", () => {
  it("requires student session", () => {
    expect(ROUTE_SRC).toMatch(/requireStudentSession/);
  });

  it("joins class_students with class_units filtered by unit_id + is_active", () => {
    expect(ROUTE_SRC).toMatch(/from\("class_students"\)/);
    expect(ROUTE_SRC).toMatch(/class_units!inner/);
    expect(ROUTE_SRC).toMatch(/\.eq\("class_units\.unit_id", unitId\)/);
    expect(ROUTE_SRC).toMatch(/\.eq\("class_units\.is_active", true\)/);
  });

  it("returns classId: null with a reason field (not 4xx) when no match", () => {
    expect(ROUTE_SRC).toMatch(/classId:\s*null/);
    expect(ROUTE_SRC).toMatch(/reason:\s*"unit_not_in_any_class"/);
  });
});

describe("Student lesson page — classId fetch + plumbing", () => {
  it("fetches /api/student/class-for-unit/{unitId} on mount", () => {
    expect(LESSON_PAGE_SRC).toMatch(
      /\/api\/student\/class-for-unit\/\$\{unitId\}/,
    );
  });

  it("stores classId in state + passes to ActivityCard via classId prop", () => {
    expect(LESSON_PAGE_SRC).toMatch(/setClassId/);
    expect(LESSON_PAGE_SRC).toMatch(/classId=\{classId \?\? undefined\}/);
  });
});

describe("ActivityCard — accepts classId + forwards to ResponseInput", () => {
  it("declares classId? prop on ActivityCardProps", () => {
    expect(ACTIVITY_CARD_SRC).toMatch(/classId\?:\s*string/);
  });

  it("destructures classId from props and forwards to ResponseInput", () => {
    expect(ACTIVITY_CARD_SRC).toMatch(/<ResponseInput[\s\S]{0,1500}classId=\{classId\}/);
  });
});
