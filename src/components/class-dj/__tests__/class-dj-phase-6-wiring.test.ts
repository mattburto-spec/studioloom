/**
 * Class DJ — Phase 6 source-static wiring guards.
 *
 * Covers the teacher controls / cockpit dispatch / constraints panel.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const TEACH_PAGE_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "app", "teacher", "teach", "[unitId]", "page.tsx"),
  "utf-8",
);

const CONTROLS_SRC = readFileSync(
  join(__dirname, "..", "ClassDjTeacherControls.tsx"),
  "utf-8",
);

const CONSTRAINTS_PAGE_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "app", "teacher", "classes", "[classId]", "dj-constraints", "page.tsx"),
  "utf-8",
);

const PICK_ROUTE_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "app", "api", "teacher", "class-dj", "[roundId]", "pick", "route.ts"),
  "utf-8",
);

const CLOSE_ROUTE_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "app", "api", "teacher", "class-dj", "[roundId]", "close", "route.ts"),
  "utf-8",
);

const REGEN_ROUTE_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "app", "api", "teacher", "class-dj", "[roundId]", "regenerate-narration", "route.ts"),
  "utf-8",
);

const CONSTRAINTS_GET_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "app", "api", "teacher", "class-dj", "constraints", "[classId]", "route.ts"),
  "utf-8",
);

const EXPIRE_VETO_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "app", "api", "teacher", "class-dj", "constraints", "[classId]", "expire-veto", "route.ts"),
  "utf-8",
);

const RESET_LEDGER_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "app", "api", "teacher", "class-dj", "constraints", "[classId]", "reset-ledger", "route.ts"),
  "utf-8",
);

describe("Teaching Mode cockpit — Class DJ per-section dispatch (Phase 6 §D)", () => {
  it("imports ClassDjTeacherControls", () => {
    expect(TEACH_PAGE_SRC).toMatch(
      /import ClassDjTeacherControls from "@\/components\/class-dj\/ClassDjTeacherControls"/,
    );
  });

  it("renders ClassDjTeacherControls when section.responseType === 'class-dj' AND classId+activityId+pageId all present", () => {
    expect(TEACH_PAGE_SRC).toMatch(
      /section\.responseType === "class-dj"[\s\S]{0,400}<ClassDjTeacherControls/,
    );
  });

  it("plumbs config from section.classDjConfig", () => {
    expect(TEACH_PAGE_SRC).toMatch(/config=\{section\.classDjConfig\}/);
  });
});

describe("ClassDjTeacherControls — action wiring", () => {
  it("uses 'teacher' role for polling (1s cadence)", () => {
    expect(CONTROLS_SRC).toMatch(/useClassDjPolling\("teacher",/);
  });

  it("POSTs to /api/teacher/class-dj/launch with durationSeconds", () => {
    expect(CONTROLS_SRC).toMatch(
      /\/api\/teacher\/class-dj\/launch[\s\S]{0,300}durationSeconds/,
    );
  });

  it("POSTs to /api/teacher/class-dj/[roundId]/close", () => {
    expect(CONTROLS_SRC).toMatch(/\$\{roundId\}\/close/);
  });

  it("POSTs to /api/teacher/class-dj/[roundId]/pick with suggestionIndex", () => {
    expect(CONTROLS_SRC).toMatch(/\$\{roundId\}\/pick/);
    expect(CONTROLS_SRC).toMatch(/suggestionIndex:\s*index/);
  });

  it("POSTs to /api/teacher/class-dj/[roundId]/regenerate-narration", () => {
    expect(CONTROLS_SRC).toMatch(/\$\{roundId\}\/regenerate-narration/);
  });

  it("Suggest button uses gateMinVotes from config (fallback 3)", () => {
    expect(CONTROLS_SRC).toMatch(/config\?\.gateMinVotes \?\? 3/);
  });
});

describe("POST /api/teacher/class-dj/[roundId]/pick — Phase 6", () => {
  it("uses requireTeacher", () => {
    expect(PICK_ROUTE_SRC).toMatch(/requireTeacher\(request\)/);
  });

  it("validates suggestionIndex ∈ {0,1,2}", () => {
    expect(PICK_ROUTE_SRC).toMatch(/\[0, 1, 2\]\.includes\(body\.suggestionIndex\)/);
  });

  it("verifies teacher role via has_class_role rpc", () => {
    expect(PICK_ROUTE_SRC).toMatch(/has_class_role/);
  });

  it("calls updateFairnessLedger from algorithm.ts (§3.6 EMA)", () => {
    expect(PICK_ROUTE_SRC).toMatch(/import.*updateFairnessLedger/);
    expect(PICK_ROUTE_SRC).toMatch(/updateFairnessLedger\(/);
  });

  it("upserts only voters' ledger rows (not non-voting students)", () => {
    expect(PICK_ROUTE_SRC).toMatch(/voterIds\.has\(e\.studentId\)/);
  });

  it("closes the round when pick lands", () => {
    expect(PICK_ROUTE_SRC).toMatch(/closed_at:\s*new Date\(\)\.toISOString\(\)/);
  });
});

describe("POST /api/teacher/class-dj/[roundId]/close — idempotent", () => {
  it("uses requireTeacher + has_class_role", () => {
    expect(CLOSE_ROUTE_SRC).toMatch(/requireTeacher\(request\)/);
    expect(CLOSE_ROUTE_SRC).toMatch(/has_class_role/);
  });

  it("returns {already_closed:true} if round already closed (idempotent)", () => {
    expect(CLOSE_ROUTE_SRC).toMatch(/round\.closed_at !== null[\s\S]{0,200}already_closed:\s*true/);
  });
});

describe("POST /api/teacher/class-dj/[roundId]/regenerate-narration", () => {
  it("uses requireTeacher + has_class_role", () => {
    expect(REGEN_ROUTE_SRC).toMatch(/requireTeacher\(request\)/);
    expect(REGEN_ROUTE_SRC).toMatch(/has_class_role/);
  });

  it("calls Stage 5 only (picks unchanged)", () => {
    expect(REGEN_ROUTE_SRC).toMatch(/callStage5Narrate/);
    // Should NOT call Stage 3 or full pipeline.
    expect(REGEN_ROUTE_SRC).not.toMatch(/callStage3Candidates/);
  });

  it("uses fallbackWhyLines on Stage 5 failure", () => {
    expect(REGEN_ROUTE_SRC).toMatch(/fallbackWhyLines/);
  });

  it("parses teacherId from round.started_by", () => {
    expect(REGEN_ROUTE_SRC).toMatch(/parseTeacherId\(round\.started_by\)/);
  });
});

describe("GET /api/teacher/class-dj/constraints/[classId]", () => {
  it("uses requireTeacher + has_class_role", () => {
    expect(CONSTRAINTS_GET_SRC).toMatch(/requireTeacher\(request\)/);
    expect(CONSTRAINTS_GET_SRC).toMatch(/has_class_role/);
  });

  it("filters by 30-day window", () => {
    expect(CONSTRAINTS_GET_SRC).toMatch(/30 \* 24 \* 60 \* 60 \* 1000/);
  });

  it("filters out teacher-expired vetoes via class_dj_veto_overrides", () => {
    expect(CONSTRAINTS_GET_SRC).toMatch(/class_dj_veto_overrides/);
    expect(CONSTRAINTS_GET_SRC).toMatch(/overrideSet\.has/);
  });

  it("counts unserved students (servedScore < 0.4)", () => {
    expect(CONSTRAINTS_GET_SRC).toMatch(/served_score < 0\.4/);
  });

  it("returns last_reset row for the audit timeline", () => {
    expect(CONSTRAINTS_GET_SRC).toMatch(/class_dj_ledger_resets/);
  });
});

describe("POST /api/teacher/class-dj/constraints/[classId]/expire-veto", () => {
  it("uses requireTeacher + has_class_role", () => {
    expect(EXPIRE_VETO_SRC).toMatch(/requireTeacher\(request\)/);
    expect(EXPIRE_VETO_SRC).toMatch(/has_class_role/);
  });

  it("normalises veto_text (lower-trim, 80 char cap)", () => {
    expect(EXPIRE_VETO_SRC).toMatch(/toLowerCase\(\)\.trim\(\)\.slice\(0, 80\)/);
  });

  it("handles 23505 unique-violation as idempotent already_overridden:true", () => {
    expect(EXPIRE_VETO_SRC).toMatch(/code === "23505"[\s\S]{0,200}already_overridden:\s*true/);
  });

  it("records expired_by as 'teacher:<id>'", () => {
    expect(EXPIRE_VETO_SRC).toMatch(/expired_by:\s*`teacher:\$\{teacherId\}`/);
  });
});

describe("POST /api/teacher/class-dj/constraints/[classId]/reset-ledger", () => {
  it("uses requireTeacher + has_class_role", () => {
    expect(RESET_LEDGER_SRC).toMatch(/requireTeacher\(request\)/);
    expect(RESET_LEDGER_SRC).toMatch(/has_class_role/);
  });

  it("logs reset to class_dj_ledger_resets audit table", () => {
    expect(RESET_LEDGER_SRC).toMatch(/class_dj_ledger_resets/);
    expect(RESET_LEDGER_SRC).toMatch(/rounds_since_last_reset/);
  });

  it("computes rounds_since_last_reset from prior reset_at OR epoch", () => {
    expect(RESET_LEDGER_SRC).toMatch(/lastReset\?\.reset_at/);
    expect(RESET_LEDGER_SRC).toMatch(/1970-01-01T00:00:00Z/);
  });

  it("logs warning if audit insert fails but reset succeeded (non-fatal)", () => {
    expect(RESET_LEDGER_SRC).toMatch(/audit log insert failed/);
  });

  it("deletes ledger rows by class_id", () => {
    expect(RESET_LEDGER_SRC).toMatch(
      /from\("class_dj_fairness_ledger"\)\s*\n?\s*\.delete\(\)\s*\n?\s*\.eq\("class_id", classId\)/,
    );
  });
});

describe("/teacher/classes/[classId]/dj-constraints — UI page", () => {
  it("fetches /api/teacher/class-dj/constraints/[classId] on mount", () => {
    expect(CONSTRAINTS_PAGE_SRC).toMatch(
      /\/api\/teacher\/class-dj\/constraints\/\$\{classId\}/,
    );
  });

  it("renders persistent_vetoes with occurrences + last-seen", () => {
    expect(CONSTRAINTS_PAGE_SRC).toMatch(/persistent_vetoes/);
    expect(CONSTRAINTS_PAGE_SRC).toMatch(/occurrences/);
    expect(CONSTRAINTS_PAGE_SRC).toMatch(/last_seen/);
  });

  it("expire-veto button POSTs to the route", () => {
    expect(CONSTRAINTS_PAGE_SRC).toMatch(/expire-veto/);
  });

  it("reset-ledger requires confirm step (anti-misclick)", () => {
    expect(CONSTRAINTS_PAGE_SRC).toMatch(/resetConfirm/);
    expect(CONSTRAINTS_PAGE_SRC).toMatch(/Confirm reset/);
  });

  it("links back to /teacher/classes/[classId]", () => {
    expect(CONSTRAINTS_PAGE_SRC).toMatch(/href=\{`\/teacher\/classes\/\$\{classId\}`\}/);
  });
});
