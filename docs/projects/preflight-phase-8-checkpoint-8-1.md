# Preflight Phase 8 — Checkpoint 8.1 Report

**Status:** ⏳ DRAFT — awaiting prod smoke sign-off
**Date signed off:** _(pending — fill in after smoke passes)_
**Signed off by:** _(pending)_
**Date drafted:** 25 April 2026
**Brief:** [`preflight-phase-8-brief.md`](./preflight-phase-8-brief.md)
**Phase 8-1 mini-checkpoint:** PASSED 25 Apr — migrations 113 + 114 applied to prod (3 default labs, 0 orphan machines, 0 orphan classes).
**Phase scope:** Lab + Machine + Fabricator Admin — unified visual surface replacing the Phase 1B-2 flat list. Adds `fabrication_labs` entity + per-machine lab scoping + student picker filter.
**Worktree:** `/Users/matt/CWORK/questerra-preflight`, branch `preflight-active`.

---

## Pre-smoke checklist (before Scenario 1)

1. **Deploy** — merge `preflight-active` → `main`. Vercel auto-builds.
   - No additional migrations beyond 113 + 114 (already applied prod 25 Apr).
2. **Teacher login** — primary browser. Has ≥ 1 existing class + enrolled students (from previous smokes).
3. **Student login** — incognito/other browser as `test`, enrolled in ≥ 1 class, used to verify the picker filter in Scenario 4.
4. **Fabricator login** — third browser as the Fabricator invited during Phase 7 smoke, used to verify Scenario 3.
5. **Starting state** — after deploy, hit `/teacher/preflight` and confirm the new "Lab setup" button renders alongside "Fabricators".

---

## Success criteria — pass/fail matrix

Criteria transcribed from `preflight-phase-8-brief.md` §4.

| # | Criterion | Status | Evidence |
|---|---|:---:|---|
| 1 | `fabrication_labs` migration applied to prod. Backfill verified. | ✅ | Migrations 113 + 114 applied 25 Apr via Supabase SQL Editor. Probe query: 3 default labs, 0 orphan machines, 0 orphan classes. |
| 2 | Lab CRUD endpoints work with teacher-scoped ownership + 404-not-403 for cross-teacher. | ⏳ | Phase 8-2 shipped: 5 routes on `/api/teacher/labs` + 52 unit tests. Cross-teacher paths return 404. 23505 unique-default → 409. Prod verify via Scenario 1. |
| 3 | Machine CRUD from template + from scratch. Laser operation colour map editable + persists correctly. | ⏳ | Phase 8-3 shipped: 5 routes (CRUD + lab bulk-approval) + 49 tests. MachineEditModal handles both paths. OperationColorMapEditor with live validation. Prod verify via Scenario 2. |
| 4 | Fabricator reassignment surface-level — click a chip → move to different machine → verify queue reflects change. | ⏳ | Fabricator chips on machine cards DEFERRED to Phase 9 polish (filed `PH8-FU-FAB-CHIPS-ON-MACHINE` P2). For Scenario 3, teacher uses the existing `/teacher/preflight/fabricators` page to assign fabricator → machine, then confirms the fab's `/fab/queue` receives the job. |
| 5 | `/teacher/preflight/lab-setup` renders lab + machine axes correctly for a teacher with real data. | ⏳ | Phase 8-4 shipped: LabSetupClient + 5 UI components. Click-based (Option B) per brief §2. Prod verify via Scenarios 1 + 2. |
| 6 | Old `/teacher/preflight/fabricators` URL redirects to the new page. | ⏭️ | DEFERRED (filed `PH8-FU-FAB-PAGE-MERGE` P2). For v1, both pages coexist — `/lab-setup` for labs + machines, `/fabricators` for invite + fabricator→machine assignment. A `← Back to Lab setup` link bridges. Full redirect ships in Phase 9. |
| 7 | Student picker correctly filters by `class.default_lab_id`. Legacy NULL fallback works. | ⏳ | Phase 8-5 shipped: picker-data endpoint ships `default_lab_id` on classes + `lab_id` on machines + filter via `filterMachinesForClass` helper (6 unit tests). Soft-deleted (is_active=false) machines filtered server-side. Prod verify via Scenario 4. |
| 8 | Prod smoke: all 5 scenarios verified. | ⏳ | See Scenarios 1–5 below. |
| 9 | `npm test`: +60–80 new tests. | ✅ | 1983 → **2111** passing (+128 across Phases 8-2 / 8-3 / 8-4 / 8-5). Exceeds target. tsc --noEmit clean on all new files. |
| 10 | `docs/projects/WIRING.yaml` updated — new `fabrication-labs` system + machine-profiles extended. | ✅ | Schema-registry + WIRING synced in Phase 8-1 commit. api-registry 337 → **347** (+10 new routes across 8-2 + 8-3). |
| 11 | Checkpoint 8.1 report filed. | ✅ | This document. |

