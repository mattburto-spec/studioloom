/**
 * FrameworkAdapter test suite — 8 neutral keys × 8 frameworks.
 *
 * Fixture: tests/fixtures/phase-2/framework-adapter-8x8.json is a secondary
 * source of truth — any drift between TS mappings and fixture fails Group 1.
 *
 * Groups:
 *   G1  — 64-cell toLabel forward (deep-equal vs fixture)
 *   G2  — round-trip label cells (fromLabel(toLabel(k).short) ⊇ {k})
 *   G3a — structural sanity (per-framework criterion shorts)
 *   G3b — reverse-table completeness (8 neutral keys × 8 frameworks)
 *   G4  — fromLabel reverse lookups (exact array equality)
 *   G5  — exam-prep context overrides
 *   G6  — UnknownFrameworkError
 *   G7  — discriminated union exhaustiveness
 *   G8  — MYP §3.1 spec-literal anchors
 *
 * See: docs/projects/dimensions3-phase-2-brief.md §5 row 5.9
 *      docs/specs/neutral-criterion-taxonomy.md §3
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  toLabel,
  fromLabel,
  getCriterionLabels,
  UnknownFrameworkError,
  NEUTRAL_CRITERION_KEYS,
  type CriterionLabelResult,
  type FrameworkId,
  type NeutralCriterionKey,
} from "../adapter";

// ─── Fixture ──────────────────────────────────────────────────────────────

interface Fixture {
  cells: Record<FrameworkId, Record<NeutralCriterionKey, CriterionLabelResult>>;
  examPrepOverrides: Array<{
    framework: FrameworkId;
    key: NeutralCriterionKey;
    defaultShort: string;
    examPrepShort: string;
  }>;
  nesaAnalysingFuC: {
    framework: FrameworkId;
    key: NeutralCriterionKey;
    short: string;
    full: string;
    name: string;
  };
}

const fixturePath = join(
  process.cwd(),
  "tests/fixtures/phase-2/framework-adapter-8x8.json"
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;

const FRAMEWORKS: readonly FrameworkId[] = [
  "IB_MYP",
  "GCSE_DT",
  "A_LEVEL_DT",
  "IGCSE_DT",
  "ACARA_DT",
  "PLTW",
  "NESA_DT",
  "VIC_DT",
] as const;

// Flatten 64 cells for parameterised tests.
interface CellEntry {
  framework: FrameworkId;
  key: NeutralCriterionKey;
  expected: CriterionLabelResult;
}
const ALL_CELLS: CellEntry[] = [];
for (const fw of FRAMEWORKS) {
  for (const key of NEUTRAL_CRITERION_KEYS) {
    ALL_CELLS.push({
      framework: fw,
      key,
      expected: fixture.cells[fw][key],
    });
  }
}

// ─── Group 1 — 64-cell toLabel forward ────────────────────────────────────

describe("FrameworkAdapter — G1: 64-cell toLabel forward", () => {
  it.each(ALL_CELLS)(
    "$framework × $key matches fixture",
    ({ framework, key, expected }) => {
      expect(toLabel(key, framework)).toEqual(expected);
    }
  );
});

// ─── Group 2 — round-trip label cells ─────────────────────────────────────

describe("FrameworkAdapter — G2: round-trip label cells", () => {
  const LABEL_CELLS = ALL_CELLS.filter((c) => c.expected.kind === "label");

  it.each(LABEL_CELLS)(
    "$framework × $key round-trips via short",
    ({ framework, key }) => {
      const result = toLabel(key, framework);
      expect(result.kind).toBe("label");
      if (result.kind !== "label") return;
      const keys = fromLabel(result.short, framework);
      expect(keys).toContain(key);
    }
  );
});

// ─── Group 3a — structural sanity ─────────────────────────────────────────

describe("FrameworkAdapter — G3a: structural per-framework shorts", () => {
  const EXPECTED_SHORTS: Record<FrameworkId, readonly string[]> = {
    IB_MYP: ["A", "B", "C", "D"],
    GCSE_DT: ["AO1", "AO2", "AO3", "AO4"],
    A_LEVEL_DT: ["C1", "C2", "C3"],
    IGCSE_DT: ["AO1", "AO2", "AO3"],
    ACARA_DT: ["KU", "PPS"],
    PLTW: ["Design", "Build", "Test", "Present"],
    NESA_DT: ["DP", "Pr", "Ev"],
    VIC_DT: ["TS", "TC", "CDS"],
  };

  it.each(FRAMEWORKS)("%s exposes expected criterion shorts", (fw) => {
    const defs = getCriterionLabels(fw);
    const shorts = defs.map((d) => d.short);
    expect(shorts).toEqual(EXPECTED_SHORTS[fw]);
    expect(defs.length).toBe(EXPECTED_SHORTS[fw].length);
  });
});

// ─── Group 3b — reverse-table completeness ────────────────────────────────

describe("FrameworkAdapter — G3b: reverse-table completeness", () => {
  it.each(FRAMEWORKS)("%s reverse table covers all 8 neutral keys", (fw) => {
    for (const key of NEUTRAL_CRITERION_KEYS) {
      const result = toLabel(key, fw);
      expect(["label", "implicit", "not_assessed"]).toContain(result.kind);
    }
  });
});

// ─── Group 4 — fromLabel reverse lookups ──────────────────────────────────

describe("FrameworkAdapter — G4: fromLabel reverse lookups", () => {
  it("MYP Criterion A → [researching, analysing]", () => {
    expect(fromLabel("Criterion A", "IB_MYP")).toEqual([
      "researching",
      "analysing",
    ]);
  });

  it("NESA Ev → [evaluating, reflecting, analysing]", () => {
    expect(fromLabel("Ev", "NESA_DT")).toEqual([
      "evaluating",
      "reflecting",
      "analysing",
    ]);
  });

  it("IGCSE AO3 → [designing, creating, evaluating]", () => {
    expect(fromLabel("AO3", "IGCSE_DT")).toEqual([
      "designing",
      "creating",
      "evaluating",
    ]);
  });
});

// ─── Group 5 — exam-prep overrides ────────────────────────────────────────

describe("FrameworkAdapter — G5: exam-prep overrides", () => {
  it.each(fixture.examPrepOverrides)(
    "$framework × $key: default=$defaultShort → exam_prep=$examPrepShort",
    ({ framework, key, defaultShort, examPrepShort }) => {
      const defaultResult = toLabel(key, framework);
      expect(defaultResult.kind).toBe("label");
      if (defaultResult.kind === "label") {
        expect(defaultResult.short).toBe(defaultShort);
      }

      const examResult = toLabel(key, framework, { context: "exam_prep" });
      expect(examResult.kind).toBe("label");
      if (examResult.kind === "label") {
        expect(examResult.short).toBe(examPrepShort);
      }
    }
  );
});

// ─── Group 6 — UnknownFrameworkError ──────────────────────────────────────

describe("FrameworkAdapter — G6: UnknownFrameworkError", () => {
  it("toLabel throws UnknownFrameworkError for bogus id", () => {
    expect(() =>
      toLabel("researching", "NOT_A_FRAMEWORK" as FrameworkId)
    ).toThrow(UnknownFrameworkError);
  });

  it("error message contains the bad id", () => {
    try {
      toLabel("researching", "BOGUS_FW" as FrameworkId);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownFrameworkError);
      expect((e as Error).message).toContain("BOGUS_FW");
    }
  });
});

// ─── Group 7 — discriminated union exhaustiveness ─────────────────────────

describe("FrameworkAdapter — G7: discriminated union exhaustiveness", () => {
  it("every toLabel result is one of label/implicit/not_assessed", () => {
    for (const fw of FRAMEWORKS) {
      for (const key of NEUTRAL_CRITERION_KEYS) {
        const r = toLabel(key, fw);
        switch (r.kind) {
          case "label":
            expect(typeof r.short).toBe("string");
            expect(typeof r.full).toBe("string");
            expect(typeof r.name).toBe("string");
            break;
          case "implicit":
            expect(typeof r.mappedTo).toBe("string");
            expect(typeof r.note).toBe("string");
            expect(typeof r.short).toBe("string");
            break;
          case "not_assessed":
            break;
          default: {
            const _exhaustive: never = r;
            throw new Error(
              `Unreachable kind: ${JSON.stringify(_exhaustive)}`
            );
          }
        }
      }
    }
  });
});

// ─── Group 8 — MYP §3.1 spec-literal anchors ──────────────────────────────

describe("FrameworkAdapter — G8: MYP §3.1 spec-literal", () => {
  it("MYP researching → Criterion A (label, exact)", () => {
    expect(toLabel("researching", "IB_MYP")).toEqual({
      kind: "label",
      short: "A",
      full: "Criterion A",
      name: "Inquiring and Analysing",
    });
  });

  it("MYP evaluating → Criterion D (label, exact)", () => {
    expect(toLabel("evaluating", "IB_MYP")).toEqual({
      kind: "label",
      short: "D",
      full: "Criterion D",
      name: "Evaluating",
    });
  });
});
