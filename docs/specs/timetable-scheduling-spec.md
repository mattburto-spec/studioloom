# Timetable & Scheduling System

**Author:** Matt Burton / Claude
**Date:** 22 March 2026
**Status:** Draft
**Extends:** School Calendar (migration 037), Unit-as-Template Architecture (migration 033)

---

## Problem Statement

StudioLoom knows *what* a teacher teaches (units assigned to classes) and *when* in the academic year (terms via school calendar), but has zero awareness of *which days and periods* classes actually meet. Without timetable awareness, StudioLoom cannot suggest due dates, calculate lesson pacing ("you have 8 lessons left this term"), show a teacher how their unit maps across real calendar dates, or help students understand when work is due. International schools overwhelmingly use rotating cycles (6-day, 8-day, 10-day) rather than fixed weekly schedules, which means a naive Monday-Friday model is useless. The 8-day cycle at NIS (and similar schools worldwide) means "Day 1 Period 4" could be any day of the week depending on cycle rotation.

Meanwhile, the obvious data source — the school's LMS/SIS (ManageBac, PowerSchool, Toddle) — contains student PII that cannot leave China under PIPL regulations. StudioLoom must get scheduling intelligence without importing student identity data.

## Goals

1. **Teachers can define their timetable** — cycle length, which cycle days each class meets, period times — in under 3 minutes via a setup wizard in Teacher Settings
2. **StudioLoom can calculate future lesson dates** — given today's cycle day, compute the next N lesson dates for any class, accounting for holidays and non-school days
3. **Due dates and pacing become intelligent** — unit assignment shows "12 lessons available this term" and suggests due dates aligned to actual class meeting days
4. **iCal import as upgrade path** — teachers who use ManageBac, PowerSchool, Toddle, Veracross, or KAMAR can paste a timetable feed URL to auto-populate their schedule instead of manual entry
5. **Zero student PII crosses borders** — timetable data (cycle days, periods, room numbers) is institutional logistics, not personal data. The system never imports student rosters.

## Non-Goals

- **School-admin-level timetable management** — StudioLoom serves individual teachers, not school IT departments. Each teacher sets up their own timetable. A school-wide deployment would need an admin layer, but that's a "when you have paying schools" problem.
- **Automatic LMS roster sync** — importing student names/IDs from ManageBac or PowerSchool would violate PIPL for China-based schools. Students continue using anonymous class code + display name auth. Out of scope permanently for China deployment; revisit for non-China schools later.
- **Bell schedule / period time enforcement** — we store period start/end times for display purposes, but StudioLoom does not enforce or alert on bell times. It's not a bell schedule app.
- **Substitute teacher / cover scheduling** — timetable changes due to teacher absence are not tracked. The teacher can mark individual days as exceptions.
- **Room booking or resource allocation** — room numbers are metadata for display, not a booking system.

## User Stories

### Teacher (timetable setup)

- As a Design teacher, I want to define my school's cycle length (e.g., 8 days) and mark which cycle days my classes meet, so that StudioLoom knows my actual teaching schedule.
- As a teacher at a school with rotating cycles, I want to set today's cycle day as an anchor point, so that the system can calculate which cycle day falls on which calendar date going forward.
- As a teacher, I want to mark holidays, professional development days, and other non-school days, so that the cycle calculation skips them correctly.
- As a teacher, I want to import my timetable from an iCal feed (ManageBac, PowerSchool, etc.) instead of entering it manually, so that setup takes seconds instead of minutes.
- As a teacher with 4 Design classes, I want to see all my class meetings on a single week/cycle view, so that I can verify the schedule looks right before saving.

### Teacher (using schedule data)

- As a teacher assigning a unit to a class for Term 2, I want to see "this class meets 14 times in Term 2" automatically calculated, so that I know how many lessons I have to work with.
- As a teacher, I want suggested due dates for unit milestones that fall on actual class meeting days (not weekends or non-meeting days), so that deadlines make sense to students.
- As a teacher looking at my unit detail page, I want a timeline showing which lesson falls on which real date, so that I can plan around field trips, assemblies, and holidays.
- As a teacher in Teaching Mode, I want to see "next class: Wednesday (Day 6, Period 2)" so that I can tell students when they'll continue.

### Student (consuming schedule data)

- As a student, I want to see "Due: Day 6 (Wednesday March 25)" on my assignments, so that I know exactly when something is due relative to both the cycle and the calendar.
- As a student, I want my dashboard to show "Next Design class: Day 2, Period 4 — Tuesday" so that I know when I'll next work on this.

