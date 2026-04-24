# Preflight Phase 8 — Lab + Machine + Fabricator Admin

**Status:** ✅ READY — all 6 open questions resolved "all recommended" 24 April 2026 PM; Phase 7 Checkpoint 7.1 PASSED 12/12; Phase 8-1 unblocked.
**Date drafted:** 24 April 2026 AM
**Date signed off:** 24 April 2026 PM
**Spec source:** `docs/projects/fabrication-pipeline.md` §13 Phase 8 + §14 "Machine profile registry is multi-tenant from day one"
**Predecessor:** Phase 7 (Lab Tech Pickup + Completion) — blocks this because Phase 8's fab-reassignment UI reuses the Phase 1B-2 `/teacher/preflight/fabricators` admin routes + the Phase 7 `/fab/queue` needs to keep working through the migration.
**Blocks:** Multi-lab school onboarding (e.g. Seoul Foreign School pattern from the §11 Q5 brief). NIS-scale single-area schools work with current v1 indefinitely.
**Estimated duration:** ~2–3 days (5 sub-phases, each gated, separate commits). Closely adjacent to the original §13 Phase 8 "Machine Profiles Admin UI" — this brief expands the scope to include **locations** (the originally-Phase-9 `PH6-FU-MULTI-LAB-SCOPING` fold-in) + **a unified visual admin surface**.
**Worktree:** `/Users/matt/CWORK/questerra-preflight`, branch `preflight-active`.

---

## 1. What this phase ships

Phase 1B-2 gave teachers `/teacher/preflight/fabricators` — a list view with "Invite" / "Manage machines" modals. That works for NIS (one lab, a few machines) but doesn't scale:

