/**
 * AG.4.1 — Attention-Rotation aggregation (pure).
 *
 * Combines per-student signals into AttentionRow[] sorted "most-needs-attention
 * first". No DB or React imports — the API route does the queries, this module
 * does the math. Per Lesson #71, kept in `.ts` so tests can import without a
 * JSX boundary.
 *
 * Heuristic (intentionally simple for v1, per build brief "oldest activity
 * wins"): each signal contributes points; we sum them. Higher = more attention
 * needed. Bottom-third (by Three Cs aggregate) gets the "Suggested 1:1 today"
 * flag — that's the one Cowork specifically called out as the rotation target.
 */

import type {
  AttentionRow,
  AttentionPanelData,
  ThreeCsScore,
} from "./types";

// ─── Three Cs ──────────────────────────────────────────────────────────────

/**
 * Three Cs canonical competency keys. Matches what the NM survey blocks and
 * teacher observations write into competency_assessments.competency.
 *
 * Per Cowork: Choice (autonomy / decision-making), Causation (because-clauses /
 * reasoning), Change (iteration / responding to evidence).
 */
export const THREE_CS_COMPETENCIES = {
  choice: "agency_in_learning",
  causation: "causation",
  change: "change",
} as const;

export type ThreeCsKey = keyof typeof THREE_CS_COMPETENCIES;

/**
 * One competency assessment row, narrowed to what aggregation needs.
 * Mirrors the relevant subset of competency_assessments columns.
 */
export interface CompetencyAssessmentLike {
  competency: string;
  rating: number;
  source: "student_self" | "teacher_observation";
  created_at: string;
}

/**
 * Average rating per Three Cs dimension. Picks the most recent rating per
 * dimension (regardless of source) — the "current" snapshot. Returns NULL
 * for any dimension with no rating yet.
 */
export function computeThreeCs(
  rows: CompetencyAssessmentLike[]
): ThreeCsScore {
  const latestByCompetency = new Map<string, CompetencyAssessmentLike>();
  for (const r of rows) {
    const existing = latestByCompetency.get(r.competency);
    if (!existing || existing.created_at < r.created_at) {
      latestByCompetency.set(r.competency, r);
    }
  }

  function pickRating(competencyKey: string): number | null {
    const row = latestByCompetency.get(competencyKey);
    return row ? row.rating : null;
  }

  const choice = pickRating(THREE_CS_COMPETENCIES.choice);
  const causation = pickRating(THREE_CS_COMPETENCIES.causation);
  const change = pickRating(THREE_CS_COMPETENCIES.change);

  const present = [choice, causation, change].filter(
    (x): x is number => x !== null
  );
  const aggregate =
    present.length === 0
      ? null
      : present.reduce((a, b) => a + b, 0) / present.length;

  return { choice, causation, change, aggregate };
}

// ─── Most-recent calibration ───────────────────────────────────────────────

/**
 * Most recent teacher_observation row's created_at. NULL if none.
 * "Calibration" in the brief = the moment a teacher rates a student
 * (typically in the side-by-side mini-view).
 */
export function computeLastCalibrationAt(
  rows: CompetencyAssessmentLike[]
): string | null {
  let latest: string | null = null;
  for (const r of rows) {
    if (r.source !== "teacher_observation") continue;
    if (latest === null || r.created_at > latest) {
      latest = r.created_at;
    }
  }
  return latest;
}

// ─── Priority scoring ──────────────────────────────────────────────────────

/**
 * Time gap in hours between two ISO timestamps. NULL when either is missing.
 * Floors negatives to 0 (clock-skew defence).
 */
export function hoursBetween(
  earlierIso: string | null,
  laterIso: string
): number | null {
  if (earlierIso === null) return null;
  const ms = Date.parse(laterIso) - Date.parse(earlierIso);
  if (Number.isNaN(ms)) return null;
  return Math.max(0, ms / (1000 * 60 * 60));
}

/**
 * Attention-priority score. Higher = needs more attention.
 *
 * Components (intentionally simple for v1):
 *   - +1 point per 24h since last kanban move (capped at +7 i.e. 1 week)
 *   - +1 point per 24h since last journal entry (capped at +7)
 *   - +1 point per 24h since last calibration (capped at +14 i.e. 2 weeks)
 *   - +(4 - threeCs.aggregate) when aggregate present, else +2 (unknown)
 *   - Never-anything signals (NULL): treat as +14 days = +14 points
 *
 * "Oldest activity wins" per the brief — students with no activity at all
 * float to the top because all three NULL signals max out the gap points.
 */
