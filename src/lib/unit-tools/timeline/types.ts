/**
 * AG.3.2 — Timeline tool types
 *
 * Per-student-per-unit Timeline. State stored as JSONB in
 * student_unit_timeline.milestones (migration 20260506010518).
 * Reducer + validators in `reducer.ts` (Lesson #71).
 *
 * Pedagogical anchors (Cowork research):
 * - Backward mapping from race day (Day 1 use case)
 * - Forward planning per class (which milestones land each session)
 * - Variance signal (on-track / tight / behind) computed at READ time
 *   against now() — never stored
 */

export const MILESTONE_STATUSES = ["pending", "done"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

/** A single milestone on the timeline. Persisted in milestones JSONB array. */
export interface TimelineMilestone {
  /** Stable client-generated UUID. */
  id: string;
  /** What the milestone represents (e.g. "Working drawing complete"). */
  label: string;
  /** Soft target date — student-set via backward mapping. ISO YYYY-MM-DD. */
  targetDate: string | null;
  status: MilestoneStatus;
  /** ISO timestamp when marked done. Null while pending. */
  doneAt: string | null;
  /** Order index (0-based) — drives chronological / sequential rendering. */
  order: number;
  /** Anchor flag — set true on milestones the student can't delete (e.g. RACE DAY). */
  isAnchor: boolean;
}

export interface TimelineState {
  milestones: TimelineMilestone[];
  /** Race day / unit-end fixed date (ISO YYYY-MM-DD). Informational. */
  raceDate: string | null;
  /** Last update timestamp. Null if untouched. Drives staleness signal. */
  lastUpdatedAt: string | null;
}

export function emptyTimelineState(): TimelineState {
  return {
    milestones: [],
    raceDate: null,
    lastUpdatedAt: null,
  };
}

/** Variance bucket relative to now + a target date. */
export type VarianceStatus = "on_track" | "tight" | "behind";

/** Denormalized summary — drives dashboard cards (AG.8) + attention rotation (AG.4). */
export interface TimelineSummary {
  next_milestone_label: string | null;
  next_milestone_target_date: string | null;
  pending_count: number;
  done_count: number;
}
