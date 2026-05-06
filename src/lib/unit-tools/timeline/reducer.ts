/**
 * AG.3.2 — Timeline reducer (pure logic, Lesson #71)
 *
 * Same shape as the Kanban reducer:
 *   - Pluggable clock + ID generator for deterministic tests
 *   - Total reducer (invalid actions are no-ops)
 *   - Derived helpers (summarize, computeVariance) for dashboard
 *
 * Per Lesson #38: tests assert specific values, not just non-null.
 */

import type {
  MilestoneStatus,
  TimelineMilestone,
  TimelineState,
  TimelineSummary,
  VarianceStatus,
} from "./types";

// ─── Clock injection ─────────────────────────────────────────────────────────

export interface TimelineClock {
  now(): Date;
  newId(): string;
}

const defaultClock: TimelineClock = {
  now: () => new Date(),
  newId: () => crypto.randomUUID(),
};

// ─── Actions ─────────────────────────────────────────────────────────────────

export type TimelineAction =
  | { type: "addMilestone"; label: string; targetDate?: string | null; isAnchor?: boolean }
  | { type: "updateLabel"; milestoneId: string; label: string }
  | { type: "setTargetDate"; milestoneId: string; date: string | null }
  | { type: "markDone"; milestoneId: string }
  | { type: "markPending"; milestoneId: string }
  | { type: "deleteMilestone"; milestoneId: string }
  | { type: "reorderMilestones"; orderedIds: string[] }
  | { type: "setRaceDate"; date: string | null }
  | { type: "loadState"; state: TimelineState };

// ─── Validation ──────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(x: unknown): x is string {
  return typeof x === "string" && ISO_DATE_RE.test(x);
}

// ─── Reducer ────────────────────────────────────────────────────────────────

