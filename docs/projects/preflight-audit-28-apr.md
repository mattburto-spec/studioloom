# Preflight Audit — 28 Apr 2026 (post Phase 8-1 schema flip)

**Scope:** every code path under `src/lib/fabrication/`,
`src/app/api/{student,teacher,fab}/**`, `src/app/(student)/fabrication/`,
`src/app/teacher/preflight/`, `src/app/fab/`, `src/components/fabrication/`,
plus `supabase/migrations/`. Goal: surface every gap, broken reference, or
silently-missing validation that could surprise us in production after
today's school-scoped lab ownership flip.

**Trigger:** three runtime bugs surfaced in production today after the
schema migration shipped — student upload Path B (`teacher_id` removed),
PostgREST schema-cache lost FK, file-type/category compat absent. Each
should have been caught at audit time. This pass is the audit-before-build
that I should have done this morning.

**Severity legend:**
- 🔴 HIGH — production data exposure or critical-path break
- 🟠 MED — admin surface broken / functional gap
- 🟡 LOW — cosmetic / type-only / cleanup

---

## 🔴 HIGH-1 — Student picker shows ALL active machines globally (cross-school leak)

**Site:** `src/app/api/student/fabrication/picker-data/route.ts:77-84`

```ts
const profilesResult = await db
  .from("machine_profiles")
  .select("id, name, ... lab_id, fabrication_labs(name)")
  .eq("is_active", true)            // ← ONLY filter
  .order("is_system_template", { ascending: false })
  .order("name", { ascending: true });
```

No school filter. No teacher filter. A student at NIS Nanjing opens the
upload picker and sees machines from NIST Bangkok, every other school's
machines, etc.

**Impact (pre-pilot):** competitive school inventory leaks across tenants.
Picker becomes incoherent at scale. Once pilot expands beyond NIS this is
both a privacy issue and a UX disaster (300 machines from 50 schools in
one dropdown).

**Impact (NIS-only):** none today (only one school in prod) — but it's a
landmine for first multi-school onboarding.

