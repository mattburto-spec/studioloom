# Project: Student PM Tools Redesign
**Created: 31 March 2026**
**Last updated: 31 March 2026**
**Status: Planning — audit complete, ready to build**
**Reference: `docs/planning-tools-ux-spec.md` (1,372-line research doc)**

---

## What This Is

A redesign of the student project management tools — specifically the Gantt chart and to-do/kanban board. The portfolio is already production-quality and doesn't need changes. The goal: make planning tools feel like they belong in a design studio, not a generic task manager.

---

## Why Now

Students in MYP Design work through a structured design cycle (Inquiring & Analysing → Developing Ideas → Creating the Solution → Evaluating). The current planning tools use generic columns ("To Do / In Progress / Done") that have zero connection to the design process. A student planning their bridge design project sees the same UI as someone managing a grocery list. The tools need to speak the language of design thinking.

Additionally, the DesignPlanBoard (v2) component was already built (20 Mar 2026) with proper MYP design cycle columns but never integrated into the live app. This project finishes that work and adds the missing pieces.

---

## Current State

### Portfolio (GOOD — no changes needed)
- `src/components/portfolio/PortfolioPanel.tsx` (438 lines) — timeline view, auto-capture, PPT export
- Entry types: entry, photo, link, note, mistake, auto
- Smart date grouping, favicon lookup, delete with hover
- **Verdict: Production-ready. Leave it alone.**

### Gantt Chart (FUNCTIONAL — needs polish)
- `src/components/planning/GanttPanel.tsx` (609 lines) — read-only weekly Gantt
- Auto-scrolls to today, teacher milestones as dashed lines, weekend shading
- Task creation with page linking, status cycling (todo → in_progress → done)
- **Problems:** No keyboard navigation, no drag-to-reschedule, date editing requires 2 clicks, no batch operations, no time estimates

### Kanban / To-Do (TWO VERSIONS — needs consolidation)
- `src/components/planning/PlanningPanel.tsx` (343 lines) — v1 generic kanban ("To Do / In Progress / Done")
- `src/components/planning/DesignPlanBoard.tsx` (150+ lines) — v2 with MYP design cycle columns (A/B/C/D + Backlog)
- `src/components/planning/PlanningPanelV2.tsx` (80+ lines) — wrapper for DesignPlanBoard
- **Problem:** v1 is still the active default. v2 exists but isn't wired into any route. Two parallel implementations.

### Floating Timer
- `src/components/planning/FloatingTimer.tsx` — basic time tracker with localStorage
- **Problem:** Not wired to the planning API. Time logged goes nowhere.

### API & Database
- `src/app/api/student/planning/route.ts` (206 lines) — CRUD for `planning_tasks`
- `planning_tasks` table: id, student_id, unit_id, title, status, page_id, start_date, target_date, actual_date, time_logged, sort_order
- **Missing fields:** description, effort_estimate, priority, design_phase, attachments

### Planning Tools UX Spec
- `docs/planning-tools-ux-spec.md` (1,372 lines) — comprehensive research doc from March 2026
- Recommends: MYP Design Cycle phases as columns, keyboard-first UX (Linear-style), multi-view architecture, minimal chrome, comment threads
- **Status: Research complete, implementation not started**

---

## Architecture Vision

### Single Data Model, Multiple Views

One `planning_tasks` table feeds three views:

```
┌─────────────────────────────────────────────┐
│              planning_tasks                  │
│  + design_phase (A/B/C/D/backlog)           │
│  + effort_estimate (quick/moderate/extended)  │
│  + priority (1-3)                            │
│  + description                               │
│  + time_logged (wired to FloatingTimer)       │
└─────────────┬───────────────────────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
 Kanban    Gantt    Checklist
 (phases)  (dates)  (simple)
```

### Design Cycle Kanban (Primary View)

Replace generic columns with framework-aware design phases:

| Framework | Columns |
|-----------|---------|
| IB MYP | Backlog → A: Inquiring → B: Developing Ideas → C: Creating → D: Evaluating |
| GCSE DT | Backlog → Research → Design → Make → Evaluate |
| ACARA DT | Backlog → Investigate → Generate → Produce → Evaluate |

Column colors match existing criterion colours (A=indigo, B=emerald, C=amber, D=violet).

### Keyboard-First UX (Linear-inspired)

- `Cmd+K` / `Ctrl+K` — Quick-add task (focus title field immediately)
- `Tab` through task fields (title → phase → effort → date)
- `Arrow keys` to navigate between tasks
- `Space` to cycle status
- `Enter` to open task detail
- `Escape` to close/cancel
- Single-click status change (no confirm dialogs)
- Hover to reveal edit/delete icons

### Task Cards

