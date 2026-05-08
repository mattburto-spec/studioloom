/**
 * TFL.1.3 — source-static guards for the teacher marking page's
 * read-receipt wiring. Same shape as the timeline / kanban route
 * tests (Lesson #71). The actual UI render path isn't testable in
 * this repo's vitest config; we assert what the source contains.
 *
 * Lesson #38 — assert exact patterns, not "the file is non-empty".
 * The dot is load-bearing for Matt Checkpoint 1.1; if the SELECT
 * doesn't fetch student_seen_comment_at, the dot can never light
 * up regardless of how good the helper is.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("marking page — TFL.1.3 read-receipt wiring", () => {
  it("imports classifyCommentReadState + commentChipTooltip from comment-status", () => {
    expect(src).toContain('from "@/lib/grading/comment-status"');
    expect(src).toContain("classifyCommentReadState");
    expect(src).toContain("commentChipTooltip");
  });

  it("loader SELECT fetches student_seen_comment_at AND updated_at", () => {
    // Without these two columns the chip dot can never derive its state.
    // Lesson #38: assert the exact column names rather than "select clause
    // exists". The select string is one large quoted literal in the
    // file; both column names must appear inside it.
    expect(src).toMatch(
      /"id, student_id, page_id[^"]*student_seen_comment_at[^"]*"/,
    );
    expect(src).toMatch(
      /"id, student_id, page_id[^"]*updated_at[^"]*"/,
    );
  });

  it("TileGradeRow interface declares student_seen_comment_at + updated_at", () => {
    expect(src).toMatch(/student_seen_comment_at\?:\s*string\s*\|\s*null/);
    expect(src).toMatch(/updated_at\?:\s*string\s*\|\s*null/);
  });

  it("renders a read-receipt dot with the data-state attribute the chip exposes", () => {
    // The dot's data-state lets us debug from the browser inspector and
    // gives downstream tests a stable selector if a runtime test ever
    // lands. Hard-coding the testid here so renames must be deliberate.
    expect(src).toContain('data-testid="read-receipt-dot"');
    expect(src).toMatch(/data-state=\{readState\}/);
  });

  it("dot only renders when there is a sent/edited comment (no false dots on empty rows)", () => {
    // Critical: the chip on an empty-feedback row must not show a grey
    // dot — that would imply "comment sent but unread" when no comment
    // exists. The IIFE gates dotClass behind hasComment.
    expect(src).toMatch(/const hasComment\s*=\s*state === "sent" \|\| state === "edited"/);
    expect(src).toMatch(/const dotClass\s*=\s*!hasComment\s*\?\s*null/);
  });

  it("colour mapping covers the three required states (emerald / amber / grey)", () => {
    // The brief locks: seen-current/seen-stale → emerald, unread-stale →
    // amber, unread-fresh → grey. Asserting class strings catches a
    // typo or accidental tone change.
    expect(src).toContain('"bg-emerald-500"');
    expect(src).toContain('"bg-amber-500"');
    expect(src).toContain('"bg-gray-300"');
  });

  it("chip tooltip falls back through receiptTooltip ?? existing-state copy", () => {
    // Read receipts override the static "Student can see this comment"
    // tooltip; the existing state-specific copy is the fallback.
    expect(src).toMatch(/title=\{\s*receiptTooltip\s*\?\?/);
  });
});
