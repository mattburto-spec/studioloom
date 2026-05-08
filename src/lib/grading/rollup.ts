/**
 * G1.4 — Per-criterion rollup from tile grades.
 *
 * Tile grades store one row per (student × tile). At Synthesize time we
 * roll those tile scores up into per-criterion summary rows for the
 * canonical assessment_records.data.criterion_scores[] payload (the shape
 * the rest of StudioLoom already understands).
 *
 * The rollup is pure: given an array of tile grade rows for one student,
 * return a map of { neutral_key → { avg, count, max, sources[] } }. The
 * service layer then maps neutral keys → framework labels via
 * FrameworkAdapter.toLabel() before writing.
 *
 * Aggregation is "weighted average" v1 — every tile gets equal weight.
 * Weighted variants (e.g. weight by activity duration or block type)
 * land in G2 if needed.
 */

import { NEUTRAL_CRITERION_KEYS } from "./save-tile-grade";

export type RollupMode = "average" | "best" | "latest";

export interface TileGradeForRollup {
  tile_id: string;
  page_id: string;
  score: number | null;
  confirmed: boolean;
  criterion_keys: string[];
  graded_at: string | null;
  /** Polish-3 — NA tiles are confirmed but contribute nothing to averages. */
  score_na?: boolean;
}

export interface CriterionRollup {
  /** Neutral key from the 8-key taxonomy. */
  neutral_key: string;
  /** Aggregated score, rounded to nearest integer (frameworks use whole-number scales). */
  score: number;
  /** Raw aggregate before rounding (for transparency). */
  raw: number;
  /** Number of confirmed tile grades feeding this rollup. */
  count: number;
  /** Tile IDs that contributed (for the "evidence" trail in the released record). */
  sources: string[];
}

/**
 * Compute the per-criterion rollup for a single student's tile grades.
 *
 * Only confirmed grades with a non-null score contribute. Empty array =>
 * empty rollup (caller decides if that's a "can't release yet" state).
 */
export function computeStudentRollup(
  grades: TileGradeForRollup[],
  mode: RollupMode = "average",
): CriterionRollup[] {
  const buckets = new Map<string, { scores: number[]; sources: string[]; latest: { score: number; at: string } | null }>();

  for (const g of grades) {
    if (!g.confirmed) continue;
    if (g.score_na) continue; // Polish-3: NA tiles are excluded from averages
    if (g.score === null) continue;
    if (g.criterion_keys.length === 0) continue;
    for (const key of g.criterion_keys) {
      if (!NEUTRAL_CRITERION_KEYS.includes(key as (typeof NEUTRAL_CRITERION_KEYS)[number])) {
        // Defensive: skip non-neutral keys. The DB CHECK should prevent
        // these, but the rollup must not silently include garbage in the
        // released record either.
        continue;
      }
      const b = buckets.get(key) ?? { scores: [], sources: [], latest: null };
      b.scores.push(g.score);
      b.sources.push(g.tile_id);
      if (g.graded_at && (!b.latest || g.graded_at > b.latest.at)) {
        b.latest = { score: g.score, at: g.graded_at };
      }
      buckets.set(key, b);
    }
  }

  const out: CriterionRollup[] = [];
  for (const [key, b] of buckets) {
    const raw =
      mode === "best"
        ? Math.max(...b.scores)
        : mode === "latest" && b.latest
          ? b.latest.score
          : avg(b.scores);
    out.push({
      neutral_key: key,
      score: Math.round(raw),
      raw,
      count: b.scores.length,
      sources: b.sources,
    });
  }

  // Sort by the canonical taxonomy order so the released record is stable.
  const order = new Map(NEUTRAL_CRITERION_KEYS.map((k, i) => [k, i] as const));
  out.sort((a, b) => (order.get(a.neutral_key as (typeof NEUTRAL_CRITERION_KEYS)[number]) ?? 99) - (order.get(b.neutral_key as (typeof NEUTRAL_CRITERION_KEYS)[number]) ?? 99));
  return out;
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/**
 * Convenience: count how many tiles in a set are gradeable + confirmed.
 * Used by the Synthesize view's "X / Y tiles confirmed" indicator.
 */
export function rollupCoverage(
  grades: TileGradeForRollup[],
  totalTilesInUnit: number,
): { confirmed: number; total: number; percent: number } {
  const confirmed = grades.filter((g) => g.confirmed && g.score !== null).length;
  return {
    confirmed,
    total: totalTilesInUnit,
    percent: totalTilesInUnit === 0 ? 0 : Math.round((confirmed / totalTilesInUnit) * 100),
  };
}
