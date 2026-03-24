/**
 * Comprehensive Timetable Scenario Tests
 *
 * Tests the cycle engine against real-world school scheduling patterns:
 * - Standard 5-day week
 * - 6-day rotating cycle
 * - 8-day rotating cycle (Matt's school / common IB)
 * - 10-day rotating cycle (Asia-Pacific intl schools)
 * - A/B block scheduling (2-day cycle)
 * - Term resets
 * - Holiday handling (multi-day, floating, year-boundary)
 * - Variable period lengths on different weekdays
 * - Edge cases (cycle length 1, anchor on excluded date, etc.)
 */

import { describe, it, expect } from "vitest";
import {
  getCycleDay,
  getNextLessons,
  countLessonsInRange,
  getLessonCalendar,
  countSchoolDaysBetween,
  isSchoolDay,
  parseDate,
  formatDate,
  formatLessonDate,
  formatLessonShort,
} from "../cycle-engine";
import type { SchoolTimetable, ClassMeeting, TermDates } from "../cycle-engine";

// ─── Helper: build a minimal timetable ───────────────────────
function makeTimetable(overrides: Partial<SchoolTimetable> = {}): SchoolTimetable {
  return {
    id: "tt-test",
    teacher_id: "teacher-1",
    cycle_length: 5,
    cycle_type: "weekday",
    anchor_date: "2026-03-23", // Monday
    anchor_cycle_day: 1,
    reset_each_term: false,
    periods: [],
    excluded_dates: [],
    source: "manual",
    ...overrides,
  };
}

function makeMeeting(classId: string, cycleDay: number, period?: number, room?: string): ClassMeeting {
  return {
    id: `mtg-${classId}-d${cycleDay}`,
    timetable_id: "tt-test",
    class_id: classId,
    cycle_day: cycleDay,
    period_number: period,
    room: room,
  };
}

