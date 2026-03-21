/**
 * Cycle Day Calculation Engine
 *
 * Handles rotating cycle timetables (5-day, 6-day, 8-day, 10-day, etc.)
 * commonly used in international schools. Given a cycle configuration
 * and an anchor point, calculates which cycle day any calendar date falls on.
 *
 * PIPL-safe: operates on schedule data only, never touches student PII.
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SchoolTimetable {
  id: string;
  teacher_id: string;
  cycle_length: number;        // e.g. 8
  cycle_type: "weekday" | "calendar";
  anchor_date: string;         // ISO date "2026-03-22"
  anchor_cycle_day: number;    // 1-based
  reset_each_term: boolean;
  periods: PeriodDefinition[];
  excluded_dates: string[];    // ISO date strings
  source: "manual" | "ical";
  ical_url?: string;
  last_synced_at?: string;
}

export interface PeriodDefinition {
  number: number;
  label: string;
  start: string;  // "08:30"
  end: string;    // "09:30"
}

export interface ClassMeeting {
  id: string;
  timetable_id: string;
  class_id: string;
  cycle_day: number;
  period_number?: number;
  room?: string;
}

export interface LessonDate {
  date: Date;
  dateISO: string;          // "2026-03-25"
  cycleDay: number;
  periodNumber?: number;
  room?: string;
  lessonSequence: number;   // 1-based within the range
  dayOfWeek: string;        // "Monday", "Tuesday", etc.
}

export interface TermDates {
  start: string;  // ISO date
  end: string;    // ISO date
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

/** Parse an ISO date string "YYYY-MM-DD" into a Date at midnight UTC */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format a Date as "YYYY-MM-DD" */
export function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Get day of week name from a Date */
function getDayName(date: Date): string {
  return DAY_NAMES[date.getUTCDay()];
}

/** Check if a date is a weekend (Saturday=6 or Sunday=0) */
function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Add N calendar days to a date */
function addDays(date: Date, n: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}

/** Build a Set of excluded date strings for O(1) lookup */
function buildExcludedSet(excluded: string[]): Set<string> {
  return new Set(excluded);
}

/**
 * Check if a given date is a school day (not weekend for weekday cycles,
 * not in excluded dates)
 */
