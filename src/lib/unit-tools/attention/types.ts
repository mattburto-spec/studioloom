/**
 * AG.4 — Teacher Attention-Rotation Panel types.
 *
 * Per the CO2 Racers brief (`docs/units/co2-racers-build-brief.md` §AG.4):
 * surface students who need 1:1 attention. The aggregate signal is a
 * combination of:
 *
 *   - Three Cs score (Choice / Causation / Change) from competency_assessments
 *   - Time-since-last-journal (most recent structured-prompts response in unit)
 *   - Time-since-last-kanban-move (student_unit_kanban.last_move_at)
 *   - Time-since-last-calibration (most recent teacher_observation row)
 *
 * Pure types here so both the API route and the UI panel can import without
 * pulling each other's runtime deps. Per Lesson #71 (pure logic in `.ts`),
 * aggregation is in `aggregate.ts` next door.
 */

/**
 * Three Cs (per Cowork research): Choice / Causation / Change.
 * Each scored 0..4 (rating range from competency_assessments). NULL when
 * the student has no rated competency for that dimension yet.
 */
export interface ThreeCsScore {
  choice: number | null;
  causation: number | null;
  change: number | null;
  /**
   * Average of present dimensions (NULLs ignored). NULL if all three are NULL.
   */
  aggregate: number | null;
}

/**
 * One row per student, summarising "needs attention" signals for a given
 * unit + class context. All ISO timestamps; NULL means "never".
 */
export interface AttentionRow {
  studentId: string;
  displayName: string;
  /** Most recent journal entry submitted under any unit page. NULL if none. */
  lastJournalAt: string | null;
  /** student_unit_kanban.last_move_at. NULL if no kanban activity. */
  lastKanbanMoveAt: string | null;
  /** Most recent competency_assessments row with source='teacher_observation'. */
  lastCalibrationAt: string | null;
  /** Combined Three Cs rating snapshot. */
  threeCs: ThreeCsScore;
  /**
   * Computed "needs attention" priority score. Higher = needs more attention.
   * Heuristic — see `computeAttentionPriority` for weighting.
   */
  attentionPriority: number;
  /**
   * Surfaced as the "Suggested 1:1 today" callout when true. Bottom-third
   * by attentionPriority within this class snapshot.
   */
  suggestedOneOnOne: boolean;
}

/**
 * Full panel payload returned by /api/teacher/student-attention.
 * `nowIso` is the moment the snapshot was taken — UI uses it for "X days ago"
 * computations so the panel doesn't drift while open.
 */
export interface AttentionPanelData {
  unitId: string;
  classId: string;
  nowIso: string;
  rows: AttentionRow[];
}
