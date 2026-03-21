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
  type SchoolTimetable,
  type ClassMeeting,
} from "../cycle-engine";

// ─────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────

/** NIS-style 8-day cycle, weekdays only, anchor: 2026-03-22 is Day 3 */
const TIMETABLE_8DAY: SchoolTimetable = {
  id: "tt-1",
  teacher_id: "teacher-1",
  cycle_length: 8,
  cycle_type: "weekday",
  anchor_date: "2026-03-23", // Monday = Day 3
  anchor_cycle_day: 3,
  reset_each_term: false,
  periods: [],
  excluded_dates: [],
  source: "manual",
};

/** Standard 5-day (weekly) cycle */
const TIMETABLE_5DAY: SchoolTimetable = {
  id: "tt-2",
  teacher_id: "teacher-1",
  cycle_length: 5,
  cycle_type: "weekday",
  anchor_date: "2026-03-23", // Monday = Day 1
  anchor_cycle_day: 1,
  reset_each_term: false,
  periods: [],
  excluded_dates: [],
  source: "manual",
};

/** 6-day cycle */
const TIMETABLE_6DAY: SchoolTimetable = {
  id: "tt-3",
  teacher_id: "teacher-1",
  cycle_length: 6,
  cycle_type: "weekday",
  anchor_date: "2026-03-23", // Monday = Day 1
  anchor_cycle_day: 1,
  reset_each_term: false,
  periods: [],
  excluded_dates: [],
  source: "manual",
};

/** 10-day cycle */
const TIMETABLE_10DAY: SchoolTimetable = {
  id: "tt-4",
  teacher_id: "teacher-1",
  cycle_length: 10,
  cycle_type: "weekday",
  anchor_date: "2026-03-23", // Monday = Day 1
  anchor_cycle_day: 1,
  reset_each_term: false,
  periods: [],
  excluded_dates: [],
  source: "manual",
};

/** 8-day with holidays */
const TIMETABLE_8DAY_HOLIDAYS: SchoolTimetable = {
  ...TIMETABLE_8DAY,
  excluded_dates: ["2026-03-25", "2026-03-26"], // Wed + Thu of first week
};

/** 8-day with term reset */
const TIMETABLE_8DAY_RESET: SchoolTimetable = {
  ...TIMETABLE_8DAY,
  reset_each_term: true,
};

/** Class meetings: Design class on Day 2 (P4) and Day 6 (P2) */
const MEETINGS_DESIGN: ClassMeeting[] = [
  { id: "m1", timetable_id: "tt-1", class_id: "design-9a", cycle_day: 2, period_number: 4, room: "D101" },
  { id: "m2", timetable_id: "tt-1", class_id: "design-9a", cycle_day: 6, period_number: 2, room: "D101" },
];