```
┌──────────────────────────────────────┐
│ ● Build bridge prototype             │  ← title (click to edit inline)
│ 🔧 Extended  ·  Due: Apr 15  ·  C   │  ← effort + due date + criterion
│ ▓▓▓▓▓▓░░░░ 2.5h logged              │  ← time bar (from FloatingTimer)
└──────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Consolidate & Ship v2 Kanban (~2 days)
- [ ] Retire PlanningPanel v1 (generic columns)
- [ ] Wire DesignPlanBoard (v2) as the active kanban view
- [ ] Add `design_phase` column to `planning_tasks` (migration)
- [ ] Map existing tasks: `status: "todo"` → `design_phase: "backlog"`, `"in_progress"` → auto-detect from page's criterion, `"done"` → keep phase
- [ ] Framework-aware column labels using `getFrameworkCriteria()` from student's class
- [ ] Column colours match criterion colours
- [ ] Drag-and-drop between phase columns (already works in DesignPlanBoard)

### Phase 2: Enhanced Task Model (~1.5 days)
- [ ] Migration: add `design_phase`, `effort_estimate`, `priority`, `description` to `planning_tasks`
- [ ] API: extend PATCH/POST to accept new fields
- [ ] Task detail view: click task → expand with description, effort selector, priority, linked page
- [ ] Effort estimate selector: quick (< 30 min) / moderate (30-90 min) / extended (> 90 min)
- [ ] Priority indicator: subtle dot color (red/amber/gray for 1/2/3)
- [ ] Due date with smart display ("Today", "Tomorrow", "Overdue" with red)

### Phase 3: Gantt Chart Improvements (~2 days)
- [ ] Drag-to-reschedule (drag task bar horizontally to change dates)
- [ ] Resize task bar to change duration
- [ ] Design phase color-coding on Gantt bars (match kanban column colors)
- [ ] Effort weight on bar height (extended = taller bar)
- [ ] Keyboard navigation (arrow keys between tasks, Enter to edit)
- [ ] Zoom levels (day / week / month)
- [ ] Teacher deadline markers from schedule_overrides

### Phase 4: Time Tracking & Checklist View (~1.5 days)
- [ ] Wire FloatingTimer to planning API (POST time_logged on stop)
- [ ] Time logged visible on task cards and Gantt bars
- [ ] Checklist view: simple flat list grouped by phase, checkboxes for done, sortable by priority/due date
- [ ] View switcher in planning panel header (Kanban / Gantt / Checklist — icon buttons)

### Phase 5: Intelligence & Polish (~2 days, depends on Intelligence Profiles)
- [ ] AI-suggested next tasks based on unit content + current progress
- [ ] Auto-create tasks from lesson activities (teacher enables per-unit)
- [ ] Time estimate comparison (estimated vs actual) for velocity learning
- [ ] Milestone sync from teacher's LessonSchedule overrides
- [ ] Batch operations (select multiple → move phase, set priority, delete)

---

## Estimated Effort

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|-------------|
| 1 | Consolidate & ship v2 | ~2 days | None (DesignPlanBoard exists) |
| 2 | Enhanced task model | ~1.5 days | Phase 1 |
| 3 | Gantt improvements | ~2 days | Phase 2 |
| 4 | Time tracking & checklist | ~1.5 days | Phase 2 |
| 5 | Intelligence & polish | ~2 days | Intelligence Profiles (future) |
| **Total** | | **~9 days** | |

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary view | **Kanban (design phases)** | Students think in phases, not dates. Kanban is the default; Gantt and checklist are secondary views. |
| Generic columns | **Kill v1** | "To Do / In Progress / Done" has zero pedagogical value. Design cycle phases are the whole point. |
| Framework-aware phases | **Yes, via `getFrameworkCriteria()`** | MYP students see A/B/C/D, GCSE students see Research/Design/Make/Evaluate. Same component, different labels. |
| Task creation UX | **Keyboard-first (Linear-style)** | `Cmd+K` → type title → Tab to set phase → Enter to create. No modal, no form. Speed matters for students who just want to jot down a task. |
| Time tracking integration | **Wire existing FloatingTimer to API** | Timer already works (localStorage). Just need to POST the logged minutes to `planning_tasks.time_logged` on stop. |
| Design phase on tasks | **Explicit field, not inferred** | Could infer from linked page's criterion, but explicit is simpler and lets students plan tasks that span phases. |
| Auto-task generation | **Phase 5 (future)** | Tempting to auto-create tasks from lesson activities, but students should plan their own work first. AI suggests, student decides. |

---

## Design Principles

1. **Phases are columns, not statuses** — the kanban columns ARE the design cycle. Moving a task from B to C means "I've finished developing ideas and I'm now creating." This is pedagogically meaningful.
2. **Speed over features** — a student should be able to add a task in under 3 seconds. No modals, no mandatory fields beyond title.
3. **One data model, three views** — same `planning_tasks` data rendered as kanban, Gantt, or checklist. Student picks their preferred view. No data duplication.
4. **Time tracking is passive, not nagging** — the timer is opt-in. No pop-ups saying "you've been working for 30 minutes!" Just a quiet counter that logs time when the student chooses to use it.
5. **Portfolio captures output, planning tracks process** — portfolio = "what I made." Planning = "how I organized my work." They complement each other, don't overlap.

---

## Related Files

### Existing Components
- `src/components/planning/GanttPanel.tsx` (609 lines) — Gantt chart
- `src/components/planning/PlanningPanel.tsx` (343 lines) — v1 generic kanban (to be retired)
- `src/components/planning/PlanningPanelV2.tsx` (80+ lines) — v2 wrapper
- `src/components/planning/DesignPlanBoard.tsx` (150+ lines) — v2 design cycle kanban
- `src/components/planning/FloatingTimer.tsx` — Time tracker
- `src/components/planning/DueDateDisplay.tsx` — Due date badge
- `src/components/portfolio/PortfolioPanel.tsx` (438 lines) — Portfolio (no changes needed)

### API
- `src/app/api/student/planning/route.ts` (206 lines) — Planning CRUD
- `src/app/api/student/portfolio/route.ts` (162 lines) — Portfolio CRUD

### Reference Docs
- `docs/planning-tools-ux-spec.md` (1,372 lines) — Full UX research + recommendations
- `docs/specs/data-architecture-v2.md` — Dimensions spec (timeWeight, velocity loop)

### Database
- `planning_tasks` table (migration 011) — needs extension with new columns
