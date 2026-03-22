/**
 * Lightweight iCal (.ics) parser for extracting class schedules and holidays.
 *
 * Supports:
 * - VEVENT entries with SUMMARY, DTSTART, DTEND, RRULE, LOCATION
 * - Holiday detection (all-day events, events with "holiday"/"break"/"no school" in summary)
 * - Class meeting extraction (timed events mapped to cycle days)
 *
 * Does NOT handle:
 * - VTIMEZONE (uses date strings as-is)
 * - Complex RRULE (only FREQ=WEEKLY with BYDAY)
 * - EXDATE on recurring events
 */

export interface ParsedEvent {
  summary: string;
  dtstart: string; // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  dtend?: string;
  location?: string;
  isAllDay: boolean;
  rrule?: string;
}

export interface ICalParseResult {
  events: ParsedEvent[];
  holidays: string[]; // YYYY-MM-DD dates
  classEvents: ParsedEvent[]; // Timed (non-holiday) events
}

// Keywords that indicate a non-school day
const HOLIDAY_KEYWORDS = [
  "holiday", "break", "no school", "no classes", "public holiday",
  "staff day", "pd day", "professional development", "inset day",
  "teacher only", "pupil free", "student free", "vacation",
  "mid-term", "midterm", "half term", "reading week",
];

/**
 * Parse raw iCal text into structured events.
 */
export function parseICal(icalText: string): ICalParseResult {
  const events: ParsedEvent[] = [];
  const lines = unfoldLines(icalText);

  let inEvent = false;
  let current: Partial<ParsedEvent> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      inEvent = false;
      if (current.summary && current.dtstart) {
        events.push({
          summary: current.summary,
          dtstart: current.dtstart,
          dtend: current.dtend,
          location: current.location,
          isAllDay: current.isAllDay || false,
          rrule: current.rrule,
        });
      }
      continue;
    }

    if (!inEvent) continue;

    const [key, ...valueParts] = line.split(":");
    const value = valueParts.join(":"); // Rejoin in case value contains ":"

    if (key.startsWith("SUMMARY")) {
      current.summary = unescapeIcal(value);
    } else if (key.startsWith("DTSTART")) {
      const parsed = parseICalDate(key, value);
      current.dtstart = parsed.date;
      current.isAllDay = parsed.isAllDay;
    } else if (key.startsWith("DTEND")) {
      const parsed = parseICalDate(key, value);
      current.dtend = parsed.date;
    } else if (key.startsWith("LOCATION")) {
      current.location = unescapeIcal(value);
    } else if (key === "RRULE") {
      current.rrule = value;
    }
  }

  // Classify events
  const holidays: string[] = [];
  const classEvents: ParsedEvent[] = [];

  for (const event of events) {
    const summaryLower = event.summary.toLowerCase();
    const matchesHolidayKeyword = HOLIDAY_KEYWORDS.some((kw) => summaryLower.includes(kw));

    // Holiday = must match a keyword. All-day events without keywords are
    // just school events (assemblies, staff meetings, etc.), not holidays.
    // Timed events with holiday keywords are also flagged (e.g. "Holiday - No School" as a timed entry).
    const isHoliday = matchesHolidayKeyword;

    if (isHoliday) {
      holidays.push(event.dtstart);
      // If multi-day holiday, add all dates in range
      if (event.dtend && event.dtend !== event.dtstart) {
        const start = new Date(event.dtstart);
        const end = new Date(event.dtend);
        const d = new Date(start);
        d.setDate(d.getDate() + 1);
        while (d < end) {
          holidays.push(formatDateStr(d));
          d.setDate(d.getDate() + 1);
        }
      }
    } else if (!event.isAllDay) {
      // Only timed events are potential class meetings
      classEvents.push(event);
    }
    // All-day events that aren't holidays are silently skipped (assemblies, etc.)
  }

  return {
    events,
    holidays: [...new Set(holidays)].sort(),
    classEvents,
  };
}

/**
 * Extract class meeting patterns from parsed events.
 * Tries to match event summaries to class names.
 * Returns meetings suitable for the class_meetings table.
 */
export function extractMeetings(
  classEvents: ParsedEvent[],
  classNames: Array<{ id: string; name: string }>
): Array<{ class_id: string; cycle_day: number; period_number?: number; room?: string }> {
  const meetings: Array<{ class_id: string; cycle_day: number; period_number?: number; room?: string }> = [];

  // Group events by day of week (0=Sun, 1=Mon, ..., 6=Sat)
  // For a standard 5-day cycle, Mon=1, Tue=2, etc.
  for (const event of classEvents) {
    const eventDate = new Date(event.dtstart);
    const dayOfWeek = eventDate.getDay(); // 0=Sun, 6=Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    // Try to match event summary to a class name
    const summaryLower = event.summary.toLowerCase();
    const matchedClass = classNames.find((c) => {
      const nameLower = c.name.toLowerCase();
      return summaryLower.includes(nameLower) || nameLower.includes(summaryLower);
    });

    if (matchedClass) {
      // For standard 5-day weeks: Mon=1, Tue=2, ..., Fri=5
      const cycleDay = dayOfWeek; // Mon=1, Tue=2, ..., Fri=5
      const existing = meetings.find(
        (m) => m.class_id === matchedClass.id && m.cycle_day === cycleDay
      );
      if (!existing) {
        meetings.push({
          class_id: matchedClass.id,
          cycle_day: cycleDay,
          room: event.location || undefined,
        });
      }
    }
  }

  return meetings;
}

// ── Helpers ──────────────────────────────────────────────────

/** Unfold long lines per RFC 5545 (lines starting with space/tab are continuations) */
function unfoldLines(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines: string[] = [];
  for (const line of raw.split("\n")) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** Parse iCal date (handles VALUE=DATE for all-day and full datetime) */
function parseICalDate(
  key: string,
  value: string
): { date: string; isAllDay: boolean } {
  const isAllDay = key.includes("VALUE=DATE") && !key.includes("VALUE=DATE-TIME");

  if (isAllDay || value.length === 8) {
    // YYYYMMDD → YYYY-MM-DD
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return { date: `${y}-${m}-${d}`, isAllDay: true };
  }

  // YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const y = value.slice(0, 4);
  const m = value.slice(4, 6);
  const d = value.slice(6, 8);
  const hh = value.slice(9, 11);
  const mm = value.slice(11, 13);
  return { date: `${y}-${m}-${d}T${hh}:${mm}`, isAllDay: false };
}

/** Unescape iCal string values */
function unescapeIcal(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** Format Date as YYYY-MM-DD */
function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
