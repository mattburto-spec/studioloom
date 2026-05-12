import { describe, it, expect } from "vitest";
import { computePaceSignals } from "../pace";

describe("computePaceSignals", () => {
  it("returns empty results + zeroed stats for empty input", () => {
    const out = computePaceSignals([]);
    expect(out.results).toEqual([]);
    expect(out.stats).toEqual({ n: 0, median: 0, mean: 0, stddev: 0 });
  });

  it("returns paceZ=null for every student when cohort below minimum (n=3, default min=5)", () => {
    const out = computePaceSignals([
      { studentId: "a", responseCount: 1 },
      { studentId: "b", responseCount: 5 },
      { studentId: "c", responseCount: 9 },
    ]);
    expect(out.results.map((r) => r.paceZ)).toEqual([null, null, null]);
    expect(out.stats.n).toBe(3);
    expect(out.stats.median).toBe(5);
    expect(out.stats.mean).toBe(5);
    // sqrt(((1-5)^2 + (5-5)^2 + (9-5)^2) / 3) = sqrt(32/3)
    expect(out.stats.stddev).toBeCloseTo(Math.sqrt(32 / 3), 10);
  });

  it("computes z-scores correctly for [1,5,5,5,9] (mean=5, stddev=sqrt(6.4))", () => {
    const out = computePaceSignals([
      { studentId: "a", responseCount: 1 },
      { studentId: "b", responseCount: 5 },
      { studentId: "c", responseCount: 5 },
      { studentId: "d", responseCount: 5 },
      { studentId: "e", responseCount: 9 },
    ]);
    expect(out.stats.n).toBe(5);
    expect(out.stats.median).toBe(5);
    expect(out.stats.mean).toBe(5);
    expect(out.stats.stddev).toBeCloseTo(Math.sqrt(6.4), 10);

    // z for 1 = (1-5) / sqrt(6.4) ≈ -1.5811388300841898
    expect(out.results[0].paceZ!).toBeCloseTo(-1.5811388300841898, 10);
    // z for middle three = 0
    expect(out.results[1].paceZ).toBe(0);
    expect(out.results[2].paceZ).toBe(0);
    expect(out.results[3].paceZ).toBe(0);
    // z for 9 = (9-5) / sqrt(6.4) ≈ 1.5811388300841898
    expect(out.results[4].paceZ!).toBeCloseTo(1.5811388300841898, 10);
  });

  it("returns paceZ=0 (not NaN) when all students have identical counts (stddev=0)", () => {
    const out = computePaceSignals([
      { studentId: "a", responseCount: 5 },
      { studentId: "b", responseCount: 5 },
      { studentId: "c", responseCount: 5 },
      { studentId: "d", responseCount: 5 },
      { studentId: "e", responseCount: 5 },
    ]);
    expect(out.stats.stddev).toBe(0);
    expect(out.stats.mean).toBe(5);
    expect(out.stats.median).toBe(5);
    for (const r of out.results) {
      expect(r.paceZ).toBe(0);
      expect(Number.isNaN(r.paceZ as number)).toBe(false);
    }
  });

  it("computes odd-n median correctly: [1,2,3,4,5] -> 3", () => {
    const out = computePaceSignals([
      { studentId: "a", responseCount: 1 },
      { studentId: "b", responseCount: 2 },
      { studentId: "c", responseCount: 3 },
      { studentId: "d", responseCount: 4 },
      { studentId: "e", responseCount: 5 },
    ]);
    expect(out.stats.median).toBe(3);
    expect(out.stats.mean).toBe(3);
    // variance = ((-2)^2 + (-1)^2 + 0 + 1 + 4) / 5 = 10/5 = 2 → stddev = sqrt(2)
    expect(out.stats.stddev).toBeCloseTo(Math.sqrt(2), 10);
  });

  it("computes even-n median correctly: [1,2,3,4] with minCohortSize=4 -> 2.5", () => {
    const out = computePaceSignals(
      [
        { studentId: "a", responseCount: 1 },
        { studentId: "b", responseCount: 2 },
        { studentId: "c", responseCount: 3 },
        { studentId: "d", responseCount: 4 },
      ],
      4,
    );
    expect(out.stats.n).toBe(4);
    expect(out.stats.median).toBe(2.5);
    expect(out.stats.mean).toBe(2.5);
  });

  it("produces clean stddev/z for [0,8,8,8,8] (mean=6.4, stddev=3.2)", () => {
    const out = computePaceSignals([
      { studentId: "a", responseCount: 0 },
      { studentId: "b", responseCount: 8 },
      { studentId: "c", responseCount: 8 },
      { studentId: "d", responseCount: 8 },
      { studentId: "e", responseCount: 8 },
    ]);
    expect(out.stats.mean).toBeCloseTo(6.4, 10);
    expect(out.stats.stddev).toBeCloseTo(3.2, 10);
    // median: sorted [0,8,8,8,8] -> middle is 8
    expect(out.stats.median).toBe(8);
    // z for 0 = (0 - 6.4) / 3.2 = -2.0 (exact)
    expect(out.results[0].paceZ!).toBeCloseTo(-2.0, 10);
    // z for 8 = (8 - 6.4) / 3.2 = 0.5 (exact)
    expect(out.results[1].paceZ!).toBeCloseTo(0.5, 10);
  });

  it("preserves input order in results array", () => {
    const out = computePaceSignals([
      { studentId: "first", responseCount: 9 },
      { studentId: "second", responseCount: 1 },
      { studentId: "third", responseCount: 5 },
      { studentId: "fourth", responseCount: 5 },
      { studentId: "fifth", responseCount: 5 },
    ]);
    expect(out.results.map((r) => r.studentId)).toEqual([
      "first",
      "second",
      "third",
      "fourth",
      "fifth",
    ]);
  });
});
