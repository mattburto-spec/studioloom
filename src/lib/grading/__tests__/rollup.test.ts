import { describe, it, expect } from "vitest";
import {
  computeStudentRollup,
  rollupCoverage,
  type TileGradeForRollup,
} from "../rollup";

function tile(overrides: Partial<TileGradeForRollup>): TileGradeForRollup {
  return {
    tile_id: "activity_x",
    page_id: "p1",
    score: 6,
    confirmed: true,
    criterion_keys: ["designing"],
    graded_at: "2026-04-28T10:00:00Z",
    ...overrides,
  };
}

describe("computeStudentRollup — average mode (default)", () => {
  it("averages scores per neutral key, rounded to nearest integer", () => {
    const rolls = computeStudentRollup([
      tile({ tile_id: "a", criterion_keys: ["designing"], score: 6 }),
      tile({ tile_id: "b", criterion_keys: ["designing"], score: 7 }),
      tile({ tile_id: "c", criterion_keys: ["designing"], score: 5 }),
    ]);
    expect(rolls).toHaveLength(1);
    expect(rolls[0].neutral_key).toBe("designing");
    expect(rolls[0].score).toBe(6); // (6+7+5)/3 = 6
    expect(rolls[0].raw).toBe(6);
    expect(rolls[0].count).toBe(3);
    expect(rolls[0].sources).toEqual(["a", "b", "c"]);
  });

  it("rounds 5.5 up to 6 (standard half-up)", () => {
    const rolls = computeStudentRollup([
      tile({ score: 5 }),
      tile({ score: 6 }),
    ]);
    expect(rolls[0].score).toBe(6);
    expect(rolls[0].raw).toBe(5.5);
  });

  it("splits a tile across multiple criterion_keys (MYP A → researching+analysing)", () => {
    const rolls = computeStudentRollup([
      tile({ tile_id: "t1", criterion_keys: ["researching", "analysing"], score: 7 }),
      tile({ tile_id: "t2", criterion_keys: ["analysing"], score: 5 }),
    ]);
    const researching = rolls.find((r) => r.neutral_key === "researching");
    const analysing = rolls.find((r) => r.neutral_key === "analysing");
    expect(researching?.score).toBe(7); // only contributes to t1
    expect(analysing?.score).toBe(6); // (7+5)/2 = 6
    expect(researching?.sources).toEqual(["t1"]);
    expect(analysing?.sources).toEqual(["t1", "t2"]);
  });

  it("ignores unconfirmed grades", () => {
    const rolls = computeStudentRollup([
      tile({ score: 8, confirmed: false }),
      tile({ score: 4, confirmed: true }),
    ]);
    expect(rolls[0].score).toBe(4);
  });

  it("ignores grades with null score", () => {
    const rolls = computeStudentRollup([
      tile({ score: null }),
      tile({ score: 7 }),
    ]);
    expect(rolls[0].score).toBe(7);
  });

  it("ignores tiles with empty criterion_keys", () => {
    const rolls = computeStudentRollup([
      tile({ criterion_keys: [], score: 8 }),
      tile({ criterion_keys: ["designing"], score: 5 }),
    ]);
    expect(rolls).toHaveLength(1);
    expect(rolls[0].score).toBe(5);
  });

  it("rejects non-neutral keys defensively (DB CHECK should already prevent these)", () => {
    const rolls = computeStudentRollup([
      tile({ criterion_keys: ["bogus_key", "designing"], score: 7 }),
    ]);
    expect(rolls).toHaveLength(1);
    expect(rolls[0].neutral_key).toBe("designing");
  });

  it("returns empty array when no grades", () => {
    expect(computeStudentRollup([])).toEqual([]);
  });

  it("orders results by canonical taxonomy order (researching → planning)", () => {
    const rolls = computeStudentRollup([
      tile({ criterion_keys: ["planning"], score: 5, tile_id: "p" }),
      tile({ criterion_keys: ["researching"], score: 6, tile_id: "r" }),
      tile({ criterion_keys: ["communicating"], score: 7, tile_id: "c" }),
    ]);
    expect(rolls.map((r) => r.neutral_key)).toEqual([
      "researching",
      "communicating",
      "planning",
    ]);
  });
});

describe("computeStudentRollup — best mode", () => {
  it("returns the highest score per criterion", () => {
    const rolls = computeStudentRollup(
      [
        tile({ score: 4 }),
        tile({ score: 7 }),
        tile({ score: 6 }),
      ],
      "best",
    );
    expect(rolls[0].score).toBe(7);
    expect(rolls[0].raw).toBe(7);
  });
});

describe("computeStudentRollup — latest mode", () => {
  it("returns the most recently graded score per criterion", () => {
    const rolls = computeStudentRollup(
      [
        tile({ score: 5, graded_at: "2026-04-25T00:00:00Z" }),
        tile({ score: 8, graded_at: "2026-04-28T00:00:00Z" }),
        tile({ score: 6, graded_at: "2026-04-26T00:00:00Z" }),
      ],
      "latest",
    );
    expect(rolls[0].score).toBe(8);
  });

  it("falls back to average when no graded_at timestamps are present", () => {
    const rolls = computeStudentRollup(
      [
        tile({ score: 4, graded_at: null }),
        tile({ score: 6, graded_at: null }),
      ],
      "latest",
    );
    expect(rolls[0].score).toBe(5); // avg fallback
  });
});

describe("rollupCoverage", () => {
  it("counts confirmed-with-score grades", () => {
    const cov = rollupCoverage(
      [
        tile({ confirmed: true, score: 5 }),
        tile({ confirmed: true, score: null }),
        tile({ confirmed: false, score: 5 }),
        tile({ confirmed: true, score: 7 }),
      ],
      8,
    );
    expect(cov).toEqual({ confirmed: 2, total: 8, percent: 25 });
  });

  it("returns 0 percent when total is 0 (avoids divide-by-zero)", () => {
    expect(rollupCoverage([], 0)).toEqual({ confirmed: 0, total: 0, percent: 0 });
  });

  it("returns 100 when fully confirmed", () => {
    const cov = rollupCoverage(
      [tile({ confirmed: true, score: 5 }), tile({ confirmed: true, score: 6 })],
      2,
    );
    expect(cov.percent).toBe(100);
  });
});
