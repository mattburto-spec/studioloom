/* Current-period resolver for the Bold teacher dashboard.
 *
 * Joins three data sources into the shape NowHero expects:
 *   - /api/teacher/schedule/today → today's class meetings + periods
 *   - /api/teacher/dashboard      → unit thumbnails + completion %
 *   - wall-clock time             → startsIn, elapsed-vs-upcoming
 *
 * "Current period" is whichever of today's meetings is closest to now:
 *   - If a meeting is in progress (start ≤ now < end) → that one.
 *   - Else the next upcoming meeting today.
 *   - Else the first meeting today (fallback — e.g. end of day).
 *   - If no meetings today → null.
 */

import type { DashboardClass, UnmarkedWorkItem } from "@/types/dashboard";
import { classColor } from "./nav-config";

export interface ScheduleEntry {
  date: string;         // "YYYY-MM-DD"
  cycleDay: number;
  classId: string;
  className: string;
  period: number | null;
  room: string | null;
  unitId: string | null;
  unitTitle: string | null;
}

export interface PeriodDefinition {
  number: number;
  label?: string;
  start: string;  // "09:00"
  end: string;    // "10:15"
}

export interface ScheduleResponse {
  hasTimetable: boolean;
  hasIcal?: boolean;
  source?: string;
  periods?: PeriodDefinition[];
  entries?: ScheduleEntry[];
}

/** The shape NowHero consumes. Mirrors teacher_bold.jsx NEXT but sourced
 *  from real data. */
export interface CurrentPeriod {
  /** "Period 3" or "P3" — falls back to "Today" if unknown. */
  periodLabel: string;
  /** "9:00 AM" — empty string if period times aren't set. */
  startTime: string;
  /** Minutes until start (positive), or 0 if already live. Null if unknown. */
  startsInMin: number | null;
  /** "live" while we're inside start..end, else "upcoming". */
  state: "live" | "upcoming" | "later";
  room: string | null;
  className: string;
  classColor: string;
  classColorDark: string;
  classColorTint: string;
  unitId: string | null;
  unitTitle: string;
  /** Fallback image when the unit has no thumbnail. */
  unitThumbnailUrl: string;
  /** 0-100. Null if no progress data available. */
  completionPct: number | null;
  /** Number of students in this class. 0 if not resolved. */
  studentCount: number;
  /** Number of completed pages by students in this class+unit that are
   *  awaiting teacher review. Sum of UnmarkedWorkItem.completedPages
   *  filtered to the hero's classId + unitId. */
  ungradedCount: number;
}

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900&h=1100&fit=crop";

