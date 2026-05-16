/**
 * Round 13 (6 May 2026) — lesson title sync.
 *
 * useLessonEditor.updatePage now mirrors `partial.title` to the
 * top-level `page.title` field so the student sidebar + the teacher
 * progress grid pick up renames done via the editor's title input.
 *
 * The progress grid header also shifts from `page.id.replace(/^L0?/, "")`
 * to `String(pageIdx + 1)` so newly-created pages with auto-generated
 * IDs don't leak slugs into the column labels.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const HOOK_SRC = readFileSync(
  join(__dirname, "..", "useLessonEditor.ts"),
  "utf-8"
);

const HUB_SRC = readFileSync(
  join(
    process.cwd(),
    "src/app/teacher/units/[unitId]/class/[classId]/page.tsx"
  ),
  "utf-8"
);

describe("useLessonEditor.updatePage — title mirror", () => {
  it("mirrors partial.title to page.title (top-level) when set", () => {
    const idx = HOOK_SRC.indexOf("const updatePage = useCallback");
    expect(idx).toBeGreaterThan(0);
    const fn = HOOK_SRC.slice(idx, idx + 1500);
    expect(fn).toMatch(
      /if\s*\(typeof partial\.title === "string"\)\s*\{[\s\S]{0,80}merged\.title\s*=\s*partial\.title/
    );
  });

  it("preserves the existing nested content.title write", () => {
    const idx = HOOK_SRC.indexOf("const updatePage = useCallback");
    const fn = HOOK_SRC.slice(idx, idx + 1500);
    expect(fn).toMatch(
      /content:\s*\{\s*\.\.\.pages\[pageIndex\]\.content,\s*\.\.\.partial,/
    );
  });

  it("does not mirror non-title partial fields to top level (only title)", () => {
    // The check is gated on `typeof partial.title === "string"`. No
    // other fields are forwarded out of the content namespace.
    const idx = HOOK_SRC.indexOf("const updatePage = useCallback");
    const fn = HOOK_SRC.slice(idx, idx + 1500);
    // Only title gets the special-case mirror
    expect(fn.match(/merged\.\w+\s*=\s*partial\.\w+/g)).toEqual([
      "merged.title = partial.title",
    ]);
  });
});

// ─── Transient skips — DT canvas Phase 3.1 (Step 2, 16 May 2026) ─────────
// The Progress grid was temporarily unmounted when the tab JSX was
// replaced by the canvas-grid scaffold. Step 3 of Phase 3.1 rebuilds
// the grid inside `data-testid="canvas-student-grid"` and re-uses the
// (page, pageIdx) iteration + 1-based column header. Step 5 unskips
// these guards once the new render path is in place. The old
// page.id.replace(/^L0?/, "") regex stays out — that's the regression
// these guards lock against.
describe.skip("Progress grid — column header (round 13) [unskip in Phase 3.1 Step 3/5]", () => {
  it("uses position index (1-based) instead of stripping page.id", () => {
    expect(HUB_SRC).toMatch(
      /const headerLabel\s*=\s*String\(pageIdx\s*\+\s*1\)/
    );
    // Old regex strip retired
    expect(HUB_SRC).not.toContain('page.id.replace(/^L0?/, "")');
  });

  it("title attribute carries the human-readable label + page.title fallback", () => {
    expect(HUB_SRC).toMatch(
      /title=\{`\$\{pageIdx \+ 1\}\. \$\{page\.title \|\| page\.id\}/
    );
  });

  it("unitPages.map signature accepts pageIdx as second arg", () => {
    expect(HUB_SRC).toMatch(/unitPages\.map\(\(page,\s*pageIdx\)\s*=>/);
  });
});
