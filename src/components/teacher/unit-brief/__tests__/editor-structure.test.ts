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
const diagramSrc = readFileSync(
  join(__dirname, "..", "DiagramUploader.tsx"),
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

describe("DiagramUploader — structure (Phase B.5)", () => {
  it("hidden file input + visible button trigger pattern (no drag-drop polyfill)", () => {
    expect(diagramSrc).toMatch(/data-testid="diagram-file-input"/);
    expect(diagramSrc).toContain('type="file"');
    expect(diagramSrc).toMatch(/className="hidden"/);
    expect(diagramSrc).toContain("fileInputRef.current?.click()");
  });

  it("renders preview + Replace + Remove when a diagram_url is present", () => {
    expect(diagramSrc).toMatch(/data-testid="diagram-preview"/);
    expect(diagramSrc).toMatch(/data-testid="diagram-replace"/);
    expect(diagramSrc).toMatch(/data-testid="diagram-remove"/);
  });

  it("renders dashed empty-state when no diagram is set", () => {
    expect(diagramSrc).toMatch(/data-testid="diagram-empty"/);
    expect(diagramSrc).toContain("border-dashed");
    expect(diagramSrc).toContain("Upload a spec diagram");
  });

  it("client-side validates image MIME + 10MB cap before POSTing", () => {
    expect(diagramSrc).toContain("Only image files are allowed.");
    expect(diagramSrc).toContain("Image too large (max 10MB).");
    expect(diagramSrc).toMatch(/10 \* 1024 \* 1024/);
  });

  it("POSTs multipart/form-data with file + unitId to /api/teacher/unit-brief/diagram", () => {
    expect(diagramSrc).toContain("/api/teacher/unit-brief/diagram");
    expect(diagramSrc).toContain('fd.append("file", file)');
    expect(diagramSrc).toContain('fd.append("unitId", unitId)');
  });

  it("DELETE sends unitId as a URL-encoded query param (not body)", () => {
    expect(diagramSrc).toMatch(
      /fetch\(\s*`\/api\/teacher\/unit-brief\/diagram\?unitId=\$\{encodeURIComponent\(unitId\)\}`/,
    );
    expect(diagramSrc).toContain('method: "DELETE"');
  });

  it("resets file input value after a successful upload (so re-picking the same file re-fires onChange)", () => {
    expect(diagramSrc).toMatch(/fileInputRef\.current\.value = ""/);
  });

  it("bubbles upload errors up to the parent via onError (not local-only)", () => {
    expect(diagramSrc).toMatch(/onError\(/);
    // The parent (UnitBriefEditor) wires onError to setSaveError so the
    // SaveStatusPill picks it up — verify the editor uses that wire.
    expect(editorSrc).toMatch(/onError=\{\(msg\) => setSaveError\(msg\)\}/);
  });
});

describe("UnitBriefEditor — DiagramUploader wiring (Phase B.5)", () => {
  it("hydrates diagram_url from the initial brief fetch", () => {
    expect(editorSrc).toMatch(/setDiagramUrl\(b\.diagram_url \?\? null\)/);
  });

  it("upload success path updates state + advances lastSavedAt + clears errors", () => {
    expect(editorSrc).toContain("setDiagramUrl(next)");
    // Pill should flash green after a successful upload
    expect(editorSrc).toMatch(
      /onUploaded=\{\(next\) => \{[\s\S]*?setLastSavedAt\(new Date\(\)\)/,
    );
  });

  it("DiagramUploader rendered between brief prose and constraints (above amendments)", () => {
    // Match the JSX usage (<Foo), not the import statement (Foo).
    const diagIdx = editorSrc.indexOf("<DiagramUploader");
    const constraintsIdx = editorSrc.indexOf("Constraints (Design only)");
    const amendmentsJsxIdx = editorSrc.indexOf("<AmendmentsEditor");
    expect(diagIdx).toBeGreaterThan(0);
    expect(constraintsIdx).toBeGreaterThan(diagIdx);
    expect(amendmentsJsxIdx).toBeGreaterThan(constraintsIdx);
  });
});

describe("UnitBriefEditor — Phase F.B locks wiring", () => {
  it("imports LockToggle + UnitBriefLocks + LockableField types", () => {
    expect(editorSrc).toMatch(
      /import \{ LockToggle \} from "\.\/LockToggle"/,
    );
    expect(editorSrc).toMatch(/UnitBriefLocks/);
    expect(editorSrc).toMatch(/LockableField/);
  });

  it("hydrates locks state from the initial brief fetch", () => {
    expect(editorSrc).toMatch(/const \[locks, setLocks\] = useState<UnitBriefLocks>\(\{\}\)/);
    expect(editorSrc).toMatch(/setLocks\(b\.locks \?\? \{\}\)/);
  });

  it("toggle handler saves a partial-patch with the updated locks map", () => {
    expect(editorSrc).toMatch(/handleToggleLock/);
    expect(editorSrc).toMatch(/savePatch\(\{ locks: nextLocks \}\)/);
    // Sets `true` or DELETES the key (canonical: only `true` stored).
    expect(editorSrc).toMatch(/nextLocks\[field\] = true/);
    expect(editorSrc).toMatch(/delete nextLocks\[field\]/);
  });

  it("renders a LockToggle next to the brief textarea", () => {
    // The toggle for brief_text appears right after the "Brief" label
    // (visual: label + 🔒 toggle on the right).
    expect(editorSrc).toMatch(
      /<LockToggle[\s\S]*?field="brief_text"[\s\S]*?locked=\{locks\["brief_text"\] === true\}/,
    );
  });

  it("renders a LockToggle for the diagram (passed via lockToggle prop)", () => {
    expect(editorSrc).toMatch(/lockToggle=\{[\s\S]*?field="diagram_url"/);
  });

  it("passes locks + onToggleLock down to DesignConstraintsEditor", () => {
    expect(editorSrc).toMatch(/<DesignConstraintsEditor[\s\S]*?locks=\{locks\}[\s\S]*?onToggleLock=\{handleToggleLock\}/);
  });

  it("explains the locks model in a banner above the fields (smoke-friendly hint)", () => {
    // Polish: dropped the colon after "Locks" when adding the count chip.
    expect(editorSrc).toMatch(/🔒 Locks/);
    expect(editorSrc).toContain("non-negotiable");
  });

  it("post-F.E polish — Lock all / Open all buttons + locked-count summary", () => {
    expect(editorSrc).toMatch(/data-testid="locks-lock-all"/);
    expect(editorSrc).toMatch(/data-testid="locks-unlock-all"/);
    expect(editorSrc).toMatch(/data-testid="locks-count-summary"/);
    expect(editorSrc).toContain("handleLockAll");
    expect(editorSrc).toContain("handleUnlockAll");
    expect(editorSrc).toMatch(/disabled=\{allLocked \|\| saving\}/);
    expect(editorSrc).toMatch(/disabled=\{noneLocked \|\| saving\}/);
  });
});

describe("DesignConstraintsEditor — Phase F.B per-field locks", () => {
  it("imports LockToggle + the locks types", () => {
    expect(designSrc).toMatch(/import \{ LockToggle \} from "\.\/LockToggle"/);
    expect(designSrc).toMatch(/UnitBriefLocks/);
    expect(designSrc).toMatch(/LockableField/);
  });

  it("accepts optional `locks` + `onToggleLock` props (callers without locks still work)", () => {
    expect(designSrc).toMatch(/locks\?: UnitBriefLocks/);
    expect(designSrc).toMatch(
      /onToggleLock\?: \(field: LockableField, next: boolean\) => void/,
    );
  });

  it("renders a LockToggle for each of the 6 design constraint fields", () => {
    // renderLockToggle is called with the canonical LockableField path
    // for each section — dimensions / materials / budget / audience /
    // must_include / must_avoid.
    expect(designSrc).toMatch(/renderLockToggle\("constraints\.dimensions"\)/);
    expect(designSrc).toMatch(/renderLockToggle\("constraints\.materials_whitelist"\)/);
    expect(designSrc).toMatch(/renderLockToggle\("constraints\.budget"\)/);
    expect(designSrc).toMatch(/renderLockToggle\("constraints\.audience"\)/);
    expect(designSrc).toMatch(/renderLockToggle\("constraints\.must_include"\)/);
    expect(designSrc).toMatch(/renderLockToggle\("constraints\.must_avoid"\)/);
  });

  it("returns null from renderLockToggle when parent omits locks prop (backward compat)", () => {
    expect(designSrc).toMatch(/if \(!locks \|\| !onToggleLock\) return null;/);
  });
});

describe("LockToggle — structure", () => {
  const lockToggleSrc = readFileSync(
    join(__dirname, "..", "LockToggle.tsx"),
    "utf-8",
  );

  it("renders 🔒 when locked and 🔓 when open", () => {
    expect(lockToggleSrc).toContain("locked ? \"🔒\" : \"🔓\"");
  });

  it("aria-pressed reflects locked state (a11y toggle button pattern)", () => {
    expect(lockToggleSrc).toMatch(/aria-pressed=\{locked\}/);
  });

  it("post-F.E polish — single bigger pill variant always shows 'Locked' / 'Open' text", () => {
    // Removed compact/full split: every toggle now renders a labelled
    // pill. Visual distinction was too subtle in the icon-only variant.
    expect(lockToggleSrc).not.toMatch(/variant\?: /);
    expect(lockToggleSrc).toContain('const label = locked ? "Locked" : "Open"');
    expect(lockToggleSrc).toMatch(/<span>\{label\}<\/span>/);
  });

  it("locked vs unlocked use distinct high-contrast styles", () => {
    expect(lockToggleSrc).toMatch(/bg-purple-600/);
    expect(lockToggleSrc).toMatch(/bg-white/);
    expect(lockToggleSrc).toMatch(/uppercase tracking-wide/);
  });

  it("data-testid keyed by field path so editors can target individual toggles", () => {
    expect(lockToggleSrc).toMatch(/data-testid=\{`lock-toggle-\$\{field\}`\}/);
  });

  it("title attribute explains the toggle to teachers on hover", () => {
    expect(lockToggleSrc).toContain("student sees your value, can't edit");
    expect(lockToggleSrc).toContain("starter");
  });
});