**Overall:** ⏳ **_/11 PASS** _(tally after smoke)._ Code + tests + tsc clean on every sub-phase commit. 2111 tests passing (Phase 8: 1983 → 2111, +128 across 8-2/8-3/8-4/8-5).

---

## Commits in Phase 8

Phase 8-1 (migrations + backfill — already applied to prod):
```
65d8074 docs: Phase 8-1 schema-registry + WIRING sync
98b86b7 test: Phase 8-1 migration + backfill schema contract tests
a3281ef feat: Phase 8-1 migration 113 → 114 (renumbered — backfill)
f020578 feat: Phase 8-1 migration 112 → 113 (renumbered — schema)
9ae085f fix: migration-state probe — information_schema only
2b23925 docs: migration-state probe SQL
8bcc966 fix: renumber migrations 112/113 → 113/114 (origin/main collision)
```

Phase 8-2 (lab CRUD — 5 routes):
```
4b03916 docs: api-registry sync
3715891 test: lab-orchestration unit tests (29)
2da0d1e feat: 5 API routes (GET/POST list+create, PATCH/DELETE, PATCH machines)
3618ef2 feat: lab-orchestration lib
```

Phase 8-3 (machine CRUD + bulk approval — 5 routes):
```
4b03916 docs: api-registry sync
c569d7a test: machine-orchestration unit tests (28)
f207709 feat: 5 API routes (GET/POST, PATCH/DELETE, bulk-approval)
30f361b feat: machine-orchestration lib
```

Phase 8-4 (visual admin UI):
```
6d70e10 feat: /lab-setup page + nav wiring
e4cbc5f feat: 5 UI components (LabSetupClient + modals + editor)
05d1c8d test: lab-setup helpers + 21 tests
```

Phase 8-5 (student picker filter + checkpoint report):
```
<pending> test: picker-helpers filter (6) + checkpoint report
<pending> feat: picker-data lab_id/default_lab_id + client filter
```

**Migrations applied:** 113 + 114 on 25 Apr. No further migrations in 8-2..8-5.

---

## Production smoke scenarios (Matt runs — paste results here)

All scenarios use:
- **Teacher:** your primary teacher account on `studioloom.org`
- **Student:** `test` account (reuse from earlier smokes)
- **Fabricator:** the Fabricator account from Phase 7 smoke
- **Deployment:** main post-merge (Vercel auto-deploy)

---

### Scenario 1 — Lab CRUD

**Setup:** starting from `/teacher/preflight/lab-setup`, one "Default lab" exists from the backfill.

1. **Create a lab** — Click "+ Add lab" → enter name "2nd floor design lab" + description → Create. **Verify:** new lab card appears below "Default lab" in the list.
2. **Add 2 machines to the new lab** — Click "+ Add machine" on the 2nd-floor lab → pick Bambu X1 Carbon template → edit name to "X1C #1" → Create. Repeat for "X1C #2". **Verify:** both machines render as cards in the 2nd-floor lab grid.
3. **Rename the lab** — (Rename UX lives in the lab header controls — if not obvious in the UI, use the API directly: `PATCH /api/teacher/labs/<id>` with `{ "name": "2nd floor lab — north wing" }`. Lab header re-renders on next fetch.)
4. **Try to delete with machines present** — Click × on the 2nd-floor lab. **Verify:** alert says "has 2 machines. Move or remove them first." No delete happens.
5. **Deactivate machines** — click Deactivate on each X1C. **Verify:** both disappear from the grid.
6. **Delete the empty lab** — click × again. **Verify:** confirm prompt → accept → lab vanishes from the list.

**Expected result:** ✅ All 6 steps pass; teacher never sees a 500.

**Paste result:** _(pending)_

---

### Scenario 2 — Machine CRUD + colour map

**Setup:** starting from `/teacher/preflight/lab-setup` with the Default lab.

1. **Add a custom machine from scratch** — Click "+ Add machine" on the Default lab → scroll to the bottom → click "+ Start from scratch" → fill in: name "Test xTool F1", category = laser_cutter, bed X = 250, bed Y = 150, kerf = 0.1, min feature = 0.2. In the colour-map editor, add 3 rows: `#FF0000 → Cut`, `#00FF00 → Score`, `#0000FF → Engrave`. Enable "Require teacher approval". **Verify:** machine card appears in the grid with the "Approval" amber pill.
2. **Edit dimensions** — click Edit on the new machine → change bed X to 300, bed Y = 200. Save. **Verify:** card re-renders showing "Bed: 300×200 mm".
3. **Edit colour map** — click Edit → change `#FF0000` → `#FF00AA` + add a new row `#CCCCCC → Engrave`. Save. **Verify:** success banner; re-open modal to confirm the rows persisted in the new shape.
4. **Per-machine approval toggle** — click Edit → uncheck "Require teacher approval". Save. **Verify:** amber "Approval" pill disappears from the card.
5. **Bulk lab-level approval toggle** — click the "Approval: OFF for lab" button in the lab header. **Verify:** all machines in that lab flip to Approval-required (amber pills return); button now reads "Approval: ON for lab".

