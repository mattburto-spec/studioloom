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

  it("renders null when not on a /unit/[unitId]/* route", () => {
    expect(chipSrc).toContain("if (!unitId) return null;");
  });

  it("renders null when there's no brief content from any source (Phase F.D)", () => {
    // After F.D, the chip needs to consider all 3 sources: unit_brief,
    // card template, student override. If all are null, hide.
    expect(chipSrc).toMatch(/const hasAnyContent =\s*unitBrief !== null \|\| cardTemplate !== null \|\| studentBrief !== null/);
    expect(chipSrc).toContain("if (!hasAnyContent) return null;");
  });

  it("hides the chip on 4xx/5xx fetches (convenience surface — fail silently)", () => {
    // Don't surface fetch errors in the nav chrome.
    expect(chipSrc).toMatch(/if \(!res\.ok\)/);
    expect(chipSrc).toContain("setUnitBrief(null)");
    expect(chipSrc).toContain("setCardTemplate(null)");
    expect(chipSrc).toContain("setStudentBrief(null)");
  });

  it("fetches on mount/unit-change AND refetches on each drawer open (Phase D)", () => {
    // Stable fetch helper via useCallback so both effects can call it.
    expect(chipSrc).toMatch(/const refetch = useCallback/);
    // Hydration effect — fires on unitId change (via refetch identity).
    expect(chipSrc).toMatch(
      /useEffect\(\(\)\s*=>\s*\{\s*void refetch\(\);\s*\},\s*\[refetch\]\)/,
    );
    // Open-refetch effect — early-return on closed drawer, otherwise refetch.
    expect(chipSrc).toMatch(/if \(!open \|\| !unitId\) return;[\s\S]*?void refetch\(\)/);
  });

  it("doesn't keep a loadedForUnitId cache guard (removed in Phase D so refetches happen)", () => {
    expect(chipSrc).not.toContain("loadedForUnitId");
  });

  it('chip label is "Brief v1.<amendments.length>" — versions from amendments count', () => {
    expect(chipSrc).toContain('`Brief v1.${amendments.length}`');
  });

  it("uses purple-tinted sidebar styling (smoke-fix: full-width button, not top-nav pill)", () => {
    // After the Phase C smoke fix the chip lives in LessonSidebar between
    // the unit title and the Project Board button, so it's styled as a
    // full-width row button (mt-3 + w-full) — not the inline pill it
    // briefly was in BoldTopNav.
    expect(chipSrc).toMatch(/bg-purple-50/);
    expect(chipSrc).toMatch(/text-purple-800/);
    expect(chipSrc).toContain("w-full");
    expect(chipSrc).toContain("mt-3");
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
  it("renders null when open is false OR pre-hydration (drawer is dom-free when closed)", () => {
    expect(drawerSrc).toContain("if (!open || !mounted) return null;");
  });

  it("portal-mounts at document.body to escape ancestor containing blocks (smoke-fix)", () => {
    expect(drawerSrc).toMatch(
      /import \{ createPortal \} from "react-dom"/,
    );
    expect(drawerSrc).toContain("createPortal(");
    expect(drawerSrc).toContain("document.body");
  });

  it("delays portal mount until client (SSR-safety + hydration)", () => {
    expect(drawerSrc).toMatch(/const \[mounted, setMounted\] = useState\(false\)/);
    expect(drawerSrc).toMatch(/setMounted\(true\)/);
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

  it("Phase F.D — drawer takes the 3 merge sources separately (not a pre-merged brief)", () => {
    // The drawer computes the effective brief internally; parent just
    // passes the inputs.
    expect(drawerSrc).toMatch(/unitBrief: UnitBrief \| null/);
    expect(drawerSrc).toMatch(/cardTemplate: CardTemplate \| null/);
    expect(drawerSrc).toMatch(/studentBrief: StudentBrief \| null/);
    expect(drawerSrc).toMatch(/onSaveOverride:/);
    expect(drawerSrc).toContain("computeEffectiveBrief({ unitBrief, cardTemplate, studentBrief })");
  });

  it("Phase F.D — locked fields render read-only; unlocked fields render editable inputs", () => {
    // The conditional renderer pattern: each field's `locked` drives
    // ReadOnlyTextBlock vs an editable input (EditableTextarea /
    // TextInputCommit / DimensionsEditor / MaterialsEditor /
    // RepeaterEditor).
    expect(drawerSrc).toMatch(/effective\.brief_text\.locked \?/);
    expect(drawerSrc).toMatch(/<ReadOnlyTextBlock/);
    expect(drawerSrc).toMatch(/<EditableTextarea/);
    expect(drawerSrc).toMatch(/<DimensionsEditor/);
    expect(drawerSrc).toMatch(/<MaterialsEditor/);
    expect(drawerSrc).toMatch(/<RepeaterEditor/);
  });

  it("Phase F.D — when card has a template, shows a banner with the project label", () => {
    expect(drawerSrc).toMatch(/Your project:/);
    expect(drawerSrc).toContain("cardTemplate.cardLabel");
  });

  it("Phase F.D — save status pill + error pill in the sticky header", () => {
    expect(drawerSrc).toMatch(/data-testid="brief-drawer-saving"/);
    expect(drawerSrc).toMatch(/data-testid="brief-drawer-save-error"/);
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

  it("empty (locked) brief_text renders a friendly placeholder", () => {
    // Phase F.D — empty-state lives inside ReadOnlyTextBlock now.
    expect(drawerSrc).toContain("Your teacher hasn");
  });
});

describe("LessonSidebar — BriefChip wiring (Phase C smoke-fix)", () => {
  // Phase C v1 mounted BriefChip in BoldTopNav, which trapped the
  // drawer behind a transformed ancestor. Smoke-fix moved it into the
  // LessonSidebar between the unit title and the Project Board button
  // — its visual home in the per-unit nav.
  const sidebarSrc = readFileSync(
    join(
      __dirname,
      "..",
      "..",
      "LessonSidebar.tsx",
    ),
    "utf-8",
  );

  it("imports BriefChip from the unit-brief subdir", () => {
    expect(sidebarSrc).toMatch(
      /import \{ BriefChip \} from "\.\/unit-brief\/BriefChip"/,
    );
  });

  it("renders <BriefChip /> between the unit title (h2) and the Project Board button", () => {
    const unitTitleIdx = sidebarSrc.indexOf("{data.unit.title}");
    const briefChipIdx = sidebarSrc.indexOf("<BriefChip");
    const projectBoardIdx = sidebarSrc.indexOf("data-testid=\"lesson-sidebar-project-board\"");
    expect(unitTitleIdx).toBeGreaterThan(0);
    expect(briefChipIdx).toBeGreaterThan(unitTitleIdx);
    expect(projectBoardIdx).toBeGreaterThan(briefChipIdx);
  });
});

describe("BoldTopNav — BriefChip NOT in top nav (Phase C smoke-fix)", () => {
  // Guard against accidental re-introduction. The drawer's containing-
  // block bug only surfaced when the chip mounted inside BoldTopNav.
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

  it("does NOT import BriefChip", () => {
    expect(navSrc).not.toMatch(/import \{ BriefChip \}/);
  });

  it("does NOT render <BriefChip />", () => {
    expect(navSrc).not.toContain("<BriefChip");
  });
});
