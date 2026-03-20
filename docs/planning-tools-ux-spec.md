# StudioLoom Planning Tools UX Specification

**Document Version:** 1.0
**Date:** March 2026
**Status:** Research & Specification (no code changes)
**Target Users:** MYP Design students ages 11-18
**Platforms:** Web (responsive) + Mobile (375px+)

---

## Executive Summary

This specification outlines a comprehensive overhaul of StudioLoom's planning tools to deliver world-class task management for student design projects. The current implementation consists of two separate components (GanttPanel and PlanningPanel) with generic workflows. The upgrade replaces generic "to-do/doing/done" columns with **design cycle-aware kanban boards**, introduces a **unified data model** powering three complementary views (Kanban, Gantt, Checklist), and applies **speed-first interaction patterns** from Linear, **multi-view data architecture** from Notion, and **visual feedback** from Monday.com.

**Key differentiator:** Columns ARE the MYP design cycle phases (Inquiring & Analysing → Developing Ideas → Creating the Solution → Evaluating), not a generic workflow. No other PM tool does this.

---

## 1. Current State Assessment

### 1.1 Existing Components

**GanttPanel.tsx** (`src/components/planning/GanttPanel.tsx`):
- Read-only Gantt chart with weekly columns, task bars, milestone markers
- Quick date entry inline below rows
- Task creation at bottom with title + page dropdown + start/end dates
- Status dots (todo/in_progress/done) with page badges
- Auto-scrolls to "today" line on open
- **Strengths**: Clean visual representation, good use of colour
- **Weaknesses**: No keyboard interaction, status hidden in sidebar, no easy date drag-to-reschedule, no multi-edit

**PlanningPanel.tsx** (`src/components/planning/PlanningPanel.tsx`):
- Dual view: Kanban board + List view toggle
- Generic columns: "To Do", "In Progress", "Done" (not design cycle phases)
- Drag-and-drop between columns
- Task creation at top, delete on hover
- **Strengths**: Lightweight, drag works
- **Weaknesses**: Generic phases don't align with MYP, no date visibility, no time-logging, no effort estimates

**API** (`src/app/api/student/planning/route.ts`):
- GET: fetch tasks for unit
- POST: create task
- PATCH: update task (status, title, dates)
- DELETE: remove task
- **Strengths**: Simple CRUD
- **Weaknesses**: No batch operations, no time-logging endpoint, no AI-suggested next steps

### 1.2 Database Schema (assumed from code)

```
planning_tasks:
  id, student_id, unit_id, title
  status: enum(todo, in_progress, done)
  page_id (nullable), page_number (legacy)
  start_date (nullable), target_date (nullable)
  time_logged (minutes)
  sort_order, created_at, updated_at
```

**Gaps:**
- No `description`, `effort_estimate`, `actual_time`, `priority`, `assignee`, `response_id`, `attachments`
- No `design_phase` field — phases inferred from page_id, not explicit
- No `recurrence` or `subtasks`
- No `ai_suggestions` or `last_activity_at`

### 1.3 Pedagogy Alignment

The MYP Design Cycle has 4 explicit phases:
1. **Inquiring & Analysing** (A criterion) — Research, analysis, defining the problem
2. **Developing Ideas** (B criterion) — Ideation, concepts, design decisions
3. **Creating the Solution** (C criterion) — Prototyping, making, testing
4. **Evaluating** (D criterion) — Testing, feedback, refinement, reflection

The current kanban columns (To Do / In Progress / Done) are generic workflow states with no pedagogical meaning. A task titled "Research users" currently just lives in "To Do" with no signal that it's part of the Inquiring phase.

---

## 2. Competitive Analysis: Best-in-Class Patterns

### 2.1 Linear — Speed & Minimalism

**What Linear does exceptionally well:**
- **Single-click status transitions**: Click a task's status badge → dropdown appears → click status → immediate update, no confirm dialogs
- **Keyboard-driven**: `Cmd/Ctrl + K` to create task, Tab through fields, arrow keys move between tasks, `Shift + Click` for multi-select
- **Minimal chrome**: Nearly all UI hidden until needed (hover to reveal icons, actions appear on selection)
- **Cycle/Sprint view**: Tasks grouped by release/sprint with visual time remaining
- **Comment threads**: Discussions live on tasks, not separate
- **Instant feedback**: optimistic UI updates before API responds (Vercel-grade latency makes this feel instant)

**Applicable to student PM:**
- One-tap status changes from "Researching" → "Research Complete" without modals
- Keyboard shortcuts for add, complete, move — helps touch-averse teens work faster
- Hidden complexity until student is ready for it
- Comments on tasks for peer feedback (already designed in roadmap as Structured Peer Feedback)

### 2.2 Notion — Multiple Views on Same Data

