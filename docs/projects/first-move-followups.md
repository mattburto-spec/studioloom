# First Move Block — Follow-ups

Tracker for the First Move studio-open orientation block (v1 SHIPPED 12 May 2026). Append-only; resolved items move to the bottom.

System: [`first-move-block` in WIRING.yaml](WIRING.yaml).

---

## FU-FM-RACE-DAY-COUNTDOWN

- **Surfaced:** 12 May 2026 (Phase 0 pre-flight — `units` table has no `end_date` column).
- **Target:** Show "Race day: in N classes (DD MMM)" scrim at the top of the First Move hero card. Anchors student to the deadline that matters.
- **Severity:** P3 — block ships without it; design philosophy + last journal NEXT + Kanban lane already give plenty of context.
- **Origin:** Phase 0 pre-flight. Initial brief proposed this; deferred because no data source.
- **Scope:** Either (a) add `end_date DATE` to `units` (migration + admin UI to edit per unit), OR (b) compute from the latest `planning_tasks.target_date` for this student+unit, OR (c) per-class schedule integration.

## FU-FM-AUTO-ARCHETYPE-AWARE

- **Surfaced:** 12 May 2026 (Phase 5 build).
- **Target:** Make First Move archetype-aware via `getStudentArchetype()`. Hero copy + commitment placeholder vary per archetype (e.g. CO2 dragster → "Verbs, not adjectives" / app design → "Move the user's hand, not the screen").
- **Severity:** P3 — current generic copy works fine for v1.
- **Scope:** Call `/api/student/archetype/[unitId]` on mount, store `archetypeId` in state, swap the placeholder + framing copy per ID. Reuses the existing archetype-aware-blocks infrastructure (A12 in design-guidelines.md).

## FU-FM-TEACHER-DASHBOARD-WIDGET

- **Surfaced:** 12 May 2026.
- **Target:** Surface "Who committed in First Move today / who skipped" on the teacher's Attention-Rotation Panel (per CO2 Racers agency-unit §4.14). The `first-move.committed` learning_event is already emitted — just needs a teacher-side widget reading it.
- **Severity:** P2 — gives teachers the agency signal the block was designed to produce.
- **Scope:** Query `learning_events` WHERE `event_type = 'first-move.committed'` AND `student_id IN (class roster)` AND `created_at > start_of_today()`. Render as a strip on the teacher dashboard: ✓ Committed (N) · 🟡 Started without committing (N) · — Not yet here (N).

## FU-FM-WIP-LIMIT-OVERRIDE

- **Surfaced:** 12 May 2026.
- **Target:** Currently the WIP=1 swap auto-demotes the existing Doing card back to `this_class`. Teachers may want some students to run WIP=2 (multi-stream students who are juggling two simultaneous workstreams). When `wip_limit_doing >= 2` we should NOT demote, just add the new card to Doing.
- **Severity:** P3 — WIP=1 is the right default for v1 cohort.
- **Scope:** Read kanban row's `wip_limit_doing` value in `swapKanbanForFirstMove`, only demote when current `doing_count >= wip_limit_doing`. Test branch covering wip=2 + 1 card in doing → just add, no demote.

## FU-FM-NO-PAYLOAD-EMPTY-STATE

- **Surfaced:** 12 May 2026 (build of v1 — empty-state UX).
- **Target:** Brand-new student (no Class 1 done, no journal entries, empty kanban) sees only the "Today I will…" input + "Pick a card above to enable Start" hint. Could be more welcoming.
- **Severity:** P3.
- **Scope:** Add a friendly empty-state explainer when `payload.thisClassCards.length === 0 && !designPhilosophy && !lastJournalNext` — "Looks like Class 1. Hop into the Strategy Canvas first, then come back here to start your studio session."

---

## Resolved
_(none yet)_
