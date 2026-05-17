/**
 * Round 8 (6 May 2026) — NMElementsPanel restoration of teacher setup.
 *
 * Source-static guards locking the contract:
 *   - Slim panel (NOT the 3-step NMConfigPanel)
 *   - Tracks competency + selectedElements + enable toggle
 *   - PRESERVES existing checkpoints (lesson editor owns them)
 *   - Save calls onSave with full NMUnitConfig shape
 *   - Class Hub Metrics tab mounts NMElementsPanel + wires onSave
 *     to /api/teacher/nm-config POST with optimistic update
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PANEL_SRC = readFileSync(
  join(__dirname, "..", "NMElementsPanel.tsx"),
  "utf-8"
);

const CLASS_HUB_SRC = readFileSync(
  join(
    process.cwd(),
    "src/components/teacher/class-hub/ClassCanvas.tsx"
  ),
  "utf-8"
);

describe("NMElementsPanel", () => {
  it("imports element + competency catalogs from @/lib/nm/constants", () => {
    expect(PANEL_SRC).toContain('from "@/lib/nm/constants"');
    expect(PANEL_SRC).toMatch(/import\s*\{[^}]*AGENCY_ELEMENTS/);
    expect(PANEL_SRC).toMatch(/import\s*\{[^}]*NM_COMPETENCIES/);
    expect(PANEL_SRC).toMatch(/import\s*\{[^}]*getElementsForCompetency/);
  });

  it("renders a competency dropdown + element checkbox grid + enable toggle", () => {
    expect(PANEL_SRC).toContain('data-testid="nm-elements-competency"');
    expect(PANEL_SRC).toContain('data-testid="nm-elements-toggle"');
    expect(PANEL_SRC).toMatch(
      /data-testid=\{`nm-elements-checkbox-\$\{el\.id\}`\}/
    );
    expect(PANEL_SRC).toMatch(
      /data-testid=\{`nm-elements-row-\$\{el\.id\}`\}/
    );
  });

  it("toggle uses role=switch + aria-checked for a11y", () => {
    expect(PANEL_SRC).toContain('role="switch"');
    expect(PANEL_SRC).toContain("aria-checked={enabled}");
  });

  it("Select all + Clear all controls present", () => {
    expect(PANEL_SRC).toContain('data-testid="nm-elements-select-all"');
    expect(PANEL_SRC).toContain('data-testid="nm-elements-clear-all"');
  });

  it("PRESERVES existing checkpoints when saving (lesson editor owns them)", () => {
    expect(PANEL_SRC).toMatch(
      /checkpoints:\s*currentConfig\.checkpoints\s*\?\?\s*\{\}/
    );
  });

  it("changing competency drops elements that don't belong to it", () => {
    expect(PANEL_SRC).toMatch(
      /onChange=\{[\s\S]{0,300}getElementsForCompetency\(e\.target\.value\)[\s\S]{0,300}prev\.filter\(/
    );
  });

  it("Save button is disabled when nothing changed (dirty flag)", () => {
    expect(PANEL_SRC).toContain("dirty");
    expect(PANEL_SRC).toMatch(/disabled=\{saving\s*\|\|\s*!dirty\}/);
  });

  it("save shows ✓ Saved + auto-clears after 2s", () => {
    expect(PANEL_SRC).toContain('"saved"');
    expect(PANEL_SRC).toMatch(/setTimeout\(\(\)\s*=>\s*setSaveStatus\("idle"\),\s*2000\)/);
  });

  it("disabled-state UX: tracking-off greys out the controls", () => {
    expect(PANEL_SRC).toMatch(/disabled=\{!enabled\}/);
  });
});

// ─── DT canvas Phase 3.2 Step 4 (16 May 2026) — re-attached on MetricsDrawer ─
// The old `activeTab === "metrics"` mount-anchor in page.tsx went away with
// the tab strip. NMElementsPanel now mounts inside MetricsDrawer
// (src/components/teacher/class-hub/MetricsDrawer.tsx), opened via the
// side-rail "Class metrics · this unit" card CTA. page.tsx passes nmConfig
// + an onNmConfigChange callback to the drawer (the optimistic-update
// pattern lives in page.tsx now, not the drawer); the drawer just calls
// onSave. The violet checkpoint banner moved with the panel.
describe("MetricsDrawer — NMElementsPanel mount (Phase 3.2 Step 4)", () => {
  const DRAWER_SRC = readFileSync(
    join(
      process.cwd(),
      "src/components/teacher/class-hub/MetricsDrawer.tsx"
    ),
    "utf-8"
  );

  it('MetricsDrawer imports NMElementsPanel from "@/components/nm"', () => {
    expect(DRAWER_SRC).toMatch(
      /import\s*\{[^}]*NMElementsPanel[^}]*\}\s*from\s*["']@\/components\/nm["']/
    );
  });

  it("mounts <NMElementsPanel> inside the drawer with currentConfig={nmConfig}", () => {
    expect(DRAWER_SRC).toMatch(
      /<NMElementsPanel[\s\S]{0,200}currentConfig=\{nmConfig\}/
    );
  });

  it("delegates save to the parent via onSave={async (next) => onNmConfigChange(next)}", () => {
    // Mutation lives in page.tsx now (so the optimistic update + revert
    // can use the same setNmConfig state as the row Metrics dots).
    expect(DRAWER_SRC).toMatch(
      /onSave=\{async\s*\(next\)\s*=>\s*\{[\s\S]{0,200}onNmConfigChange\(next\)/
    );
  });

  it("page.tsx wires onNmConfigChange to /api/teacher/nm-config POST with optimistic revert", () => {
    // The optimistic update + revert pattern preserved across the lift.
    const idx = CLASS_HUB_SRC.indexOf("onNmConfigChange");
    expect(idx).toBeGreaterThan(0);
    const slice = CLASS_HUB_SRC.slice(idx, idx + 1500);
    expect(slice).toContain('fetch("/api/teacher/nm-config"');
    expect(slice).toContain('method: "POST"');
    expect(slice).toMatch(/setNmConfig\(next\)/);
    expect(slice).toMatch(/setNmConfig\(previous\)/);
    expect(slice).toMatch(/throw err/);
  });

  it("violet checkpoint pointer banner moved into the drawer (text + colours preserved)", () => {
    expect(DRAWER_SRC).toContain("Per-lesson checkpoints live in the lesson editor");
    expect(DRAWER_SRC).toMatch(/border-violet-200\s+bg-violet-50/);
  });

  it("page.tsx imports + mounts MetricsDrawer gated on metricsDrawerOpen", () => {
    expect(CLASS_HUB_SRC).toMatch(
      /import\s+MetricsDrawer\s+from\s+["']@\/components\/teacher\/class-hub\/MetricsDrawer["']/
    );
    expect(CLASS_HUB_SRC).toMatch(
      /metricsDrawerOpen\s*&&\s*\(\s*<MetricsDrawer/
    );
  });
});
