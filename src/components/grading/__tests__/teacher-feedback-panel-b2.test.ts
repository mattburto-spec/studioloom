/**
 * TFL.2 Pass B sub-phase B.2 — TeacherFeedbackPanel rewrite tests.
 *
 * G3.3's `<TeacherFeedbackPanel>` (single-comment model) was rewritten
 * to use Pass A's `<TeacherFeedback />` component + the multi-turn
 * thread API. Pins:
 *
 *   - Hook calls /api/student/tile-feedback (NOT /tile-comments)
 *   - Hook returns threadsByTileId + teacherFedTileIds
 *   - InlineTeacherFeedback wraps Pass A's <TeacherFeedback />
 *   - Replies disabled in B.2 via repliesEnabled={false}
 *   - data-feedback-anchor on the first tile (banner scroll-to)
 *   - The OLD shape (TileComment.student_facing_comment, useTileFeedback)
 *     is gone — regression guards.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "TeacherFeedbackPanel.tsx"),
  "utf-8",
);

describe("TeacherFeedbackPanel (B.2 rewrite) — hook", () => {
  it("exports useTileFeedbackThreads (renamed from useTileFeedback)", () => {
    expect(src).toMatch(/export function useTileFeedbackThreads\(/);
  });

  it("fetches /api/student/tile-feedback (NOT /tile-comments)", () => {
    expect(src).toContain("/api/student/tile-feedback");
    // Strip comments so doc references to the legacy endpoint don't
    // trip the assertion. We want to catch actual fetch calls.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toContain("/api/student/tile-comments");
  });

  it("returns threadsByTileId + gradeIdByTileId + teacherFedTileIds + loading + refresh (B.3)", () => {
    const block = src.match(/return\s*\{[\s\S]*?\};/)?.[0] ?? "";
    expect(block).toContain("threadsByTileId");
    // B.3 — gradeIdByTileId routes the reply POST endpoint per tile.
    expect(block).toContain("gradeIdByTileId");
    expect(block).toContain("teacherFedTileIds");
    expect(block).toContain("loading");
    // B.3 — refresh callback re-fetches threads after a reply lands.
    expect(block).toContain("refresh");
  });

  it("teacherFedTileIds derives from tiles with at least one TEACHER turn", () => {
    // Banner shouldn't surface a tile that has only student-side
    // turns (impossible in v1 — first turn is always teacher — but
    // pinning the predicate guards against drift).
    expect(src).toMatch(
      /turns\.some\(\(t\)\s*=>\s*t\.role\s*===\s*"teacher"\)/,
    );
  });
});

describe("TeacherFeedbackPanel (B.2 rewrite) — InlineTeacherFeedback wraps Pass A component", () => {
  it("imports TeacherFeedback from the new component path", () => {
    expect(src).toMatch(
      /import\s*\{\s*TeacherFeedback\s*\}\s*from\s*"@\/components\/lesson\/TeacherFeedback"/,
    );
  });

  it("InlineTeacherFeedback renders <TeacherFeedback /> with turns + gradeId as threadId (B.3)", () => {
    expect(src).toMatch(/export function InlineTeacherFeedback/);
    const afterExport = src.slice(
      src.indexOf("export function InlineTeacherFeedback"),
    );
    expect(afterExport).toMatch(/<TeacherFeedback/);
    expect(afterExport).toMatch(/turns=\{turns\}/);
    // B.3: threadId IS the gradeId — the reply POST endpoint is
    // keyed by gradeId, and using it as threadId means the parent
    // doesn't need to thread two separate identifiers.
    expect(afterExport).toMatch(/threadId=\{gradeId\}/);
  });

  it("repliesEnabled={true} once B.3 wires the POST endpoint", () => {
    // Updated B.3: pills now render. The handler POSTs to
    // /api/student/tile-feedback/[gradeId]/reply, then calls
    // onReplyPersisted to refresh threads.
    expect(src).toMatch(/repliesEnabled=\{true\}/);
  });

  it("InlineTeacherFeedback POSTs replies to /api/student/tile-feedback/[gradeId]/reply (B.3)", () => {
    expect(src).toMatch(
      /\/api\/student\/tile-feedback\/\$\{encodeURIComponent\(gradeId\)\}\/reply/,
    );
    expect(src).toMatch(/method:\s*"POST"/);
    expect(src).toMatch(/sentiment\s*,\s*text/);
  });

  it("InlineTeacherFeedback calls onReplyPersisted on success (so parent can refetch threads)", () => {
    expect(src).toMatch(/onReplyPersisted\?\.\(\)/);
  });

  it("renders nothing when turns array is empty (no clutter on tiles with no feedback)", () => {
    expect(src).toMatch(/if\s*\(turns\.length\s*===\s*0\)\s*return\s+null/);
  });

  it("data-feedback-anchor lands on isFirst=true wrapper (banner scroll-to)", () => {
    expect(src).toMatch(
      /data-feedback-anchor=\{isFirst\s*\?\s*"true"\s*:\s*undefined\}/,
    );
  });
});

describe("TeacherFeedbackPanel (B.2 rewrite) — banner uses derived ID list", () => {
  it("TeacherFeedbackBanner takes teacherFedTileIds, not the raw threads map", () => {
    expect(src).toMatch(/export function TeacherFeedbackBanner/);
    const afterExport = src.slice(
      src.indexOf("export function TeacherFeedbackBanner"),
    );
    expect(afterExport).toMatch(/teacherFedTileIds:\s*string\[\]/);
    expect(afterExport).toMatch(/teacherFedTileIds\.length\s*===\s*0/);
  });

  it("count copy uses 'tile' / 'tiles' (singular vs plural based on count)", () => {
    expect(src).toMatch(/teacherFedTileIds\.length\s*===\s*1\s*\?\s*"tile"\s*:\s*"tiles"/);
  });
});

describe("TeacherFeedbackPanel (B.2 rewrite) — old shape removed", () => {
  it("the legacy TileComment.student_facing_comment interface is gone", () => {
    // Was the v1 shape; B.2 replaces with Turn[]. A regression here
    // would mean someone re-introduced the single-comment model
    // alongside the new threads model.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/student_facing_comment/);
    expect(codeOnly).not.toMatch(/useTileFeedback\b\s*\(/);
    expect(codeOnly).not.toMatch(/interface\s+TileComment\b/);
  });

  it("legacy <TeacherFeedbackPanel> bottom-of-page list is gone", () => {
    // No callers in the codebase per the audit — the legacy export
    // is dropped in this rewrite.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/export function TeacherFeedbackPanel\b/);
  });
});