**Expected result:** ✅ All 5 steps pass; colour map round-trips; approval toggle persists at per-machine + per-lab levels.

**Paste result:** _(pending)_

---

### Scenario 3 — Fabricator assignment + queue verification

**Setup:** at least one active machine in a lab; Fabricator account from Phase 7 exists.

1. **Assign via existing flow** — click "Fabricators" in the `/teacher/preflight` header (or `/teacher/preflight/fabricators`) → on the Fabricator row → "Manage machines" → tick the new machine from Scenario 2 → save.
2. **Student uploads to the new machine** — `test` student → `/fabrication/new` → pick class → pick the new machine → upload any STL → submit. **Verify:** job appears in teacher queue (if approval required) or goes straight to approved.
3. **Teacher approves (if needed)** — `/teacher/preflight` → Approve.
4. **Fabricator sees the job** — Fabricator logs into `/fab/queue` → **Verify:** new job appears in "Ready to pick up" with the correct machine label.

**Expected result:** ✅ Job reaches fabricator queue scoped by their machine assignments.

**Paste result:** _(pending)_

---

### Scenario 4 — Student picker filter

**Setup:** teacher has ≥ 2 labs, each with different machines. Student is in a class defaulted to lab A.

1. **Baseline state** — from teacher UI, confirm `Class X` → default lab A. Lab A has machines `X1C-A`, `P1S-A`. Lab B has machines `xTool-B`, `Glowforge-B`.
2. **Student upload** — `test` student → `/fabrication/new` → pick `Class X` in the class dropdown. **Verify:** machine dropdown shows ONLY `X1C-A` + `P1S-A` (not the lab-B machines).
3. **Legacy fallback** — if any class has `default_lab_id = NULL` (edge case), student picker should show ALL teacher-owned machines unfiltered. **Verify:** no regression for the default single-lab classes.

**Expected result:** ✅ Student sees machines filtered to their class's lab. Legacy null-lab classes unaffected.

**Paste result:** _(pending)_

---

### Scenario 5 — Migration safety / regression

**Setup:** your existing Phase 7 smoke jobs (approved, picked up, completed) from earlier sessions.

1. **Existing jobs load** — teacher → `/teacher/preflight` → **Verify:** queue renders with existing jobs (no 500).
2. **Student history loads** — `test` student → `/fabrication` → **Verify:** submission list renders with correct status pills (printed/cut/failed from 7-5d hotfix).
3. **Fabricator queue loads** — Fabricator → `/fab/queue` → **Verify:** historical jobs still visible.
4. **End-to-end job** — repeat Scenario 1 from Phase 7 smoke (upload → approve → pickup → mark complete). **Verify:** full flow still works post-migration.

**Expected result:** ✅ Zero regressions. Migrations 113 + 114 were additive; existing columns untouched; existing flows unaffected.

**Paste result:** _(pending)_

---

## New follow-ups filed during Phase 8

