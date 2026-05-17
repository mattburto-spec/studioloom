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
    "src/components/teacher/class-hub/ClassCanvas.tsx"
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

// ─── Re-targeted on StudentDrawer Page Progress chip (DT canvas Phase 3.2
// Step 5, 16 May 2026) — same round-13 intent (page-title renames flow
// through to teacher-side display + the old `L0?` regex strip stays
// retired), now anchored at the StudentDrawer's per-page chip rather
// than the old per-page column header on the Progress tab. The canvas
// student grid has one Unit progress bar per row; per-page granularity
// lives in the drawer.
describe("StudentDrawer Page Progress chip — title sync (round 13, re-targeted)", () => {
  const DRAWER_SRC = readFileSync(
    join(
      process.cwd(),
      "src/components/teacher/class-hub/StudentDrawer.tsx"
    ),
    "utf-8"
  );

  it("uses 1-based position index instead of stripping page.id", () => {
    // The drawer renders `{pageIdx + 1}` inside the chip — same anchor
    // for round-13's "position not slug" contract.
    expect(DRAWER_SRC).toMatch(/\{pageIdx\s*\+\s*1\}/);
    // Old regex strip stays retired across the codebase
    expect(DRAWER_SRC).not.toContain('page.id.replace(/^L0?/, "")');
    expect(HUB_SRC).not.toContain('page.id.replace(/^L0?/, "")');
  });

  it("chip title attribute carries the human-readable label + page.title fallback", () => {
    expect(DRAWER_SRC).toMatch(
      /title=\{`\$\{pageIdx \+ 1\}\.\s*\$\{page\.title \|\| page\.id\}/
    );
  });

  it("data.pages.map signature accepts pageIdx as second arg", () => {
    expect(DRAWER_SRC).toMatch(/data\.pages\.map\(\(page,\s*pageIdx\)\s*=>/);
  });
});
