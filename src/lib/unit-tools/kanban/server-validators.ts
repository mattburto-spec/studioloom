/**
 * AG.2.3a — server-side validators for Kanban API writes.
 *
 * Pure logic — runs on both client (pre-flight check) and server
 * (defense-in-depth). The reducer enforces the same rules at
 * runtime; these validators check the WIRE shape (could come from
 * a malicious or buggy client).
 *
 * Per Lesson #71: pure .ts so tests don't cross JSX boundary.
 * Per Lesson #38: returns specific error messages, not just bool.
 */

import { BLOCK_TYPES, KANBAN_COLUMNS } from "./types";
import type { KanbanCard, KanbanState } from "./types";

const CARD_SOURCE_VALUES = new Set(["manual", "journal_next"]);
const STATUS_VALUES = new Set<string>(KANBAN_COLUMNS);
const BLOCK_TYPE_VALUES = new Set<string>(BLOCK_TYPES);

const MAX_TITLE_LEN = 200;
const MAX_DOD_LEN = 500;
const MAX_BECAUSE_LEN = 1000;
const MAX_CARDS_PER_BOARD = 200;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function isUuidLike(x: unknown): x is string {
  return typeof x === "string" && /^[0-9a-f-]{20,}$/i.test(x);
}

function isOptIsoTimestamp(x: unknown): x is string | null {
  if (x === null || x === undefined) return true;
  if (typeof x !== "string") return false;
  // Cheap ISO check — not exhaustive, just rules out garbage
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(x);
}

function isOptInteger(x: unknown, min = 0, max = 100000): x is number | null {
  if (x === null || x === undefined) return true;
  return typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
}

// ─── Card validator ─────────────────────────────────────────────────────────

export function validateCard(card: unknown, idx: number): ValidationResult<KanbanCard> {
  const errors: string[] = [];
  if (!card || typeof card !== "object" || Array.isArray(card)) {
    return { ok: false, errors: [`cards[${idx}]: must be an object`] };
  }
  const c = card as Record<string, unknown>;

  if (!isNonEmptyString(c.id)) errors.push(`cards[${idx}].id: required string`);
  if (!isNonEmptyString(c.title)) {
    errors.push(`cards[${idx}].title: required non-empty string`);
  } else if ((c.title as string).length > MAX_TITLE_LEN) {
    errors.push(`cards[${idx}].title: max ${MAX_TITLE_LEN} chars`);
  }

  if (typeof c.status !== "string" || !STATUS_VALUES.has(c.status)) {
    errors.push(`cards[${idx}].status: must be one of ${[...STATUS_VALUES].join(", ")}`);
  }

  // dod: optional string ≤ MAX_DOD_LEN
  if (c.dod !== null && c.dod !== undefined) {
    if (typeof c.dod !== "string") {
      errors.push(`cards[${idx}].dod: must be string or null`);
    } else if (c.dod.length > MAX_DOD_LEN) {
      errors.push(`cards[${idx}].dod: max ${MAX_DOD_LEN} chars`);
    }
  }

  if (!isOptInteger(c.estimateMinutes, 0, 600)) {
    errors.push(`cards[${idx}].estimateMinutes: integer 0-600 or null`);
  }
  if (!isOptInteger(c.actualMinutes, 0, 86400)) {
    errors.push(`cards[${idx}].actualMinutes: integer or null`);
  }

  if (c.blockType !== null && c.blockType !== undefined) {
    if (typeof c.blockType !== "string" || !BLOCK_TYPE_VALUES.has(c.blockType)) {
      errors.push(`cards[${idx}].blockType: must be one of ${[...BLOCK_TYPE_VALUES].join(", ")}, or null`);
    }
  }

  if (!isOptIsoTimestamp(c.blockedAt)) {
    errors.push(`cards[${idx}].blockedAt: ISO timestamp or null`);
  }
  if (!isOptIsoTimestamp(c.movedAt)) {
    errors.push(`cards[${idx}].movedAt: ISO timestamp or null`);
  }
  if (!isOptIsoTimestamp(c.doneAt)) {
    errors.push(`cards[${idx}].doneAt: ISO timestamp or null`);
  }
  if (typeof c.createdAt !== "string" || !isOptIsoTimestamp(c.createdAt)) {
    errors.push(`cards[${idx}].createdAt: required ISO timestamp`);
  }

  if (c.becauseClause !== null && c.becauseClause !== undefined) {
    if (typeof c.becauseClause !== "string") {
      errors.push(`cards[${idx}].becauseClause: must be string or null`);
    } else if (c.becauseClause.length > MAX_BECAUSE_LEN) {
      errors.push(`cards[${idx}].becauseClause: max ${MAX_BECAUSE_LEN} chars`);
    }
  }

  if (c.lessonLink !== null && c.lessonLink !== undefined) {
    if (typeof c.lessonLink !== "object" || Array.isArray(c.lessonLink)) {
      errors.push(`cards[${idx}].lessonLink: must be object or null`);
    } else {
      const ll = c.lessonLink as Record<string, unknown>;
      if (!isUuidLike(ll.unit_id)) {
        errors.push(`cards[${idx}].lessonLink.unit_id: must be UUID`);
      }
      if (!isNonEmptyString(ll.page_id)) {
        errors.push(`cards[${idx}].lessonLink.page_id: required non-empty string`);
      }
      if (typeof ll.section_index !== "number" || !Number.isInteger(ll.section_index) || ll.section_index < 0) {
        errors.push(`cards[${idx}].lessonLink.section_index: must be non-negative integer`);
      }
    }
  }

  if (typeof c.source !== "string" || !CARD_SOURCE_VALUES.has(c.source)) {
    errors.push(`cards[${idx}].source: must be 'manual' or 'journal_next'`);
  }

  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, value: c as unknown as KanbanCard };
}

