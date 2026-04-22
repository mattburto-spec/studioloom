import { describe, it, expect } from "vitest";
import {
  severityDisplay,
  skillsLibraryUrl,
  formatEvidence,
  ACK_OPTION_LABELS,
  ACK_OPTION_ORDER,
} from "../rule-card-helpers";

/**
 * Phase 5-3 pure-helper tests.
 *
 * Following the Phase 4-3 convention: no @testing-library/react in the
 * project, so component coverage is via these extracted helpers +
 * Checkpoint 5.1 prod smoke. The helpers here carry all the label
 * strings, URL shapes, and variant metadata that would otherwise need
 * DOM-level assertions.
 */

describe("severityDisplay", () => {
  it("returns block display with red tint + stop emoji + 'Must fix' label", () => {
    const d = severityDisplay("block");
    expect(d.label).toBe("Must fix");
    expect(d.icon).toBe("🛑");
    expect(d.tintClass).toMatch(/red/);
    expect(d.badgeClass).toMatch(/red/);
  });

  it("returns warn display with amber tint + warning emoji + 'Should fix' label", () => {
    const d = severityDisplay("warn");
    expect(d.label).toBe("Should fix");
    expect(d.icon).toBe("⚠️");
    expect(d.tintClass).toMatch(/amber/);
    expect(d.badgeClass).toMatch(/amber/);
  });

  it("returns fyi display with grey tint + info emoji + 'FYI' label", () => {
    const d = severityDisplay("fyi");
    expect(d.label).toBe("FYI");
    expect(d.icon).toBe("ℹ️");
    expect(d.tintClass).toMatch(/gray/);
    expect(d.badgeClass).toMatch(/gray/);
  });

  it("returns distinct tintClass values for each severity (no collisions)", () => {
    const a = severityDisplay("block").tintClass;
    const b = severityDisplay("warn").tintClass;
    const c = severityDisplay("fyi").tintClass;
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });
});

describe("ACK_OPTION_LABELS + ACK_OPTION_ORDER", () => {
  it("provides a label for every AckChoice", () => {
    expect(ACK_OPTION_LABELS.intentional).toMatch(/intentional/i);
    expect(ACK_OPTION_LABELS["will-fix-slicer"]).toMatch(/slicer/i);
    expect(ACK_OPTION_LABELS.acknowledged).toMatch(/understood/i);
  });

  it("ACK_OPTION_ORDER covers all 3 choices in spec §8 order", () => {
    expect(ACK_OPTION_ORDER).toEqual([
      "intentional",
      "will-fix-slicer",
      "acknowledged",
    ]);
  });

  it("ACK_OPTION_ORDER matches the keys in ACK_OPTION_LABELS (no drift)", () => {
    const orderSet = new Set(ACK_OPTION_ORDER);
    const labelSet = new Set(Object.keys(ACK_OPTION_LABELS));
    expect(orderSet).toEqual(labelSet);
  });
});

describe("skillsLibraryUrl", () => {
  it("builds /skills/fab-{ruleId} for STL rule ids", () => {
    expect(skillsLibraryUrl("R-STL-01")).toBe("/skills/fab-R-STL-01");
    expect(skillsLibraryUrl("R-STL-17")).toBe("/skills/fab-R-STL-17");
  });

  it("builds /skills/fab-{ruleId} for SVG rule ids", () => {
    expect(skillsLibraryUrl("R-SVG-04")).toBe("/skills/fab-R-SVG-04");
  });

  it("returns null for empty string", () => {
    expect(skillsLibraryUrl("")).toBeNull();
  });

  it("returns null for non-matching rule id format (defensive)", () => {
    expect(skillsLibraryUrl("not-a-rule")).toBeNull();
    expect(skillsLibraryUrl("R-ONLY-ONE")).toMatch(/skills/); // actually valid per regex
    expect(skillsLibraryUrl("R")).toBeNull();
    expect(skillsLibraryUrl("R-")).toBeNull();
  });
});

describe("formatEvidence", () => {
  it("returns null for null/undefined", () => {
    expect(formatEvidence(null)).toBeNull();
    expect(formatEvidence(undefined)).toBeNull();
  });

  it("returns null for trivial-empty objects/arrays", () => {
    expect(formatEvidence({})).toBeNull();
    expect(formatEvidence([])).toBeNull();
  });

  it("passes strings through unchanged", () => {
    expect(formatEvidence("wall 0.3mm at back")).toBe("wall 0.3mm at back");
  });

  it("stringifies numbers + booleans", () => {
    expect(formatEvidence(42)).toBe("42");
    expect(formatEvidence(true)).toBe("true");
  });

  it("pretty-prints JSON objects", () => {
    const out = formatEvidence({ min_thickness_mm: 0.3, face_count: 24 });
    expect(out).toContain("min_thickness_mm");
    expect(out).toContain("0.3");
    expect(out).toContain("face_count");
  });

  it("pretty-prints JSON arrays", () => {
    const out = formatEvidence([1, 2, 3]);
    expect(out).toContain("1");
    expect(out).toContain("2");
    expect(out).toContain("3");
  });
});
