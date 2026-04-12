/**
 * normalize tests — 5.10.4.
 *
 * Covers the 4 in-the-wild criterion_scores shapes + defensive fallback:
 *   T1 null / undefined  → []
 *   T2 CriterionScore[]  → passthrough
 *   T3 Record<string, CriterionScore> → entries mapped, key fallback
 *   T4 Record<string, number>         → entries mapped to {criterion_key, level}
 *   T5 malformed input                → [] (no throw)
 *
 * See: src/lib/criterion-scores/normalize.ts, Lesson #42.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeCriterionScores,
  type RawCriterionScores,
} from "../normalize";
import type { CriterionScore } from "@/types/assessment";

describe("normalizeCriterionScores (5.10.4)", () => {
  it("T1: null and undefined normalize to []", () => {
    expect(normalizeCriterionScores(null)).toEqual([]);
    expect(normalizeCriterionScores(undefined)).toEqual([]);
  });

  it("T2: array passes through (canonical shape)", () => {
    const input: CriterionScore[] = [
      { criterion_key: "AO1", level: 6 },
      { criterion_key: "AO2", level: 5, comment: "nice work" },
    ];
    const out = normalizeCriterionScores(input);
    expect(out).toHaveLength(2);
    expect(out[0].criterion_key).toBe("AO1");
    expect(out[1].level).toBe(5);
  });

  it("T3: Record<string, CriterionScore> → array, key fallback fills missing criterion_key", () => {
    const input = {
      AO1: { criterion_key: "AO1", level: 7, comment: "c1" },
      // No criterion_key on the value — normalizer should fall back to map key.
      AO2: { level: 4 } as unknown as CriterionScore,
    } as unknown as Record<string, CriterionScore>;
    const out = normalizeCriterionScores(input);
    expect(out).toHaveLength(2);
    const ao1 = out.find((cs) => cs.criterion_key === "AO1");
    const ao2 = out.find((cs) => cs.criterion_key === "AO2");
    expect(ao1?.level).toBe(7);
    expect(ao2?.level).toBe(4);
  });

  it("T4: Record<string, number> → array of {criterion_key, level} (FU-K shape)", () => {
    const input = { AO1: 6, AO2: 5, AO3: 7 } as unknown as Record<
      string,
      number
    >;
    const out = normalizeCriterionScores(input);
    expect(out).toHaveLength(3);
    const ao1 = out.find((cs) => cs.criterion_key === "AO1");
    expect(ao1?.level).toBe(6);
    const ao3 = out.find((cs) => cs.criterion_key === "AO3");
    expect(ao3?.level).toBe(7);
  });

  it("T5: malformed inputs return [] without throwing", () => {
    expect(
      normalizeCriterionScores("garbage" as unknown as RawCriterionScores),
    ).toEqual([]);
    expect(
      normalizeCriterionScores(42 as unknown as RawCriterionScores),
    ).toEqual([]);
    // Empty object → no entries → []
    expect(
      normalizeCriterionScores({} as unknown as RawCriterionScores),
    ).toEqual([]);
  });
});
