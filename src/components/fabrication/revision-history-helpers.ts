/**
 * Pure helpers for RevisionHistoryPanel (Phase 5-5).
 *
 * Extracted into a sibling `.ts` file so tests don't need to import the
 * `.tsx` component (project has no JSX-aware test transformer — same
 * convention as picker-helpers.ts + rule-card-helpers.ts).
 */

import type { RevisionSummary } from "@/lib/fabrication/orchestration";

/**
 * Human label for a revision's scan_status. Returns a short string the
 * UI renders next to the revision number. null/unknown scan_status maps
 * to "queued" — upload just happened, worker hasn't claimed yet.
 */
export function revisionStatusLabel(status: string | null): string {
  switch (status) {
    case "done":
      return "Scanned";
    case "running":
      return "Scanning";
    case "pending":
      return "Queued";
    case "error":
      return "Error";
    default:
      return "Queued";
  }
}

/**
 * Tailwind color token for the revision status dot/pill. Matches the
 * severity color family so a "done with blockers" and "done clean"
 * look different via the rule-count strip, not the status itself.
 */
export function revisionStatusColorClass(status: string | null): string {
  switch (status) {
    case "done":
      return "bg-green-500";
    case "running":
      return "bg-blue-500";
    case "error":
      return "bg-red-500";
    case "pending":
    default:
      return "bg-gray-400";
  }
}

/**
 * Compact rule-count summary — "2B · 1W · 3I" — for the history row.
 * Empty parts are skipped. Returns null when all counts are zero so
 * the UI can hide the pill entirely for a clean revision.
 */
export function formatRuleCountsCompact(counts: {
  block: number;
  warn: number;
  fyi: number;
}): string | null {
  const parts: string[] = [];
  if (counts.block > 0) parts.push(`${counts.block}B`);
  if (counts.warn > 0) parts.push(`${counts.warn}W`);
  if (counts.fyi > 0) parts.push(`${counts.fyi}I`);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

/**
 * Relative-time formatter — "just now", "3m ago", "1h ago", "2d ago".
 * Used in the history row subtitle. Returns the raw ISO string if
 * parsing fails (defensive — never let a bad timestamp crash the UI).
 */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diffMs = Math.max(0, now - t);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/**
 * Compact absolute date+time — "23 Apr · 14:32". Used on teacher
 * history tables (Phase 6-6n) where teachers want to know exactly
 * WHEN a submission landed, not just "3h ago" (which loses meaning
 * after a day or two). Omits the year (schools see submissions from
 * the current academic year). Returns the raw ISO on parse failure.
 *
 * Locale-agnostic format — "DD MMM · HH:mm" reads cleanly in most
 * locales without relying on `toLocaleString` producing consistent
 * output across browsers.
 */
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
export function formatDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const d = new Date(t);
  const day = d.getDate();
  const month = MONTHS_SHORT[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} · ${hh}:${mm}`;
}

/**
 * Decide whether the panel expands by default. More than one revision =
 * there's history to show; single-revision jobs hide the panel entirely
 * (no history to summarise).
 */
export function shouldShowHistoryPanel(revisions: RevisionSummary[]): boolean {
  return revisions.length > 1;
}
