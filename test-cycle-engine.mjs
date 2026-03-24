/**
 * Standalone test runner for cycle-engine.ts
 * Manually ports the core functions to JS to avoid TS transpilation issues.
 * Tests the ALGORITHM correctness, not the TS module directly.
 *
 * Usage: node test-cycle-engine.mjs
 */

// ── Re-implement core functions from cycle-engine.ts in plain JS ──

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDayName(date) {
  return DAY_NAMES[date.getUTCDay()];
}

function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function addDays(date, n) {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}

function buildExcludedSet(excluded) {
  return new Set(excluded.map(d => d.split(" ")[0]));
}

function getCycleDayEventsMap(timetable) {
  const events = timetable.cycle_day_events;
  if (!events || events.length === 0) return new Map();
  const m = new Map();
  for (const e of events) {
    m.set(e.date, e.cycleDay);
  }
  return m;
}

function isSchoolDay(date, cycleType, excludedSet) {
  if (cycleType === "weekday" && isWeekend(date)) return false;
  if (excludedSet.has(formatDate(date))) return false;
  return true;
}

function countSchoolDaysBetween(startDate, endDate, cycleType, excludedSet) {
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  if (startMs === endMs) return 0;
  const forward = endMs > startMs;
  const step = forward ? 1 : -1;
  let count = 0;
  let current = addDays(startDate, step);
  const maxIterations = 2000;
  let iterations = 0;
  while (iterations < maxIterations) {
    const currentMs = current.getTime();
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

function getCycleDay(date, timetable, termDates) {
  const excludedSet = buildExcludedSet(timetable.excluded_dates);
  if (!isSchoolDay(date, timetable.cycle_type, excludedSet)) {
    return null;
  }
  if (timetable.cycle_day_events && timetable.cycle_day_events.length > 0) {
    const dateStr = formatDate(date);
    const map = getCycleDayEventsMap(timetable);
    const authoritative = map.get(dateStr);
    if (authoritative !== undefined) return authoritative;
  }
  let anchorDate = parseDate(timetable.anchor_date);
  let anchorCycleDay = timetable.anchor_cycle_day;
  if (timetable.reset_each_term && termDates) {
    const termStart = parseDate(termDates.start);
    const termEnd = parseDate(termDates.end);
    const dateMs = date.getTime();
    if (dateMs >= termStart.getTime() && dateMs <= termEnd.getTime()) {
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
  const schoolDays = countSchoolDaysBetween(anchorDate, date, timetable.cycle_type, excludedSet);
  const offset = schoolDays;
  const mod = ((anchorCycleDay - 1 + offset) % timetable.cycle_length + timetable.cycle_length) % timetable.cycle_length;
  return mod + 1;
}

function getNextLessons(classId, fromDate, count, timetable, meetings, termDates) {
  const classMeetings = meetings.filter(m => m.class_id === classId);
  if (classMeetings.length === 0) return [];
  const meetingMap = new Map();
  for (const m of classMeetings) meetingMap.set(m.cycle_day, m);
  const excludedSet = buildExcludedSet(timetable.excluded_dates);
  const results = [];
  let current = fromDate;
  let sequence = 1;
  const maxIterations = 500;
  let iterations = 0;
  while (results.length < count && iterations < maxIterations) {
    if (isSchoolDay(current, timetable.cycle_type, excludedSet)) {
      const cycleDay = getCycleDay(current, timetable, termDates);
      if (cycleDay !== null && meetingMap.has(cycleDay)) {
        const meeting = meetingMap.get(cycleDay);
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

function countLessonsInRange(classId, startDate, endDate, timetable, meetings, termDates) {
  const classMeetings = meetings.filter(m => m.class_id === classId);
  if (classMeetings.length === 0) return 0;
  const meetingDays = new Set(classMeetings.map(m => m.cycle_day));
  const excludedSet = buildExcludedSet(timetable.excluded_dates);
  let count = 0;
  let current = new Date(startDate.getTime());
  const endMs = endDate.getTime();
  const maxIterations = 500;
  let iterations = 0;
  while (current.getTime() <= endMs && iterations < maxIterations) {
    if (isSchoolDay(current, timetable.cycle_type, excludedSet)) {
      const cycleDay = getCycleDay(current, timetable, termDates);
      if (cycleDay !== null && meetingDays.has(cycleDay)) count++;
    }
    current = addDays(current, 1);
    iterations++;
  }
  return count;
}

function getLessonCalendar(classId, termStart, termEnd, timetable, meetings, termDates) {
  const classMeetings = meetings.filter(m => m.class_id === classId);
  if (classMeetings.length === 0) return [];
  const meetingMap = new Map();
  for (const m of classMeetings) meetingMap.set(m.cycle_day, m);
  const excludedSet = buildExcludedSet(timetable.excluded_dates);
  const results = [];
  let current = new Date(termStart.getTime());
  const endMs = termEnd.getTime();
  let sequence = 1;
  const maxIterations = 500;
  let iterations = 0;
  while (current.getTime() <= endMs && iterations < maxIterations) {
    if (isSchoolDay(current, timetable.cycle_type, excludedSet)) {
      const cycleDay = getCycleDay(current, timetable, termDates);
      if (cycleDay !== null && meetingMap.has(cycleDay)) {
        const meeting = meetingMap.get(cycleDay);
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

function formatLessonDate(lesson) {
  const month = lesson.date.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const day = lesson.date.getUTCDate();
  let result = `${lesson.dayOfWeek} ${month} ${day} (Day ${lesson.cycleDay}`;
  if (lesson.periodNumber) result += `, Period ${lesson.periodNumber}`;
  result += ")";
  return result;
}

function formatLessonShort(lesson) {
  const dayShort = lesson.dayOfWeek.slice(0, 3);
  let result = `Day ${lesson.cycleDay}`;
  if (lesson.periodNumber) result += `, P${lesson.periodNumber}`;
  result += ` — ${dayShort}`;
  return result;
}

// ── Test infrastructure ───────────────────────────────────────
let passed = 0;
let failed = 0;
let errors = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    errors.push({ name, error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function eq(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg}Expected ${expected}, got ${actual}`);
  }
}

function assert(cond, msg = '') {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function makeTimetable(overrides = {}) {
  return {
    id: "tt-test",
    teacher_id: "teacher-1",
    cycle_length: 5,
    cycle_type: "weekday",
    anchor_date: "2026-03-23",
    anchor_cycle_day: 1,
    reset_each_term: false,
    periods: [],
    excluded_dates: [],
    source: "manual",
    ...overrides,
  };
}

function makeMeeting(classId, cycleDay, period, room) {
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
console.log('\n📅 SCENARIO 1: Standard 5-Day Week');
// ═══════════════════════════════════════════════════════════════
{
  const tt = makeTimetable();

  test('Mon-Fri = Days 1-5', () => {
    eq(getCycleDay(parseDate("2026-03-23"), tt), 1, 'Mon ');
    eq(getCycleDay(parseDate("2026-03-24"), tt), 2, 'Tue ');
    eq(getCycleDay(parseDate("2026-03-25"), tt), 3, 'Wed ');
    eq(getCycleDay(parseDate("2026-03-26"), tt), 4, 'Thu ');
    eq(getCycleDay(parseDate("2026-03-27"), tt), 5, 'Fri ');
  });

  test('Weekends return null', () => {
    eq(getCycleDay(parseDate("2026-03-28"), tt), null, 'Sat ');
    eq(getCycleDay(parseDate("2026-03-29"), tt), null, 'Sun ');
  });

  test('Next week restarts at Day 1', () => {
    eq(getCycleDay(parseDate("2026-03-30"), tt), 1, 'Next Mon ');
    eq(getCycleDay(parseDate("2026-04-03"), tt), 5, 'Next Fri ');
  });

  test('Works backward from anchor', () => {
    eq(getCycleDay(parseDate("2026-03-20"), tt), 5, 'Prev Fri ');
    eq(getCycleDay(parseDate("2026-03-16"), tt), 1, 'Prev Mon ');
  });

  test('countSchoolDaysBetween Mon→Fri = 4', () => {
    eq(countSchoolDaysBetween(parseDate("2026-03-23"), parseDate("2026-03-27"), "weekday", new Set()), 4);
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 2: 6-Day Rotating Cycle');
// ═══════════════════════════════════════════════════════════════
{
  const tt = makeTimetable({ cycle_length: 6 });

  test('Day 6 falls on Monday of week 2 (wraps over weekend)', () => {
    eq(getCycleDay(parseDate("2026-03-23"), tt), 1);
    eq(getCycleDay(parseDate("2026-03-27"), tt), 5);
    eq(getCycleDay(parseDate("2026-03-30"), tt), 6); // Mon wk2
  });

  test('Cycle 2 starts on Tue of week 2', () => {
    eq(getCycleDay(parseDate("2026-03-31"), tt), 1); // Tue = new D1
    eq(getCycleDay(parseDate("2026-04-01"), tt), 2); // Wed
  });

  test('D3+D6 class gets 3 lessons in 10 school days', () => {
    const meetings = [makeMeeting("design", 3, 2), makeMeeting("design", 6, 4)];
    const count = countLessonsInRange("design", parseDate("2026-03-23"), parseDate("2026-04-03"), tt, meetings);
    eq(count, 3);
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 3: 8-Day Rotating Cycle (Common IB)');
// ═══════════════════════════════════════════════════════════════
{
  const tt = makeTimetable({ cycle_length: 8 });

  test('8-day cycle wraps correctly', () => {
    eq(getCycleDay(parseDate("2026-03-23"), tt), 1);
    eq(getCycleDay(parseDate("2026-03-27"), tt), 5);
    eq(getCycleDay(parseDate("2026-03-30"), tt), 6);
    eq(getCycleDay(parseDate("2026-04-01"), tt), 8);
    eq(getCycleDay(parseDate("2026-04-02"), tt), 1); // Wraps!
    eq(getCycleDay(parseDate("2026-04-03"), tt), 2);
  });

  test('D1,D3,D5,D7 class gets 4 lessons per cycle', () => {
    const meetings = [
      makeMeeting("math", 1), makeMeeting("math", 3),
      makeMeeting("math", 5), makeMeeting("math", 7),
    ];
    const calendar = getLessonCalendar("math", parseDate("2026-03-23"), parseDate("2026-04-01"), tt, meetings);
    eq(calendar.length, 4);
  });

  test('Different periods per cycle day preserved', () => {
    const meetings = [
      makeMeeting("art", 2, 3, "Studio A"),
      makeMeeting("art", 4, 5, "Studio B"),
    ];
    const lessons = getNextLessons("art", parseDate("2026-03-23"), 2, tt, meetings);
    eq(lessons[0].periodNumber, 3);
    eq(lessons[0].room, "Studio A");
    eq(lessons[1].periodNumber, 5);
    eq(lessons[1].room, "Studio B");
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 4: 10-Day Rotating Cycle');
// ═══════════════════════════════════════════════════════════════
{
  const tt = makeTimetable({ cycle_length: 10 });

  test('10-day cycle = 2 calendar weeks', () => {
    eq(getCycleDay(parseDate("2026-03-23"), tt), 1);
    eq(getCycleDay(parseDate("2026-04-03"), tt), 10);
    eq(getCycleDay(parseDate("2026-04-06"), tt), 1); // New cycle
  });

  test('D2,D5,D8 class meets 3x per cycle', () => {
    const meetings = [makeMeeting("sci", 2), makeMeeting("sci", 5), makeMeeting("sci", 8)];
    eq(countLessonsInRange("sci", parseDate("2026-03-23"), parseDate("2026-04-03"), tt, meetings), 3);
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 5: A/B Block Schedule (2-Day Cycle)');
// ═══════════════════════════════════════════════════════════════
{
  const tt = makeTimetable({ cycle_length: 2 });

  test('Alternates A/B every school day', () => {
    eq(getCycleDay(parseDate("2026-03-23"), tt), 1); // A
    eq(getCycleDay(parseDate("2026-03-24"), tt), 2); // B
    eq(getCycleDay(parseDate("2026-03-25"), tt), 1); // A
    eq(getCycleDay(parseDate("2026-03-27"), tt), 1); // A (Fri)
    eq(getCycleDay(parseDate("2026-03-30"), tt), 2); // B (Mon — weekends skipped)
  });

  test('A-day 3x/wk, B-day 2x/wk', () => {
    eq(countLessonsInRange("eng", parseDate("2026-03-23"), parseDate("2026-03-27"), tt, [makeMeeting("eng", 1)]), 3);
    eq(countLessonsInRange("hist", parseDate("2026-03-23"), parseDate("2026-03-27"), tt, [makeMeeting("hist", 2)]), 2);
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 6: Holiday Handling');
// ═══════════════════════════════════════════════════════════════
{
  test('Single holiday shifts cycle', () => {
    const tt = makeTimetable({ excluded_dates: ["2026-03-25"] });
    eq(getCycleDay(parseDate("2026-03-25"), tt), null);
    eq(getCycleDay(parseDate("2026-03-26"), tt), 3); // Was D4, now D3
    eq(getCycleDay(parseDate("2026-03-27"), tt), 4); // Was D5, now D4
    eq(getCycleDay(parseDate("2026-03-30"), tt), 5); // D5 pushed to Mon
  });

  test('Labeled holidays parsed correctly', () => {
    const tt = makeTimetable({ excluded_dates: ["2026-04-14 (Easter Monday)"] });
    eq(getCycleDay(parseDate("2026-04-14"), tt), null);
  });

  test('Multi-day holiday block (3 days)', () => {
    const tt = makeTimetable({
      cycle_length: 8,
      excluded_dates: ["2026-03-25", "2026-03-26", "2026-03-27"],
    });
    eq(getCycleDay(parseDate("2026-03-24"), tt), 2);
    eq(getCycleDay(parseDate("2026-03-25"), tt), null);
    eq(getCycleDay(parseDate("2026-03-26"), tt), null);
    eq(getCycleDay(parseDate("2026-03-27"), tt), null);
    eq(getCycleDay(parseDate("2026-03-30"), tt), 3); // Continues
  });

  test('Lessons skip holidays', () => {
    const tt = makeTimetable({ excluded_dates: ["2026-03-25"] });
    const meetings = [makeMeeting("d", 1), makeMeeting("d", 3)];
    const lessons = getNextLessons("d", parseDate("2026-03-23"), 3, tt, meetings);
    eq(lessons.length, 3);
    eq(lessons[0].dateISO, "2026-03-23");
    eq(lessons[1].dateISO, "2026-03-26"); // D3 shifted to Thu
  });

  test('Holiday on anchor — backward calc still works', () => {
    const tt = makeTimetable({
      anchor_date: "2026-03-25",
      anchor_cycle_day: 3,
      excluded_dates: ["2026-03-25"],
    });
    eq(getCycleDay(parseDate("2026-03-25"), tt), null);
    eq(getCycleDay(parseDate("2026-03-23"), tt), 1);
    eq(getCycleDay(parseDate("2026-03-24"), tt), 2);
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 7: Term Resets');
// ═══════════════════════════════════════════════════════════════
{
  const tt = makeTimetable({
    cycle_length: 6,
    anchor_date: "2026-01-12",
    anchor_cycle_day: 1,
    reset_each_term: true,
  });

  test('Term 2 resets to Day 1', () => {
    const term2 = { start: "2026-04-06", end: "2026-06-19" };
    eq(getCycleDay(parseDate("2026-04-06"), tt, term2), 1);
    eq(getCycleDay(parseDate("2026-04-07"), tt, term2), 2);
    eq(getCycleDay(parseDate("2026-04-08"), tt, term2), 3);
  });

  test('Term start on excluded day scans forward', () => {
    const tt2 = makeTimetable({
      cycle_length: 6,
      anchor_date: "2026-01-12",
      anchor_cycle_day: 1,
      reset_each_term: true,
      excluded_dates: ["2026-04-06"],
    });
    const term = { start: "2026-04-06", end: "2026-06-19" };
    eq(getCycleDay(parseDate("2026-04-07"), tt2, term), 1); // Tue = D1
    eq(getCycleDay(parseDate("2026-04-08"), tt2, term), 2);
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 8: iCal Authoritative Cycle Days');
// ═══════════════════════════════════════════════════════════════
{
  test('iCal overrides computed cycle day', () => {
    const tt = makeTimetable({
      cycle_length: 8,
      cycle_day_events: [{ date: "2026-03-25", cycleDay: 7, summary: "Day 7" }],
    });
    eq(getCycleDay(parseDate("2026-03-25"), tt), 7); // Overridden from D3
  });

  test('Non-covered dates fall back to math', () => {
    const tt = makeTimetable({
      cycle_length: 8,
      cycle_day_events: [{ date: "2026-03-25", cycleDay: 7 }],
    });
    eq(getCycleDay(parseDate("2026-03-24"), tt), 2); // Math
    eq(getCycleDay(parseDate("2026-03-26"), tt), 4); // Math
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 9: Matt\'s School (8-day, variable periods)');
// ═══════════════════════════════════════════════════════════════
{
  const tt = makeTimetable({
    cycle_length: 8,
    excluded_dates: ["2026-04-03 (Qingming Festival)", "2026-05-01 (Labour Day)"],
  });
  const meetings = [
    makeMeeting("myp-9a", 2, 3, "DT Workshop"),
    makeMeeting("myp-9a", 6, 5, "DT Workshop"),
  ];

  test('Class meets 2x per 8-day cycle', () => {
    eq(countLessonsInRange("myp-9a", parseDate("2026-03-23"), parseDate("2026-04-01"), tt, meetings), 2);
  });

  test('Next 5 lessons skip Qingming Festival', () => {
    const lessons = getNextLessons("myp-9a", parseDate("2026-03-23"), 5, tt, meetings);
    eq(lessons.length, 5);
    assert(lessons.every(l => l.dateISO !== "2026-04-03"), 'Should skip Qingming');
    assert(lessons.every(l => l.room === "DT Workshop"), 'All in DT Workshop');
  });

  test('Period numbers match cycle day', () => {
    const lessons = getNextLessons("myp-9a", parseDate("2026-03-23"), 4, tt, meetings);
    for (const l of lessons) {
      if (l.cycleDay === 2) eq(l.periodNumber, 3, `D2 should be P3, got P${l.periodNumber}`);
      if (l.cycleDay === 6) eq(l.periodNumber, 5, `D6 should be P5, got P${l.periodNumber}`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 10: Calendar-Type Cycle (6-day school week)');
// ═══════════════════════════════════════════════════════════════
{
  const tt = makeTimetable({
    cycle_length: 6,
    cycle_type: "calendar",
    anchor_date: "2026-03-22", // Sunday
    anchor_cycle_day: 1,
    excluded_dates: ["2026-03-27"], // Friday off
  });

  test('Weekends are school days in calendar mode', () => {
    eq(getCycleDay(parseDate("2026-03-22"), tt), 1); // Sun
    eq(getCycleDay(parseDate("2026-03-23"), tt), 2); // Mon
  });

  test('Excluded Friday skipped in calendar mode', () => {
    eq(getCycleDay(parseDate("2026-03-27"), tt), null);
    eq(getCycleDay(parseDate("2026-03-26"), tt), 5); // Thu=D5
    eq(getCycleDay(parseDate("2026-03-28"), tt), 6); // Sat=D6
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 11: Edge Cases');
// ═══════════════════════════════════════════════════════════════
{
  test('Cycle length 1 — every day is Day 1', () => {
    const tt = makeTimetable({ cycle_length: 1 });
    eq(getCycleDay(parseDate("2026-03-23"), tt), 1);
    eq(getCycleDay(parseDate("2026-03-24"), tt), 1);
    eq(getCycleDay(parseDate("2026-03-25"), tt), 1);
  });

  test('Large cycle length (20)', () => {
    const tt = makeTimetable({ cycle_length: 20 });
    eq(getCycleDay(parseDate("2026-03-23"), tt), 1);
    eq(getCycleDay(parseDate("2026-04-17"), tt), 20); // 20 school days
    eq(getCycleDay(parseDate("2026-04-20"), tt), 1);  // Restart
  });

  test('Anchor not on Day 1', () => {
    const tt = makeTimetable({ cycle_length: 8, anchor_cycle_day: 4 });
    eq(getCycleDay(parseDate("2026-03-23"), tt), 4);
    eq(getCycleDay(parseDate("2026-03-24"), tt), 5);
    eq(getCycleDay(parseDate("2026-03-20"), tt), 3); // Prev Fri
  });

  test('No matching meetings → empty lessons', () => {
    const tt = makeTimetable();
    eq(getNextLessons("english", parseDate("2026-03-23"), 5, tt, [makeMeeting("math", 2)]).length, 0);
  });

  test('Empty meetings → empty lessons', () => {
    eq(getNextLessons("design", parseDate("2026-03-23"), 5, makeTimetable(), []).length, 0);
  });

  test('All dates excluded → 0 lessons', () => {
    const tt = makeTimetable({
      excluded_dates: ["2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27"],
    });
    eq(countLessonsInRange("math", parseDate("2026-03-23"), parseDate("2026-03-27"), tt, [makeMeeting("math", 1)]), 0);
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 12: Formatting');
// ═══════════════════════════════════════════════════════════════
{
  const tt = makeTimetable({ cycle_length: 8 });
  const meetings = [makeMeeting("design", 1, 2, "Room 204")];

  test('formatLessonDate readable output', () => {
    const calendar = getLessonCalendar("design", parseDate("2026-03-23"), parseDate("2026-03-23"), tt, meetings);
    eq(calendar.length, 1);
    const formatted = formatLessonDate(calendar[0]);
    assert(formatted.includes('Monday'), `Missing Monday: ${formatted}`);
    assert(formatted.includes('Day 1'), `Missing Day 1: ${formatted}`);
    assert(formatted.includes('Period 2'), `Missing Period 2: ${formatted}`);
  });

  test('formatLessonShort compact output', () => {
    const calendar = getLessonCalendar("design", parseDate("2026-03-23"), parseDate("2026-03-23"), tt, meetings);
    eq(formatLessonShort(calendar[0]), "Day 1, P2 — Mon");
  });

  test('Sequential lesson numbers', () => {
    const meetings2 = [makeMeeting("d", 1, 2), makeMeeting("d", 5, 4)];
    const calendar = getLessonCalendar("d", parseDate("2026-03-23"), parseDate("2026-04-10"), tt, meetings2);
    for (let i = 0; i < calendar.length; i++) {
      eq(calendar[i].lessonSequence, i + 1, `Lesson ${i} seq `);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 13: Australian 4-Term (Southern Hemisphere)');
// ═══════════════════════════════════════════════════════════════
{
  const tt = makeTimetable({
    anchor_date: "2026-02-02",
    reset_each_term: true,
    excluded_dates: ["2026-04-03 (Good Friday)", "2026-04-06 (Easter Monday)"],
  });
  const term1 = { start: "2026-02-02", end: "2026-04-02" };
  const term2 = { start: "2026-04-20", end: "2026-06-26" };

  test('Term 1 starts with Day 1', () => {
    eq(getCycleDay(parseDate("2026-02-02"), tt, term1), 1);
  });

  test('Term 2 resets to Day 1', () => {
    eq(getCycleDay(parseDate("2026-04-20"), tt, term2), 1);
    eq(getCycleDay(parseDate("2026-04-21"), tt, term2), 2);
  });

  test('Easter excluded', () => {
    eq(getCycleDay(parseDate("2026-04-03"), tt, term1), null);
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 14: Multiple Classes Same Teacher');
// ═══════════════════════════════════════════════════════════════
{
  const tt = makeTimetable({ cycle_length: 8 });
  const meetings = [
    makeMeeting("y9", 1, 1, "DT Lab"),
    makeMeeting("y9", 5, 3, "DT Lab"),
    makeMeeting("y10", 1, 4, "DT Lab"),
    makeMeeting("y10", 3, 2, "Room 201"),
    makeMeeting("y10", 7, 5, "DT Lab"),
  ];

  test('Each class gets own lesson list', () => {
    const y9 = getNextLessons("y9", parseDate("2026-03-23"), 4, tt, meetings);
    const y10 = getNextLessons("y10", parseDate("2026-03-23"), 4, tt, meetings);
    assert(y9.every(l => [1, 5].includes(l.cycleDay)), 'Y9 only D1,D5');
    assert(y10.every(l => [1, 3, 7].includes(l.cycleDay)), 'Y10 only D1,D3,D7');
  });

  test('Same day, different periods', () => {
    const y9 = getNextLessons("y9", parseDate("2026-03-23"), 1, tt, meetings);
    const y10 = getNextLessons("y10", parseDate("2026-03-23"), 1, tt, meetings);
    eq(y9[0].periodNumber, 1);
    eq(y10[0].periodNumber, 4);
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 15: Year Boundaries');
// ═══════════════════════════════════════════════════════════════
{
  test('Year rollover works', () => {
    const tt = makeTimetable({ anchor_date: "2025-12-29" });
    eq(getCycleDay(parseDate("2025-12-31"), tt), 3);
    eq(getCycleDay(parseDate("2026-01-01"), tt), 4);
    eq(getCycleDay(parseDate("2026-01-02"), tt), 5);
  });

  test('Leap year Feb 29 round-trips', () => {
    eq(formatDate(parseDate("2028-02-29")), "2028-02-29");
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 16: Long-Range Stress Test');
// ═══════════════════════════════════════════════════════════════
{
  const tt = makeTimetable({ cycle_length: 8 });

  test('Cycle day 6 months from anchor', () => {
    const result = getCycleDay(parseDate("2026-09-23"), tt);
    assert(result !== null, 'Should not be null (weekday)');
    assert(result >= 1 && result <= 8, `Should be 1-8, got ${result}`);
  });

  test('50 lessons all in chronological order', () => {
    const meetings = [makeMeeting("d", 1), makeMeeting("d", 5)];
    const lessons = getNextLessons("d", parseDate("2026-03-23"), 50, tt, meetings);
    eq(lessons.length, 50);
    for (let i = 1; i < lessons.length; i++) {
      assert(lessons[i].date.getTime() > lessons[i - 1].date.getTime(), `Lesson ${i} not after ${i-1}`);
    }
  });

  test('Full term calendar (~10 weeks)', () => {
    const meetings = [makeMeeting("d", 2, 3)];
    const calendar = getLessonCalendar("d", parseDate("2026-03-23"), parseDate("2026-06-05"), tt, meetings);
    assert(calendar.length >= 5, `Expected >=5 lessons, got ${calendar.length}`);
    assert(calendar.length <= 8, `Expected <=8 lessons, got ${calendar.length}`);
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 17: Extreme Holiday Density');
// ═══════════════════════════════════════════════════════════════
{
  test('Week with 3 holidays — only 2 school days', () => {
    const tt = makeTimetable({
      cycle_length: 8,
      excluded_dates: ["2026-03-24", "2026-03-25", "2026-03-26"],
    });
    eq(getCycleDay(parseDate("2026-03-23"), tt), 1);
    eq(getCycleDay(parseDate("2026-03-27"), tt), 2);
    eq(getCycleDay(parseDate("2026-03-30"), tt), 3);
  });

  test('2 consecutive weeks of holidays', () => {
    const tt = makeTimetable({
      excluded_dates: [
        "2026-03-23","2026-03-24","2026-03-25","2026-03-26","2026-03-27",
        "2026-03-30","2026-03-31","2026-04-01","2026-04-02","2026-04-03",
      ],
    });
    // Anchor (Mar 23) is excluded but still the reference point for Day 1.
    // Apr 6 is 1 school day from anchor → Day 2. This is correct:
    // the cycle doesn't "restart" just because anchor was excluded.
    eq(getCycleDay(parseDate("2026-04-06"), tt), 2);
    // But with reset_each_term, a term starting Apr 6 WOULD be Day 1:
    const tt2 = makeTimetable({
      reset_each_term: true,
      excluded_dates: [
        "2026-03-23","2026-03-24","2026-03-25","2026-03-26","2026-03-27",
        "2026-03-30","2026-03-31","2026-04-01","2026-04-02","2026-04-03",
      ],
    });
    eq(getCycleDay(parseDate("2026-04-06"), tt2, { start: "2026-04-06", end: "2026-06-19" }), 1);
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 18: Partial iCal + Math Fallback');
// ═══════════════════════════════════════════════════════════════
{
  test('iCal covers week 1, math covers week 2', () => {
    const tt = makeTimetable({
      cycle_length: 8,
      cycle_day_events: [
        { date: "2026-03-23", cycleDay: 1 },
        { date: "2026-03-24", cycleDay: 2 },
        { date: "2026-03-25", cycleDay: 3 },
        { date: "2026-03-26", cycleDay: 4 },
        { date: "2026-03-27", cycleDay: 5 },
      ],
    });
    eq(getCycleDay(parseDate("2026-03-23"), tt), 1);
    eq(getCycleDay(parseDate("2026-03-27"), tt), 5);
    eq(getCycleDay(parseDate("2026-03-30"), tt), 6);
    eq(getCycleDay(parseDate("2026-04-01"), tt), 8);
    eq(getCycleDay(parseDate("2026-04-02"), tt), 1);
  });

  test('iCal disagrees with math — iCal wins', () => {
    const tt = makeTimetable({
      cycle_length: 6,
      cycle_day_events: [
        { date: "2026-03-25", cycleDay: 6 },
      ],
    });
    eq(getCycleDay(parseDate("2026-03-25"), tt), 6);
    eq(getCycleDay(parseDate("2026-03-24"), tt), 2);
    eq(getCycleDay(parseDate("2026-03-26"), tt), 4);
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 19: 2026-03-23 is Monday verification');
// ═══════════════════════════════════════════════════════════════
{
  test('2026-03-23 is indeed a Monday', () => {
    eq(getDayName(parseDate("2026-03-23")), "Monday");
  });

  test('parseDate → formatDate round-trip', () => {
    eq(formatDate(parseDate("2026-03-23")), "2026-03-23");
    eq(formatDate(parseDate("2026-12-31")), "2026-12-31");
    eq(formatDate(parseDate("2026-01-01")), "2026-01-01");
  });
}

// ═══════════════════════════════════════════════════════════════
console.log('\n📅 SCENARIO 20: Backward counting (dates before anchor)');
// ═══════════════════════════════════════════════════════════════
{
  test('countSchoolDaysBetween going backward is negative', () => {
    const count = countSchoolDaysBetween(parseDate("2026-03-27"), parseDate("2026-03-23"), "weekday", new Set());
    eq(count, -4);
  });

  test('8-day cycle backward from anchor', () => {
    const tt = makeTimetable({ cycle_length: 8, anchor_date: "2026-04-02", anchor_cycle_day: 1 });
    // Apr 2 = D1, Apr 1 = D8 (backward), Mar 31 = D7, Mar 30 = D6
    eq(getCycleDay(parseDate("2026-04-02"), tt), 1);
    eq(getCycleDay(parseDate("2026-04-01"), tt), 8);
    eq(getCycleDay(parseDate("2026-03-31"), tt), 7);
    eq(getCycleDay(parseDate("2026-03-30"), tt), 6);
    eq(getCycleDay(parseDate("2026-03-27"), tt), 5);
  });
}

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
console.log(`📊 RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (errors.length > 0) {
  console.log('\n❌ FAILURES:');
  for (const e of errors) {
    console.log(`  • ${e.name}: ${e.error}`);
  }
}
console.log('═'.repeat(50));
process.exit(failed > 0 ? 1 : 0);
