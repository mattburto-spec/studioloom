// Pure helper — pick the lesson page to open by default given a
// scheduled-date map and the current date. Used by Teaching Mode to
// auto-jump to today's class instead of always opening lesson 1.
//
// Tier 2 lesson scheduling (13 May 2026 — Matt smoke).

export interface PageLike {
  id: string;
}

export interface ScheduleEntry {
  page_id: string;
  scheduled_date: string; // ISO YYYY-MM-DD
}

/**
 * Given the unit's pages (in display order) and the per-class
 * schedule map, return the page_id Teaching Mode should default to.
 *
 * Heuristic:
 *   1. If today exactly matches a scheduled date → that page.
 *   2. Otherwise pick the page with the smallest absolute difference
 *      between its scheduled_date and today.
 *   3. If no schedule entries at all → fall back to the first page
 *      (legacy behaviour).
 *   4. If schedule entries exist but none of their page_ids appear in
 *      `pages` (stale schedule rows pointing at deleted pages) → also
 *      fall back to the first page.
 *
 * Ties on the absolute-difference path are broken by preferring the
 * EARLIER lesson (display order) — feels natural when "today" is
 * exactly between two scheduled classes.
 */
export function pickTodaysLessonId(
  pages: PageLike[],
  schedule: ScheduleEntry[],
  nowIso?: string,
): string | null {
  if (pages.length === 0) return null;
  const fallback = pages[0].id;

  if (schedule.length === 0) return fallback;

  const now = nowIso ? new Date(nowIso) : new Date();
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  // Build a quick lookup of pages so we can ignore stale rows
  // (schedule entries whose page_id no longer exists in the unit).
  const pageIdSet = new Set(pages.map((p) => p.id));
  const pageOrder = new Map(pages.map((p, idx) => [p.id, idx]));

  let bestId: string | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  let bestOrder = Number.POSITIVE_INFINITY;

  for (const entry of schedule) {
    if (!pageIdSet.has(entry.page_id)) continue;
    const parsed = Date.parse(entry.scheduled_date);
    if (!Number.isFinite(parsed)) continue;

    const diff = Math.abs(parsed - today);
    const order = pageOrder.get(entry.page_id) ?? Number.POSITIVE_INFINITY;

    if (diff < bestDiff || (diff === bestDiff && order < bestOrder)) {
      bestDiff = diff;
      bestId = entry.page_id;
      bestOrder = order;
    }
  }

  return bestId ?? fallback;
}