## Requirements

### Must-Have (P0) — Tier 2: Manual Timetable Input

These form the core timetable engine. Ship this first.

#### P0.1 — Timetable data model

The `school_timetable` table stores per-teacher schedule configuration.

```sql
school_timetable (
  id UUID PK,
  teacher_id UUID FK → auth.users,

  -- Cycle configuration
  cycle_length INT NOT NULL DEFAULT 5,          -- 5, 6, 7, 8, 10
  cycle_type TEXT NOT NULL DEFAULT 'weekday',   -- 'weekday' (skip weekends), 'calendar' (continuous)
  anchor_date DATE NOT NULL,                    -- reference date for cycle calculation
  anchor_cycle_day INT NOT NULL,                -- which cycle day anchor_date is (1-based)

  -- Period definitions (optional — for display)
  periods JSONB DEFAULT '[]',                   -- [{ number: 1, label: "Period 1", start: "08:30", end: "09:30" }, ...]

  -- Non-school days (holidays, PD days, etc.)
  excluded_dates JSONB DEFAULT '[]',            -- ["2026-04-05", "2026-04-06", ...]

  -- Metadata
  source TEXT DEFAULT 'manual',                 -- 'manual' | 'ical'
  ical_url TEXT,                                -- for Tier 1: iCal feed URL
  last_synced_at TIMESTAMPTZ,                   -- for Tier 1: last iCal sync

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(teacher_id)                            -- one timetable per teacher
)
```

The `class_meetings` table stores when each class meets within the cycle.

```sql
class_meetings (
  id UUID PK,
  timetable_id UUID FK → school_timetable,
  class_id TEXT NOT NULL,                       -- FK to classes table
  cycle_day INT NOT NULL,                       -- 1-based (Day 1, Day 2, etc.)
  period_number INT,                            -- which period (optional)
  room TEXT,                                    -- room name/number (optional)

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(timetable_id, class_id, cycle_day, period_number)
)
```

**Acceptance criteria:**
- [ ] Migration creates both tables with RLS policies (teacher sees own data only)
- [ ] Service role bypass policy for admin operations
- [ ] Indexes on `teacher_id`, `timetable_id + class_id`
- [ ] `cycle_length` constrained to [2, 20] range
- [ ] `anchor_cycle_day` constrained to [1, cycle_length]
- [ ] `excluded_dates` validated as ISO date strings on write

#### P0.2 — Cycle day calculation engine

A pure TypeScript utility module (`src/lib/scheduling/cycle-engine.ts`) that computes cycle days from the timetable data.

Core functions:

```typescript
// Given a calendar date, return which cycle day it is (or null if excluded)
getCycleDay(date: Date, timetable: SchoolTimetable): number | null

// Given a class, return the next N lesson dates from a start date
getNextLessons(classId: string, fromDate: Date, count: number,
               timetable: SchoolTimetable, meetings: ClassMeeting[]): LessonDate[]

// Given a class and a date range (term), return total meeting count
countLessonsInRange(classId: string, startDate: Date, endDate: Date,
                    timetable: SchoolTimetable, meetings: ClassMeeting[]): number

// Given a class and term, return all lesson dates mapped to sequence numbers
getLessonCalendar(classId: string, termStart: Date, termEnd: Date,
                  timetable: SchoolTimetable, meetings: ClassMeeting[]): LessonDate[]
```

The `LessonDate` type:

```typescript
interface LessonDate {
  date: Date;
  cycleDay: number;
  periodNumber?: number;
  room?: string;
  lessonSequence: number;  // 1st lesson, 2nd lesson, etc. within the range
}
```

**Acceptance criteria:**
- [ ] `getCycleDay` correctly handles weekday-skip cycles (Mon-Fri only, cycle continues Monday)
- [ ] `getCycleDay` returns `null` for excluded dates (holidays)
- [ ] `getCycleDay` returns `null` for weekends when `cycle_type === 'weekday'`
- [ ] `getNextLessons` skips excluded dates and non-meeting cycle days
- [ ] `countLessonsInRange` matches manual count for a real 8-day cycle scenario
- [ ] Edge case: anchor_date in the past works (calculate forward and backward)
- [ ] Edge case: anchor_date on a holiday/weekend handled gracefully
- [ ] Unit tests: minimum 15 test cases covering 5/6/8/10-day cycles, holidays, weekends, edge cases

#### P0.3 — Timetable setup wizard (Teacher Settings)

