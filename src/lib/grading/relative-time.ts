/**
 * Compact human-readable relative time for inbox queue rows.
 *
 * Output examples:
 *   - "now"     (< 1 minute)
 *   - "5m"      (< 1 hour)
 *   - "3h"      (< 24 hours)
 *   - "yest."   (24–48h)
 *   - "3d"      (2–6 days)
 *   - "8 May"   (≥ 7d, current year)
 *   - "May '25" (≥ 7d, prior year)
 *
 * Kept terse so it fits in the 320px queue column without truncating
 * the student-name + class-name row.
 *
 * `now` is injected for deterministic tests; defaults to `Date.now()`.
 *
 * Added 12 May 2026 (TFL.3 C.3.1) for the inbox feedback that "there
 * are no indicators of time when things were done".
 */
export function formatInboxRelativeTime(
  isoTimestamp: string,
  now: Date = new Date(),
): string {
  const then = new Date(isoTimestamp);
  if (Number.isNaN(then.getTime())) return "";

  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return "now";
  if (hours < 1) return `${minutes}m`;
  if (days < 1) return `${hours}h`;
  if (days < 2) return "yest.";
  if (days < 7) return `${days}d`;

  const monthShort = then.toLocaleString("en-US", { month: "short" });
  if (then.getFullYear() === now.getFullYear()) {
    return `${then.getDate()} ${monthShort}`;
  }
  // Prior year — squeeze the year into 2 digits to keep the row short.
  const yy = String(then.getFullYear()).slice(-2);
  return `${monthShort} '${yy}`;
}
