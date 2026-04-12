/**
 * render-helpers test suite — 5.10.2.
 *
 * Groups:
 *   G1 — Shape 1 delegation contract (8 frameworks × "researching")
 *   G2 — Shape 2 reverse lookup on framework-native short (8 frameworks)
 *   G3 — Shape 3 legacy MYP letter passthrough + dedupe
 *   G4 — Unknown fallback (bogus tag, empty string)
 *   G5 — Dedupe + __resetWarnedLegacyTags hook
 *   G6 — IB_MYP "A" resolves as shape 2, not shape 3 (no warn)
 *   G7 — GCSE_DT end-to-end vs 5.10.1 fixture captured truth
 *   G8 — getCriterionColor smoke (hex string, determinism, unknown fallback)
 *
 * See: docs/projects/dimensions3-completion-spec.md §5.10.2
 *      src/lib/frameworks/render-helpers.ts (decision log at top of file)
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  renderCriterionLabel,
  getCriterionColor,
  collectCriterionChips,
  __resetWarnedLegacyTags,
  type CriterionChip,
} from "../render-helpers";
import {
  toLabel,
  getCriterionLabels,
  type FrameworkId,
} from "../adapter";

const FRAMEWORKS: readonly FrameworkId[] = [
  "IB_MYP",
  "GCSE_DT",
  "A_LEVEL_DT",
  "IGCSE_DT",
  "ACARA_DT",
  "PLTW",
  "NESA_DT",
  "VIC_DT",
];

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/phase-2");

function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8"));
}

describe("render-helpers — renderCriterionLabel + getCriterionColor (5.10.2)", () => {
  let warnSpy: MockInstance<(...args: unknown[]) => void>;

  beforeEach(() => {
    __resetWarnedLegacyTags();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── G1 — Shape 1 delegation contract ───────────────────────────────────
  describe("G1 — shape 1 delegation (neutral key → toLabel)", () => {
    for (const fw of FRAMEWORKS) {
      it(`${fw}: renderCriterionLabel("researching", fw) delegates to toLabel`, () => {
        const expected = toLabel("researching", fw);
        const actual = renderCriterionLabel("researching", fw);
        expect(actual).toEqual(expected);
      });
    }
  });

  // ─── G2 — Shape 2 reverse lookup ────────────────────────────────────────
  describe("G2 — shape 2 reverse lookup (framework-native short)", () => {
    for (const fw of FRAMEWORKS) {
      it(`${fw}: first criterion's short round-trips via reverse lookup`, () => {
        const first = getCriterionLabels(fw)[0];
        const result = renderCriterionLabel(first.short, fw);
        expect(result).toEqual({
          kind: "label",
          short: first.short,
          full: first.full,
          name: first.name,
        });
      });
    }
  });

  // ─── G3 — Shape 3 legacy passthrough ────────────────────────────────────
  describe("G3 — shape 3 legacy MYP letter passthrough + dedupe", () => {
    it("legacy 'A' on GCSE_DT returns synthetic label", () => {
      const result = renderCriterionLabel("A", "GCSE_DT");
      expect(result).toEqual({
        kind: "label",
        short: "A",
        full: "A",
        name: "Criterion A",
      });
    });

    it("warns exactly once on first legacy passthrough", () => {
      renderCriterionLabel("A", "GCSE_DT");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const msg = String(warnSpy.mock.calls[0]?.[0] ?? "");
      expect(msg).toContain("Legacy MYP letter");
      expect(msg).toContain("GCSE_DT");
    });

    it("second identical call does not re-warn (dedupe by (framework, tag))", () => {
      renderCriterionLabel("A", "GCSE_DT");
      renderCriterionLabel("A", "GCSE_DT");
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("different framework with same letter warns independently", () => {
      renderCriterionLabel("A", "GCSE_DT");
      renderCriterionLabel("A", "A_LEVEL_DT");
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ─── G4 — Unknown fallback ──────────────────────────────────────────────
  describe("G4 — unknown fallback", () => {
    it("bogus tag returns {kind:'unknown', tag}", () => {
      expect(renderCriterionLabel("BOGUS_TAG", "GCSE_DT")).toEqual({
        kind: "unknown",
        tag: "BOGUS_TAG",
      });
    });

    it("empty string tag does not crash, returns unknown", () => {
      expect(renderCriterionLabel("", "GCSE_DT")).toEqual({
        kind: "unknown",
        tag: "",
      });
    });
  });

  // ─── G5 — Dedupe + reset hook ───────────────────────────────────────────
  describe("G5 — dedupe + __resetWarnedLegacyTags", () => {
    it("two identical calls produce one warn", () => {
      renderCriterionLabel("A", "GCSE_DT");
      renderCriterionLabel("A", "GCSE_DT");
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("reset hook clears the dedupe set", () => {
      renderCriterionLabel("A", "GCSE_DT");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      __resetWarnedLegacyTags();
      renderCriterionLabel("A", "GCSE_DT");
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });

    it("different (framework, tag) pairs warn independently post-reset", () => {
      renderCriterionLabel("B", "GCSE_DT");
      renderCriterionLabel("C", "A_LEVEL_DT");
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ─── G6 — IB_MYP "A" is shape 2, not shape 3 ───────────────────────────
  describe("G6 — IB_MYP 'A' resolves as native short (shape 2), not legacy (shape 3)", () => {
    it("returns a label with IB_MYP's native short/full/name for 'A'", () => {
      const mypA = getCriterionLabels("IB_MYP").find((c) => c.short === "A");
      expect(mypA).toBeDefined();
      const result = renderCriterionLabel("A", "IB_MYP");
      expect(result).toEqual({
        kind: "label",
        short: mypA!.short,
        full: mypA!.full,
        name: mypA!.name,
      });
    });

    it("does NOT emit legacy passthrough warn on IB_MYP 'A'", () => {
      renderCriterionLabel("A", "IB_MYP");
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  // ─── G7 — GCSE_DT end-to-end vs 5.10.1 fixture ─────────────────────────
  describe("G7 — GCSE_DT end-to-end vs 5.10.1 student-lesson fixture", () => {
    const fixture = loadFixture("render-paths-student-lesson.json") as {
      pageContent: { sections: Array<{ criterionTags: string[] }> };
      expectedLabels: Record<string, unknown>;
    };
    const tags = Array.from(
      new Set(fixture.pageContent.sections.flatMap((s) => s.criterionTags)),
    );

    for (const tag of tags) {
      it(`renderCriterionLabel("${tag}", "GCSE_DT") matches fixture.expectedLabels["${tag}"]`, () => {
        const actual = renderCriterionLabel(tag, "GCSE_DT");
        expect(actual).toEqual(fixture.expectedLabels[tag]);
      });
    }
  });

  // ─── G9 — collectCriterionChips (5.10.3) ───────────────────────────────
  describe("G9 — collectCriterionChips partition dedup", () => {
    const fixture = loadFixture("render-paths-student-lesson.json") as {
      pageContent: { sections: Array<{ criterionTags?: string[] }> };
    };

    it("GCSE fixture collapses 4 neutral tags → 3 chips (designing+creating both → AO2)", () => {
      const chips = collectCriterionChips(
        fixture.pageContent.sections,
        "GCSE_DT",
      );
      expect(chips).toHaveLength(3);
    });

    it("preserves first-occurrence order [AO1, AO3, AO2]", () => {
      const chips = collectCriterionChips(
        fixture.pageContent.sections,
        "GCSE_DT",
      );
      const shorts = chips
        .filter((c): c is Extract<CriterionChip, { kind: "label" }> => c.kind === "label")
        .map((c) => c.short);
      expect(shorts).toEqual(["AO1", "AO3", "AO2"]);
    });

    it("first-occurrence wins: 'designing' chip keeps its name, 'creating' is dropped", () => {
      const chips = collectCriterionChips(
        fixture.pageContent.sections,
        "GCSE_DT",
      );
      const ao2 = chips.find(
        (c): c is Extract<CriterionChip, { kind: "label" }> =>
          c.kind === "label" && c.short === "AO2",
      );
      expect(ao2).toBeDefined();
      // designing and creating both map to AO2 with identical name in GCSE —
      // the point of this test is that we end with exactly one AO2 chip, not two.
      expect(ao2!.name).toBe(
        "Design and make prototypes that are fit for purpose",
      );
      const ao2Count = chips.filter(
        (c) => c.kind === "label" && c.short === "AO2",
      ).length;
      expect(ao2Count).toBe(1);
    });

    it("unknown tags pass through individually (no dedup)", () => {
      const sections = [
        { criterionTags: ["BOGUS_1", "BOGUS_2"] },
      ];
      const chips = collectCriterionChips(sections, "GCSE_DT");
      expect(chips).toHaveLength(2);
      expect(chips.every((c) => c.kind === "unknown")).toBe(true);
      const tags = chips
        .filter((c): c is Extract<CriterionChip, { kind: "unknown" }> => c.kind === "unknown")
        .map((c) => c.tag);
      expect(tags).toEqual(["BOGUS_1", "BOGUS_2"]);
    });

    it("labels appear before unknowns in output order", () => {
      const sections = [
        { criterionTags: ["BOGUS_TAG", "researching"] },
      ];
      const chips = collectCriterionChips(sections, "GCSE_DT");
      expect(chips).toHaveLength(2);
      expect(chips[0].kind).toBe("label");
      expect(chips[1].kind).toBe("unknown");
    });

    it("empty sections and missing criterionTags are safe", () => {
      expect(collectCriterionChips([], "GCSE_DT")).toEqual([]);
      expect(
        collectCriterionChips([{ criterionTags: [] }, {}], "GCSE_DT"),
      ).toEqual([]);
    });
  });

  // ─── G8 — getCriterionColor smoke ──────────────────────────────────────
  describe("G8 — getCriterionColor", () => {
    it("returns a valid hex color for a known GCSE short", () => {
      const color = getCriterionColor("AO1", "GCSE_DT");
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it("is deterministic (no hidden state)", () => {
      expect(getCriterionColor("AO1", "GCSE_DT")).toBe(
        getCriterionColor("AO1", "GCSE_DT"),
      );
    });

    it("returns a valid hex color for an unknown key (grey fallback)", () => {
      const color = getCriterionColor("TOTALLY_UNKNOWN_KEY", "GCSE_DT");
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});
