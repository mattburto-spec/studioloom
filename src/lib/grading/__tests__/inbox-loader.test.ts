/**
 * TFL.3 C.1 — inbox-loader source-static guards.
 *
 * The loader is the bridge between the existing grading tables and
 * the new /teacher/inbox surface. Pins the shape contracts that
 * C.2 + C.3 will rely on:
 *
 *   - InboxItem type covers every field the card needs
 *   - State derivation: 3 categories (reply_waiting / drafted / no_draft)
 *   - State priority ordering when sorting
 *   - 90-day window + 200-item hard cap
 *   - Pure read-derived view (no schema writes)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "inbox-loader.ts"), "utf-8");

describe("inbox-loader — InboxItem contract", () => {
  it("exports InboxItem with the 3-category state union", () => {
    expect(src).toMatch(
      /export type InboxItemState\s*=\s*"reply_waiting"\s*\|\s*"drafted"\s*\|\s*"no_draft"/,
    );
  });

  it("InboxItem includes the routing keys (gradeId, tileId, classId, etc.)", () => {
    const block = src.match(/export interface InboxItem[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).toMatch(/gradeId:\s*string/);
    expect(block).toMatch(/itemKey:\s*string/);
    expect(block).toMatch(/studentId:\s*string/);
    expect(block).toMatch(/classId:\s*string/);
    expect(block).toMatch(/unitId:\s*string/);
    expect(block).toMatch(/pageId:\s*string/);
    expect(block).toMatch(/tileId:\s*string/);
  });

  it("InboxItem carries AI draft fields (the approve path's payload)", () => {
    const block = src.match(/export interface InboxItem[\s\S]*?\n\}/)?.[0] ?? "";
    expect(block).toMatch(/aiCommentDraft:\s*string\s*\|\s*null/);
    expect(block).toMatch(/aiScore:\s*number\s*\|\s*null/);
    expect(block).toMatch(/aiReasoning:\s*string\s*\|\s*null/);
    expect(block).toMatch(/aiQuote:\s*string\s*\|\s*null/);
    expect(block).toMatch(/aiConfidence:\s*number\s*\|\s*null/);
  });

  it("InboxItem carries latestStudentReply for reply_waiting state (sentiment + text + sentAt)", () => {
    expect(src).toMatch(/latestStudentReply:\s*\{/);
    expect(src).toMatch(/sentiment:\s*Sentiment/);
    expect(src).toMatch(/text:\s*string/);
    expect(src).toMatch(/sentAt:\s*string/);
  });
});

describe("inbox-loader — query scoping + cap", () => {
  it("teacher-scoped via classes.teacher_id (no cross-teacher leak)", () => {
    expect(src).toMatch(
      /\.from\("classes"\)[\s\S]*?\.eq\("teacher_id",\s*teacherId\)/,
    );
  });

  it("90-day window on updated_at", () => {
    expect(src).toMatch(/NINETY_DAYS_MS\s*=\s*90\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(src).toMatch(/\.gte\("updated_at",\s*since\)/);
  });

  it("hard cap at 200 pre-filter (UI trims to 50 separately)", () => {
    expect(src).toMatch(/HARD_CAP\s*=\s*200/);
    expect(src).toMatch(/\.limit\(HARD_CAP\)/);
  });

  it("early-returns empty array when teacher has no classes", () => {
    expect(src).toMatch(
      /if\s*\(classRows\.length\s*===\s*0\)\s*return\s+\[\]/,
    );
  });
});

describe("inbox-loader — state derivation", () => {
  it("reply_waiting when latest turn role is student AND a student reply exists", () => {
    expect(src).toMatch(
      /latestTurn\?\.role\s*===\s*"student"\s*&&\s*latestStudentReply/,
    );
    expect(src).toMatch(/state\s*=\s*"reply_waiting"/);
  });

  it("drafted when ai_comment_draft exists AND not yet confirmed AND no prior sent comment", () => {
    // Updated 14 May 2026 — was previously `cleanDraft !== cleanSent`.
    // Re-running AI suggest on already-graded rows broke that rule
    // (new draft differed from old sent → re-surfaced). Now: drafted
    // requires no prior send at all. See "no prior sent comment"
    // describe block below for the new shape.
    expect(src).toMatch(/g\.ai_comment_draft\s*&&\s*!g\.confirmed/);
    expect(src).toMatch(
      /const cleanDraft\s*=\s*g\.ai_comment_draft\.trim\(\)/,
    );
    expect(src).toMatch(/cleanDraft\s*&&\s*!cleanSent/);
    expect(src).toMatch(/state\s*=\s*"drafted"/);
  });

  it("no_draft when student submitted but no AI draft yet and not confirmed", () => {
    expect(src).toMatch(
      /!g\.ai_comment_draft\s*&&\s*!g\.confirmed\s*&&\s*studentResponse/,
    );
    expect(src).toMatch(/state\s*=\s*"no_draft"/);
  });

  it("skips items where no state applies (got_it-resolved threads filtered out)", () => {
    expect(src).toMatch(/if\s*\(!state\)\s*continue/);
  });
});

describe("inbox-loader — sort order (brief's locked priority)", () => {
  it("reply_waiting comes first, then drafted, then no_draft", () => {
    expect(src).toMatch(
      /stateOrder:\s*Record<InboxItemState,\s*number>\s*=\s*\{[\s\S]*?reply_waiting:\s*0[\s\S]*?drafted:\s*1[\s\S]*?no_draft:\s*2/,
    );
  });

  it("oldest-first across all buckets (Matt feedback 12 May 2026 — backlog should float to top)", () => {
    // Originally reply_waiting was DESC by lastActivityAt. Matt's smoke
    // caught that fresh replies buried old replies; flipped to ASC
    // across all three buckets so the teacher always sees the oldest
    // outstanding item first. C.3.1 change.
    expect(src).toMatch(
      /\/\/ Oldest first across all three buckets\.\s*\n\s*return a\.lastActivityAt\.localeCompare\(b\.lastActivityAt\)/,
    );
  });

  it("no per-bucket DESC branch exists (regression guard against re-introducing newest-first)", () => {
    expect(src).not.toMatch(
      /b\.lastActivityAt\.localeCompare\(a\.lastActivityAt\)/,
    );
  });
});

describe("inbox-loader — student name privacy", () => {
  it("returns studentName as first-name-only display string, NOT a full ID or email", () => {
    // The card surfaces a friendly name. We split on whitespace to
    // get first name only — fallback chain: display_name → username
    // → "Student". The loader does NOT push the name into any LLM
    // prompt; that contract holds at the AI call sites (C.3).
    expect(src).toMatch(
      /student\?\.display_name\?\.split\(" "\)\[0\]\s*\|\|\s*student\?\.username\s*\|\|\s*"Student"/,
    );
  });
});

describe("inbox-loader — drafted state requires no prior sent comment (14 May 2026)", () => {
  it("treats a row as 'drafted' only when student_facing_comment is empty", () => {
    // Matt smoke 14 May: re-running AI suggest on already-graded tile
    // wrote new ai_comment_draft + reset confirmed=false. Without this
    // guard, every previously-sent student popped back into the inbox
    // as "drafted" (cleanDraft !== cleanSent). Now: only first-draft
    // states qualify.
    expect(src).toMatch(
      /if\s*\(cleanDraft\s*&&\s*!cleanSent\)\s*\{\s*\n\s*state\s*=\s*"drafted"/,
    );
  });

  it("comment explains the regeneration-after-send case (so the rule doesn't get reverted)", () => {
    expect(src).toMatch(
      /Matt smoke 14 May 2026[\s\S]*?re-running AI suggest[\s\S]*?inbox as "drafted"/i,
    );
  });

  it("regression guard: NO branch still uses cleanDraft !== cleanSent as the drafted gate", () => {
    // The original logic was `cleanDraft && cleanDraft !== cleanSent`.
    // If that comes back, the bug returns.
    expect(src).not.toMatch(
      /state\s*=\s*"drafted"[\s\S]{0,200}cleanDraft\s*!==\s*cleanSent/,
    );
  });
});

describe("inbox-loader — resolved_at filter (C.3.3)", () => {
  it("SELECTs the resolved_at column from student_tile_grades", () => {
    // The .select(...) string ends with `, resolved_at"`.
    expect(src).toMatch(/,\s*resolved_at"/);
    // And the GradeRow interface declares the corresponding field.
    expect(src).toMatch(/resolved_at:\s*string\s*\|\s*null/);
  });

  it("skips items where resolved_at is set AND no new reply since", () => {
    // The filter sits inside the per-grade loop, after state
    // derivation. If resolved_at exists, hide unless
    // latestStudentReply.sentAt > resolved_at.
    expect(src).toMatch(
      /if\s*\(g\.resolved_at\)\s*\{[\s\S]*?const replyAt\s*=\s*latestStudentReply\?\.sentAt[\s\S]*?if\s*\(!replyAt\s*\|\|\s*replyAt\s*<=\s*g\.resolved_at\)\s*continue/,
    );
  });

  it("re-surface check is gated on a NEW reply (not just any reply)", () => {
    // The comparison is strict `<=` — equal-timestamp doesn't count
    // as new, which matches the resolved_at = NOW() write semantics
    // (resolve THEN any later reply re-opens).
    expect(src).toMatch(/replyAt\s*<=\s*g\.resolved_at/);
  });
});

describe("inbox-loader — no schema writes (pure read-derived)", () => {
  it("does NOT call .insert/.update/.upsert/.delete anywhere", () => {
    // C.1 is a read-only loader. Writes happen in C.2 (approve) +
    // C.3 (reply draft). Any writes here would be a contract break.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/\.insert\(/);
    expect(codeOnly).not.toMatch(/\.update\(/);
    expect(codeOnly).not.toMatch(/\.upsert\(/);
    expect(codeOnly).not.toMatch(/\.delete\(/);
  });
});
