// Choice Cards — action dispatcher.
//
// When a student picks a card in a ChoiceCardsBlock, the pick route
// writes the choice_card_selections row + then dispatches the card's
// on_pick_action through this module:
//
//   1. Writes a `choice-card.picked` row to learning_events (the
//      substrate for cross-cutting analytics, Open Studio surfaces,
//      and future consumers).
//   2. Notifies any subscribers registered for this action type.
//
// Subscribers are an in-memory registry for v1 — register at module
// init time (e.g. a Project Spec block registering for 'set-archetype'
// once that consumer ships). Until something registers, dispatch is a
// logged-but-unconsumed no-op.

import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────
// Action types — discriminated union
// ─────────────────────────────────────────────────────────────────────

export type ChoiceCardAction =
  | { type: "set-archetype"; payload: SetArchetypePayload }
  | { type: "set-theme"; payload: { themeId: string } }
  | { type: "set-mentor"; payload: { mentorId: string } }
  | { type: "set-constraint"; payload: { constraintId: string } }
  | { type: "navigate"; payload: { route: string } }
  | { type: "pitch-to-teacher"; payload?: never }
  | { type: "emit-event"; payload: { eventType: string; data: Record<string, unknown> } };

export interface SetArchetypePayload {
  archetypeId: string;
  seedKanban?: Array<{ title: string; listKey: string }>;
}

export interface DispatchContext {
  studentId: string;
  /** UUID of the choice_card_selections row that just landed. */
  selectionId: string;
  /** The lesson ActivitySection.activityId (nanoid8 string). */
  activityId?: string;
  unitId?: string;
  classId?: string;
  cardId: string;
}

export interface DispatchResult {
  /** True if at least one subscriber claimed the action. */
  handled: boolean;
  /** IDs of subscribers that ran. Empty when no one registered. */
  consumerIds: string[];
}

// ─────────────────────────────────────────────────────────────────────
// In-memory subscriber registry
// ─────────────────────────────────────────────────────────────────────

type Handler = (action: ChoiceCardAction, ctx: DispatchContext) => Promise<void> | void;

interface Subscriber {
  id: string;
  actionType: ChoiceCardAction["type"];
  handler: Handler;
}

const subscribers: Subscriber[] = [];

/**
 * Register a handler for a Choice Card action type. Call once at module
 * init (e.g. inside the Project Spec block's startup wiring).
 *
 * Returns an unsubscribe function — useful for tests; not used in app
 * code for v1.
 */
export function registerChoiceCardSubscriber(
  consumerId: string,
  actionType: ChoiceCardAction["type"],
  handler: Handler,
): () => void {
  subscribers.push({ id: consumerId, actionType, handler });
  return () => {
    const i = subscribers.findIndex((s) => s.id === consumerId && s.actionType === actionType);
    if (i >= 0) subscribers.splice(i, 1);
  };
}

/**
 * @internal — exposed for tests.
 */
export function _resetSubscribers(): void {
  subscribers.length = 0;
}

// ─────────────────────────────────────────────────────────────────────
// Dispatch
// ─────────────────────────────────────────────────────────────────────

/**
 * Coerce an arbitrary on_pick_action JSONB blob into our typed union.
 * Returns null if the blob doesn't have a recognized type.
 *
 * Keep this loose — seeded actions reference archetype IDs that the
 * rest of the system may not yet recognize. That's fine; subscribers
 * decide what to do with payload shapes.
 */
export function parseChoiceCardAction(raw: unknown): ChoiceCardAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = r.type;
  if (typeof type !== "string") return null;
  const known: ChoiceCardAction["type"][] = [
    "set-archetype",
    "set-theme",
    "set-mentor",
    "set-constraint",
    "navigate",
    "pitch-to-teacher",
    "emit-event",
  ];
  if (!known.includes(type as ChoiceCardAction["type"])) return null;
  return raw as ChoiceCardAction;
}

/**
 * Fire the action: append to learning_events + notify subscribers.
 *
 * Safe to call even when learning_events doesn't exist (returns
 * `handled: false` and silently skips) — defensive in case the table
 * gets renamed or RLS denies the insert.
 */
export async function dispatchCardAction(
  action: ChoiceCardAction,
  ctx: DispatchContext,
): Promise<DispatchResult> {
  // 1. Append to learning_events.
  await logLearningEvent(action, ctx);

  // 2. Notify subscribers.
  const matching = subscribers.filter((s) => s.actionType === action.type);
  for (const s of matching) {
    try {
      await s.handler(action, ctx);
    } catch (err) {
      // Don't let a buggy subscriber break the pick. Log + carry on.
      console.error(
        `[choice-cards] subscriber "${s.id}" threw on action "${action.type}":`,
        err,
      );
    }
  }

  return {
    handled: matching.length > 0,
    consumerIds: matching.map((s) => s.id),
  };
}

async function logLearningEvent(action: ChoiceCardAction, ctx: DispatchContext): Promise<void> {
  try {
    const db = createAdminClient();
    await db.from("learning_events").insert({
      student_id: ctx.studentId,
      event_type: "choice-card.picked",
      subject_type: "choice_card_selection",
      subject_id: ctx.selectionId,
      payload: {
        cardId: ctx.cardId,
        activityId: ctx.activityId,
        unitId: ctx.unitId,
        classId: ctx.classId,
        action,
      },
    });
  } catch (err) {
    // Non-fatal — pick succeeded, the event log is best-effort.
    console.error("[choice-cards] failed to log learning_event:", err);
  }
}
