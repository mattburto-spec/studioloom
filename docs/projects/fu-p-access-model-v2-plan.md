# FU-P — Access Model v2: School + Memberships + Role Enum

**Status:** PLAN DRAFT — not yet committed to a sprint.
**Drafted:** 25 April 2026 PM (after Phase 8 main merge + prod smoke prep).
**Motivation:** Matt asked during Phase 8 smoke prep — "does the system know that if I work at NIS and setup a lab, the other NIS teachers also get that info? also if a teacher at same school changes machines, other teachers get those updates?" — answer today is NO (per-teacher scoping everywhere). This plan is the sequencing to change that without breaking anything already in prod.
**Scope:** The FU-P half of the "FU-O/P/R Access Model v2" cluster that's been blocking school-level deployments since Dimensions3 Phase 6 closed out (14 Apr). Also touches FU-O (role enum) and FU-R (auth model split), but those are treated as follow-on work once the school entity is wired.
**Blocks:** Cross-teacher sharing of fabrication labs, machines, fabricators, units, classes. Dept-head / school-admin dashboards. Multi-school deployments (Seoul Foreign School pattern — 3 labs per building, different teachers per lab).
**Pre-conditions:** Phase 8 Checkpoint 8.1 PASSED in prod. No Phase 9 work in flight (this is a tenancy-boundary migration; concurrent feature work on any affected tables is risky).
**Estimated total effort:** ~7–10 days, split across 5 named sub-phases with Matt Checkpoints.

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

### FU-P-2 — RLS policy rewrite (~2 days)

**Scope:**
- For each of ~12 tables, drop the existing `<table>_select_teacher` / insert / update / delete policies and replace with school-membership-scoped versions.
- Convention:
  ```sql
  CREATE POLICY <table>_select_via_school
    ON <table>
    FOR SELECT
    USING (
      school_id IN (
        SELECT school_id FROM school_memberships
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin', 'dept_head', 'teacher', 'co_teacher')
      )
    );
  ```
- Dropping old policies + adding new in the SAME transaction prevents any window where RLS is off. Migration wraps in BEGIN/COMMIT.
- For tables that need both owner-read AND school-read (edge cases):
  ```sql
  USING (
    teacher_id = auth.uid()  -- current owner
    OR school_id IN (...)    -- school member with right role
  )
  ```
- `system_template` rows on `machine_profiles` stay globally readable per existing policy.

**Gate to FU-P-3:**
- Every existing API route still works in prod.
- Spot-check: a second teacher at NIS can now see the first teacher's labs + machines + classes (direct SQL query; UI changes land in FU-P-3+).
- The 12 tables' write paths still respect their original "owner can write their own" rules — school_memberships adds READ sharing but not WRITE by default.
- New tests: RLS probe per table asserting cross-teacher reads succeed when school_memberships.role allows it.

**Checkpoint: FU-P-2.1 — RLS isolation correct + no regressions.**

### FU-P-3 — Read APIs + UI adjustments (~1.5 days)

**Scope:**
- No API route changes REQUIRED (RLS does the filtering), but:
  - `/api/teacher/labs` `listMyLabs` → rename to `listVisibleLabs` conceptually; physical function stays + returns labs where RLS grants SELECT, which is now school-wide.
  - Same for machines, classes, fabricators.
- Teacher UI tweak: labs + machines now show WHICH teacher owns each row (so Mr. Jones's labs show "Owned by Mr. Jones" chip when Ms. Smith views them).
- New tab on `/teacher/preflight/lab-setup`: "My labs" vs "All at NIS" filter.
- Read-only for non-owners by default — writes still require `teacher_id = auth.uid()` at route level.

**Gate to FU-P-4:**
- Teachers at same school see each other's labs/machines by default.
- Teachers can't MODIFY another teacher's resources (only read).
- No regression in own-resource flows.

**Checkpoint: FU-P-3.1 — cross-teacher visibility verified in prod.**

### FU-P-4 — Write permissions via role + memberships UI (~2 days)

**Scope:**
- Write paths start checking `school_memberships.role` in addition to owner.
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