Extends the existing "School & Teaching" tab in Teacher Settings. Appears below or integrated with SchoolCalendarSetup.

**Step 1: Cycle configuration**
- Cycle length selector: common presets (5-day/Mon-Fri, 6-day, 8-day, 10-day) + custom number input
- Cycle type: "Weekdays only" (skip Sat/Sun) or "All calendar days" — default weekdays, which covers 95%+ of schools
- Anchor: date picker for "What is today's cycle day?" + number selector (1 through cycle_length)

**Step 2: Class schedule**
- Shows a grid/table: rows = teacher's classes (fetched from DB), columns = cycle days (Day 1 through Day N)
- Teacher checks which cycle days each class meets
- Optional: period number dropdown per meeting, room text field
- For a teacher with 4 classes and an 8-day cycle, this is a 4×8 grid — ~32 cells, but most will be empty. Average teacher checks 8-12 cells.

**Step 3: Period times (optional)**
- List of periods with start/end time inputs
- Quick templates: "8-period day", "6-period day", "Custom"
- This step is skippable — periods are for display only

**Step 4: Holidays and exceptions**
- Date picker for adding excluded dates
- Import from iCal (Tier 1 upgrade) or manual entry
- Common patterns: "Add school holidays" with country/region presets would be nice-to-have
- Shows a mini-calendar with excluded dates highlighted

**Step 5: Verification**
- Shows a 2-week preview calendar with all class meetings plotted
- Teacher verifies "does this look right?"
- Edit button loops back to relevant step
- Save button persists to database

**Acceptance criteria:**
- [ ] Wizard completes in under 3 minutes for a teacher with 4 classes on an 8-day cycle
- [ ] Cycle length selector works for 2-20 day ranges
- [ ] Class grid correctly loads teacher's classes from existing `classes` table
- [ ] Anchor date defaults to today with a reasonable cycle day guess
- [ ] Verification preview accurately renders 2 weeks of meetings
- [ ] Save persists to `school_timetable` + `class_meetings` tables
- [ ] Editing an existing timetable loads saved data
- [ ] Works on mobile (responsive — grid scrolls horizontally if needed)

#### P0.4 — Lesson count on class-unit assignment

When a teacher views a class-unit settings page (`/teacher/units/[unitId]/class/[classId]`), if term dates are set AND timetable exists, show:

> **12 lessons** in Term 2 (April 8 – June 20)
> Next class: **Tuesday March 25** (Day 2, Period 4)

**Acceptance criteria:**
- [ ] Lesson count calculated via `countLessonsInRange()` using term start/end dates
- [ ] "Next class" calculated via `getNextLessons(classId, today, 1)`
- [ ] Graceful fallback when timetable not configured: show "Set up your timetable in Settings to see lesson counts"
- [ ] Graceful fallback when term dates not set: show "Add term dates to see lesson counts"
- [ ] Updates dynamically if teacher changes timetable or term dates

#### P0.5 — API endpoint for schedule data

`GET /api/teacher/timetable` — returns timetable + class meetings for authenticated teacher.

`POST /api/teacher/timetable` — upserts timetable config + class meetings (replaces existing).

`GET /api/teacher/schedule/lessons?classId=X&from=YYYY-MM-DD&count=N` — returns next N lesson dates for a class. Used by UI components that need lesson dates without loading full timetable client-side.

`GET /api/student/next-class?unitId=X` — returns next class date for the student's class. Uses student token auth. Looks up student → class → class_meetings → timetable → compute.

**Acceptance criteria:**
- [ ] Teacher routes use `requireTeacherAuth`
- [ ] Student route uses `requireStudentAuth`
- [ ] Student route never exposes timetable internals (just the computed next date)
- [ ] All routes use `createAdminClient` for DB operations (bypass RLS)
- [ ] Rate limited: 30/min for student route

### Nice-to-Have (P1) — Tier 1: iCal Import

Ship after manual timetable is stable. This is the "make it effortless" upgrade.

#### P1.1 — iCal feed parser

A server-side utility (`src/lib/scheduling/ical-parser.ts`) that:

1. Fetches an iCal URL (teacher provides from ManageBac/PowerSchool/etc.)
2. Parses `VEVENT` entries to extract recurring class meetings
3. Infers cycle pattern from the recurrence data
4. Maps events to `class_meetings` format

