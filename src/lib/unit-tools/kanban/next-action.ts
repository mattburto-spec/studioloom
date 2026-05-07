/**
 * Next Action selection — pure helper for the dashboard's "Right now"
 * card. Picks the single most-relevant kanban card a student should
 * focus on RIGHT NOW, plus a state-specific CTA.
 *
 * Priority order:
 *   1. Doing       → "Right now: <card>"        (active work — finish first)
 *   2. This Class  → "Today's commit: <card>"   (already pulled, not started)
 *   3. Backlog     → "Pull one from Backlog"    (CTA — student needs to commit)
 *   4. (empty)     → "Add cards to your Backlog" (CTA — board is empty)
 *
 * Pure function over KanbanState so the dashboard card can call it
 * without any DB or React state plumbing.
 */
import type { KanbanState, KanbanCard } from "./types";
import { cardsByStatus } from "./reducer";

export type NextActionState =
  | "in_progress"
  | "committed"
  | "needs_pull"
  | "empty";

export interface NextAction {
  state: NextActionState;
  /** One-line headline, e.g. "Sand the chassis edges". */
  headline: string;
  /** Short prefix shown in the card eyebrow, e.g. "Right now". */
  eyebrow: string;
  /** Button label. */
  ctaLabel: string;
  /** Optional reference to the underlying kanban card (when one exists). */
  card: KanbanCard | null;
}

/**
 * Decide what the student should focus on next given their current
 * kanban state. Always returns a NextAction — never throws.
 */
export function selectNextAction(state: KanbanState): NextAction {
  const doing = cardsByStatus(state, "doing");
  if (doing.length > 0) {
    return {
      state: "in_progress",
      eyebrow: "Right now",
      headline: doing[0].title,
      ctaLabel: "Open board",
      card: doing[0],
    };
  }

  const thisClass = cardsByStatus(state, "this_class");
  if (thisClass.length > 0) {
    return {
      state: "committed",
      eyebrow: "Today's commit",
      headline: thisClass[0].title,
      ctaLabel: "Move it to Doing",
      card: thisClass[0],
    };
  }

  const backlog = cardsByStatus(state, "backlog");
  if (backlog.length > 0) {
    return {
      state: "needs_pull",
      eyebrow: "Next move",
      headline: "Pull one card from Backlog into This Class",
      ctaLabel: "Open board",
      card: null,
    };
  }

  return {
    state: "empty",
    eyebrow: "Get started",
    headline: "Add cards to your Backlog so you have things to pull from",
    ctaLabel: "Open board",
    card: null,
  };
}
