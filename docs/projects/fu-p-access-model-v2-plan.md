# FU-P — Access Model v2: School + Memberships + Role Enum

**Status:** PLAN DRAFT — not yet committed to a sprint.
**Drafted:** 25 April 2026 PM (after Phase 8 main merge + prod smoke prep).
**Revised:** 25 April 2026 PM (after Matt asked the deeper architectural question: "is there a central place to store school machines and labs? when a new design teacher comes will their students auto see the same labs and machines?").
**Motivation:** Matt asked during Phase 8 smoke prep — "does the system know that if I work at NIS and setup a lab, the other NIS teachers also get that info?" — answer today is NO. This plan is the sequencing to fix it.
**Scope:** The FU-P half of the "FU-O/P/R Access Model v2" cluster. Includes FU-O (role enum) inline. FU-R (auth model split) stays separate.

---

## ⚠️ ARCHITECTURAL DECISION: school-owned fleet, not teacher-owned with cross-team read

Original v1 of this plan treated FU-P as a "share read access overlay on top of teacher-owned resources." That's wrong, and Matt called it out 25 Apr PM:

> "Is there a central place to store school machines and labs? in the future with the new advanced login when a new design teacher comes will their students auto see the same labs and machines as the other existing teachers students?"

**The right model — labs + machines are SCHOOL-OWNED.** Not teacher-owned-with-shared-read.

| Concern | Old v1 plan ("share read") | New design ("school-owned") |
|---|---|---|
| `fabrication_labs.teacher_id` | Owner. NOT NULL. | "Created by" audit. NULLable for system-created. |
| `fabrication_labs.school_id` | Optional. Nullable. Used for share scope. | OWNER. NOT NULL post-migration. |
| New teacher joins school | Has to set up own labs/machines | Inherits the school's existing fleet automatically |
| Same physical printer, 2 teachers | 2 database rows | 1 row, both teachers reference it |
| Editing a machine spec | Each teacher edits their own copy | Edit affects every teacher's view (changes to canonical row) |
| Audit ("who changed kerf?") | Inferred from teacher_id ownership | Recorded via `created_by_user_id` + `updated_by_user_id` fields |

This is a meaningful architectural shift and it changes the plan below (specifically FU-P-2 and FU-P-3). It does NOT change the existing Phase 8 schema reservations (`school_id` columns are already nullable on `fabrication_labs` + `machine_profiles` + `classes` from migrations 093 + 113). Those reservations remain correct — FU-P just flips them from NULLable to NOT NULL and rewires RLS to read from them.

**Existing per-teacher data does NOT need to be deduped during migration.** Each existing row keeps its identity and gets a school_id assigned (via the email-domain heuristic). Optional dedupe tool ships in FU-P-4 — school admin can collapse duplicates manually.

### Fabricators are also school-owned

Matt asked the right follow-up 25 Apr PM:

> "have you considered the fabricator account and how it interacts with school_id?"

Honest answer: I missed it in the original FU-P plan. Fabricators (lab techs, shared lab computers, etc.) are scoped per-teacher today via `fabricators.invited_by_teacher_id`. That breaks under school-owned-fleet — a school's lab tech (Cynthia) needs to be manageable by every teacher at that school, not just the one who invited her. Otherwise the "Mr. Jones invited her, only he can edit her machines" rule re-creates exactly the per-teacher silo we're escaping.

**Note:** the existing fabricator-side **queue** already works correctly under school-owned (it filters by machine, not by teacher). Only the teacher-side **management** UX is broken today.

**Schema reservation:** `fabricators.school_id` was reserved as a nullable FK in **migration 097 (Phase 1A)**, before this plan was drafted. So the column already exists. Migration 116 (25 Apr PM) added the partial index that 097 didn't include. FU-P-2 just flips the column to NOT NULL + rewires RLS.

**Role matrix for fabricator management** (mirrors lab/machine matrix):