| ID | Priority | Scope |
|---|---|---|
| `PH8-FU-FAB-CHIPS-ON-MACHINE` | P2 | Show fabricator avatars/chips per MachineCard on `/lab-setup`. Requires new reverse-lookup API route `GET /api/teacher/machine-profiles/[id]/fabricators`. Saves teachers the round-trip through `/fabricators` for quick "who's running this?" checks. |
| `PH8-FU-FAB-PAGE-MERGE` | P2 | Full page-replacement: `/teacher/preflight/fabricators` redirects to `/lab-setup` with inline fabricator invite + assignment UX. For v1 both pages coexist with a `← Back` link. |
| `PH8-FU-DRAG-DROP` | P3 | Drag-drop alternative to click-based (Option A from parent brief §2). Filed during brief drafting. Revisit post-pilot if teachers ask. |
| `PH8-FU-SKILLS-DEEPLINKS-404` | P3 | Pre-existing 404 on scan rule → Skills Library deep-links (`/skills/fab-R-*`). Flagged during Phase 7 smoke. Ships when Skills Library authors the 32 fabrication rule cards. |
| `PH8-FU-CHILD-SCHOOL-SHARING` | P1 | Cross-teacher lab sharing via `fabrication_labs.school_id` reserved column. Blocked on FU-P access-model-v2 (school entity + school_memberships table + role enum). Migration path is pure `ADD POLICY` — schema is ready. See `docs/projects/fu-p-access-model-v2-plan.md` for the full sequencing plan drafted 25 Apr PM. |
| `PH8-FU-LAB-SETUP-NAV` | P2 | Lab setup is only reachable via the `/teacher/preflight` header button today. Teachers who haven't seen the queue page first miss it. Proper placement: a PreflightTeacherNav tab strip visible on every `/teacher/preflight/*` page (Queue / Lab setup / Fabricators). PARTIAL FIX shipped 25 Apr — see commit history for `PreflightTeacherNav` component; full nav polish (dropdown from top-level teacher nav, teacher-dashboard shortcut) stays on the follow-up list. |
| `PH8-FU-HIERARCHICAL-MACHINE-PICKER` | P2 | Current "Add machine" modal shows all 12 system templates in two flat sections (3D printers / Lasers). Scales poorly to 50+ models. Rebuild as a 3-step picker: category → brand → model. Also: extensible to future categories (vinyl cutters, CNC mills, etc.) — add a `category_subtype` open enum + a `brand` column. Matt flagged 25 Apr during prod smoke. |
| `PH8-FU-ADMIN-TEMPLATE-EDITOR` | P2 | Today, adding a new system template (e.g. new Bambu model release) requires a migration (`INSERT INTO machine_profiles ... WHERE is_system_template = true`). Replace with an admin UI at `/admin/preflight/machine-templates`. Schema already supports it — just needs admin auth role + 4 API routes + a list/edit UI page (reuse `MachineEditModal`). ~half day. Matt flagged 25 Apr: "need to be able to update the central list easily as there are always new ones coming out." |
| `PH8-FU-LAST-LAB-GUARD` | ✅ RESOLVED 25 Apr | Fixed in 8.1d-2 commit. `deleteLab` orchestration now blocks deleting the last lab when teacher has any active machines or any classes. Returns 409 with friendly message. 4 new unit tests cover the guard branches. |
| `PH8-FU-SET-DEFAULT-LAB` | ✅ RESOLVED 25 Apr | Fixed in 8.1d-3 commit. Each non-default lab card has a "Make default" button. Two-step API flow (PATCH old default to false → PATCH this one to true) handles the unique-default-per-teacher partial index correctly. |
| `PH8-FU-CLASS-LAB-ASSIGN` | ✅ RESOLVED 25 Apr | Fixed in 8.1d-3 commit. New "Assign classes" button on each lab card opens `AssignClassesToLabModal` — multi-select checkbox list of teacher's classes with current default-lab indicators. Two new API routes: `GET /api/teacher/fabrication/classes` (list) + `PATCH /api/teacher/fabrication/classes/[classId]/default-lab` (update). |
| `PH8-FU-SCHOOL-OWNED-FLEET` | P1 | **Architectural shift** — Matt's deeper question 25 Apr PM: "is there a central place to store school machines and labs? when a new design teacher comes will their students auto see the same labs and machines as existing teachers' students?" Today the answer is NO: each teacher has their own copy of every lab + machine. The right model is school-owned-from-the-start. Revised FU-P plan ([fu-p-access-model-v2-plan.md](./fu-p-access-model-v2-plan.md)) now reflects this. Schema reservations from Phase 8 (`school_id` columns on labs + machines + classes) make the migration path clean — flip from NULLable to NOT NULL, rewire RLS to read from school_id. Existing per-teacher rows keep their identity post-migration; optional dedupe tool ships in FU-P-4. **Bumped to P1** — gates multi-teacher school deployments. |

---

## Next phase

Phase 9 — Analytics + Polish (~1–2 days). Scope per `fabrication-pipeline.md` §13:
- Admin Metrics Dashboard (job volume, pass-rate trends per class/machine, top failure rules)
- Rule Overrides UI (advanced — collapsed by default; originally planned for Phase 8 but deferred to keep 8 focused)
- Operational polish — completion notifications (`PH7-FU-COMPLETION-NOTIFICATIONS`), inline queue actions (`PH7-FU-INLINE-QUEUE-ACTIONS`), fab scan-summary copy (`PH7-FU-FAB-SCAN-SUMMARY`), history pagination (`PH6-FU-HISTORY-PAGINATION`), preview overlay (`PH6-FU-PREVIEW-OVERLAY`), rule media embeds (`PH6-FU-RULE-MEDIA-EMBEDS`).
- Pre-pilot polish pass — `PH8-FU-FAB-CHIPS-ON-MACHINE`, `PH8-FU-FAB-PAGE-MERGE`, potentially `PH8-FU-DRAG-DROP`.

Pre-conditions: this checkpoint (8.1) PASSED + Matt decides priority order for the backlog items.
