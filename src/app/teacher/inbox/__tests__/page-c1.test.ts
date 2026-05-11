/**
 * TFL.3 C.1 — /teacher/inbox page source-static guards.
 *
 * Pass A-style source-static checks against the page module (Lesson
 * #71 — no JSDOM render needed for the placeholder phase). Pins:
 *
 *   - Fetches /api/teacher/inbox/items on mount
 *   - Auto-draft warm-up fires the existing ai-prescore route per
 *     (class, unit, page, tile) group with chunked concurrency
 *   - Filter chips (class + lesson) honoured in filteredItems
 *   - Loading / error / empty states all present
 *   - Card placeholder surfaces every InboxItem field the C.2 visual
 *     will need
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("/teacher/inbox page — data fetch", () => {
  it("fetches /api/teacher/inbox/items on mount via useEffect", () => {
    expect(src).toMatch(/\/api\/teacher\/inbox\/items/);
    expect(src).toMatch(/useEffect\([\s\S]*?refetch/);
  });

  it("refetch is wrapped in useCallback (stable identity for re-trigger after auto-draft)", () => {
    expect(src).toMatch(/const refetch\s*=\s*React\.useCallback\(/);
  });
});

describe("/teacher/inbox page — auto-draft warm-up", () => {
  it("groups no_draft items by (class, unit, page, tile) before firing the prescore route", () => {
    expect(src).toMatch(
      /const key\s*=\s*`\$\{i\.classId\}::\$\{i\.unitId\}::\$\{i\.pageId\}::\$\{i\.tileId\}`/,
    );
  });

  it("fires the existing /api/teacher/grading/tile-grades/ai-prescore route per group (no fork)", () => {
    expect(src).toContain("/api/teacher/grading/tile-grades/ai-prescore");
    expect(src).toMatch(/method:\s*"POST"/);
    // Payload shape: class_id + unit_id + page_id + tile_id + student_ids[].
    expect(src).toMatch(/student_ids:\s*group\.map\(/);
  });

  it("chunks concurrency at 4 to avoid hammering the route", () => {
    expect(src).toMatch(/CHUNK\s*=\s*4/);
    expect(src).toMatch(/Promise\.all/);
  });

  it("refetches inbox items after auto-draft batch completes (cards re-categorize)", () => {
    expect(src).toMatch(/await\s+refetch\(\)/);
  });

  it("guards against double-firing (warmingDrafts state)", () => {
    expect(src).toMatch(/if\s*\(warmingDrafts\)\s*return/);
  });
});

describe("/teacher/inbox page — filter chips", () => {
  it("class filter + lesson filter applied in filteredItems", () => {
    expect(src).toMatch(/classFilter\s*&&\s*i\.classId\s*!==\s*classFilter/);
    expect(src).toMatch(/lessonFilter\s*&&\s*`\$\{i\.unitId\}::\$\{i\.pageId\}`\s*!==\s*lessonFilter/);
  });

  it("filter chips carry data-testids for downstream e2e", () => {
    expect(src).toContain('data-testid="inbox-class-filter"');
    expect(src).toContain('data-testid="inbox-lesson-filter"');
  });

  it("clear button resets both filters", () => {
    expect(src).toMatch(/setClassFilter\(null\)[\s\S]*?setLessonFilter\(null\)/);
  });
});

describe("/teacher/inbox page — UI states", () => {
  it("loading state shows skeleton (items === null branch)", () => {
    expect(src).toMatch(/animate-pulse/);
    expect(src).toMatch(/items === null/);
  });

  it("error state surfaces with retry button", () => {
    // JSX uses the HTML entity &rsquo; for a curly apostrophe in the
    // user-visible string. Match the literal escape sequence.
    expect(src).toMatch(/Inbox couldn(?:'|&rsquo;|’)t load/);
    expect(src).toMatch(/Retry/);
  });

  it("empty state copy matches the brief (0 to review — nice work)", () => {
    expect(src).toContain("0 to review");
    expect(src).toContain("nice work");
  });

  it("warming-drafts indicator surfaces while AI is drafting", () => {
    expect(src).toMatch(/AI drafting/);
    expect(src).toMatch(/warmingDrafts/);
  });
});

describe("/teacher/inbox page — card placeholder data surfaces", () => {
  it("card carries inbox-item-card testid + data-state + data-grade-id", () => {
    expect(src).toContain('data-testid="inbox-item-card"');
    expect(src).toMatch(/data-state=\{item\.state\}/);
    expect(src).toMatch(/data-grade-id=\{item\.gradeId\}/);
  });

  it("card surfaces student name + class + unit + page + tile prompt", () => {
    expect(src).toMatch(/\{item\.studentName\}/);
    expect(src).toMatch(/\{item\.className\}/);
    expect(src).toMatch(/\{item\.unitTitle\}/);
    expect(src).toMatch(/\{item\.pageTitle\}/);
    expect(src).toMatch(/\{item\.tilePrompt\}/);
  });

  it("card surfaces student response (truncated past 200 chars)", () => {
    expect(src).toMatch(/item\.studentResponse\.length\s*>\s*200/);
  });

  it("card surfaces the reply when state is reply_waiting (sentiment + text)", () => {
    expect(src).toMatch(/item\.latestStudentReply/);
    expect(src).toMatch(/Reply \(/);
  });

  it("card surfaces the AI draft + score + confidence when present", () => {
    expect(src).toMatch(/item\.aiCommentDraft/);
    expect(src).toMatch(/item\.aiScore\s*!==\s*null/);
    expect(src).toMatch(/item\.aiConfidence\s*!==\s*null/);
  });
});