| Role | Invite fabricators | Assign fabs to machines | Reset password / deactivate | Read |
|---|---|---|---|---|
| `owner` | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `dept_head` | ✅ | ✅ | ✅ | ✅ |
| `teacher` | ✅ | ✅ | ✅ (their invitees) | ✅ |
| `co_teacher` | ✅ | ✅ | ✅ (their invitees) | ✅ |
| `ta` | ❌ | ❌ | ❌ | ✅ |
| `observer` | ❌ | ❌ | ❌ | ✅ |

The "their invitees" qualifier on teacher/co_teacher means: the dept_head + admin level can deactivate any fabricator at the school, but rank-and-file teachers can only deactivate fabricators they personally invited. This protects against "Mr. Jones nukes Ms. Smith's lab tech in a fight." Optional — could simplify to "any teacher can do anything," but the per-teacher-rank model matches social reality of school hierarchies.

---
**Blocks:** Cross-teacher sharing of fabrication labs, machines, fabricators, units, classes. Dept-head / school-admin dashboards. Multi-school deployments (Seoul Foreign School pattern — 3 labs per building, different teachers per lab).
**Pre-conditions:** Phase 8 Checkpoint 8.1 PASSED in prod. No Phase 9 work in flight (this is a tenancy-boundary migration; concurrent feature work on any affected tables is risky).
**Estimated total effort:** ~8–11 days (revised from 7–10 after the school-owned-fleet pivot — slightly more migration work, slightly less write-permission complexity), split across 5 named sub-phases with Matt Checkpoints.

---

## What already exists (ground we don't need to re-break)

1. **`schools` table** — created in migration 085. Columns: `id`, `name`, `created_at`. That's it — no admin / owner FK yet.
2. **Reserved `school_id` columns** — on `machine_profiles` (from migration 093) and on `fabrication_labs` (from migration 113, Phase 8-1). Both `NULLABLE`, unused in v1. Deliberately reserved to make FU-P land as `ADD POLICY` not `ALTER TABLE`.
3. **Classes table** — currently `classes.teacher_id` is single-owner. No `classes.school_id` column. Adding it is one migration.
4. **Student identity** — `students.author_teacher_id` (migration 041) ties a student to one teacher. This is FU-Q (dual student identity) territory — treat separately, don't let it block FU-P.
5. **Existing RLS patterns** — every table in the `fabrication_*` namespace scopes by `teacher_id = auth.uid()`. Those policies need to be rewritten for FU-P; they DO NOT need to be dropped first.

## What we need to add