// ─── State validator ────────────────────────────────────────────────────────

export function validateKanbanState(input: unknown): ValidationResult<KanbanState> {
  const errors: string[] = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["state: must be an object"] };
  }
  const s = input as Record<string, unknown>;

  if (!Array.isArray(s.cards)) {
    return { ok: false, errors: ["state.cards: must be an array"] };
  }
  if (s.cards.length > MAX_CARDS_PER_BOARD) {
    errors.push(
      `state.cards: max ${MAX_CARDS_PER_BOARD} cards per board (got ${s.cards.length})`
    );
  }

  // Validate each card
  const validatedCards: KanbanCard[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < s.cards.length; i++) {
    const cardResult = validateCard(s.cards[i], i);
    if (!cardResult.ok) {
      errors.push(...cardResult.errors);
      continue;
    }
    // Reject duplicate IDs at the wire layer (defensive)
    if (seenIds.has(cardResult.value.id)) {
      errors.push(`cards[${i}].id: duplicate id ${cardResult.value.id}`);
    }
    seenIds.add(cardResult.value.id);
    validatedCards.push(cardResult.value);
  }

  if (
    typeof s.wipLimitDoing !== "number" ||
    !Number.isInteger(s.wipLimitDoing) ||
    s.wipLimitDoing < 1 ||
    s.wipLimitDoing > 3
  ) {
    errors.push("state.wipLimitDoing: must be integer 1-3");
  }

  // WIP limit defense-in-depth: cards in 'doing' must not exceed limit
  const doingCount = validatedCards.filter((c) => c.status === "doing").length;
  const wip =
    typeof s.wipLimitDoing === "number" ? (s.wipLimitDoing as number) : 1;
  if (doingCount > wip) {
    errors.push(
      `state: ${doingCount} cards in 'doing' exceeds wipLimitDoing=${wip}`
    );
  }

  if (!isOptIsoTimestamp(s.lastMoveAt)) {
    errors.push("state.lastMoveAt: ISO timestamp or null");
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      cards: validatedCards,
      wipLimitDoing: s.wipLimitDoing as number,
      lastMoveAt: (s.lastMoveAt as string | null) ?? null,
    },
  };
}

// ─── Count denormalization (server-side recomputation) ──────────────────────

/**
 * Recompute denormalized counts from cards array. Server runs this on
 * every POST so the row-level columns can never drift from the JSONB
 * source of truth.
 */
export function recomputeCounts(state: KanbanState): {
  backlog_count: number;
  this_class_count: number;
  doing_count: number;
  done_count: number;
} {
  let backlog_count = 0;
  let this_class_count = 0;
  let doing_count = 0;
  let done_count = 0;
  for (const c of state.cards) {
    switch (c.status) {
      case "backlog":
        backlog_count++;
        break;
      case "this_class":
        this_class_count++;
        break;
      case "doing":
        doing_count++;
        break;
      case "done":
        done_count++;
        break;
    }
  }
  return { backlog_count, this_class_count, doing_count, done_count };
}