**Fix:** scope by class's school via the chain `class → class.default_lab_id
→ lab.school_id`, or by `class.teacher_id → teacher.school_id`. Should be
~5 lines added to the `.select()` chain via a join + `.eq("school_id", ...)`.

**Priority:** Fix as part of Phase 8-2 or sooner. NOT a today blocker but
**must** ship before any second-school onboarding.

---

## 🔴 HIGH-2 — Fab queue scoped by inviting `teacher_id`, not school

**Site:** `src/lib/fabrication/fab-orchestration.ts:472`

```ts
.eq("teacher_id", teacherId);
// where teacherId = fabricatorInvitingTeacherId(...)
```

Cynthia (fab) was invited by Matt persona 1 (`mattburto@gmail.com`).
Her queue filters to jobs whose `teacher_id` = persona 1's UUID. So:

- A job submitted via persona 2 (`mattburton@nanjing-school.com`) → invisible
- A job from any other NIS teacher (when they exist) → invisible

Under flat school membership (parent brief §5b), Cynthia is the school's
fab — she should see jobs from every NIS teacher.

**Impact (today):** Matt only sees jobs from one of his own personas.
Functional but misleading.

**Impact (pilot):** Cynthia onboards a colleague's class. Colleague's
student submits a job. Cynthia never sees it. Job sits forever.

**Fix:** scope via school chain. `teachers t → t.school_id`. The query
becomes "jobs whose teacher's school_id matches my inviting teacher's
school_id". Cleanest via a SECURITY DEFINER helper similar to
`current_teacher_school_id()` — or just an extra IN-clause.

**Priority:** Pre-pilot blocker if a second NIS teacher onboards a class.

---

## 🔴 HIGH-3 — Fab `assignMachine` enforces teacher-scoped machine ownership

**Site:** `src/lib/fabrication/fab-orchestration.ts:932`

```ts
if (machineRow.teacher_id !== teacherId) {
  return { error: { status: 404, message: "Machine not found" } };
}
```

A fab can only send jobs to machines owned by their inviting teacher.
Matt's machines stay teacher-scoped (the new schema only flipped labs).
So if Cynthia tries to send a job to a machine owned by a colleague,
404. Same root cause as HIGH-2.

**Fix:** delete this check. The `lab_id !== jobRow.lab_id` check
immediately below (line 937) already enforces same-lab → same-school
boundary correctly via the lab→school chain.

**Priority:** Pre-pilot blocker (companion to HIGH-2).

---

## 🔴 HIGH-4 — Multiple fab job-ownership checks use teacher_id (pattern)

**Sites in `fab-orchestration.ts`:** lines 309, 472, 890, 1051, 1169, 1205.

All check `jobRow.teacher_id !== teacherId` (or use it as filter). Same
pattern as HIGH-2. Affects:

- `getFabJobDetail` (line 309)
- `listFabricatorQueue` (line 472)
- `assignMachine` job side (line 890)
- `markComplete` / `markFailed` (line 1051)
- `unassignMachine` (line 1169)
- `deleteJob` (line 1205, just shipped)

**Fix:** consistent school-scoped ownership check helper. Probably a
small `assertSameSchoolAsFab(db, fabricatorId, jobRow)` helper that
wraps the teacher → school resolution + comparison.

**Priority:** Pre-pilot blocker. Companion to HIGH-2/HIGH-3.

---

## 🟠 MED-1 — `lab-orchestration.ts` entire file references removed columns

**Site:** `src/lib/fabrication/lab-orchestration.ts` (~530 lines)

References `is_default` (~6 sites), `teacher_id` (~30 sites). Used by:

- `/api/teacher/labs/route.ts`
- `/api/teacher/labs/[id]/route.ts`
- `/api/teacher/labs/[id]/machines/route.ts`
- `/api/teacher/labs/[id]/bulk-approval/route.ts`

All routes 500 at runtime when called. Page that consumes them
(`/teacher/preflight/lab-setup`) is broken end-to-end.

**Fix:** rewrite under school-scoped model — this is core Phase 8-2 work.
Don't try to incrementally fix; the contract changed.

**Priority:** Phase 8-2 build phase rebuilds this from scratch.

---

## 🟠 MED-2 — `machine-orchestration.ts` references removed columns

**Site:** `src/lib/fabrication/machine-orchestration.ts`

`select("school_id, teacher_id")` from fabrication_labs at line 374;
queries assume teacher-scoped lab ownership. Used by:

- `/api/teacher/machine-profiles/route.ts`
- `/api/teacher/machine-profiles/[id]/route.ts`

Both routes 500 at runtime.

**Fix:** Phase 8-3 rebuild under school-scoped model.

**Priority:** Phase 8-3 build phase.

---

## 🟠 MED-3 — `/api/teacher/fabrication/classes/[classId]/default-lab` references old schema

**Site:** `src/app/api/teacher/fabrication/classes/[classId]/default-lab/route.ts`

Direct query against `fabrication_labs` for assignment. May or may not
be wired into a live UI surface — needs check during 8-2 rebuild.

**Fix:** rewrite as part of Phase 8-2.

**Priority:** Phase 8-2.

---

## 🟠 MED-4 — `LabSetupClient.tsx` + supporting components broken

**Sites:**
- `src/components/fabrication/LabSetupClient.tsx`
- `src/components/fabrication/AddLabModal.tsx`
- `src/components/fabrication/AddMachineModal.tsx`
- `src/components/fabrication/MachineEditModal.tsx`
- `src/components/fabrication/ApprovalWorkflowCard.tsx`
- `src/components/fabrication/AssignClassesToLabModal.tsx`
- `src/components/fabrication/lab-setup-helpers.ts`

All call the broken APIs from MED-1 / MED-2 / MED-3. The page
`/teacher/preflight/lab-setup` 500s on render.

**Visible to user:** the "Lab setup" link in the teacher preflight nav
bar leads to an error page.

**Fix:** Phase 8-4 rebuild (after 8-2 + 8-3 land).

**Priority:** Phase 8-4. Could optionally hide the nav link until then
to avoid an obviously-broken admin surface.

---

## 🟠 MED-5 — `machine_profiles.teacher_id` still NOT NULL — semantic inconsistency

**Site:** schema-level — `machine_profiles` table.

Phase 8-1 made labs school-scoped but didn't touch `machine_profiles.teacher_id`.
Machines still have a single owner-teacher. Under flat school membership
this is incoherent: any teacher at the school should be able to manage
any of the school's machines.

**Three possible fixes:**

1. **Migrate machines to school-scoped too.** New migration: drop
   `teacher_id NOT NULL` (or rename to `created_by_teacher_id` audit-only
   like labs), derive `school_id` via lab_id → lab.school_id chain at
   query time. Cleanest but invasive.
2. **Keep teacher_id but stop using it for access control.** Treat it
   as audit-only, fix all callers to scope via lab_id → school. Same
   ergonomic effect, less migration churn.
3. **Status quo.** Each teacher only sees their own machines (functional
   for NIS, breaks under flat membership for multi-teacher schools).

**Decision needed.** Recommend Option 2 — least invasive, matches the
"created_by_teacher_id audit-only" pattern we already established for
labs.

**Priority:** Phase 8-3 design call.

---

## 🟠 MED-6 — Migration 120 dependency — fresh-install ordering risk

**Site:** `supabase/migrations/120_fabrication_jobs_category_lab.sql`

Migration 120 adds `fabrication_jobs.lab_id REFERENCES fabrication_labs(id)`.
On 25 Apr's prod (when 113 had already created `fabrication_labs`) this
worked. But:

- We deleted 113 today.
- A fresh install runs migrations in lex order: ..., 120, 121, 122, 123,
  20260427134953, 20260427135108, 20260428041707.
- Migration 120 runs BEFORE the new `fabrication_labs` table is created
  (timestamp prefix sorts AFTER 3-digit). 120 will fail on fresh install.

**Impact:** any new Supabase project trying to apply this migration set
end-to-end will fail at migration 120. Matt's prod is fine because
migrations were applied piecemeal in a different order.

**Fix options:**

1. Restore a no-op stub `113_fabrication_labs.sql` that pre-creates the
   table empty (drop CASCADE behaviour preserved by the new migration).
2. Wrap migration 120's FK creation in a `DO $$ IF EXISTS (SELECT 1
   FROM information_schema.tables WHERE table_name='fabrication_labs')
   THEN ... END IF; END $$` block (idempotent) AND add a follow-up
   migration after 20260427134953 that ADD CONSTRAINTs.
3. Renumber all timestamp-prefixed migrations to start with `0` so
   they sort before 3-digit (drastic, breaks v2 discipline).

**Recommend:** Option 2 — minimal blast radius.

**Priority:** Pre-deployment-to-other-instances blocker. NIS prod is fine.

---

## 🟡 LOW-1 — TypeScript types still reference `is_default`

**Sites:** `src/lib/fabrication/lab-orchestration.ts` types
(`isDefault: boolean` on `LabRow`-like shapes appearing ~6 times).

Won't compile-error today because the dead code matches its own dead
types. Once Phase 8-2 rewrites the orchestration, types should be
rewritten alongside.

**Priority:** Phase 8-2.

---

## 🟡 LOW-2 — Comment drift across the codebase

Multiple files have docstrings + inline comments referencing
`teacher_id`-scoped semantics, the old "Default lab per teacher"
auto-create, the unique partial index, etc. None affect runtime, but
they mislead future readers.

**Sample sites:**
- `lab-orchestration.ts:7` — file-level docstring
- `lab-orchestration.ts:23, 28` — design notes
- `machine-orchestration.ts` — multiple docstring chunks
- `fab-orchestration.ts:9-10` — file header
- `orchestration.ts:247-249` — storage path scheme comment

**Fix:** sweep during Phase 8-2/8-3 rewrites; not worth a separate pass.

**Priority:** Phase 8-2 / 8-3 housekeeping.

---

## Summary

| ID | Severity | Surface | Phase |
|---|---|---|---|
| HIGH-1 | 🔴 | Student picker cross-school leak | Pre-pilot fix or Phase 8-2 |
| HIGH-2 | 🔴 | Fab queue teacher-scoped | Pre-pilot fix |
| HIGH-3 | 🔴 | Fab assignMachine teacher_id check | Pre-pilot fix |
| HIGH-4 | 🔴 | Fab job-ownership pattern | Pre-pilot fix |
| MED-1 | 🟠 | lab-orchestration.ts | Phase 8-2 rebuild |
| MED-2 | 🟠 | machine-orchestration.ts | Phase 8-3 rebuild |
| MED-3 | 🟠 | default-lab route | Phase 8-2 rebuild |
| MED-4 | 🟠 | LabSetupClient + components | Phase 8-4 rebuild |
| MED-5 | 🟠 | machine_profiles teacher_id semantics | Phase 8-3 design |
| MED-6 | 🟠 | Migration 120 fresh-install ordering | Pre-multi-instance |
| LOW-1 | 🟡 | TS types drift | Phase 8-2 |
| LOW-2 | 🟡 | Comment drift | Phase 8-2/8-3 |

---

## Recommended order of fixes

**Round 1 — Today / next short session (~1 hour each):**
1. **HIGH-1** student picker scope (pre-pilot blocker, 1 query change + tests)
2. **HIGH-2/3/4** fab teacher_id pattern (one helper function + 6 callsite swaps)
3. **MED-6** migration 120 idempotency wrap (~5 lines + a follow-up migration)

**Round 2 — Phase 8-2 build (1-2 days):**
- Rebuild MED-1 (lab-orchestration.ts) under school-scoped model
- Rebuild MED-3 (default-lab route)
- Address LOW-1/LOW-2 in passing

**Round 3 — Phase 8-3 build (1 day):**
- Rebuild MED-2 (machine-orchestration.ts)
- Decide on MED-5 (machine teacher_id semantics)

**Round 4 — Phase 8-4 build (1 day):**
- Rebuild MED-4 (LabSetupClient + components)
- Final hide-or-fix decision on `/teacher/preflight/lab-setup`
