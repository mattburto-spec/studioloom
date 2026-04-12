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

/**
 * Wiring-lock guard for 5.10.4 student grades page integration.
 *
 * Source-static greps asserting the grades page is wired to:
 *   - the canonical criterion_scores normalizer (4-shape absorber)
 *   - the canonical FrameworkAdapter import path (@/lib/frameworks/adapter)
 *   - classInfo.framework with IB_MYP fallback (not the dead student var)
 *   - getCriterionLabels(framework) iteration (not Object.keys(CRITERIA))
 *
 * These lock the H.1 dual-shape fix + the round-2 drift correction (5.10.4
 * Pre-Edit Mini-Report caught a design-block typo pointing imports at the
 * @/lib/frameworks barrel which is the Open Studio unit-types registry).
 */
describe("render-path wiring lock — student grades page (5.10.4)", () => {
  const PAGE_PATH = join(
    process.cwd(),
    "src/app/(student)/unit/[unitId]/grades/page.tsx",
  );
  const pageSource = readFileSync(PAGE_PATH, "utf8");

  it("L1: imports normalizeCriterionScores from @/lib/criterion-scores/normalize", () => {
    expect(pageSource).toMatch(
      /import\s*\{\s*normalizeCriterionScores\s*\}\s*from\s*["']@\/lib\/criterion-scores\/normalize["']/,
    );
  });

  it("L2a: imports getCriterionLabels from @/lib/frameworks/adapter (canonical path)", () => {
    expect(pageSource).toMatch(
      /import\s*\{\s*getCriterionLabels\s*\}\s*from\s*["']@\/lib\/frameworks\/adapter["']/,
    );
  });

  it("L2b: imports type FrameworkId from @/lib/frameworks/adapter (canonical path)", () => {
    expect(pageSource).toMatch(
      /import\s+type\s*\{\s*FrameworkId\s*\}\s*from\s*["']@\/lib\/frameworks\/adapter["']/,
    );
  });

  it("L2c: does NOT import from @/lib/frameworks barrel (Open Studio registry collision)", () => {
    expect(pageSource).not.toMatch(
      /getCriterionLabels[^;]*from\s*["']@\/lib\/frameworks["']\s*;/,
    );
    expect(pageSource).not.toMatch(
      /FrameworkId[^;]*from\s*["']@\/lib\/frameworks["']\s*;/,
    );
  });

  it("L3: destructures classInfo from useStudent (not the dead student var)", () => {
    expect(pageSource).toMatch(
      /const\s*\{\s*classInfo\s*\}\s*=\s*useStudent\(\)/,
    );
    expect(pageSource).not.toMatch(/const\s+student\s*=\s*useStudent\(\)/);
  });

  it("L4: falls back to 'IB_MYP' when classInfo.framework is null/undefined", () => {
    expect(pageSource).toMatch(
      /classInfo\?\.framework as FrameworkId[^?]*\?\?\s*["']IB_MYP["']/,
    );
  });

  it("L5: iterates getCriterionLabels(framework) instead of Object.keys(CRITERIA)", () => {
    expect(pageSource).toMatch(/getCriterionLabels\(framework\)/);
    expect(pageSource).not.toMatch(/Object\.keys\(CRITERIA\)/);
  });

  it("L6: no longer imports CRITERIA/CriterionKey from @/lib/constants", () => {
    expect(pageSource).not.toMatch(
      /import[^;]*\b(CRITERIA|CriterionKey)\b[^;]*from\s*["']@\/lib\/constants["']/,
    );
  });

  it("L7: normalizes criterion_scores through the absorber (no bracket access)", () => {
    expect(pageSource).toMatch(
      /normalizeCriterionScores\(\s*assessment\.criterion_scores\s*,?\s*\)/,
    );
    expect(pageSource).not.toMatch(/scores\[key\]/);
  });
});

/**
 * Wiring-lock guard for teacher grading pages — adapter migration (§4.5c).
 *
 * These pages have been migrated from legacy `getFrameworkCriterion` to
 * FrameworkAdapter (`getCriterionLabels` + `getCriterionColor`). These locks
 * ensure the adapter wiring survives. If someone reverts to legacy imports,
 * these tests break.
 */
describe("render-path wiring lock — teacher grading pages (§4.5c)", () => {
  const GRADING_PAGE_1 = join(
    process.cwd(),
    "src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx",
  );
  const GRADING_PAGE_2 = join(
    process.cwd(),
    "src/app/teacher/units/[unitId]/class/[classId]/page.tsx",
  );
  const gradingPage1 = readFileSync(GRADING_PAGE_1, "utf8");
  const gradingPage2 = readFileSync(GRADING_PAGE_2, "utf8");

  it("G1: grading/[unitId]/page.tsx imports getCriterionLabels from adapter", () => {
    expect(gradingPage1).toMatch(
      /import\s*\{\s*getCriterionLabels\s*\}\s*from\s*["']@\/lib\/frameworks\/adapter["']/,
    );
  });

  it("G2: grading/[unitId]/page.tsx imports getCriterionColor from render-helpers", () => {
    expect(gradingPage1).toMatch(
      /import\s*\{\s*getCriterionColor\s*\}\s*from\s*["']@\/lib\/frameworks\/render-helpers["']/,
    );
  });

  it("G3: class/[classId]/page.tsx imports getCriterionLabels from adapter", () => {
    expect(gradingPage2).toMatch(
      /import\s*\{\s*getCriterionLabels\s*\}\s*from\s*["']@\/lib\/frameworks\/adapter["']/,
    );
  });

  it("G4: class/[classId]/page.tsx imports getCriterionColor from render-helpers", () => {
    expect(gradingPage2).toMatch(
      /import\s*\{\s*getCriterionColor\s*\}\s*from\s*["']@\/lib\/frameworks\/render-helpers["']/,
    );
  });

  it("G5: grading/[unitId]/page.tsx no longer imports getFrameworkCriterion from constants", () => {
    expect(gradingPage1).not.toMatch(
      /import[^;]*\bgetFrameworkCriterion\b[^;]*from\s*["']@\/lib\/constants["']/,
    );
  });

  it("G6: class/[classId]/page.tsx no longer imports getFrameworkCriterion from constants", () => {
    expect(gradingPage2).not.toMatch(
      /import[^;]*\bgetFrameworkCriterion\b[^;]*from\s*["']@\/lib\/constants["']/,
    );
  });
});

/**
 * Wiring-lock guard for §4.5a LessonSidebar adapter migration.
 */
describe("render-path wiring lock — LessonSidebar (§4.5a)", () => {
  const SIDEBAR_PATH = join(
    process.cwd(),
    "src/components/student/LessonSidebar.tsx",
  );
  const sidebarSource = readFileSync(SIDEBAR_PATH, "utf8");

  it("S1: imports renderCriterionLabel + getCriterionColor from render-helpers", () => {
    expect(sidebarSource).toMatch(
      /import\s*\{[^}]*renderCriterionLabel[^}]*\}\s*from\s*["']@\/lib\/frameworks\/render-helpers["']/,
    );
    expect(sidebarSource).toMatch(
      /import\s*\{[^}]*getCriterionColor[^}]*\}\s*from\s*["']@\/lib\/frameworks\/render-helpers["']/,
    );
  });

  it("S2: imports FrameworkId from adapter", () => {
    expect(sidebarSource).toMatch(
      /import\s+type\s*\{[^}]*FrameworkId[^}]*\}\s*from\s*["']@\/lib\/frameworks\/adapter["']/,
    );
  });

  it("S3: destructures classInfo from useStudent()", () => {
    expect(sidebarSource).toMatch(/useStudent\(\)/);
    expect(sidebarSource).toMatch(/classInfo/);
  });

  it("S4: no longer imports getCriterionDisplay from constants", () => {
    expect(sidebarSource).not.toMatch(
      /import[^;]*\bgetCriterionDisplay\b[^;]*from\s*["']@\/lib\/constants["']/,
    );
  });
});

/**
 * Wiring-lock guard for §4.5b unit editor adapter migration.
 */
describe("render-path wiring lock — unit editor (§4.5b)", () => {
  const EDITOR_PATH = join(
    process.cwd(),
    "src/app/teacher/units/[unitId]/page.tsx",
  );
  const editorSource = readFileSync(EDITOR_PATH, "utf8");

  it("U1: imports renderCriterionLabel + getCriterionColor from render-helpers", () => {
    expect(editorSource).toMatch(
      /import\s*\{[^}]*renderCriterionLabel[^}]*\}\s*from\s*["']@\/lib\/frameworks\/render-helpers["']/,
    );
    expect(editorSource).toMatch(
      /import\s*\{[^}]*getCriterionColor[^}]*\}\s*from\s*["']@\/lib\/frameworks\/render-helpers["']/,
    );
  });

  it("U2: imports FrameworkId from adapter", () => {
    expect(editorSource).toMatch(
      /import\s+type\s*\{[^}]*FrameworkId[^}]*\}\s*from\s*["']@\/lib\/frameworks\/adapter["']/,
    );
  });

  it("U3: no longer uses CRITERION_COLORS constant in executable code", () => {
    // CRITERION_COLORS was removed in §4.5b; color now comes from getCriterionColor.
    // A comment mentioning the removal is fine — only match non-comment usage.
    const nonCommentLines = editorSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"));
    const hasUsage = nonCommentLines.some((line: string) => /\bCRITERION_COLORS\b/.test(line));
    expect(hasUsage).toBe(false);
  });
});

/**
 * Smoke test for admin FrameworkAdapter test panel (§4.6).
 */
describe("admin/framework-adapter page smoke test (§4.6)", () => {
  const ADMIN_PAGE = join(
    process.cwd(),
    "src/app/admin/framework-adapter/page.tsx",
  );
  const adminSource = readFileSync(ADMIN_PAGE, "utf8");

  it("imports getCriterionLabels + toLabel + fromLabel from @/lib/frameworks/adapter", () => {
    expect(adminSource).toMatch(
      /import\s*\{[^}]*getCriterionLabels[^}]*\}\s*from\s*["']@\/lib\/frameworks\/adapter["']/,
    );
    expect(adminSource).toMatch(
      /import\s*\{[^}]*toLabel[^}]*\}\s*from\s*["']@\/lib\/frameworks\/adapter["']/,
    );
    expect(adminSource).toMatch(
      /import\s*\{[^}]*fromLabel[^}]*\}\s*from\s*["']@\/lib\/frameworks\/adapter["']/,
    );
  });

  it("imports getCriterionColor from render-helpers", () => {
    expect(adminSource).toMatch(
      /import\s*\{\s*getCriterionColor\s*\}\s*from\s*["']@\/lib\/frameworks\/render-helpers["']/,
    );
  });

  it("has all 4 tab components (Matrix, BatchValidation, RoundTrip, GradingSimulation)", () => {
    expect(adminSource).toMatch(/function MatrixTab/);
    expect(adminSource).toMatch(/function BatchValidationTab/);
    expect(adminSource).toMatch(/function RoundTripTab/);
    expect(adminSource).toMatch(/function GradingSimulationTab/);
  });
});

/**
 * Wiring-lock guard for 5.13: no hardcoded model IDs in production code.
 *
 * Scans all .ts/.tsx files in src/ (excluding tests, models.ts itself,
 * and markdown docs) for raw model ID strings. If any site re-hardcodes
 * a model string instead of using MODELS.SONNET / MODELS.HAIKU, this
 * test fails.
 */
describe("no hardcoded model IDs in production code (5.13)", () => {
  const { execSync } = require("child_process");
  const cwd = process.cwd();

  function countHardcoded(modelId: string): number {
    try {
      // grep production .ts/.tsx files, excluding tests, models.ts, and docs
      const result = execSync(
        `grep -rn '"${modelId}"' src/ --include="*.ts" --include="*.tsx" | ` +
          `grep -v __tests__ | grep -v ".test." | grep -v "models.ts" | grep -v "API-DOCS" | wc -l`,
        { cwd, encoding: "utf8" },
      );
      return parseInt(result.trim(), 10);
    } catch {
      // grep returns exit 1 when no matches — that's the success case
      return 0;
    }
  }

  it("no hardcoded claude-sonnet-4-20250514 outside models.ts and tests", () => {
    expect(countHardcoded("claude-sonnet-4-20250514")).toBe(0);
  });

  it("no hardcoded claude-haiku-4-5-20251001 outside models.ts and tests", () => {
    expect(countHardcoded("claude-haiku-4-5-20251001")).toBe(0);
  });
});
