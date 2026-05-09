/**
 * Page selector + work-driven view — source-static guards for the
 * marking page lesson navigation. Surfaced during TFL.1 Checkpoint 1.1
 * smoke (10 May 2026).
 *
 * History:
 *   - PR #149 introduced a per-page response refetch on chip click.
 *   - PR-A (this commit) replaced that with a one-shot all-pages
 *     rollup so the chip counter can show accurate "n / m graded"
 *     across every lesson without paying a refetch on every click.
 *     Also filters the tile carousel to only tiles with submissions
 *     and switches the counter shape from `students × tiles` to
 *     `submissions on this page`.
 *
 * Lesson #71: pure logic in `.tsx` isn't unit-testable in this repo's
 * vitest config; we assert pattern presence in the source string.
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

describe("marking page — work-driven counter (PR-A, 10 May 2026)", () => {
  it("counter denom is the count of student submissions on this page (NOT students × tiles)", () => {
    // The previous shape (PR #149) was `pageTiles.length * students.length`.
    // That counts every (student, tile) cell whether the student submitted
    // or not, so a page full of pure-instruction tiles still showed huge
    // denoms. PR-A removes that multiplication entirely from the
    // gradeablePages useMemo body.
    const gradeablePagesBlock = src.match(
      /const gradeablePages\s*=\s*useMemo\([\s\S]*?\}\s*,\s*\[[^\]]*\]\)/,
    );
    expect(gradeablePagesBlock).not.toBeNull();
    const body = gradeablePagesBlock?.[0] ?? "";
    expect(body).not.toMatch(/pageTiles\.length\s*\*\s*students\.length/);
    // The new denom is computed by counting (student, tile) pairs in
    // responsesByPage that match a tile on this page.
    expect(body).toContain("submissions");
    expect(body).toContain("responsesByPage");
  });

  it("confirmedCount only counts grades whose (student, tile) pair has a submission OR is NA", () => {
    // Without this filter, n could exceed m on pages where the teacher
    // confirmed scores for non-submitting students. NA scores are still
    // counted because NA explicitly means "no submission expected" and
    // shouldn't leave a chip stuck below 100% forever.
    const gradeablePagesBlock = src.match(
      /const gradeablePages\s*=\s*useMemo\([\s\S]*?\}\s*,\s*\[[^\]]*\]\)/,
    );
    expect(gradeablePagesBlock).not.toBeNull();
    const body = gradeablePagesBlock?.[0] ?? "";
    expect(body).toMatch(/score_na\s*===\s*true/);
    expect(body).toMatch(/hasSubmission\s*\|\|\s*g\.score_na\s*===\s*true/);
  });
});

describe("marking page — tile carousel filter (PR-A, 10 May 2026)", () => {
  it("the tiles useMemo filters to tiles with at least one submission on this page", () => {
    // The fix that hides "Studio rhythm", "Open Project Board", and other
    // pure-instruction tiles from the marking flow. extractTilesFromPage
    // returns ALL tiles including instruction-only ones; the filter
    // narrows to tiles where any student has a non-empty response.
    expect(src).toMatch(
      /const tilesWithSubmissions\s*=\s*new\s+Set<string>\(\)/,
    );
    expect(src).toMatch(
      /allTiles\.filter\(\(t\)\s*=>\s*tilesWithSubmissions\.has\(t\.tileId\)\)/,
    );
  });

  it("renders an explicit empty state when no submissions exist on the page", () => {
    // tiles.length === 0 must NOT silently render an empty grid — that
    // looks identical to a broken page. The empty state names the
    // condition + suggests next action.
    expect(src).toContain('data-testid="marking-no-submissions"');
    expect(src).toContain("No submissions on this lesson yet.");
  });
});

describe("marking page — all-pages response rollup (PR-A, 10 May 2026)", () => {
  it("loadAllResponses is a useCallback helper (no .eq on page_id)", () => {
    expect(src).toMatch(/const loadAllResponses\s*=\s*useCallback\(/);
    // Anchor a region from `loadAllResponses` declaration through the
    // `setResponsesByPage(byPage)` write — that's the unique end-of-helper
    // marker. Nested braces inside the body break the lazy `[\s\S]*?\}`
    // approach, so anchor on a known sentinel instead.
    const helperBlock = src.match(
      /const loadAllResponses[\s\S]*?setResponsesByPage\(byPage\)/,
    );
    expect(helperBlock).not.toBeNull();
    const body = helperBlock?.[0] ?? "";
    expect(body).toContain('.from("student_progress")');
    expect(body).not.toMatch(/\.eq\(\s*"page_id"/);
    expect(body).toMatch(/\.eq\(\s*"unit_id"/);
    expect(body).toMatch(/\.in\(\s*"student_id"/);
  });

  it("state shape is responsesByPage: pageId → studentId → tileId → text", () => {
    expect(src).toMatch(
      /const \[responsesByPage,\s*setResponsesByPage\]\s*=\s*useState/,
    );
    // Type signature must be 3-deep nested record.
    expect(src).toMatch(
      /Record<string,\s*Record<string,\s*Record<string,\s*string>>>/,
    );
  });

  it("loadAll calls loadAllResponses (no page_id-scoped fetch)", () => {
    expect(src).toMatch(
      /await\s+loadAllResponses\(\s*unitDetail\.id\s*,\s*cohortIds\s*\)/,
    );
    // Regression guard: the per-page helper must not come back.
    expect(src).not.toMatch(/loadResponsesForPage\(/);
  });

  it("override panel deep-indexes responsesByPage[activePageId] when slicing for CalibrateInner", () => {
    // The prop wired into CalibrateInner is the active-page slice. Without
    // this slice, the inner component would either need to know about the
    // 3-deep shape or render empty.
    expect(src).toMatch(
      /responses=\{\s*activePageId\s*\?\s*responsesByPage\[activePageId\]\s*\?\?\s*\{\}\s*:\s*\{\}\s*\}/,
    );
  });

  it("page switch resets activeTileIdx to 0 (override panel doesn't open against a stale tile)", () => {
    // Smaller useEffect than before — no refetch, just the focus reset.
    expect(src).toMatch(/setActiveTileIdx\(0\)/);
  });
});