export function isSchoolDay(
  date: Date,
  cycleType: "weekday" | "calendar",
  excludedSet: Set<string>
): boolean {
  if (cycleType === "weekday" && isWeekend(date)) return false;
  if (excludedSet.has(formatDate(date))) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────
// Core: Count school days between two dates
// ─────────────────────────────────────────────────────────────

/**
 * Count the number of school days between two dates (exclusive of start,
 * inclusive of end — i.e. the "distance" in school days).
 *
 * If end < start, returns a negative count (going backward).
 * The anchor date itself is school day 0.
 */
export function countSchoolDaysBetween(
  startDate: Date,
  endDate: Date,
  cycleType: "weekday" | "calendar",
  excludedSet: Set<string>
): number {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  if (startMs === endMs) return 0;

  const forward = endMs > startMs;
  const step = forward ? 1 : -1;
  let count = 0;
  let current = addDays(startDate, step);

  // Safety limit: 5 years = ~1825 days
  const maxIterations = 2000;
  let iterations = 0;

  while (iterations < maxIterations) {
    const currentMs = current.getTime();

    // Check if we've passed or reached the target
    if (forward && currentMs > endMs) break;
    if (!forward && currentMs < endMs) break;

    if (isSchoolDay(current, cycleType, excludedSet)) {
      count += step;
    }

    if (currentMs === endMs) break;

    current = addDays(current, step);
    iterations++;
  }

  return count;
}

// ─────────────────────────────────────────────────────────────
// Core: Get cycle day for a date
// ─────────────────────────────────────────────────────────────

/**
 * Given a calendar date, return which cycle day it is (1-based),
 * or null if the date is not a school day.
 *
 * Optionally accepts term dates for reset_each_term mode.
 */
export function getCycleDay(
  date: Date,
  timetable: SchoolTimetable,
  termDates?: TermDates
): number | null {
  const excludedSet = buildExcludedSet(timetable.excluded_dates);

  // Not a school day → null
  if (!isSchoolDay(date, timetable.cycle_type, excludedSet)) {
    return null;
  }

  // Determine effective anchor
  let anchorDate = parseDate(timetable.anchor_date);
  let anchorCycleDay = timetable.anchor_cycle_day;

  // If reset_each_term and we have term dates, use term start as anchor with Day 1
  if (timetable.reset_each_term && termDates) {
    const termStart = parseDate(termDates.start);
    const termEnd = parseDate(termDates.end);
    const dateMs = date.getTime();

    // Only apply term anchor if the date falls within this term
    if (dateMs >= termStart.getTime() && dateMs <= termEnd.getTime()) {
      // Find the first school day on or after term start
      let firstSchoolDay = termStart;
      let safety = 0;
      while (!isSchoolDay(firstSchoolDay, timetable.cycle_type, excludedSet) && safety < 30) {
        firstSchoolDay = addDays(firstSchoolDay, 1);
        safety++;
      }
      anchorDate = firstSchoolDay;
      anchorCycleDay = 1;
    }
  }

  // Count school days from anchor to target
  const schoolDays = countSchoolDaysBetween(
    anchorDate,
    date,
    timetable.cycle_type,
    excludedSet
  );

  // Modular arithmetic: map school day offset to cycle day
  // anchor is at anchorCycleDay (1-based), offset 0
  const offset = schoolDays;
  // Use modulo that handles negative numbers correctly
  const mod = ((anchorCycleDay - 1 + offset) % timetable.cycle_length + timetable.cycle_length) % timetable.cycle_length;
  return mod + 1;
}

// ─────────────────────────────────────────────────────────────
// Core: Get next N lesson dates for a class
// ─────────────────────────────────────────────────────────────

/**
 * Given a class and a start date, return the next N lesson dates.
 * A "lesson" is a date where:
 *  1. It's a school day
 *  2. The cycle day matches one of the class's meeting days
 */
export function getNextLessons(
  classId: string,
  fromDate: Date,
  count: number,
  timetable: SchoolTimetable,
  meetings: ClassMeeting[],
  termDates?: TermDates
): LessonDate[] {
  const classMeetings = meetings.filter((m) => m.class_id === classId);
  if (classMeetings.length === 0) return [];

  // Build a map of cycle_day → meeting info
  const meetingMap = new Map<number, ClassMeeting>();
  for (const m of classMeetings) {
    meetingMap.set(m.cycle_day, m);
  }

  const excludedSet = buildExcludedSet(timetable.excluded_dates);
  const results: LessonDate[] = [];
  let current = fromDate;
  let sequence = 1;

  // Safety limit
  const maxIterations = 500;
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    if (isSchoolDay(current, timetable.cycle_type, excludedSet)) {
      const cycleDay = getCycleDay(current, timetable, termDates);
      if (cycleDay !== null && meetingMap.has(cycleDay)) {
        const meeting = meetingMap.get(cycleDay)!;
        results.push({
          date: new Date(current.getTime()),
          dateISO: formatDate(current),
          cycleDay,
          periodNumber: meeting.period_number ?? undefined,
          room: meeting.room ?? undefined,
          lessonSequence: sequence,
          dayOfWeek: getDayName(current),
        });
        sequence++;
      }
    }

    current = addDays(current, 1);
    iterations++;
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// Core: Count lessons in a date range
// ─────────────────────────────────────────────────────────────

/**
 * Count how many times a class meets between startDate and endDate (inclusive).
 */
export function countLessonsInRange(
  classId: string,
  startDate: Date,
  endDate: Date,
  timetable: SchoolTimetable,
  meetings: ClassMeeting[],
  termDates?: TermDates
): number {
  const classMeetings = meetings.filter((m) => m.class_id === classId);
  if (classMeetings.length === 0) return 0;

  const meetingDays = new Set(classMeetings.map((m) => m.cycle_day));
  const excludedSet = buildExcludedSet(timetable.excluded_dates);
  let count = 0;
  let current = new Date(startDate.getTime());
  const endMs = endDate.getTime();

  // Safety limit
  const maxIterations = 500;
  let iterations = 0;

  while (current.getTime() <= endMs && iterations < maxIterations) {
    if (isSchoolDay(current, timetable.cycle_type, excludedSet)) {
      const cycleDay = getCycleDay(current, timetable, termDates);
      if (cycleDay !== null && meetingDays.has(cycleDay)) {
        count++;
      }
    }
    current = addDays(current, 1);
    iterations++;
  }

  return count;
}

// ─────────────────────────────────────────────────────────────
// Core: Full lesson calendar for a term
// ─────────────────────────────────────────────────────────────

/**
 * Return all lesson dates for a class within a term, with sequence numbers.
 */
export function getLessonCalendar(
  classId: string,
  termStart: Date,
  termEnd: Date,
  timetable: SchoolTimetable,
  meetings: ClassMeeting[],
  termDates?: TermDates
): LessonDate[] {
  const classMeetings = meetings.filter((m) => m.class_id === classId);
  if (classMeetings.length === 0) return [];

  const meetingMap = new Map<number, ClassMeeting>();
  for (const m of classMeetings) {
    meetingMap.set(m.cycle_day, m);
  }

  const excludedSet = buildExcludedSet(timetable.excluded_dates);
  const results: LessonDate[] = [];
  let current = new Date(termStart.getTime());
  const endMs = termEnd.getTime();
  let sequence = 1;

  const maxIterations = 500;
  let iterations = 0;

  while (current.getTime() <= endMs && iterations < maxIterations) {
    if (isSchoolDay(current, timetable.cycle_type, excludedSet)) {
      const cycleDay = getCycleDay(current, timetable, termDates);
      if (cycleDay !== null && meetingMap.has(cycleDay)) {
        const meeting = meetingMap.get(cycleDay)!;
        results.push({
          date: new Date(current.getTime()),
          dateISO: formatDate(current),
          cycleDay,
          periodNumber: meeting.period_number ?? undefined,
          room: meeting.room ?? undefined,
          lessonSequence: sequence,
          dayOfWeek: getDayName(current),
        });
        sequence++;
      }
    }
    current = addDays(current, 1);
    iterations++;
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// Utility: Format cycle day for display
// ─────────────────────────────────────────────────────────────

/**
 * Format a lesson date for student/teacher display.
 * e.g. "Tuesday March 25 (Day 2, Period 4)"
 */
export function formatLessonDate(lesson: LessonDate): string {
  const month = lesson.date.toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  const day = lesson.date.getUTCDate();
  let result = `${lesson.dayOfWeek} ${month} ${day} (Day ${lesson.cycleDay}`;
  if (lesson.periodNumber) {
    result += `, Period ${lesson.periodNumber}`;
  }
  result += ")";
  return result;
}

/**
 * Get a short label like "Day 2, P4 — Tue"
 */
export function formatLessonShort(lesson: LessonDate): string {
  const dayShort = lesson.dayOfWeek.slice(0, 3);
  let result = `Day ${lesson.cycleDay}`;
  if (lesson.periodNumber) {
    result += `, P${lesson.periodNumber}`;
  }
  result += ` — ${dayShort}`;
  return result;
}
