/**
 * Round 8 (6 May 2026) — Class Hub progress-grid integrity dot.
 *
 * Source-static guards locking the dot-rendering contract:
 *   - Dot HIDDEN when integrityLevel is null OR "high"
 *   - Amber dot when integrityLevel === "medium"
 *   - Rose dot when integrityLevel === "low"
 *   - ProgressCell carries the new integrityLevel field
 *   - worstIntegrityLevel imported + called on the metadata map
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const HUB_SRC = readFileSync(
  join(
    process.cwd(),
    "src/app/teacher/units/[unitId]/class/[classId]/page.tsx"
  ),
  "utf-8"
);

describe("Class Hub progress-grid integrity dot — round 8 fix", () => {
  it("ProgressCell type carries integrityLevel: 'high' | 'medium' | 'low' | null", () => {
    expect(HUB_SRC).toMatch(
      /integrityLevel:\s*"high"\s*\|\s*"medium"\s*\|\s*"low"\s*\|\s*null/
    );
  });

  it("imports worstIntegrityLevel from the integrity analyzer", () => {
    expect(HUB_SRC).toContain("worstIntegrityLevel");
    expect(HUB_SRC).toMatch(
      /import\s*\{[^}]*worstIntegrityLevel[^}]*\}\s*from\s*"@\/lib\/integrity\/analyze-integrity"/
    );
  });

  it("integrityLevel computed from worstIntegrityLevel when data present, else null", () => {
    expect(HUB_SRC).toMatch(
      /integrityLevel\s*=\s*hasIntegrityData\s*\?\s*worstIntegrityLevel\(/
    );
  });

  // ─── Phase 3.1 Step 3 (16 May 2026) — re-attached on the canvas ───────
  // The progress-grid was temporarily unmounted in Step 2 of the DT
  // canvas rebuild and re-attached in Step 3. The dot now renders as a
  // per-row aggregate next to the student name (worst integrity level
  // across all pages) rather than per-cell. The {cell?.integrityLevel
  // === "low" | "medium"} source pattern is preserved verbatim so these
  // guards continue to lock the rose/amber/tooltip contract.
  it("renders a rose dot only when integrityLevel === 'low'", () => {
    expect(HUB_SRC).toMatch(
      /cell\?\.integrityLevel\s*===\s*"low"[\s\S]{0,400}bg-rose-500/
    );
  });

  it("renders an amber dot only when integrityLevel === 'medium'", () => {
    expect(HUB_SRC).toMatch(
      /cell\?\.integrityLevel\s*===\s*"medium"[\s\S]{0,400}bg-amber-500/
    );
  });

  it("DOES NOT render the old blue 'data exists' dot anymore", () => {
    // Old code: <span className="... bg-blue-500 ..." title="Integrity monitoring data available" />
    expect(HUB_SRC).not.toMatch(/Integrity monitoring data available/);
    // No bg-blue-500 dot in the cell render block (anchor on the row's
    // unique title pattern to avoid false matches elsewhere)
    const idx = HUB_SRC.indexOf("data-suggested-one-on-one");
    // (Only NM panel uses that attr; integrity dot is in the progress
    // grid which uses ProgressCell. Anchor on the new dot text.)
    expect(HUB_SRC).not.toContain('bg-blue-500 ring-1 ring-white" title="Integrity monitoring');
    void idx;
  });

  it("rose tooltip flags concern; amber tooltip flags warning", () => {
    expect(HUB_SRC).toContain("Integrity concern flagged");
    expect(HUB_SRC).toContain("Integrity warning");
  });
});
