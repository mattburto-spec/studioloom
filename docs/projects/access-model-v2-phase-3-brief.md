# Phase 3 — Class Roles & Permissions: Build Brief

**Project:** Access Model v2
**Phase:** 3 of 6 (master-spec numbering — see [`access-model-v2.md`](./access-model-v2.md) §1.5)
**Estimate:** ~3.5–4 days (3 days in master spec + ~half-day for §3 item 43 3-way scope expansion + buffer per Lesson #59)
**Branch:** `access-model-v2-phase-3` (off `main` @ `18b5c6f`)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**Master spec:** [`access-model-v2.md`](./access-model-v2.md) §4 Phase 3 (line 245); §3 items 40 / 41 / 42 / 43 (lines 186–189); Decision 7 (line 133); §8.6 items 7 + 8 (lines 540–583)
**Methodology:** [`docs/build-methodology.md`](../build-methodology.md)
**Author:** Drafted 1 May 2026 PM after Phase 2 ✅ + Phase 1.4 client-switch ✅ close-out
**Gate:** Matt Checkpoint **A4** — see §7

---

## 1. Goal

Build the `can(actor, action, resource, options?)` permission helper that 3-way scope-aggregates (`class_members`, `school_responsibilities`, `student_mentors`) and migrate every direct `author_teacher_id` / `classes.teacher_id` ownership read to it. After Checkpoint A4: co-teachers can edit shared classes, dept_heads can co-edit classes they're tagged on, programme coordinators have a real read identity, mentors can see the students they mentor across class boundaries (closing FU-MENTOR-SCOPE), and the `verifyTeacherCanManageStudent` semantics for plain teachers are preserved exactly.

**This is a refactor + capability gain, not new schema.** The Phase 0.6c + 0.7a tables (`class_members`, `school_responsibilities`, `student_mentors`) are already applied to prod, and Phase 0.8a backfilled `class_members.lead_teacher` rows for every active class. What's missing is (a) the Postgres + TypeScript helper layer that reads those tables, and (b) the migration of teacher-ownership callsites away from raw `.eq('author_teacher_id', X)` / `.eq('teacher_id', X)` filters.

### Why now

- Phases 1, 1.4, 2 closed. Auth unification is load-bearing; OAuth is live; per-class allowlist + governance shipped.
- The seam tables exist + have correct RLS already (Phase 0.6c + 0.7a). Phase 3 turns them on.
- Co-teaching is the most common school-procurement question (master spec §2 Decision 7). Hardcoded `classes.teacher_id` ownership is the FU-O blocker.
- Dashboard chip-UI in `dashboard-v2-build` is waiting on a `can()` helper that returns role badges per scope — every other open question depends on this answer.
- **FU-MENTOR-SCOPE P1** (cross-program mentorship 403, surfaced by dashboard-v2-build 26 Apr) closes when `has_student_mentorship()` lands.
- Open Studio v2 PP supervisor approval and PYP Exhibition mentor coordination are blocked behind Phase 3.

### Non-goals

- **Co-teacher invite UI / email flow** that *creates* a school's first co-teacher row → Phase 4 (school registration owns the surface where teachers manage class membership). Phase 3 ships the read path + a service-role-only INSERT helper for tests; teacher UI is Phase 4.
- **`school_admin` role at school level** → Decision 7 says NO. School membership is flat (`teachers.school_id`); programme coordinators (`school_responsibilities`) are the only school-scope role and they're coordinative, not authoritative.
- **Audit log instrumentation on permission denials** → Phase 5 wires `logAuditEvent()`. Phase 3 returns silent `false` on deny.
- **Per-student AI budget gates via `requiresTier`** → Phase 5 owns the budget cascade. The `requiresTier` *parameter* lands in Phase 3 (per spec §3.36); first consumer is Phase 5.
- **Removing legacy `verifyTeacherOwnsClass` / `verifyTeacherHasUnit` / `verifyTeacherCanManageStudent` helpers** → Phase 6 cutover. Phase 3 keeps them as thin shims that call `can()` underneath.
- **Migrating tests** that assert raw `.eq('author_teacher_id', ...)` shape → audit-only flag; tests stay valid for 1 release, drift sweep in Phase 6.
- **Schema changes to the 3 Phase 0 tables** — they're already correct. Only fix is the schema-registry annotation drift (Lesson #54 / FU-DD class).
- **Dashboard chip-UI consumer** — Phase 3 ships the data; the chip UI lives in `dashboard-v2-build` branch and lands when that worktree syncs.
- **`dept_head` department-model question** — `class_members.role = 'dept_head'` works at class scope; the *department* concept lives in school registration UI (Phase 4). Phase 3 ships the role enum + plain `has_class_role(?, 'dept_head')` reader.

---

## 2. Pre-flight ritual

Before touching any code:

- [ ] **Working tree clean.** `git status` empty. (Verified — clean on `main` @ `18b5c6f`.)
- [ ] **Baseline tests green.** `npm test` reports 2830 passed | 11 skipped. (Verified.)
- [ ] **Typecheck clean.** `npx tsc --noEmit --project tsconfig.check.json` exits 0. (Verified.)
- [ ] **Active-sessions row claimed** for `access-model-v2-phase-3` worktree branch in `/Users/matt/CWORK/.active-sessions.txt`. Remove on phase close.
- [ ] **Re-read these Lessons** (numbered per `docs/lessons-learned.md`):
  - **#43 — Think before coding: surface assumptions, don't hide confusion.** Permission semantics decisions (especially §3.8 open questions) must be in writing before SQL is written.
  - **#47 — Adding schema to an existing yaml = audit every writer first.** 50 callsites already audited (§3.3); confirm shape before migrating any one.
  - **#54 — Registries can lie.** schema-registry has 4 Phase 0 tables marked `status: dropped` that are live in prod (drift; capture in §4.6). Don't trust the registry — grep + check Postgres.
  - **#59 — Brief estimates can lie when the audit hasn't happened yet.** 3-day master-spec estimate didn't include the §3.43 3-way scope expansion. Budget the half-day. Then add buffer.
  - **#60 — Side-findings belong in the same commit.** If migrating a callsite reveals a related teacher-ownership bug (e.g., a route that should also check assignment), fix it inline; don't file a follow-up.
  - **#62 — Use `pg_catalog.pg_constraint` for cross-schema FK verification**, not `information_schema.constraint_column_usage` (Phase 3 SQL helpers will use `auth.users` + `public.teachers` joins).
  - **#64 — Cross-table RLS subqueries silently recurse; use `SECURITY DEFINER`** for any new policy that joins through `class_members` (which has scoped RLS) or `student_mentors` (also scoped). Phase 1.4 CS-2 hotfix `is_teacher_of_class()` is the reference pattern.
- [ ] **Read** Phase 0.6c (`20260428214735`) + 0.7a (`20260428215923`) + 0.8a (`20260428221516`) migrations. Confirm the schema seams + backfill state (lead_teacher rows seeded for every active class; 0 rows in `school_responsibilities` + `student_mentors`).
- [ ] **STOP and report findings.** Confirm with Matt the answers to §3.8 open questions before §4. Wait for explicit "go".

---

## 3. Audit — surface of this phase

Compiled 1 May 2026 PM. Numbers are exact unless marked approximate.

### 3.1 Schema seams already in prod (Phase 0)

| Table | Migration | Applied to prod | Notes |
|---|---|---|---|
| `class_members` | `20260428215923_class_members_and_audit_events.sql` | ✅ 29 Apr (Phase 0 prod-apply session) | 6-role enum (`lead_teacher` / `co_teacher` / `dept_head` / `mentor` / `lab_tech` / `observer`); `member_user_id` FK to `auth.users(id)`; unique active membership per (class, member, role); RLS member-self-read + same-school-teacher-read |
| `school_responsibilities` | `20260428214735_school_responsibilities_and_student_mentors.sql` | ✅ 29 Apr | 7-type enum (`pp_coordinator` / `pyp_coordinator` / `cas_coordinator` / `myp_coordinator` / `dp_coordinator` / `service_coordinator` / `safeguarding_lead`); RLS same-school-teacher-read-all; **0 rows seeded** |
| `student_mentors` | same migration | ✅ 29 Apr | 6-programme enum (`pp` / `pypx` / `cas` / `service` / `myp_personal_project` / `open`); polymorphic `mentor_user_id` → `auth.users(id)`; RLS mentor-self-read + same-school-teacher-read; **0 rows seeded** |
| `audit_events` | `20260428215923_class_members_and_audit_events.sql` | ✅ 29 Apr | Phase 5's surface, not Phase 3's. INSERT-only; no UPDATE/DELETE policies (immutable by absence). |

**Phase 0.8a backfill** (`20260428221516_phase_0_8a_backfill.sql`) seeded `class_members.lead_teacher` from `classes.teacher_id` for every active class (idempotent NOT EXISTS guard). NIS prod 3-Matts case handled — each `teacher_id` becomes its own `lead_teacher` row; no merge.

### 3.2 Existing teacher auth helpers (the layer Phase 3 evolves)

| Function | File:Line | Backed by | Phase 3 disposition |
|---|---|---|---|
| `requireTeacherAuth(req)` | `src/lib/auth/verify-teacher-unit.ts:24` | Supabase SSR client | **KEEP UNCHANGED.** Returns `{ teacherId }` from `auth.uid()`. Used by 200+ teacher routes via `auth.teacherId`. Phase 3 doesn't touch the entry point. |
| `verifyTeacherHasUnit(teacherId, unitId)` | `…:65` | createAdminClient | **EVOLVE → shim.** Returns `{ hasAccess, isAuthor, classIds }`. Phase 3 keeps signature, internally delegates to `can(actor, 'unit.view', { type: 'unit', id: unitId })`. Marked `@deprecated`. Phase 6 deletes. |
| `getNmConfigForClassUnit(classId, unitId)` | `…:106` | createAdminClient | **KEEP UNCHANGED.** No auth check — pure config read. Out of Phase 3 scope. |
| `verifyTeacherOwnsClass(teacherId, classId)` | `…:135` | createAdminClient | **EVOLVE → shim.** Phase 3 keeps signature, delegates to `can(actor, 'class.edit', { type: 'class', id: classId })`. Marked `@deprecated`. Phase 6 deletes. |
| `verifyTeacherCanManageStudent(teacherId, studentId)` | `…:163` | createAdminClient | **EVOLVE → shim.** Phase 3 keeps signature, delegates to `can(actor, 'student.view', { type: 'student', id: studentId })`. Critical: Decision 7 (master spec line 140) says `can()`'s default for plain teacher → student must preserve THESE semantics exactly. Class roles ADD permissions, never gate the base. |

### 3.3 Teacher-ownership callsites (the migration surface)

Counted 1 May 2026 PM via `grep -rln "author_teacher_id\|\.eq.*teacher_id" src/`:

- **39 distinct files** reference `author_teacher_id`
- **43 distinct files** filter by `teacher_id` / `author_teacher_id` directly via `.eq()`
- Overlap → **~50 unique callsites** across `src/`

Categories:

| Category | Count | Example files |
|---|---|---|
| API routes — teacher | ~30 | `units/route.ts`, `students/route.ts`, `quest/route.ts`, `class-units/route.ts`, `assessments/route.ts`, `schedule/today/route.ts`, … |
| API routes — admin | 2 | `admin/teachers/route.ts`, `admin/teachers/[id]/route.ts` |
| API routes — student auth login | 2 | `student-login/route.ts`, `student-classcode-login/route.ts` (write `students.author_teacher_id` on creation) |
| Pages (server components) | 7 | `teacher/settings/page.tsx`, `teacher/classes/[classId]/page.tsx`, `teacher/units/page.tsx`, `teacher/units/[unitId]/page.tsx`, `teacher/units/[unitId]/class/[classId]/page.tsx`, `teacher/units/author/[teacherId]/page.tsx`, `teacher/students/page.tsx` |
| Helpers / lib | 3 | `auth/verify-teacher-unit.ts`, `students/class-enrollment.ts`, `access-v2/__tests__/migration-*.test.ts` |
| Tests | 4+ | `units/__tests__/route.test.ts`, `students/__tests__/route.test.ts`, plus migration tests |
| Types | 1 | `src/types/index.ts` (interface declaration only) |

Patterns:

- **`units.author_teacher_id = teacherId`** — author check. **KEEP** as natural identifier (units have one author by definition; not the same as access control).
- **`units.teacher_id = teacherId`** — legacy ownership shadow. **AUDIT** in Phase 6 cutover; likely also kept as pre-Decision-7 archive column.
- **`classes.teacher_id = teacherId`** — class ownership read. **MIGRATE** → `has_class_role(class_id, ?)` or `can('class.edit', ...)`.
- **`classes.teacher_id` in INSERTs** to `classes` (creating a class) — **EXTEND** to also write `class_members.lead_teacher` row in the same transaction.
- **`students.author_teacher_id = teacherId`** in admin/teacher routes — **MIGRATE** to `can('student.view', ...)`. The `student.author_teacher_id` column itself stays (it's a creation lineage marker, not access control).

### 3.4 Postgres permission helper functions (existing + needed)

| Function | Status | Phase | Notes |
|---|---|---|---|
| `current_teacher_school_id()` | ✅ Exists | Preflight Phase 8.1 (`20260427134953_fabrication_labs.sql`) | `SECURITY DEFINER`. Returns the current authenticated teacher's `school_id`. |
| `is_teacher_of_class(uuid)` | ✅ Exists | Phase 1.4 CS-2 hotfix (`20260430015239_phase_1_4_cs2_fix_class_students_classes_recursion.sql`) | `SECURITY DEFINER`. Breaks `classes ↔ class_students` RLS recursion. |
| `has_class_role(class_id uuid, required_role text DEFAULT NULL)` | ❌ **NEW — Phase 3.1** | | `SECURITY DEFINER`. Returns `true` if `auth.uid()` has a non-removed `class_members` row for `class_id`, optionally matching `required_role`. |
| `has_school_responsibility(school_id uuid, required_type text DEFAULT NULL)` | ❌ **NEW — Phase 3.1** | | `SECURITY DEFINER`. Returns `true` if `auth.uid()` has a non-deleted `school_responsibilities` row for `school_id`, optionally matching `required_type`. |
| `has_student_mentorship(student_id uuid, required_programme text DEFAULT NULL)` | ❌ **NEW — Phase 3.1** | | `SECURITY DEFINER`. Returns `true` if `auth.uid()` has a non-deleted `student_mentors` row for `student_id`, optionally matching `required_programme`. |

All three new helpers MUST be `SECURITY DEFINER` (Lesson #64) since RLS policies on adjacent tables will eventually call them. `EXECUTE` granted to `authenticated` (and explicit `REVOKE FROM PUBLIC` per Lesson #52 — Supabase's auto-grant to `anon` and `authenticated` does NOT respect `REVOKE FROM PUBLIC` alone).

### 3.5 The `can()` helper signature

Per master spec §3 item 36 (monetisation seam) and item 43 (3-way scope expansion):

```ts
// src/lib/access-v2/permissions/actions.ts
export type Action =
  // Class scope
  | 'class.view' | 'class.edit' | 'class.delete' | 'class.invite_member' | 'class.remove_member'
  // Unit scope
  | 'unit.view' | 'unit.edit' | 'unit.fork' | 'unit.delete' | 'unit.publish'
  // Student scope
  | 'student.view' | 'student.edit' | 'student.message' | 'student.export'
  // School scope
  | 'school.view' | 'school.settings.edit_low_stakes' | 'school.settings.edit_high_stakes'
  // Programme scope
  | 'programme.coordinate'

export type Resource =
  | { type: 'class'; id: string; school_id?: string }
  | { type: 'unit'; id: string; author_teacher_id?: string; school_id?: string }
  | { type: 'student'; id: string; school_id?: string }
  | { type: 'school'; id: string }
  | { type: 'programme'; school_id: string; programme_type: string }

// src/lib/access-v2/can.ts
export type CanOptions = {
  /** Optional tier gate. If supplied, can() short-circuits false when
   *  school.subscription_tier is not in this set. Default: tier check skipped.
   *  See master spec §3 item 36 (monetisation seam). */
  requiresTier?: SubscriptionTier[]
}

export async function can(
  actor: ActorSession,
  action: Action,
  resource: Resource,
  options?: CanOptions
): Promise<boolean>
```

Resolution order (default — opt-in tier gate):

1. **Tier gate** (if `options.requiresTier` present) — load `schools.subscription_tier`; short-circuit `false` if not in allowed set.
2. **Platform admin** — if `actor.is_platform_admin === true`, allow. (Phase 5 wires `logAuditEvent` for platform-admin actions; Phase 3 leaves a `// TODO Phase 5` marker.)
3. **Class scope** — if `resource.type === 'class' | 'unit'` (and unit has a class context), call `has_class_role(class_id, ?)`. Role determines allowed actions:
   - `lead_teacher`, `co_teacher`, `dept_head` → all class.* + unit.* + student.* in scope; cannot delete the class (only `lead_teacher` can, via explicit `class.delete` action).
   - `mentor` → class.view, unit.view, student.view, student.message in scope; no edit.
   - `lab_tech` → only fabrication-related actions; no general read.
   - `observer` → read-only across the class.
4. **Student mentorship scope** — if `resource.type === 'student'`, call `has_student_mentorship(student_id, programme?)`. Mentor can perform programme-scoped student.view + student.message.
5. **School responsibility scope** — if `resource.type === 'school' | 'programme'`, call `has_school_responsibility(school_id, type?)`. Coordinator can perform programme.coordinate-tier actions across the programme.
6. **Plain teacher fallback** — if none of the above match: preserve `verifyTeacherCanManageStudent` semantics exactly (the teacher owns at least one active non-archived class the resource student is enrolled in).

**Critical:** step 6 is NOT a "teacher only" branch — it's the additive base. A `co_teacher` of class A and a `lead_teacher` of class B both match step 6 if student S is in either class. Class roles only ADD permissions on top of step 6.

### 3.6 Dashboard scope endpoint (new)

`GET /api/teacher/me/scope` returns:

```json
{
  "scopes": [
    { "scope": "class:abc123", "role": "lead_teacher", "class_name": "G10 Design" },
    { "scope": "class:def456", "role": "co_teacher",  "class_name": "G11 Service" },
    { "scope": "student:xyz",  "role": "mentor", "programme": "pp", "student_name": "John D." },
    { "scope": "school:nis",   "role": "pyp_coordinator" }
  ],
  "fetched_at": "2026-05-01T12:34:56Z"
}
```

`dashboard-v2-build` chip UI consumes this. Caching: per-teacher in-memory 30s TTL; consumers cache-bust on `class_members` / `student_mentors` / `school_responsibilities` write (Phase 4 + Phase 5 surfaces). Phase 3 doesn't add a cache; consumers receive the live data.

### 3.7 Registry cross-check (Step 5c per build methodology)

| Registry | State (1 May 2026) | Drift caught |
|---|---|---|
| `WIRING.yaml` | `auth-system` v2; `future_needs` mentions Phase 1.4 client-switch (STALE — already shipped 30 Apr). No `class-management` system. No `permission-helper` system. | (a) trim auth-system.future_needs; (b) add new `class-management` system; (c) add new `permission-helper` system. Done in §4.6. |
| `schema-registry.yaml` | `class_members` (line 1901), `audit_events` (1495), `school_responsibilities` (7526), `student_mentors` (8402) all marked `status: dropped` with `columns: {}` — **WRONG, all 4 are live in prod** | Same FU-DD scanner-misparse class as Phase 1.4 CS-1 (compound CREATE TABLE migrations — scanner trips on multi-table SQL files). Fix in §4.6 close-out by manual rewrite. |
| `api-registry.yaml` | 207 `/api/teacher/*` routes; new `/api/teacher/me/scope` route adds 1 | Sync after §4.5 by rerunning `scan-api-routes.py --apply`. |
| `feature-flags.yaml` | No `auth.permission_helper_rollout` flag yet | Optional — see §3.8 question 6. If staged-rollout flag added in §4.0, register here. |
| `vendors.yaml` | Unaffected | None. |
| `data-classification-taxonomy.md` | `class_members`, `student_mentors`, `school_responsibilities` need classification entries | Add in §4.6 (likely `pii` for member_user_id, `programme_metadata` for the rest). |
| `rls-coverage.json` | 0 `no_rls`, 0 `rls_enabled_no_policy` (clean post-Phase-1.4) | Verify post-§4.4 by rerunning `scan-rls-coverage.py`. |

**Spot-checks performed** (Lesson #54):

- WIRING `auth-system.key_files` → grep confirmed `src/lib/access-v2/actor-session.ts` exists; `provision-student-auth-user.ts` exists. Clean.
- schema-registry `class_members` entry → file exists at line 1901, but `columns: {}` is wrong; migration `20260428215923_class_members_and_audit_events.sql:48-63` defines 13 columns. Drift confirmed.
- api-registry `/api/teacher/students` entry → grep confirmed route exists at `src/app/api/teacher/students/route.ts`. Clean.

### 3.8 Open questions (must resolve before §4)

These are the §1 STOP-and-report items. Each one is signed off by Matt before code lands.

1. **Where does `can()` live?**
   **Proposal:** `src/lib/access-v2/can.ts` alongside `actor-session.ts`. Action enum at `src/lib/access-v2/permissions/actions.ts`. Tests at `src/lib/access-v2/__tests__/can.test.ts`.
   **OK?**

2. **Should `verifyTeacherOwnsClass` / `verifyTeacherHasUnit` / `verifyTeacherCanManageStudent` be evolved or replaced?**
   **Proposal:** Keep all three signatures. Internally delegate to `can()`. Mark `@deprecated`. Phase 6 cutover deletes the shims after the audit confirms 0 callsites remain.
   **OK?**

3. **Do we ship the chip-UI consumer in this phase?**
   **Proposal:** NO. Phase 3 ships the helper + Postgres functions + scope endpoint. The chip UI lives in `dashboard-v2-build` branch and lands when that worktree syncs. Phase 3 closes by smoke-verifying the endpoint returns the expected shape; chip UI integration is a `dashboard-v2-build` task.
   **OK?**

4. **`dept_head` semantics:** master spec §2.7 says "dept head sees all classes in their department." But `class_members.role = 'dept_head'` is at class scope.
   **Proposal:** Phase 3 wires `dept_head` as a class-scope role (one row per class the dept_head is tagged on). The *department* concept (auto-tag dept_head into all classes of their department) lives in school registration UI (Phase 4). Phase 3 ships the role + plain `has_class_role(?, 'dept_head')` reader. **File** FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL P2 for the auto-tag work.
   **OK?**

5. **Permission denial logging:** Phase 5's `logAuditEvent()` doesn't exist yet.
   **Proposal:** `can()` returns silent `false` on deny in Phase 3. Add a `// TODO Phase 5` marker at the deny site. Phase 5 wires the optional logging hook.
   **OK?**

6. **Staged-rollout feature flag?**
   **Proposal:** Optional `auth.permission_helper_rollout` boolean flag in `admin_settings` (default `true` — flag exists for kill-switch). Every `can()` call wraps in `if (!flag) return legacyHelper(...)`. Lets us roll back to the shim path without code revert if a regression surfaces. Removed in Phase 6 cutover.
   **OK?** (If NO, skip §4.0; helper goes live unconditionally.)

7. **Service-role test seed for `class_members.co_teacher`:** Phase 3.5 smoke needs a co_teacher row in prod-preview but Phase 4 owns the invite UI.
   **Proposal:** Add a one-line `psql` script at `scripts/access-v2/seed-test-co-teacher.sh` that prompts for class_id + member_email + role and INSERTs via service role. Used for smoke only; not shipped to prod admin tooling.
   **OK?**

8. **Migration of `students.author_teacher_id` writes in 2 student-auth-login routes:**
   **Proposal:** Keep the column write — it's a creation lineage marker, not access control. The READ paths that filter by `students.author_teacher_id = teacherId` get migrated.
   **OK?**

---

## 4. Sub-phases

Each sub-phase is a separate commit (Lesson #45 surgical changes; methodology rule 7 separate commits no squashing). Stop triggers documented per phase.

### Phase 3.0 — Pre-flight + decisions (~0.25 day)

**Output:** Matt-signed-off answers to §3.8 question 1–8. Active-sessions row claimed for new branch. Optional `auth.permission_helper_rollout` flag added to `admin_settings` if Q6 = YES.

**Migrations:** 0 (or 1 if flag added).

**Stop trigger:** Any §3.8 answer NOT received → STOP.

### Phase 3.1 — Postgres helpers (~0.25 day)

**Output:** 1 migration timestamped `<UTC>_phase_3_1_permission_helpers.sql`:

```sql
-- has_class_role
CREATE OR REPLACE FUNCTION public.has_class_role(
  _class_id UUID,
  _required_role TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_members
    WHERE class_id = _class_id
      AND member_user_id = auth.uid()
      AND removed_at IS NULL
      AND (_required_role IS NULL OR role = _required_role)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_class_role(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_class_role(UUID, TEXT) TO authenticated, service_role;

-- has_school_responsibility (parallel shape)
-- has_student_mentorship (parallel shape)
```

**Tests:** 9 shape tests in `src/lib/access-v2/__tests__/migration-phase-3-1-helpers.test.ts` — confirm `SECURITY DEFINER`, `STABLE`, `search_path` lock-down, `REVOKE FROM PUBLIC + anon`, `GRANT TO authenticated`, parameter shape, default-NULL semantics.

**Apply to prod:** Via Supabase SQL Editor in timestamp order. Verify each function shape via `pg_proc` query before proceeding.

**Stop trigger:** Any verification query returns unexpected function definition → STOP and diagnose.

### Phase 3.2 — TypeScript `can()` helper (~0.5 day)

**Output:**
- `src/lib/access-v2/permissions/actions.ts` — `Action` + `Resource` + `CanOptions` types.
- `src/lib/access-v2/can.ts` — `can(actor, action, resource, options?)` implementation.
- `src/lib/access-v2/__tests__/can.test.ts` — ~30 unit tests covering all 6 resolution branches + tier gate + platform admin + plain teacher fallback + 3 cross-scope cases (e.g., user is co_teacher AND mentor AND coordinator simultaneously).

**Code change pattern:** No existing route imports change yet. This phase ships the helper standalone.

**Tests:** ~30 new unit tests. Mock `createAdminClient()` for the helper's internal SQL reads (or use a real test DB if the harness exists; today there's no live RLS harness — file FU-HH P2 still open).

**Stop trigger:**
- Any test fails for a permission combination that the matrix in §3.5 says should pass.
- Test count drops below 2830 baseline.
- `npx tsc --noEmit --project tsconfig.check.json` fails.

### Phase 3.3 — Scope endpoint (~0.25 day)

**Output:**
- `src/app/api/teacher/me/scope/route.ts` — `GET` returns the chip-shaped JSON per §3.6.
- 5 tests asserting shape + RLS isolation (other-school teacher gets empty).

**Code change pattern:**

```ts
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const auth = await requireTeacherAuth(req);
  if (auth.error) return auth.error;

  const db = await createServerSupabaseClient();

  const [classMemberships, mentorships, responsibilities] = await Promise.all([
    db.from('class_members')
      .select('class_id, role, classes(name)')
      .eq('member_user_id', auth.teacherId)
      .is('removed_at', null),
    db.from('student_mentors')
      .select('student_id, programme, students(name)')
      .eq('mentor_user_id', auth.teacherId)
      .is('deleted_at', null),
    db.from('school_responsibilities')
      .select('school_id, responsibility_type')
      .eq('teacher_id', auth.teacherId)
      .is('deleted_at', null),
  ]);

  // Return chip-shaped JSON per §3.6.
}
```

Note: this route uses the SSR client (RLS-respecting), aligned with Phase 1.4 client-switch direction.

**Tests:** 5 tests — shape, empty-state, cross-school RLS isolation, role badge correctness, `Cache-Control: private` header (Lesson #11).

**Stop trigger:** RLS isolation test returns rows it shouldn't → STOP, audit.

### Phase 3.4 — Migrate teacher-ownership callsites (~1.5 days)

**Output:** ~50 unique callsites migrated across 3 batches. Each batch is its own commit; smoke test between batches.

**Batch A — UNIT routes (~10 files, ~0.5 day):**
- `units/route.ts`, `units/[unitId]/*`, `class-units/*`, `unit-thumbnail/route.ts`, etc.
- Replace `.eq('classes.teacher_id', X)` joins with `has_class_role` reader / `can('class.edit', ...)`.
- KEEP `units.author_teacher_id` author check unchanged (natural identifier).
- Smoke: load `/teacher/units` — expected list unchanged for current teacher; co_teacher (manually seeded via Phase 3.0 script) sees additional shared classes' units.

**Batch B — CLASS routes (~15 files, ~0.5 day):**
- `class-students/route.ts`, `students/route.ts`, `assessments/route.ts`, `quest/*`, `nm-observation/*`, `schedule/*`, `safety-certs/*`, `badges/*`, `student-snapshot/*`, `welcome/add-roster/*`, …
- Replace `.eq('teacher_id', auth.teacherId)` and `.eq('author_teacher_id', auth.teacherId)` with `can()` calls.
- **CRITICAL:** INSERT routes that create a `classes` row MUST also INSERT `class_members.lead_teacher` in the same transaction (Lesson #60 — if the seam isn't load-bearing, future co-teacher invites break).
- Smoke: full CRUD on a class as lead_teacher; full CRUD on a shared class as co_teacher; cross-school read returns 404.

**Batch C — STUDENT-touching routes (~15 files, ~0.5 day):**
- `students/route.ts`, `students/[studentId]/*`, `student-snapshot/*`, every route that calls `verifyTeacherCanManageStudent`.
- The shim (per §3.2 Q2) now delegates to `can('student.view', ...)`; semantics preserved exactly per Decision 7 line 140.
- Smoke: plain teacher → only their students; mentor (via `student_mentors` row) → mentored student visible across class boundary; non-related teacher → 404.

**Stop triggers:**
- Any smoke run shows a teacher gaining or losing access from the pre-Phase-3 baseline (other than the explicit "co_teacher gains access" gain). STOP and diagnose.
- Test count regresses below 2830 baseline without explanation.
- `tsc` fails.

### Phase 3.5 — Co-teacher / mentor / dept_head smoke (~0.25 day)

**Output:** Smoke run report `docs/projects/access-model-v2-phase-3-smoke.md` documenting 5 scenarios:

1. **lead_teacher** — full access (regression baseline).
2. **co_teacher** — same access as lead_teacher to shared class; cannot delete the class.
3. **mentor** of a student in another teacher's class — student.view + student.message work; class.edit fails.
4. **dept_head** of a class — same as lead_teacher per Phase 3 simplification (§3.8 Q4); audit how this'll evolve in Phase 4.
5. **non-member teacher** — 404 on shared class, student, mentor surface.

Manual prod-preview smoke — branch alias URL (Lesson #63 — not deployment-pinned URL).

**Stop trigger:** Any scenario fails → STOP, diagnose. Don't paper over.

### Phase 3.6 — Registry hygiene + close-out (~0.5 day)

**Output:**

- **`schema-registry.yaml`** — rewrite the 4 Phase 0 entries (`class_members`, `audit_events`, `school_responsibilities`, `student_mentors`) from `status: dropped` + `columns: {}` to `status: active` + full column definitions. Add `applied_date: 2026-04-29`. Add Phase 3 spec_drift entry on `class_members` (lead_teacher rows now load-bearing).
- **`WIRING.yaml`** —
  - `auth-system`: trim `future_needs` (drop "Phase 1.4 client-switch" line — already shipped); add `permission-helper` to `affects` list.
  - **NEW** `class-management` system: depends_on `[auth-system, permission-helper]`; affects every teacher route + `dashboard-v2-build`; key_files include `class_members` writers and `verify-teacher-unit.ts`.
  - **NEW** `permission-helper` system: depends_on `[auth-system]`; affects `class-management` + every teacher route; key_files include `src/lib/access-v2/can.ts`, `src/lib/access-v2/permissions/actions.ts`, the 3 Postgres helpers.
- **`api-registry.yaml`** — `python3 scripts/registry/scan-api-routes.py --apply`; expect +1 route (`/api/teacher/me/scope`).
- **`feature-flags.yaml`** — if §3.8 Q6 = YES, register `auth.permission_helper_rollout`.
- **`data-classification-taxonomy.md`** — add 3 entries: `class_members.member_user_id` → `pii`; `student_mentors` table → `programme_metadata`; `school_responsibilities` → `programme_metadata`.
- **`docs/scanner-reports/rls-coverage.json`** — rerun `python3 scripts/registry/scan-rls-coverage.py`; verify still 0 + 0.
- **`docs/projects/access-model-v2-followups.md`** —
  - **CLOSE** FU-MENTOR-SCOPE P1 (resolved by `has_student_mentorship`).
  - **FILE** FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL P2 (Phase 4 wires the auto-tag-into-classes-of-department logic).
  - **FILE** FU-AV2-PHASE-3-CHIP-UI P2 (`dashboard-v2-build` consumes `/api/teacher/me/scope`).
  - **FILE** FU-AV2-PHASE-6-DELETE-SHIMS P3 (delete the 3 deprecated helper shims in Phase 6 cutover).
- **`docs/decisions-log.md`** — append entries for §3.8 sign-offs + the `dept_head` scope simplification.
- **`docs/changelog.md`** — append session entry: what shipped, what landed in registries, links to commits/migrations.
- **`docs/lessons-learned.md`** — capture any new Lesson surfaced (likely about `SECURITY DEFINER` + RLS recursion if any new policy interactions surface).

**Stop trigger:** any registry diff fails review → STOP, fix before commit.

---

## 5. Don't-stop-for list

Per build-methodology rule 4 (don't paper over surprises) — these are the items where stopping would be over-cautious:

- Cosmetic test-mock updates (route tests need to mock `can()` instead of `verifyTeacherOwnsClass` in a few cases — purely mechanical).
- Helper file path imports.
- Adjacent route discovering it ALSO writes `students.author_teacher_id` (creation marker — keep, don't migrate write path).
- Tests that assert raw `.eq('author_teacher_id', ...)` shape — leave as-is, file an audit-only sweep for Phase 6 cutover.
- The `units.teacher_id` legacy shadow column — out of Phase 3 scope; Phase 6 cutover decides keep-or-drop.
- `getNmConfigForClassUnit` still using admin client — out of scope.

---

## 6. Stop triggers

Per build-methodology rule 4 — STOP and report findings before continuing:

- Any §3.8 open question NOT signed off before Phase 3.0 → STOP.
- Any Postgres helper `pg_proc` verification returns unexpected definition → STOP.
- A migrated callsite changes a teacher's pre-Phase-3 baseline access (other than the explicit co_teacher / mentor / coordinator gains) → STOP, diagnose.
- Cross-school read succeeds in §3.5 smoke → STOP, RLS not enforcing.
- Test count regresses below 2830 baseline without explanation → STOP.
- `npx tsc --noEmit --project tsconfig.check.json` fails → STOP.
- A Postgres permission helper triggers RLS recursion (Lesson #64) → STOP, fix the policy, don't `SECURITY DEFINER`-paper-over without understanding why.
- The `gallery_*` permissive policies turn out to be load-bearing in a way that breaks under role checks → STOP, audit before proceeding.

---

## 7. Checkpoint A4 — gate criteria

Phase 3 closes when ALL pass:

### Code

- [ ] `src/lib/access-v2/can.ts` exists with full Action / Resource matrix per §3.5.
- [ ] `src/lib/access-v2/permissions/actions.ts` exists with the typed Action enum.
- [ ] `verifyTeacherOwnsClass`, `verifyTeacherHasUnit`, `verifyTeacherCanManageStudent` are thin shims delegating to `can()`. Marked `@deprecated`.
- [ ] All ~50 callsites in §3.3 migrated. `grep` confirms no direct `.eq('teacher_id', ...)` or `.eq('author_teacher_id', ...)` reads on `classes` rows in any route handler. (UNIT-author writes + INSERT-creation-marker writes preserved.)
- [ ] `GET /api/teacher/me/scope` route exists, returns chip-shaped JSON per §3.6.
- [ ] Tests updated; **2830 → ≥2860 (≥30 new)**, 0 regressions.
- [ ] `npx tsc --noEmit --project tsconfig.check.json` 0 errors.

### Migrations

- [ ] 1 new migration applied to prod (Phase 3.1 — 3 helpers).
- [ ] `pg_proc` verification per helper confirms `SECURITY DEFINER` + `STABLE` + `search_path = public, pg_temp` + `REVOKE FROM PUBLIC, anon` + `GRANT TO authenticated, service_role`.
- [ ] Optionally 1 additional migration if §3.8 Q6 = YES (admin_settings flag insert).
- [ ] `bash scripts/migrations/verify-no-collision.sh` exits 0 against `origin/main`.

### Smoke (prod-preview, branch-alias URL — Lesson #63)

- [ ] All 5 §3.5 scenarios PASS.
- [ ] Vercel logs: zero `Invalid session` or RLS-policy errors during smoke.
- [ ] `/api/teacher/me/scope` returns expected shape for lead_teacher / co_teacher / mentor / coordinator.
- [ ] No regression on existing `dashboard-v2-build` worktree's prod-preview (synced post-Phase-3).

### Registries (Phase 3.6)

- [ ] schema-registry.yaml: 4 Phase 0 table entries rewritten to `status: active` + full columns.
- [ ] WIRING.yaml: auth-system `future_needs` trimmed; `class-management` + `permission-helper` systems added.
- [ ] api-registry.yaml: `/api/teacher/me/scope` registered.
- [ ] feature-flags.yaml: `auth.permission_helper_rollout` registered (if §3.8 Q6 = YES).
- [ ] data-classification-taxonomy.md: 3 new entries.
- [ ] rls-coverage.json: still 0 `no_rls`, 0 `rls_enabled_no_policy`.

### Documentation

- [ ] This brief at HEAD with completion notes appended.
- [ ] `docs/projects/access-model-v2-phase-3-smoke.md` written (5-scenario report).
- [ ] `docs/projects/access-model-v2-followups.md` updated: FU-MENTOR-SCOPE closed; 3 new FUs filed.
- [ ] `docs/decisions-log.md` appended with §3.8 sign-offs + dept_head simplification.
- [ ] `docs/changelog.md` session entry written.
- [ ] Handoff doc written for next session (Phase 4 prep).

### Followups

- [ ] FU-MENTOR-SCOPE P1 → ✅ RESOLVED.
- [ ] FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL P2 → filed.
- [ ] FU-AV2-PHASE-3-CHIP-UI P2 → filed.
- [ ] FU-AV2-PHASE-6-DELETE-SHIMS P3 → filed.

---

## 8. Risks + mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **`can()` returns false for an action that the legacy helper allowed** — silently breaks teacher UX | High | Medium | Decision 7 line 140 says preserve `verifyTeacherCanManageStudent` semantics exactly. Phase 3.4 batches smoke between each. Optional rollout flag (§3.8 Q6) gives a kill-switch. |
| **`SECURITY DEFINER` helper triggers RLS recursion when read by a policy** | High | Low | Lesson #64 — pre-emptively use SECURITY DEFINER on all 3 helpers. Phase 1.4 CS-2 hotfix is the reference pattern. |
| **`class_members` UNIQUE-active index blocks legitimate re-invite** | Medium | Low | Migration comment: `removed_at IS NULL` partial unique. Re-add creates a new row; old row stays for audit. Smoke covers this. |
| **Phase 0.8a backfill missed an active class** — that class has no `lead_teacher` row → all `has_class_role` calls return false → owner locked out | High (one teacher's classes invisible) | Low | Add a Phase 3.1 verification SQL: `SELECT id FROM classes c WHERE NOT EXISTS (SELECT 1 FROM class_members WHERE class_id = c.id AND role = 'lead_teacher' AND removed_at IS NULL) AND c.deleted_at IS NULL`. Expected: 0 rows. STOP if not. Backfill any miss before §4.4. |
| **Tests using mocked admin client mask the real RLS behaviour** | Medium | Medium | §3.5 smoke is mandatory in prod-preview, not just unit tests. FU-HH (live RLS test harness) tracked separately. |
| **`requiresTier` parameter never gets a consumer in Phase 3** — dead seam | Low (forward compat) | High | Acceptable. Master spec §3.36 explicitly designs it as a seam for Phase 5+. Document the seam in §3.5 + close-out. |
| **`/api/teacher/me/scope` endpoint becomes load-bearing for chip UI before chip UI is built** | Low | Medium | Endpoint ships standalone in Phase 3.3 + smoke; chip UI is dashboard-v2-build's task post-sync. |
| **3-Matts NIS prod data: each `teacher_id` has its own `lead_teacher` row** — cross-account access grants might be expected but not modelled | Medium | Low | NIS plan: 3 separate teacher rows stay separate (per Phase 0.8a + master-spec line 319 risk note). If Matt expects cross-account access, that's a Phase 6 decision. Phase 3 doesn't touch the 3-Matts pattern. |
| **Brief estimate underestimates** | Medium | Medium | Lesson #59 — buffer included (§9). Stop trigger: if Phase 3.4 takes >2 days, STOP and re-scope. |

---

## 9. Estimate

| Sub-phase | Estimate |
|---|---|
| 3.0: Pre-flight + decisions | 0.25 day |
| 3.1: Postgres helpers (1 migration + tests + prod apply) | 0.25 day |
| 3.2: TypeScript `can()` helper + ~30 tests | 0.5 day |
| 3.3: Scope endpoint + 5 tests | 0.25 day |
| 3.4: Migrate ~50 callsites in 3 batches | 1.5 day |
| 3.5: Co-teacher / mentor / dept_head smoke | 0.25 day |
| 3.6: Registry hygiene + close-out | 0.5 day |
| Buffer (Lesson #59 — estimates lie) | 0.5 day |
| **Total** | **~3.75 days** (round to **4 days**) |

This is +0.75 day over the master spec's 3-day estimate. The delta is real:
- §3.43 3-way scope expansion adds 0.5 day vs the original single-table check.
- §3.36 monetisation seam (`requiresTier` parameter) adds ~0.05 day.
- §3.8 Q4 dept_head simplification + FU file adds 0.05 day.
- Lesson-#59 buffer adds 0.5 day.

If §3.8 Q6 = NO (no rollout flag), shave ~0.1 day. If §3.8 Q3 = YES (chip UI in this phase), add ~0.5 day.

---

## 10. References

- **Master spec:** [`docs/projects/access-model-v2.md`](./access-model-v2.md) §4 Phase 3 (line 245); §3 items 40 / 41 / 42 / 43 (lines 186–189); Decision 7 (line 133); §8.6 items 7 + 8 (lines 540–583).
- **Parent briefs:** [`access-model-v2-phase-0-brief.md`](./access-model-v2-phase-0-brief.md), [`access-model-v2-phase-1-brief.md`](./access-model-v2-phase-1-brief.md), [`access-model-v2-phase-2-brief.md`](./access-model-v2-phase-2-brief.md).
- **Phase 0 schema seam migrations** (already applied to prod):
  - `supabase/migrations/20260428214735_school_responsibilities_and_student_mentors.sql`
  - `supabase/migrations/20260428215923_class_members_and_audit_events.sql`
  - `supabase/migrations/20260428221516_phase_0_8a_backfill.sql` (lead_teacher backfill)
- **Permission-helper exemplars:**
  - `supabase/migrations/20260427134953_fabrication_labs.sql` — `current_teacher_school_id()` SECURITY DEFINER pattern.
  - `supabase/migrations/20260430015239_phase_1_4_cs2_fix_class_students_classes_recursion.sql` — `is_teacher_of_class()` recursion-breaking pattern.
- **Lessons:** #43, #45, #47, #52, #54, #59, #60, #62, #64. Re-read pre-flight.
- **Followups (open at Phase 3 start):** FU-MENTOR-SCOPE P1 (will close); FU-AV2-PHASE-14B-2 P3 (18-route cleanup, parallel track); FU-AV2-RLS-SECURITY-DEFINER-AUDIT P2 (parallel sweep).
- **Methodology:** [`docs/build-methodology.md`](../build-methodology.md). Pre-flight ritual; checkpoint discipline; registry cross-check Step 5c.
- **Loominary OS-seam principle (ADR-001):** `class-management` + `permission-helper` systems should keep interfaces clean enough that a second product (Makloom) could plug in without rewrite. Roles are a domain-level concept; per-product specialization happens in `permissions/actions.ts`.

---

## 11. Sign-off

**Pre-flight + audit complete (1 May 2026 PM).** Brief drafted with:

- 4 Phase 0 schema seams confirmed live in prod (with 1 schema-registry drift to fix in §4.6).
- 5 existing teacher auth helpers identified for shim-or-keep disposition.
- ~50 ownership callsites enumerated across 39 files; 3-batch migration plan.
- 3 Postgres helpers specified with `SECURITY DEFINER` discipline (Lesson #64).
- 6-branch resolution order for `can()` with monetisation seam (`requiresTier` parameter).
- 8 open questions surfaced, each with a default proposal awaiting Matt's sign-off.

**STOP — awaiting Matt's sign-off on:**

- All 8 §3.8 open questions (Q1 helper location, Q2 shim disposition, Q3 chip UI scope, Q4 dept_head simplification, Q5 deny logging, Q6 rollout flag, Q7 service-role test seed, Q8 students.author_teacher_id write preservation).
- §4 sub-phase ordering (3.0 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6).
- §9 estimate (~4 days; flag if too aggressive or too padded).
- Concerns about the schema-registry drift fix being scoped into Phase 3 close-out (§4.6) vs filed as a separate FU.

When signed off, Phase 3.0 starts with branch creation + active-sessions row claim + (if Q6 = YES) the rollout flag migration. Phase 3 expected close: ~5 May 2026 with Checkpoint A4 PASS.