/** Multiple classes */
const MEETINGS_MULTI: ClassMeeting[] = [
  ...MEETINGS_DESIGN,
  { id: "m3", timetable_id: "tt-1", class_id: "design-10b", cycle_day: 3, period_number: 1 },
  { id: "m4", timetable_id: "tt-1", class_id: "design-10b", cycle_day: 7, period_number: 5 },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

describe("parseDate / formatDate", () => {
  it("round-trips correctly", () => {
    expect(formatDate(parseDate("2026-03-23"))).toBe("2026-03-23");
    expect(formatDate(parseDate("2026-12-31"))).toBe("2026-12-31");
    expect(formatDate(parseDate("2026-01-01"))).toBe("2026-01-01");
  });
});

describe("isSchoolDay", () => {
  it("weekday cycle: Mon-Fri are school days", () => {
    const excluded = new Set<string>();
    // Mon 23 Mar
    expect(isSchoolDay(parseDate("2026-03-23"), "weekday", excluded)).toBe(true);
    // Fri 27 Mar
    expect(isSchoolDay(parseDate("2026-03-27"), "weekday", excluded)).toBe(true);
  });

  it("weekday cycle: weekends are not school days", () => {
    const excluded = new Set<string>();
    // Sat 28 Mar
    expect(isSchoolDay(parseDate("2026-03-28"), "weekday", excluded)).toBe(false);
    // Sun 29 Mar
    expect(isSchoolDay(parseDate("2026-03-29"), "weekday", excluded)).toBe(false);
  });

  it("excluded dates are not school days", () => {
    const excluded = new Set(["2026-03-25"]);
    expect(isSchoolDay(parseDate("2026-03-25"), "weekday", excluded)).toBe(false);
    expect(isSchoolDay(parseDate("2026-03-24"), "weekday", excluded)).toBe(true);
  });

  it("calendar cycle: weekends are school days", () => {
    const excluded = new Set<string>();
    expect(isSchoolDay(parseDate("2026-03-28"), "calendar", excluded)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// countSchoolDaysBetween
// ─────────────────────────────────────────────────────────────

describe("countSchoolDaysBetween", () => {
  it("same date returns 0", () => {
    const d = parseDate("2026-03-23");
    expect(countSchoolDaysBetween(d, d, "weekday", new Set())).toBe(0);
  });

  it("Mon to Fri = 4 school days", () => {
    const mon = parseDate("2026-03-23");
    const fri = parseDate("2026-03-27");
    expect(countSchoolDaysBetween(mon, fri, "weekday", new Set())).toBe(4);
  });

  it("Mon to next Mon = 5 school days (skips weekend)", () => {
    const mon1 = parseDate("2026-03-23");
    const mon2 = parseDate("2026-03-30");
    expect(countSchoolDaysBetween(mon1, mon2, "weekday", new Set())).toBe(5);
  });

  it("excludes holidays from count", () => {
    const mon = parseDate("2026-03-23");
    const fri = parseDate("2026-03-27");
    const excluded = new Set(["2026-03-25"]); // Wed is holiday
    expect(countSchoolDaysBetween(mon, fri, "weekday", excluded)).toBe(3);
  });

  it("handles backward counting (negative)", () => {
    const fri = parseDate("2026-03-27");
    const mon = parseDate("2026-03-23");
    expect(countSchoolDaysBetween(fri, mon, "weekday", new Set())).toBe(-4);
  });

  it("calendar cycle counts weekends", () => {
    const mon = parseDate("2026-03-23");
    const nextMon = parseDate("2026-03-30");
    expect(countSchoolDaysBetween(mon, nextMon, "calendar", new Set())).toBe(7);
  });
});

// ─────────────────────────────────────────────────────────────
// getCycleDay — 8-day cycle
// ─────────────────────────────────────────────────────────────

describe("getCycleDay — 8-day weekday cycle", () => {
  it("anchor date returns anchor cycle day", () => {
    // Mon 23 Mar = Day 3
    expect(getCycleDay(parseDate("2026-03-23"), TIMETABLE_8DAY)).toBe(3);
  });

  it("next school day increments by 1", () => {
    // Tue 24 Mar = Day 4
    expect(getCycleDay(parseDate("2026-03-24"), TIMETABLE_8DAY)).toBe(4);
  });

  it("cycles correctly across the week", () => {
    // Mon=3, Tue=4, Wed=5, Thu=6, Fri=7
    expect(getCycleDay(parseDate("2026-03-25"), TIMETABLE_8DAY)).toBe(5);
    expect(getCycleDay(parseDate("2026-03-26"), TIMETABLE_8DAY)).toBe(6);
    expect(getCycleDay(parseDate("2026-03-27"), TIMETABLE_8DAY)).toBe(7);
  });

  it("skips weekends and continues", () => {
    // Fri=7, (skip Sat/Sun), Mon 30 Mar = Day 8
    expect(getCycleDay(parseDate("2026-03-30"), TIMETABLE_8DAY)).toBe(8);
    // Tue 31 Mar = Day 1 (cycle wraps)
    expect(getCycleDay(parseDate("2026-03-31"), TIMETABLE_8DAY)).toBe(1);
  });

  it("returns null for weekends", () => {
    expect(getCycleDay(parseDate("2026-03-28"), TIMETABLE_8DAY)).toBeNull();
    expect(getCycleDay(parseDate("2026-03-29"), TIMETABLE_8DAY)).toBeNull();
  });

  it("handles second cycle correctly", () => {
    // From anchor Day 3, 8 school days later = Day 3 again
    // Mon 23 (3), Tue 24 (4), Wed 25 (5), Thu 26 (6), Fri 27 (7),
    // Mon 30 (8), Tue 31 (1), Wed Apr 1 (2), Thu Apr 2 (3)
    expect(getCycleDay(parseDate("2026-04-02"), TIMETABLE_8DAY)).toBe(3);
  });

  it("returns null for excluded dates", () => {
    // Wed 25 Mar is a holiday in TIMETABLE_8DAY_HOLIDAYS
    expect(getCycleDay(parseDate("2026-03-25"), TIMETABLE_8DAY_HOLIDAYS)).toBeNull();
  });

  it("holidays shift subsequent cycle days", () => {
    // Without holidays: Wed=5, Thu=6
    // With Wed+Thu as holidays: Fri should be Day 5 (not Day 7)
    // Mon=3, Tue=4, (Wed skip), (Thu skip), Fri=5
    expect(getCycleDay(parseDate("2026-03-27"), TIMETABLE_8DAY_HOLIDAYS)).toBe(5);
    // Mon 30 = Day 6 (instead of Day 8 without holidays)
    expect(getCycleDay(parseDate("2026-03-30"), TIMETABLE_8DAY_HOLIDAYS)).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────────
// getCycleDay — 5-day cycle (standard weekly)
// ─────────────────────────────────────────────────────────────

describe("getCycleDay — 5-day (weekly) cycle", () => {
  it("maps to Mon=1 through Fri=5 every week", () => {
    expect(getCycleDay(parseDate("2026-03-23"), TIMETABLE_5DAY)).toBe(1); // Mon
    expect(getCycleDay(parseDate("2026-03-24"), TIMETABLE_5DAY)).toBe(2); // Tue
    expect(getCycleDay(parseDate("2026-03-25"), TIMETABLE_5DAY)).toBe(3); // Wed
    expect(getCycleDay(parseDate("2026-03-26"), TIMETABLE_5DAY)).toBe(4); // Thu
    expect(getCycleDay(parseDate("2026-03-27"), TIMETABLE_5DAY)).toBe(5); // Fri
  });

  it("repeats the same pattern next week", () => {
    expect(getCycleDay(parseDate("2026-03-30"), TIMETABLE_5DAY)).toBe(1); // Mon
    expect(getCycleDay(parseDate("2026-04-03"), TIMETABLE_5DAY)).toBe(5); // Fri
  });
});

// ─────────────────────────────────────────────────────────────
// getCycleDay — 6-day and 10-day cycles
// ─────────────────────────────────────────────────────────────

describe("getCycleDay — 6-day cycle", () => {
  it("wraps after 6 school days", () => {
    // Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Mon(6), Tue(1)
    expect(getCycleDay(parseDate("2026-03-23"), TIMETABLE_6DAY)).toBe(1);
    expect(getCycleDay(parseDate("2026-03-27"), TIMETABLE_6DAY)).toBe(5);
    expect(getCycleDay(parseDate("2026-03-30"), TIMETABLE_6DAY)).toBe(6);
    expect(getCycleDay(parseDate("2026-03-31"), TIMETABLE_6DAY)).toBe(1);
  });
});

describe("getCycleDay — 10-day cycle", () => {
  it("wraps after 10 school days (2 full weeks)", () => {
    // Week 1: Mon(1) Tue(2) Wed(3) Thu(4) Fri(5)
    // Week 2: Mon(6) Tue(7) Wed(8) Thu(9) Fri(10)
    // Week 3: Mon(1) again
    expect(getCycleDay(parseDate("2026-03-23"), TIMETABLE_10DAY)).toBe(1);
    expect(getCycleDay(parseDate("2026-04-03"), TIMETABLE_10DAY)).toBe(10);
    expect(getCycleDay(parseDate("2026-04-06"), TIMETABLE_10DAY)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// getCycleDay — term reset mode
// ─────────────────────────────────────────────────────────────

describe("getCycleDay — reset_each_term", () => {
  it("resets to Day 1 at term start", () => {
    const termDates = { start: "2026-04-06", end: "2026-06-19" };
    // Term 2 starts Mon April 6. With reset, Day 1.
    expect(getCycleDay(parseDate("2026-04-06"), TIMETABLE_8DAY_RESET, termDates)).toBe(1);
    // Tue April 7 = Day 2
    expect(getCycleDay(parseDate("2026-04-07"), TIMETABLE_8DAY_RESET, termDates)).toBe(2);
  });

  it("without term dates, falls back to anchor", () => {
    // No termDates passed → uses original anchor
    expect(getCycleDay(parseDate("2026-03-23"), TIMETABLE_8DAY_RESET)).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// getCycleDay — backward from anchor
// ─────────────────────────────────────────────────────────────

describe("getCycleDay — dates before anchor", () => {
  it("calculates backward correctly", () => {
    // Anchor: Mon Mar 23 = Day 3
    // Fri Mar 20 is 1 school day before Mon = Day 2
    expect(getCycleDay(parseDate("2026-03-20"), TIMETABLE_8DAY)).toBe(2);
    // Thu Mar 19 = Day 1
    expect(getCycleDay(parseDate("2026-03-19"), TIMETABLE_8DAY)).toBe(1);
    // Wed Mar 18 = Day 8
    expect(getCycleDay(parseDate("2026-03-18"), TIMETABLE_8DAY)).toBe(8);
  });
});

// ─────────────────────────────────────────────────────────────
// getNextLessons
// ─────────────────────────────────────────────────────────────

describe("getNextLessons", () => {
  it("finds lessons on correct cycle days", () => {
    // Design class meets Day 2 and Day 6.
    // From Mon Mar 23 (Day 3): first Day 6 is Thu Mar 26, first Day 2 is Tue Mar 31
    // Sequence: Thu 26 (Day 6), Tue 31 (Day 2), ...
    const lessons = getNextLessons(
      "design-9a",
      parseDate("2026-03-23"),
      4,
      TIMETABLE_8DAY,
      MEETINGS_DESIGN
    );

    expect(lessons).toHaveLength(4);
    expect(lessons[0].cycleDay).toBe(6);
    expect(lessons[0].dateISO).toBe("2026-03-26");
    expect(lessons[0].periodNumber).toBe(2);
    expect(lessons[0].room).toBe("D101");
    expect(lessons[0].lessonSequence).toBe(1);

    expect(lessons[1].cycleDay).toBe(2);
    expect(lessons[1].dateISO).toBe("2026-03-31");
    expect(lessons[1].lessonSequence).toBe(2);
  });

  it("returns empty for unknown class", () => {
    const lessons = getNextLessons(
      "nonexistent",
      parseDate("2026-03-23"),
      5,
      TIMETABLE_8DAY,
      MEETINGS_DESIGN
    );
    expect(lessons).toHaveLength(0);
  });

  it("skips holidays", () => {
    // With Wed+Thu holidays, the sequence shifts
    const lessons = getNextLessons(
      "design-9a",
      parseDate("2026-03-23"),
      2,
      TIMETABLE_8DAY_HOLIDAYS,
      MEETINGS_DESIGN
    );

    // With holidays on Wed+Thu: Mon(3), Tue(4), Fri(5), Mon(6), Tue(7), Wed(8), Thu(1), Fri(2)
    // Day 6 first hit: Mon Mar 30 (3→4 skip skip 5→6)
    // Day 2 first hit: Fri Apr 3 (7→8→1→2)
    expect(lessons.length).toBeGreaterThan(0);
    // Each lesson should be a school day (not on excluded dates)
    for (const l of lessons) {
      expect(TIMETABLE_8DAY_HOLIDAYS.excluded_dates).not.toContain(l.dateISO);
    }
  });

  it("includes day of week name", () => {
    const lessons = getNextLessons(
      "design-9a",
      parseDate("2026-03-23"),
      1,
      TIMETABLE_8DAY,
      MEETINGS_DESIGN
    );
    expect(lessons[0].dayOfWeek).toBe("Thursday");
  });
});

// ─────────────────────────────────────────────────────────────
// countLessonsInRange
// ─────────────────────────────────────────────────────────────

describe("countLessonsInRange", () => {
  it("counts meetings in a 2-week range", () => {
    // 2 weeks = 10 school days on 8-day cycle
    // Day 2 appears once, Day 6 appears once per 8 school days
    // In 10 school days from Mon Mar 23: 10/8 ≈ 1.25 cycles
    // Exact: Day 3,4,5,6,7,8,1,2,3,4 → Day 2 appears 1x, Day 6 appears 1x = 2 lessons
    const count = countLessonsInRange(
      "design-9a",
      parseDate("2026-03-23"),
      parseDate("2026-04-03"),
      TIMETABLE_8DAY,
      MEETINGS_DESIGN
    );
    expect(count).toBe(2);
  });

  it("counts meetings in a full term (~12 weeks)", () => {
    // ~60 school days, 8-day cycle → ~7.5 complete cycles
    // 2 meetings per cycle → ~15 lessons
    const count = countLessonsInRange(
      "design-9a",
      parseDate("2026-03-23"),
      parseDate("2026-06-12"),
      TIMETABLE_8DAY,
      MEETINGS_DESIGN
    );
    // 60 school days / 8 = 7.5 cycles, 2 meetings each = ~15
    expect(count).toBeGreaterThanOrEqual(14);
    expect(count).toBeLessThanOrEqual(16);
  });

  it("returns 0 for zero-length range", () => {
    const count = countLessonsInRange(
      "design-9a",
      parseDate("2026-03-24"), // Tue = Day 4 (not a meeting day for design)
      parseDate("2026-03-24"),
      TIMETABLE_8DAY,
      MEETINGS_DESIGN
    );
    expect(count).toBe(0);
  });

  it("handles different classes independently", () => {
    const designCount = countLessonsInRange(
      "design-9a",
      parseDate("2026-03-23"),
      parseDate("2026-04-03"),
      TIMETABLE_8DAY,
      MEETINGS_MULTI
    );
    const otherCount = countLessonsInRange(
      "design-10b",
      parseDate("2026-03-23"),
      parseDate("2026-04-03"),
      TIMETABLE_8DAY,
      MEETINGS_MULTI
    );
    // Both classes meet 2x per 8-day cycle, same range
    expect(designCount).toBe(2);
    expect(otherCount).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
// getLessonCalendar
// ─────────────────────────────────────────────────────────────

describe("getLessonCalendar", () => {
  it("returns sequenced lessons for a term", () => {
    const calendar = getLessonCalendar(
      "design-9a",
      parseDate("2026-03-23"),
      parseDate("2026-04-10"),
      TIMETABLE_8DAY,
      MEETINGS_DESIGN
    );

    // Should have consecutive lesson sequences
    for (let i = 0; i < calendar.length; i++) {
      expect(calendar[i].lessonSequence).toBe(i + 1);
    }

    // All dates should be in range
    for (const lesson of calendar) {
      expect(lesson.date.getTime()).toBeGreaterThanOrEqual(parseDate("2026-03-23").getTime());
      expect(lesson.date.getTime()).toBeLessThanOrEqual(parseDate("2026-04-10").getTime());
    }
  });

  it("returns empty for class with no meetings", () => {
    const calendar = getLessonCalendar(
      "nonexistent",
      parseDate("2026-03-23"),
      parseDate("2026-04-10"),
      TIMETABLE_8DAY,
      MEETINGS_DESIGN
    );
    expect(calendar).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Format helpers
// ─────────────────────────────────────────────────────────────

describe("formatLessonDate", () => {
  it("formats with period", () => {
    const lesson: LessonDate = {
      date: parseDate("2026-03-26"),
      dateISO: "2026-03-26",
      cycleDay: 6,
      periodNumber: 2,
      room: "D101",
      lessonSequence: 1,
      dayOfWeek: "Thursday",
    };
    expect(formatLessonDate(lesson)).toBe("Thursday March 26 (Day 6, Period 2)");
  });

  it("formats without period", () => {
    const lesson: LessonDate = {
      date: parseDate("2026-03-26"),
      dateISO: "2026-03-26",
      cycleDay: 6,
      lessonSequence: 1,
      dayOfWeek: "Thursday",
    };
    expect(formatLessonDate(lesson)).toBe("Thursday March 26 (Day 6)");
  });
});

describe("formatLessonShort", () => {
  it("formats short label with period", () => {
    const lesson: LessonDate = {
      date: parseDate("2026-03-26"),
      dateISO: "2026-03-26",
      cycleDay: 6,
      periodNumber: 2,
      lessonSequence: 1,
      dayOfWeek: "Thursday",
    };
    expect(formatLessonShort(lesson)).toBe("Day 6, P2 — Thu");
  });
});
