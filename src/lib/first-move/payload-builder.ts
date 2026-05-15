// Pure helpers powering the First Move block's consolidated payload.
//
// Separating IO (Supabase reads) from logic so the helpers can be
// unit-tested without mocking the whole DB. The route handler at
// /api/student/first-move/[unitId] still does the IO and just feeds
// raw rows into these functions.

import {
  STRATEGY_CANVAS_PROMPTS,
  JOURNAL_PROMPTS,
} from "@/lib/structured-prompts/presets";
import { parseComposedContent } from "@/lib/structured-prompts/payload";
import type { KanbanCard } from "@/lib/unit-tools/kanban/types";

export interface ProgressRowLike {
  responses: Record<string, unknown> | null;
  updated_at: string | null;
}

/**
 * Find the latest non-empty "philosophy" field from any Strategy Canvas
 * response in the student's progress rows for this unit. Returns null
 * when not yet set.
 */
export function extractDesignPhilosophy(
  rows: ProgressRowLike[],
): { value: string | null; updatedAt: string | null } {
  let value: string | null = null;
  let updatedAt: string | null = null;
  let bestTs = 0;
  for (const row of rows) {
    const ts = row.updated_at ? Date.parse(row.updated_at) : 0;
    const responses = row.responses ?? {};
    for (const raw of Object.values(responses)) {
      if (typeof raw !== "string" || raw.length === 0) continue;
      const sc = parseComposedContent(STRATEGY_CANVAS_PROMPTS, raw);
      const philosophy = sc.philosophy?.trim();
      if (philosophy && ts > bestTs) {
        value = philosophy;
        updatedAt = row.updated_at;
        bestTs = ts;
      }
    }
  }
  return { value, updatedAt };
}

/**
 * Find the most recent Process Journal "next" prompt response. Returns
 * null when no journal entries exist yet.
 */
export function extractLastJournalNext(
  rows: ProgressRowLike[],
): { value: string | null; updatedAt: string | null } {
  let value: string | null = null;
  let updatedAt: string | null = null;
  let bestTs = 0;
  for (const row of rows) {
    const ts = row.updated_at ? Date.parse(row.updated_at) : 0;
    const responses = row.responses ?? {};
    for (const raw of Object.values(responses)) {
      if (typeof raw !== "string" || raw.length === 0) continue;
      const jr = parseComposedContent(JOURNAL_PROMPTS, raw);
      const next = jr.next?.trim();
      if (next && ts > bestTs) {
        value = next;
        updatedAt = row.updated_at;
        bestTs = ts;
      }
    }
  }
  return { value, updatedAt };
}

/**
 * Split kanban cards into (this_class lane, most-recently-done card)
 * for the First Move payload.
 */
export function extractKanbanSummary(cards: KanbanCard[]): {
  thisClassCards: KanbanCard[];
  lastDoneCard: { id: string; title: string; doneAt: string | null } | null;
} {
  const thisClassCards = cards.filter((c) => c.status === "this_class");
  const doneCards = cards
    .filter((c) => c.status === "done")
    .sort((a, b) => {
      const aT = a.doneAt ? Date.parse(a.doneAt) : 0;
      const bT = b.doneAt ? Date.parse(b.doneAt) : 0;
      return bT - aT;
    });
  const lastDoneCard = doneCards[0]
    ? {
        id: doneCards[0].id,
        title: doneCards[0].title,
        doneAt: doneCards[0].doneAt,
      }
    : null;
  return { thisClassCards, lastDoneCard };
}

// ─────────────────────────────────────────────────────────────────────
// Upcoming milestones — forward-look from student_unit_timeline
// ─────────────────────────────────────────────────────────────────────

/**
 * Subset of the Timeline milestone shape we need for First Move. Matches
 * `TimelineMilestone` from src/lib/unit-tools/timeline/types.ts. Kept
 * local so the helper stays pure and decoupled from the SQL layer.
 */
export interface TimelineMilestoneLike {
  id: string;
  label: string;
  /** ISO YYYY-MM-DD or null when unset. */
  targetDate: string | null;
  status: "pending" | "done";
}

export interface UpcomingMilestone {
  id: string;
  title: string;
  /** ISO YYYY-MM-DD */
  targetDate: string;
  /** Days from `now` to `targetDate`. Negative = overdue. */
  daysFromNow: number;
  status: "todo" | "in_progress";
}

/**
 * Filter + sort Timeline milestones into the next N pending milestones
 * for the First Move "Coming up next" section. Excludes done milestones
 * and milestones with no target date. Sorted by target date ascending
 * so imminent deadlines surface first; overdue milestones
 * (daysFromNow < 0) still appear so students see what they missed.
 *
 * `nowIso` is injected for testability (defaults to current time).
 */
export function extractUpcomingMilestones(
  milestones: TimelineMilestoneLike[],
  nowIso?: string,
  limit = 3,
): UpcomingMilestone[] {
  const now = nowIso ? new Date(nowIso) : new Date();
  // Normalise `now` to midnight UTC for day-math stability so a milestone
  // dated "today" never returns -1.
  const nowMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const dayMs = 86_400_000;

  const filtered: UpcomingMilestone[] = [];
  for (const m of milestones) {
    if (m.status === "done") continue;
    if (!m.targetDate) continue;
    const target = Date.parse(m.targetDate);
    if (!Number.isFinite(target)) continue;
    const daysFromNow = Math.round((target - nowMidnight) / dayMs);
    filtered.push({
      id: m.id,
      title: m.label,
      targetDate: m.targetDate,
      daysFromNow,
      // Timeline only tracks pending/done; map pending → todo so the
      // FirstMoveBlock UnionType stays { todo | in_progress }.
      status: "todo",
    });
  }

  filtered.sort((a, b) => Date.parse(a.targetDate) - Date.parse(b.targetDate));
  return filtered.slice(0, limit);
}

/**
 * Build the new kanban cards array when a student picks a chosenCardId
 * via First Move. Any existing "doing" cards get demoted to
 * "this_class" so the WIP=1 limit is preserved (gentle swap UX —
 * student's previous Doing slides back to the lane, doesn't get lost).
 *
 * Returns null when the chosen card doesn't exist or is already in
 * "doing" (nothing to do).
 */
export interface KanbanSwapResult {
  newCards: KanbanCard[];
  movedToDoing: { id: string; title: string };
  demotedFromDoing: { id: string; title: string }[];
  /** Use as the lastMoveAt + each touched card's movedAt. */
  timestamp: string;
}

export function swapKanbanForFirstMove(
  cards: KanbanCard[],
  chosenCardId: string,
  nowIso?: string,
): KanbanSwapResult | null {
  const chosen = cards.find((c) => c.id === chosenCardId);
  if (!chosen || chosen.status === "doing") return null;
  const timestamp = nowIso ?? new Date().toISOString();
  const demoted: { id: string; title: string }[] = [];
  const newCards: KanbanCard[] = cards.map((c) => {
    if (c.id === chosen.id) {
      return { ...c, status: "doing" as const, movedAt: timestamp };
    }
    if (c.status === "doing") {
      demoted.push({ id: c.id, title: c.title });
      return { ...c, status: "this_class" as const, movedAt: timestamp };
    }
    return c;
  });
  return {
    newCards,
    movedToDoing: { id: chosen.id, title: chosen.title },
    demotedFromDoing: demoted,
    timestamp,
  };
}
