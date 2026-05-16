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

describe("DT canvas Phase 3.3 — Change unit modal + setActiveUnit wiring", () => {
  it("renders the Change unit button (lesson-hero-change-unit testid)", () => {
    expect(HUB_SRC).toContain('data-testid="lesson-hero-change-unit"');
  });

  it("Change unit button onClick opens the modal", () => {
    const idx = HUB_SRC.indexOf('data-testid="lesson-hero-change-unit"');
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

  it("ChangeUnitModal navigates to the new unit's canvas on success", () => {
    const MODAL_SRC = readFileSync(
      join(
        process.cwd(),
        "src/components/teacher/class-hub/ChangeUnitModal.tsx"
      ),
      "utf-8"
    );
    expect(MODAL_SRC).toMatch(
      /router\.push\(`\/teacher\/units\/\$\{targetUnitId\}\/class\/\$\{classId\}`\)/
    );
  });
});
