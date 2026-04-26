/**
 * Pure helpers for the Phase 6-3 teacher queue page.
 *
 * Extracted into a sibling `.ts` so tests don't need the `.tsx`
 * transform (same convention as `rule-card-helpers.ts` +
 * `revision-history-helpers.ts`).
 *
 * The queue page has 5 status tabs that each map to one or more
 * `fabrication_jobs.status` values. Tab buckets match the semantic
 * grouping spelled out in the Phase 6-1 orchestration file:
 *
 *   pending    → ["pending_approval"]
 *   approved   → ["approved", "picked_up"]
 *   revision   → ["needs_revision"]
 *   completed  → ["completed", "rejected"]
 *   all        → no filter (every row)
 *
 * `uploaded`, `scanning`, `cancelled` rows only appear under "All" — a
 * teacher doesn't act on an uploaded-but-not-yet-scanned file, and a
 * student-cancelled job is archival context rather than queue work.
 */

import type { QueueRow } from "@/lib/fabrication/teacher-orchestration";

/** Tab keys used in URL params and component state. */
export const QUEUE_TABS = [
  "pending",
  "approved",
  "revision",
  "completed",
  "all",
] as const;
export type QueueTab = (typeof QUEUE_TABS)[number];

/**
 * Map a tab key to the set of `fabrication_jobs.status` values that
 * belong in that bucket. Returns `null` for "all" — the queue endpoint
 * treats an absent `status` param as "no filter", not as "status=''".
 */
export function statusesForTab(tab: QueueTab): string[] | null {
  switch (tab) {
    case "pending":
      return ["pending_approval"];
    case "approved":
      return ["approved", "picked_up"];
    case "revision":
      return ["needs_revision"];
    case "completed":
      return ["completed", "rejected"];
    case "all":
      return null;
  }
}

/**
 * Inverse of `statusesForTab` — given a row's `jobStatus`, which tab
 * does it belong to? Returns "all" as the only catch-all tab for
 * statuses that don't have a dedicated bucket (uploaded / scanning /
 * cancelled). This powers client-side bucketing when we do a single
 * "fetch all" request and count rows per tab.
 */
export function tabForStatus(jobStatus: string): QueueTab {
  switch (jobStatus) {
    case "pending_approval":
      return "pending";
    case "approved":
    case "picked_up":
      return "approved";
    case "needs_revision":
      return "revision";
    case "completed":
    case "rejected":
      return "completed";
    default:
      return "all";
  }
}

/** Human-facing label for the tab bar. */
export function tabLabel(tab: QueueTab): string {
  switch (tab) {
    case "pending":
      return "Pending approval";
    case "approved":
      return "Approved / queued";
    case "revision":
      return "Revisions in progress";
    case "completed":
      return "Completed";
    case "all":
      return "All";
  }
}

/** Empty-state copy shown when the active tab has zero rows. */
export function emptyMessageForTab(tab: QueueTab): string {
  switch (tab) {
    case "pending":
      return "No submissions are waiting for your approval.";
    case "approved":
      return "Nothing has been approved yet.";
    case "revision":
      return "No submissions are currently out for revision.";
    case "completed":
      return "Nothing completed yet.";
    case "all":
      return "No submissions yet — students haven't uploaded anything to fabricate.";
  }
}

/**
 * Filter a flat `QueueRow[]` down to one tab's rows. Used when we do a
 * single "all" fetch and slice client-side rather than re-fetch per
 * tab switch. "all" returns the list unchanged.
 */
export function bucketRowsForTab(rows: QueueRow[], tab: QueueTab): QueueRow[] {
  if (tab === "all") return rows;
  return rows.filter((r) => tabForStatus(r.jobStatus) === tab);
}

/**
 * Count rows per tab for the tab-bar badges. Iterates the full list
 * once — O(n) — and handles "all" as "rows.length" (every row shows
 * up under All even if its status maps to a specific tab too).
 */
export function countRowsPerTab(rows: QueueRow[]): Record<QueueTab, number> {
  const counts: Record<QueueTab, number> = {
    pending: 0,
    approved: 0,
    revision: 0,
    completed: 0,
    all: rows.length,
  };
  for (const r of rows) {
    const t = tabForStatus(r.jobStatus);
    // `tabForStatus` already returns "all" for uploaded/scanning/
    // cancelled, which we don't increment anywhere except the "all"
    // counter — that's already rows.length above.
    if (t !== "all") counts[t] += 1;
  }
  return counts;
}

/**
 * Revision count is flagged in the UI at 3+ attempts — Phase 6 brief
 * §2 "flag at 3+". Keeps the threshold in one place so QA can tune.
 */
export function shouldFlagRevisionCount(currentRevision: number): boolean {
  return currentRevision >= 3;
}

/**
 * Parse the ?tab= URL param defensively. Invalid values fall back to
 * the spec-default "pending" (first tab).
 */
export function parseTabParam(raw: string | null): QueueTab {
  if (!raw) return "pending";
  return (QUEUE_TABS as readonly string[]).includes(raw)
    ? (raw as QueueTab)
    : "pending";
}

/**
 * Phase 8.1d-16: a "clean" pending row has zero scanner findings —
 * no BLOCK rules, no WARN rules. Used to power the "Approve all
 * clean" smart-button on the pending tab. FYI rules don't disqualify
 * (they're advisory, never gate-blocking).
 */
export function isCleanRow(row: QueueRow): boolean {
  return row.ruleCounts.block === 0 && row.ruleCounts.warn === 0;
}

/**
 * Phase 8.1d-16: text-search match across the row's user-visible
 * fields. Case-insensitive substring match — cheap, predictable.
 * Empty query returns true (no filter).
 */
export function matchesSearch(row: QueueRow, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (q.length === 0) return true;
  const haystacks = [
    row.studentName,
    row.originalFilename,
    row.unitTitle ?? "",
    row.className ?? "",
    row.machineLabel,
  ];
  return haystacks.some((h) => h.toLowerCase().includes(q));
}

/**
 * Phase 8.1d-16: stable sort key for the queue. Pending tab sorts by
 * createdAt (how long has it been waiting); other tabs sort by
 * updatedAt (most recent activity). Centralised so the page + future
 * test fixtures agree on order.
 */
export function sortKeyForRow(row: QueueRow, tab: QueueTab): string {
  if (tab === "pending") return row.createdAt;
  return row.updatedAt || row.createdAt;
}