export function timelineReducer(
  state: TimelineState,
  action: TimelineAction,
  clock: TimelineClock = defaultClock
): TimelineState {
  switch (action.type) {
    case "addMilestone": {
      const now = clock.now().toISOString();
      const trimmed = action.label.trim();
      if (trimmed.length === 0) return state;
      const targetDate =
        action.targetDate === undefined || action.targetDate === null
          ? null
          : isIsoDate(action.targetDate)
            ? action.targetDate
            : null;
      const next: TimelineMilestone = {
        id: clock.newId(),
        label: trimmed,
        targetDate,
        status: "pending",
        doneAt: null,
        order: state.milestones.length,
        isAnchor: action.isAnchor ?? false,
      };
      return {
        ...state,
        milestones: [...state.milestones, next],
        lastUpdatedAt: now,
      };
    }

    case "updateLabel": {
      const trimmed = action.label.trim();
      if (trimmed.length === 0) return state;
      return mapMilestone(state, action.milestoneId, (m) => ({
        ...m,
        label: trimmed,
      })).withUpdate(clock.now().toISOString());
    }

    case "setTargetDate": {
      if (action.date !== null && !isIsoDate(action.date)) return state;
      return mapMilestone(state, action.milestoneId, (m) => ({
        ...m,
        targetDate: action.date,
      })).withUpdate(clock.now().toISOString());
    }

    case "markDone": {
      const now = clock.now().toISOString();
      return mapMilestone(state, action.milestoneId, (m) =>
        m.status === "done" ? m : { ...m, status: "done", doneAt: now }
      ).withUpdate(now);
    }

    case "markPending": {
      const now = clock.now().toISOString();
      return mapMilestone(state, action.milestoneId, (m) =>
        m.status === "pending" ? m : { ...m, status: "pending", doneAt: null }
      ).withUpdate(now);
    }

    case "deleteMilestone": {
      const now = clock.now().toISOString();
      const target = state.milestones.find((m) => m.id === action.milestoneId);
      if (!target) return state;
      // Anchors can't be deleted (defensive — UI also gates this)
      if (target.isAnchor) return state;
      const filtered = state.milestones
        .filter((m) => m.id !== action.milestoneId)
        // Compact orders to remove the gap
        .map((m, idx) => ({ ...m, order: idx }));
      return {
        ...state,
        milestones: filtered,
        lastUpdatedAt: now,
      };
    }

    case "reorderMilestones": {
      // Map each milestone's id → new order. Skip the action if any id is unknown.
      const orderById = new Map<string, number>();
      action.orderedIds.forEach((id, idx) => orderById.set(id, idx));
      const known = state.milestones.every((m) => orderById.has(m.id));
      const sameLen = action.orderedIds.length === state.milestones.length;
      if (!known || !sameLen) return state;
      const now = clock.now().toISOString();
      const reordered = state.milestones
        .map((m) => ({ ...m, order: orderById.get(m.id) ?? m.order }))
        .sort((a, b) => a.order - b.order);
      return { ...state, milestones: reordered, lastUpdatedAt: now };
    }

    case "setRaceDate": {
      if (action.date !== null && !isIsoDate(action.date)) return state;
      return {
        ...state,
        raceDate: action.date,
        lastUpdatedAt: clock.now().toISOString(),
      };
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface MapMilestoneResult extends TimelineState {
  withUpdate(timestamp: string): TimelineState;
}

function mapMilestone(
  state: TimelineState,
  milestoneId: string,
  fn: (m: TimelineMilestone) => TimelineMilestone
): MapMilestoneResult {
  const idx = state.milestones.findIndex((m) => m.id === milestoneId);
  if (idx === -1) {
    // Return state untouched, but expose a no-op .withUpdate for chain consistency
    return Object.assign({}, state, {
      withUpdate(_ts: string): TimelineState {
        return state;
      },
    });
  }
  const next = state.milestones.slice();
  next[idx] = fn(next[idx]);
  const baseState: TimelineState = { ...state, milestones: next };
  return Object.assign({}, baseState, {
    withUpdate(timestamp: string): TimelineState {
      return { ...baseState, lastUpdatedAt: timestamp };
    },
  });
}

/**
 * Find the next pending milestone with a non-null target date. Used by
 * the dashboard summary + attention-rotation panel. Returns null when
 * no pending milestones have target dates.
 *
 * Tie-break: earliest target date wins. If multiple share the same date,
 * lower `order` wins.
 */
export function findNextPendingTargeted(
  state: TimelineState
): TimelineMilestone | null {
  const candidates = state.milestones.filter(
    (m) => m.status === "pending" && m.targetDate !== null
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, current) => {
    const bestDate = best.targetDate as string;
    const currentDate = current.targetDate as string;
    if (currentDate < bestDate) return current;
    if (currentDate === bestDate && current.order < best.order) return current;
    return best;
  });
}

/**
 * Variance status — computed at READ time against a reference now.
 * - 'on_track': target is ≥ 7 days away (plenty of time)
 * - 'tight':    target is 3-6 days away (start working on it)
 * - 'behind':   target is in the past OR ≤ 2 days away (urgent)
 *
 * Smoke-feedback 6 May 2026: original 2-day "tight" + only-past "behind"
 * thresholds didn't fire any color change for typical race-day planning
 * (milestones 1-2 weeks out). Widened so the traffic light actually
 * shifts as a milestone approaches.
 *
 * Caller passes nowIso to make this testable. If milestone is done, we
 * still compute variance against original target — but typically callers
 * only care about pending milestones.
 */
export function computeVariance(
  targetDate: string | null,
  nowIso: string
): VarianceStatus | null {
  if (targetDate === null) return null;
  if (!ISO_DATE_RE.test(targetDate)) return null;
  // Compare just the date parts (ignore time-of-day to avoid timezone
  // boundary surprises). nowIso is full ISO; slice to YYYY-MM-DD.
  const today = nowIso.slice(0, 10);
  if (targetDate < today) return "behind";
  // Days between today and target
  const todayMs = new Date(today + "T00:00:00Z").getTime();
  const targetMs = new Date(targetDate + "T00:00:00Z").getTime();
  const days = Math.round((targetMs - todayMs) / 86400000);
  if (days <= 2) return "behind";
  if (days < 7) return "tight";
  return "on_track";
}

/**
 * Compute denormalized summary for the API write handler. The server
 * recomputes this on every save so denormalized columns can never drift
 * from the JSONB source of truth.
 */
export function summarizeTimeline(state: TimelineState): TimelineSummary {
  let pending_count = 0;
  let done_count = 0;
  for (const m of state.milestones) {
    if (m.status === "pending") pending_count++;
    else done_count++;
  }
  const next = findNextPendingTargeted(state);
  return {
    next_milestone_label: next?.label ?? null,
    next_milestone_target_date: next?.targetDate ?? null,
    pending_count,
    done_count,
  };
}

/** Filter milestones by status. */
export function milestonesByStatus(
  state: TimelineState,
  status: MilestoneStatus
): TimelineMilestone[] {
  return state.milestones
    .filter((m) => m.status === status)
    .sort((a, b) => a.order - b.order);
}

/**
 * Get all milestones in render order. Sort priority:
 *   1. Pending before done (active work surfaces first)
 *   2. Earliest target date first (nulls treated as "no deadline" → bottom)
 *   3. order index as a stable tiebreaker (manual drag for same-date items)
 *
 * Smoke-feedback 6 May 2026: original sort was order-only, so newly-added
 * milestones appeared at the bottom regardless of target date. Backward-
 * mapping pedagogy depends on seeing the timeline laid out by deadline,
 * so we now sort by date primarily.
 */
export function orderedMilestones(state: TimelineState): TimelineMilestone[] {
  return state.milestones.slice().sort((a, b) => {
    // Done milestones drop to the bottom.
    if (a.status !== b.status) {
      return a.status === "done" ? 1 : -1;
    }
    // Within same status: sort by target date asc, nulls last.
    if (a.targetDate !== b.targetDate) {
      if (a.targetDate === null) return 1;
      if (b.targetDate === null) return -1;
      return a.targetDate < b.targetDate ? -1 : 1;
    }
    // Same status + same target date: stable tiebreaker by order.
    return a.order - b.order;
  });
}
