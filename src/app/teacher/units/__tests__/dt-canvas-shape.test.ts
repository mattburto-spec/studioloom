/**
 * DT Class Canvas — shape lock (Phase 3.1 Step 5, 16 May 2026).
 *
 * Source-static guards locking the canvas layout, kebab/Teach/Edit
 * affordances, student grid + filter chip set, drawer wiring, the
 * legacy ?tab=... compat handler, and the absence of the old tab
 * bar + the dead inline student-detail modal.
 *
 * These guards complement the existing integrity-dot-logic guards
 * (which lock the per-row integrity dot rendering inside the same
 * grid) and the NMElementsPanel / UnitAttentionPanel "Class Hub
 * wiring" guards (which stay skipped until Phase 3.2 reattaches
 * those surfaces via the side-rail card CTAs).
 *
 * No DOM rendering — pure regex over the page source. Same shape
 * as integrity-dot-logic.test.ts + render-path-fixtures.test.ts so
 * the canvas guards live alongside the patterns they protect.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const HUB_SRC = readFileSync(
  join(
    process.cwd(),
    "src/app/teacher/units/[unitId]/class/[classId]/page.tsx",
  ),
  "utf-8",
);

describe("DT canvas — header shape", () => {
  it("renders a ▶ Teach link (G11 sign-off — mockup omits it; we keep it)", () => {
    // Distance bumped to 800 to absorb the play-glyph SVG between
    // the href + the visible "Teach" label.
    expect(HUB_SRC).toMatch(
      /href=\{`\/teacher\/teach\/\$\{unitId\}\?classId=\$\{classId\}`\}[\s\S]{0,800}Teach/,
    );
  });

  it("renders an Edit unit link to /teacher/units/[unitId]/class/[classId]/edit", () => {
    expect(HUB_SRC).toMatch(
      /href=\{`\/teacher\/units\/\$\{unitId\}\/class\/\$\{classId\}\/edit`\}[\s\S]{0,800}Edit/,
    );
  });

  it("renders a canvas-header kebab stub (data-testid=canvas-header-kebab)", () => {
    expect(HUB_SRC).toContain('data-testid="canvas-header-kebab"');
  });

  it("kebab is disabled in Phase 3.1 (real items wire in 3.4)", () => {
    // Anchor on the kebab testid, then look for the disabled prop
    // on the same element within a short slice.
    const idx = HUB_SRC.indexOf('data-testid="canvas-header-kebab"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toMatch(/disabled\b/);
  });
});

describe("DT canvas — main grid + side rail layout", () => {
  it("mounts data-testid=dt-canvas-grid (top-level grid wrapper)", () => {
    expect(HUB_SRC).toContain('data-testid="dt-canvas-grid"');
  });

  it("renders the four side-rail placeholder cards", () => {
    expect(HUB_SRC).toContain('data-testid="canvas-rail-card-marking"');
    expect(HUB_SRC).toContain('data-testid="canvas-rail-card-studio"');
    expect(HUB_SRC).toContain('data-testid="canvas-rail-card-metrics"');
    expect(HUB_SRC).toContain('data-testid="canvas-rail-card-safety"');
  });

  it("reserves slots for the lesson hero (Phase 3.3) and gallery strip (Phase 3.5)", () => {
    expect(HUB_SRC).toContain('data-testid="canvas-lesson-hero"');
    expect(HUB_SRC).toContain('data-testid="canvas-gallery-strip"');
  });

  it("side rail is sticky on lg+ screens", () => {
    const idx = HUB_SRC.indexOf('data-testid="canvas-side-rail"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toMatch(/lg:sticky/);
  });
});

describe("DT canvas — student grid + filter chips", () => {
  it("mounts data-testid=canvas-student-grid (Phase 3.1 Step 3)", () => {
    expect(HUB_SRC).toContain('data-testid="canvas-student-grid"');
  });

  it("renders the + Add student trigger (data-testid=student-grid-add-student)", () => {
    expect(HUB_SRC).toContain('data-testid="student-grid-add-student"');
  });

  it("+ Add student opens StudentRosterDrawer (Step 4 wiring)", () => {
    const idx = HUB_SRC.indexOf('data-testid="student-grid-add-student"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toMatch(/onClick=\{[\s\S]{0,100}setRosterDrawerOpen\(true\)/);
  });

  it("filter chip set carries the four canonical labels (G-spec)", () => {
    // testid is rendered via template literal `student-filter-${f.id}`;
    // the STUDENT_FILTERS const declares the four ids + labels, which
    // is the canonical contract this guard locks.
    expect(HUB_SRC).toMatch(/data-testid=\{`student-filter-\$\{f\.id\}`\}/);
    expect(HUB_SRC).toMatch(/\{\s*id:\s*"all"\s*,\s*label:\s*"All students"\s*\}/);
    expect(HUB_SRC).toMatch(/\{\s*id:\s*"marking"\s*,\s*label:\s*"Marking due"\s*\}/);
    expect(HUB_SRC).toMatch(/\{\s*id:\s*"flagged"\s*,\s*label:\s*"Flagged"\s*\}/);
    expect(HUB_SRC).toMatch(/\{\s*id:\s*"studio"\s*,\s*label:\s*"In Open Studio"\s*\}/);
  });

  it("Today dot uses G10 colour thresholds (24h emerald / 3d amber / >3d rose)", () => {
    // todayDotClass helper anchors the contract. Walk the slice and
    // confirm all three colour classes appear in the correct branch.
    const idx = HUB_SRC.indexOf("function todayDotClass");
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 600);
    expect(slice).toMatch(/bg-emerald-500/);
    expect(slice).toMatch(/bg-amber-400/);
    expect(slice).toMatch(/bg-rose-500/);
  });
});

describe("DT canvas — drawer + roster wiring", () => {
  it("imports StudentDrawer + StudentRosterDrawer from class-hub", () => {
    expect(HUB_SRC).toMatch(
      /import\s+StudentDrawer\s+from\s+["']@\/components\/teacher\/class-hub\/StudentDrawer["']/,
    );
    expect(HUB_SRC).toMatch(
      /import\s+StudentRosterDrawer\s+from\s+["']@\/components\/teacher\/class-hub\/StudentRosterDrawer["']/,
    );
  });

  it("passes the pageId qualifier through to StudentDrawer (G9 + new contract)", () => {
    const idx = HUB_SRC.indexOf("<StudentDrawer");
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 600);
    expect(slice).toMatch(/pageId=\{drawerPageId\}/);
  });

  it("mounts StudentRosterDrawer gated on rosterDrawerOpen", () => {
    expect(HUB_SRC).toMatch(
      /rosterDrawerOpen\s*&&\s*\(\s*<StudentRosterDrawer/,
    );
  });
});

describe("DT canvas — legacy ?tab= compat handler (G12 sign-off)", () => {
  it("declares the one-shot guard ref (legacyTabCompatFired)", () => {
    expect(HUB_SRC).toContain("legacyTabCompatFired");
  });

  it("redirects ?tab=grade to /teacher/marking with class+unit qualifiers", () => {
    expect(HUB_SRC).toMatch(
      /tab\s*===\s*"grade"[\s\S]{0,300}router\.replace\(`\/teacher\/marking\?class=\$\{classId\}&unit=\$\{unitId\}`\)/,
    );
  });

  it("routes ?tab=students to the roster drawer", () => {
    expect(HUB_SRC).toMatch(
      /tab\s*===\s*"students"[\s\S]{0,200}setRosterDrawerOpen\(true\)/,
    );
  });

  it("drops the tab/student/page params from the URL after handling", () => {
    // The compat handler must clear all three so the canvas URL is
    // canonical state.
    expect(HUB_SRC).toMatch(/url\.searchParams\.delete\(\s*["']tab["']\s*\)/);
    expect(HUB_SRC).toMatch(/url\.searchParams\.delete\(\s*["']student["']\s*\)/);
    expect(HUB_SRC).toMatch(/url\.searchParams\.delete\(\s*["']page["']\s*\)/);
  });
});

describe("DT canvas — absence guards (the rebuild stripped these)", () => {
  it("the old TABS array (Progress / Students / Gallery / …) is gone", () => {
    expect(HUB_SRC).not.toMatch(/const\s+TABS\s*:\s*\{\s*id\s*:\s*HubTab/);
  });

  it("the HubTab union type is gone (canvas has no tabs)", () => {
    expect(HUB_SRC).not.toMatch(/type\s+HubTab\s*=/);
  });

  it("the inline student-detail modal is gone (G9 kill)", () => {
    // The old modal was triggered by selectedDetailStudent + loaded
    // via loadStudentDetail. Neither symbol may resurface in this file.
    expect(HUB_SRC).not.toContain("selectedDetailStudent");
    expect(HUB_SRC).not.toContain("loadStudentDetail");
    expect(HUB_SRC).not.toContain("setSelectedDetailStudent");
  });

  it("the dead grade-tab assessments state is gone", () => {
    // Sanity check that Step 1's strip stayed clean across Steps 2-4.
    expect(HUB_SRC).not.toMatch(/setAssessments\s*\(/);
    expect(HUB_SRC).not.toMatch(/saveGradeAssessment/);
  });

  it("ClassProfileOverview + PaceFeedbackSummary are no longer mounted (G7 sign-off)", () => {
    // Imports may still exist if other surfaces use them; the lock
    // here is that they aren't rendered from this page any more.
    expect(HUB_SRC).not.toMatch(/<ClassProfileOverview\b/);
    expect(HUB_SRC).not.toMatch(/<PaceFeedbackSummary\b/);
  });
});
