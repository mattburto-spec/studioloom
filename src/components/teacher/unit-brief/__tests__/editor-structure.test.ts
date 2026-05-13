/**
 * Source-static structural tests for the Brief & Constraints editor
 * components.
 *
 * Convention: this project intentionally has no DOM-render test
 * harness (no @testing-library/react, no jsdom). See
 * src/components/teacher-dashboard-v2/__tests__/RoleChip.test.tsx for
 * the established pattern. Tests here read the component source and
 * assert structural invariants that drive Phase B's behaviour.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const editorSrc = readFileSync(
  join(__dirname, "..", "UnitBriefEditor.tsx"),
  "utf-8",
);
const designSrc = readFileSync(
  join(__dirname, "..", "DesignConstraintsEditor.tsx"),
  "utf-8",
);
const amendmentsSrc = readFileSync(
  join(__dirname, "..", "AmendmentsEditor.tsx"),
  "utf-8",
);

describe("UnitBriefEditor — structure", () => {
  it("renders a Brief prose textarea with id='brief_text'", () => {
    expect(editorSrc).toMatch(/id="brief_text"/);
    expect(editorSrc).toMatch(/<textarea/);
  });

  it("saves brief_text on blur (save-on-blur per Phase B decision)", () => {
    // The textarea wires onBlur → handleBriefTextBlur → savePatch.
    expect(editorSrc).toContain("handleBriefTextBlur");
    expect(editorSrc).toMatch(/onBlur=\{handleBriefTextBlur\}/);
  });

  it("renders Design constraints section ONLY when unit_type === 'design'", () => {
    // The conditional is `isDesignUnit && constraints.archetype === "design"`.
    expect(editorSrc).toMatch(
      /isDesignUnit\s*&&\s*constraints\.archetype\s*===\s*"design"/,
    );
  });

  it("renders the non-Design fallback banner for non-design unit types", () => {
    expect(editorSrc).toMatch(/data-testid="non-design-fallback-banner"/);
    expect(editorSrc).toContain("prose-only brief");
  });

  it("fetches brief + amendments in parallel on mount", () => {
    expect(editorSrc).toContain("Promise.all([");
    expect(editorSrc).toContain("/api/teacher/unit-brief?unitId=");
    expect(editorSrc).toContain("/api/teacher/unit-brief/amendments?unitId=");
  });

  it("save-on-change path uses partial-patch POST (only one field at a time)", () => {
    // savePatch sends just the changed key(s), not the full object.
    expect(editorSrc).toMatch(/savePatch\(\{\s*brief_text:/);
    expect(editorSrc).toMatch(/savePatch\(\{\s*constraints:\s*next\s*\}\)/);
  });

  it("uses encodeURIComponent on unitId to defend against odd characters", () => {
    expect(editorSrc).toMatch(/encodeURIComponent\(unitId\)/);
  });

  it("surfaces save errors via role='alert' for screen reader pickup", () => {
    expect(editorSrc).toMatch(/role="alert"/);
  });

  it("renders a persistent SaveStatusPill with three states (Phase B smoke polish)", () => {
    // Idle (no save yet) → null; saving → indigo; saved → green; error → red.
    // Test the three data-testids that drive the smoke-visible feedback.
    expect(editorSrc).toMatch(/data-testid="save-status-error"/);
    expect(editorSrc).toMatch(/data-testid="save-status-saving"/);
    expect(editorSrc).toMatch(/data-testid="save-status-saved"/);
    // Saved state needs a lastSavedAt timestamp to render — driven by
    // both savePatch + handleAddAmendment success paths.
    expect(editorSrc).toMatch(/setLastSavedAt\(new Date\(\)\)/);
  });
});

describe("DesignConstraintsEditor — structure", () => {
  it("reads MATERIALS_CHIPS from project-spec/archetypes (single source)", () => {
    expect(designSrc).toMatch(
      /import \{ MATERIALS_CHIPS \} from "@\/lib\/project-spec\/archetypes"/,
    );
  });

  it("renders all 6 Design constraint fields", () => {
    // dimensions is now a structured H×W×D + unit (Phase B smoke polish);
    // budget + audience remain free-text. AxisInput passes its id prop
    // through to data-testid={id} so we assert the literal id strings
    // appear in source (the JSX uses interpolation, not a literal attr).
    expect(designSrc).toContain('id="cstr_dim_h"');
    expect(designSrc).toContain('id="cstr_dim_w"');
    expect(designSrc).toContain('id="cstr_dim_d"');
    expect(designSrc).toContain('data-testid="cstr_dim_unit"');
    expect(designSrc).toMatch(/id="cstr_budget"/);
    expect(designSrc).toMatch(/id="cstr_audience"/);
    // materials are chip-pickers + custom free-text adds (Phase B smoke polish)
    expect(designSrc).toContain("materials_whitelist");
    expect(designSrc).toMatch(/data-testid="material-custom-input"/);
    expect(designSrc).toMatch(/data-testid="material-custom-add"/);
    // must_include / must_avoid are repeaters
    expect(designSrc).toMatch(/testIdPrefix="must-include"/);
    expect(designSrc).toMatch(/testIdPrefix="must-avoid"/);
  });

  it("DimensionsField clears stored dimensions when all three axes are empty", () => {
    // The buildNext helper returns undefined when h/w/d all parse empty,
    // and parent setField deletes the key on undefined. This invariant
    // keeps stored JSONB tight (no `dimensions: { unit: "mm" }` noise).
    expect(designSrc).toMatch(
      /next\.h !== undefined \|\| next\.w !== undefined \|\| next\.d !== undefined/,
    );
    expect(designSrc).toContain("// All axes empty → clear the dimensions key entirely.");
  });

  it("MaterialsField separates catalogue chips from custom free-text entries", () => {
    // CATALOGUE_IDS Set drives "is this item a catalogue chip vs custom?"
    expect(designSrc).toMatch(
      /const CATALOGUE_IDS(?::\s*Set<string>)?\s*=\s*new Set\(MATERIALS_CHIPS\.map/,
    );
    // Custom entries render with their own data-testid prefix
    expect(designSrc).toMatch(/data-testid=\{`material-custom-\$\{entry\}`\}/);
    // Enter key adds custom entry (same UX as the repeater pattern below)
    expect(designSrc).toMatch(/e\.key === "Enter"/);
  });

  it("removes empty values from constraints.data (cleanup-on-commit)", () => {
    // Empty strings / empty arrays delete the key — keeps the stored
    // JSONB tight, no `{ dimensions: "", materials_whitelist: [] }` noise.
    expect(designSrc).toMatch(/delete cleaned\[key\]/);
  });

  it("FieldText commits on blur, not on change (Phase B save-on-blur)", () => {
    expect(designSrc).toMatch(/onBlur=\{\(\) => \{[\s\S]*?if \(local !== value\) onCommit\(local\)/);
  });

  it("Repeater Enter key submits, mirroring the Add button", () => {
    expect(designSrc).toMatch(/e\.key === "Enter"/);
  });
});

describe("AmendmentsEditor — structure", () => {
  it("requires all three fields (version_label + title + body)", () => {
    expect(amendmentsSrc).toContain("Version label is required.");
    expect(amendmentsSrc).toContain("Title is required.");
    expect(amendmentsSrc).toContain("Body is required.");
  });

  it("enforces the same 20-char version_label cap as the migration", () => {
    expect(amendmentsSrc).toContain("VERSION_LABEL_MAX = 20");
    expect(amendmentsSrc).toMatch(/maxLength=\{VERSION_LABEL_MAX\}/);
  });

  it("trims whitespace before validation (no all-spaces submissions)", () => {
    expect(amendmentsSrc).toMatch(/versionLabel\.trim\(\)/);
    expect(amendmentsSrc).toMatch(/title\.trim\(\)/);
    expect(amendmentsSrc).toMatch(/body\.trim\(\)/);
  });

  it("clears the draft fields on a successful add (UX: ready for the next one)", () => {
    expect(amendmentsSrc).toMatch(/setVersionLabel\(""\)/);
    expect(amendmentsSrc).toMatch(/setTitle\(""\)/);
    expect(amendmentsSrc).toMatch(/setBody\(""\)/);
  });

  it("shows empty state when there are zero amendments", () => {
    expect(amendmentsSrc).toMatch(/data-testid="amendments-empty"/);
    expect(amendmentsSrc).toContain("No amendments yet");
  });

  it("renders amendments newest-first (caller passes DESC; component doesn't reverse)", () => {
    // The teacher review surface is "latest first". The student drawer
    // is responsible for reversing to oldest-first if/when it wants
    // chronological order (per Phase C drawer spec).
    expect(amendmentsSrc).toMatch(/amendments\.map\(\(a\)/);
    expect(amendmentsSrc).not.toMatch(/\.slice\(\)\.reverse\(\)/);
    expect(amendmentsSrc).not.toMatch(/\[\.\.\.amendments\]\.reverse\(\)/);
  });
});