export function computeAttentionPriority(input: {
  lastJournalAt: string | null;
  lastKanbanMoveAt: string | null;
  lastCalibrationAt: string | null;
  threeCs: ThreeCsScore;
  nowIso: string;
}): number {
  const { lastJournalAt, lastKanbanMoveAt, lastCalibrationAt, threeCs, nowIso } =
    input;

  function gapDays(iso: string | null, capDays: number): number {
    if (iso === null) return capDays; // "never" = max gap
    const hours = hoursBetween(iso, nowIso) ?? capDays * 24;
    const days = hours / 24;
    return Math.min(days, capDays);
  }

  const journalGap = gapDays(lastJournalAt, 7);
  const kanbanGap = gapDays(lastKanbanMoveAt, 7);
  const calibrationGap = gapDays(lastCalibrationAt, 14);

  // ThreeCs contribution: lower aggregate → more help needed → more priority
  const threeCsContribution =
    threeCs.aggregate === null ? 2 : Math.max(0, 4 - threeCs.aggregate);

  return journalGap + kanbanGap + calibrationGap + threeCsContribution;
}

// ─── Sort + bottom-third flag ──────────────────────────────────────────────

/**
 * Sort rows descending by attentionPriority (highest first). Stable
 * tiebreaker: alphabetical displayName so the panel doesn't shuffle on each
 * refresh.
 */
export function sortByAttention(rows: AttentionRow[]): AttentionRow[] {
  return [...rows].sort((a, b) => {
    if (b.attentionPriority !== a.attentionPriority) {
      return b.attentionPriority - a.attentionPriority;
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

/**
 * Mark the bottom-third (by Three Cs aggregate, treating NULL as worst) as
 * "Suggested 1:1 today". Per Cowork: the rotation is bottom-third by Three
 * Cs, NOT by overall attentionPriority — you might have a high-Three-Cs
 * student who hasn't journalled in a week (different concern, surfaces in
 * sort order but not flagged for 1:1).
 *
 * For class < 3 students, flag bottom 1.
 */
export function flagSuggestedOneOnOne(rows: AttentionRow[]): AttentionRow[] {
  if (rows.length === 0) return rows;
  const sortedByThreeCs = [...rows].sort((a, b) => {
    const aAgg = a.threeCs.aggregate;
    const bAgg = b.threeCs.aggregate;
    // NULL (never rated) treated as 0 (worst) so they always surface
    const aVal = aAgg === null ? 0 : aAgg;
    const bVal = bAgg === null ? 0 : bAgg;
    return aVal - bVal;
  });
  const cutoffCount = Math.max(1, Math.ceil(rows.length / 3));
  const flaggedIds = new Set(
    sortedByThreeCs.slice(0, cutoffCount).map((r) => r.studentId)
  );
  return rows.map((r) => ({
    ...r,
    suggestedOneOnOne: flaggedIds.has(r.studentId),
  }));
}

// ─── Top-level builder ─────────────────────────────────────────────────────

export interface AttentionInputs {
  unitId: string;
  classId: string;
  nowIso: string;
  /** Roster: id + display label. */
  students: Array<{ studentId: string; displayName: string }>;
  /** Most recent journal entry per student (ISO) — or undefined for "never". */
  journalByStudent: Record<string, string | null>;
  /** student_unit_kanban.last_move_at per student. */
  kanbanMoveByStudent: Record<string, string | null>;
  /** All competency_assessments rows for the unit, grouped by student. */
  competencyByStudent: Record<string, CompetencyAssessmentLike[]>;
}

/**
 * One-shot pure builder: takes raw data, returns the panel payload.
 * Centralises the Three Cs / calibration / priority / flag steps so the API
 * route stays thin (just queries + this call).
 */
export function buildAttentionPanel(
  input: AttentionInputs
): AttentionPanelData {
  const { unitId, classId, nowIso, students } = input;

  const baseRows: AttentionRow[] = students.map((s) => {
    const ca = input.competencyByStudent[s.studentId] ?? [];
    const threeCs = computeThreeCs(ca);
    const lastCalibrationAt = computeLastCalibrationAt(ca);
    const lastJournalAt = input.journalByStudent[s.studentId] ?? null;
    const lastKanbanMoveAt = input.kanbanMoveByStudent[s.studentId] ?? null;
    const attentionPriority = computeAttentionPriority({
      lastJournalAt,
      lastKanbanMoveAt,
      lastCalibrationAt,
      threeCs,
      nowIso,
    });
    return {
      studentId: s.studentId,
      displayName: s.displayName,
      lastJournalAt,
      lastKanbanMoveAt,
      lastCalibrationAt,
      threeCs,
      attentionPriority,
      suggestedOneOnOne: false, // filled in by flagSuggestedOneOnOne
    };
  });

  const flagged = flagSuggestedOneOnOne(baseRows);
  const sorted = sortByAttention(flagged);

  return {
    unitId,
    classId,
    nowIso,
    rows: sorted,
  };
}
