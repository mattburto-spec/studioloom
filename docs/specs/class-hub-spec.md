# Class Hub + Student Drawer — Spec

**Date:** 25 March 2026
**Status:** Ready for build
**Route:** `/teacher/units/[unitId]/class/[classId]`

## Problem

Teacher student-monitoring is scattered across 8+ screens. Checking on one student requires visiting Progress, Grading, NM Results, Safety Badges, Open Studio, and Pace Feedback — each on different pages. There's no unified view and no teacher-facing portfolio view at all.

## Solution

**One Class Hub page with inline tabs + a Student Drawer that opens from any student name.**

### Class Hub (inline tabs)

The existing route `/teacher/units/[unitId]/class/[classId]` becomes the central hub. Three tabs, all rendering content inline (no navigation to separate pages):

| Tab | Content | Source |
|-----|---------|--------|
| **Progress** | Student × page completion matrix, Open Studio status column, pace feedback summary | Currently at `/teacher/classes/[classId]/progress/[unitId]` (661 lines) |
| **Grade** | Criterion scoring (1-8), comments, strengths, targets, evidence viewer | Currently at `/teacher/classes/[classId]/grading/[unitId]` (1,339 lines) |
| **Settings** | Term picker, schedule, NM config, NM results, fork status | Currently inline on this page's Overview tab |

The old Progress and Grade routes stay alive as redirects (backward compat) but all new navigation goes to the hub.

### Student Drawer

A ~420px slide-out panel from the right edge. Opens when clicking any student name on Progress or Grade tabs. Shows:

1. **Header** — Name, avatar initial, class name
2. **Quick stats row** — Pages done (e.g. "7/12"), overall grade (if graded), Open Studio status badge
3. **Progress strip** — Horizontal dots per page, color-coded (gray=not started, amber=in progress, green=complete)
4. **Grades** — Criterion scores as colored pills (A: 6, B: 5, C: 7, D: 4) or "Not graded" placeholder
5. **NM snapshot** — Latest self-assessment + teacher observation ratings per element (if NM enabled)
6. **Safety badges** — Earned (green check) / Pending (amber) / Failed (red) per required badge
7. **Open Studio** — Status, session count, last activity timestamp, productivity score (if available)
8. **Recent work** — Last 3 responses with page title, timestamp, text preview (first 100 chars). Click to expand full response.
9. **Pace history** — Their individual pace feedback entries (if any)

The drawer is a shared component usable from Progress tab, Grade tab, and eventually Teaching Mode.

### Dashboard Cards

Dashboard cards become clickable — the whole card links to the Class Hub. The Teach button stays as a small icon overlay (it's a different workflow). The Edit button moves inside the hub (sidebar gear or tab).

**Card click** → `/teacher/units/[unitId]/class/[classId]`
**Teach icon** → `/teacher/teach/[unitId]?classId=[classId]`

## Component Architecture

```
ClassHub (page.tsx — thin wrapper)
├── ClassHubHeader (breadcrumb, class name, unit title, student count)
├── TabBar (Progress | Grade | Settings)
├── ProgressTab (extracted from progress page)
│   ├── Student × Page matrix
│   ├── OpenStudioUnlock per student
│   └── PaceFeedbackSummary
├── GradeTab (extracted from grading page)
│   ├── Criterion scoring grid
│   ├── Evidence viewer
│   └── IntegrityReport (when wired)
├── SettingsTab (existing Overview content)
│   ├── Term picker + schedule
│   ├── NMConfigPanel + NMResultsPanel
│   └── Fork status
└── StudentDrawer (slide-out, shared)
    ├── DrawerHeader
    ├── ProgressStrip
    ├── GradeSnapshot
    ├── NMSnapshot
    ├── SafetyBadges
    ├── OpenStudioStatus
    ├── RecentWork
    └── PaceHistory
```

## Build Plan

### Phase 1: Extract Progress + Grade into components (~2 hours)
- Extract progress page body into `src/components/teacher/class-hub/ProgressTab.tsx`
- Extract grading page body into `src/components/teacher/class-hub/GradeTab.tsx`
- Both receive `unitId`, `classId`, `students[]`, `pages[]` as props (loaded by parent)
- Keep existing pages as thin wrappers (backward compat)

### Phase 2: Class Hub with inline tabs (~1.5 hours)
- Rewrite `/teacher/units/[unitId]/class/[classId]/page.tsx`
- Single data load (unit, class, students, class_units config, NM config)
- Tab state in URL search param (`?tab=progress`)
- Pass shared data down to each tab component
- Default tab: Progress (the most common teacher task)

### Phase 3: Student Drawer (~2 hours)
- `src/components/teacher/class-hub/StudentDrawer.tsx`
- Accepts `studentId`, `unitId`, `classId`, `onClose`
- Fetches student-specific data on open (progress, grades, NM, badges, recent responses)
- Slide-in animation (CSS transform or Framer Motion)
- Click student name anywhere → opens drawer
- Click outside or X → closes

### Phase 4: Dashboard card update (~30 min)
- Card becomes `<Link>` to Class Hub
- Teach button becomes small icon button positioned top-right of card
- Remove separate Edit button (available inside hub)

### Phase 5: Student Drawer API (~1 hour)
- `GET /api/teacher/student-snapshot?studentId=X&unitId=Y&classId=Z`
- Returns: progress per page, grades, NM assessments, badge status, Open Studio status, last 5 responses, pace feedback
- Single endpoint, one query per table, returns combined snapshot

## Data Loading Strategy

**Hub level (loaded once on mount):**
- Unit data (title, content_data)
- Class data (name, code)
- Students list (id, display_name, username) via class_students junction
- Class-unit config (term_id, nm_config, schedule_overrides, content_data fork)
- Resolved pages list

**Tab level (loaded when tab activates):**
- Progress tab: student_progress rows for this unit
- Grade tab: assessment/grading rows for this unit
- Settings tab: terms, timetable (already loaded)

**Drawer level (loaded on open):**
- Student snapshot API call (all data for one student)

## Key Decisions

- **Progress is the default tab** — teachers check progress more than they grade
- **Drawer is read-only for MVP** — viewing, not editing. Grading stays in the Grade tab.
- **Old routes redirect, don't break** — `/teacher/classes/[classId]/progress/[unitId]` → redirects to hub with `?tab=progress`
- **Tab state in URL** — `?tab=grade` so teachers can bookmark or share links to specific tabs
- **Drawer remembers last student** — if you close and reopen, it remembers who you were looking at (session state, not persistent)

## Non-goals (this phase)

- Teacher-facing portfolio view (future — needs portfolio data structure first)
- Integrity report in drawer (needs MonitoredTextarea wiring first)
- Editing grades from the drawer (drawer is read-only snapshot)
- Cross-unit student view ("how is Sarah doing across ALL her units" — that's the Student Detail page)
