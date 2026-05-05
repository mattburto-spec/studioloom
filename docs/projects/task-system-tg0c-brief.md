# Task System — TG.0C Brief: Tasks Panel Sidebar + `+ Add task` Chooser + Quick-Check Inline Form

> **Goal:** Land the teacher-facing Tasks panel sidebar in the lesson editor + the `+ Add task` chooser + the inline-row Quick-Check (formative) form. After this, summative project tasks (TG.0D, separate phase) can plug into the same panel; the lesson chip (TG.0E) reads from `task_lesson_links` rows the panel writes.
> **Spec source:** [`task-system-architecture.md`](task-system-architecture.md) §Teacher UI (lines 427–502).
> **Prototype:** [`docs/prototypes/tasks-v1/`](../prototypes/tasks-v1/) — Artboard 2 (split-surface variant) is the design reference for both the sidebar layout and the chooser modal.
> **Estimated effort:** 2 days.
> **Checkpoint:** **Checkpoint TG.0C.1** — teacher creates a Quick-Check formative task in <30 seconds inline, the row persists across page reload, and the writer hits `assessment_tasks` + `task_criterion_weights` + `task_lesson_links` tables in a single transaction. No regression on existing skill-panel or NM-block surfaces.
> **Push discipline:** Per memory ("Don't gate on Matt's manual testing — push sub-phases through Vercel preview and continue"), each sub-phase ships behind a Vercel preview deploy. Only Checkpoint TG.0C.1 (full smoke on a real unit) needs explicit Matt sign-off. Push to `origin/main` after each sub-phase passes its preview smoke + tests pass.

---

## What's already locked (from TG.0A + TG.0B)

| Ref | Decision |
|---|---|
| Brief §Verdict | **Split UI surfaces** for formative vs summative. Inline-row formative (this phase) and 5-tab summative drawer (TG.0D) live side by side in the same Tasks panel. |
| Brief §Three-layer | Tasks panel is **Layer 3 mode-specific** (structured mode). Inquiry-mode milestones get a sister panel later; the panel slot itself is reusable. |
| Brief §Data model | `assessment_tasks.config` JSONB is the type-specific extension point. Quick-Check writes minimal config; project tasks (TG.0D) write GRASPS / submission / rubric / timeline / policy blocks. |
| OQ-5 | **Drawer not full-page** for summative. Quick-Check has no drawer — it's an inline-row expand inside the panel itself. |
| Cowork #2 | `task_lesson_links` is a join table (PK `task_id, unit_id, page_id`), queryable from either side. Quick-Check optionally writes 0..N rows here. |
| Cowork #3 | `task_criterion_weights` is per (task, criterion). Quick-Check writes one row per linked criterion. Default weight = 100. |
| Lesson #71 | Pure logic in `.tsx` files isn't testable — extract to sibling `.ts` modules before writing tests. |
| Lever-MM precedent | The NM block category is the architectural sibling: `BlockCategory` enum, click-to-add chips, panel section above the lesson list. Tasks panel mimics the same vertical slot but with its own component (sibling, not a category). |

---

## Pre-work ritual (Code: complete BEFORE any TSX)

