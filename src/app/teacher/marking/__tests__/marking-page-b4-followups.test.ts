/**
 * TFL.2 Pass B sub-phase B.4 — source-static guards for the marking
 * page's follow-up surfaces.
 *
 * B.4 ships two front-end pieces alongside the trigger migration:
 *   1. Cohort student-turn loader — single batched query against
 *      tile_feedback_turns, derived into two maps
 *      (latestStudentReplyByGradeId + latestTurnRoleByGradeId).
 *   2. Row chip sentiment pill + override panel inline reply +
 *      composer label flip ("Edit feedback" → "Send follow-up").
 *   3. saveTile refetches the per-grade turn maps so the composer
 *      flips back to "Edit feedback" after the teacher sends a
 *      follow-up.
 *
 * Lesson #71: the marking page is too dynamic for unit-test render.
 * Pin shape contracts via source-static asserts; smoke covers the
 * visual.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("marking page B.4 — cohort student-turn loader", () => {
  it("declares both maps as state on the marking page", () => {
    expect(src).toMatch(
      /const \[latestStudentReplyByGradeId,\s*setLatestStudentReplyByGradeId\]\s*=\s*useState/,
    );
    expect(src).toMatch(
      /const \[latestTurnRoleByGradeId,\s*setLatestTurnRoleByGradeId\]\s*=\s*useState/,
    );
  });

  it("StudentReplySummary interface pinned (id, sentiment, reply_text, sent_at)", () => {
    expect(src).toMatch(/interface StudentReplySummary/);
    expect(src).toMatch(
      /sentiment:\s*"got_it"\s*\|\s*"not_sure"\s*\|\s*"pushback"/,
    );
    expect(src).toMatch(/reply_text:\s*string\s*\|\s*null/);
  });

  it("loadAll fires a SINGLE tile_feedback_turns batched query for the whole cohort", () => {
    // Drift guard: a future "optimize" edit that splits this into
    // per-grade fetches would N+1 the load. Pin the .in("grade_id", ...)
    // pattern.
    expect(src).toMatch(
      /\.from\("tile_feedback_turns"\)[\s\S]*?\.in\("grade_id",\s*gradeIdsForTurns\)/,
    );
    expect(src).toMatch(
      /\.order\("sent_at",\s*\{\s*ascending:\s*false\s*\}\)/,
    );
  });

  it("derives latestTurnRoleByGradeId by taking the FIRST row per grade in DESC order", () => {
    // DESC order means the first row encountered per grade IS the
    // latest. Pinning the "first match wins" pattern guards against
    // a refactor that accidentally takes the LAST row.
    expect(src).toMatch(
      /if\s*\(!latestRoleMap\[t\.grade_id\]\)\s*\{[\s\S]*?latestRoleMap\[t\.grade_id\]\s*=\s*t\.role/,
    );
  });

  it("derives latestStudentReplyByGradeId by taking the FIRST student row per grade", () => {
    expect(src).toMatch(
      /t\.role\s*===\s*"student"\s*&&[\s\S]*?!studentReplyMap\[t\.grade_id\]/,
    );
  });
});

describe("marking page B.4 — row chip sentiment pill", () => {
  it("renders a sentiment pill with data-testid + data-sentiment attrs", () => {
    expect(src).toContain('data-testid="row-chip-sentiment-pill"');
    expect(src).toMatch(/data-sentiment=\{reply\.sentiment\}/);
  });

  it("pill only renders when latest turn is student (hides after teacher follow-up)", () => {
    // Without this gate the pill would persist after the teacher
    // replied, reading as "still unanswered". Pin the predicate.
    // Post-row-overflow fix (11 May 2026): returns an empty <span />
    // placeholder rather than null so the grid's 8-column layout
    // keeps the chevron in its own column.
    expect(src).toMatch(
      /const latestRole\s*=\s*latestTurnRoleByGradeId\[grade!\.id\]/,
    );
    expect(src).toMatch(
      /if\s*\(latestRole\s*!==\s*"student"\)\s*[\s\S]{0,40}?return\s*<span\s+aria-hidden=/,
    );
  });

  it("row uses 8-column grid (was 7 pre-B.4) so the sentiment pill has a slot and chevron stays put", () => {
    expect(src).toMatch(
      /grid-cols-\[auto_1fr_auto_auto_auto_auto_auto_auto\]/,
    );
  });

  it("returns an empty span placeholder when no reply (keeps grid alignment)", () => {
    // The IIFE returns <span aria-hidden /> for two cases: no reply
    // at all, AND reply exists but teacher already followed up.
    // Both branches need a node (not null) so the grid sees a child
    // in the sentiment-pill column.
    const codeBlock = src.slice(
      src.indexOf("row-chip-sentiment-pill") - 2000,
      src.indexOf("row-chip-sentiment-pill") + 200,
    );
    // At least TWO empty-placeholder returns (no-reply + teacher-latest).
    const placeholderCount = (codeBlock.match(
      /return\s*<span\s+aria-hidden="true"\s*\/>/g,
    ) ?? []).length;
    expect(placeholderCount).toBeGreaterThanOrEqual(2);
  });

  it("uses three colour tones (emerald/amber/purple) matching the bubble's quick-reply pills", () => {
    // Consistency with the student-facing TeacherFeedback component.
    // Drift here would mean teacher + student see different tones for
    // the same sentiment.
    const pillBlock = src.match(
      /data-testid="row-chip-sentiment-pill"[\s\S]*?<\/span>/,
    )?.[0] ?? src;
    const matchedBlock = src.slice(
      src.indexOf("row-chip-sentiment-pill") - 1500,
      src.indexOf("row-chip-sentiment-pill") + 800,
    );
    expect(matchedBlock).toMatch(/bg-emerald-50.*border-emerald-300/);
    expect(matchedBlock).toMatch(/bg-amber-50.*border-amber-300/);
    expect(matchedBlock).toMatch(/bg-purple-50.*border-purple-300/);
  });

  it("'I disagree' label appears as the pushback fallback (Matt's locked label)", () => {
    // The cascade: got_it → "Got it" / not_sure → "Not sure" /
    // ELSE → "I disagree". Pushback gets the fallback branch since
    // it's the only remaining sentiment.
    expect(src).toMatch(/sentiment\s*===\s*"not_sure"[\s\S]*?:\s*"I disagree"/);
  });
});

describe("marking page B.4 — override panel inline reply", () => {
  it("renders the student-reply card above the composer with data-testid", () => {
    expect(src).toContain('data-testid="override-panel-student-reply"');
  });

  it("only shows the inline reply when latestTurnRole === 'student'", () => {
    // Same gate as the chip pill — once teacher sends a follow-up,
    // the inline reply card disappears (the conversation has moved
    // on, the thread will be visible elsewhere in B.5+).
    expect(src).toMatch(
      /if\s*\(!reply\s*\|\|\s*latestRole\s*!==\s*"student"\)\s*return\s+null/,
    );
  });

  it("renders the sentiment chip + reply text inline (or 'no message' placeholder)", () => {
    expect(src).toMatch(/no message — single-click reply/);
    // Reply text rendered with whitespace-pre-wrap so newlines from
    // the student's reply textarea preserve.
    expect(src).toMatch(/whitespace-pre-wrap/);
  });
});

describe("marking page B.4 — composer label + placeholder flip in follow-up mode", () => {
  it("composer label flips to 'Follow-up to ' when latest is student", () => {
    expect(src).toMatch(
      /isFollowUpMode\s*\?\s*"Follow-up to "\s*:\s*"Feedback to "/,
    );
  });

  it("placeholder reads 'Write a follow-up to {firstName}'s reply.' in follow-up mode", () => {
    expect(src).toMatch(/Write a follow-up to \$\{[^}]+\}'s reply/);
  });

  it("Send button copy flips to 'Send follow-up' in follow-up mode", () => {
    expect(src).toMatch(
      /isFollowUpMode\s*\?\s*"Send follow-up"\s*:\s*"Send to student"/,
    );
  });

  it("textarea value renders empty when in follow-up mode + draft still equals persisted (clean new-turn UX)", () => {
    // Without this clear, the textarea would pre-fill with the OLD
    // teacher comment, reading as an EDIT not a new turn.
    expect(src).toMatch(
      /latestTurnRoleByGradeId\[grade\.id\]\s*===\s*"student"\s*&&[\s\S]*?studentComment\s*===\s*persistedStudentComment[\s\S]*?\?\s*""/,
    );
  });
});

describe("marking page B.4 — saveTile refetches turn maps after a comment write", () => {
  it("after a successful save with student_facing_comment, refetches turns for this grade", () => {
    // The refetch keeps latestTurnRoleByGradeId + latestStudentReplyByGradeId
    // consistent post-trigger fire. Without it the composer wouldn't
    // flip back to "Edit feedback" after a follow-up send.
    expect(src).toMatch(
      /if\s*\(extras\.student_facing_comment\s*!==\s*undefined\)\s*\{[\s\S]*?await\s+supabase[\s\S]*?\.from\("tile_feedback_turns"\)[\s\S]*?\.eq\("grade_id",\s*newRow\.id\)/,
    );
  });

  it("patches BOTH latestTurnRoleByGradeId AND latestStudentReplyByGradeId post-save", () => {
    expect(src).toMatch(/setLatestTurnRoleByGradeId\(\(prev\)/);
    expect(src).toMatch(/setLatestStudentReplyByGradeId\(\(prev\)/);
  });

  it("clears latestStudentReplyByGradeId[id] when no student reply exists (defensive)", () => {
    // If turns list comes back without any student turn, the previous
    // map entry would be stale. Delete it cleanly.
    expect(src).toMatch(/delete next\[newRow\.id\]/);
  });
});
