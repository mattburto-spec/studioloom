/**
 * AG.3.3 — server-side validators for Timeline API writes.
 *
 * Mirrors the AG.2 Kanban validators pattern: defense-in-depth wire
 * validation + denormalized summary recomputation. The reducer enforces
 * rules at runtime; these validators check the WIRE shape from
 * potentially-malicious or buggy clients.
 *
 * Per Lesson #71: pure .ts. Per Lesson #38: returns specific error
 * messages. Per Lesson #67: every consumer of the discriminated union
 * (status enum) covered.
 */

import type { TimelineMilestone, TimelineState, TimelineSummary } from "./types";
import { MILESTONE_STATUSES } from "./types";

const MAX_MILESTONES_PER_TIMELINE = 50;
const MAX_LABEL_LEN = 200;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const STATUS_VALUES = new Set<string>(MILESTONE_STATUSES);

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function isOptIsoDate(x: unknown): x is string | null {
  if (x === null || x === undefined) return true;
  return typeof x === "string" && ISO_DATE_RE.test(x);
}

function isOptIsoTimestamp(x: unknown): x is string | null {
  if (x === null || x === undefined) return true;
  return typeof x === "string" && ISO_TS_RE.test(x);
}

// ─── Per-milestone validation ───────────────────────────────────────────────

export function validateMilestone(
  milestone: unknown,
  idx: number
): ValidationResult<TimelineMilestone> {
  const errors: string[] = [];
  if (!milestone || typeof milestone !== "object" || Array.isArray(milestone)) {
    return { ok: false, errors: [`milestones[${idx}]: must be an object`] };
  }
  const m = milestone as Record<string, unknown>;

  if (!isNonEmptyString(m.id)) {
    errors.push(`milestones[${idx}].id: required string`);
  }

  if (!isNonEmptyString(m.label)) {
    errors.push(`milestones[${idx}].label: required non-empty string`);
  } else if ((m.label as string).length > MAX_LABEL_LEN) {
    errors.push(`milestones[${idx}].label: max ${MAX_LABEL_LEN} chars`);
  }

  if (!isOptIsoDate(m.targetDate)) {
    errors.push(
      `milestones[${idx}].targetDate: ISO YYYY-MM-DD or null`
    );
  }

  if (typeof m.status !== "string" || !STATUS_VALUES.has(m.status)) {
    errors.push(
      `milestones[${idx}].status: must be one of ${[...STATUS_VALUES].join(", ")}`
    );
  }

  if (!isOptIsoTimestamp(m.doneAt)) {
    errors.push(`milestones[${idx}].doneAt: ISO timestamp or null`);
  }

  if (
    typeof m.order !== "number" ||
    !Number.isInteger(m.order) ||
    m.order < 0
  ) {
    errors.push(`milestones[${idx}].order: non-negative integer`);
  }

  if (typeof m.isAnchor !== "boolean") {
    errors.push(`milestones[${idx}].isAnchor: required boolean`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: m as unknown as TimelineMilestone };
}

// ─── Full state validation ─────────────────────────────────────────────────

export function validateTimelineState(
  input: unknown
): ValidationResult<TimelineState> {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["state: must be an object"] };
  }
  const s = input as Record<string, unknown>;

  if (!Array.isArray(s.milestones)) {
    return { ok: false, errors: ["state.milestones: must be an array"] };
  }
  if (s.milestones.length > MAX_MILESTONES_PER_TIMELINE) {
    errors.push(
      `state.milestones: max ${MAX_MILESTONES_PER_TIMELINE} milestones (got ${s.milestones.length})`
    );
  }

  const validatedMilestones: TimelineMilestone[] = [];
  const seenIds = new Set<string>();
  const seenOrders = new Set<number>();
  for (let i = 0; i < s.milestones.length; i++) {
    const r = validateMilestone(s.milestones[i], i);
    if (!r.ok) {
      errors.push(...r.errors);
      continue;
    }
    if (seenIds.has(r.value.id)) {
      errors.push(`milestones[${i}].id: duplicate ${r.value.id}`);
    }
    seenIds.add(r.value.id);
    if (seenOrders.has(r.value.order)) {
      errors.push(`milestones[${i}].order: duplicate order ${r.value.order}`);
    }
    seenOrders.add(r.value.order);
    validatedMilestones.push(r.value);
  }

  if (!isOptIsoDate(s.raceDate)) {
    errors.push("state.raceDate: ISO YYYY-MM-DD or null");
  }
  if (!isOptIsoTimestamp(s.lastUpdatedAt)) {
    errors.push("state.lastUpdatedAt: ISO timestamp or null");
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      milestones: validatedMilestones,
      raceDate: (s.raceDate as string | null) ?? null,
      lastUpdatedAt: (s.lastUpdatedAt as string | null) ?? null,
    },
  };
}

// ─── Server-side denormalized summary recomputation ─────────────────────────

/**
 * Recompute denormalized summary from milestones array. Server runs
 * this on every POST so the row-level columns can never drift from
 * the JSONB source of truth. Mirrors `summarizeTimeline` from the
 * reducer but without React/component dependencies.
 */
export function recomputeSummary(state: TimelineState): TimelineSummary {
  let pending_count = 0;
  let done_count = 0;
  for (const m of state.milestones) {
    if (m.status === "pending") pending_count++;
    else done_count++;
  }
  // Earliest pending milestone with a non-null target date
  let nextLabel: string | null = null;
  let nextDate: string | null = null;
  let nextOrder = Number.POSITIVE_INFINITY;
  for (const m of state.milestones) {
    if (m.status !== "pending" || m.targetDate === null) continue;
    if (
      nextDate === null ||
      m.targetDate < nextDate ||
      (m.targetDate === nextDate && m.order < nextOrder)
    ) {
      nextLabel = m.label;
      nextDate = m.targetDate;
      nextOrder = m.order;
    }
  }
  return {
    next_milestone_label: nextLabel,
    next_milestone_target_date: nextDate,
    pending_count,
    done_count,
  };
}
