/**
 * Shape-lock guard tests for the three Phase 2 render-path fixtures.
 *
 * Purpose: lock the structural invariants of the fixtures consumed by 5.10.3
 * (student lesson), 5.10.4 (student grades), and 5.10.5 (teacher grading
 * regression). Semantic assertions (expectedLabels === adapter output) land
 * in those downstream sub-steps. This file is structure-only.
 *
 * Fixtures live at tests/fixtures/phase-2/render-paths-*.json and carry an
 * embedded expectedLabels block plus a _source field naming the capture
 * origin + date. Any 5.9 adapter or legacy getFrameworkCriterion change that
 * alters labels surfaces as a fixture-file diff, not silent test drift.
 *
 * Sub-step 5.10.1 of Dimensions3 v2 Phase 2.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/phase-2");

function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8"));
}

describe("render-path fixtures — shape lock (5.10.1)", () => {
  it("student-lesson fixture: framework=GCSE_DT + required fields + lesson shape", () => {
    const f = loadFixture("render-paths-student-lesson.json") as {
      class: { framework: string };
      currentPage: { type: string };
      pageContent: { sections: Array<{ criterionTags: unknown }> };
      expectedLabels: Record<string, unknown>;
    };

    expect(f.class.framework).toBe("GCSE_DT");
    expect(f).toHaveProperty("class");
    expect(f).toHaveProperty("currentPage");
    expect(f).toHaveProperty("pageContent");
    expect(f).toHaveProperty("expectedLabels");

    expect(f.currentPage.type).toBe("lesson");
    expect(f.pageContent.sections.length).toBeGreaterThan(0);
    for (const section of f.pageContent.sections) {
      expect(Array.isArray(section.criterionTags)).toBe(true);
    }

    expect(Object.keys(f.expectedLabels).sort()).toEqual([
      "analysing",
      "creating",
      "designing",
      "researching",
    ]);
  });

  it("student-grades fixture: framework=GCSE_DT + array-shaped criterion_scores + AO-keyed expectedLabels", () => {
    const f = loadFixture("render-paths-student-grades.json") as {
      class: { framework: string };
      unitTitle: string;
      assessment: { criterion_scores: unknown };
      expectedLabels: Record<string, { short?: unknown; full?: unknown; name?: unknown }>;
    };

    expect(f.class.framework).toBe("GCSE_DT");
    expect(f).toHaveProperty("class");
    expect(f).toHaveProperty("unitTitle");
    expect(f).toHaveProperty("assessment");
    expect(f).toHaveProperty("expectedLabels");

    // H.1 decision: server canonical shape is ARRAY, not Record<string, CriterionScore>
    expect(Array.isArray(f.assessment.criterion_scores)).toBe(true);
    expect((f.assessment.criterion_scores as unknown[]).length).toBe(4);

    expect(Object.keys(f.expectedLabels).sort()).toEqual(["AO1", "AO2", "AO3", "AO4"]);
    for (const key of ["AO1", "AO2", "AO3", "AO4"]) {
      const label = f.expectedLabels[key];
      expect(label).toHaveProperty("short");
      expect(label).toHaveProperty("full");
      expect(label).toHaveProperty("name");
    }
  });

  it("teacher-grading fixture: framework=GCSE_DT + design unit + non-empty students + 5-field legacy expectedLabels", () => {
    const f = loadFixture("render-paths-teacher-grading.json") as {
      class: { framework: string };
      unit: { unit_type: string };
      students: unknown[];
      expectedLabels: Record<
        string,
        {
          key?: unknown;
          name?: unknown;
          color?: unknown;
          bgClass?: unknown;
          textClass?: unknown;
        }
      >;
    };

    expect(f.class.framework).toBe("GCSE_DT");
    expect(f).toHaveProperty("class");
    expect(f).toHaveProperty("unit");
    expect(f).toHaveProperty("students");
    expect(f).toHaveProperty("expectedLabels");

    expect(f.unit.unit_type).toBe("design");
    expect(f.students.length).toBeGreaterThan(0);

    expect(Object.keys(f.expectedLabels).sort()).toEqual(["AO1", "AO2", "AO3", "AO4"]);
    // H.2 decision: regression-lock all 5 legacy CriterionDefinition fields
    for (const key of ["AO1", "AO2", "AO3", "AO4"]) {
      const label = f.expectedLabels[key];
      expect(label).toHaveProperty("key");
      expect(label).toHaveProperty("name");
      expect(label).toHaveProperty("color");
      expect(label).toHaveProperty("bgClass");
      expect(label).toHaveProperty("textClass");
    }
  });
});

/**
 * Wiring-lock guard for 5.10.3 student lesson page integration.
 *
 * These are source-static greps that assert the badge-block wiring is
 * actually in place. They fire if someone reverts the chip helper wiring
 * back to the old `.flatMap().filter().map()` pipeline or forgets to thread
 * `framework` through to collectCriterionChips.
 *
 * Not behavioral — they do not render the page or exercise the helper.
 * The G9 describe block in render-helpers.test.ts covers behavior.
 */
describe("render-path wiring lock — student lesson page (5.10.3)", () => {
  const PAGE_PATH = join(
    process.cwd(),
    "src/app/(student)/unit/[unitId]/[pageId]/page.tsx",
  );
  const pageSource = readFileSync(PAGE_PATH, "utf8");

  it("imports collectCriterionChips from @/lib/frameworks/render-helpers", () => {
    expect(pageSource).toMatch(
      /import\s*\{\s*collectCriterionChips\s*\}\s*from\s*["']@\/lib\/frameworks\/render-helpers["']/,
    );
  });

  it("destructures classInfo from useStudent()", () => {
    expect(pageSource).toMatch(
      /const\s*\{\s*student\s*,\s*classInfo\s*\}\s*=\s*useStudent\(\)/,
    );
  });

  it("falls back to 'IB_MYP' when classInfo.framework is null/undefined", () => {
    expect(pageSource).toMatch(/\?\?\s*["']IB_MYP["']/);
  });

  it("badge block no longer uses CRITERIA[tag as CriterionKey] lookup", () => {
    // CRITERIA is still imported (strand header path at ~line 107 uses it),
    // but the badge block inner pipeline must not.
    const badgeBlockMatch = pageSource.match(
      /\{\s*\/\*\s*Badges\s*\*\/\s*\}[\s\S]*?collectCriterionChips\([\s\S]*?\)\.map\(/,
    );
    expect(badgeBlockMatch).not.toBeNull();
    // And the old pattern `CRITERIA[tag as CriterionKey]` must not appear
    // inside the badge block segment.
    const badgeSegment = badgeBlockMatch?.[0] ?? "";
    expect(badgeSegment).not.toMatch(/CRITERIA\[tag\s+as\s+CriterionKey\]/);
  });

  it("calls collectCriterionChips with (pageContent.sections, framework)", () => {
    expect(pageSource).toMatch(
      /collectCriterionChips\s*\(\s*pageContent\.sections\s*,\s*framework\s*\)/,
    );
  });
});