- **No concept of a physical location** — schools with 3 labs in different parts of the building can't separate them
- **No way to add a machine** — teachers stuck with the 12 seeded templates (can't add a new Bambu A1 or a new xTool F1)
- **Relationships buried in modals** — teacher has to mentally reconstruct "who can run what, where"

This phase replaces the flat list with a **single visual admin page** showing all three axes (location → machine → fabricator) at once. Teachers create locations ("2nd floor design lab", "Makerspace A"), add machines within them, and assign fabricators to machines. Students uploading see machines filtered by their class's default location — no more "pick any Bambu X1C from the school-wide pool".

**Ships:**

1. **`fabrication_labs` table** (new) — `id, school_id, teacher_id, name, description, created_at, updated_at`. Multi-tenant-ready from day one per spec §14.
2. **`machine_profiles.lab_id`** (new FK column, nullable — legacy rows get a default "Unassigned" location).
3. **`classes.default_lab_id`** (new FK column) — so the student machine picker can filter by class → lab → machines. Closes `FU-CLASS-MACHINE-LINK` P3.
4. **`/teacher/preflight/lab-setup`** — the new visual admin page. Replaces the Phase 1B-2 `/teacher/preflight/fabricators` list view (that URL redirects to the new page).
5. **Machine CRUD**: "+ Add machine" from template OR from scratch. Customise dimensions, kerf, operation colour map, `requires_teacher_approval` toggle.
6. **Fabricator reassignment in the new UI** — move a fab to a different machine without opening a modal.
7. **Backfill migration** — every existing `machine_profiles` row gets assigned to a "Default lab" per teacher. Every existing `classes` row gets `default_lab_id = default lab`. Student picker keeps working through the migration without any student-visible change.

## 2. Design decision: drag-drop vs click-based v1

Recommend **Option B (click-based)** for v1, drag-drop as a Phase 9 follow-up.

### Option B (recommended)

Three expandable sections per location:
- **Location header**: name, edit/delete icon, "+ Add machine" button
- **Machines within**: card grid, each card shows machine name + icon + bed size + fab avatars
- **Click machine card** → side panel opens with: spec fields, operation colour map (lasers), assigned fabricators (chip list with "+ Assign" button)

Why:
- Ships ~30-50% faster (no DnD plumbing, no keyboard-accessibility audit)
- More accessible out of the box (tab-navigable, screen-reader-friendly)
- Supports all the same actions drag-drop would
- Real-world teachers don't reorganise layout daily — click-to-move is fine

### Option A (drag-drop v2)

`@dnd-kit/core`, three columns, drag machine between locations, drag fab onto machine. Pretty in a demo; ~1 extra day of work + accessibility audit cost. File as `PH8-FU-DRAG-DROP` P3 for post-pilot if teachers ask.

## 3. Sub-phase split (5 instruction blocks)

### 8-1 — Migration + backfill

- Migration 111 (or whatever's next at phase-open): `fabrication_labs` table, `machine_profiles.lab_id` FK (nullable for migration safety), `classes.default_lab_id` FK.
- Backfill script: for each teacher, create a "Default lab" row, set every owned `machine_profiles.lab_id` to it, set every owned `classes.default_lab_id` to it.
- Defensive: idempotent — safe to re-run if Matt needs to ship a partial state.
- Tests: migration tests + backfill tests + RLS audit on the new table.

**Est:** ~0.5 day.

### 8-2 — Lab CRUD + machine-to-lab reassignment API

- `/api/teacher/labs` — POST (create), GET (list my labs), PATCH (rename/update), DELETE (soft-delete with reassign-or-block).
- `/api/teacher/labs/[id]/machines` — PATCH to reassign a machine to a different lab.
- Orchestration: `createLab`, `listMyLabs`, `updateLab`, `deleteLab`, `reassignMachineToLab`, all teacher-scoped.
- Safety rails on delete: can't delete a lab with machines in it unless they're first reassigned. Clear 409 on attempted delete.
- Tests: +~25 route + orchestration.

**Est:** ~0.5 day.

### 8-3 — Machine CRUD from the teacher side

- `/api/teacher/machine-profiles` — POST (create from template OR from scratch), PATCH (update fields), DELETE (soft-delete if no active jobs).
- Orchestration: `createMachineProfile`, `updateMachineProfile`, `deleteMachineProfile`.
- Currently 12 system-template machines. Copy-from-template = INSERT with fields inherited + `teacher_id = self` + `is_system_template = false`.
- Laser-cutter operation colour map editor (6+ layers × RGB colour picker). Complex UI-side, simple data-side (JSONB column).
- Tests: +~20 route + orchestration.

**Est:** ~0.5 day.

### 8-4 — Visual lab admin page (click-based)

- `/teacher/preflight/lab-setup` — replaces `/teacher/preflight/fabricators` (that URL redirects).
- Layout: vertical stack of location cards. Each location = expandable. Inside: machine card grid. Click machine → side panel with spec fields + operation colour map + fabricator chips.
- "+ Add location" button at top.
- "+ Add machine" button per location.
- Fabricator chips with "+ Assign fabricator" opens a picker modal (list of the teacher's invited fabricators, multi-select).
- Drag-drop explicitly OUT of scope per Option B.
- Invite-new-fabricator inline button (reuses Phase 1B-2 invite flow).
- Tests: mostly helper tests (the UI state reducer etc.), some route tests for reassignment paths.

**Est:** ~1 day.

### 8-5 — Student picker filter by `default_lab_id` + Checkpoint 8.1 smoke + saveme

- Student `/api/student/fabrication/picker-data` — when the student picks a class, only return machines where `machine_profiles.lab_id = class.default_lab_id`. Current unfiltered behaviour becomes "if class has no default_lab_id, show all" (legacy fallback for any edge case).
- Student upload page — no UI change needed (machines dropdown just shows the filtered set).
- Checkpoint 8.1 report with smoke scenarios:
  1. **Location CRUD** — create "2nd floor design lab" → add 2 Bambu X1Cs → rename → delete (with reassign prompt).
  2. **Machine CRUD** — add a custom machine from scratch, edit dimensions, save.
  3. **Fabricator assignment** — assign a fab to a machine, click through, confirm the fab's `/fab/queue` now shows jobs for that machine.
  4. **Student picker filter** — upload as student, verify only the class's lab's machines show.
  5. **Migration safety** — verify existing NIS jobs still work end-to-end after the migration.

**Est:** ~0.5 day.

## 4. Success criteria (Checkpoint 8.1)

- [ ] `fabrication_labs` migration applied to prod. Backfill verified: every existing machine has a lab, every class has a default lab.
- [ ] Lab CRUD endpoints work with ownership scoping (teacher can't modify another teacher's labs).
- [ ] Machine CRUD from template + from scratch. Laser operation colour map editable + persists correctly.
- [ ] Fabricator reassignment surface-level: click a chip → move to different machine → verify the fab's queue reflects the change.
- [ ] `/teacher/preflight/lab-setup` renders all three axes (location → machine → fab) correctly for a teacher with real data.
- [ ] Old `/teacher/preflight/fabricators` URL redirects to the new page (saves bookmarks).
- [ ] Student picker correctly filters by `class.default_lab_id`. Legacy NULL fallback doesn't break anything.
- [ ] Prod smoke: all 5 scenarios verified as Matt.
- [ ] `npm test`: +60–80 new tests.
- [ ] `docs/projects/WIRING.yaml` updated — new `fabrication-labs` system.
- [ ] Checkpoint 8.1 report filed.

## 5. Resolved decisions (signed off 24 Apr PM — "all recommended")

All 6 open questions locked in per the original recommendations:

1. ✅ **Entity name: `fabrication_labs` in DB + "Labs" in UI.** Single vocabulary across DB + UI keeps the mental model clean. "2nd floor design lab" reads naturally; "Location" was a hedge for smaller schools but adds a vocabulary split with zero upside.
2. ✅ **Default-lab strategy: auto-create "Default lab" per teacher on migration.** Zero-disruption rollout — every existing `machine_profiles` row gets `lab_id = <teacher's default lab>`; every existing `classes.default_lab_id` points at the same row. Students + fabricators see no change. Teachers can rename the auto-created lab or add more later.
3. ✅ **Cross-teacher visibility: NO — scope by `teacher_id`.** Matches every other Preflight resource. Multi-teacher shared labs = Phase 9+ after access-model-v2 (FU-O/P/R) ships school-membership + dept-head roles.
4. ✅ **Who creates labs: any teacher.** Dept-head role doesn't exist yet. Stricter governance is a later-add.
5. ✅ **Student-side impact: class-dictated silent filter.** Student picker auto-filters machines by `class.default_lab_id`. No student-facing "pick a lab" UI. Advanced cross-lab submission = Phase 9+.
6. ✅ **UI: click-based (Option B).** Ships ~30-50% faster, accessible out of box, real-world teachers don't reorg layout daily. Drag-drop filed as `PH8-FU-DRAG-DROP` P3 for post-pilot if teachers ask.

---

## 6. Pre-conditions (all ✅ as of 24 Apr PM — 8-1 unblocked)

- [x] Phase 7 Checkpoint 7.1 PASSED + report marked ✅ (12/12 PASS, signed off 24 Apr PM)
- [x] Phase 7 merged to main (`7fefd6e` pre-smoke + `d5eb596` hotfix + `2e576fc` saveme)
- [x] Matt has resolved the 6 open questions above (signed off "all recommended" 24 Apr PM)
- [x] No outstanding Phase 7 production bugs (4 open follow-ups all P2/P3, Phase 9 scope — not blocking)

## 7. Known deviations from original spec

Original `fabrication-pipeline.md` §13 Phase 8 was just "Machine Profiles Admin UI — Teacher UI: create profile from template, customise, manage active profiles / Operation colour map editor for laser profiles / Rule overrides UI (advanced — collapsed by default)".

This brief **folds in Phase 9's lab-scoping work + reshapes the entire admin surface** to be visual + relational instead of three flat list pages. Net effect: the original Phase 9 estimate (`~1–2 days`) is absorbed into this phase's `~2–3 days`, and Phase 9 becomes "Analytics + Polish" (the other original bullets).

The **"Rule overrides UI"** from the original §13 Phase 8 is explicitly DEFERRED to Phase 9 (or later) — most teachers will never touch rule thresholds, and this phase is already ambitious enough without a separate rule-editor section.

---

**Status 24 Apr PM:** ✅ READY. All pre-conditions met. Phase 8-1 (migration + backfill) opens next — see dedicated brief: `preflight-phase-8-1-brief.md` (draft pending).
