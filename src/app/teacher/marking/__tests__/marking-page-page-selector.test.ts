/**
 * Page selector — source-static guards for the marking page lesson
 * navigation. Surfaced during TFL.1 Checkpoint 1.1 smoke (10 May 2026):
 * Matt graded a response on lesson 2 as a student, switched to teacher,
 * and the marking page only ever showed lesson 1's tiles — no UI
 * affordance to switch lessons. The first-with-sections page was being
 * picked on mount and never changed.
 *
 * The fix introduces:
 *   - A `gradeablePages` useMemo that filters all pages to those with
 *     ≥1 section (so we never land on a content-free intro page) and
 *     pre-computes (tileCount, confirmedCount, denom) for the chip.
 *   - A horizontal pill strip rendered above the view content when
 *     there are 2+ gradeable pages. Each chip carries data-testid
 *     `marking-page-chip-<pageId>` + a data-active marker so a
 *     downstream e2e test can assert active state.
 *   - A useEffect that refetches `student_progress.responses` for the
 *     newly active page when `activePageId` changes (the original
 *     loadAll only loaded responses for `firstWithSections.id`,
 *     which would otherwise leave the override panel empty for any
 *     non-default page).
 *   - A `loadResponsesForPage(unitId, pageId, cohortIds)` helper —
 *     extracted from loadAll so both initial load + page switch share
 *     a single fetch path.
 *
 * Lesson #71: pure logic in `.tsx` isn't unit-testable in this repo's
 * vitest config; we assert pattern presence in the source string. Run
 * the route through Playwright when an e2e harness lands.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("marking page — page selector source presence", () => {
  it("derives gradeablePages via useMemo (filters pages-with-sections)", () => {
    expect(src).toMatch(/const gradeablePages\s*=\s*useMemo\(/);
    // Must filter out pages with no sections — front-matter / intro
    // pages have no gradeable tiles and would land the teacher on an
    // empty view.
    expect(src).toMatch(
      /\(p\.content\?\.sections\s*\?\?\s*\[\]\)\.length\s*>\s*0/,
    );
  });

  it("computes confirmedCount + denom per page for the chip counter", () => {
    // Without the precompute the chip can't show "3 / 8 graded" —
    // teacher loses the at-a-glance progress signal.
    expect(src).toMatch(/confirmedCount/);
    expect(src).toMatch(/denom/);
    // denom = tileCount × students.length
    expect(src).toMatch(/pageTiles\.length\s*\*\s*students\.length/);
  });

  it("renders the selector pill strip with per-chip data-testid", () => {
    expect(src).toContain('data-testid="marking-page-selector"');
    expect(src).toMatch(/data-testid=\{`marking-page-chip-\$\{p\.id\}`\}/);
    expect(src).toMatch(/data-active=\{isActive\}/);
  });

  it("hides the selector when there is only one gradeable page (single-lesson units)", () => {
    expect(src).toMatch(/gradeablePages\.length\s*>\s*1/);
  });

  it("clicking a chip sets activePageId via setActivePageId", () => {
    expect(src).toMatch(
      /onClick=\{\s*\(\)\s*=>\s*setActivePageId\(p\.id\)\s*\}/,
    );
  });
});

describe("marking page — page-switch response refetch", () => {
  it("loadResponsesForPage is a useCallback helper", () => {
    expect(src).toMatch(
      /const loadResponsesForPage\s*=\s*useCallback\(/,
    );
    // Signature must take (unitId, pageId, cohortIds) — initial load
    // + page switch share the same fetch path.
    expect(src).toMatch(
      /async\s*\(\s*unitIdParam:\s*string\s*,\s*pageId:\s*string\s*,\s*cohortIds:\s*string\[\]\s*\)/,
    );
  });

  it("loadAll calls loadResponsesForPage for the initial page", () => {
    // Asserts the inline progress fetch is gone — replaced by the
    // single shared helper. If the inline `.from("student_progress")
    // .select(...)` block ever comes back, this will fail.
    expect(src).toMatch(
      /await\s+loadResponsesForPage\(\s*unitDetail\.id\s*,\s*firstWithSections\.id\s*,\s*cohortIds\s*\)/,
    );
  });

  it("a useEffect refetches responses on activePageId change", () => {
    // The effect must depend on activePageId, students, unit, and the
    // helper. Without students, the effect would fire before cohort is
    // loaded; without unit, it'd fire pre-load. Anchor on
    // `setActiveTileIdx(0)` since that's unique to the page-switch
    // effect (loadAll resets tile idx differently via initial state).
    const effectMatch = src.match(
      /useEffect\(\(\)\s*=>\s*\{[^{}]*?activePageId[\s\S]*?loadResponsesForPage[\s\S]*?setActiveTileIdx\(0\)[\s\S]*?\},\s*\[([^\]]+)\]\)/,
    );
    expect(effectMatch).not.toBeNull();
    const deps = effectMatch?.[1] ?? "";
    expect(deps).toContain("unit");
    expect(deps).toContain("activePageId");
    expect(deps).toContain("students");
    expect(deps).toContain("loadResponsesForPage");
  });

  it("page switch resets activeTileIdx to 0 (override panel doesn't open against a stale tile)", () => {
    // Without the reset, the teacher could be looking at lesson 2 with
    // the override panel still pinned to lesson 1's tile index — would
    // either crash or render an unrelated tile.
    expect(src).toMatch(/setActiveTileIdx\(0\)/);
  });
});
