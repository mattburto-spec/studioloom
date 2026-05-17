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
    "src/components/teacher/class-hub/ClassCanvas.tsx",
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

  // ─── Phase 3.4 Step 1 (16 May 2026) ──────────────────────────────────
  // Stub kebab replaced by a live KebabMenu dropdown. testId="canvas-
  // header-kebab" prop sets the wrapper's data-testid at runtime. The
  // disabled-state guard inverted — the kebab is no longer disabled
  // since real items are wired.
  it("renders a canvas-header KebabMenu (testId=canvas-header-kebab)", () => {
    expect(HUB_SRC).toMatch(/testId=["']canvas-header-kebab["']/);
    // KebabMenu component imported
    expect(HUB_SRC).toMatch(
      /import\s+KebabMenu[\s\S]{0,80}from\s+["']@\/components\/teacher\/class-hub\/KebabMenu["']/
    );
  });

  it("Phase 3.4: kebab is no longer disabled — items wired", () => {
    // The Phase 3.1 stub had a `disabled` prop on a bare <button>. The
    // KebabMenu replacement doesn't pass disabled at all on the wrapper.
    // Anchor: the canvas-header-kebab testId should NOT sit within 400
    // chars of a `disabled` attribute (which would indicate the stub
    // came back).
    const idx = HUB_SRC.search(/testId=["']canvas-header-kebab["']/);
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).not.toMatch(/disabled\b/);
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

  it("reserves the lesson hero slot in the main column (Phase 3.3)", () => {
    // Phase 3.5 originally also reserved canvas-gallery-strip in the
    // main column. The rail-reorder fix (17 May 2026) moved gallery
    // into the side rail as canvas-rail-card-gallery — main column is
    // now just lesson-hero + student grid.
    expect(HUB_SRC).toContain('data-testid="canvas-lesson-hero"');
    expect(HUB_SRC).not.toContain('data-testid="canvas-gallery-strip"');
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

// ═════════════════════════════════════════════════════════════════════════════
// Phase 3.2 — side-rail cards + drawers
// ═════════════════════════════════════════════════════════════════════════════

describe("DT canvas Phase 3.2 — side-rail Marking card", () => {
  it("renders a derived count + Open marking → CTA", () => {
    expect(HUB_SRC).toContain('data-testid="rail-marking-count"');
    expect(HUB_SRC).toContain('data-testid="rail-marking-cta"');
    expect(HUB_SRC).toContain("Open marking →");
  });

  it("Marking CTA routes externally to /teacher/marking with class+unit context", () => {
    const idx = HUB_SRC.indexOf('data-testid="rail-marking-cta"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toMatch(/href=\{`\/teacher\/marking\?class=\$\{classId\}&unit=\$\{unitId\}`\}/);
  });

  it("derives oldestDays from a per-student oldestDraftAtMap loaded in loadProgressData", () => {
    expect(HUB_SRC).toContain("oldestDraftAtMap");
    expect(HUB_SRC).toContain("setOldestDraftAtMap");
  });

  it("'All clear' empty-state copy when total is zero", () => {
    expect(HUB_SRC).toContain("All clear — nothing to mark.");
  });
});

describe("DT canvas Phase 3.2 — side-rail Safety card + drawer", () => {
  it("renders a derived 'X/Y workshop ready' count + Manage badges → CTA", () => {
    expect(HUB_SRC).toContain('data-testid="rail-safety-count"');
    expect(HUB_SRC).toContain('data-testid="rail-safety-cta"');
    expect(HUB_SRC).toContain("workshop ready");
    expect(HUB_SRC).toContain("Manage badges →");
  });

  it("Safety CTA opens SafetyDrawer (setSafetyDrawerOpen(true))", () => {
    const idx = HUB_SRC.indexOf('data-testid="rail-safety-cta"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toMatch(/onClick=\{[\s\S]{0,80}setSafetyDrawerOpen\(true\)/);
  });

  it("page.tsx imports + mounts SafetyDrawer gated on safetyDrawerOpen", () => {
    expect(HUB_SRC).toMatch(
      /import\s+SafetyDrawer\s+from\s+["']@\/components\/teacher\/class-hub\/SafetyDrawer["']/
    );
    expect(HUB_SRC).toMatch(/safetyDrawerOpen\s*&&\s*\(\s*<SafetyDrawer/);
  });

  it("Safety empty-state when no badges are required for this unit", () => {
    expect(HUB_SRC).toContain("No badges required for this unit.");
  });
});

describe("DT canvas Phase 3.2 — side-rail Open Studio card + row pill + drawer", () => {
  it("renders a derived count + Manage/View CTA", () => {
    expect(HUB_SRC).toContain('data-testid="rail-studio-count"');
    expect(HUB_SRC).toContain('data-testid="rail-studio-cta"');
    expect(HUB_SRC).toContain("in studio mode");
  });

  it("Studio CTA opens OpenStudioDrawer", () => {
    const idx = HUB_SRC.indexOf('data-testid="rail-studio-cta"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toMatch(/onClick=\{[\s\S]{0,80}setOpenStudioDrawerOpen\(true\)/);
  });

  it("page.tsx imports + mounts OpenStudioDrawer gated on openStudioDrawerOpen", () => {
    expect(HUB_SRC).toMatch(
      /import\s+OpenStudioDrawer\s+from\s+["']@\/components\/teacher\/class-hub\/OpenStudioDrawer["']/
    );
    expect(HUB_SRC).toMatch(/openStudioDrawerOpen\s*&&\s*\(\s*<OpenStudioDrawer/);
  });

  it("loadProgressData fetches /api/teacher/open-studio/status to populate openStudioStatusMap", () => {
    expect(HUB_SRC).toContain("openStudioStatusMap");
    expect(HUB_SRC).toMatch(
      /fetch\(`\/api\/teacher\/open-studio\/status\?unitId=\$\{unitId\}&classId=\$\{classId\}`\)/
    );
  });

  it("per-row Studio pill: 'In Studio' badge gated on status === 'unlocked'", () => {
    expect(HUB_SRC).toMatch(
      /openStudioStatusMap\[student\.id\]\?\.status\s*===\s*"unlocked"[\s\S]{0,300}In Studio/
    );
  });
});

describe("DT canvas Phase 3.2 — side-rail Metrics card + row dots + drawer", () => {
  it("renders a derived avg count + Score/Open CTA", () => {
    expect(HUB_SRC).toContain('data-testid="rail-metrics-count"');
    expect(HUB_SRC).toContain('data-testid="rail-metrics-cta"');
    expect(HUB_SRC).toContain("/ 4 avg");
  });

  it("Metrics CTA opens MetricsDrawer (setMetricsDrawerOpen(true))", () => {
    const idx = HUB_SRC.indexOf('data-testid="rail-metrics-cta"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toMatch(/onClick=\{[\s\S]{0,80}setMetricsDrawerOpen\(true\)/);
  });

  it("page.tsx imports + mounts MetricsDrawer gated on metricsDrawerOpen", () => {
    expect(HUB_SRC).toMatch(
      /import\s+MetricsDrawer\s+from\s+["']@\/components\/teacher\/class-hub\/MetricsDrawer["']/
    );
    expect(HUB_SRC).toMatch(/metricsDrawerOpen\s*&&\s*\(\s*<MetricsDrawer/);
  });

  it("NM observation re-attached: per-row metrics dots fire setNmObserveStudent when nmConfig.enabled", () => {
    // Closes the G7 follow-up from the Phase 3.1 STOP AND REPORT (NM
    // observation trigger orphan). The dots become a button only when
    // NM is enabled — title attribute hints at the click action. The
    // dot-render JSX is ~30 lines long, so distance is generous (3000)
    // to absorb the SVG + title + className strings between the
    // canObserve guard + the onClick.
    expect(HUB_SRC).toMatch(
      /nmConfig\?\.enabled\s*===\s*true[\s\S]{0,3000}setNmObserveStudent\(\{\s*id:\s*student\.id/
    );
  });

  it("loadProgressData NM aggregate gated on nmConfig?.enabled (no fetch when NM is off)", () => {
    expect(HUB_SRC).toMatch(
      /if\s*\(\s*nmConfig\?\.enabled\s*\)\s*\{[\s\S]{0,200}fetch\(`\/api\/teacher\/nm-results/
    );
  });
});

describe("DT canvas Phase 3.2 — legacy ?tab= compat enhanced for new drawers", () => {
  it("?tab=metrics OR ?tab=attention opens MetricsDrawer", () => {
    expect(HUB_SRC).toMatch(
      /tab\s*===\s*"metrics"\s*\|\|\s*tab\s*===\s*"attention"[\s\S]{0,200}setMetricsDrawerOpen\(true\)/
    );
  });

  it("?tab=badges OR ?tab=safety opens SafetyDrawer", () => {
    expect(HUB_SRC).toMatch(
      /tab\s*===\s*"badges"\s*\|\|\s*tab\s*===\s*"safety"[\s\S]{0,200}setSafetyDrawerOpen\(true\)/
    );
  });

  it("?tab=studio OR ?tab=open-studio opens OpenStudioDrawer", () => {
    expect(HUB_SRC).toMatch(
      /tab\s*===\s*"studio"\s*\|\|\s*tab\s*===\s*"open-studio"[\s\S]{0,200}setOpenStudioDrawerOpen\(true\)/
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Phase 3.3 — Today's lesson hero + Change unit modal
// ═════════════════════════════════════════════════════════════════════════════

describe("DT canvas Phase 3.3 — Today's lesson hero card", () => {
  it("defines a module-scope deriveTodaysLessonIndex helper", () => {
    expect(HUB_SRC).toMatch(/function\s+deriveTodaysLessonIndex\(/);
  });

  it("the derivation prefers in_progress then falls back to first-not-complete", () => {
    // Two-pass shape: lock both passes so the priority order can't
    // silently invert.
    expect(HUB_SRC).toContain('?.status === "in_progress"');
    expect(HUB_SRC).toContain('?.status === "complete"');
  });

  it("hero renders the title chip + h2 + Teach CTA testids", () => {
    expect(HUB_SRC).toContain('data-testid="canvas-lesson-hero"');
    expect(HUB_SRC).toContain('data-testid="lesson-hero-title"');
    expect(HUB_SRC).toContain('data-testid="lesson-hero-teach-cta"');
  });

  it('"Today · Lesson X of Y" chip renders the derived position', () => {
    expect(HUB_SRC).toMatch(/Today · Lesson \{todayIdx \+ 1\} of \{unitPages\.length\}/);
  });

  it("Teach CTA href carries the &page=<pageId> qualifier (pre-selects today's lesson)", () => {
    const idx = HUB_SRC.indexOf('data-testid="lesson-hero-teach-cta"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 800);
    expect(slice).toMatch(
      /href=\{`\/teacher\/teach\/\$\{unitId\}\?classId=\$\{classId\}&page=\$\{encodeURIComponent\(todayPage\?\.id \?\? ""\)\}`\}/
    );
  });

  it("outline rows render one per populated workshop phase (opening / miniLesson / workTime / debrief)", () => {
    // The wp.* gates ensure phases with zero durationMinutes don't
    // surface as empty rows.
    expect(HUB_SRC).toContain("wp.opening?.durationMinutes");
    expect(HUB_SRC).toContain("wp.miniLesson?.durationMinutes");
    expect(HUB_SRC).toContain("wp.workTime?.durationMinutes");
    expect(HUB_SRC).toContain("wp.debrief?.durationMinutes");
    expect(HUB_SRC).toContain('data-testid="lesson-hero-outline-row"');
  });

  it("empty-outline state renders when workshopPhases is missing", () => {
    expect(HUB_SRC).toContain('data-testid="lesson-hero-outline-empty"');
    expect(HUB_SRC).toContain("No Workshop Model timing on this page yet.");
  });

  it("empty-pages state renders when the unit has zero pages", () => {
    expect(HUB_SRC).toContain('data-empty="no-pages"');
    expect(HUB_SRC).toContain("No pages in this unit yet.");
  });
});

// ─── Anti-regression (17 May 2026) — prod migration drift ───────────────
// Migration 051_unit_type.sql added `units.unit_type` to the repo but
// prod is missing it (tracked as FU-PROD-MIGRATION-BACKLOG-AUDIT P1 in
// the master CLAUDE.md index). The Phase 3.3 ChangeUnitModal +
// Phase 3.4 Past units sub-route both selected `units(title, unit_type)`
// which 500'd on prod. Both queries were narrowed to `units(title)`;
// these guards lock the narrower shape until the prod migration
// backlog audit closes + 051 lands. Re-add `unit_type` to the selects
// AND drop the guards in the same commit when that happens.
describe("DT canvas — prod migration drift anti-regression (FU-PROD-MIGRATION-BACKLOG-AUDIT)", () => {
  it("ChangeUnitModal class_units select omits unit_type until migration 051 lands", () => {
    const MODAL_SRC = readFileSync(
      join(process.cwd(), "src/components/teacher/class-hub/ChangeUnitModal.tsx"),
      "utf-8",
    );
    // The narrower select shape — only `units(title)` survives.
    expect(MODAL_SRC).toContain('.select("unit_id, is_active, forked_at, units(title)")');
    expect(MODAL_SRC).not.toMatch(/\.select\([^)]*units\([^)]*unit_type/);
  });

  it("Past units sub-route class_units select omits unit_type until migration 051 lands", () => {
    const PAST_SRC = readFileSync(
      join(process.cwd(), "src/app/teacher/classes/[classId]/units/page.tsx"),
      "utf-8",
    );
    expect(PAST_SRC).toContain('.select("unit_id, is_active, forked_at, units(title)")');
    expect(PAST_SRC).not.toMatch(/\.select\([^)]*units\([^)]*unit_type/);
  });
});

describe("DT canvas — lesson hero unit thumbnail (17 May 2026)", () => {
  // Matt's polish ask: get the unit thumbnail onto the canvas. Hero
  // card now uses unit.thumbnail_url as a CSS background-image with an
  // orange-gradient overlay (95% opacity left, fades to 40% on the
  // right) so text stays legible while a slice of the unit art shows
  // through. Graceful fallback to the existing solid orange gradient
  // when the unit has no thumbnail.
  it("hero sets backgroundImage from unit.thumbnail_url when available", () => {
    expect(HUB_SRC).toMatch(
      /backgroundImage:\s*`url\(\$\{unit\.thumbnail_url\}\)`/
    );
  });

  it("hero adds an orange-gradient overlay above the image so text is legible", () => {
    expect(HUB_SRC).toContain("from-orange-600/95 via-orange-600/85 to-orange-500/40");
  });

  it("hero falls back to solid gradient when no thumbnail_url", () => {
    // Ternary: thumbnail_url ? (no bg-gradient class) : bg-gradient-to-br…
    expect(HUB_SRC).toMatch(
      /unit\.thumbnail_url\s*\?\s*""\s*:\s*"bg-gradient-to-br from-orange-500 to-orange-600"/
    );
  });

  it("hero carries data-has-thumbnail flag for smoke + debug", () => {
    expect(HUB_SRC).toMatch(
      /data-has-thumbnail=\{unit\.thumbnail_url\s*\?\s*"true"\s*:\s*"false"\}/
    );
  });
});

describe("DT canvas — Polish A.1 (17 May 2026) — 'View as student' targets today's lesson", () => {
  // Was: kebab href hard-coded to unitPages[0]?.id. Now: uses
  // deriveTodaysLessonIndex so preview-as-student matches what the
  // teacher is about to teach.
  it("kebab previewPageId derives via deriveTodaysLessonIndex (with unitPages[0] fallback)", () => {
    expect(HUB_SRC).toMatch(
      /previewIdx\s*=\s*unitPages\.length\s*>\s*0\s*\?\s*deriveTodaysLessonIndex\(unitPages,\s*progressMap,\s*studentIds\)\s*:\s*0/
    );
    expect(HUB_SRC).toMatch(
      /previewPageId\s*=\s*unitPages\[previewIdx\]\?\.id\s*\?\?\s*unitPages\[0\]\?\.id/
    );
  });

  it("kebab href still uses previewPageId — wiring shape preserved", () => {
    const idx = HUB_SRC.indexOf('"kebab-unit-view-as-student"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 600);
    expect(slice).toMatch(
      /href:\s*previewPageId[\s\S]{0,200}preview\/\$\{previewPageId\}\?classId=\$\{classId\}/
    );
  });
});

describe("DT canvas — Polish A.2 (17 May 2026) — drawer avatars adopt studentInitials", () => {
  it("StudentDrawer imports studentInitials + uses it for the header avatar", () => {
    const DRAWER_SRC = readFileSync(
      join(process.cwd(), "src/components/teacher/class-hub/StudentDrawer.tsx"),
      "utf-8",
    );
    expect(DRAWER_SRC).toMatch(
      /import\s*\{\s*studentInitials\s*\}\s*from\s*["']@\/lib\/teacher\/student-initials["']/
    );
    // Receives merged studentName string; passes as displayName + null
    expect(DRAWER_SRC).toContain("studentInitials(studentName, null)");
    // Anti-revert: the old single-char derivation must not come back
    expect(DRAWER_SRC).not.toMatch(/\(studentName\[0\]\s*\|\|\s*"\?"\)\.toUpperCase\(\)/);
  });

  it("StudentRosterDrawer imports studentInitials + uses it for both row avatars", () => {
    const ROSTER_SRC = readFileSync(
      join(process.cwd(), "src/components/teacher/class-hub/StudentRosterDrawer.tsx"),
      "utf-8",
    );
    expect(ROSTER_SRC).toMatch(
      /import\s*\{\s*studentInitials\s*\}\s*from\s*["']@\/lib\/teacher\/student-initials["']/
    );
    // Both call-sites take (display_name, username) — count occurrences
    const matches = ROSTER_SRC.match(/studentInitials\(s\.display_name,\s*s\.username\)/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
    // Anti-revert
    expect(ROSTER_SRC).not.toMatch(/\(s\.display_name\s*\|\|\s*s\.username\s*\|\|\s*"\?"\)\.charAt\(0\)\.toUpperCase\(\)/);
  });
});

describe("DT canvas — stuck-student dashboard deep-link (17 May 2026)", () => {
  const DASH_SRC = readFileSync(
    join(process.cwd(), "src/app/api/teacher/dashboard/route.ts"),
    "utf-8",
  );

  it("stuck_student insight href carries &student=<id> deep-link qualifier", () => {
    // Was: bare baseHref. Now: ${baseHref}?student=${p.student_id}
    // so the canvas legacy ?student= compat opens StudentDrawer on
    // land. The 5-line "Polish" comment block + template-literal
    // title push the href past the standard 600-char window — bumped
    // to 1200 with a still-tight match on the deep-link shape.
    const idx = DASH_SRC.indexOf('type: "stuck_student"');
    expect(idx).toBeGreaterThan(0);
    const slice = DASH_SRC.slice(idx, idx + 1200);
    expect(slice).toContain("href: `${baseHref}?student=${p.student_id}`");
  });
});

describe("DT canvas — remember-me stubs (17 May 2026)", () => {
  // Discoverability for the un-built items so they don't slip from
  // memory. Both are greyed kebab/drawer rows with "coming soon"
  // copy and the testid prefix matches their permanent identifier
  // so the un-stub work just needs to re-target the same testid.

  it("Canvas-header kebab Class section has a greyed 'View class profile' stub", () => {
    expect(HUB_SRC).toContain('"kebab-class-profile"');
    const idx = HUB_SRC.indexOf('"kebab-class-profile"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toContain("View class profile…");
    expect(slice).toContain("disabled: true");
    expect(slice).toContain('"coming soon"');
  });

  it("MetricsDrawer has a greyed 'Pace feedback summary' stub", () => {
    const DRAWER_SRC = readFileSync(
      join(process.cwd(), "src/components/teacher/class-hub/MetricsDrawer.tsx"),
      "utf-8",
    );
    expect(DRAWER_SRC).toContain('data-testid="metrics-drawer-pace-feedback-stub"');
    expect(DRAWER_SRC).toContain("Pace feedback summary");
    expect(DRAWER_SRC).toContain("coming soon");
    // aria-disabled stays on so screen readers don't promise interaction.
    expect(DRAWER_SRC).toMatch(/aria-disabled=["']true["']/);
  });
});

describe("DT canvas — Polish A.3 (17 May 2026) — Settings tab content re-homed", () => {
  const SETTINGS_SRC = readFileSync(
    join(process.cwd(), "src/app/teacher/classes/[classId]/settings/[unitId]/page.tsx"),
    "utf-8",
  );

  // Settings sub-route guards: the three re-homed sections are present
  // with the testids the kebab "Class settings…" item routes into.
  it("settings sub-route imports LessonSchedule + ScheduleOverrides type", () => {
    expect(SETTINGS_SRC).toMatch(
      /import\s*\{\s*LessonSchedule\s*\}\s*from\s*["']@\/components\/teacher\/LessonSchedule["']/
    );
    expect(SETTINGS_SRC).toMatch(
      /import\s+type\s*\{\s*ScheduleOverrides\s*\}\s*from\s*["']@\/components\/teacher\/LessonSchedule["']/
    );
  });

  it("settings sub-route renders the three re-homed sections via stable testids", () => {
    expect(SETTINGS_SRC).toContain('data-testid="settings-term-section"');
    expect(SETTINGS_SRC).toContain('data-testid="settings-lesson-schedule-section"');
    expect(SETTINGS_SRC).toContain('data-testid="settings-class-code-section"');
  });

  it("settings sub-route loads class_units with term_id + schedule_overrides", () => {
    expect(SETTINGS_SRC).toMatch(
      /\.select\(["']final_due_date,\s*page_due_dates,\s*page_settings,\s*term_id,\s*schedule_overrides["']\)/
    );
    // school-calendar fetch + cohort-term inherit query both present
    expect(SETTINGS_SRC).toContain('fetch("/api/teacher/school-calendar")');
    expect(SETTINGS_SRC).toMatch(/\.not\(["']term_id["'],\s*["']is["'],\s*null\)/);
  });

  it("settings sub-route owns handleTermChange + schedule loading useEffect", () => {
    expect(SETTINGS_SRC).toMatch(/async function handleTermChange\(/);
    expect(SETTINGS_SRC).toMatch(/async function loadSchedule\(\)/);
    expect(SETTINGS_SRC).toMatch(
      /fetch\(`\/api\/teacher\/schedule\/lessons\?classId=\$\{classId\}&mode=count/
    );
  });

  // Canvas guards: the orphan Settings state + load is GONE.
  // Anti-revert protects the cleanup from accidental re-introduction.
  it("canvas page.tsx no longer holds Settings tab state", () => {
    for (const sym of ["selectedTermId", "setSelectedTermId", "scheduleOverrides", "scheduleInfo", "handleTermChange", "loadSchedule"]) {
      // Should not appear as a state-decl / function-decl on the canvas
      expect(HUB_SRC).not.toMatch(new RegExp(`useState[^;]*\\b${sym}\\b`));
      expect(HUB_SRC).not.toMatch(new RegExp(`async function ${sym}\\(`));
    }
  });

  it("canvas page.tsx no longer fetches school-calendar or imports ScheduleOverrides", () => {
    expect(HUB_SRC).not.toContain('fetch("/api/teacher/school-calendar")');
    expect(HUB_SRC).not.toMatch(
      /^[^/\n]*import[^;]*\bScheduleOverrides\b[^;]*from/m
    );
  });

  it("canvas class_units select is trimmed to per-class fork fields only", () => {
    expect(HUB_SRC).toContain('.select("content_data, forked_at, forked_from_version, nm_config")');
    // term_id + schedule_overrides no longer requested on the canvas
    expect(HUB_SRC).not.toMatch(/\.select\([^)]*\bterm_id\b[^)]*\bschedule_overrides\b/);
  });
});

describe("DT canvas Phase 3.3 — Change unit modal + setActiveUnit wiring", () => {
  it("renders the Change unit button in the canvas header (relocated from hero)", () => {
    // Phase 3.3 Step 2 originally absolute-positioned this button inside
    // the orange lesson hero. It overlapped the outline column text on
    // real lesson data — relocated to the canvas header next to Edit
    // + kebab. testid renamed canvas-header-change-unit.
    expect(HUB_SRC).toContain('data-testid="canvas-header-change-unit"');
    // The old in-hero testid must NOT come back (guards against revert).
    expect(HUB_SRC).not.toContain('data-testid="lesson-hero-change-unit"');
  });

  it("Change unit button onClick opens the modal", () => {
    const idx = HUB_SRC.indexOf('data-testid="canvas-header-change-unit"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 600);
    expect(slice).toMatch(/onClick=\{[\s\S]{0,80}setChangeUnitModalOpen\(true\)/);
    // No longer disabled (Step 1 stub removed)
    expect(slice).not.toMatch(/disabled\s*\n/);
  });

  it("page.tsx imports + mounts ChangeUnitModal gated on changeUnitModalOpen", () => {
    expect(HUB_SRC).toMatch(
      /import\s+ChangeUnitModal\s+from\s+["']@\/components\/teacher\/class-hub\/ChangeUnitModal["']/
    );
    expect(HUB_SRC).toMatch(
      /changeUnitModalOpen\s*&&\s*\(\s*<ChangeUnitModal/
    );
  });

  it("ChangeUnitModal imports the setActiveUnit helper from @/lib/classes/active-unit", () => {
    const MODAL_SRC = readFileSync(
      join(
        process.cwd(),
        "src/components/teacher/class-hub/ChangeUnitModal.tsx"
      ),
      "utf-8"
    );
    expect(MODAL_SRC).toMatch(
      /import\s*\{[^}]*setActiveUnit[^}]*\}\s*from\s*["']@\/lib\/classes\/active-unit["']/
    );
  });

  it("ChangeUnitModal calls setActiveUnit(supabase, classId, targetUnitId) on Make active", () => {
    const MODAL_SRC = readFileSync(
      join(
        process.cwd(),
        "src/components/teacher/class-hub/ChangeUnitModal.tsx"
      ),
      "utf-8"
    );
    expect(MODAL_SRC).toMatch(
      /setActiveUnit\(supabase,\s*classId,\s*targetUnitId\)/
    );
  });

  it("ChangeUnitModal maps SQLSTATE 42501 + 23505 to friendly error copy", () => {
    const MODAL_SRC = readFileSync(
      join(
        process.cwd(),
        "src/components/teacher/class-hub/ChangeUnitModal.tsx"
      ),
      "utf-8"
    );
    expect(MODAL_SRC).toContain('result.code === "42501"');
    expect(MODAL_SRC).toContain('result.code === "23505"');
  });

  it("ChangeUnitModal navigates to the new unit's canvas on success (class-canonical slug URL — Package B.5)", () => {
    const MODAL_SRC = readFileSync(
      join(
        process.cwd(),
        "src/components/teacher/class-hub/ChangeUnitModal.tsx"
      ),
      "utf-8"
    );
    // DT canvas Package B.5 (17 May 2026): canvas URL is class-canonical.
    // The just-activated unit is the class's new active unit, so the
    // slug URL renders it on next load.
    expect(MODAL_SRC).toMatch(
      /router\.push\(`\/teacher\/c\/\$\{buildSlugWithId\(className,\s*classId\)\}`\)/
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Phase 3.4 — canvas-header kebab + row kebab + Past units sub-route
// ═════════════════════════════════════════════════════════════════════════════

describe("DT canvas Phase 3.4 — canvas-header kebab Unit section", () => {
  it("renders the four Unit-section item testids", () => {
    expect(HUB_SRC).toContain('"kebab-unit-edit"');
    expect(HUB_SRC).toContain('"kebab-unit-view-as-student"');
    expect(HUB_SRC).toContain('"kebab-unit-change"');
    expect(HUB_SRC).toContain('"kebab-unit-past"');
  });

  it("Edit unit links to the existing edit route", () => {
    const idx = HUB_SRC.indexOf('"kebab-unit-edit"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toMatch(
      /href:\s*`\/teacher\/units\/\$\{unitId\}\/class\/\$\{classId\}\/edit`/
    );
  });

  it("View as student opens preview in a new tab and disables when no pages", () => {
    const idx = HUB_SRC.indexOf('"kebab-unit-view-as-student"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 600);
    expect(slice).toContain("newTab: true");
    expect(slice).toMatch(
      /href:\s*previewPageId[\s\S]{0,200}\/teacher\/units\/\$\{unitId\}\/preview\/\$\{previewPageId\}\?classId=\$\{classId\}/
    );
    expect(slice).toContain("disabled: !previewPageId");
  });

  it("Change unit kebab item opens the existing ChangeUnitModal", () => {
    const idx = HUB_SRC.indexOf('"kebab-unit-change"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toMatch(/onClick:\s*\(\)\s*=>\s*setChangeUnitModalOpen\(true\)/);
  });

  it("Past units links to the new /teacher/classes/[classId]/units sub-route", () => {
    const idx = HUB_SRC.indexOf('"kebab-unit-past"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toMatch(/href:\s*`\/teacher\/classes\/\$\{classId\}\/units`/);
  });
});

describe("DT canvas Phase 3.4 — canvas-header kebab Class section", () => {
  it("renders the five Class-section item testids", () => {
    expect(HUB_SRC).toContain('"kebab-class-settings"');
    expect(HUB_SRC).toContain('"kebab-class-rollover"');
    expect(HUB_SRC).toContain('"kebab-class-duplicate"');
    expect(HUB_SRC).toContain('"kebab-class-archive"');
    expect(HUB_SRC).toContain('"kebab-class-delete"');
  });

  it("Class settings links to the existing per-class-unit settings route", () => {
    const idx = HUB_SRC.indexOf('"kebab-class-settings"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toMatch(
      /href:\s*`\/teacher\/classes\/\$\{classId\}\/settings\/\$\{unitId\}`/
    );
  });

  it("Roll over / Duplicate / Archive / Delete are all disabled stubs (G3 sign-off)", () => {
    for (const id of ["kebab-class-rollover", "kebab-class-duplicate", "kebab-class-archive", "kebab-class-delete"]) {
      const idx = HUB_SRC.indexOf(`"${id}"`);
      expect(idx).toBeGreaterThan(0);
      const slice = HUB_SRC.slice(idx, idx + 400);
      expect(slice).toContain("disabled: true");
    }
  });

  it("Delete item has danger styling + conditional 'if archived' hint", () => {
    const idx = HUB_SRC.indexOf('"kebab-class-delete"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toContain("danger: true");
    expect(slice).toContain('"if archived"');
  });
});

describe("DT canvas Phase 3.4 — row kebab actions", () => {
  it("Open snapshot wires to setDrawerStudent", () => {
    expect(HUB_SRC).toMatch(/row-action-\$\{student\.id\}-snapshot/);
    const idx = HUB_SRC.indexOf("row-action-${student.id}-snapshot");
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 600);
    expect(slice).toMatch(/setDrawerStudent\(\{\s*id:\s*student\.id/);
  });

  it("Record NM observation gated on nmConfig.enabled, fires setNmObserveStudent", () => {
    expect(HUB_SRC).toMatch(/row-action-\$\{student\.id\}-observe/);
    // The observe item is pushed inside an `if (nmConfig?.enabled === true)` block.
    expect(HUB_SRC).toMatch(
      /if\s*\(\s*nmConfig\?\.enabled\s*===\s*true\s*\)[\s\S]{0,400}row-action-\$\{student\.id\}-observe/
    );
  });

  it("Reset student code is a disabled stub (no API surface yet)", () => {
    expect(HUB_SRC).toMatch(/row-action-\$\{student\.id\}-reset-code/);
    const idx = HUB_SRC.indexOf("row-action-${student.id}-reset-code");
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toContain("disabled: true");
  });

  it("Remove from class fires removeStudentFromClassRow with danger styling", () => {
    expect(HUB_SRC).toMatch(/row-action-\$\{student\.id\}-remove/);
    const idx = HUB_SRC.indexOf("row-action-${student.id}-remove");
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toContain("danger: true");
    expect(slice).toMatch(/removeStudentFromClassRow\(student\.id,\s*studentName\)/);
  });

  it("removeStudentFromClassRow gates on window.confirm + DELETEs class-students", () => {
    expect(HUB_SRC).toContain("window.confirm");
    expect(HUB_SRC).toMatch(
      /fetch\(\s*"\/api\/teacher\/class-students"\s*,\s*\{[\s\S]{0,200}method:\s*"DELETE"/
    );
  });
});

describe("DT canvas — ChangeUnitModal 'Other units' picker (17 May 2026)", () => {
  // Smoke after the unit_type prod-drift fix flagged that the modal only
  // listed units already on the class — no path to assign a brand-new
  // unit. Picker added: fetches authored + published units (matches the
  // set_active_unit RPC ownership gate), filters out units already on
  // the class, capped at 30 in the modal / 40 on the sub-route.
  const MODAL_SRC = readFileSync(
    join(process.cwd(), "src/components/teacher/class-hub/ChangeUnitModal.tsx"),
    "utf-8",
  );

  it("queries units with author OR is_published filter (matches RPC ownership gate)", () => {
    expect(MODAL_SRC).toMatch(
      /\.or\(`author_teacher_id\.eq\.\$\{user\.id\},is_published\.eq\.true`\)/
    );
  });

  it("excludes units already on this class (uses existingIds set)", () => {
    expect(MODAL_SRC).toMatch(/existingIds\s*=\s*new Set/);
    expect(MODAL_SRC).toMatch(/!existingIds\.has\(u\.id\)/);
  });

  it("renders an 'Other units' section header + the AvailableUnitRow component", () => {
    expect(MODAL_SRC).toContain("Other units you can assign");
    expect(MODAL_SRC).toMatch(/<AvailableUnitRow/);
    expect(MODAL_SRC).toMatch(/function AvailableUnitRow\(/);
  });

  it("AvailableUnitRow distinguishes Yours vs Library + carries per-row testid", () => {
    expect(MODAL_SRC).toContain('data-testid={`change-unit-available-row-${option.unit_id}`}');
    expect(MODAL_SRC).toMatch(/option\.isYours[\s\S]{0,300}Yours/);
    expect(MODAL_SRC).toMatch(/!option\.isYours\s*&&\s*option\.is_published[\s\S]{0,300}Library/);
  });

  it("Available-empty state links to /teacher/units (library browse)", () => {
    expect(MODAL_SRC).toContain('data-testid="change-unit-available-empty"');
    expect(MODAL_SRC).toContain('href="/teacher/units"');
  });

  it("AvailableUnitRow Make-active button wires to onMakeActive(option.unit_id)", () => {
    // Same setActiveUnit RPC as the past-unit row; the RPC handles
    // the INSERT-on-conflict for class_units rows that don't exist
    // yet, so "assign + activate" is one call.
    expect(MODAL_SRC).toMatch(/onClick=\{\s*\(\)\s*=>\s*onMakeActive\(option\.unit_id\)/);
  });
});

describe("DT canvas — explicit empty state for past units (17 May 2026)", () => {
  // Matt's 17 May smoke: arrived at /teacher/classes/<id>/units, saw
  // only the active unit + the empty Other-units section, no "Past
  // units" section at all. The page TITLE promised history; the silent-
  // hide-when-empty made the page look broken. Fix: always render the
  // section with an explanatory empty state — same wording on both the
  // sub-route + the modal so the two surfaces tell the same story.
  it("Past units sub-route always renders the Past units section + empty state copy", () => {
    const PAST_SRC = readFileSync(
      join(process.cwd(), "src/app/teacher/classes/[classId]/units/page.tsx"),
      "utf-8",
    );
    // No more gated `past.length > 0 &&` wrap on the section.
    expect(PAST_SRC).not.toMatch(/\{past\.length\s*>\s*0\s*&&\s*\(\s*<section/);
    // Section header includes the count even when zero.
    expect(PAST_SRC).toContain("Past units ({past.length})");
    // Empty-state testid + explanatory copy
    expect(PAST_SRC).toContain('data-testid="class-units-past-empty"');
    expect(PAST_SRC).toContain("No past units on this class yet");
    expect(PAST_SRC).toContain("hard-deleted by the older code path");
  });

  it("ChangeUnitModal always renders the Past units section + empty state copy", () => {
    const MODAL_SRC = readFileSync(
      join(process.cwd(), "src/components/teacher/class-hub/ChangeUnitModal.tsx"),
      "utf-8",
    );
    expect(MODAL_SRC).not.toMatch(/\{past\.length\s*>\s*0\s*&&\s*\(\s*<div/);
    expect(MODAL_SRC).toContain("Past units on this class");
    expect(MODAL_SRC).toContain('data-testid="change-unit-past-empty"');
    expect(MODAL_SRC).toContain("No past units yet");
  });
});

describe("DT canvas — Past units sub-route 'Other units' picker (17 May 2026)", () => {
  // Same picker shape on the full-page sub-route — slightly higher
  // cap (40 vs 30) since the page has more room to browse. Anti-
  // revert guard ensures the section can't silently disappear from
  // either surface.
  const PAST_SRC = readFileSync(
    join(process.cwd(), "src/app/teacher/classes/[classId]/units/page.tsx"),
    "utf-8",
  );

  it("queries units with author OR is_published filter (same RPC ownership match)", () => {
    expect(PAST_SRC).toMatch(
      /\.or\(`author_teacher_id\.eq\.\$\{user\.id\},is_published\.eq\.true`\)/
    );
  });

  it("excludes units already on this class via existingIds set", () => {
    expect(PAST_SRC).toMatch(/existingIds\s*=\s*new Set/);
    expect(PAST_SRC).toMatch(/!existingIds\.has\(u\.id\)/);
  });

  it("renders an 'Other units' section header + AvailableUnitRow component", () => {
    expect(PAST_SRC).toContain("Other units you can assign");
    expect(PAST_SRC).toMatch(/<AvailableUnitRow/);
    expect(PAST_SRC).toMatch(/function AvailableUnitRow\(/);
  });

  it("per-row testid + empty-state link to /teacher/units", () => {
    expect(PAST_SRC).toContain('data-testid={`class-units-available-row-${option.unit_id}`}');
    expect(PAST_SRC).toContain('data-testid="class-units-available-empty"');
    expect(PAST_SRC).toContain('href="/teacher/units"');
  });
});

describe("DT canvas Phase 3.4 — Past units sub-route", () => {
  const UNITS_SRC = readFileSync(
    join(
      process.cwd(),
      "src/app/teacher/classes/[classId]/units/page.tsx"
    ),
    "utf-8"
  );

  it("imports the setActiveUnit helper", () => {
    expect(UNITS_SRC).toMatch(
      /import\s*\{\s*setActiveUnit\s*\}\s*from\s*["']@\/lib\/classes\/active-unit["']/
    );
  });

  it("calls setActiveUnit(supabase, classId, targetUnitId) on Make active", () => {
    expect(UNITS_SRC).toMatch(
      /setActiveUnit\(supabase,\s*classId,\s*targetUnitId\)/
    );
  });

  it("navigates to the new active canvas on success (class-canonical slug URL — Package B.5)", () => {
    // DT canvas Package B.5 (17 May 2026): the canvas URL is now
    // class-canonical (/teacher/c/<slug>-<6id>), no unit segment.
    // setActiveUnit() flipped is_active before this navigation, so the
    // class will render the targetUnitId on next load.
    expect(UNITS_SRC).toMatch(
      /router\.push\(`\/teacher\/c\/\$\{buildSlugWithId\(className,\s*classId\)\}`\)/
    );
  });

  it("maps SQLSTATE 42501 + 23505 to friendly error copy (same shape as ChangeUnitModal)", () => {
    expect(UNITS_SRC).toContain('result.code === "42501"');
    expect(UNITS_SRC).toContain('result.code === "23505"');
  });

  it("loads class_units joined with units(title, unit_type, is_published) ordered by is_active + forked_at", () => {
    expect(UNITS_SRC).toMatch(
      /from\(["']class_units["']\)[\s\S]{0,400}order\(["']is_active["'],\s*\{\s*ascending:\s*false\s*\}\)[\s\S]{0,200}order\(["']forked_at["']/
    );
  });

  it("renders Currently active + Past units sections with row testids", () => {
    expect(UNITS_SRC).toContain("Currently active");
    expect(UNITS_SRC).toContain("Past units");
    expect(UNITS_SRC).toContain('data-testid={`class-units-row-${row.unit_id}`}');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Phase 3.5 — GalleryDrawer + legacy ?tab=gallery compat
// (Phase 3.5 originally mounted a gallery strip in the canvas main column;
// the rail-reorder fix on 17 May 2026 moved it into the side rail as a
// count + subtitle + CTA card — see "DT canvas — rail reorder" describe
// block below. The drawer + lifted inline GalleryTab + the legacy compat
// are unchanged and still locked by the guards in this block.)
// ═════════════════════════════════════════════════════════════════════════════

describe("DT canvas Phase 3.5 — GalleryDrawer + lifted GalleryTab", () => {
  it("page.tsx imports + mounts GalleryDrawer gated on galleryDrawerOpen", () => {
    expect(HUB_SRC).toMatch(
      /import\s+GalleryDrawer\s+from\s+["']@\/components\/teacher\/class-hub\/GalleryDrawer["']/
    );
    expect(HUB_SRC).toMatch(/galleryDrawerOpen\s*&&\s*\(\s*<GalleryDrawer/);
  });

  it("loadProgressData fetches /api/teacher/gallery to populate galleryRounds", () => {
    expect(HUB_SRC).toContain("galleryRounds");
    expect(HUB_SRC).toMatch(
      /fetch\(`\/api\/teacher\/gallery\?unitId=\$\{unitId\}&classId=\$\{classId\}`\)/
    );
  });

  it("GalleryDrawer is sourced from the lifted component (not inline GalleryTab)", () => {
    // The inline `function GalleryTab(` is gone from page.tsx; the
    // lifted drawer lives in @/components/teacher/class-hub/GalleryDrawer
    expect(HUB_SRC).not.toMatch(/^function GalleryTab\(/m);
    // And the gallery component imports moved with the lift — they
    // were only needed by the inline JSX.
    expect(HUB_SRC).not.toMatch(
      /import\s*\{[^}]*GalleryRoundCreator[^}]*\}\s*from\s*["']@\/components\/gallery["']/
    );
  });
});

describe("DT canvas — rail reorder (17 May 2026)", () => {
  // After Matt's Phase 3.6 smoke: gallery was hard to find at the
  // bottom of a long student list when it was a main-column strip.
  // Moved into the side rail as a count + subtitle + CTA card (same
  // shape as the other rail cards); Open Studio dropped to the bottom
  // of the rail (gates pilot expansion but isn't a daily-driver).
  // Order locked: Marking → Class Metrics → Gallery → Safety → Studio.

  it("Gallery card lives in the side rail (was a main-column strip in 3.5)", () => {
    expect(HUB_SRC).toContain('data-testid="canvas-rail-card-gallery"');
    expect(HUB_SRC).toContain('data-testid="rail-gallery-count"');
    expect(HUB_SRC).toContain('data-testid="rail-gallery-cta"');
  });

  it("Gallery rail CTA opens GalleryDrawer", () => {
    const idx = HUB_SRC.indexOf('data-testid="rail-gallery-cta"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 400);
    expect(slice).toMatch(/onClick=\{[\s\S]{0,80}setGalleryDrawerOpen\(true\)/);
  });

  it("Gallery card renders 'N rounds' headline + empty / latest subtitle", () => {
    const idx = HUB_SRC.indexOf('data-testid="canvas-rail-card-gallery"');
    expect(idx).toBeGreaterThan(0);
    const slice = HUB_SRC.slice(idx, idx + 1500);
    expect(slice).toContain("Pin-Up Gallery");
    // Card binds the count from roundCount (derived from galleryRounds
    // in the IIFE above) — check for either to keep the guard resilient
    // to small naming swaps.
    expect(slice).toMatch(/roundCount|galleryRounds/);
    expect(slice).toContain("No pin-up rounds yet.");
    expect(slice).toContain("Latest:");
  });

  it("rail order is Marking → Class Metrics → Gallery → Safety → Studio", () => {
    // Match the side-rail aside, then walk for each card testid in
    // turn. Indices must be strictly ascending.
    const railIdx = HUB_SRC.indexOf('data-testid="canvas-side-rail"');
    expect(railIdx).toBeGreaterThan(0);
    const rail = HUB_SRC.slice(railIdx);
    const order = [
      "canvas-rail-card-marking",
      "canvas-rail-card-metrics",
      "canvas-rail-card-gallery",
      "canvas-rail-card-safety",
      "canvas-rail-card-studio",
    ];
    const positions = order.map((id) => rail.indexOf(`data-testid="${id}"`));
    for (const p of positions) expect(p).toBeGreaterThan(0);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it("main column no longer hosts the gallery strip (testid + tile-* gone)", () => {
    expect(HUB_SRC).not.toContain('data-testid="canvas-gallery-strip"');
    expect(HUB_SRC).not.toContain('data-testid="gallery-strip-open-cta"');
    expect(HUB_SRC).not.toContain('data-testid="gallery-strip-tile-empty"');
    expect(HUB_SRC).not.toMatch(/data-testid=\{`gallery-strip-tile-\$\{round\.id\}`\}/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Phase 3.6 — cutover sweep
// ═════════════════════════════════════════════════════════════════════════════

describe("DT canvas Phase 3.6 — dashboard route URL cleanup", () => {
  const DASH_SRC = readFileSync(
    join(process.cwd(), "src/app/api/teacher/dashboard/route.ts"),
    "utf-8",
  );

  it("dashboard route no longer mints ?tab=progress URLs", () => {
    // The Phase 3.1 audit logged 5 sites minting ?tab=* hrefs.
    // Phase 3.6 Step 1 dropped them. Comments referencing the old
    // patterns are fine (they document the change) — the test
    // anchors on the live `href:` field, requiring the URL string
    // to start with a backtick OR forward-slash + classes (i.e.
    // not contain ?tab=).
    expect(DASH_SRC).not.toMatch(/^\s*href:\s*`[^`]*\?tab=progress/m);
  });

  it("dashboard route no longer mints ?tab=grade URLs", () => {
    expect(DASH_SRC).not.toMatch(/^\s*href:\s*`[^`]*\?tab=grade/m);
  });

  it("'go to marking' insights route directly to /teacher/marking", () => {
    expect(DASH_SRC).toMatch(
      /href:\s*`\/teacher\/marking\?class=\$\{student\.class_id\}&unit=\$\{p\.unit_id\}`/
    );
  });
});

describe("DT canvas Phase 3.6 — class code + student join link share chips", () => {
  it("page.tsx imports + mounts ClassShareChips", () => {
    expect(HUB_SRC).toMatch(
      /import\s+ClassShareChips\s+from\s+["']@\/components\/teacher\/class-hub\/ClassShareChips["']/
    );
    expect(HUB_SRC).toMatch(/<ClassShareChips\s+classCode=\{classCode\}/);
  });

  it("ClassShareChips renders code chip + link chip with click-to-copy testids", () => {
    const CHIPS_SRC = readFileSync(
      join(process.cwd(), "src/components/teacher/class-hub/ClassShareChips.tsx"),
      "utf-8",
    );
    expect(CHIPS_SRC).toContain('data-testid="class-share-chips"');
    expect(CHIPS_SRC).toContain('data-testid="class-share-chip-code"');
    expect(CHIPS_SRC).toContain('data-testid="class-share-chip-link"');
    // The link URL pattern is the existing /login/[classcode] pre-fill
    expect(CHIPS_SRC).toMatch(/\$\{origin\}\/login\/\$\{classCode\}/);
    // copy-to-clipboard via the browser API
    expect(CHIPS_SRC).toContain("navigator.clipboard.writeText");
  });

  it("ClassShareChips returns null when classCode is empty (defensive)", () => {
    const CHIPS_SRC = readFileSync(
      join(process.cwd(), "src/components/teacher/class-hub/ClassShareChips.tsx"),
      "utf-8",
    );
    expect(CHIPS_SRC).toMatch(/if\s*\(\s*!classCode\s*\)\s*return\s+null/);
  });
});

describe("DT canvas Phase 3.6 — studentInitials helper", () => {
  // Helper is lifted to @/lib/teacher/student-initials so vitest can
  // import it cleanly (page.tsx isn't import-safe from test files
  // because of its `"use client"` + JSX). Source-static guards lock
  // the canvas-page wiring + the lifted module exists; the table-
  // driven block below covers the derivation behaviour.
  it("page.tsx imports studentInitials from @/lib/teacher/student-initials", () => {
    expect(HUB_SRC).toMatch(
      /import\s*\{\s*studentInitials\s*\}\s*from\s*["']@\/lib\/teacher\/student-initials["']/
    );
  });

  it("avatar render site uses studentInitials(display_name, username)", () => {
    expect(HUB_SRC).toContain("studentInitials(student.display_name, student.username)");
  });

  // The cases the rebuild needs to support — table-driven so any new
  // surprising input gets a new row instead of a re-derived test.
  it.each<[string | null, string | null, string]>([
    ["Henry Park",  null,        "HP"],
    ["Bea Martinez", null,       "BM"],
    ["Aiden Chen",  null,        "AC"],
    ["Alex",        null,        "AL"],
    [null,          "hh",        "HH"],
    [null,          "cb",        "CB"],
    [null,          "z",         "Z" ],
    [null,          null,        "?" ],
    ["",            "",          "?" ],
    ["  Henry  Park  ", null,    "HP"], // collapses whitespace
  ])("studentInitials(%j, %j) → %j", async (displayName, username, expected) => {
    const { studentInitials } = await import("@/lib/teacher/student-initials");
    expect(studentInitials(displayName, username)).toBe(expected);
  });
});

describe("DT canvas Phase 3.6 — orphan import cleanup", () => {
  // Anti-revert guards. These imports were dropped in Step 4; future
  // cherry-pick / merge that re-introduces them on this page would
  // re-create dead code. The components themselves still live and
  // are imported from their drawers + sub-routes — these guards
  // only assert the *canvas page* doesn't import them again.
  it.each([
    "BadgesTab",
    "LessonSchedule",
    "OpenStudioClassView",
    "NMResultsPanel",
    "NMElementsPanel",
    "PaceFeedbackSummary",
    "IntegrityReport",
    "StudentResponseValue",
    "analyzeIntegrity",
    "ClassProfileOverview",
    "getYearLevelNumber",
    "getPageColor",
  ])("page.tsx does not import %s (lifted to a drawer or dropped per G7/G8/G9)", (sym) => {
    // Match `import … { X } from …` or `import … { …, X, … } from …`
    // anywhere on a non-comment line.
    const re = new RegExp(
      `^[^/\\n]*import[^;]*\\b${sym}\\b[^;]*from`,
      "m",
    );
    expect(HUB_SRC).not.toMatch(re);
  });
});

describe("DT canvas Phase 3.5 — legacy ?tab=gallery compat enhanced", () => {
  it("?tab=gallery opens GalleryDrawer (was no-op before Phase 3.5)", () => {
    // Multiline-anchored: the setGalleryDrawerOpen call must live on
    // a line that doesn't start with `//` (so a commented-out
    // hotfix can't pass the guard silently — lesson from the Phase
    // 3.5 NC where the original regex matched a commented call).
    expect(HUB_SRC).toMatch(
      /tab\s*===\s*"gallery"[\s\S]{0,200}^[^/\n]*setGalleryDrawerOpen\(true\)/m
    );
  });
});
