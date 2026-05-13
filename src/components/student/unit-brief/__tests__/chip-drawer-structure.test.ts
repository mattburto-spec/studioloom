/**
 * Source-static structural tests for the student BriefChip + BriefDrawer.
 *
 * Convention: project intentionally has no DOM-render harness — read
 * component source and assert invariants.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const chipSrc = readFileSync(
  join(__dirname, "..", "BriefChip.tsx"),
  "utf-8",
);
const drawerSrc = readFileSync(
  join(__dirname, "..", "BriefDrawer.tsx"),
  "utf-8",
);

describe("BriefChip — structure (Phase C)", () => {
  it("reads unitId from URL params via useParams (no prop-drilling from BoldTopNav)", () => {
    expect(chipSrc).toMatch(
      /import \{ useParams \} from "next\/navigation"/,
    );
    expect(chipSrc).toContain("const params = useParams();");
  });

  it("handles useParams returning string | string[] | undefined", () => {
    // unitIdParam can be a string, an array (catch-all routes), or absent.
    expect(chipSrc).toMatch(/typeof unitIdParam === "string"/);
    expect(chipSrc).toMatch(/Array\.isArray\(unitIdParam\)/);
  });

  it("renders null when not on a /unit/[unitId]/* route (no unitId)", () => {
    expect(chipSrc).toContain("if (!unitId || !brief) return null;");
  });

  it("hides the chip on 4xx/5xx fetches (convenience surface — fail silently)", () => {
    // Don't surface fetch errors in the nav chrome.
    expect(chipSrc).toMatch(/if \(!res\.ok\)/);
    expect(chipSrc).toContain("setBrief(null)");
  });

  it("fetches once per unitId (caches via loadedForUnitId guard)", () => {
    expect(chipSrc).toContain("loadedForUnitId");
    expect(chipSrc).toMatch(/if \(loadedForUnitId === unitId\) return;/);
  });

  it('chip label is "Brief v1.<amendments.length>" — versions from amendments count', () => {
    expect(chipSrc).toContain('`Brief v1.${amendments.length}`');
  });

  it("uses purple-tinted pill styling (matches Preflight pill pattern)", () => {
    expect(chipSrc).toMatch(/bg-purple-100/);
    expect(chipSrc).toMatch(/text-purple-800/);
  });

  it("clickable button (not Link) since it opens an in-place drawer", () => {
    // type="button" + data-testid="brief-chip" appear in the same JSX
    // element; order doesn't matter (they're attributes on <button>).
    expect(chipSrc).toMatch(/type="button"/);
    expect(chipSrc).toMatch(/data-testid="brief-chip"/);
    expect(chipSrc).toMatch(/onClick=\{\(\) => setOpen\(true\)\}/);
  });

  it("encodeURIComponent on unitId in the fetch URL (defence against odd chars)", () => {
    expect(chipSrc).toContain("encodeURIComponent(unitId)");
  });
});

describe("BriefDrawer — structure (Phase C)", () => {
  it("renders null when open is false (drawer is dom-free when closed)", () => {
    expect(drawerSrc).toContain("if (!open) return null;");
  });

  it("closes on Escape key (a11y)", () => {
    expect(drawerSrc).toMatch(/if \(e\.key === "Escape"\) onClose\(\)/);
  });

  it("closes on backdrop click (data-testid='brief-drawer-backdrop')", () => {
    expect(drawerSrc).toMatch(/data-testid="brief-drawer-backdrop"/);
    expect(drawerSrc).toMatch(/onClick=\{onClose\}/);
  });

  it("renders a dim backdrop + 700px max-width slide-in panel from the right", () => {
    expect(drawerSrc).toMatch(/max-w-\[700px\]/);
    expect(drawerSrc).toMatch(/bg-black\/40/);
    expect(drawerSrc).toMatch(/justify-end/);
  });

  it("uses role=dialog + aria-modal=true (a11y modal pattern)", () => {
    expect(drawerSrc).toMatch(/role="dialog"/);
    expect(drawerSrc).toMatch(/aria-modal="true"/);
  });

  it("section order: prose → diagram → constraints → amendments", () => {
    const proseIdx = drawerSrc.indexOf("brief-drawer-prose");
    const diagramIdx = drawerSrc.indexOf("brief-drawer-diagram");
    const constraintsIdx = drawerSrc.indexOf("brief-drawer-constraints");
    const amendmentsIdx = drawerSrc.indexOf("brief-drawer-amendments");
    expect(proseIdx).toBeGreaterThan(0);
    expect(diagramIdx).toBeGreaterThan(proseIdx);
    expect(constraintsIdx).toBeGreaterThan(diagramIdx);
    expect(amendmentsIdx).toBeGreaterThan(constraintsIdx);
  });

  it("design-constraints view appears only when archetype === 'design' AND data is non-empty", () => {
    expect(drawerSrc).toContain('brief.constraints.archetype === "design"');
    expect(drawerSrc).toMatch(
      /Object\.keys\(brief\.constraints\.data\)\.length\s*>\s*0/,
    );
  });

  it("amendments render top-to-bottom in caller order (oldest-first; no reverse)", () => {
    // The API hands them in ASC order; the drawer maps without reversing.
    expect(drawerSrc).toMatch(/amendments\.map\(\(a\)/);
    expect(drawerSrc).not.toMatch(/\.slice\(\)\.reverse\(\)/);
    expect(drawerSrc).not.toMatch(/\[\.\.\.amendments\]\.reverse\(\)/);
  });

  it("formatDimensions renders an em-space '×' separator + unit suffix", () => {
    expect(drawerSrc).toContain('parts.join(" × ")');
  });

  it("MATERIAL_LABEL_BY_ID maps catalogue ids to human labels; falls back to the raw entry for custom materials", () => {
    expect(drawerSrc).toContain("MATERIAL_LABEL_BY_ID = new Map");
    expect(drawerSrc).toMatch(/MATERIAL_LABEL_BY_ID\.get\(m\)\s*\?\?\s*m/);
  });

  it("empty brief_text renders a friendly placeholder, not an empty <p>", () => {
    expect(drawerSrc).toMatch(/data-testid="brief-drawer-prose-empty"/);
    expect(drawerSrc).toContain("Your teacher hasn");
  });
});

describe("BoldTopNav — BriefChip wiring (Phase C)", () => {
  const navSrc = readFileSync(
    join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "components",
      "student",
      "BoldTopNav.tsx",
    ),
    "utf-8",
  );

  it("imports BriefChip from the unit-brief subdir", () => {
    expect(navSrc).toMatch(
      /import \{ BriefChip \} from "\.\/unit-brief\/BriefChip"/,
    );
  });

  it("renders <BriefChip /> after the pill nav and before the flex-1 spacer", () => {
    const navCloseIdx = navSrc.indexOf("</nav>");
    const briefChipIdx = navSrc.indexOf("<BriefChip");
    const spacerIdx = navSrc.indexOf('<div className="flex-1" />');
    expect(navCloseIdx).toBeGreaterThan(0);
    expect(briefChipIdx).toBeGreaterThan(navCloseIdx);
    expect(spacerIdx).toBeGreaterThan(briefChipIdx);
  });
});
