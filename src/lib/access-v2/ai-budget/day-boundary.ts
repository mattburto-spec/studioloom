/**
 * Day-boundary helper — admin AI Budget breakdown view.
 *
 * Computes the UTC instant at which "today" began in a given IANA timezone.
 * Mirrors the SQL formula used by `atomic_increment_ai_budget()`:
 *
 *   start_of_today := (now() AT TIME ZONE tz)::date AT TIME ZONE tz
 *   reset_at       := ((now() AT TIME ZONE tz)::date + 1) AT TIME ZONE tz
 *
 * The breakdown endpoint filters `ai_usage_log` by `created_at >= start_of_today`
 * so the per-row sums reconcile with `ai_budget_state.tokens_used_today` (which
 * is reset by the SQL function at the same boundary).
 *
 * Default timezone is 'Asia/Shanghai' (matches the SQL fallback). Asia/Shanghai
 * does not observe DST so the boundary is always exactly 24h before the next
 * reset_at. For other timezones during DST transitions the day length can be
 * 23h or 25h — we still produce the correct local-midnight UTC instant.
 */

export const DEFAULT_SCHOOL_TIMEZONE = "Asia/Shanghai";

/**
 * Returns the UTC instant of midnight-today in the given IANA timezone.
 *
 * Throws RangeError on an unknown timezone (Intl.DateTimeFormat behaviour).
 */
export function startOfDayInTz(tz: string, now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(now);

  const partMap: Record<string, string> = {};
  for (const p of parts) partMap[p.type] = p.value;

  const Y = parseInt(partMap.year, 10);
  const M = parseInt(partMap.month, 10);
  const D = parseInt(partMap.day, 10);
  // Intl returns hour as "24" when the local time is exactly midnight in some
  // locales/engines. Normalise to 0.
  const hRaw = parseInt(partMap.hour, 10);
  const h = hRaw === 24 ? 0 : hRaw;
  const m = parseInt(partMap.minute, 10);
  const s = parseInt(partMap.second, 10);

  // Wall-clock-as-UTC for the current local time in tz.
  const wallNowUtcMs = Date.UTC(Y, M - 1, D, h, m, s);
  // Offset = wall - real (positive when tz is ahead of UTC).
  const offsetMs = wallNowUtcMs - now.getTime();
  // Wall-clock-as-UTC for local midnight today in tz.
  const wallMidnightUtcMs = Date.UTC(Y, M - 1, D, 0, 0, 0);
  return new Date(wallMidnightUtcMs - offsetMs);
}
