/**
 * Unit page ↔ class page assignment sync.
 *
 * Bug surfaced post-LIS: removing a unit from the class page (which
 * does a soft-toggle `UPDATE class_units SET is_active=false`) left
 * the unit page's "assigned classes" toggle list still showing the
 * class as assigned. The unit page was reading every class_units row
 * for the unit regardless of `is_active`, so soft-removed rows
 * surfaced as active.
 *
 * Fix:
 *   1. Filter the unit page's class_units read on `is_active=true`.
 *   2. Normalise the unit page's "remove" write to soft-toggle
 *      (`UPDATE is_active=false`) instead of hard DELETE — matches the
 *      class page's pattern + preserves per-class metadata (term_id,
 *      nm_config, forked content) so a re-toggle restores state.
 *
 * Source-static — mirrors the dispatch-test pattern used across the
 * codebase.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const UNIT_PAGE_SRC = readFileSync(
  join(__dirname, "..", "page.tsx"),
  "utf-8",
);

const CLASS_PAGE_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "classes",
    "[classId]",
    "page.tsx",
  ),
  "utf-8",
);

describe("Unit page — class_units read filters on is_active=true", () => {
  it("the assignment-list fetch filters on is_active=true (soft-removed rows excluded)", () => {
    // Pre-fix the line was:
    //   .from("class_units").select(...).eq("unit_id", unitId)
    // Post-fix it gains:
    //   .eq("is_active", true)
    expect(UNIT_PAGE_SRC).toMatch(
      /from\("class_units"\)[\s\S]{0,300}\.eq\("unit_id", unitId\)[\s\S]{0,200}\.eq\("is_active", true\)/,
    );
  });
});

describe("Unit page — remove uses soft-toggle (consistent with class page)", () => {
  it("removeAssignment path UPDATEs is_active=false (not DELETE)", () => {
    // Look for the currentlyAssigned branch — the remove path.
    const idx = UNIT_PAGE_SRC.indexOf("if (currentlyAssigned)");
    expect(idx).toBeGreaterThan(0);
    const slice = UNIT_PAGE_SRC.slice(idx, idx + 800);
    expect(slice).toContain(`.update({ is_active: false })`);
    // Hard DELETE on class_units must be gone from this branch.
    expect(slice).not.toMatch(/\.from\("class_units"\)[\s\S]{0,200}\.delete\(\)/);
  });

  it("re-activation path upserts is_active=true (preserved)", () => {
    // The else branch is the re-activation — upsert flips is_active
    // back to true if a prior soft-removed row exists.
    expect(UNIT_PAGE_SRC).toMatch(
      /\.upsert\(\{[\s\S]{0,200}is_active:\s*true/,
    );
  });
});

describe("Class page — toggle pattern unchanged (the reference for symmetry)", () => {
  it("class page's toggleUnit still uses UPDATE is_active for existing rows", () => {
    // Sanity check that this was the existing convention I'm matching.
    expect(CLASS_PAGE_SRC).toMatch(
      /from\("class_units"\)[\s\S]{0,200}\.update\(\{\s*is_active:\s*isActive\s*\}\)/,
    );
  });
});