// ═══════════════════════════════════════════════════════════════
// SCENARIO 1: Standard 5-Day Week (most common globally)
// ═══════════════════════════════════════════════════════════════
describe("Scenario 1: Standard 5-day week", () => {
  const tt = makeTimetable({
    cycle_length: 5,
    anchor_date: "2026-03-23", // Monday = Day 1
    anchor_cycle_day: 1,
  });

  it("maps Monday-Friday to Days 1-5", () => {
    expect(getCycleDay(parseDate("2026-03-23"), tt)).toBe(1); // Mon
    expect(getCycleDay(parseDate("2026-03-24"), tt)).toBe(2); // Tue
    expect(getCycleDay(parseDate("2026-03-25"), tt)).toBe(3); // Wed
    expect(getCycleDay(parseDate("2026-03-26"), tt)).toBe(4); // Thu
    expect(getCycleDay(parseDate("2026-03-27"), tt)).toBe(5); // Fri
  });

  it("returns null for weekends", () => {
    expect(getCycleDay(parseDate("2026-03-28"), tt)).toBeNull(); // Sat
    expect(getCycleDay(parseDate("2026-03-29"), tt)).toBeNull(); // Sun
  });

  it("next week restarts at Day 1", () => {
    expect(getCycleDay(parseDate("2026-03-30"), tt)).toBe(1); // Next Mon
    expect(getCycleDay(parseDate("2026-04-03"), tt)).toBe(5); // Next Fri
  });

  it("works backward from anchor", () => {
    // 2026-03-20 = Friday before anchor (5 school days back from Mon = prev Fri)
    expect(getCycleDay(parseDate("2026-03-20"), tt)).toBe(5);
    expect(getCycleDay(parseDate("2026-03-19"), tt)).toBe(4);
    expect(getCycleDay(parseDate("2026-03-16"), tt)).toBe(1);
  });

  it("counts school days correctly over a week", () => {
    const mon = parseDate("2026-03-23");
    const fri = parseDate("2026-03-27");
    // Mon to Fri = 4 school days (exclusive start, inclusive end)
    expect(countSchoolDaysBetween(mon, fri, "weekday", new Set())).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 2: 6-Day Rotating Cycle
// Some US progressive schools, select UK international schools
// ═══════════════════════════════════════════════════════════════
describe("Scenario 2: 6-day rotating cycle", () => {
  const tt = makeTimetable({
    cycle_length: 6,
    anchor_date: "2026-03-23", // Monday = Day 1
    anchor_cycle_day: 1,
  });

  it("Day 6 falls on the following Monday (wraps over weekend)", () => {
    // Mon=D1, Tue=D2, Wed=D3, Thu=D4, Fri=D5, (skip Sat/Sun), Mon=D6
    expect(getCycleDay(parseDate("2026-03-23"), tt)).toBe(1);
    expect(getCycleDay(parseDate("2026-03-27"), tt)).toBe(5);
    expect(getCycleDay(parseDate("2026-03-30"), tt)).toBe(6); // Mon, wraps
  });

  it("second cycle starts on Tuesday of week 2", () => {
    // D6=Mon Mar 30, then D1=Tue Mar 31
    expect(getCycleDay(parseDate("2026-03-31"), tt)).toBe(1); // Tue = new D1
    expect(getCycleDay(parseDate("2026-04-01"), tt)).toBe(2); // Wed
  });

  it("class meeting on Day 3 and Day 6 gets correct lesson count", () => {
    const meetings = [
      makeMeeting("design", 3, 2, "Room A"),
      makeMeeting("design", 6, 4, "Room B"),
    ];

    // 2 weeks: Mar 23 (Mon) to Apr 3 (Fri)
    // Cycle 1: D1=Mon23, D2=Tue24, D3=Wed25✓, D4=Thu26, D5=Fri27, D6=Mon30✓
    // Cycle 2: D1=Tue31, D2=Wed1, D3=Thu2✓, D4=Fri3
    const count = countLessonsInRange(
      "design",
      parseDate("2026-03-23"),
      parseDate("2026-04-03"),
      tt,
      meetings
    );
    expect(count).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 3: 8-Day Rotating Cycle (Matt's school, common IB)
// American School in London, many intl schools
// ═══════════════════════════════════════════════════════════════
describe("Scenario 3: 8-day rotating cycle", () => {
  const tt = makeTimetable({
    cycle_length: 8,
    anchor_date: "2026-03-23", // Monday = Day 1
    anchor_cycle_day: 1,
  });

  it("8-day cycle wraps correctly over weekends", () => {
    // Week 1: Mon=D1, Tue=D2, Wed=D3, Thu=D4, Fri=D5
    // Week 2: Mon=D6, Tue=D7, Wed=D8, Thu=D1, Fri=D2
    expect(getCycleDay(parseDate("2026-03-23"), tt)).toBe(1);
    expect(getCycleDay(parseDate("2026-03-27"), tt)).toBe(5);
    expect(getCycleDay(parseDate("2026-03-30"), tt)).toBe(6);
    expect(getCycleDay(parseDate("2026-04-01"), tt)).toBe(8);
    expect(getCycleDay(parseDate("2026-04-02"), tt)).toBe(1); // Wraps
    expect(getCycleDay(parseDate("2026-04-03"), tt)).toBe(2);
  });

  it("class meeting every other day (D1,D3,D5,D7) gets 4 lessons per 8-day cycle", () => {
    const meetings = [
      makeMeeting("math", 1, 1),
      makeMeeting("math", 3, 1),
      makeMeeting("math", 5, 1),
      makeMeeting("math", 7, 1),
    ];

    // Full 8-day cycle = 8 school days (Mon Mar 23 → Wed Apr 1)
    const calendar = getLessonCalendar(
      "math",
      parseDate("2026-03-23"),
      parseDate("2026-04-01"),
      tt,
      meetings
    );
    expect(calendar.length).toBe(4);
    expect(calendar.map(l => l.cycleDay)).toEqual([1, 3, 5, 7]);
  });

  it("different period on Tue/Thu vs MWF (by meeting data)", () => {
    // This tests the pattern: class meets D2 P3 and D4 P5 (different periods)
    const meetings = [
      makeMeeting("art", 2, 3, "Studio A"),
      makeMeeting("art", 4, 5, "Studio B"),
    ];

    const lessons = getNextLessons(
      "art",
      parseDate("2026-03-23"),
      4,
      tt,
      meetings
    );

    expect(lessons.length).toBe(4);
    // D2=Tue24 P3, D4=Thu26 P5, then next cycle D2=Tue31 P3, D4=Thu2 P5...
    // Wait — 8-day cycle: D2=Tue24, D4=Thu26, then D2 again... let's check:
    // Cycle 1: D1=Mon23, D2=Tue24✓P3, D3=Wed25, D4=Thu26✓P5, D5=Fri27,
    //          D6=Mon30, D7=Tue31, D8=Wed1
    // Cycle 2: D1=Thu2, D2=Fri3✓P3, D3=Mon6, D4=Tue7✓P5
    expect(lessons[0].periodNumber).toBe(3);
    expect(lessons[0].room).toBe("Studio A");
    expect(lessons[1].periodNumber).toBe(5);
    expect(lessons[1].room).toBe("Studio B");
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 4: 10-Day Rotating Cycle (Asia-Pacific intl schools)
// ═══════════════════════════════════════════════════════════════
describe("Scenario 4: 10-day rotating cycle", () => {
  const tt = makeTimetable({
    cycle_length: 10,
    anchor_date: "2026-03-23", // Monday = Day 1
    anchor_cycle_day: 1,
  });

  it("10-day cycle takes exactly 2 calendar weeks", () => {
    // Week 1: D1-D5 (Mon-Fri)
    // Week 2: D6-D10 (Mon-Fri)
    expect(getCycleDay(parseDate("2026-03-23"), tt)).toBe(1);
    expect(getCycleDay(parseDate("2026-03-27"), tt)).toBe(5);
    expect(getCycleDay(parseDate("2026-03-30"), tt)).toBe(6);
    expect(getCycleDay(parseDate("2026-04-03"), tt)).toBe(10);
    // Next cycle starts
    expect(getCycleDay(parseDate("2026-04-06"), tt)).toBe(1);
  });

  it("class meets D2,D5,D8 (3 times per 10-day cycle)", () => {
    const meetings = [
      makeMeeting("science", 2),
      makeMeeting("science", 5),
      makeMeeting("science", 8),
    ];

    const count = countLessonsInRange(
      "science",
      parseDate("2026-03-23"),
      parseDate("2026-04-03"), // 10 school days
      tt,
      meetings
    );
    expect(count).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 5: A/B Block Schedule (2-day cycle)
// ~33% of US high schools
// ═══════════════════════════════════════════════════════════════
describe("Scenario 5: A/B block schedule (2-day cycle)", () => {
  const tt = makeTimetable({
    cycle_length: 2,
    anchor_date: "2026-03-23", // Monday = Day A (1)
    anchor_cycle_day: 1,
  });

  it("alternates A/B every school day", () => {
    expect(getCycleDay(parseDate("2026-03-23"), tt)).toBe(1); // A
    expect(getCycleDay(parseDate("2026-03-24"), tt)).toBe(2); // B
    expect(getCycleDay(parseDate("2026-03-25"), tt)).toBe(1); // A
    expect(getCycleDay(parseDate("2026-03-26"), tt)).toBe(2); // B
    expect(getCycleDay(parseDate("2026-03-27"), tt)).toBe(1); // A (Fri)
    // Weekend
    expect(getCycleDay(parseDate("2026-03-30"), tt)).toBe(2); // B (Mon)
  });

  it("A-day classes meet 3x per week, B-day classes meet 2x", () => {
    const aMeetings = [makeMeeting("english", 1)]; // A days only
    const bMeetings = [makeMeeting("history", 2)]; // B days only

    // Mon-Fri: A,B,A,B,A = 3 A-days, 2 B-days
    const aCount = countLessonsInRange("english", parseDate("2026-03-23"), parseDate("2026-03-27"), tt, aMeetings);
    const bCount = countLessonsInRange("history", parseDate("2026-03-23"), parseDate("2026-03-27"), tt, bMeetings);
    expect(aCount).toBe(3);
    expect(bCount).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 6: Holiday Handling
// ═══════════════════════════════════════════════════════════════
describe("Scenario 6: Holiday handling", () => {
  it("single holiday skips that day and shifts cycle", () => {
    const tt = makeTimetable({
      cycle_length: 5,
      anchor_date: "2026-03-23",
      anchor_cycle_day: 1,
      excluded_dates: ["2026-03-25"], // Wed excluded
    });

    expect(getCycleDay(parseDate("2026-03-23"), tt)).toBe(1); // Mon
    expect(getCycleDay(parseDate("2026-03-24"), tt)).toBe(2); // Tue
    expect(getCycleDay(parseDate("2026-03-25"), tt)).toBeNull(); // Wed — holiday
    expect(getCycleDay(parseDate("2026-03-26"), tt)).toBe(3); // Thu (was D4, now D3)
    expect(getCycleDay(parseDate("2026-03-27"), tt)).toBe(4); // Fri (was D5, now D4)
    expect(getCycleDay(parseDate("2026-03-30"), tt)).toBe(5); // Mon (D5 pushed)
  });

  it("labeled holidays (with parenthetical label) are parsed correctly", () => {
    const tt = makeTimetable({
      excluded_dates: ["2026-04-14 (Easter Monday)", "2026-12-25 (Christmas Day)"],
    });

    expect(getCycleDay(parseDate("2026-04-14"), tt)).toBeNull();
    // Ensure the label doesn't break parsing
    expect(isSchoolDay(parseDate("2026-04-14"), "weekday", new Set(["2026-04-14"]))).toBe(false);
  });

  it("multi-day holiday block (e.g. Chinese New Year, 5 days)", () => {
    const tt = makeTimetable({
      cycle_length: 8,
      anchor_date: "2026-03-23",
      anchor_cycle_day: 1,
      excluded_dates: [
        "2026-03-25", // Wed
        "2026-03-26", // Thu
        "2026-03-27", // Fri
      ],
    });

    expect(getCycleDay(parseDate("2026-03-23"), tt)).toBe(1); // Mon
    expect(getCycleDay(parseDate("2026-03-24"), tt)).toBe(2); // Tue
    expect(getCycleDay(parseDate("2026-03-25"), tt)).toBeNull(); // Holiday
    expect(getCycleDay(parseDate("2026-03-26"), tt)).toBeNull(); // Holiday
    expect(getCycleDay(parseDate("2026-03-27"), tt)).toBeNull(); // Holiday
    expect(getCycleDay(parseDate("2026-03-30"), tt)).toBe(3); // Mon — D3 continues
  });

  it("lessons skip holidays in getNextLessons", () => {
    const tt = makeTimetable({
      cycle_length: 5,
      anchor_date: "2026-03-23",
      anchor_cycle_day: 1,
      excluded_dates: ["2026-03-25"],
    });
    const meetings = [makeMeeting("design", 1), makeMeeting("design", 3)];

    const lessons = getNextLessons("design", parseDate("2026-03-23"), 3, tt, meetings);
    // D1=Mon23✓, D2=Tue24, [Wed25 excluded], D3=Thu26✓, D4=Fri27, D5=Mon30, D1=Tue31✓
    expect(lessons.length).toBe(3);
    expect(lessons[0].dateISO).toBe("2026-03-23"); // D1
    expect(lessons[1].dateISO).toBe("2026-03-26"); // D3 (shifted)
    expect(lessons[2].dateISO).toBe("2026-03-31"); // Next D1
  });

  it("holiday on anchor date — backward calculation still works", () => {
    // Anchor is excluded — this is an edge case
    const tt = makeTimetable({
      cycle_length: 5,
      anchor_date: "2026-03-25", // Wed — but it's excluded!
      anchor_cycle_day: 3,
      excluded_dates: ["2026-03-25"],
    });

    // The anchor is excluded, but getCycleDay for other dates should still work
    // because countSchoolDaysBetween counts from anchor forward/backward
    expect(getCycleDay(parseDate("2026-03-25"), tt)).toBeNull(); // excluded
    // Mon=? Let's trace: countSchoolDaysBetween(Wed, Mon) going backward
    // Tue = -1 (D2), Mon = -2 (D1)
    expect(getCycleDay(parseDate("2026-03-23"), tt)).toBe(1); // should be D1
    expect(getCycleDay(parseDate("2026-03-24"), tt)).toBe(2); // should be D2
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 7: Term Resets
// ═══════════════════════════════════════════════════════════════
describe("Scenario 7: Term resets", () => {
  const tt = makeTimetable({
    cycle_length: 6,
    anchor_date: "2026-01-12", // Some Monday in Jan
    anchor_cycle_day: 1,
    reset_each_term: true,
  });

  it("resets to Day 1 at term start", () => {
    const term2: TermDates = { start: "2026-04-06", end: "2026-06-19" }; // Mon Apr 6

    expect(getCycleDay(parseDate("2026-04-06"), tt, term2)).toBe(1); // Reset to D1
    expect(getCycleDay(parseDate("2026-04-07"), tt, term2)).toBe(2);
    expect(getCycleDay(parseDate("2026-04-08"), tt, term2)).toBe(3);
  });

  it("term start on non-school day scans forward", () => {
    const tt2 = makeTimetable({
      cycle_length: 6,
      anchor_date: "2026-01-12",
      anchor_cycle_day: 1,
      reset_each_term: true,
      excluded_dates: ["2026-04-06"], // Mon is a PD day
    });

    const term: TermDates = { start: "2026-04-06", end: "2026-06-19" };
    // Apr 6 excluded → first school day is Tue Apr 7
    expect(getCycleDay(parseDate("2026-04-07"), tt2, term)).toBe(1); // D1 on Tue
    expect(getCycleDay(parseDate("2026-04-08"), tt2, term)).toBe(2);
  });

  it("different terms get different cycle day sequences", () => {
    const term1: TermDates = { start: "2026-01-12", end: "2026-03-27" };
    const term2: TermDates = { start: "2026-04-06", end: "2026-06-19" };

    // End of term 1 — cycle has been running since Jan
    // Start of term 2 — resets to D1
    expect(getCycleDay(parseDate("2026-04-06"), tt, term2)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 8: iCal Authoritative Cycle Days
// ═══════════════════════════════════════════════════════════════
describe("Scenario 8: iCal authoritative cycle days", () => {
  it("iCal events override computed cycle day", () => {
    const tt = makeTimetable({
      cycle_length: 8,
      anchor_date: "2026-03-23",
      anchor_cycle_day: 1,
      cycle_day_events: [
        { date: "2026-03-25", cycleDay: 7, summary: "Day 7 - Wednesday" },
      ],
    });

    // Without iCal, Wed Mar 25 = D3 (computed)
    // With iCal, it's overridden to D7
    expect(getCycleDay(parseDate("2026-03-25"), tt)).toBe(7);
  });

  it("non-covered dates fall back to math", () => {
    const tt = makeTimetable({
      cycle_length: 8,
      anchor_date: "2026-03-23",
      anchor_cycle_day: 1,
      cycle_day_events: [
        { date: "2026-03-25", cycleDay: 7 },
      ],
    });

    // Mar 24 not in iCal → falls back to math
    expect(getCycleDay(parseDate("2026-03-24"), tt)).toBe(2);
    // Mar 26 not in iCal → falls back to math
    expect(getCycleDay(parseDate("2026-03-26"), tt)).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 9: Matt's School — 8-day cycle, Tue/Thu different timing
// ═══════════════════════════════════════════════════════════════
describe("Scenario 9: Matt's school (8-day cycle, variable periods)", () => {
  // 8-day cycle. Class meets on D2 (Period 3, 80min) and D6 (Period 5, 50min)
  // The period difference is captured in the meeting data, not the cycle engine
  const tt = makeTimetable({
    cycle_length: 8,
    anchor_date: "2026-03-23",
    anchor_cycle_day: 1,
    excluded_dates: [
      "2026-04-03 (Qingming Festival)",
      "2026-05-01 (Labour Day)",
    ],
  });

  const meetings = [
    makeMeeting("myp-design-9a", 2, 3, "DT Workshop"),
    makeMeeting("myp-design-9a", 6, 5, "DT Workshop"),
  ];

  it("class meets twice per 8-day cycle", () => {
    // 8 school days from Mon Mar 23
    const count = countLessonsInRange(
      "myp-design-9a",
      parseDate("2026-03-23"),
      parseDate("2026-04-01"), // 8 school days
      tt,
      meetings
    );
    expect(count).toBe(2);
  });

  it("next 5 lessons skip Qingming Festival", () => {
    const lessons = getNextLessons(
      "myp-design-9a",
      parseDate("2026-03-23"),
      5,
      tt,
      meetings
    );

    expect(lessons.length).toBe(5);
    // None should fall on Apr 3 (excluded)
    expect(lessons.every(l => l.dateISO !== "2026-04-03")).toBe(true);
    // All should have correct room
    expect(lessons.every(l => l.room === "DT Workshop")).toBe(true);
  });

  it("period numbers are correctly preserved per cycle day", () => {
    const lessons = getNextLessons(
      "myp-design-9a",
      parseDate("2026-03-23"),
      4,
      tt,
      meetings
    );

    // D2 meetings should have period 3, D6 meetings should have period 5
    for (const l of lessons) {
      if (l.cycleDay === 2) expect(l.periodNumber).toBe(3);
      if (l.cycleDay === 6) expect(l.periodNumber).toBe(5);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 10: Calendar-type cycle (not weekday-only)
// For schools operating 6-day weeks (Middle East, parts of Asia)
// ═══════════════════════════════════════════════════════════════
describe("Scenario 10: Calendar-type cycle (6-day school week)", () => {
  const tt = makeTimetable({
    cycle_length: 6,
    cycle_type: "calendar", // counts ALL days, not just weekdays
    anchor_date: "2026-03-22", // Sunday = Day 1 (Sun-Fri school week)
    anchor_cycle_day: 1,
    excluded_dates: ["2026-03-27"], // Friday off (prayer day in some countries)
  });

  it("weekends are school days in calendar mode", () => {
    expect(getCycleDay(parseDate("2026-03-22"), tt)).toBe(1); // Sun
    expect(getCycleDay(parseDate("2026-03-23"), tt)).toBe(2); // Mon
    expect(getCycleDay(parseDate("2026-03-28"), tt)).toBe(1); // Next Sat → D7%6=1
  });

  it("excluded Friday is skipped in calendar mode", () => {
    expect(getCycleDay(parseDate("2026-03-27"), tt)).toBeNull(); // Excluded Fri
    expect(getCycleDay(parseDate("2026-03-26"), tt)).toBe(5);    // Thu = D5
    // Sat after excluded Fri: 4 school days from anchor (Sun→Mon→Tue→Wed→Thu=5, skip Fri, Sat=6)
    // Actually let's trace: D1=Sun22, D2=Mon23, D3=Tue24, D4=Wed25, D5=Thu26, [Fri27 excl], D6=Sat28
    expect(getCycleDay(parseDate("2026-03-28"), tt)).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 11: Edge Cases
// ═══════════════════════════════════════════════════════════════
describe("Scenario 11: Edge cases", () => {
  it("cycle length 1 — every day is Day 1", () => {
    const tt = makeTimetable({ cycle_length: 1 });
    expect(getCycleDay(parseDate("2026-03-23"), tt)).toBe(1);
    expect(getCycleDay(parseDate("2026-03-24"), tt)).toBe(1);
    expect(getCycleDay(parseDate("2026-03-25"), tt)).toBe(1);
  });

  it("very large cycle length (20)", () => {
    const tt = makeTimetable({ cycle_length: 20 });
    // 20 school days = 4 calendar weeks
    expect(getCycleDay(parseDate("2026-03-23"), tt)).toBe(1);  // Mon wk1
    expect(getCycleDay(parseDate("2026-04-17"), tt)).toBe(20); // Fri wk4
    expect(getCycleDay(parseDate("2026-04-20"), tt)).toBe(1);  // Mon wk5 = restart
  });

  it("anchor not on Day 1 (e.g. anchor is Day 4)", () => {
    const tt = makeTimetable({
      cycle_length: 8,
      anchor_date: "2026-03-23",
      anchor_cycle_day: 4, // Mon = Day 4, so previous Fri = Day 3
    });

    expect(getCycleDay(parseDate("2026-03-23"), tt)).toBe(4);
    expect(getCycleDay(parseDate("2026-03-24"), tt)).toBe(5);
    expect(getCycleDay(parseDate("2026-03-20"), tt)).toBe(3); // prev Fri
  });

  it("getNextLessons with no matching meetings returns empty", () => {
    const tt = makeTimetable();
    const meetings: ClassMeeting[] = [makeMeeting("math", 2)];
    const lessons = getNextLessons("english", parseDate("2026-03-23"), 5, tt, meetings);
    expect(lessons).toEqual([]);
  });

  it("getNextLessons with empty meetings returns empty", () => {
    const tt = makeTimetable();
    const lessons = getNextLessons("design", parseDate("2026-03-23"), 5, tt, []);
    expect(lessons).toEqual([]);
  });

  it("countLessonsInRange with start > end returns 0", () => {
    const tt = makeTimetable();
    const meetings = [makeMeeting("math", 1)];
    // End before start
    const count = countLessonsInRange(
      "math",
      parseDate("2026-04-01"),
      parseDate("2026-03-23"),
      tt,
      meetings
    );
    expect(count).toBe(0);
  });

  it("all dates in range excluded → 0 lessons", () => {
    const tt = makeTimetable({
      excluded_dates: [
        "2026-03-23", "2026-03-24", "2026-03-25",
        "2026-03-26", "2026-03-27",
      ],
    });
    const meetings = [makeMeeting("math", 1)];
    const count = countLessonsInRange(
      "math",
      parseDate("2026-03-23"),
      parseDate("2026-03-27"),
      tt,
      meetings
    );
    expect(count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 12: Lesson Calendar & Formatting
// ═══════════════════════════════════════════════════════════════
describe("Scenario 12: Lesson calendar and formatting", () => {
  const tt = makeTimetable({
    cycle_length: 8,
    anchor_date: "2026-03-23",
    anchor_cycle_day: 1,
  });

  const meetings = [
    makeMeeting("design", 1, 2, "Room 204"),
    makeMeeting("design", 5, 4, "DT Lab"),
  ];

  it("getLessonCalendar returns sequential lesson numbers", () => {
    const calendar = getLessonCalendar(
      "design",
      parseDate("2026-03-23"),
      parseDate("2026-04-10"),
      tt,
      meetings
    );

    expect(calendar.length).toBeGreaterThan(0);
    // Sequence should be 1, 2, 3, 4, ...
    for (let i = 0; i < calendar.length; i++) {
      expect(calendar[i].lessonSequence).toBe(i + 1);
    }
  });

  it("formatLessonDate produces readable output", () => {
    const calendar = getLessonCalendar(
      "design",
      parseDate("2026-03-23"),
      parseDate("2026-03-23"),
      tt,
      meetings
    );

    expect(calendar.length).toBe(1);
    const formatted = formatLessonDate(calendar[0]);
    expect(formatted).toContain("Monday");
    expect(formatted).toContain("March");
    expect(formatted).toContain("23");
    expect(formatted).toContain("Day 1");
    expect(formatted).toContain("Period 2");
  });

  it("formatLessonShort produces compact output", () => {
    const calendar = getLessonCalendar(
      "design",
      parseDate("2026-03-23"),
      parseDate("2026-03-23"),
      tt,
      meetings
    );

    const short = formatLessonShort(calendar[0]);
    expect(short).toBe("Day 1, P2 — Mon");
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 13: Australian 4-Term Southern Hemisphere
// ═══════════════════════════════════════════════════════════════
describe("Scenario 13: Australian 4-term, 5-day week", () => {
  // Standard AU school: 5-day week, 4 terms, Feb-Dec
  const tt = makeTimetable({
    cycle_length: 5,
    anchor_date: "2026-02-02", // First Mon of school year
    anchor_cycle_day: 1,
    reset_each_term: true,
    excluded_dates: [
      "2026-04-03 (Good Friday)",
      "2026-04-06 (Easter Monday)",
      "2026-04-25 (ANZAC Day)", // Sat in 2026, but included for safety
    ],
  });

  const term1: TermDates = { start: "2026-02-02", end: "2026-04-02" };
  const term2: TermDates = { start: "2026-04-20", end: "2026-06-26" };

  it("Term 1 starts with Day 1", () => {
    expect(getCycleDay(parseDate("2026-02-02"), tt, term1)).toBe(1);
  });

  it("Term 2 resets to Day 1", () => {
    expect(getCycleDay(parseDate("2026-04-20"), tt, term2)).toBe(1);
    expect(getCycleDay(parseDate("2026-04-21"), tt, term2)).toBe(2);
  });

  it("Easter excluded dates are skipped", () => {
    expect(getCycleDay(parseDate("2026-04-03"), tt, term1)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 14: Year-Round School (60/20 calendar)
// ═══════════════════════════════════════════════════════════════
describe("Scenario 14: Year-round 60/20 calendar", () => {
  // 60 school days instruction, 20 days break, repeating
  // Still uses 5-day week but shorter terms
  const tt = makeTimetable({
    cycle_length: 5,
    anchor_date: "2026-03-23",
    anchor_cycle_day: 1,
    reset_each_term: true,
  });

  const shortTerm: TermDates = { start: "2026-03-23", end: "2026-06-05" }; // ~12 weeks

  it("works with short term (12 weeks = 60 school days)", () => {
    const meetings = [makeMeeting("math", 1), makeMeeting("math", 3)];
    const count = countLessonsInRange(
      "math",
      parseDate("2026-03-23"),
      parseDate("2026-06-05"),
      tt,
      meetings,
      shortTerm
    );
    // ~60 school days, class meets 2x per 5-day cycle = ~24 lessons
    expect(count).toBeGreaterThan(20);
    expect(count).toBeLessThan(28);
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 15: Multiple classes with overlapping cycle days
// ═══════════════════════════════════════════════════════════════
describe("Scenario 15: Multiple classes same teacher", () => {
  const tt = makeTimetable({
    cycle_length: 8,
    anchor_date: "2026-03-23",
    anchor_cycle_day: 1,
  });

  const meetings = [
    makeMeeting("year9-design", 1, 1, "DT Lab"),
    makeMeeting("year9-design", 5, 3, "DT Lab"),
    makeMeeting("year10-design", 1, 4, "DT Lab"),
    makeMeeting("year10-design", 3, 2, "Room 201"),
    makeMeeting("year10-design", 7, 5, "DT Lab"),
  ];

  it("each class gets its own lesson list without interference", () => {
    const y9 = getNextLessons("year9-design", parseDate("2026-03-23"), 4, tt, meetings);
    const y10 = getNextLessons("year10-design", parseDate("2026-03-23"), 4, tt, meetings);

    // Y9 meets D1, D5 only
    expect(y9.every(l => [1, 5].includes(l.cycleDay))).toBe(true);
    // Y10 meets D1, D3, D7
    expect(y10.every(l => [1, 3, 7].includes(l.cycleDay))).toBe(true);
  });

  it("same cycle day, different periods for different classes", () => {
    const y9 = getNextLessons("year9-design", parseDate("2026-03-23"), 1, tt, meetings);
    const y10 = getNextLessons("year10-design", parseDate("2026-03-23"), 1, tt, meetings);

    // Both have a meeting on D1 but different periods
    expect(y9[0].cycleDay).toBe(1);
    expect(y9[0].periodNumber).toBe(1);
    expect(y10[0].cycleDay).toBe(1);
    expect(y10[0].periodNumber).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 16: parseDate and formatDate consistency
// ═══════════════════════════════════════════════════════════════
describe("Scenario 16: Date parsing round-trip", () => {
  it("round-trips correctly for common dates", () => {
    const dates = [
      "2026-01-01", "2026-02-28", "2026-06-30",
      "2026-12-31", "2025-03-15", "2027-09-01",
    ];
    for (const d of dates) {
      expect(formatDate(parseDate(d))).toBe(d);
    }
  });

  it("leap year Feb 29 handled", () => {
    expect(formatDate(parseDate("2028-02-29"))).toBe("2028-02-29");
  });

  it("year boundaries work", () => {
    const tt = makeTimetable({
      anchor_date: "2025-12-29", // Mon
      anchor_cycle_day: 1,
    });
    // Dec 29 Mon = D1, Dec 30 Tue = D2, Dec 31 Wed = D3, Jan 1 Thu = D4, Jan 2 Fri = D5
    expect(getCycleDay(parseDate("2025-12-31"), tt)).toBe(3);
    expect(getCycleDay(parseDate("2026-01-01"), tt)).toBe(4);
    expect(getCycleDay(parseDate("2026-01-02"), tt)).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// SCENARIO 17: Stress test — long range
// ═══════════════════════════════════════════════════════════════
describe("Scenario 17: Long-range calculations", () => {
  const tt = makeTimetable({
    cycle_length: 8,
    anchor_date: "2026-03-23",
    anchor_cycle_day: 1,
  });

  it("calculate cycle day 6 months from anchor", () => {
    // ~130 school days from anchor
    const result = getCycleDay(parseDate("2026-09-23"), tt);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(8);
  });

  it("getNextLessons capped at 50 still works", () => {
    const meetings = [makeMeeting("design", 1), makeMeeting("design", 5)];
    const lessons = getNextLessons("design", parseDate("2026-03-23"), 50, tt, meetings);
    expect(lessons.length).toBe(50);
    // Verify ordering
    for (let i = 1; i < lessons.length; i++) {
      expect(lessons[i].date.getTime()).toBeGreaterThan(lessons[i - 1].date.getTime());
    }
  });

  it("getLessonCalendar for full term (~10 weeks)", () => {
    const meetings = [makeMeeting("design", 2, 3)];
    const calendar = getLessonCalendar(
      "design",
      parseDate("2026-03-23"),
      parseDate("2026-06-05"),
      tt,
      meetings
    );
    // ~50 school days / 8-day cycle = ~6 full cycles. D2 appears once per cycle = ~6 lessons
    expect(calendar.length).toBeGreaterThanOrEqual(5);
    expect(calendar.length).toBeLessThanOrEqual(8);
  });
});
