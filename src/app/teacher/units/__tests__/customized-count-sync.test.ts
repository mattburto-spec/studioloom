/**
 * "X class has customized this unit" + "1 class" badge + "Customized"
 * card pill — schema-aligned with the unit/class assignment sync fix.
 *
 * Bug Matt caught after PR #189 (toggle list fix) landed: the toggle
 * list correctly showed "0 of 6 assigned," but TWO other read sites
 * still surfaced the soft-removed assignment:
 *   1. The unit detail page's "1 class has customized this unit"
 *      banner — fed by /api/teacher/units/versions which read every
 *      forked class_units row regardless of is_active.
 *   2. The units listing page's per-card "1 class" + class-name pill
 *      + "Customized" badge — fed by an unfiltered class_units query
 *      driving classMap.
 *
 * Fix: add .eq("is_active", true) to both reads. Same root cause as
 * PR #189; the audit FU (FU-CLASS-UNITS-IS-ACTIVE-AUDIT) called this
 * pattern out — this PR closes 2 of those ~20 surfaces.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const UNITS_LIST_SRC = readFileSync(
  join(__dirname, "..", "page.tsx"),
  "utf-8",
);

const VERSIONS_ROUTE_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "api",
    "teacher",
    "units",
    "versions",
    "route.ts",
  ),
  "utf-8",
);

describe("Units listing — classMap filters on is_active=true", () => {
  it("class_units fetch chains .eq('is_active', true) so soft-removed assignments are excluded from card badges", () => {
    expect(UNITS_LIST_SRC).toMatch(
      /from\("class_units"\)\s*\.select\([\s\S]{0,200}\.eq\("is_active",\s*true\)/,
    );
  });
});

describe("Units versions route — fork count filters on is_active=true", () => {
  it("class_units fetch chains .eq('is_active', true) so soft-removed forked rows don't surface in the 'X class has customized' banner", () => {
    expect(VERSIONS_ROUTE_SRC).toMatch(
      /from\("class_units"\)[\s\S]{0,500}\.eq\("is_active",\s*true\)/,
    );
    // Sanity: the not-null forked_at filter stays so this still only counts ACTUAL forks
    expect(VERSIONS_ROUTE_SRC).toMatch(
      /\.not\("content_data", "is", null\)/,
    );
  });
});