1. **`schools.slug`** — URL-friendly short identifier, used for routing (future: `/s/nis/...`). Unique.
2. **`school_memberships`** — the core new table. One row per (user, school, role).
3. **Role enum** — `owner | admin | dept_head | teacher | co_teacher | ta | observer`. FU-O maps here.
4. **`fabrication_labs.school_id`** — already exists as nullable column. Backfill.
5. **`machine_profiles.school_id`** — already exists as nullable column. Backfill.
6. **`classes.school_id`** — new column; backfill.
7. **RLS policy rewrite** — on ~12 tables: `fabrication_labs`, `machine_profiles`, `fabricators`, `fabrication_jobs`, `fabrication_job_revisions`, `fabrication_scan_jobs`, `classes`, `class_students`, `units`, `knowledge_uploads`, `student_projects` (dashboard-v2's PYPx addition), `teacher_style_profile`. Each policy's `teacher_id = auth.uid()` becomes `EXISTS (SELECT 1 FROM school_memberships WHERE ...)`.
8. **Admin / dept-head UI** — minimum viable: dept head can see all labs/machines/classes at their school; school admin can manage memberships + roles.
9. **Backfill script** — for every existing teacher, create a `schools` row (if none), create a `school_memberships` row with role='owner' or 'teacher', populate `school_id` on every relevant row.

---

## Sub-phases + Matt Checkpoints

### FU-P-1 — Schema + backfill (~1 day)

**Scope:**
- Migration adds `schools.slug` + makes `schools.name` NOT NULL + unique.
- Migration creates `school_memberships` table:
  ```sql
  CREATE TYPE school_role AS ENUM (
    'owner', 'admin', 'dept_head', 'teacher', 'co_teacher', 'ta', 'observer'
  );

  CREATE TABLE school_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    role school_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, school_id, role)
  );
  ```
- Migration adds `classes.school_id UUID REFERENCES schools(id)`.
- RLS on `schools` + `school_memberships` (admin + self-read).
- **Backfill script** — for every distinct teacher in `auth.users` with any classes/machines/labs:
  - Create (or reuse) a `schools` row. Naming heuristic: group by email domain (`@nanjing-school.com` → one school).
  - Insert `school_memberships` row with `role='teacher'` for each teacher.
  - If the teacher is a known admin (Matt's UUID, hardcoded), insert a second row with `role='owner'`.
  - Backfill `fabrication_labs.school_id`, `machine_profiles.school_id`, `classes.school_id`.

**Gate to FU-P-2:**
- Migrations apply cleanly to prod.
- Backfill verified: every teacher has ≥1 membership; every lab/machine/class has a school_id.
- Existing RLS policies UNTOUCHED — current per-teacher scoping still works.
- Zero behaviour change (all new columns + table unused by any route yet).

**Checkpoint: FU-P-1.1 — schema + backfill correct.**

### FU-P-2 — Ownership flip + RLS rewrite (~2.5 days, was 2 days)

**Scope (revised — school-owned, not share-overlay):**
- Migration: add `school_id NOT NULL` constraint on `fabrication_labs`, `machine_profiles` (where `is_system_template = false`), `classes`. (Backfill from FU-P-1 has populated values; this just enforces the invariant going forward.)
- Migration: add `created_by_user_id UUID REFERENCES auth.users(id)` and `updated_by_user_id UUID REFERENCES auth.users(id)` on `fabrication_labs`, `machine_profiles`, `classes`. Populated by orchestration on every write — replaces the implicit "teacher_id = owner" pattern.
- Keep `teacher_id` as a column for now (backwards-compat), repurposed as "primary teacher contact" for the resource. NULLable. School admins can reassign.
- For each of ~12 tables, drop the existing `<table>_select_teacher` / insert / update / delete policies and replace with school-membership-scoped versions:
  ```sql
  CREATE POLICY <table>_select_via_school
    ON <table>
    FOR SELECT
    USING (
      school_id IN (
        SELECT school_id FROM school_memberships
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin', 'dept_head', 'teacher', 'co_teacher', 'ta', 'observer')
      )
    );

  CREATE POLICY <table>_modify_via_school_role
    ON <table>
    FOR INSERT, UPDATE, DELETE
    USING (
      school_id IN (
        SELECT school_id FROM school_memberships
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin', 'dept_head', 'teacher', 'co_teacher')
        -- ta + observer get READ only
      )
    )
    WITH CHECK ( ... same ... );
  ```
- Dropping old policies + adding new in the SAME transaction prevents any window where RLS is off. Migration wraps in BEGIN/COMMIT.
- `system_template` rows on `machine_profiles` keep their existing global-read policy.
- **Note: this is a meaningful semantics change.** Today, only `teacher_id = auth.uid()` can write to a row. After FU-P-2, ANY teacher in the same school with appropriate role can write. That's the whole point — but it's worth flagging in change-management for any school doing the migration. Pre-migration audit query: "show me all writes to fabrication_labs in the last 30 days" — should be ~zero unexpected cross-teacher writes since today's RLS prevents them.

**Gate to FU-P-3:**
- Every existing API route still works in prod.
- Spot-check: a second teacher at NIS can NOW SEE AND EDIT the first teacher's labs, machines, classes — that's the new model.
- system templates still globally readable.
- Audit fields (`created_by_user_id` / `updated_by_user_id`) populated correctly on test writes.
- New tests: RLS probe per table per role (~50 tests).

**Checkpoint: FU-P-2.1 — school-owned fleet works correctly + no regressions on Phase 8 smoke.**

### FU-P-3 — UI: school-fleet view + new-teacher onboarding (~1.5 days)

**Scope (revised — school-owned model):**
- All existing teacher-facing list APIs (`listMyLabs`, `listMyMachines`) now return school-fleet data via RLS — no route changes needed.
- Lab Setup UI shows the WHOLE school's labs + machines, not just "your own". Optional filter chip: "Show only labs I created" (rare use case).
- Each row gets a small "Created by: Mx Smith" subtitle so it's clear who set it up.
- New empty-state for new-teacher onboarding: when a teacher joins a school that already has ≥1 lab, the lab-setup page shows:
  > "✨ Welcome to NIS Preflight. Your school already has X labs and Y machines set up — students will start submitting to those automatically. Add a lab if you need a new one."
  No more "create your first lab" forced ritual.
- Class default-lab assignment UI from Phase 8.1d-3 (`AssignClassesToLabModal`) keeps working unchanged — it operates on the school's labs.

**Gate to FU-P-4:**
- New teacher (test account, second @nanjing-school.com email) joining the existing NIS school sees the existing fleet immediately on first lab-setup page load.
- Teachers at same school can edit each other's labs/machines (audit log records the change).
- No regression in single-teacher flows.

**Checkpoint: FU-P-3.1 — new-teacher inheritance verified in prod.**

### FU-P-4 — Role-based write permissions + memberships UI + dedupe tool (~2.5 days, was 2)

**Scope:**
- Refine write permissions per role (RLS in FU-P-2 was a coarse pass; this fine-tunes).
- New optional admin dedupe tool: school admin sees a list of "duplicate machines" (same name + same spec across teachers' historical rows), can collapse to one canonical row + reassign FK references. Closes the data-cleanup gap from the no-dedupe-during-migration choice.
- Rule matrix:
  | Role | Can create own | Can edit own | Can edit others at same school |
  |---|---|---|---|
  | `teacher` | ✅ | ✅ | ❌ |
  | `co_teacher` | ✅ | ✅ | ✅ (on classes they co-teach) |
  | `dept_head` | ✅ | ✅ | ✅ (on dept labs/machines/fabricators) |
  | `admin` | ✅ | ✅ | ✅ (on anything in their school) |
  | `owner` | ✅ | ✅ | ✅ (full) |
  | `ta` | ❌ | — | ❌ (read-only helper) |
  | `observer` | ❌ | — | ❌ (read-only, e.g. parent) |
- New admin UI page `/admin/school/memberships` — invite / change role / remove membership.
- School-level settings panel `/admin/school/settings` — name, slug, default lab template.

**Gate to FU-P-5:**
- All 7 roles tested in prod with a real second-teacher account.
- Membership CRUD works.
- Writes still constrained appropriately.

**Checkpoint: FU-P-4.1 — role-based write isolation correct.**

### FU-P-5 — Multi-school routing + Matt-as-platform-owner UI (~1.5 days)

**Scope:**
- Routes like `/s/<slug>/teacher/preflight/lab-setup` for when a user is in multiple schools (rare but not impossible — an international teacher working across two schools, or Matt as platform admin visiting NIS + his next pilot school).
- Currently all routes are single-tenant (`/teacher/...`); FU-U tracks fixing this. Do the minimum here: add `?school=<slug>` query param support so a user with multiple memberships can pick which school context they're in. Persisted in a cookie.
- Matt-specific platform-admin panel at `/admin/platform` — sees ALL schools + can create new ones + can promote a teacher to school-owner. Gated by hardcoded Matt-UUID check initially; turns into a proper `platform_admin` role later.

**Gate to close out FU-P:**
- Multi-school users can switch context.
- Platform admin can create a new school + seed its first owner.
- All Phase 8 smoke scenarios still pass.

**Checkpoint: FU-P-5.1 — complete end-to-end + closes FU-P from the dimensions3-followups.md list.**

---

## Why this sequencing

1. **Schema + backfill before policy rewrite.** Adding columns is safe (RLS still scopes by teacher_id, so the new columns are just data sitting there). Rewriting RLS is the risky step — we want a green test run on the new columns before touching the write paths.
2. **Read-only cross-teacher visibility before write permissions.** "I can see Mr. Jones's labs" is easy to review; "I can edit Mr. Jones's labs" is the dangerous change. Split into two checkpoints.
3. **Backfill heuristic (email domain → school)** is a v1 shortcut. For international schools with `@nanjing-school.com` it works cleanly. For teachers at multiple schools with personal emails (gmail), they're a single-person school until someone manually reassigns.
4. **Student identity (FU-Q) is deliberately NOT in scope.** Students stay `author_teacher_id` for v1. FU-Q handles the dual-identity problem separately.
5. **Auth model split (FU-R) is deliberately NOT in scope.** Teachers stay Supabase Auth, students stay token-auth, fabricators stay token-auth. FU-R unifies these; too much risk to combine with FU-P.

## Risk register

- **Risk 1:** Partial RLS rewrite fails mid-migration → some tables scoped to school, others still to teacher → inconsistency. **Mitigation:** wrap all policy drops + creates in a single transaction. If transaction fails, DB reverts to pre-migration state.
- **Risk 2:** A teacher's email domain is ambiguous (personal gmail used at school). **Mitigation:** admin backfill review step — generate a CSV of (teacher, detected_school, confidence), let Matt review + manually correct before running.
- **Risk 3:** Existing single-tenant routes break when a user has multiple memberships. **Mitigation:** default-school selection via cookie; routes fall back to "first school" when ambiguous.
- **Risk 4:** Performance regression — RLS policies with JOINs are slower than simple `teacher_id = auth.uid()`. **Mitigation:** add composite indexes on `school_memberships(user_id, school_id, role)`; run EXPLAIN on the top 5 query patterns pre- and post-migration.
- **Risk 5:** A bug in the new policies leaks cross-teacher data. **Mitigation:** FU-P-2's new test suite runs RLS probes per table + per role combination. Minimum 42 tests (~12 tables × 3.5 avg policies × 1 cross-teacher probe each).

## Success criteria (close-out)

- [ ] 5 sub-phase checkpoints all PASSED
- [ ] Second teacher at NIS can see + interact with the first teacher's labs/machines at read level
- [ ] Role enum works across 7 values with correct write-permission isolation
- [ ] Multi-school users can switch context
- [ ] Matt-as-platform-admin can manage schools
- [ ] Zero regressions on Phase 8 smoke scenarios
- [ ] `npm test`: ~50 new tests (40 RLS probes + 10 membership CRUD)
- [ ] `docs/projects/WIRING.yaml` updated — new `schools`, `school-memberships`, role-based auth system
- [ ] `docs/projects/dimensions3-followups.md` — FU-P marked ✅ RESOLVED (and FU-O role enum marked ✅ as part of it)

## Out of scope (future follow-ons)

- **FU-Q — dual student identity** (student enrolls at two schools, which row wins?)
- **FU-R — unified auth model** (teacher/student/fabricator all in one auth system)
- **FU-U — multi-tenant URL structure** (make `/s/<slug>/...` canonical rather than query-string)
- **FU-T — cross-class analytics double-count** (same student in 2 classes should not count twice in per-teacher dashboards)
- **Parent / guardian memberships** with `role='guardian'` and read-scoped to their own kid's data
- **Audit log** of role changes (tracked separately as FU-W)

---

**Next step when FU-P opens:** Matt signs off this plan + picks a sprint window. First commit is FU-P-1 schema + backfill. Migration numbers depend on what's claimed at open-time — use `git ls-tree origin/<branch>` across all active feature branches before claiming a number (learned the hard way during Phase 8-1 — see `docs/projects/preflight-phase-8-1-brief.md` for the collision story).
