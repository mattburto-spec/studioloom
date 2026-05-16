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
    "src/app/teacher/units/[unitId]/class/[classId]/page.tsx"
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

// ─── Deferred to Phase 3.2 — DT canvas Phase 3.1 (Step 2, 16 May 2026) ───
// The Metrics tab was replaced by the side-rail "Class metrics · this unit"
// card in the canvas-grid scaffold. The card is an empty placeholder in
// Phase 3.1 — its CTA ("Score students now →") opens an NM observation
// drawer/sheet that Phase 3.2 (side-rail wiring) will mount NMElementsPanel
// inside. These guards stay skipped until Phase 3.2 lands, at which point
// the mount-anchor changes from `activeTab === "metrics"` to the
// side-rail CTA's drawer/sheet. The first describe block (NMElementsPanel
// behaviour itself) still passes — it locks the component's contract,
// not its mount location.
describe.skip("Class Hub Metrics tab — NMElementsPanel mount (round 8) [unskip in Phase 3.2]", () => {
  it('imports NMElementsPanel from "@/components/nm"', () => {
    expect(CLASS_HUB_SRC).toMatch(
      /import\s*\{[^}]*NMElementsPanel[^}]*\}\s*from\s*"@\/components\/nm"/
    );
  });

  it('mounts <NMElementsPanel> inside the metrics tab', () => {
    // Distance bumped to 1500 (15 May 2026) — panel now lives inside a
    // collapsible <details> with a summary header, which adds markup
    // between activeTab === "metrics" and the panel itself.
    expect(CLASS_HUB_SRC).toMatch(
      /activeTab === "metrics"[\s\S]{0,1500}<NMElementsPanel[\s\S]{0,200}currentConfig=\{nmConfig\}/
    );
  });

  it("onSave POSTs to /api/teacher/nm-config with optimistic update + revert on error", () => {
    const idx = CLASS_HUB_SRC.indexOf("<NMElementsPanel");
    expect(idx).toBeGreaterThan(0);
    const slice = CLASS_HUB_SRC.slice(idx, idx + 1500);
    expect(slice).toContain('fetch("/api/teacher/nm-config"');
    expect(slice).toContain('method: "POST"');
    expect(slice).toMatch(/setNmConfig\(next\)/);
    // Revert on failure
    expect(slice).toMatch(/setNmConfig\(previous\)/);
    expect(slice).toMatch(/throw err/);
  });

  it("yellow checkpoint banner replaced by violet pointer to lesson editor", () => {
    // Old yellow box is gone; new violet box explains where checkpoints
    // live now (lesson editor) without conflicting with the new panel.
    expect(CLASS_HUB_SRC).toContain("Per-lesson checkpoints live in the lesson editor");
    expect(CLASS_HUB_SRC).toMatch(/border-violet-200\s+bg-violet-50/);
  });
});
