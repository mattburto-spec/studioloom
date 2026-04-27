# Preflight Phase 8 — Lab + Machine + Fabricator Admin

**Status:** ✅ READY (revised) — all 6 open questions re-resolved 27 April 2026 after Matt challenged Q3 (cross-teacher visibility) and Q2 (default-lab scope). The 24 Apr "all recommended" sign-off is superseded; this brief now reflects school-scoped lab ownership using existing migration 085 `schools` infrastructure.
**Date drafted:** 24 April 2026 AM
**Date signed off:** 24 April 2026 PM (initial "all recommended"); **revised + re-signed 27 April 2026 PM** (Q2 + Q3 flipped — see §5 + §5b).
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

1. **`fabrication_labs` table** (new) — `id, school_id NOT NULL REFERENCES schools(id), name, description, created_by_teacher_id REFERENCES teachers(id), created_at, updated_at`. Owned by the **school**, not by an individual teacher. `created_by_teacher_id` is **audit only** — it doesn't gate access. Schools entity already exists (migration 085, shipped); this leverages it. Visibility predicate: `WHERE school_id IN (SELECT school_id FROM teachers WHERE id = current_teacher_id)` — every teacher at the same school sees + edits the same labs.
2. **`machine_profiles.lab_id`** (new FK column, nullable initially for backfill safety; NOT NULL after migration completes).
3. **`teachers.default_lab_id`** (new FK column, nullable) — per-teacher lab preference. Seeds the dropdown when the teacher creates a new class. **Different from** `classes.default_lab_id` which is the binding ground truth.
4. **`classes.default_lab_id`** (new FK column) — per-class binding lab. Student upload flow reads this. Closes `FU-CLASS-MACHINE-LINK` P3. The G4 design teacher's class defaults to PYP lab; the G8 design teacher's class defaults to MYP lab — even though they're at the same school.
5. **`/teacher/preflight/lab-setup`** — the new visual admin page. Replaces the Phase 1B-2 `/teacher/preflight/fabricators` list view (that URL redirects). All teachers at the school see the same labs page; edits propagate (Cynthia adds a lab, Matt sees it on next refresh).
6. **Machine CRUD**: "+ Add machine" from template OR from scratch. Customise dimensions, kerf, operation colour map, `requires_teacher_approval` toggle.
7. **Fabricator reassignment in the new UI** — move a fab to a different machine without opening a modal.
8. **Backfill migration** — two-step: (a) for each school, create a "Default lab" row owned by `school_id`; (b) prompt each teacher on next login to pick their `teachers.default_lab_id` from the labs visible to their school, which then cascades to all their existing classes' `default_lab_id` (single UPDATE per teacher). Existing `machine_profiles` rows initially set `lab_id = <school's default lab>`; teachers can split into subsidiary labs (PYP, MYP, etc.) afterwards. Student picker keeps working throughout — legacy NULL fallback shows all school machines.

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

- Migration (timestamp-prefixed per CLAUDE.md): `fabrication_labs` table (school-owned, see §1.1), `machine_profiles.lab_id` FK (nullable initially), `classes.default_lab_id` FK, `teachers.default_lab_id` FK.
- Backfill script (idempotent):
  - **Pass 1:** for each `schools.id` that has at least one teacher with machines, create a single "Default lab" row owned by that `school_id`. (Schools with no machines get no lab — won't accidentally land in the picker.)
  - **Pass 2:** for each `machine_profiles` row, set `lab_id` = the default lab of `(SELECT school_id FROM teachers WHERE id = machine_profiles.teacher_id)`. Rows where the owning teacher has `school_id IS NULL` are flagged for the migration error report (see Edge Case below).
  - **Pass 3:** for each `teachers` row with non-null `school_id`, set `default_lab_id` to the school's default lab.
  - **Pass 4:** for each `classes` row, set `default_lab_id` = teacher's default lab (cascades from Pass 3).
- **Edge case — teachers without `school_id`:** existing accounts that joined before migration 085's welcome wizard or skipped it. Migration cannot guess their school. Three handled paths:
  1. Force-prompt on next teacher login: blocking modal "Pick your school to continue" (preferred — clean UX).
  2. Auto-create a stub "Personal" school per orphan teacher (ugly fallback if the prompt is too disruptive — discuss with Matt before shipping).
  3. Block lab access until the teacher picks a school (similar to #1 but more punitive).
  Migration report logs every orphan teacher so we can pick the right path before deploy.
- RLS on `fabrication_labs`: SELECT/UPDATE/INSERT/DELETE all gated by `school_id IN (SELECT school_id FROM teachers WHERE id = auth.uid())`. Hint: use a SECURITY DEFINER function that joins `teachers` once, otherwise RLS recursion + perf concerns surface.
- Tests: migration tests + backfill tests (including the orphan-teacher flag path) + RLS audit on the new table covering: same-school visibility (positive), cross-school invisibility (negative), orphan-teacher denial (negative).

**Est:** ~0.75 day (slightly higher than the original 0.5 due to the 4-pass backfill + orphan-teacher path).

### 8-2 — Lab CRUD + machine-to-lab reassignment API

- `/api/teacher/labs` — POST (create within my school), GET (list **my school's** labs), PATCH (rename/update), DELETE (soft-delete with reassign-or-block).
- `/api/teacher/labs/[id]/machines` — PATCH to reassign a machine to a different lab in the same school.
- Orchestration: `createLab`, `listSchoolLabs`, `updateLab`, `deleteLab`, `reassignMachineToLab`, all **school-scoped** (via `teachers.school_id` lookup, audit-stamped via `created_by_teacher_id`).
- Cross-school protection: on every write, assert that the lab being modified has `school_id = current_teacher.school_id`. Foreign-school edits return 404 (don't leak existence).
- Safety rails on delete: can't delete a lab with machines or with classes pointing at it as their default. Clear 409 with a "first reassign these N classes / M machines" message listing the blockers.
- Concurrency: two teachers at the same school editing the same lab simultaneously — the brief uses last-write-wins for v1 (no `updated_at` optimistic locking). Conflict modal is a Phase 9 polish item (`PH8-FU-LAB-EDIT-CONCURRENCY`).
- Tests: +~30 route + orchestration including same-school multi-teacher visibility tests.

**Est:** ~0.75 day (slightly higher than original 0.5 due to school-scoped predicates + cross-school assertion tests).

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
  1. **Lab CRUD** — Matt creates "NIS Design Centre" → adds 2 Bambu X1Cs → renames → tries to delete (blocked by 409 because machines + classes still reference it) → reassigns blockers → delete succeeds.
  2. **Machine CRUD** — add a custom machine from scratch, edit dimensions, save.
  3. **Fabricator assignment** — assign a fab to a machine, click through, confirm the fab's `/fab/queue` now shows jobs for that machine.
  4. **Cross-teacher visibility (NEW — flipped from 24 Apr brief)** — Matt creates "NIS PYP Lab"; sign in as a second NIS teacher → confirm the PYP Lab is visible + editable. Sign in as a teacher at a DIFFERENT school → confirm NIS labs are NOT visible.
  5. **Per-class default lab routing** — set Matt's G4 class `default_lab_id` to PYP Lab and his G8 class to MYP Lab. Upload as a G4 student — picker shows only PYP machines. Upload as a G8 student — picker shows only MYP machines.
  6. **Teacher default seeding** — set `teachers.default_lab_id`. Create a NEW class — confirm the dropdown pre-selects the teacher default. Manually override per-class — confirm the class default wins.
  7. **Orphan-teacher path** — sign in as a teacher with `school_id IS NULL` (or simulate via direct DB) → confirm the blocking modal "Pick your school" appears before lab access. Pick a school → confirm labs become visible.
  8. **Migration safety** — verify existing NIS jobs (incl. those scanned during today's smoke) still work end-to-end after the migration.

**Est:** ~0.5 day.

## 4. Success criteria (Checkpoint 8.1)

- [ ] Migration applied to prod. Backfill verified: every existing machine has a lab, every class has a `default_lab_id`, every teacher with non-null `school_id` has a `default_lab_id`. Orphan-teacher count from migration log = N (Matt confirms count).
- [ ] Lab CRUD endpoints work with **school-scoped** visibility — every teacher at the same `school_id` sees + edits the same labs.
- [ ] Cross-school protection: a teacher cannot read or modify another school's labs (verified via 404, no existence leak).
- [ ] Orphan-teacher path: teachers with `school_id IS NULL` get the blocking school-pick modal on next lab-page access.
- [ ] Machine CRUD from template + from scratch. Laser operation colour map editable + persists correctly.
- [ ] Fabricator reassignment surface-level: click a chip → move to different machine → verify the fab's queue reflects the change.
- [ ] `/teacher/preflight/lab-setup` renders all three axes (lab → machine → fab) correctly. Edits made by Teacher A are visible to Teacher B at the same school on next refresh.
- [ ] Old `/teacher/preflight/fabricators` URL redirects to the new page (saves bookmarks).
- [ ] Per-class default lab routing: student picker filters machines by `class.default_lab_id`. Different classes at the same school can use different labs (G4→PYP, G8→MYP).
- [ ] `teachers.default_lab_id` correctly seeds the new-class picker default; per-class override wins.
- [ ] Prod smoke: all 8 scenarios verified as Matt + a second school account (or a parallel-test school created for the smoke).
- [ ] `npm test`: +70–90 new tests (was 60-80; +10 for school-scoped multi-teacher visibility tests).
- [ ] `docs/projects/WIRING.yaml` updated — new `fabrication-labs` system; `schools` system gains `affects: [fabrication-labs]`.
- [ ] Checkpoint 8.1 report filed.

## 5. Resolved decisions (revised 27 Apr PM — Q2 + Q3 flipped from 24 Apr "all recommended")

All 6 open questions re-resolved after Matt's 27 Apr challenge to the cross-teacher visibility model:

1. ✅ **Entity name: `fabrication_labs` in DB + "Labs" in UI** (unchanged from 24 Apr). Single vocabulary across DB + UI keeps the mental model clean.
2. ✅ **Default-lab strategy: per-teacher `teachers.default_lab_id` seeds per-class `classes.default_lab_id`; class default is the binding ground truth** (REVISED from 24 Apr "auto-create Default lab per teacher"). Reason: a single school has multiple defaults driven by what's being taught — a G4 design teacher's default = PYP lab, a G8 design teacher's default = MYP lab. Same school, different defaults. The teacher-level default seeds the dropdown when creating a new class; per-class can override. Migration backfill: prompt each teacher once → cascade to all their existing classes (`UPDATE classes SET default_lab_id = $teacher_default WHERE teacher_id = $self`).
3. ✅ **Cross-teacher visibility: YES — school-scoped via `teachers.school_id`** (REVISED from 24 Apr "NO — scope by teacher_id"). Reason: labs are physical spaces that schools own, not individual teachers. Any teacher at the same school sees + edits the same labs/machines without setup. The 24 Apr "wait for FU-O" deferral was overcautious — `schools` already exists (migration 085) and `teachers.school_id` is the existing membership join. FU-O is about role *stratification* (co-teacher / dept-head / admin), not basic membership. Flat membership-by-school works today.
4. ✅ **Who creates/edits labs: any teacher at the school** (unchanged from 24 Apr but reaffirmed under the revised Q3). Aligns with `access-model-v2.md` flat-membership model. Stricter governance (dept head, admin gates) is a future FU-O concern.
5. ✅ **Student-side impact: class-dictated silent filter** (unchanged). Student picker auto-filters machines by `class.default_lab_id`. No student-facing "pick a lab" UI. Cross-lab submission = Phase 9+.
6. ✅ **UI: click-based (Option B)** (unchanged). Ships ~30-50% faster, accessible out of box. Drag-drop filed as `PH8-FU-DRAG-DROP` P3 for post-pilot.

## 5b. Why the revision happened (27 Apr context)

The 24 Apr brief wrapped Q3 + Q2 with overcautious teacher-scoped answers because (a) the brief author wasn't confident `schools` infrastructure was ready and (b) FU-O role stratification was assumed to be a prerequisite for any cross-teacher sharing. Matt challenged both during smoke close-out:

> "labs are not usually owned by a single teacher. they are in spaces that are perhaps teachers classrooms, but not owned by teachers. they should exist as school owned places. labs in studioloom are owned by the school right? and so any teacher in my school should automatically see those labs (and the machines in them) when they first log in without having to set anything up right?"

Investigation confirmed:
- `schools` table exists since migration 085 (April 2026), with proper FK + RLS scaffolding.
- `teachers.school_id` already populated for teachers who completed the welcome wizard.
- FU-O is orthogonal — it's about role stratification *within* a school, not about basic school membership.
- `access-model-v2.md` proposes "flat membership and no designated admin" as the school governance model anyway, so school-scoped flat sharing in Phase 8 is forward-compatible.

Q2 was also re-thought: the 24 Apr "Default lab per teacher" auto-create is wrong on the new model (because labs are per-school, not per-teacher). Matt's per-class default insight (G4→PYP, G8→MYP within the same school) drove the new shape: teacher-default seeds class-default at migration; class-default is binding.

**Risk this introduces:** orphan teachers with `school_id IS NULL`. Handled by the §3 8-1 migration plan with a blocking school-pick prompt on next login. Migration script logs orphan count so we know how many before deploy.

---

## 6. Pre-conditions (all ✅ as of 27 Apr PM — 8-1 unblocked)

- [x] Phase 7 Checkpoint 7.1 PASSED + report marked ✅ (12/12 PASS, signed off 24 Apr PM)
- [x] Phase 7 merged to main (`7fefd6e` pre-smoke + `d5eb596` hotfix + `2e576fc` saveme)
- [x] Phase 8.1d (Fab Dashboard Polish) sub-phases 8.1d-1..35 SHIPPED + smoke 16/16 PASSED (27 Apr) — eliminates the "fab dashboard is fragile" risk that was sitting on the original brief.
- [x] Matt has re-resolved the 6 open questions (revised 27 Apr — Q2 + Q3 flipped, see §5 + §5b)
- [x] `schools` table verified present (migration 085, applied) — Phase 8's school-scoped model has its data foundation.
- [x] No outstanding Phase 7 production bugs (4 open follow-ups all P2/P3, Phase 9 scope — not blocking)
- [ ] **Pre-flight to-do**: query prod for `SELECT COUNT(*) FROM teachers WHERE school_id IS NULL` to size the orphan-teacher migration cohort. Drives whether the blocking school-pick modal is the right call or whether a softer migration UX is needed. Run before opening 8-1.

## 7. Known deviations from original spec

Original `fabrication-pipeline.md` §13 Phase 8 was just "Machine Profiles Admin UI — Teacher UI: create profile from template, customise, manage active profiles / Operation colour map editor for laser profiles / Rule overrides UI (advanced — collapsed by default)".

This brief **folds in Phase 9's lab-scoping work + reshapes the entire admin surface** to be visual + relational instead of three flat list pages. Net effect: the original Phase 9 estimate (`~1–2 days`) is absorbed into this phase's `~2–3 days`, and Phase 9 becomes "Analytics + Polish" (the other original bullets).

The **"Rule overrides UI"** from the original §13 Phase 8 is explicitly DEFERRED to Phase 9 (or later) — most teachers will never touch rule thresholds, and this phase is already ambitious enough without a separate rule-editor section.

---

**Status 24 Apr PM:** ✅ READY. All pre-conditions met. Phase 8-1 (migration + backfill) opens next — see dedicated brief: `preflight-phase-8-1-brief.md` (draft pending).

**Status 27 Apr PM (revision):** ✅ READY (revised). Q2 + Q3 re-resolved to school-scoped lab ownership using existing migration 085 `schools` infrastructure. Open pre-flight task: query prod for orphan-teacher count before opening 8-1. Estimated duration unchanged at ~2-3 days; sub-phase 8-1 + 8-2 each ticked up by ~0.25 day for school-scoping migration + RLS work, recovered by simpler 8-4 visibility model (one labs-list shared across all same-school teachers, no per-teacher filter).
