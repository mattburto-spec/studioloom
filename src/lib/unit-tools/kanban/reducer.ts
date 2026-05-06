/**
 * AG.2.2 — Kanban reducer (pure logic, Lesson #71)
 *
 * Per Lesson #38: this is where WIP=1 enforcement, DoD validation, and
 * "because clause required on Done" pedagogical rules live. The component
 * dispatches against this; tests assert the rules independently.
 *
 * No React, no fetch. Side effects (timestamps) come from a pluggable clock.
 */

import type {
  BlockType,
  KanbanCard,
  KanbanColumn,
  KanbanCountSummary,
  KanbanState,
  LessonActivityLink,
} from "./types";

// ─── Clock injection (testability) ───────────────────────────────────────────

export interface KanbanClock {
  now(): Date;
  /** Optional ID generator for new cards. Defaults to crypto.randomUUID() at module load. */
  newId(): string;
}

const defaultClock: KanbanClock = {
  now: () => new Date(),
  newId: () => crypto.randomUUID(),
};

// ─── Action types ────────────────────────────────────────────────────────────

export type KanbanAction =
  | { type: "createCard"; title: string; status?: KanbanColumn; source?: KanbanCard["source"]; lessonLink?: LessonActivityLink | null }
  | { type: "updateTitle"; cardId: string; title: string }
  | { type: "updateDoD"; cardId: string; dod: string }
  | { type: "moveCard"; cardId: string; toStatus: KanbanColumn; estimateMinutes?: number | null; becauseClause?: string }
  | { type: "markBlocked"; cardId: string; blockType: BlockType }
  | { type: "markUnblocked"; cardId: string }
  | { type: "deleteCard"; cardId: string }
  | { type: "setWipLimit"; limit: number }
  | { type: "loadState"; state: KanbanState };

// ─── Validation results ──────────────────────────────────────────────────────

export interface MoveValidation {
  ok: boolean;
  errors: Array<{ field: "wip" | "dod" | "because"; message: string }>;
}

/**
 * Validate a proposed move BEFORE applying it. The reducer calls this
 * internally; the UI calls it pre-emptively to gate buttons + show
 * actionable error messages.
 */
