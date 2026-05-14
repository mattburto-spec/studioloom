/**
 * Class DJ — Phase 4 wiring guards (source-static).
 *
 * Verifies the lesson-player dispatch + role-aware tally disclosure
 * shape:
 *   - ResponseInput.tsx imports + mounts ClassDjBlock on responseType match
 *   - ResponseInput's classId prop exists (the lesson page must source it)
 *   - GET /state route gates tally fields behind teacher role
 *   - POST /vote route calls moderateAndLog on both veto AND seed
 *   - POST /launch route uses requireTeacher
 *
 * Source-static — mirrors lis-d-editor-wiring.test.ts convention.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const RESPONSE_INPUT_SRC = readFileSync(
  join(__dirname, "..", "..", "student", "ResponseInput.tsx"),
  "utf-8",
);

const STATE_ROUTE_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "app", "api", "student", "class-dj", "state", "route.ts"),
  "utf-8",
);

const VOTE_ROUTE_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "app", "api", "student", "class-dj", "vote", "route.ts"),
  "utf-8",
);

const LAUNCH_ROUTE_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "app", "api", "teacher", "class-dj", "launch", "route.ts"),
  "utf-8",
);

const BLOCK_SRC = readFileSync(
  join(__dirname, "..", "ClassDjBlock.tsx"),
  "utf-8",
);

const POLLING_SRC = readFileSync(
  join(__dirname, "..", "useClassDjPolling.ts"),
  "utf-8",
);

describe("ResponseInput — Class DJ dispatch (Phase 4)", () => {
  it("imports ClassDjBlock", () => {
    expect(RESPONSE_INPUT_SRC).toMatch(
      /import ClassDjBlock from "@\/components\/class-dj\/ClassDjBlock"/,
    );
  });

  it("declares classId? prop in interface", () => {
    expect(RESPONSE_INPUT_SRC).toMatch(/classId\?:\s*string/);
  });

  it("renders ClassDjBlock only when responseType === 'class-dj' AND all params present", () => {
    expect(RESPONSE_INPUT_SRC).toMatch(
      /responseType === "class-dj"[\s\S]{0,200}unitId[\s\S]{0,200}pageId[\s\S]{0,200}activityId[\s\S]{0,200}classId/,
    );
  });

  it("passes role='student' (teacher cockpit dispatch lands in Phase 6)", () => {
    expect(RESPONSE_INPUT_SRC).toMatch(/<ClassDjBlock[\s\S]{0,400}role="student"/);
  });
});

describe("GET /api/student/class-dj/state — role-aware tally disclosure", () => {
  it("uses requireTeacher AND getStudentSession (accepts either role)", () => {
    expect(STATE_ROUTE_SRC).toMatch(/import \{ getStudentSession \}/);
    expect(STATE_ROUTE_SRC).toMatch(/import \{ requireTeacher \}/);
  });

  it("tally field is ONLY set in the teacher branch", () => {
    // The string "tally" should appear inside the role === "teacher" branch.
    expect(STATE_ROUTE_SRC).toMatch(/if \(role === "teacher"\)[\s\S]{0,800}tally:/);
  });

  it("student return does NOT include tally", () => {
    // Anti-strategic-voting per brief §11 Q9. Source-static check that
    // the student-branch response doesn't construct a tally field.
    const studentBranchMatch = STATE_ROUTE_SRC.match(
      /\/\/ Student response[\s\S]{0,400}return NextResponse\.json\(base\);/,
    );
    expect(studentBranchMatch).not.toBeNull();
    expect(studentBranchMatch![0]).not.toMatch(/tally:/);
  });

  it("verifies student enrollment via class_students lookup", () => {
    expect(STATE_ROUTE_SRC).toMatch(/from\("class_students"\)/);
  });

  it("verifies teacher role via verifyTeacherInClass", () => {
    expect(STATE_ROUTE_SRC).toMatch(/verifyTeacherInClass/);
  });
});

describe("POST /api/student/class-dj/vote", () => {
  it("uses requireStudentSession (student auth)", () => {
    expect(VOTE_ROUTE_SRC).toMatch(/requireStudentSession/);
  });

  it("calls moderateAndLog on the veto string", () => {
    expect(VOTE_ROUTE_SRC).toMatch(
      /if \(sanitised\.veto\)[\s\S]{0,400}moderateAndLog/,
    );
  });

  it("calls moderateAndLog on the seed string", () => {
    expect(VOTE_ROUTE_SRC).toMatch(
      /if \(sanitised\.seed\)[\s\S]{0,400}moderateAndLog/,
    );
  });

  it("runs Stage 0 sanitisation before storage (Lesson #67 prompt-injection defence)", () => {
    expect(VOTE_ROUTE_SRC).toMatch(/import \{ sanitiseInput \} from "@\/lib\/class-dj\/algorithm"/);
    expect(VOTE_ROUTE_SRC).toMatch(/sanitiseInput\(\{/);
  });

  it("rejects votes on closed rounds (409)", () => {
    expect(VOTE_ROUTE_SRC).toMatch(/closed_at !== null[\s\S]{0,200}409/);
  });

  it("rejects votes after timer expiry (409)", () => {
    expect(VOTE_ROUTE_SRC).toMatch(/ends_at[\s\S]{0,400}409/);
  });

  it("upserts student_tool_sessions on (student_id, unit_id, page_id, tool_id, version)", () => {
    expect(VOTE_ROUTE_SRC).toMatch(
      /onConflict:\s*"student_id,unit_id,page_id,tool_id,version"/,
    );
  });

  it("verifies enrollment via class_students lookup", () => {
    expect(VOTE_ROUTE_SRC).toMatch(/from\("class_students"\)/);
  });
});

describe("POST /api/teacher/class-dj/launch", () => {
  it("uses requireTeacher (CLAUDE.md hard rule for /api/teacher/*)", () => {
    expect(LAUNCH_ROUTE_SRC).toMatch(/requireTeacher\(request\)/);
  });

  it("handles UNIQUE-violation race (23505) by returning existing round", () => {
    expect(LAUNCH_ROUTE_SRC).toMatch(/code === "23505"[\s\S]{0,400}reused:\s*true/);
  });

  it("checks for existing open round BEFORE inserting (idempotent launch)", () => {
    expect(LAUNCH_ROUTE_SRC).toMatch(
      /existing[\s\S]{0,400}is\("closed_at",\s*null\)[\s\S]{0,200}maybeSingle/,
    );
  });

  it("mints class_round_index as COALESCE(MAX, 0) + 1", () => {
    expect(LAUNCH_ROUTE_SRC).toMatch(
      /\(maxRow\?\.class_round_index \?\? 0\) \+ 1/,
    );
  });

  it("started_by carries the 'teacher:<id>' identity prefix", () => {
    expect(LAUNCH_ROUTE_SRC).toMatch(/started_by:\s*`teacher:\$\{teacherId\}`/);
  });

  it("clamps durationSeconds to [30, 180] per brief", () => {
    expect(LAUNCH_ROUTE_SRC).toMatch(/MIN_DURATION\s*=\s*30/);
    expect(LAUNCH_ROUTE_SRC).toMatch(/MAX_DURATION\s*=\s*180/);
  });
});

describe("ClassDjBlock — top-level dispatch (Phase 4)", () => {
  it("uses useClassDjPolling hook for state", () => {
    expect(BLOCK_SRC).toMatch(/useClassDjPolling\(role,/);
  });

  it("renders ClassDjArmedView when status === 'armed'", () => {
    expect(BLOCK_SRC).toMatch(
      /state\.status === "armed"[\s\S]{0,200}<ClassDjArmedView/,
    );
  });

  it("renders ClassDjLiveTeacherView when role==='teacher' AND tally present", () => {
    expect(BLOCK_SRC).toMatch(
      /role === "teacher" && state\.tally[\s\S]{0,200}<ClassDjLiveTeacherView/,
    );
  });

  it("renders ClassDjLiveStudentView (default LIVE branch — no tally)", () => {
    expect(BLOCK_SRC).toMatch(/<ClassDjLiveStudentView/);
  });
});

describe("useClassDjPolling — polling discipline (brief §4)", () => {
  it("declares CADENCE_MS with student=2000, teacher=1000", () => {
    expect(POLLING_SRC).toMatch(/student:\s*2000/);
    expect(POLLING_SRC).toMatch(/teacher:\s*1000/);
  });

  it("declares HARD_CAP_MS = 5 minutes", () => {
    expect(POLLING_SRC).toMatch(/HARD_CAP_MS\s*=\s*5 \* 60 \* 1000/);
  });

  it("checks document.visibilityState === 'hidden' before fetching", () => {
    expect(POLLING_SRC).toMatch(/document\.visibilityState === "hidden"/);
  });

  it("stops polling once status === 'closed'", () => {
    expect(POLLING_SRC).toMatch(/state\?\.status === "closed"[\s\S]{0,200}setStopped\(true\)/);
  });

  it("listens for visibilitychange events to wake on tab focus", () => {
    expect(POLLING_SRC).toMatch(/addEventListener\("visibilitychange"/);
    expect(POLLING_SRC).toMatch(/removeEventListener\("visibilitychange"/);
  });
});
