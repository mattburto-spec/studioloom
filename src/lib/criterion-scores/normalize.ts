/**
 * normalize — absorber for the 4 criterion_scores shapes seen in the wild.
 *
 * The server canonical shape is `CriterionScore[]` (see
 * `src/types/assessment.ts` + teacher grading route write site). Historical
 * code has written/read three other shapes:
 *
 *   1. null | undefined                    → []  (pre-assessment)
 *   2. CriterionScore[]                    → passthrough  (canonical)
 *   3. Record<string, CriterionScore>      → entries mapped, key fallback
 *   4. Record<string, number>              → entries mapped to {criterion_key, level}
 *
 * Anything else → [] (defensive). No throws — render sites absorb dirtiness,
 * they don't propagate it. See Lesson #42 (dual-shape persistence) + FU-K
 * (student-snapshot route still casts as Record<string, number>).
 */

import type { CriterionScore } from "@/types/assessment";

export type RawCriterionScores =
  | CriterionScore[]
  | Record<string, CriterionScore>
  | Record<string, number>
  | null
  | undefined;

function isCriterionScoreLike(v: unknown): v is Partial<CriterionScore> {
  return (
    typeof v === "object" &&
    v !== null &&
    "level" in v &&
    typeof (v as { level: unknown }).level === "number"
  );
}

export function normalizeCriterionScores(
  raw: RawCriterionScores,
): CriterionScore[] {
  // Shape 1: null / undefined
  if (raw == null) return [];

  // Shape 2: array fast path (canonical)
  if (Array.isArray(raw)) return raw as CriterionScore[];

  // Shapes 3 + 4: object → entries
  if (typeof raw === "object") {
    const out: CriterionScore[] = [];
    for (const [key, val] of Object.entries(raw)) {
      if (typeof val === "number") {
        // Shape 4: Record<string, number>
        out.push({ criterion_key: key, level: val });
      } else if (isCriterionScoreLike(val)) {
        // Shape 3: Record<string, CriterionScore> — fall back to map key if
        // the value itself doesn't carry criterion_key.
        out.push({
          ...(val as CriterionScore),
          criterion_key:
            (val as CriterionScore).criterion_key ?? key,
        });
      }
      // else: skip malformed entry
    }
    return out;
  }

  // Defensive fallback
  return [];
}
