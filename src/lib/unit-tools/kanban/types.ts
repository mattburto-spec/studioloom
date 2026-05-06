/**
 * AG.2.2 — Kanban tool types
 *
 * Per-student-per-unit Kanban board. State stored as JSONB in
 * student_unit_kanban.cards (migration 20260506000324). Reducer +
 * validators in `reducer.ts` (Lesson #71 — pure logic in .ts).
 *
 * Cowork pedagogical anchors:
 * - 4 columns (Backlog → This Class → Doing → Done)
 * - WIP limit on Doing = 1 (default; range 1-3)
 * - Definition of Done required for cards in This Class+
 * - Time-estimation loop (estimate at Doing, actual at Done)
 * - Blockage triage with 4 types (Tool/Skill/Decision/Help)
 * - "Because" clause required when moved to Done (Three Cs evidence)
 */

/** 4-column board. Order matters for the reducer's WIP enforcement. */
export const KANBAN_COLUMNS = ["backlog", "this_class", "doing", "done"] as const;
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

/** Reasons a card might be blocked. Each routes to a different scaffold in the UI. */
export const BLOCK_TYPES = ["tool", "skill", "decision", "help"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/** Where the card came from. Auto-created journal next-moves get a different visual treatment. */
export const CARD_SOURCES = ["manual", "journal_next"] as const;
export type CardSource = (typeof CARD_SOURCES)[number];

/** Lesson activity reference (optional — clicking the card navigates to it). */
export interface LessonActivityLink {
  unit_id: string;
  page_id: string;
  /** 0-based index of the activity within the lesson page. */
  section_index: number;
}

/** A single Kanban card. Persisted as element of `student_unit_kanban.cards` JSONB array. */
export interface KanbanCard {
  /** Stable client-generated UUID (so cards work optimistically before save). */
  id: string;
  title: string;
  status: KanbanColumn;
  /**
   * Definition of Done — required for cards in `this_class`/`doing`/`done`.
   * Null/empty allowed in `backlog` (cards forming up). The reducer's
   * validateMove enforces this at status transitions.
   */
  dod: string | null;
  /**
   * Time estimate in minutes — set when the student moves the card to Doing.
   * Null while card is in Backlog/This Class.
   */
  estimateMinutes: number | null;
  /**
   * Actual time spent in minutes — auto-computed from movedAt timestamps
   * when the card moves to Done. Null until then.
   */
  actualMinutes: number | null;
  /** If non-null, the card is currently blocked. */
  blockType: BlockType | null;
  /** ISO timestamp when the card was marked blocked. Null if not blocked. */
  blockedAt: string | null;
  /**
   * Three Cs `because` clause — required when moved to Done. The reducer
   * enforces this; UI shows a modal prompt on the move-to-Done action.
   */
  becauseClause: string | null;
  /** Optional: card links to a specific lesson activity. */
  lessonLink: LessonActivityLink | null;
  /** Where the card came from. */
  source: CardSource;
  /** ISO timestamp when card was created. */
  createdAt: string;
  /** ISO timestamp of last status change. Null if never moved (still in original status). */
  movedAt: string | null;
  /** ISO timestamp when card moved to Done. Null if not yet done. */
  doneAt: string | null;
}

/** Full board state. Mirrors student_unit_kanban row (cards JSONB + WIP limit + last move). */
export interface KanbanState {
  cards: KanbanCard[];
  wipLimitDoing: number;
  /** ISO timestamp of last status change anywhere on the board. Null if untouched. */
  lastMoveAt: string | null;
}

/** Bare-bones initial state for a brand-new board. */
export function emptyKanbanState(): KanbanState {
  return {
    cards: [],
    wipLimitDoing: 1,
    lastMoveAt: null,
  };
}

/** Denormalized count summary — drives dashboard cards (AG.8) + attention rotation (AG.4). */
export interface KanbanCountSummary {
  backlog: number;
  this_class: number;
  doing: number;
  done: number;
}
