/**
 * /teacher/marking — preserves activePageId across loadAll() reloads.
 *
 * Matt smoke 12 May 2026: clicking "AI suggest (1/10 submitted)" on
 * Lesson 4 Task 1 kicked the page back to Lesson 1 Task 1 because
 * loadAll() unconditionally set activePageId to the first page with
 * sections. The fix keeps the current page selected when it still
 * exists in the reloaded unit content.
 *
 * Also drops the setLoading(true) in loadAll so subsequent reloads
 * don't flash the full-screen "Loading marking view…" — those flows
 * have their own progress indicators (AI batch summary, approve
 * spinner, etc.).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf-8");

describe("/teacher/marking — activePageId preservation across reloads", () => {
  it("setActivePageId uses a functional updater that keeps the existing page when still present", () => {
    expect(src).toMatch(
      /setActivePageId\(\(prev\)\s*=>\s*\{[\s\S]*?if\s*\(prev\s*&&\s*pages\.some\(\(p\)\s*=>\s*p\.id\s*===\s*prev\)\)\s*return\s+prev/,
    );
  });

  it("falls back to firstWithSections.id when the previous page is gone (or initial mount)", () => {
    expect(src).toMatch(
      /return\s+firstWithSections\.id;\s*\}\);/,
    );
  });

  it("loadAll no longer calls setLoading(true) unconditionally", () => {
    // The initial loading state from useState(true) handles the
    // first paint. Subsequent reloads (AI suggest, etc.) keep the
    // surface visible — no full-screen "Loading marking view…"
    // flash.
    const loadAllMatch = src.match(
      /const loadAll\s*=\s*useCallback\(async\s*\(\)\s*=>\s*\{[\s\S]*?\}, \[classId, unitId, loadAllResponses\]\);/,
    );
    expect(loadAllMatch).not.toBeNull();
    const body = loadAllMatch?.[0] ?? "";
    // Strip comments before checking — the explanatory "// No
    // setLoading(true) here" comment would otherwise false-positive
    // this regex.
    const codeOnly = body
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/setLoading\(true\)\s*;/);
  });
});
