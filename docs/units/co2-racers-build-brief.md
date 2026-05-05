# CO2 Racers — Build Brief

> **Goal:** Ship the agency-focused CO2 Racers unit infrastructure in ~5-6 days so Matt can launch with his 9-student class. Class 1 target: as soon as core tools land. Race day: 11 June 2026.
>
> **Spec source:** [`co2-racers-agency-unit.md`](co2-racers-agency-unit.md) (foundation) + [`co2-racers-audit-findings.md`](co2-racers-audit-findings.md) (what to reuse, what to build).
>
> **Push discipline:** Sub-phases ship behind Vercel preview, merged after local tests pass. Only the final smoke (AG.7 Checkpoint AG.1) needs explicit Matt sign-off before unit launches.

---

## What's already built (don't rebuild)

- ✅ NM survey end-to-end (API + storage + student form via `new_metrics` BlockPalette category + teacher results dashboard)
- ✅ Portfolio with `QuickCaptureFAB` + auto-capture pattern (`portfolio_entries` table, page_id + section_index unique index)
- ✅ Preflight student submit flow (`/fabrication/new`, scan, Fabricator pickup)
- ✅ Activity block surface + Lever 1 slot fields (framing/task/success_signal authoring)
- ✅ Last year's wheel CAD files (Matt confirmed students still have access)

## Critical path — 5 days, 5 sub-phases

| Phase | What | Days | Files |
|---|---|---|---|
| **AG.1** | `structured-prompts` responseType + Journal activity + portfolio auto-capture | 0.5 | New responseType + render component + auto-capture wiring |
| **AG.2** | Kanban (data layer + UI + WIP=1 / DoD / blockage triage / time-est / lesson-link) | 2 | New table or `student_progress` extension; new components |
| **AG.3** | Timeline (data layer + backward-map mode + forward-plan mode, Framer Motion) | 1.5 | New table or JSONB; new components |
| **AG.4** | Teacher Attention-Rotation Panel | 1 | New API endpoint + new component |
| **AG.5** | Anchor lesson content (Class 1, 7, 14) — author the activity blocks | 0.5 | Pure content authoring via the existing editor |

**Total: 5.5 days.** Same shape as TG.0C/0D — sub-phases commit-per-task, no squashing, each ships through Vercel preview.

## Optional (after critical path lands)

| Phase | What | Days |
|---|---|---|
| AG.6 | Strategy Canvas + Decision Log (custom tools) | 1 |
| AG.7 | Race Day Predictor (custom tool, build at Class 6) | 0.5 |
| AG.8 | Dashboard cards — TimelineCard + KanbanCard (per-unit, Class 2-3 polish) | 1.5 |

These can land as time permits during the 7-week run. **Critical path is what gets the unit launchable.**

---

## Sub-phase plan

### AG.1 — Journal activity (`structured-prompts` responseType)

**Goal:** Add a new `responseType: "structured-prompts"` to the activity block system. Students fill 4 prompts (Did / Noticed / Decided / Next) + photo. On save, single `portfolio_entries` row written via auto-capture path.