**What Notion does exceptionally well:**
- **Database-as-views pattern**: The same data (pages in Notion's case, tasks in ours) rendered as table, board, timeline, calendar, gallery
- **Rich properties**: Each item has type-specific metadata (text, date, select, person, number, checkbox, etc.)
- **View configuration persists per user**: I see Kanban by default, my co-teacher sees Timeline
- **Filter/sort/group in every view**: Same filtering logic applies across all views
- **Quick-add**: Inline creation in any view without leaving the view
- **Smooth transitions**: Drag a card in Kanban and watch it disappear from one column and appear in another instantly

**Applicable to student PM:**
- Same task data shown as Kanban (design phases), Gantt (timeline), Checklist (completion tracking), Calendar (due dates)
- Each view optimized for different workflows: Kanban for daily standups, Gantt for timeline planning, Checklist for teacher review
- Student picks their default view; can switch anytime
- Filters persist: show only "Researching" tasks, or only "past due", or only "linked to B criterion"
- Drag a task's target_date in Gantt view and the change syncs to Kanban

### 2.3 Monday.com — Visual Progress & Onboarding

**What Monday.com does exceptionally well:**
- **Colour-coded columns**: Red (blocker), Amber (at risk), Green (on track). Glance at board and see team health instantly
- **Onboarding flow**: First time users see a tour showing empty board → add first item → see board populate → edit item → complete item. Each step teaches a pattern
- **Visual fill**: Progress bars that grow as tasks complete, not numeric percentages. Much more satisfying
- **Automations UI**: "When status changes to X, move to Y" without code
- **Mobile app parity**: Desktop and mobile have feature parity, not desktop-first dumbed down to mobile

**Applicable to student PM:**
- Design phase columns colour-coded by phase: Blue (Inquiring) → Purple (Developing) → Orange (Creating) → Green (Evaluating)
- First-time student sees guided setup: create first task → link to unit page → set target date → see task appear in Gantt → mark complete
- Visual phase progress (not %) shows "you're 60% through Developing Ideas"
- Touch-optimized for phone/tablet use in class (students not at desks)

### 2.4 Todoist — Natural Language & Priority

**What Todoist does exceptionally well:**
- **Natural language input**: "Finish prototype tomorrow at 2pm" → parsed into title + due_date + time
- **Priority levels**: Flags with visual heat (red, orange, yellow, grey) to show urgency
- **Recurrence**: "Every week" built-in for recurring tasks
- **Recurring habits**: Students could have recurring design cycle tasks per unit

**Applicable to student PM:**
- "Finish research by Friday" → parsed, no need for separate date picker
- Priority flags for urgent tasks (teacher-assigned deadlines)
- Recurrence for standing tasks ("Weekly design circle" on Mondays)

### 2.5 Things 3 — Hierarchy & Clarity

**What Things 3 does exceptionally well:**
- **Projects > Areas hierarchy**: Your work is organized by scope, not just one flat list
- **Today view**: Intelligent filtering showing what matters today (due soon, flagged, assigned to you)
- **Suggested timings**: "This will take ~20 min, good for a coffee break"
- **Gorgeous interactions**: Animations feel earned, not gratuitous
- **Tag system**: Cross-cutting categories that aren't strict hierarchies

**Applicable to student PM:**
- Units (Things' "Areas") contain Tasks → Subtasks (design phase steps)
- "This Week" view showing design tasks due before Friday
- Time estimates ("Research: ~45 min", "Prototype: ~3 hours") help students time-box
- Tags for cross-unit themes (e.g., #usability, #sustainability)

---

## 3. Recommended Design: Unified Planning Toolkit

### 3.1 Core Philosophy

**Principle 1: Design Phase Columns Are Sacred**
The kanban board's columns ARE the design cycle, not a generic workflow. This is the core differentiator.

**Principle 2: One Data Model, Three Views**
A task exists once. It has a phase, dates, effort, completion state. Three views (Kanban, Gantt, Checklist) all query the same data and stay in sync.

**Principle 3: Speed First**
No confirm dialogs, no modals for simple actions. Click → done. Keyboard shortcuts for power users. Mobile-touch optimized for stylus input on iPad.

**Principle 4: Pedagogically Transparent**
Every feature maps to MYP criteria or design cycle. Task views optionally show "which criterion does this serve?" and "what evidence will complete it?"

---

## 4. Detailed Specifications

### 4.1 Unified Task Data Model

**Required fields:**

```typescript
interface PlanningTask {
  // Identification
  id: string;
  unit_id: string;
  student_id: string;

  // Core task content
  title: string;                           // "Research user needs"
  description: string;                     // Optional longer context

  // Design cycle alignment
  design_phase: 'inquiring' | 'developing' | 'creating' | 'evaluating';
  page_id: string | null;                  // Links to unit page (A1, B2, etc.)
  criterion_id: string | null;             // Explicit criterion tie-in (e.g., "A1", "B2")

  // Workflow state
  status: 'not_started' | 'in_progress' | 'blocked' | 'on_hold' | 'completed';
  // Note: richer than todo/in_progress/done to support "blocked" (waiting for feedback)

  // Timing
  start_date: string | null;               // YYYY-MM-DD format (when student started)
  target_date: string | null;              // YYYY-MM-DD format (when it should be done)
  completed_date: string | null;           // Auto-set when status = completed

  // Effort & time tracking
  effort_estimate: number | null;          // In minutes (e.g., 45, 180)
  time_logged: number;                     // In minutes (sum of work sessions)
  time_remaining: number | null;           // Calculated: effort_estimate - time_logged

  // Priority & urgency
  priority: 'low' | 'normal' | 'high' | 'urgent';
  days_until_due: number;                  // Calculated from target_date
  is_overdue: boolean;                     // Calculated

  // Teacher assignment (for assigned tasks)
  assigned_by_teacher: boolean;
  teacher_id: string | null;

  // Response linking (task → student work)
  response_ids: string[];                  // Links to submissions, uploads
  evidence_type: 'text' | 'upload' | 'photo' | 'video' | 'link' | 'multiple';

  // AI suggestions
  ai_suggested_next_steps: string[];
  ai_suggested_criteria: string[];

  // Metadata
  sort_order: number;                      // For custom ordering
  recurrence: 'once' | 'daily' | 'weekly' | null;  // Recurring tasks
  subtasks: SubtaskItem[];
  tags: string[];

  // Tracking
  created_at: timestamp;
  updated_at: timestamp;
  last_activity_at: timestamp;             // Last status/date change

  // Soft deletes
  deleted_at: timestamp | null;
}

interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
  completed_at: timestamp | null;
}
```

**Derived/UI-only fields (calculated on client):**
- `completion_percent` = time_logged / effort_estimate (0-100)
- `daysToDeadline` = (target_date - today)
- `phaseColor` = {'inquiring': '#3B82F6', 'developing': '#A855F7', 'creating': '#F97316', 'evaluating': '#10B981'}
- `statusLabel` = human readable label per language
- `urgency` = calculated from days_until_due + priority

---

### 4.2 View 1: Design Phase Kanban Board (Primary View)

**Layout:**
- 4 columns representing design phases (NOT todo/in_progress/done):
  1. **Inquiring & Analysing** (Blue #3B82F6) — research, analysis, problem definition
  2. **Developing Ideas** (Purple #A855F7) — ideation, concepts, decision-making
  3. **Creating the Solution** (Orange #F97316) — prototyping, making, testing
  4. **Evaluating** (Green #10B981) — reflection, feedback, refinement

**Column header:**
```
[Phase icon] Phase Name           [count badge: 5 tasks]  [collapsed/expanded toggle]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Column body:**
- Cards sorted by priority (urgent → high → normal → low) then by target_date (nearest first)
- Scrollable vertically if >8 tasks
- Add button at bottom: "+ Add task"

**Task Card:**

```
┌─────────────────────────────────────────────┐
│ [Priority dot]  [Title]             [Time]  │
│ Research user needs                 45 min  │
│                                             │
│ [Page badge] [Criterion badge] [4 days]    │
│ A1           B (Developing)   Due Fri       │
│                                             │
│ [Progress bar: 30/45 min logged]            │
│                                             │
│ [Linked response: 1 upload] [Delete ✕]     │
└─────────────────────────────────────────────┘
```

**Card contents (in order):**
1. **Header row**: [Priority indicator] | Title | Time estimate (right-aligned)
2. **Metadata row**: Page ID badge + Criterion badge + relative due date ("Due Fri", "3 days ago")
3. **Progress bar** (if effort_estimate set): visual progress, shows time_logged/estimate
4. **Footer row**: Evidence count + delete button (visible on hover)

**Interactions:**

| Action | Method | Behavior |
|--------|--------|----------|
| Move to next phase | **Drag card right** | Card animates to adjacent column, status updates instantly |
| | **Right arrow key** | If card selected, move to next column |
| | | If last column (Evaluating), stays |
| Complete task | **Click status dot** | Status cycles: not_started → in_progress → completed |
| | | Completed tasks fade slightly, stay visible (not hidden) |
| | **Keyboard: Space** | If card selected, toggle in_progress/completed |
| View details | **Click card title or anywhere except drag area** | Opens detail modal (see 4.5) |
| Delete | **Hover → click ✕** | Delete button appears on hover + keyboard Cmd/Del when card selected |
| | **Keyboard: Backspace** | If card selected, confirm dialog then delete |
| Multi-select | **Shift+Click** | Select multiple cards, reveals batch actions: move, delete, link to response |
| | **Cmd/Ctrl+Click** | Add to selection |
| Reorder within column | **Drag vertically** | Change sort_order, persists |
| Edit title | **Double-click title** | Becomes editable inline, blur to save |
| Add subtask | **Click card, then Cmd/Ctrl+Shift+N** | Inline subtask adder appears |

**Keyboard shortcuts (when card is focused):**
- `E` → Edit (open modal)
- `D` → Mark Done (cycle status to completed)
- `Arrow Right` → Move to next phase
- `Arrow Left` → Move to previous phase
- `Arrow Down/Up` → Focus next/previous card in column
- `Backspace` → Delete
- `C` → Create comment/evidence link
- `P` → Change priority
- `1-4` → Jump to phase column 1-4

**Mobile (375px):**
- Columns shown as horizontal scrollable tabs: ["Inquiring", "Developing", "Creating", "Evaluating"]
- Currently visible column takes full width
- Swipe left/right to switch columns
- Cards shown as tall, full-width strips (easier to tap)
- Drag to bottom of column to "move to next phase"

**Empty column state:**
```
┌─────────────────────────────────────┐
│   No tasks in Developing Ideas yet  │
│                                     │
│     Waiting for ideas to develop?   │
│     [+ Add task] or drag from left  │
└─────────────────────────────────────┘
```

**Colour coding:**
- Column headers: phase colour (blue/purple/orange/green)
- Task cards: white background with left border matching phase colour
- Page badges: background colour specific to page (A1=light pink, A2=light blue, etc.)
- Criterion badges: IB criterion colour
- Priority dot: red (urgent), orange (high), yellow (normal), grey (low)
- Progress bar: gradient from amber (started) → green (complete)

---

### 4.3 View 2: Gantt Timeline (Secondary View)

**Use case:** Student planning time across the unit. "When should I research vs. prototype?" Teacher sees how the class is pacing through phases.

**Layout:**
- Left sidebar: Task list (compact, sortable)
- Main canvas: Weekly timeline with task bars, milestone markers, "today" line

**Timeline structure:**
- Header: [← prev week] [Date range] [→ next week] | Today button
- Subheader: Week numbers with first-day date (Mon Jan 15 — Sun Jan 21)
- Day columns: M T W T F S S (7 columns, each ~30px wide on desktop, ~20px on mobile)
- Rows: one per task

**Sidebar (left, 200px):**
```
[Phase filter: All ▼]

Tasks
─────────────────────────
[Phase color] Task 1
[Phase color] Task 2
```

Scrolls independently from main timeline. Clicking a task row highlights it in both sidebar and timeline.

**Timeline row (per task):**
```
┌──────────┬─────────────────────────────────────┐
│ Task 1   │ [    bar: Jan 15-19    ] ✓          │
│ 45 min   │                                     │
└──────────┴─────────────────────────────────────┘
```

**Row contents:**
1. Left: Task title, time estimate, status dot
2. Right: Horizontal bar spanning start_date to target_date, coloured by phase
3. Bar visual:
   - Solid if on track
   - Hatched/striped if overdue (target_date < today)
   - Fade + checkmark if completed

**Milestone markers:**
- Teacher-defined checkpoints appear as vertical dashed lines with labels
- Example: "Research complete" on Jan 19 (a Tuesday)
- Colour matches criterion (A1, B2, etc.)

**"Today" line:**
- Vertical pink/red line at current date
- Auto-scrolls into view on load

**Interactions:**

| Action | Method | Behavior |
|--------|--------|----------|
| Change task dates | **Drag bar left/right** | Drags start_date or target_date (drag middle vs. edges for end-to-end vs. date change) |
| | **Click bar, then Cmd+Arrow Left/Right** | Shift dates by 1 day per keystroke |
| Extend duration | **Drag right edge** | Extends target_date forward, shows new duration
| View task details | **Click task name or bar** | Opens detail modal |
| Scroll timeline | **Scroll horizontally** | Pan through weeks |
| Filter by phase | **[Phase filter] dropdown** | Show only tasks in selected phase |
| **Collapse phase** | **[Phase name] collapse icon** | Hide all tasks in that phase (for clutter reduction) |
| Print/export | **Cmd/Ctrl+P or [Export] button** | Print timeline or export as PDF/CSV

**Mobile (375px):**
- Sidebar not shown (inline with timeline)
- Task names appear in a horizontal scrollable list (sticky left)
- Timeline scrolls horizontally, shows 3-5 days at a time
- Tap task to expand details panel below timeline

**Responsive breakpoints:**
- Desktop (1024px+): Full sidebar + timeline
- Tablet (768px): Sidebar collapsed to icons + timeline
- Mobile (375px): Sidebar inline, horizontal scroll

**Colour:**
- Bars: phase colour matching kanban (blue/purple/orange/green)
- Overdue bars: hatched pattern on bar
- Milestone lines: dashed, colour matches criterion

---

### 4.4 View 3: Checklist / Completion Tracking (Teacher View)

**Use case:** Teacher reviewing entire class progress. Quick at-a-glance completion status per student per task.

**Layout:**
- Rows = students
- Columns = tasks (or phases)
- Cell = completion status (empty, started, complete)

**Minimal version (per task):**
```
╔════════════════════════════════════════════════════════╗
║ Student                │ Research │ Ideate │ Prototype │
╠════════════════════════════════════════════════════════╣
║ Ali                    │   ✓      │  ●     │    ◯      │
║ Bella                  │   ✓      │  ●     │    ◯      │
║ Chen                   │   ◯      │  ◯     │    ◯      │
║ Diana (off today)      │   ✓      │  ✓     │    ●      │
╚════════════════════════════════════════════════════════╝

Legend: ✓ Complete | ● In Progress | ◯ Not Started | - Blocked
```

**Rich version (phases):**
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║ Student                │ Inquiring      │ Developing     │ Creating │ Evaluating
╠═══════════════════════════════════════════════════════════════════════════════╣
║ Ali (5 tasks)          │ ✓✓✓✓✓  100%   │ ✓✓✓  60%       │  ●  50%  │ ◯  0%
║ Bella (4 tasks)        │ ✓✓✓✓ 100%     │ ✓✓  50%        │  ◯   0%  │ ◯  0%
║ Chen (5 tasks)         │ ✓✓✓  60%       │ ◯  20%         │  ◯   0%  │ ◯  0%
║ Diana (6 tasks, on)    │ ✓✓✓✓✓✓ 100%   │ ●●●●  100%     │  ●  80%  │ ◯  0%
╚═══════════════════════════════════════════════════════════════════════════════╝
```

**Cell contents (clickable):**
- **Task version**: Status symbol (✓/●/◯/-) + task title on hover
- **Phase version**: Visual progress bar per phase, text shows % complete
  - Example: [████░░░░░░] 40% (4 of 10 tasks complete in Inquiring)

**Interactions:**
- **Click cell** → expand mini detail: which tasks, which ones complete, which in progress
- **Click student row** → open that student's kanban view in full detail
- **Click phase column header** → sort by that phase completion (best → worst)
- **Hover row** → show student status: "On pace", "1 day behind", "3 tasks blocked"
- **Filter**: [Show all] vs [Behind schedule] vs [Blocked] vs [No activity in 3 days]

**Mobile (375px):**
- Show only current phase (swipe left/right to change)
- Or show matrix collapsed: rows = students, one column = overall % completion

**Colour:**
- Cell backgrounds: green (complete), amber (in progress), grey (not started), red (blocked)
- Row numbers show task count per student

---

### 4.5 Task Detail Modal

**Trigger:** Click on a task card (any view) to open this modal.

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│ [Phase icon] Task Title                          [✕]  │
├────────────────────────────────────────────────────────┤
│                                                         │
│  QUICK ACTIONS BAR (always visible)                    │
│  [Status: In Progress ▼] [Priority: Normal ▼] [✓ Mark Done]
│                                                         │
│  TWO COLUMN LAYOUT                                     │
│                                                         │
│  LEFT COLUMN (60%)          │  RIGHT COLUMN (40%)      │
│  ─────────────────────────  │  ──────────────────      │
│  Description               │  Timeline                │
│  [Editable text area]      │  Start: Jan 15           │
│                            │  Due: Jan 19             │
│  Phase & Criteria          │  [Calendar picker]       │
│  Phase: Developing         │                          │
│  Linked: A1, B2            │  Time Tracking           │
│                            │  Estimate: 45 min        │
│  Effort                    │  Logged: 12 min          │
│  Estimate: 45 minutes      │  ⏱ Log Time              │
│  [Adjust with slider]      │                          │
│                            │  Evidence                │
│  Subtasks                  │  [1 upload linked]       │
│  ☐ Research users         │  [+ Link Response]       │
│  ☐ Document findings      │  [+ Attach file]         │
│  ☑ Synthesize notes       │                          │
│  [+ Add subtask]           │  Comments                │
│                            │  [Comment thread]        │
│  AI Suggestions            │  [+ Add comment]         │
│  "Consider interviewing    │                          │
│   5-7 users, not just 3"   │                          │
│  [Accept] [Dismiss]        │                          │
│                            │                          │
│                            │  [Delete task]           │
│                            │  [Share with peer]       │
│                            │  [Print task card]       │
└────────────────────────────────────────────────────────┘
```

**Modal interactions:**

| Element | Interaction | Behavior |
|---------|-------------|----------|
| Status dropdown | Click | Show: Not Started, In Progress, Blocked, On Hold, Completed |
| Priority dropdown | Click | Show: Low, Normal, High, Urgent (colour-coded) |
| Description | Click | Becomes editable textarea, markdown supported, auto-save on blur |
| Phase link | Click | Opens phase selector (radio buttons, read-mostly) |
| Criteria | Click | Multi-select modal, choose which criteria this task serves |
| Effort estimate | Drag slider | 0-240 minutes, shows label (15 min → "Quick", 90 min → "Deep Work") |
| Start date | Click | Calendar picker, can be cleared |
| Due date | Click | Calendar picker, can be cleared |
| Time logging | Click ⏱ | Opens time picker dialog: [30 min] / [hour:minute picker] |
| Subtask checkbox | Click | Toggle done/not done (optimistic update) |
| Subtask add | Click [+ Add] | Inline text input, blur to save |
| AI suggestions | [Accept]/[Dismiss] | Accept adds to description or creates subtask; dismiss hides |
| Evidence link | Click [+ Link] | Opens response picker (already submitted work) |
| Comment | Click [+ Add] | Inline compose box for peer feedback |
| Print | Click | Opens print view (clean layout, ready for PDF) |
| Delete | Click [Delete task] | Confirmation dialog, then removes |

**Keyboard shortcuts (modal open):**
- `Escape` → Close modal, return to kanban/gantt
- `Tab` → Move focus through fields
- `Cmd+S` → Force save (normally auto-saves)
- `Cmd+Enter` → Add comment and close comment box

**Mobile (375px):**
- Modal takes full screen
- Single column layout (description, phase, effort, time, evidence stack vertically)
- Calendar pickers use native date input (`<input type="date">`)

---

### 4.6 Keyboard Shortcuts Reference

**Global (any view):**
```
Cmd/Ctrl + N         Create new task (focus the add field)
Cmd/Ctrl + K         Search/filter tasks
Cmd/Ctrl + ?         Show shortcuts help (modal)
Escape               Close any open modal/dropdown
```

**Kanban board (when card is focused):**
```
Arrow Up/Down        Move focus to task above/below in column
Arrow Right/Left     Move task to next/prev phase column
Space / Enter        Toggle status (not_started ↔ in_progress ↔ completed)
E                    Edit task (open modal)
P                    Change priority
D                    Mark Done (status = completed)
C                    Open comments/add evidence
Backspace / Delete   Delete task (with confirm)
1-4                  Jump to phase column (1=Inquiring, 2=Developing, 3=Creating, 4=Evaluating)
Double-click title   Edit title inline
```

**Gantt timeline:**
```
Scroll left/right    Pan through weeks
Ctrl + Scroll        Zoom in/out (show 2 weeks vs 6 weeks)
Click task bar       Select task, opens modal
Drag bar             Move task start/end dates
```

**Detail modal:**
```
Tab / Shift+Tab      Move between fields
Escape               Close modal
Cmd/Ctrl + S        Force save
Cmd/Ctrl + Enter    Save comment (in comment input)
```

---

### 4.7 State Management & Data Sync

**Real-time sync requirements:**
- When Student A moves a task to "In Progress", Teacher dashboard updates immediately (via Supabase realtime or polling every 3 seconds for lower latency overhead)
- When Student A logs 15 minutes of time, the progress bar updates on all open views (Kanban, Gantt, Checklist) for that student
- When a task's target_date changes, position in all views recalculates instantly

**Optimistic updates:**
- Status change: Update UI immediately, sync to API in background. If API fails, roll back (toast: "Unable to update, trying again...")
- Date change: Update position in Gantt immediately, sync in background
- Time logging: Update progress bar immediately, sync in background

**Conflict resolution:**
- If another student/teacher edits the same task simultaneously, last-write-wins (timestamp comparison)
- Reload warning: If task modified externally, show toast: "This task was updated by [Name]. [Reload] or [Keep my changes]"

---

## 5. Interaction Patterns (Detailed Flows)

### 5.1 Adding a Task

**Happy path (keyboard user, fast):**
1. Press `Cmd/Ctrl + N` (focus appears on "Add task" input)
2. Type: "Research user needs"
3. Press `Tab` → Focus jumps to phase selector
4. Press `2` (or arrow keys to Developing)
5. Press `Tab` → Focus to date picker
6. Type: "jan 20" (natural language parsing)
7. Press `Tab` → Focus to effort estimate
8. Type: "45" (minutes)
9. Press `Enter` → Task created, kanban card appears in Developing column, focus returns to add field

**Happy path (mouse user):**
1. Click `+ Add Task` button (opens form in sidebar or bottom bar)
2. Type task title, press Tab to next field
3. Click phase dropdown (or leave as default "Inquiring")
4. Click date picker, select due date on calendar
5. Set effort estimate with slider
6. Click [Create] button
7. Task appears in kanban with smooth slide-in animation

**With page linking:**
1. Typing task creates task in default phase (Inquiring)
2. Click phase badge in task card → modal opens, shows all 4 phases
3. Or drag card right to move to next phase

### 5.2 Completing a Task

**Quick completion (keyboard):**
1. Focus task card with arrow keys
2. Press `Space` or `D` → status cycles: not_started → in_progress → completed
3. Card fades slightly, stays visible (not hidden)
4. Progress bar fills to 100% if effort_estimate met

**Quick completion (mouse):**
1. Hover task card → status dot appears on left
2. Click status dot → menu shows: Not Started, In Progress, Completed
3. Click "Completed" → card updates, fades, timestamp auto-fills

**Completion with evidence:**
1. Task is marked "In Progress"
2. Student uploads prototype photo (response)
3. System auto-detects the upload is linked to this task (via page + phase context)
4. Toast: "Added evidence to 'Design prototype'. Mark complete?"
5. Student clicks [Mark Complete] in toast or manually clicks card status

### 5.3 Task Blocked (Waiting for Feedback)

**Scenario:** Student has finished their research but is waiting for teacher's feedback before moving to Developing Ideas.

1. Task is "In Progress" in Inquiring column
2. Student clicks task → opens modal
3. Changes status from "In Progress" to "Blocked"
4. Types comment: "Waiting for feedback on research quality before continuing"
5. Teacher sees "Blocked" status in their checklist view (red highlight)
6. Teacher writes comment in task detail: "Research looks thorough, but need citations. Review [link]. Then proceed."
7. Student sees comment notification
8. Updates research, clicks [Mark Complete] + moves task from Inquiring to Developing

### 5.4 Rescheduling a Task (Gantt Drag)

**Scenario:** Student originally planned to research Jan 15-19 but is behind.

1. Student opens Gantt timeline view
2. Sees "Research user needs" bar spanning Jan 15-19
3. Clicks and drags right edge of bar → extends to Jan 22
4. Releases → target_date updates to Jan 22
5. Task card in Kanban shows new due date ("Due Jan 22")
6. Time estimate remains 45 min, but "time until due" recalculates
7. If task is overdue, bar shows hatched pattern warning

### 5.5 Logging Time

**Scenario:** Student just finished a 30-minute work session.

1. Opens task detail modal
2. Clicks [⏱ Log Time] button
3. Quick picker appears: [15 min] [30 min] [45 min] [1 hour] [Custom]
4. Clicks [30 min]
5. time_logged updates: was 12 min, now 42 min
6. Progress bar recalculates: 42/45 min (93%)
7. Toast: "30 minutes logged. You're almost done!"

**With custom duration:**
1. Click [Custom]
2. Opens time input: [HH:MM]
3. Type "1:15"
4. Validates, updates time_logged
5. Closes

---

## 6. Data Model Enhancements (Database)

### 6.1 New Migrations Needed

**Migration: planning_tasks_v2**
```sql
-- Add new columns to planning_tasks
ALTER TABLE planning_tasks ADD COLUMN design_phase VARCHAR(20); -- 'inquiring', 'developing', 'creating', 'evaluating'
ALTER TABLE planning_tasks ADD COLUMN status VARCHAR(30) DEFAULT 'not_started'; -- 'not_started', 'in_progress', 'blocked', 'on_hold', 'completed'
ALTER TABLE planning_tasks ADD COLUMN description TEXT;
ALTER TABLE planning_tasks ADD COLUMN effort_estimate INTEGER; -- minutes
ALTER TABLE planning_tasks ADD COLUMN priority VARCHAR(20) DEFAULT 'normal'; -- 'low', 'normal', 'high', 'urgent'
ALTER TABLE planning_tasks ADD COLUMN criterion_id VARCHAR(10); -- e.g., 'A1', 'B2'
ALTER TABLE planning_tasks ADD COLUMN completed_date TIMESTAMP;
ALTER TABLE planning_tasks ADD COLUMN last_activity_at TIMESTAMP;

-- Backfill design_phase from page_id
UPDATE planning_tasks SET design_phase = 'inquiring' WHERE page_id LIKE 'A%';
UPDATE planning_tasks SET design_phase = 'developing' WHERE page_id LIKE 'B%';
UPDATE planning_tasks SET design_phase = 'creating' WHERE page_id LIKE 'C%';
UPDATE planning_tasks SET design_phase = 'evaluating' WHERE page_id LIKE 'D%';

-- Backfill status (assume todo = not_started, done = completed)
UPDATE planning_tasks SET status = 'not_started' WHERE status = 'todo';
UPDATE planning_tasks SET status = 'completed' WHERE status = 'done';
DELETE FROM planning_tasks WHERE status = 'in_progress' AND NOT last_updated > NOW() - INTERVAL '7 days'; -- Clean up stale in_progress tasks

-- Create indices
CREATE INDEX idx_planning_tasks_design_phase ON planning_tasks(student_id, design_phase);
CREATE INDEX idx_planning_tasks_target_date ON planning_tasks(student_id, target_date);
CREATE INDEX idx_planning_tasks_status ON planning_tasks(student_id, status);
```

**Migration: task_subtasks (new table)**
```sql
CREATE TABLE task_subtasks (
  id VARCHAR(50) PRIMARY KEY,
  task_id VARCHAR(50) REFERENCES planning_tasks(id) ON DELETE CASCADE,
  student_id VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_subtasks_task ON task_subtasks(task_id);
```

**Migration: task_time_logs (new table, for detailed time tracking)**
```sql
CREATE TABLE task_time_logs (
  id VARCHAR(50) PRIMARY KEY,
  task_id VARCHAR(50) REFERENCES planning_tasks(id) ON DELETE CASCADE,
  student_id VARCHAR(50) NOT NULL,
  duration_minutes INTEGER NOT NULL, -- e.g., 30
  logged_at TIMESTAMP DEFAULT NOW(),
  work_session_date DATE, -- when was the work done (vs. when was it logged)
  notes TEXT, -- e.g., "Interviewed 3 users, took notes"
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_time_logs_task ON task_time_logs(task_id);
```

**Migration: task_comments (new table, for peer/teacher feedback)**
```sql
CREATE TABLE task_comments (
  id VARCHAR(50) PRIMARY KEY,
  task_id VARCHAR(50) REFERENCES planning_tasks(id) ON DELETE CASCADE,
  author_id VARCHAR(50), -- student_id or teacher_id
  author_type VARCHAR(20), -- 'student', 'teacher'
  body TEXT NOT NULL,
  edited_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id);
```

---

## 7. Mobile Considerations

### 7.1 Layout Breakpoints

| Breakpoint | Width | View | Key Changes |
|-----------|-------|------|--------------|
| Desktop | 1024px+ | Full kanban (4 cols) + Gantt full timeline + Checklist matrix | No compromises |
| Tablet (landscape) | 768px-1023px | Kanban with horizontal scroll tabs OR Gantt with pinned sidebar | Sidebar toggles off/on |
| Tablet (portrait) | 600px-768px | Kanban tabs (one column visible) + Gantt shows 4 days at a time | Sidebar hidden |
| Mobile | 375px-600px | Kanban tabs + single column visible, swipe between. Gantt horiz scroll. | Full-width cards |

### 7.2 Touch Interactions

- **Long-press (500ms)** on card → Context menu: [Edit] [Delete] [Share] [Pin to top]
- **Swipe left** on card → Delete action (or reveal delete button)
- **Swipe right** → Reveal edit/complete options
- **Pinch** on Gantt → Zoom in/out timeline
- **2-finger swipe right** → Go to previous phase column
- **2-finger swipe left** → Go to next phase column

### 7.3 Input Optimization

**Date picker:** Use native `<input type="date">` (auto-opens system date picker on mobile, cleaner UX than custom calendar)

**Time logging:** Quick picker with common durations ([15], [30], [45], [60] minutes) before custom input

**Text input:** Larger tap targets (min 44×44px), auto-focus keyboard, dismiss keyboard on tap outside

### 7.4 Performance

- **Lazy load**: Don't render all task cards in a column if >20 tasks. Use virtual scrolling (show only visible cards + buffer)
- **Debounce**: Time logging, priority changes → debounce 1 second before API call
- **Caching**: Phase data cached locally (IndexedDB), sync every 30 seconds

---

## 8. AI-Enhanced Workflow

### 8.1 AI Task Suggestions

**Trigger:** When student moves to a new design phase or teacher assigns a milestone.

**Example flow:**
1. Student completes "Research user needs" task
2. Marks status = completed
3. System detects phase transition (Inquiring → Developing)
4. AI generates suggested next steps: "Based on your research, consider: [1. Create 3 design concepts] [2. Decide on target user] [3. Define constraints]"
5. Each suggestion is a clickable button: [+ Add as task]
6. Student can accept all, pick one, or dismiss

**Implementation:**
```typescript
async function getNextStepSuggestions(
  taskId: string,
  phase: string,
  criterion: string,
  unitContext: string,
  studentKnowledge: string // from user profile
): Promise<string[]> {
  // Call Haiku 4.5 with task context
  // Return 3-5 suggestions as array of strings
}
```

### 8.2 Time Estimation AI

**Trigger:** Student clicks [Set estimate] on a blank task or asks "How long should this take?"

**Flow:**
1. Student types task title: "Design and test 3 prototypes"
2. Hovers over effort estimate field
3. AI analyzes task description + unit scope → suggests time
4. Tooltip: "Based on your previous work, this typically takes ~2-3 hours. [Accept] [Adjust]"
5. Student clicks [Accept] → 120 minutes pre-filled
6. Or drags slider to adjust

**Implementation:** Lightweight model call using task semantics + student's historical time logs.

### 8.3 Blocker Detection

**Trigger:** Student's task is overdue or has stalled (no activity for 3 days).

**Flow:**
1. Teacher sees task in red on dashboard (overdue)
2. Clicks to view task detail
3. AI analysis shows: "Chen has been stuck on 'Research' for 4 days. Possible blockers: [Not sure how to conduct interview] [Waiting for teacher feedback] [Can't reach target users]"
4. Teacher can add comment addressing the blocker
5. System sends notification to student: "[Teacher] noticed you might be stuck. Help available: [view feedback]"

**Implementation:** Heuristics + optional AI (lightweight) to detect stall patterns.

---

## 9. Teacher Dashboard Integration

### 9.1 Class-Level Planning View

**Current state:** Teacher sees only individual units and grading.

**Proposed addition:** A "Class Timeline" or "Planning Overview" page showing:
- All students' task progress across the unit
- Which students are behind/on-track/ahead per phase
- Upcoming teacher checkpoints (A1 due date, B2 due date, etc.)
- Class-wide blockers (e.g., "8 students waiting on equipment availability")

**Teacher actions:**
- Click a phase → see all tasks in that phase for all students
- Click a student → see that student's kanban board
- Hover class timeline → see which activities are happening this week
- Set milestone: "A1 research complete by Friday" → appears as vertical line on all Gantt timelines

### 9.2 Early Warning System (mentioned in roadmap)

**Data inputs:**
- Days since last activity
- Current phase vs. expected phase (based on timeline)
- Task completion vs. effort estimate (effort_estimate = 45 min, but time_logged = 2 min after 2 weeks = stuck)
- Submission quality signals (effort-gating scores from AI)
- Missed milestones

**Output: Risk score (0-100) per student**
- <30: Green (on track)
- 30-60: Amber (at risk)
- 60+: Red (needs intervention)

**Teacher sees ranked list: "Students needing attention"**
```
🔴 Chen (88 risk) — stuck on Inquiring research, 4 days, no submissions
🟡 Diana (45 risk) — behind schedule, 2 days late on B1
🟢 Ali (10 risk) — on track
```

Click → opens task detail + suggestion for intervention.

---

## 10. Integration Points

### 10.1 Response Linking

**Current state:** Responses (uploads, text submissions) stored separately. No formal link to planning tasks.

**Proposed:** Each response can be tagged with a task_id:
```
response.task_ids = ["task-abc-123"]  // Array to support evidence for multiple tasks
```

**UI:** When viewing task detail, show "Evidence" section with all linked responses.

### 10.2 Portfolio Pipeline

**Current state:** Responses auto-flow into timeline; no task metadata included.

**Proposed:** Each portfolio entry includes task context:
```
PortfolioEntry {
  response_id,
  task_id (if linked),
  design_phase (from task),
  criterion (from task),
  timestamp,
  title (from task),
  time_spent (from task.time_logged)
}
```

**UI:** Portfolio timeline can be sorted by task, phase, or criterion.

### 10.3 Unit Pages & Tasks

**Current state:** Task can link to a page_id (A1, B2, etc.). No bidirectional relationship.

**Proposed:** When teacher edits a page, they see suggested tasks:
```
Page B2: Developing Ideas
─────────────────────────
Activity: Ideation Workshop

Suggested tasks to auto-create:
☐ Research competitor designs (before activity)
☐ Generate 5 concepts (during activity)
☐ Evaluate concepts against criteria (after activity)

[Auto-create all]
```

---

## 11. Visual Design Specifications

### 11.1 Colour Palette

| Element | Colour | Hex | Usage |
|---------|--------|-----|-------|
| Inquiring phase | Blue | #3B82F6 | Kanban column, task cards, badges |
| Developing phase | Purple | #A855F7 | Kanban column, task cards, badges |
| Creating phase | Orange | #F97316 | Kanban column, task cards, badges |
| Evaluating phase | Green | #10B981 | Kanban column, task cards, badges |
| Task completed | Green accent | #059669 | Checkmark, fade effect |
| Task blocked | Red | #DC2626 | Status indicator, warning |
| Task overdue | Orange | #EA580C | Bar pattern in Gantt |
| Priority: Urgent | Red | #DC2626 | Dot on task card |
| Priority: High | Orange | #EA580C | Dot on task card |
| Priority: Normal | Yellow | #EABB08 | Dot on task card |
| Priority: Low | Grey | #9CA3AF | Dot on task card |
| Background (cards) | White | #FFFFFF | Task cards, modals |
| Background (surface) | Grey | #F9FAFB | Column backgrounds, alternate rows |
| Text primary | Dark Grey | #111827 | Task titles, labels |
| Text secondary | Medium Grey | #6B7280 | Subtitles, timestamps |
| Border | Light Grey | #E5E7EB | Dividers, card borders |
| Focus ring | Blue | #3B82F6 | Keyboard focus indicator |

### 11.2 Typography

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| Task title | Inter | 14px | 500 | 1.4 |
| Phase header | Inter | 13px | 700 | 1.2 |
| Task metadata | Inter | 12px | 400 | 1.3 |
| Task description | Inter | 13px | 400 | 1.5 |
| Modal title | Inter | 18px | 700 | 1.2 |
| Button label | Inter | 13px | 600 | 1.2 |

**Font stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

### 11.3 Spacing & Sizing

| Element | Size |
|---------|------|
| Kanban card | 280px × 120px (desktop), full width (mobile) |
| Card padding | 12px |
| Column gap | 16px |
| Column width | 300px |
| Phase header height | 44px |
| Task row height (Gantt) | 40px |
| Sidebar width (Gantt) | 200px |
| Modal width | 600px (desktop), full (mobile) |
| Input height | 36px |
| Button height | 36px |
| Min tap target | 44px × 44px (mobile) |

### 11.4 Animations

| Interaction | Animation | Duration |
|-----------|-----------|----------|
| Card drag between columns | Spring (stiffness=170, damping=26) | 300ms |
| Card reorder within column | Smooth slide | 200ms |
| Phase column collapse/expand | Height transition | 250ms |
| Modal open | Fade in + scale (0.95 → 1) | 200ms |
| Modal close | Fade out + scale (1 → 0.95) | 150ms |
| Toast appear | Slide up + fade | 200ms |
| Progress bar fill | Linear animation | 600ms |
| Status dot toggle | Colour transition | 150ms |

---

## 12. Accessibility Requirements

### 12.1 WCAG 2.1 Level AA Compliance

- **Contrast:** All text > 4.5:1 (normal) or 3:1 (large)
- **Keyboard navigation:** Full keyboard control, no mouse required
- **Screen reader:** All interactive elements have `aria-label`, landmarks properly marked
- **Focus management:** Visible focus indicator (outline), focus trapped in modals
- **Form labels:** Explicit `<label>` associations, error messages linked via `aria-describedby`

### 12.2 Specific Components

**Kanban columns:**
- `<section role="region" aria-label="Inquiring & Analysing phase, 5 tasks">`
- Cards have `tabindex="0"` and full keyboard support

**Task cards:**
- `<div role="article" aria-label="Task: Research user needs, In Progress, Due Friday">`
- Status dot: `<button aria-label="Toggle status: click to cycle between not started, in progress, completed">`

**Modal:**
- `<dialog role="dialog" aria-labelledby="modal-title">`
- Focus trap: first/last focusable elements wrap around
- Close button accessible via Escape key

**Colour accessibility:**
- Phase colours chosen to be distinguishable for colourblind users (blue/purple/orange/green are all distinct in deuteranopia and protanopia)
- Never rely on colour alone: use icons + labels too

---

## 13. Responsive Design Details

### 13.1 Mobile-First CSS Grid

```css
/* Desktop: 4 columns */
@media (min-width: 1024px) {
  .kanban-container {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }
}

/* Tablet: 2 columns */
@media (768px <= width < 1024px) {
  .kanban-container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}

/* Mobile: 1 column (scrollable tabs) */
@media (width < 768px) {
  .kanban-container {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }
  .kanban-column {
    min-width: 100%;
    scroll-snap-align: start;
  }
}
```

### 13.2 Gantt Timeline Responsive

```
Desktop (1024px+):  [Sidebar 200px] [Timeline 6 weeks, scrollable]
Tablet (768px):     [Sidebar toggles] [Timeline 3-4 weeks]
Mobile (375px):     [Task list] [Timeline 3 days horiz scroll]
```

---

## 14. Implementation Roadmap

### Phase 1: Core Data Model & Kanban (3 weeks)
1. Migrate database (design_phase, status, effort_estimate, priority, description)
2. Build unified PlanningTask component (replaces GanttPanel + PlanningPanel)
3. Implement 4-column kanban with drag-drop between phases
4. Add task detail modal
5. Status transitions + keyboard shortcuts
6. Test with 5 students in pilot class

### Phase 2: Gantt Timeline (2 weeks)
1. Build Gantt view component (timeline rows, drag to reschedule)
2. Milestone markers + "today" line
3. View toggle (Kanban ↔ Gantt ↔ Checklist)
4. Mobile Gantt (horizontal scroll)
5. Export to PDF/CSV

### Phase 3: Advanced Features (3 weeks)
1. Time logging UI + API
2. Subtasks
3. Comments + evidence linking
4. AI suggestions (next steps, time estimates)
5. Teacher dashboard integration

### Phase 4: Polish & Accessibility (2 weeks)
1. Keyboard shortcuts reference
2. Accessibility audit (WCAG AA)
3. Animations + micro-interactions
4. Mobile touch optimizations
5. Performance profiling (lazy load, virtual scroll)

**Total: ~10 weeks** (can be parallelized with other work)

---

## 15. Testing Strategy

### 15.1 Unit Tests
- Task CRUD operations
- Phase transitions (validate rules)
- Time calculations (deadline, overdue, progress)
- Keyboard event handlers
- Focus management (modal trap, blur/focus)

### 15.2 Integration Tests
- Drag task between phases → database updates → other views sync
- Time logging → progress bar updates across views
- Batch operations (select multiple, bulk move)
- Responsive layouts at breakpoints

### 15.3 User Testing
- 5 students (ages 13-15) in lab setting
- "Add a task and mark it complete" (baseline)
- "Reschedule a task" (Gantt drag)
- "Log time spent" (time logging flow)
- "Switch views" (kanban ↔ gantt ↔ checklist)
- Collect SUS scores (System Usability Scale)
- Target: SUS ≥ 75

### 15.4 Accessibility Testing
- Screen reader (NVDA/JAWS) with keyboard only
- Colour contrast validator
- Keyboard-only user testing
- Tab order verification

---

## 16. Success Metrics

### 16.1 Adoption
- 80% of students use planning tools on Day 1 of unit
- Average task creation rate: 8-12 tasks per student per unit (currently unknown)
- Session duration in planning tools: 5-10 minutes per session (vs. current <2 min)

### 16.2 Pedagogy
- Teacher confidence: "I can see exactly where each student is in the design cycle" (survey, target 4/5)
- Student agency: "I can plan my own design project timeline" (survey, target 4/5)
- Design cycle alignment: 100% of tasks can be mapped to a design phase (currently 0%, using page_id inference)

### 16.3 Efficiency
- Time to mark a task complete: <3 seconds (keyboard)
- Drag to reschedule: <2 seconds
- View switch (Kanban ↔ Gantt): <1 second
- Mobile usability: SUS ≥ 75

---

## 17. Known Constraints & Assumptions

### 17.1 Assumptions
- Students have access to web/mobile browsers during class (mixed: mostly yes, some schools iPad-only)
- Teachers want to see class-wide planning (not just individual student tracking)
- MYP design cycle phases are universally understood (true for IB schools; may vary for others)
- Task management is a feature, not a product (integrated into StudioLoom, not a standalone tool)

### 17.2 Constraints
- Database schema migrations require careful backfill (existing tasks have page_id, not design_phase)
- Realtime sync (multiple students editing same task) is nice-to-have, not required
- AI features (time estimation, next steps) depend on Haiku availability and cost
- Mobile Gantt zoom/pan may be janky on low-end Android devices

### 17.3 Out of Scope (for this spec)
- Recurring tasks (nice-to-have, defer to Phase 2)
- Calendar view integration with school calendar
- Mobile app (native iOS/Android) — web only
- Notifications/alerts (can add later)
- Time tracking from external tools (Toggl, Harvest)
- Dependency chains (Task A blocks Task B)
- Resource allocation (shared equipment booking)

---

## 18. Appendix: Wireframes & Mockups

### 18.1 Kanban Board (Desktop)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← back] My Planning Board                   [View: Kanban ▼] [Settings ⚙]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  [COLUMN 1]         [COLUMN 2]         [COLUMN 3]         [COLUMN 4]        │
│  Inquiring 🔍       Developing 💡      Creating 🔨        Evaluating ✓       │
│  [5 tasks]          [3 tasks]          [2 tasks]          [0 tasks]          │
│  ─────────────────  ─────────────────  ─────────────────  ─────────────────  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                      │
│  │ Research    │    │ Sketch      │    │ Build       │                      │
│  │ users       │    │ concepts    │    │ prototype   │                      │
│  │             │    │             │    │             │                      │
│  │ [A1] [45m]  │    │ [B2] [90m]  │    │ [C2] [120m] │                      │
│  │ Due Fri     │    │ Due Wed     │    │ Due Mon     │                      │
│  │ [█████░░] 55%    │ [██░░░░] 33%│    │ [░░░░░░] 0% │                      │
│  └─────────────┘    └─────────────┘    └─────────────┘                      │
│  ┌─────────────┐    ┌─────────────┐                                         │
│  │ Interview   │    │ Define      │                                         │
│  │ stakeholders│    │ constraints │                                         │
│  │             │    │             │                                         │
│  │ [A2] [60m]  │    │ [B1] [45m]  │                                         │
│  │ Due Thu     │    │ Due Sat     │                                         │
│  │ [███░░░] 40%│    │ [████░░] 70%│                                         │
│  └─────────────┘    └─────────────┘                                         │
│  ... (3 more)                                                                │
│                                                                               │
│  [+ Add task]       [+ Add task] [+ Add task] [+ Add task]                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 18.2 Gantt Timeline (Desktop)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← back] Timeline                           [View: Gantt ▼] [← Week] [→]    │
│                                             Jan 15 — Jan 28                 │
├────────────────────┬────────────────────────────────────────────────────────┤
│ Task               │ Mon Tue Wed Thu Fri Sat Sun Mon Tue Wed Thu Fri Sat   │
├────────────────────┼────────────────────────────────────────────────────────┤
│ Research users     │ [═══════════════════] ⚫ ✓                            │
│ 45 min             │                                                         │
├────────────────────┼────────────────────────────────────────────────────────┤
│ Sketch concepts    │      [══════════════════════] ⚫                       │
│ 90 min             │                                                         │
├────────────────────┼────────────────────────────────────────────────────────┤
│ Build prototype    │                      [════════════════════════════]    │
│ 120 min            │                                                         │
├────────────────────┼────────────────────────────────────────────────────────┤
│ Interview 2        │ [███░░░░] ⚫ (in progress)                             │
│ 60 min             │                                                         │
└────────────────────┴────────────────────────────────────────────────────────┘
      ◁ Milestones: A1 Due (Wed) | B2 Due (Fri) | Today: Mon 15 (│)
```

### 18.3 Task Detail Modal

```
┌──────────────────────────────────────────────────────────┐
│ 🔍 Research user needs                              [✕]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ [Status: In Progress ▼] [Priority: High ▼] [✓ Done]    │
│                                                          │
│ ┌─────────────────────────────┬──────────────────────┐  │
│ │ Description                 │ Timeline             │  │
│ │ [Research at least 5 users, │ Start: Jan 15        │  │
│ │  document needs, analyse    │ Due: Jan 19          │  │
│ │  patterns]                  │ [📅 picker]          │  │
│ │                             │                      │  │
│ │ Phase & Criteria            │ Time Tracking        │  │
│ │ Phase: Inquiring            │ Estimate: 45 min     │  │
│ │ Criteria: A1, A2            │ Logged: 12 min       │  │
│ │                             │ [⏱ Log Time]         │  │
│ │ Subtasks                    │                      │  │
│ │ ☐ Prepare interview Qs      │ Evidence             │  │
│ │ ☑ Recruit 5 users          │ [Upload 1]           │  │
│ │ ☐ Conduct interviews       │ [+ Add evidence]     │  │
│ │ [+ Add subtask]             │                      │  │
│ │                             │ [Delete] [Print]     │  │
│ └─────────────────────────────┴──────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 19. Glossary

- **Design phase** — One of 4 MYP Design Cycle stages: Inquiring, Developing, Creating, Evaluating
- **Task** — A student-created or teacher-assigned discrete work item with a title, dates, and phase
- **Kanban board** — View showing tasks organized in vertical columns by design phase
- **Gantt timeline** — View showing tasks as horizontal bars across a calendar/timeline
- **Effort estimate** — Predicted time (in minutes) to complete a task
- **Time logged** — Actual time spent on task (sum of work sessions)
- **Status** — Current workflow state (not_started, in_progress, blocked, completed)
- **Milestone** — Teacher-defined checkpoint (e.g., "A1 research due")
- **Criterion** — MYP assessment criterion (A1, A2, B2, C3, etc.)
- **Response** — Student work submitted (upload, text, photo)
- **Portfolio entry** — Response auto-flowed into timeline + metadata

---

**Document prepared by:** Claude (AI research assistant)
**For:** Matt Burton, StudioLoom Project Lead
**Status:** Ready for design review and specification feedback
**Next steps:** Present to design team, incorporate feedback, begin Phase 1 implementation planning
