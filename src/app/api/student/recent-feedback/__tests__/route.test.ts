/**
 * GET /api/student/recent-feedback — source-static guards.
 *
 * The bell-feeder. Surfaces teacher feedback received in the last
 * 14 days on the student dashboard. Tests pin the contracts that
 * TFL.2 Pass B (B.4) and TFL.1 read receipts rely on:
 *
 *   - Auth gate is requireStudentSession (student session token).
 *   - Filters by `updated_at >= since` (the column the existing
 *     BEFORE-UPDATE trigger bumps on every write to
 *     `student_facing_comment`). This is load-bearing for B.4: when
 *     the teacher sends a FOLLOW-UP turn (latest=student → trigger
 *     INSERTs new teacher turn), the parent UPDATE on
 *     student_tile_grades also bumps `updated_at`, so the bell
 *     surfaces the new turn without any extra logic.
 *   - Reads `student_facing_comment` (the denormalized cache of
 *     the latest teacher turn body, kept in sync by B.1's sync
 *     trigger and B.4's INSERT-on-student-latest variant). This
 *     is why the bell works correctly with multi-turn threads
 *     without needing to query tile_feedback_turns directly.
 *   - Does NOT filter by tile_feedback_turns.role — a regression
 *     here would break the bell for follow-up turns because the
 *     route would either miss them entirely or double-count.
 *   - 14-day window preserved.
 *   - Caps result groups at 10.
 *
 * Lesson #71: route handlers aren't run under vitest in this repo's
 * config — assert pattern + ordering against the source string.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/student/recent-feedback — module hygiene", () => {
  it("uses requireStudentSession for auth", () => {
    expect(src).toContain('from "@/lib/access-v2/actor-session"');
    expect(src).toContain("requireStudentSession");
  });

  it("uses createAdminClient (service-role) for DB access", () => {
    expect(src).toContain("createAdminClient");
  });

  it("auth gate runs before any DB call", () => {
    const authGateAt = src.indexOf("requireStudentSession");
    const firstDbCall = src.indexOf(".from(");
    expect(authGateAt).toBeGreaterThan(-1);
    expect(firstDbCall).toBeGreaterThan(-1);
    expect(authGateAt).toBeLessThan(firstDbCall);
  });
});

describe("/api/student/recent-feedback — TFL.2 Pass B regression guards (B.4 follow-ups)", () => {
  it("queries student_tile_grades (NOT tile_feedback_turns directly)", () => {
    // The bell relies on `student_facing_comment` as the denormalized
    // cache of the latest teacher turn body. Querying
    // tile_feedback_turns directly would either:
    //   (a) need a JOIN + role filter that breaks for multi-turn
    //   (b) double-count when a thread has multiple teacher turns
    // Pinning the existing pattern keeps the bell consistent with
    // B.1 + B.4's denormalization contract.
    expect(src).toMatch(/\.from\("student_tile_grades"\)/);
    // Strip comments so doc references to the new table don't trip
    // the negative assertion.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/\.from\("tile_feedback_turns"\)/);
  });

  it("filters by `updated_at >= since` — the column the BEFORE-UPDATE trigger bumps on follow-ups", () => {
    // Load-bearing for B.4: when teacher writes a follow-up the
    // sync trigger INSERTs a new teacher turn AND the parent UPDATE
    // bumps student_tile_grades.updated_at. The bell sees the
    // bumped updated_at and surfaces the row.
    expect(src).toMatch(/\.gte\("updated_at",\s*since\)/);
  });

  it("reads `student_facing_comment` from the row (the denormalized cache, kept in sync by B.4 trigger)", () => {
    expect(src).toMatch(/student_facing_comment/);
    // Filter to non-null comments only — empty rows shouldn't
    // surface in the bell.
    expect(src).toMatch(/\.not\("student_facing_comment",\s*"is",\s*null\)/);
  });

  it("does NOT filter by tile_feedback_turns.role (would break follow-ups)", () => {
    // Regression guard: a future "let me query the turns table for
    // accuracy" edit must not add a .eq("role", "teacher") that
    // could miss rows where the latest teacher turn isn't yet
    // backfilled or where the trigger is mid-fire.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/\.eq\("role"/);
  });
});

describe("/api/student/recent-feedback — window + cap", () => {
  it("uses a 14-day lookback window (FOURTEEN_DAYS_MS = 14 days)", () => {
    expect(src).toMatch(/FOURTEEN_DAYS_MS\s*=\s*14\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  });

  it("caps grouped results at 10 (MAX_GROUPS)", () => {
    expect(src).toMatch(/MAX_GROUPS\s*=\s*10/);
    expect(src).toMatch(/\.slice\(0,\s*MAX_GROUPS\)/);
  });

  it("groups results by (unit_id, page_id) — one bell row per lesson, not per tile", () => {
    expect(src).toMatch(/`\$\{r\.unit_id\}::\$\{r\.page_id\}`/);
  });

  it("sorts groups newest-first by latest_at", () => {
    expect(src).toMatch(/\.sort\([\s\S]*?b\.latest_at\.localeCompare\(a\.latest_at\)/);
  });
});