**Sub-tasks:**
1. Add `"structured-prompts"` to ResponseType union in types
2. Author-side: extend the activity block config to accept `prompts: [{ id, label, placeholder }]` array (4 items default = the 4 journal prompts; could be config'd per-unit if needed)
3. Student-side: new `<StructuredPromptsResponse />` component — 4 textareas + required photo upload + Send button
4. Wire submit handler → POST to `/api/student/portfolio` with `{ type: 'entry', content: composed text, media_url, page_id, section_index }`
5. Tests: input validation, photo-required gate, structured payload composition, dedup against unique index

**Reuse:** `QuickCaptureFAB.tsx` patterns for photo compression + content moderation. Single-photo upload (the FAB handles multi already).

**Pre-work:** confirm the activity block JSONB config supports the prompts array shape (likely yes — existing `analysis_prompts` pattern in skills/safety modules is precedent).

**Test target:** ~10 tests (response shape, render edge cases, photo validation, portfolio write).

**Estimated:** 0.5 day. **Commit:** `feat(unit): AG.1 — structured-prompts responseType + Journal activity`

---

### AG.2 — Kanban tool

**Goal:** Per-student Kanban for the unit, supports WIP=1 / DoD / blockage triage / time-estimation loop / lesson-activity links.

**Schema decision:** add `student_unit_kanban` JSONB column on a per-student-unit relationship table OR new table. Audit needed at start of phase. Constraint: must support cheap "summary view" query (column counts + today's Doing card) for the dashboard cards (Phase AG.8).

**Sub-tasks:**
1. **AG.2.1 — Schema + API** (~0.5 day)
   - Decide schema (extend `student_progress` JSONB OR new table — recommend new table `student_unit_kanban` with one row per (student, unit), JSONB columns for state)
   - POST `/api/student/kanban` (upsert state) + GET (read state) + per-card actions
   - Migration script
   - Per Lesson #68: paste-ready paste-and-test on prod after migration written
2. **AG.2.2 — Pure-logic reducer + types** (~0.5 day)
   - State shape: cards array, columns array, WIP limit constant
   - Actions: addCard, moveCard (with WIP validation), markBlocked, setEstimate, setActual, setDoD, deleteCard, etc.
   - Pure reducer extracted to `.ts` per Lesson #71
   - ~20 tests covering all actions + WIP enforcement + DoD validation
3. **AG.2.3 — UI component** (~0.5 day)
   - 4-column board (Backlog / This Class / Doing / Done) with WIP=1 enforcement on Doing
   - Card render: title, DoD chip, time estimate, blocked badge, lesson-activity link
   - Drag-to-move via Framer Motion (or HTML5 DnD if simpler)
   - Blockage triage modal: 4-button picker (Tool / Skill / Decision / Help)
4. **AG.2.4 — Lesson-activity link integration** (~0.5 day)
   - Cards can link to a specific lesson activity (page_id + section_index)
   - Click card → navigate to that activity inline
   - Auto-create card from journal "Next" field (the wiring lives here, not in AG.1)

**Test target:** ~30 tests (reducer + WIP + DoD + blockage triage + link wiring).

**Estimated:** 2 days. **4 commits per sub-task.**

---

### AG.3 — Timeline tool

**Goal:** Per-student Timeline with backward-mapping mode (Day 1) + forward-planning mode (every class).

**Sub-tasks:**
1. **AG.3.1 — Schema + API** (~0.5 day)
   - Same data model decision as AG.2 (extend or new table)
   - Stores: milestones array (target dates per milestone), variance flags
   - GET / PATCH endpoints
2. **AG.3.2 — Pure-logic + types** (~0.5 day)
   - Milestone reducer (drag dates, mark done, compute variance)
   - Tests for ordering invariants (milestones must be chronological), variance thresholds
3. **AG.3.3 — UI: backward-map mode** (~0.5 day)
   - Day 1 use case: Race Day pinned right, drag milestones left
   - Each placement asks "if X by date, when must previous step finish?"
   - Locks once milestones are set (with edit affordance)
4. **AG.3.4 — UI: forward-plan mode + variance viz** (~0.5 day, can compress with .3)
   - Daily mode: "what 2 things move to Done today?"
   - Variance viz: green / amber / red traffic lights against target dates
   - Triggers Surveys 2 + 4 when student marks milestones complete

**Reuse:** Framer Motion drag-and-drop patterns from elsewhere in the codebase (audit at start of phase — there's existing drag handling in lesson-editor and elsewhere).

**Test target:** ~20 tests (reducer + ordering + variance computation).

**Estimated:** 1.5 days. **4 commits per sub-task.**

---

### AG.4 — Teacher Attention-Rotation Panel

**Goal:** Surface students who need 1:1 attention. Bottom-third by Three Cs aggregate, time-since-last-journal, time-since-last-Kanban-move, time-since-last-calibration.

**Sub-tasks:**
1. **AG.4.1 — Aggregation API** (~0.25 day)
   - GET `/api/teacher/student-attention?unitId=X&classId=Y`
   - Returns per-student summary: `last_journal_at`, `last_kanban_move_at`, `last_calibration_at`, `three_cs_score` (computed from `competency_assessments` ratings + Three Cs JSONB)
   - Sort by "needs attention" heuristic (oldest activity wins)
2. **AG.4.2 — Panel component** (~0.5 day)
   - Mounted on the teacher's unit dashboard (specific tab or sidebar)
   - Renders student rows with metrics + "Suggested 1:1 today" callout
   - Click row → opens calibration mini-view: side-by-side self-rating vs teacher-rating + 2-min discussion notes field
3. **AG.4.3 — "Don't rescue" banner** (~0.25 day)
   - Persistent banner at top of teacher's unit dashboard
   - "🛑 Don't rescue. Recovery IS the learning. (Safety + dangerous-mistakes only)"
   - Per Cowork's most insidious pitfall warning. Daily reconditioning.

**Test target:** ~10 tests (aggregation logic + sorting + calibration view).

**Estimated:** 1 day. **3 commits.**

---

### AG.5 — Anchor lesson content authoring

**Goal:** Author the Class 1 + Class 7 + Class 14 anchor activities using the existing editor. NOT a build phase — pure content work.

**Sub-tasks:**
1. **Class 1 launch** — agency mini-lesson with 2-clip hook (find or film clips), Three Cs intro slide, Strategy Canvas activity, baseline survey, backward-map activity, Kanban setup
2. **Class 7 critique** — self-reread prompt, pair-decision-share activity, Kind/Specific/Helpful protocol guide, Survey 3
3. **Class 14 race day** — race format reminder, race recording activity (optional photo of finish), final reflection (deep), Survey 5

**Reuse:** existing activity blocks, NM survey blocks (`new_metrics` BlockPalette category).

**Estimated:** 0.5 day. **Multiple commits per anchor class — content updates only.**

---

### AG.6 — Smoke + Checkpoint AG.1

**Goal:** End-to-end smoke before launching to students. Matt rides through as a test student + reviews as teacher.

**Smoke script:**

1. As teacher: open the unit, register 2-3 NM checkpoints on lessons, verify they appear
2. As teacher: see the "Don't rescue" banner + Attention-Rotation Panel renders empty initially
3. As test student: complete Class 1 — fill Strategy Canvas, set 4 backward milestones, set up 5 Kanban cards
4. As test student: complete Lesson 2 (Ideation) — write a journal entry (4 prompts + photo) → confirm portfolio entry appears in Narrative view
5. As test student: move a Kanban card to Doing (WIP enforces 1) → estimate time → move to Done with `because` clause + actual time
6. As test student: hit a "Blocked" card → triage flow appears with 4-button picker
7. As test student: trigger Survey 2 by marking "Working drawing" milestone done → fill Three Cs comments
8. As teacher: verify NM results dashboard shows the survey response, Attention-Rotation Panel updates, calibration mini-view opens with side-by-side rating
9. Confirm Preflight integration works: submit a test STL via `/fabrication/new`, see scan results, confirm Fabricator pickup flow appears

**Pass criteria:** all 9 steps green. No console errors. No stale data. Self-rating + teacher-rating triangulation works.

**On pass:** unit launches Class 1 (target: as soon as schedule permits).

---

## Pre-work ritual (before AG.1)

1. Working tree clean. On `co2-racers-build-brief` after merging this brief.
2. Baseline tests green. Capture count.
3. Re-read relevant Lessons:
   - **#38** — assert expected, not just non-null
   - **#54** — don't trust WIRING summaries; grep for actual file paths
   - **#67** — pattern bugs across N call sites — when adding a new responseType, audit every consumer
   - **#68** — probe `information_schema.columns` before any INSERT/migration
   - **#71** — pure logic in `.tsx` files isn't testable — extract to `.ts` siblings
   - **#72** — schema-registry drift; verify against actual prod
   - **#73 (informal)** — hiding visible UI requires checking what writes to it (the NM-category mistake)
4. Audit existing patterns to reuse:
   - Drag-and-drop (Framer Motion) — for AG.3 timeline + AG.2 Kanban
   - Per-student JSONB state — does `student_progress` already have a section we should extend?
   - `analysis_prompts` shape — for AG.1 prompts array
   - `QuickCaptureFAB` photo handling — for AG.1 photo upload
5. Registry cross-check (per `build-phase-prep` Step 5c):
   - WIRING.yaml — does `lesson-editor` system gain new key_files? (Yes — AG.1 + AG.2 + AG.3)
   - schema-registry.yaml — new tables for AG.2 + AG.3 need entries on first migration
   - api-registry.yaml — 4-5 new routes (kanban, timeline, attention)
   - feature-flags.yaml — none expected
   - ai-call-sites.yaml — none expected

---

## Stop triggers

- **Schema drift:** if probing `competency_assessments` reveals it's NOT structured as the audit findings doc claims, **stop and reconcile** before AG.1.
- **`structured-prompts` doesn't compose with existing block authoring:** if the editor can't author the prompts array shape natively, scope a small lift to extend BlockPalette (don't rebuild).
- **Drag-and-drop pattern doesn't exist:** if Framer Motion isn't already used for drag, **stop** before AG.3 — adding a drag library mid-phase is its own work.
- **`student_progress` doesn't have a clean extension point:** decide between extending vs new table at AG.2 start, not mid-phase.
- **Lesson #72 trip:** if the schema-registry mentions a column that prod doesn't have (or vice versa), do not silently power through. Reload registry before INSERTing.
- **Preflight scan rules don't exist for STL files of this size:** verify the STL ruleset accepts wheel CAD exports BEFORE Class 8.

## Don't stop for

- Visual polish on the Kanban / Timeline / Attention-Rotation Panel — functional first
- The 3 optional custom tools (Strategy Canvas / Decision Log / Race Day Predictor) — ship critical path first
- The dashboard cards (AG.8) — Phase 2, after launch
- The page_id type mismatch (UUID vs TEXT) — known inconsistency, document don't fix now
- The other declutter items still hidden (Skills panel, Lesson Health) — separate question
- The TG.0E lesson chip — separate phase, not in this unit's scope

---

## Test discipline

- Per Lesson #38: assertion has expected values, not just non-null
- Per Lesson #71: pure logic to `.ts` siblings; tests import from `.ts` not `.tsx`
- Per Lesson #67: when adding a new responseType, audit every consumer (renderers, validators, types unions)
- Coverage target: ~70-80 new tests across AG.1-AG.5
- tsc strict must stay clean for any AG.* file in the commit set

---

## Rollback

If a phase fails badly:
- Revert the merged commits via `git revert <range>` on main
- Schema rollback only if a migration was applied (use the `.down.sql` paired script)
- The unit doesn't go live until smoke passes — there's no in-flight student data to corrupt

---

## Files expected to change

**New (under `src/`):**
- `lib/unit-tools/kanban/{types,reducer,client,validators}.ts` + tests
- `lib/unit-tools/timeline/{types,reducer,client,validators}.ts` + tests
- `components/student/StructuredPromptsResponse.tsx` (AG.1)
- `components/student/UnitKanban.tsx` (AG.2)
- `components/student/UnitTimeline.tsx` (AG.3)
- `components/teacher/UnitAttentionPanel.tsx` (AG.4)
- `app/api/student/kanban/route.ts` (AG.2)
- `app/api/student/timeline/route.ts` (AG.3)
- `app/api/teacher/student-attention/route.ts` (AG.4)

**New migrations:**
- `<timestamp>_unit_tools_kanban.sql` (AG.2.1) + `.down.sql`
- `<timestamp>_unit_tools_timeline.sql` (AG.3.1) + `.down.sql`

**Modified:**
- `src/types/*.ts` — add `"structured-prompts"` to ResponseType union (AG.1)
- `src/components/student/ResponseInput.tsx` — dispatch to new component (AG.1)
- `src/components/teacher/lesson-editor/BlockPalette.tsx` or related — author config support (AG.1, possibly trivial)
- `docs/projects/WIRING.yaml` — extend lesson-editor + add new unit-tools system
- `docs/api-registry.yaml` — scanner sync after new routes land
- `docs/schema-registry.yaml` — new table entries (manual until live introspection scanner ships per FU-SCHEMA-REGISTRY-AUTO-SYNC)

---

## Sequencing suggestion

| Day | Focus |
|---|---|
| **Day 1** | AG.1 (~0.5 day) + start AG.2.1 (~0.5 day) |
| **Day 2** | Finish AG.2.1, do AG.2.2 (~1 day) |
| **Day 3** | AG.2.3 + AG.2.4 (~1 day) |
| **Day 4** | AG.3.1 + AG.3.2 (~1 day) |
| **Day 5** | AG.3.3 + AG.3.4 (~1 day) |
| **Day 6** | AG.4 (~1 day) |
| **Day 7** | AG.5 anchor content + AG.6 smoke |

Class 1 launchable: end of Day 7 if execution stays on plan. Realistically ~10 working days with normal interruptions.

---

## What this brief is NOT

- A schema specification (defer schema decisions to AG.2.1 + AG.3.1 audits)
- A UI/UX specification (defer visual decisions to component implementation; reuse existing patterns)
- A grading rubric specification (the Three Cs rubric is in the foundation doc; teacher applies at grading time, not in code)
- A lesson content specification (Class 2-13 lesson content authored separately during the run, not in this brief)

---

## Architecture questions still pending

These can be answered at the start of each sub-phase, not before kicking off:

1. **AG.2 schema:** extend `student_progress` JSONB or new `student_unit_kanban` table?
   - Recommend: new table for clean separation + per-student-unit row + summary-friendly JSONB column shape.
2. **AG.3 schema:** same question for timeline.
   - Recommend: same approach (new `student_unit_timeline` table).
3. **AG.4 attention scoring:** simple "oldest-activity-wins" sort or weighted heuristic?
   - Recommend: simple sort for v1; weighted comes later if Matt notices the wrong students surfacing.
4. **AG.6 smoke setup:** seed a test student account or reuse Matt's existing test student?
   - Recommend: reuse existing pattern from TG.0C smoke seed scripts.

---

## Provenance

Drafted 6 May 2026 building on:
- Foundation doc (`co2-racers-agency-unit.md`) — pedagogy + design + decisions banked
- Audit findings (`co2-racers-audit-findings.md`) — what's built, what to build (incl. Audit 4 closeout)
- TG.0C / TG.0D brief format as the structural template

Build target: critical path complete in 5-6 working days. Class 1 launches when AG.6 smoke passes.