**Supported LMS feeds:**
- ManageBac (IB schools — most common for StudioLoom's audience)
- PowerSchool
- Toddle
- Veracross
- KAMAR (NZ schools)
- Google Calendar (fallback)
- Any standard RFC 5545 iCal feed

**Acceptance criteria:**
- [ ] Parses standard iCal `VEVENT` with `RRULE`, `EXDATE`, `DTSTART`, `DTEND`
- [ ] Extracts event summary → class name mapping (teacher confirms matches)
- [ ] Detects cycle length from pattern analysis (if events don't follow a simple weekly recurrence)
- [ ] Handles timezone-aware dates (China Standard Time, Australian Eastern, etc.)
- [ ] Graceful failure: if feed is unreadable, show clear error and offer manual fallback
- [ ] Never fetches student roster endpoints (even if the feed URL could be modified to access them)
- [ ] PIPL-safe: only fetches schedule data from the URL, never follows links to student data

#### P1.2 — iCal import UI

Added to Timetable Setup Wizard Step 1 as an alternative to manual entry:

- "Import from calendar feed" button
- Text input for iCal URL
- "Where do I find this?" expandable help with screenshots for ManageBac, PowerSchool, Toddle
- Preview parsed results before saving
- Teacher confirms class name → StudioLoom class mapping
- Periodic re-sync option (daily/weekly) to catch holiday updates

**Acceptance criteria:**
- [ ] Teacher can paste ManageBac timetable feed URL and see parsed schedule within 5 seconds
- [ ] Teacher maps imported class names to existing StudioLoom classes
- [ ] Unmatched classes shown but not imported (teacher can create new classes if needed)
- [ ] Manual edits after import are preserved (import doesn't overwrite manual changes unless teacher explicitly re-syncs)
- [ ] Help text includes screenshots for top 3 LMS platforms (ManageBac, PowerSchool, Toddle)

#### P1.3 — Holiday import from iCal

Parse `VEVENT` entries with no class association (whole-day events, school closures) as excluded dates. Auto-populate the holidays list from the iCal feed.

**Acceptance criteria:**
- [ ] Whole-day events detected and added to `excluded_dates`
- [ ] Teacher can review and deselect false positives before saving
- [ ] Multi-day events (e.g., "Spring Break April 5-12") correctly expand to individual dates

### Future Considerations (P2)

#### P2.1 — Lesson-to-date mapping on unit builder

When generating a unit, the AI knows "this class has 14 lessons in Term 2" and can pace content accordingly. The timing engine already has `usableTime` — adding lesson count gives it the full picture.

#### P2.2 — Student-facing due dates

Student dashboard shows "Due: Wednesday March 25 (Day 6)" on assignments. Requires wiring due dates from teacher → student view through the existing unit page system.

#### P2.3 — Pacing alerts

"You've used 8 of 14 lessons but only covered 40% of the unit — consider adjusting pace." Requires tracking lesson delivery (which lessons have been taught) against the schedule.

#### P2.4 — LTI schedule context

For schools using LTI integration, the LTI launch payload can carry `resource_link` and `context` claims that include schedule information. This would allow automatic timetable population without a separate iCal import step.

#### P2.5 — Cross-teacher schedule visibility

For future multi-teacher scenarios (team teaching, department coordination), teachers could share anonymized schedule data to coordinate unit timing. No student PII involved — just "Class 9A meets Day 2 and Day 6."

## Technical Considerations

### PIPL Compliance (Critical)

The entire design separates **schedule data** (non-PII) from **student identity data** (PII):

| Data Type | PII? | Storage | Cross-Border OK? |
|-----------|------|---------|-------------------|
| Cycle length, period times | No | Supabase (Vercel) | Yes |
| Class meeting days/periods | No | Supabase (Vercel) | Yes |
| Holiday dates | No | Supabase (Vercel) | Yes |
| iCal feed URL | No* | Supabase (Vercel) | Yes |
| Student names/IDs | **Yes** | Never imported | N/A |
| Class roster | **Yes** | Never imported | N/A |

*iCal URL may contain a teacher's personal calendar token — treat as sensitive credential, store encrypted.

**Rule: The timetable system NEVER imports, stores, or processes student identity data.** Students are identified only by their anonymous class code + display name, as per existing auth architecture.

### Relationship to Existing Schema

```
school_calendar_terms (migration 037 — terms/semesters)
    ↕ term dates provide date range
school_timetable (NEW — cycle config)
    ↕ timetable provides cycle days
class_meetings (NEW — when classes meet)
    ↕ meetings + term dates = lesson dates
class_units (migration 033 — unit assignment + term_id)
    ↕ unit + class + term + lessons = full picture
```

The cycle engine combines term dates (from `school_calendar_terms`) with meeting patterns (from `class_meetings`) to compute actual lesson dates. Neither table alone is sufficient.

### Cycle Day Calculation Algorithm

```
function getCycleDay(targetDate, timetable):
  if targetDate is weekend AND cycle_type === 'weekday': return null
  if targetDate in excluded_dates: return null

  // Count school days between anchor and target
  schoolDays = countSchoolDaysBetween(anchor_date, targetDate,
                                       excluded_dates, cycle_type)

  // Apply modular arithmetic
  offset = schoolDays % cycle_length
  cycleDay = ((anchor_cycle_day - 1 + offset) % cycle_length) + 1

  return cycleDay
```

Key: `countSchoolDaysBetween` must handle both forward (target > anchor) and backward (target < anchor) directions, and must exclude weekends (for weekday cycles) and excluded dates.

### Migration Strategy

New migration 038 creates both tables. Additive only — no changes to existing tables. The `class_meetings.class_id` references the existing `classes` table but as TEXT (not UUID FK) to match StudioLoom's class ID format.

### Performance

- Cycle day calculation is O(N) where N = days between anchor and target. For a single term (~90 days), this is trivial.
- `getNextLessons` iterates forward day-by-day. For "next 20 lessons" on an 8-day cycle with 2 meetings/cycle, worst case is ~80 day iterations. Sub-millisecond.
- No caching needed for MVP. If lesson calendar is called frequently, memoize per request.

## Open Questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Should `school_timetable` support multiple timetables per teacher (e.g., Semester 1 has different schedule than Semester 2)? Current design: one timetable per teacher. Some schools change timetables mid-year. | Matt (product) | Non-blocking for v1 — can handle with "edit and re-anchor" |
| 2 | How should the system handle cycle day resets? Some schools reset the cycle at the start of each term (Term 2 always starts on Day 1). Others continue the count across terms. | Matt (product) | Non-blocking — the anchor model handles both (teacher re-anchors at term start if needed) |
| 3 | iCal feed URL may contain auth tokens (ManageBac uses signed URLs). Should we encrypt these at rest? The `BYOK_ENCRYPTION_KEY` pattern already exists for API keys. | Engineering | Non-blocking for Tier 2, blocking for Tier 1 |
| 4 | Should period times be per-cycle-day or global? Some schools have different bell schedules on different days (e.g., late start Wednesday). | Matt (product) | Non-blocking — start with global periods, add per-day override later |
| 5 | ManageBac iCal feed format: need to test with a real NIS feed to confirm parsing works. Matt can provide a URL. | Matt (testing) | Blocking for Tier 1 only |

## Timeline & Phasing

### Phase 1: Core Engine (~3-4 days)
- Migration 038 (both tables)
- Cycle day calculation engine + unit tests (15+ tests)
- Timetable CRUD API routes
- Student next-class API route

### Phase 2: Teacher Setup UI (~2-3 days)
- Timetable wizard (5 steps) in Teacher Settings
- Class schedule grid component
- Verification preview (2-week calendar)
- Wire to existing class-unit settings page (lesson count display)

### Phase 3: iCal Import (~2-3 days)
- iCal parser module (RFC 5545)
- ManageBac + PowerSchool + Toddle feed testing
- Import UI with class name mapping
- Holiday auto-detection from feed

### Phase 4: Schedule-Aware Features (~2-3 days)
- "Next class" on student dashboard
- Lesson timeline on unit detail page
- Due date suggestions on unit assignment
- "N lessons remaining" on Teaching Mode

**Total: ~9-13 days across 4 phases**

Hard dependency: Migration 037 (school calendar) must be applied first — the timetable system references term dates.

## Success Metrics

### Leading (within 2 weeks of launch)
- **Setup completion rate:** >80% of teachers who start the wizard finish it (target: <3 min)
- **Lesson count accuracy:** manual verification against 3 real school timetables (NIS 8-day + 2 others) — 100% match required
- **iCal import success rate** (Tier 1): >90% of ManageBac feeds parse correctly on first attempt

### Lagging (within 2 months)
- **Due date usage:** >50% of unit assignments have schedule-informed due dates (vs. manual/no due date)
- **Teacher satisfaction:** qualitative feedback — "the schedule stuff just works" is the target sentiment
- **Reduced lesson planning friction:** teachers spend less time manually counting "how many lessons do I have left" — measured via session time on unit assignment page (should decrease)