export function validateMove(
  state: KanbanState,
  cardId: string,
  toStatus: KanbanColumn,
  args: { estimateMinutes?: number | null; becauseClause?: string }
): MoveValidation {
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) {
    return {
      ok: false,
      errors: [{ field: "wip", message: "Card not found" }],
    };
  }

  const errors: MoveValidation["errors"] = [];

  // No-op (same status): always allowed
  if (card.status === toStatus) {
    return { ok: true, errors: [] };
  }

  // WIP limit on Doing — strict cap
  if (toStatus === "doing") {
    const currentDoing = state.cards.filter(
      (c) => c.status === "doing" && c.id !== cardId
    ).length;
    if (currentDoing + 1 > state.wipLimitDoing) {
      errors.push({
        field: "wip",
        message: `WIP limit reached — finish your current Doing card first (limit ${state.wipLimitDoing})`,
      });
    }
  }

  // DoD required for cards entering This Class or beyond
  const dodRequiredFrom: KanbanColumn[] = ["this_class", "doing", "done"];
  if (dodRequiredFrom.includes(toStatus)) {
    const dod = card.dod?.trim() ?? "";
    if (dod.length === 0) {
      errors.push({
        field: "dod",
        message:
          "Definition of Done required (\"I'll know this is done when...\")",
      });
    }
  }

  // Because clause required when moving to Done
  if (toStatus === "done") {
    const becauseRaw = args.becauseClause?.trim() ?? card.becauseClause?.trim() ?? "";
    if (becauseRaw.length === 0) {
      errors.push({
        field: "because",
        message: "Add a because clause before marking Done (Three Cs evidence)",
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

// ─── Reducer ────────────────────────────────────────────────────────────────

export function kanbanReducer(
  state: KanbanState,
  action: KanbanAction,
  clock: KanbanClock = defaultClock
): KanbanState {
  switch (action.type) {
    case "createCard": {
      const now = clock.now().toISOString();
      const card: KanbanCard = {
        id: clock.newId(),
        title: action.title.trim(),
        status: action.status ?? "backlog",
        dod: null,
        estimateMinutes: null,
        actualMinutes: null,
        blockType: null,
        blockedAt: null,
        becauseClause: null,
        lessonLink: action.lessonLink ?? null,
        source: action.source ?? "manual",
        createdAt: now,
        movedAt: null,
        doneAt: null,
      };
      return { ...state, cards: [...state.cards, card] };
    }

    case "updateTitle": {
      return mapCardPure(state, action.cardId, (c) => ({
        ...c,
        title: action.title.trim(),
      }));
    }

    case "updateDoD": {
      return mapCardPure(state, action.cardId, (c) => ({
        ...c,
        dod: action.dod.trim() || null,
      }));
    }

    case "moveCard": {
      const validation = validateMove(state, action.cardId, action.toStatus, {
        estimateMinutes: action.estimateMinutes,
        becauseClause: action.becauseClause,
      });
      if (!validation.ok) {
        // Reducer is total — invalid moves are no-ops (UI should have
        // gated the action, but be defensive). Tests assert this.
        return state;
      }

      const now = clock.now().toISOString();
      const cardBeforeMove = state.cards.find((c) => c.id === action.cardId);

      // Whether the move is a real status change (we already returned no-op
      // earlier; same-status moves keep state untouched too)
      const isSameStatus = cardBeforeMove?.status === action.toStatus;

      const updated = mapCardPure(state, action.cardId, (c) => {
        if (c.status === action.toStatus) return c;

        const next: KanbanCard = { ...c, status: action.toStatus, movedAt: now };

        // Set estimate when entering Doing (if provided)
        if (action.toStatus === "doing") {
          if (action.estimateMinutes !== undefined) {
            next.estimateMinutes = action.estimateMinutes;
          }
        }

        // Set because clause + actual minutes + doneAt when entering Done
        if (action.toStatus === "done") {
          if (action.becauseClause !== undefined) {
            next.becauseClause = action.becauseClause.trim() || null;
          }
          next.doneAt = now;
          // Compute actualMinutes from time-since-doing if we have a movedAt
          // and we were previously in Doing. Defensive — null if uncomputable.
          if (c.status === "doing" && c.movedAt) {
            const start = new Date(c.movedAt).getTime();
            const end = new Date(now).getTime();
            const minutes = Math.max(0, Math.round((end - start) / 60000));
            next.actualMinutes = minutes;
          }
        }

        // Clear blocked state on any successful move
        next.blockType = null;
        next.blockedAt = null;

        return next;
      });

      return {
        ...updated,
        lastMoveAt: isSameStatus ? state.lastMoveAt : now,
      };
    }

    case "markBlocked": {
      const now = clock.now().toISOString();
      return mapCardPure(state, action.cardId, (c) => ({
        ...c,
        blockType: action.blockType,
        blockedAt: now,
      }));
    }

    case "markUnblocked": {
      return mapCardPure(state, action.cardId, (c) => ({
        ...c,
        blockType: null,
        blockedAt: null,
      }));
    }

    case "deleteCard": {
      return {
        ...state,
        cards: state.cards.filter((c) => c.id !== action.cardId),
      };
    }

    case "setWipLimit": {
      const clamped = Math.max(1, Math.min(3, Math.floor(action.limit)));
      return { ...state, wipLimitDoing: clamped };
    }

    case "loadState": {
      return action.state;
    }

    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Pure helper: apply a transform to one card by id, preserve everything
 * else. If cardId is unknown, returns the same state object unchanged
 * (.toEqual()-friendly — no extra props).
 */
function mapCardPure(
  state: KanbanState,
  cardId: string,
  fn: (card: KanbanCard) => KanbanCard
): KanbanState {
  const idx = state.cards.findIndex((c) => c.id === cardId);
  if (idx === -1) return state;
  const next = state.cards.slice();
  next[idx] = fn(next[idx]);
  return { ...state, cards: next };
}

/**
 * Compute denormalized count summary from cards array. Used by:
 * - API write handler (denormalizes onto the row's count columns)
 * - Dashboard cards (AG.8 — read counts directly, but verify-by-recompute
 *   in tests)
 * - UI column headers
 */
export function summarizeCounts(state: KanbanState): KanbanCountSummary {
  const counts: KanbanCountSummary = {
    backlog: 0,
    this_class: 0,
    doing: 0,
    done: 0,
  };
  for (const card of state.cards) {
    counts[card.status]++;
  }
  return counts;
}

/**
 * Find the single Doing card (if any). Convenience for UI rendering of
 * "today's commit" zone. Returns null if WIP=0; first card if multiple
 * (shouldn't happen given WIP enforcement, but defensive).
 */
export function findDoingCard(state: KanbanState): KanbanCard | null {
  return state.cards.find((c) => c.status === "doing") ?? null;
}

/** Filter cards by status — handy for column rendering. */
export function cardsByStatus(
  state: KanbanState,
  status: KanbanColumn
): KanbanCard[] {
  return state.cards.filter((c) => c.status === status);
}

/** Detect a blocked card (any status, blockType not null). */
export function isCardBlocked(card: KanbanCard): boolean {
  return card.blockType !== null;
}

/**
 * Estimate-vs-actual ratio across completed cards. Used by the
 * "estimation calibration" view (Cowork-recommended high-leverage
 * meta-skill). Returns null if no cards have both estimate + actual yet.
 *
 * Ratio < 1 = student over-estimates (pessimistic). Ratio > 1 = student
 * under-estimates (optimistic — common adolescent planning fallacy).
 */
export function estimateAccuracy(state: KanbanState): {
  ratio: number;
  cardsCompared: number;
} | null {
  const completed = state.cards.filter(
    (c) =>
      c.status === "done" &&
      c.estimateMinutes !== null &&
      c.estimateMinutes > 0 &&
      c.actualMinutes !== null
  );
  if (completed.length === 0) return null;
  const totalEst = completed.reduce((s, c) => s + (c.estimateMinutes ?? 0), 0);
  const totalAct = completed.reduce((s, c) => s + (c.actualMinutes ?? 0), 0);
  if (totalEst === 0) return null;
  return {
    ratio: totalAct / totalEst,
    cardsCompared: completed.length,
  };
}