1. **Working tree clean.** `cd /Users/matt/CWORK/questerra-tasks && git status` — nothing unrelated. On `task-system-build` after merging `task-system-tg0c-brief`.
2. **Baseline tests green.** `npx vitest run --reporter=basic 2>&1 | tail -5` — capture the count. Lesson #38: **assert expected, not just non-null.** The Lever-MM merge bumped tests to ~3735; Lever 1 was 3630–3700. Whatever the actual baseline is on `task-system-build` HEAD, that's the reference for "no regression."
3. **Probe prod schema (Lesson #68).** Before any INSERT, paste this into Supabase SQL editor and confirm columns exist:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name IN ('assessment_tasks', 'task_lesson_links', 'task_criterion_weights')
   ORDER BY table_name, ordinal_position;
   ```
   Expected: 11 cols on `assessment_tasks` (incl. `config JSONB`, `task_type` CHECK), 3 on `task_lesson_links`, 4 on `task_criterion_weights`. **Stop and report if any column is missing or NULL-able where the brief says NOT NULL.**
4. **Audit existing lesson-editor sidebar architecture.**
   ```bash
   rg -n "skill_panel|SkillPanel|skills-sidebar" src/ --type ts --type tsx | head -20
   rg -n "BlockPalette|block-palette|BlockCategory" src/ --type ts --type tsx | head -20
   rg -n "new_metrics|NM block|nm-element" src/components --type tsx | head -10
   ```
   Report: where does the skill panel mount? What's the prop shape (className? layout slot? data dependency)? How does the NM block category integrate with `BlockPalette` (Lever-MM PR #19)? **The Tasks panel mounts the same way — match the existing pattern, don't invent a new one.**
5. **Audit existing criterion picker / framework adapter usage.**
   ```bash
   rg -n "FrameworkAdapter|criterion_keys|neutralCriterion" src/lib --type ts | head -20
   rg -n "criterion-picker|CriterionPicker|criterion.*pill" src/components --type tsx | head -10
   ```
   The Quick-Check form uses a single-select criterion pill picker. If a component already exists (Calibrate / Synthesize / G1 work probably has one), reuse it. If not, the new component is the simplest possible — pill list seeded from the unit's framework via `FrameworkAdapter.getCriteria(framework)`.
6. **Audit existing teacher-task API routes.** Look for any pre-existing route under `/api/teacher/tasks/` that the half-shipped G1 work might have left behind:
   ```bash
   ls src/app/api/teacher/ 2>&1 | grep -iE "task|grad|assess" | head -20
   rg -n "assessment_tasks" src/app/api --type ts | head -10
   ```
   If anything exists, decide: extend or replace? Extend if it matches the new schema; replace + redirect if it's G1 vintage.
7. **Registry cross-check (per `build-phase-prep` Step 5c, added 29 Apr 2026).** This phase touches ≥3 files (panel component, chooser, inline form, API route, test). Spot-check ONE entry per registry against code:
   - `WIRING.yaml` — does `lesson-editor` system have an entry? Will it gain a `tasks-panel` dep?
   - `schema-registry.yaml` — verify `assessment_tasks` entry matches what was applied (added in close-out PR #32).
   - `api-registry.yaml` — confirm no existing `/api/teacher/tasks/*` route claims the namespace we'd write into.
   - `feature-flags.yaml` — does the panel need a flag? **No** — we're shipping to all teachers; if the panel rendering breaks, the existing skill panel is unaffected.
   - `ai-call-sites.yaml` — none. Quick-Check is form-driven, no AI.
   - `data-classification-taxonomy.md` — `assessment_tasks.title` + `assessment_tasks.config` text — likely `pseudonymous` (teacher-authored, not student PII).
8. **Lesson #54 — Don't trust WIRING summaries.** If WIRING claims "lesson-editor.tasks-panel exists" anywhere, grep for the actual file path before believing it.
9. **STOP AND REPORT** all pre-work findings before writing any TSX. Confirm with Matt only on actual unknowns; the discipline says "don't pause to ask permission for things already in the brief."

---

## Lessons to re-read (full text, not titles)

- **#38** — Verify expected values, not just non-null. Tests must assert specific row counts, specific column values, specific RLS policy names.
- **#54** — WIRING summaries lie; grep for actual file paths before believing them.
- **#67** — Pattern bugs across N call sites — when adding a new entry to a discriminated union (`BlockCategory`, `task_type`), audit every consumer.
- **#68** — Probe `information_schema.columns` before any INSERT.
- **#71** — Pure logic in `.tsx` files isn't testable — extract to sibling `.ts`.
- **#72** — **Schema-registry drift causes prod failures.** This phase doesn't add tables, but if any TG.0D-K work later does, scanner audit applies. Today: trust prod (it has the columns), not the registry.

---

## Sub-phase plan (commit per sub-task — no squashing)

### TG.0C.1 — API contracts + types layer (~3 hr)

**What:** Establish the typed contract for `assessment_tasks` + `task_lesson_links` + `task_criterion_weights`. No UI yet. Pure schema.

- `src/lib/tasks/types.ts` — `AssessmentTask`, `TaskLessonLink`, `TaskCriterionWeight`, `TaskConfig` interfaces. `TaskConfig` is a discriminated union keyed on `task_type`. `FormativeConfig` (TG.0C scope) has just `criteria: string[]`, optional `due_date: string`, optional `linked_pages: { unit_id, page_id }[]`. `SummativeConfig` is a stub for TG.0D.
- `src/lib/tasks/validators.ts` — Zod (or hand-rolled, match repo convention) input validators for the create-task endpoint.
- `src/lib/tasks/client.ts` — typed fetch wrappers for the panel to call (e.g. `createFormativeTask`, `listTasksForUnit`, `deleteTask`). Client-only, no Supabase imports.
- `src/lib/tasks/__tests__/validators.test.ts` — unit tests for the validators (good payload, missing fields, type-mismatch, oversize title, criterion key not in framework's allowed list).

**Verify:** `npx vitest run src/lib/tasks` — new tests pass; baseline still green.

**Commit:** `feat(task-system): TG.0C.1 — task API contracts + types`

### TG.0C.2 — POST /api/teacher/tasks + GET /api/teacher/tasks?unit_id= (~3 hr)

**What:** Two API routes. POST writes one row across 3 tables in a transaction. GET lists tasks for a unit, joining `task_criterion_weights` + `task_lesson_links`.

- `src/app/api/teacher/tasks/route.ts` — POST handler. Service-role client (RLS bypass for the write — the route does its own auth check via `getTeacher()`). Validates payload via TG.0C.1 validator. Single Postgres transaction:
  1. INSERT `assessment_tasks` (task_type='formative', status='draft', config={criteria, due_date, linked_pages}, school_id from teacher)
  2. INSERT N rows into `task_criterion_weights` (one per criterion, weight=100, no rubric_descriptors yet — formative skips them)
  3. INSERT M rows into `task_lesson_links` (one per `linked_pages` entry)
- `src/app/api/teacher/tasks/route.ts` — GET handler. Returns `{ tasks: AssessmentTask[] }` with `criteria` + `linked_pages` denormalized into the task object for panel rendering.
- Auth pattern: match existing teacher routes (e.g. `/api/teacher/units/route.ts`) — no need to invent. Use the same `getTeacher()` / `requireTeacher()` helper.
- `src/app/api/teacher/tasks/__tests__/route.test.ts` — happy-path POST, missing school_id (should 400), criterion not in framework's allowed list (should 400), GET returns expected shape.

**Verify:** `npx vitest run src/app/api/teacher/tasks` — passes; tsc strict clean.

**Commit:** `feat(task-system): TG.0C.2 — POST/GET /api/teacher/tasks`

### TG.0C.3 — Tasks panel sidebar component (read-only first) (~3 hr)

**What:** The sidebar component itself. Reads tasks via TG.0C.2 GET. Renders the row list per the brief §Tasks panel sketch. No write actions yet.

- `src/components/lesson-editor/TasksPanel.tsx` — React component. Takes `unitId: string` prop, calls `useTasksForUnit(unitId)` (a thin TanStack-or-existing-pattern hook), renders the list. Empty state: "No tasks configured yet. Backward design starts here →" (per brief).
- `src/components/lesson-editor/TasksPanel.types.ts` — pure types (Lesson #71 — extract anything we'll test from the .tsx).
- `src/components/lesson-editor/__tests__/tasks-panel-render.test.ts` — pure-logic test for the row formatter (the part that turns `AssessmentTask` into the display string `"⚡ Quiz 1 (formative) · A · Mon 12 May"`).
- Mount in the existing lesson editor — find the actual file (TG.0C.0 audit Step 4 produces this), drop the panel above the lesson list, sibling to the skill panel + NM block category. Match the existing layout class names; don't introduce new CSS unless something genuinely new is needed.

**Verify:** Push to feature branch → Vercel preview. Open existing test unit, confirm panel renders empty state. No regression on skill panel or NM block category.

**Commit:** `feat(task-system): TG.0C.3 — TasksPanel sidebar (read-only)`

### TG.0C.4 — `+ Add task` chooser + Quick-Check inline-row form (~4 hr)

**What:** The write flow. `+ Add task` button at the bottom of the panel opens an inline 2-button chooser ("Quick check" / "Project task — Coming soon" greyed out for TG.0C; TG.0D enables it). Click "Quick check" → row expands inline with the 4 fields per brief.

- `src/components/lesson-editor/AddTaskChooser.tsx` — the 2-button chooser. Project-task button is disabled with "Configure in TG.0D" tooltip until TG.0D ships.
- `src/components/lesson-editor/QuickCheckRow.tsx` — the inline form. 4 fields: title (text), criteria (single-select pill picker — reuse from audit Step 5 if found, else minimal new component), due date (`<input type="date">` — match existing date-picker pattern), linked sections (multi-select dropdown of unit's lessons, defaults to "any work in this unit" empty array).
- `↵` to save = call POST `/api/teacher/tasks`, optimistic add to the panel list, server response replaces optimistic row. ESC to cancel collapses without writing. Match existing inline-edit patterns in the codebase (skill panel quick-add, if it exists).
- `src/components/lesson-editor/__tests__/quick-check-row-validators.test.ts` — pure-logic tests for the form-state reducer (title required, criterion required, due date optional, linked sections optional, payload built correctly).

**Verify:** Push to preview → smoke: create a Quick-Check task in <30 seconds, refresh page, task persists. Check Supabase: 1 row in `assessment_tasks` (task_type='formative', config has `criteria` + `due_date`), N rows in `task_criterion_weights`, 0..M rows in `task_lesson_links`.

**Commit:** `feat(task-system): TG.0C.4 — AddTaskChooser + QuickCheckRow inline form`

### TG.0C.5 — Delete + edit affordances (~2 hr)

**What:** Hover row → reveal `✕` and pencil icons. `✕` deletes (with confirm — "Delete Quiz 1? This can't be undone."), pencil re-expands the row inline for edit. No drawer, no modal — same inline pattern.

- `DELETE /api/teacher/tasks/[id]/route.ts` — soft-delete? Hard? Per brief, just CASCADE — `assessment_tasks ON DELETE CASCADE` already wipes weights + links. Hard delete is fine for v1; if undo is needed later, add `deleted_at` then.
- `PATCH /api/teacher/tasks/[id]/route.ts` — partial update (title, criteria, due_date, linked_pages). Updates the row + reconciles weights + links (DELETE old, INSERT new — simpler than diffing for a tiny set).
- Wire into TG.0C.4's row component.
- Tests: PATCH happy path, PATCH unknown-id 404, DELETE happy path + cascade verification (criterion_weights + lesson_links cleaned up).

**Verify:** Smoke: edit task title → reload → persisted. Delete task → reload → gone. Children rows in DB cleared (`SELECT COUNT(*) FROM task_criterion_weights WHERE task_id = $1` returns 0).

**Commit:** `feat(task-system): TG.0C.5 — task delete + edit (PATCH/DELETE routes)`

### TG.0C.6 — Registry sync + WIRING update + smoke seed (~1.5 hr)

**What:** Bookkeeping for the new system. Same pattern as preflight phase close-outs.

- `docs/projects/WIRING.yaml` — add `tasks-panel` system entry (or extend `lesson-editor` with the new panel). `affects`: lesson-editor surface; `deps`: assessment_tasks table, FrameworkAdapter; `change_impacts`: lesson chip (TG.0E) reads task_lesson_links; G1 grading panel (TG.0G) reads assessment_tasks.
- `python3 scripts/registry/scan-api-routes.py --apply` — pick up the new 3 routes (POST/GET /api/teacher/tasks, PATCH/DELETE /api/teacher/tasks/[id]).
- `scripts/seed-data/seed-tg0c-test-unit.sql` — seed a unit with a class + framework set + 2 pre-existing Quick-Check tasks (so the panel renders something on a fresh smoke). Idempotent (`ON CONFLICT DO NOTHING`).
- `docs/handoff/task-system-build.md` — update with TG.0C complete, TG.0D ready to start.

**Verify:** Run scanner, diff yaml, commit only meaningful changes (no timestamp churn).

**Commit:** `chore(task-system): TG.0C.6 — registry sync + smoke seed`

### TG.0C.7 — Matt Checkpoint TG.0C.1 (full smoke)

**What:** Hand to Matt. Smoke script:
1. Open a real unit on Vercel preview (or prod after merge — Matt's call).
2. Confirm Tasks panel renders above the lesson list, empty state shows.
3. Click `+ Add task` → choose Quick check → enter title, pick criterion A, set due date, hit ↵.
4. Row appears in panel. Refresh page. Row still there.
5. Edit title → save. Refresh. New title persists.
6. Delete task. Confirm. Row gone. Refresh. Still gone.
7. Verify in Supabase: child rows in `task_criterion_weights` + `task_lesson_links` are also gone (CASCADE).
8. Confirm no regression: skill panel still works, NM block category still works, lesson editing still works.

**Pass criteria:** All 8 steps green. No console errors. No JSX boundaries crossed (Lesson #71). All schema writes hit the right tables.

**On pass:** Merge `task-system-build` → `main`, push, mark TG.0C complete in ALL-PROJECTS, kick off TG.0D.

---

## Stop triggers (any of these → pause + report)

- **Schema not as expected** — pre-work probe (Step 3) shows `assessment_tasks.config` missing or wrong type → **stop, investigate registry vs prod drift** (this is exactly Lesson #72; do NOT just power through).
- **Existing teacher-task route exists from G1** — audit Step 6 finds a vintage route → **stop, decide extend-vs-replace** before writing the new route.
- **FrameworkAdapter doesn't expose `getCriteria(framework)`** in the shape we need → it's a schema dependency we missed → escalate, don't shim.
- **The skill panel and NM block category use INCOMPATIBLE mounting patterns** (e.g. one is a child of `<BlockPalette>`, the other is a sibling of `<LessonList>`) → the Tasks panel needs a clean architectural slot; pick one and document the choice in the brief.
- **Quick-Check criterion picker can't be reused from G1** — G1 might have hard-coded MYP-only labels. Reuse only if it's framework-aware. Otherwise build the smallest possible new picker.
- **Vercel preview build fails** on TG.0C.3 (panel mount) — likely a server/client component boundary issue or an import cycle. **Stop, fix, re-push** — don't pile next sub-phase on a broken preview.
- **Optimistic update + server reconciliation drifts** (Lesson #38 — verify expected, not just "no error") — if the optimistic row's id doesn't match the server-assigned UUID after reconciliation, the panel will double-render. Check this explicitly in TG.0C.4.

## Don't stop for

- Visual polish (chip colors, icon weights, font tweaks) — functional first; polish in v1.1.
- The Project-task button being disabled — it's TG.0D's surface, not a regression.
- The lesson chip not appearing on lesson cards — that's TG.0E.
- Student-side surfaces — that's TG.0F.
- ManageBac export — that's TG.0H.
- The 5-tab summative drawer — that's TG.0D, separate phase.
- Refactoring `/teacher/marking` to be task-scoped — that's TG.0G.
- Fixing the `task-system-build` branch's pre-existing tsc errors in pipeline test files (Lever 1 fallout) — file an FU, don't fix here.
- Re-sorting `schema-registry.yaml` alphabetically — wait for FU-SCHEMA-REGISTRY-AUTO-SYNC.

---

## Test discipline

- **Per Lesson #38:** assertion has expected values, not just `not.toBeNull()`. Row count, specific column values, specific RLS policy names.
- **Per Lesson #71:** pure logic extracted to `.ts` siblings before tests; tests import from `.ts` not `.tsx`.
- **Per Lesson #68:** probe `information_schema.columns` once at TG.0C.0 pre-work; trust prod from there. If TG.0D-K wants to add columns, they re-probe.
- Coverage target: 8–12 new tests across validators, route handlers, and pure-logic extractors. No component-render tests (no `@vitejs/plugin-react` — Lesson #71 boundary).
- tsc strict must stay clean for any file in this phase's commit set. Pre-existing errors on the branch (pipeline test files) are NOT my problem to fix here.

---

## Rollback

If TG.0C.7 Checkpoint fails badly:
- Revert the merged commits via `git revert <range>` on `main` — no schema rollback needed (no migrations in this phase). The 5 tables + 2 ALTERs from TG.0B stay applied; rolling back TG.0C just removes the UI/API surface, leaving the schema unused but harmless.
- Open follow-up: investigate root cause, write a recovery brief, retry.
- DO NOT roll back TG.0B's migration — that's load-bearing for everything downstream + is purely additive on prod.

---

## Files expected to change

- **NEW:** `src/lib/tasks/types.ts`, `src/lib/tasks/validators.ts`, `src/lib/tasks/client.ts`, `src/lib/tasks/__tests__/validators.test.ts`
- **NEW:** `src/app/api/teacher/tasks/route.ts`, `src/app/api/teacher/tasks/[id]/route.ts`, `src/app/api/teacher/tasks/__tests__/route.test.ts`
- **NEW:** `src/components/lesson-editor/TasksPanel.tsx`, `src/components/lesson-editor/TasksPanel.types.ts`, `src/components/lesson-editor/AddTaskChooser.tsx`, `src/components/lesson-editor/QuickCheckRow.tsx`
- **NEW:** `src/components/lesson-editor/__tests__/tasks-panel-render.test.ts`, `src/components/lesson-editor/__tests__/quick-check-row-validators.test.ts`
- **NEW:** `scripts/seed-data/seed-tg0c-test-unit.sql`
- **MODIFIED:** the lesson editor mount file (TBD by audit Step 4) — add `<TasksPanel unitId={unit.id} />` above the lesson list
- **MODIFIED:** `docs/projects/WIRING.yaml`, `docs/api-registry.yaml`, `docs/projects/ALL-PROJECTS.md`, `docs/projects/task-system-architecture.md` (status flip), `docs/handoff/task-system-build.md`

---

## Questions Matt may want to confirm before I start

(Per memory: don't gate on manual testing; do gate on architecture questions. These are the latter.)

1. **Task panel placement** — above the lesson list (per brief sketch lines 433–453), OR as a tab in the existing skill/blocks/NM panel area? Brief says above; double-check if any UX intent has shifted since.
2. **Quick-Check criterion picker — single-select or multi-select?** Brief line 466 says single-select. Confirm — MYP teachers may want a Quick Check that touches A+B together. Easy to flip to multi later, but data model already supports multi (one row per criterion in `task_criterion_weights`).
3. **Default linked-sections on Quick-Check** — empty array ("any work in this unit") OR auto-populate the lesson the panel was opened from? Brief says "optional — defaults to any work in this unit." Confirm — auto-populating is a small UX nudge that may earn its keep.
4. **Project-task button enabled in TG.0C** with a "Coming soon — TG.0D" empty state, OR fully hidden? Empty-state is more honest (teachers see what's coming); hidden is cleaner. I'll default to greyed-out with tooltip; flip if Matt prefers hidden.

If none of these need an answer, the brief is self-sufficient and I start TG.0C.1 immediately.
