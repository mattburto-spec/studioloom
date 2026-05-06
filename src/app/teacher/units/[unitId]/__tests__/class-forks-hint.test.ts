/**
 * Round 20 (6 May 2026 PM) — Lock the class-fork hint on the master
 * unit detail page. Source-static guards (Lesson #71-style — render
 * tests would need a full Supabase mock harness for a 4-line UI guard).
 *
 * The teacher creates a per-class lesson via the lesson editor's "This
 * class only" toggle. That writes into class_units.content_data, leaving
 * units.content_data (which the master page reads) untouched. Without
 * the hint, lesson #4 looked missing when in fact it lived on the fork.
 *
 * This test fails if someone renames the testid, drops the hint, or
 * changes the gating logic so the hint shows up even with no forks.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PAGE_SRC = readFileSync(
  join(__dirname, "..", "page.tsx"),
  "utf-8"
);

describe("master unit page — class-fork hint", () => {
  it("renders the hint inside a forks.length > 0 gate", () => {
    expect(PAGE_SRC).toMatch(
      /\{forks\.length\s*>\s*0\s*&&\s*\(\s*<div[\s\S]{0,200}data-testid="unit-class-forks-hint"/
    );
  });

  it("uses the testid the QA matrix expects", () => {
    expect(PAGE_SRC).toContain('data-testid="unit-class-forks-hint"');
  });

  it("singular vs plural copy is wired off forks.length", () => {
    expect(PAGE_SRC).toContain(
      'forks.length === 1 ? "class has" : "classes have"'
    );
  });

  it("points teachers toward the Class Hub for per-class edits", () => {
    expect(PAGE_SRC).toMatch(/Class Hub/);
  });
});