/** Darken a hex color by scaling RGB channels by `factor` (0-1). */
function darken(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 0xff) * factor);
  const g = Math.round(((n >> 8) & 0xff) * factor);
  const b = Math.round((n & 0xff) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Lighten towards white by `factor` (0-1, 1 = white). */
function tint(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * factor);
  const r = mix((n >> 16) & 0xff);
  const g = mix((n >> 8) & 0xff);
  const b = mix(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Parse "HH:MM" into minutes since midnight. Returns -1 on parse failure. */
function hhmmToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** "09:00" → "9:00 AM". */
function formatTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return "";
  let h = Number(m[1]);
  const mm = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mm} ${ampm}`;
}

/** Pick the most-relevant meeting among today's entries given a clock.
 *  Returns its index or -1 if none. */
export function pickRelevantEntry(
  entries: ScheduleEntry[],
  periods: PeriodDefinition[],
  nowMinutes: number,
  todayISO: string,
): number {
  const todayEntries = entries
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.date === todayISO);
  if (todayEntries.length === 0) return -1;

  const periodByNumber = new Map(periods.map((p) => [p.number, p]));

  // In-progress: start ≤ now < end
  for (const { e, i } of todayEntries) {
    if (e.period == null) continue;
    const p = periodByNumber.get(e.period);
    if (!p) continue;
    const start = hhmmToMinutes(p.start);
    const end = hhmmToMinutes(p.end);
    if (start < 0 || end < 0) continue;
    if (nowMinutes >= start && nowMinutes < end) return i;
  }

  // Next upcoming: earliest start > now
  let bestUpcoming = -1;
  let bestUpcomingStart = Infinity;
  for (const { e, i } of todayEntries) {
    if (e.period == null) continue;
    const p = periodByNumber.get(e.period);
    if (!p) continue;
    const start = hhmmToMinutes(p.start);
    if (start < 0) continue;
    if (start > nowMinutes && start < bestUpcomingStart) {
      bestUpcoming = i;
      bestUpcomingStart = start;
    }
  }
  if (bestUpcoming >= 0) return bestUpcoming;

  // End-of-day fallback: first entry today so the hero still has something to show.
  return todayEntries[0].i;
}

/** Build a CurrentPeriod from the two API responses + a wall clock.
 *  Returns null if the teacher has no timetable or no meetings today. */
export function resolveCurrentPeriod(
  schedule: ScheduleResponse,
  classes: DashboardClass[],
  unmarkedWork: UnmarkedWorkItem[],
  now: Date,
): CurrentPeriod | null {
  if (!schedule.hasTimetable) return null;
  const entries = schedule.entries ?? [];
  const periods = schedule.periods ?? [];
  if (entries.length === 0) return null;

  // Use the CLIENT's local wall-clock date — the schedule endpoint
  // already resolves the teacher's local "today" when we pass tz.
  const todayISO = now.toLocaleDateString("en-CA"); // "YYYY-MM-DD"
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const pick = pickRelevantEntry(entries, periods, nowMinutes, todayISO);
  if (pick < 0) return null;

  const entry = entries[pick];
  const period =
    entry.period != null
      ? periods.find((p) => p.number === entry.period)
      : undefined;

  const startMin = period ? hhmmToMinutes(period.start) : -1;
  const endMin = period ? hhmmToMinutes(period.end) : -1;
  const isLive =
    startMin >= 0 && endMin >= 0 && nowMinutes >= startMin && nowMinutes < endMin;
  const state: CurrentPeriod["state"] = isLive
    ? "live"
    : startMin > nowMinutes
      ? "upcoming"
      : "later";
  const startsInMin =
    startMin < 0
      ? null
      : isLive
        ? 0
        : Math.max(0, startMin - nowMinutes);

  // Look up unit thumbnail + completionPct + student count from the
  // dashboard data.
  let unitThumbnailUrl = FALLBACK_IMG;
  let completionPct: number | null = null;
  let studentCount = 0;
  for (const cls of classes) {
    if (cls.id !== entry.classId) continue;
    studentCount = cls.studentCount;
    if (entry.unitId) {
      const unit = cls.units.find((u) => u.unitId === entry.unitId);
      if (unit) {
        if (unit.thumbnailUrl) unitThumbnailUrl = unit.thumbnailUrl;
        completionPct = unit.completionPct;
      }
    }
    break;
  }

  // Ungraded = sum of completedPages across unmarkedWork rows matching
  // this class + unit. The dashboard endpoint already caps unmarkedWork
  // at 20 rows by most-recent-completion — enough for the hero chip to
  // reflect "today's pile" without a dedicated query.
  let ungradedCount = 0;
  if (entry.unitId) {
    for (const w of unmarkedWork) {
      if (w.classId === entry.classId && w.unitId === entry.unitId) {
        ungradedCount += w.completedPages;
      }
    }
  }

  const color = classColor(entry.classId).color;
  return {
    periodLabel:
      entry.period != null ? `Period ${entry.period}` : "Today",
    startTime: period ? formatTime(period.start) : "",
    startsInMin,
    state,
    room: entry.room,
    className: entry.className,
    classColor: color,
    classColorDark: darken(color, 0.7),
    classColorTint: tint(color, 0.85),
    unitId: entry.unitId,
    unitTitle: entry.unitTitle ?? "—",
    unitThumbnailUrl,
    completionPct,
    studentCount,
    ungradedCount,
  };
}
