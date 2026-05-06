/**
 * AG.4.2 — pure helpers for UnitAttentionPanel rendering.
 *
 * Per Lesson #71: pure logic in `.ts` so tests can import without
 * the JSX boundary that Vite's import-analysis can't transform.
 */

/**
 * Format an ISO timestamp as "X days ago" / "Today" / "never". Pure so
 * rendering is deterministic for tests that pass an explicit nowIso.
 */
export function formatRelative(iso: string | null, nowIso: string): string {
  if (iso === null) return "never";
  const ms = Date.parse(nowIso) - Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const hours = ms / (1000 * 60 * 60);
  if (hours < 0) return "in future";
  if (hours < 24) return "today";
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/**
 * Stale = anything > 3 days old. Used for visual amber-warning on the
 * signal cells. Tighter than the priority-cap (7d journal/kanban) on
 * purpose so the teacher sees concerning gaps before they max out.
 */
export function isStale(iso: string, nowIso: string): boolean {
  const ms = Date.parse(nowIso) - Date.parse(iso);
  if (Number.isNaN(ms)) return false;
  const days = ms / (1000 * 60 * 60 * 24);
  return days > 3;
}
