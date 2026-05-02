# Phase 4 — School Registration, Settings & Governance: Build Brief

**Project:** Access Model v2
**Phase:** 4 of 6 (master-spec numbering — see [`access-model-v2.md`](./access-model-v2.md) §1.5)
**Estimate:** ~7–8 days (master spec says 3 days; see §9 — that estimate predates the §3.8-style audit and the Lesson #59 buffer)
**Branch:** `access-model-v2-phase-4` (off `main` @ `cbce3bd` — already cut)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**Master spec:** [`access-model-v2.md`](./access-model-v2.md) §4 Phase 4 (line 253); §8.1–§8.6 (lines 339–528); Decision 8 (line 336 — flat governance); Phase 0 forward-compat seams (§8.6).
**Methodology:** [`docs/build-methodology.md`](../build-methodology.md)
**Author:** Drafted 2 May 2026 AM after Phase 3 ✅ + Checkpoint A4 PASS + chip UI ship.
**Gate:** Matt Checkpoint **A5** — see §7.

---

## 1. Goal

Stand up the **school as a first-class entity with flat-membership self-governance**. After Checkpoint A5: a new teacher signing up sees their real school auto-suggested via email domain match; teachers in the same school see a `/school/[id]/settings` page where any of them can edit low-stakes settings (instant-apply, 7-day revert) or propose high-stakes settings (require a 2nd teacher's confirm within 48h or expire); a platform super-admin (`is_platform_admin = true`, Matt only) has a separate `/admin/school/[id]` view with merge-request controls and impersonation; school-level settings that lived on `teachers` (academic calendar) bubble up into `schools` with per-class override windows preserved; the School Library lets same-school teachers browse each other's units read-only via the Phase 0 `units.school_id` seam; and `dept_head` becomes a department-aware role that auto-tags into all classes of its department (closes FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL).

**This is mostly NEW schema + UI on top of strong Phase 0 seams.** The `schools` table already has `bootstrap_expires_at`, `subscription_tier`, `status` lifecycle, `region`, `timezone`, `default_locale`, `allowed_auth_modes` (Phase 0 + Phase 2.3); `is_platform_admin` already lives on `user_profiles` (Phase 0 mig `20260428142618_user_profiles.sql:55`); `audit_events.actor_type` already includes `'platform_admin'` (Phase 0). What's missing is (a) three NEW tables (`school_domains`, `school_setting_changes`, `school_merge_requests`), (b) the governance engine + cron + helper, (c) the teacher-facing `/school/[id]/settings` UI, (d) the super-admin `/admin/school/[id]` UI (replacing the paper-only `/admin/schools` page that currently lists classes-by-teacher per its own comment "No schools entity exists yet (FU-P)"), (e) the School Library browse view, (f) the school-calendar bubble-up, and (g) the department concept on classes + dept_head auto-tag trigger.

### Why now

- Phases 0/1/2/3 closed. School entity exists, OAuth lives, per-class allowlist + governance shipped, class-roles + permission helper running on prod with `can(actor, action, resource)`.
- The seam columns already exist (Phase 0 was very generous with `schools.*` forward-compat); Phase 4 turns them on.
- **Pilot blocker.** A second school cannot be onboarded without the duplicate-school dedup pipeline, settings governance, and a Matt-only super-admin view. NIS pilot is solo-school-tolerable; pilot expansion is not.
- **FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL P2** (Phase 3 ship-date 1 May 2026) closes when the department concept lands here.
- **`/admin/schools` is paper-only** — current implementation explicitly says "No schools entity exists yet (FU-P), so this returns a flat class list grouped by teacher." Replacing it is a Phase 4 deliverable.
- The Phase 3 chip UI shipped 2 May w/ a `RoleChip` for non-lead-teacher class roles. Phase 4 introduces the **programme-coordinator chip** (the school-scope chip referenced in `dashboard-v2-build` follow-up but never wired) and the **dept_head chip variant** that says "Head of Design Tech" once the department concept exists.
- Master-spec §8.6 forward-compat tables (`school_resources`, `guardians`, `consents`, `student_mentors`, `school_responsibilities`) all landed in Phase 0; Phase 4 doesn't author NEW forward-compat tables, only the three governance-specific ones.

### Non-goals

- **Stripe / billing UI / monetisation enforcement** → `monetisation.md`. Phase 4 reads `subscription_tier` for default ceiling resolution but doesn't gate any feature on it (the `requiresTier` parameter from Phase 3 stays a passive seam).
- **Audit log instrumentation on settings changes** → Phase 5's `logAuditEvent()` instrument-every-mutation pass. Phase 4 inserts into `audit_events` directly for school-settings-specific events (because the table exists and the data must land somewhere) but doesn't add the wrapper-everywhere pattern.
- **Per-student AI budget cascade resolution** → Phase 5 owns the `ai_budget_state` resolver. Phase 4 may add a `schools.default_student_ai_budget` column if it surfaces in §8.1 settings, but doesn't implement the resolver.
- **Data export / delete endpoints** → Phase 5.
- **API versioning rename pass (`/api/v1/*`)** → Phase 6 cutover.
- **Removing legacy `/admin/schools` and `/api/admin/schools` paper-only routes** → Phase 4 KEEPS the URL paths but rewrites the implementations. URL aliasing for super-admin is `/admin/school/[id]` (singular, scoped); the listing page at `/admin/schools` becomes the multi-school directory.
- **Curated school directory expansion to 5–10k entries** (master-spec §8.2 layer 1) → Phase 4 ships ~150 hand-curated entries spanning IB/GCSE/IGCSE/A-Level/ACARA/US-independent. The 5–10k target is post-pilot; the pattern is in place.
- **OAuth domain enforcement** ("schools can require @nis.org.cn login") → Phase 4 ships the `school_domains` table for *auto-suggest*, not *enforcement*. Enforcement is a Phase 5 / post-pilot decision.
- **`school_resources` library UI** (Matt's "people, places, things" library for PYP/Service) → Phase 0 schema only. UI is post-pilot follow-up. Phase 4 doesn't surface it.
- **`guardians` UI** → Phase 0 schema; UI is parent-portal work, deferred to FU-AV2-PARENT-LOGIN.
- **`consents` UI** → Phase 5 (privacy + compliance).
- **MFA enrollment for teachers** → Phase 5. The `/admin/school/[id]` super-admin view doesn't gate on MFA (Matt only, low blast radius until pilot expansion).
- **School-merge cascade implementation** → Phase 4 ships the queue + 90-day redirect schema; the actual cascade-across-FK-references SQL helper is the same migration but the Matt-only approval UI is what closes the loop. There's no "auto-merge" path.
- **Bus-factor-of-one mitigation (audit F26)** → Operational; no code in Phase 4.
- **Pilot freeze policy** (§5 master spec) — activates *after* Checkpoint A7 (Phase 6). Phase 4 is dev-time only.

---

## 2. Pre-flight ritual

Before touching any code:

- [x] **Working tree clean.** `git status` shows clean after `cbce3bd` handoff catch-up commit on `main`.
- [x] **Baseline tests green.** `npm test` reports **2895 passed | 11 skipped** (verified 2 May 2026 AM on `access-model-v2-phase-4` branch).
- [ ] **Typecheck clean.** `npx tsc --noEmit --project tsconfig.check.json` exits 0 (verify before §4).
- [ ] **Active-sessions row claimed** for `access-model-v2-phase-4` worktree branch in `/Users/matt/CWORK/.active-sessions.txt`. Remove on phase close.
- [ ] **Re-read these Lessons** (numbered per `docs/lessons-learned.md`):
  - **#43 — Think before coding: surface assumptions, don't hide confusion.** Governance semantics (especially §3.8 open questions on stake-tier classification + bootstrap-window edge cases) must be in writing before SQL is written. The flat-membership + 2-teacher-confirm model has subtle UX failure modes; spec them out.
  - **#45 — Surgical changes — touch only what each sub-task names.** Don't fold a UI revamp of `/teacher/settings` into the `/school/[id]/settings` build because they're "nearby."
  - **#47 — Adding schema to an existing yaml = audit every writer first.** The school-calendar bubble-up (§4.8) writes a new `schools.academic_calendar_jsonb` column — every reader of `school_calendar_terms.teacher_id` needs to know about the new fallback chain.
  - **#54 — Registries can lie.** schema-registry's `schools` entry has `applied_date: null` despite being live since Phase 0 (`085_schools.sql`). **AND** the WIRING entry `teacher-school-settings` v1 status: complete claims "Period length, workshop spaces + equipment, calendar/terms structure" — but per the audit (§3.5) it actually only writes to `teachers.school_profile` JSONB; the calendar lives on `school_calendar_terms.teacher_id`, not in this system. Capture both drifts in §4.X close-out.
  - **#59 — Brief estimates can lie when the audit hasn't happened yet.** Master spec's 3-day estimate predates this audit (~150 schools to seed, 3 new tables, governance engine, 2 new pages, super-admin view, calendar bubble-up, dept-head trigger, registry sync). Real estimate is closer to ~7–8 days. Buffer 1 day. **If §3 reveals more, stop and re-scope; don't paper over.**
  - **#60 — Side-findings belong in the same commit.** If migrating school-calendar reveals that `class_units.term_id` joins on a teacher-scoped table that should be school-scoped, fix in §4.8, don't file a follow-up.
  - **#61 — Index predicates can't contain non-IMMUTABLE functions.** The bootstrap-grace cron (§4.3) MUST NOT use `WHERE bootstrap_expires_at < now()` in an index predicate; if we need to index pending-expiry rows, materialise the `expired BOOLEAN` and update via trigger or scheduled job.
  - **#62 — Use `pg_catalog.pg_constraint` for cross-schema FK verification.** New school_merge_requests references `schools(id)`; verify FK shape with the right catalog query, not `information_schema`.
  - **#64 — Cross-table RLS subqueries silently recurse; use `SECURITY DEFINER`** for any new policy that joins through `teachers` (school-scoped read) or `class_members` (already SECURITY-DEFINER-fronted via `is_teacher_of_class`). The `/school/[id]/settings` access policy MUST go through a `SECURITY DEFINER` helper, not an inline subquery.
  - **#65 — Old triggers don't know about new user types.** When the school-calendar bubble-up trigger fires on `INSERT INTO schools` (or whatever shape), audit ALL triggers on the `schools` table FIRST — the existing `schools` table predates `is_platform_admin` in `auth.users`, so any old trigger that auto-inserts a "personal school per teacher" must skip platform-admin-only auth.users rows.
  - **(candidate Lesson #66) — When introducing a new junction table + helper functions, audit every existing RLS policy + helper function on adjacent tables.** From Phase 3.5 smoke. `school_setting_changes` is a junction-shaped table that joins teachers and schools — adjacent policies on `teachers` + `schools` need a recheck.
- [ ] **Read** Phase 0.4 (`085_schools.sql` + `085_schools_seed.sql`), Phase 0.5 (`20260428142618_user_profiles.sql` for `is_platform_admin`), Phase 2.3 (`20260501045136_allowed_auth_modes.sql`), and the existing `/api/admin/schools/route.ts` paper-only stub. Confirm assumptions before authoring.
- [ ] **STOP and report findings.** Confirm with Matt the answers to §3.8 open questions before §4. Wait for explicit "go".

---

## 3. Audit — surface of this phase

Compiled 2 May 2026 AM. Numbers are exact unless marked approximate.

### 3.1 Schema seams already in prod (Phase 0/1/2)

| Column / Table | Source migration | Applied | Notes |
|---|---|---|---|
| `schools.id .. allowed_auth_modes` (full Phase 0 column set) | `085_schools.sql` + `085_schools_seed.sql` (~18 schools) + Phase 0 patches + `20260501045136_allowed_auth_modes.sql` | ✅ | Includes `bootstrap_expires_at`, `subscription_tier`, `status`, `region`, `timezone`, `default_locale`, `allowed_auth_modes`. **All of Phase 4's `schools` reads/writes target existing columns; only `default_student_ai_budget` may need adding (see §3.8 Q3).** |
| `user_profiles.is_platform_admin` BOOLEAN NOT NULL DEFAULT false | `20260428142618_user_profiles.sql:55` | ✅ | Set to `true` on Matt's account 1 May. Partial index `WHERE is_platform_admin = true` exists. Phase 4 super-admin view gates on this. |
| `audit_events.actor_type` includes `'platform_admin'` | `20260428215923_class_members_and_audit_events.sql` | ✅ | Phase 5's surface broadly, but Phase 4 inserts directly for school-setting events because the table exists. |
| `teachers.school_id` UUID FK → `schools(id)` | Phase 0 (mig `116_teachers_school_id_reserved`) | ✅ | Indexed `idx_teachers_school`. Set via `/api/teacher/school` PATCH (welcome wizard). |
| `classes.school_id` UUID FK → `schools(id)` | mig `117_classes_school_id_reserved.sql` | ✅ | Indexed `idx_classes_school_id WHERE school_id IS NOT NULL`. Phase 0 backfilled from `teachers.school_id`. |
| `units.school_id` UUID FK → `schools(id)` | Phase 0 | ✅ | Indexed. Powers School Library browse (§4.6). |
| `class_members`, `school_responsibilities`, `student_mentors`, `audit_events`, `school_resources`, `guardians`, `consents` | Phase 0.6c + 0.7a | ✅ | Schema seams. Phase 4 reads `school_responsibilities` for the programme-coordinator chip. |
| `pg_trgm` extension enabled | `085_schools.sql:23` | ✅ | Phase 4's fuzzy-match (§4.2 line 366 master-spec layer 3) reuses this. |
| `idx_schools_name_trgm` GIN | `085_schools.sql:72` | ✅ | Already powering `/api/schools/search`. |

### 3.2 Tables that need NEW migrations (Phase 4)

| Table | Purpose | Phase | Notes |
|---|---|---|---|
| `school_domains` | Email-domain → school_id mapping for signup auto-suggest | **4.2** | `(id, school_id, domain, verified, added_by, created_at)`. UNIQUE on `(domain)` — one domain canonically maps to one school. RLS: same-school teachers read/write; platform admin all. |
| `school_setting_changes` | Governance engine: low/high-stakes change ledger | **4.3** | `(id, school_id, actor_id, change_type, tier, payload_jsonb, applied_at, confirmed_by, reverted_at, reverted_by, expires_at, created_at)`. Per master spec §8.3 line 389. Append-only (no UPDATE/DELETE policies; `applied_at` mutates via dedicated SECURITY DEFINER fn). |
| `school_merge_requests` | Platform-admin merge approval queue | **4.5** | `(id, from_school_id, into_school_id, requested_by, reason, status, approved_by, completed_at, created_at)`. status enum: `pending` / `approved` / `rejected` / `completed`. 90-day redirect tracked via `schools.status='merged_into'` + `schools.merged_into_id` (NEW column? or reuse `parent_school_id`? — **§3.8 Q5**). |

Three NEW migrations expected. **Mint timestamps with `bash scripts/migrations/new-migration.sh <descriptor>` and commit-push the empty stub immediately** (claim discipline; CLAUDE.md "Migration discipline v2"). Sequence: `4.1_seed_schools_extension` (data only) → `4.2_school_domains` → `4.3_school_setting_changes` → `4.5_school_merge_requests` → `4.8_schools_academic_calendar_jsonb` → `4.9_classes_department`.

### 3.3 Existing routes (the surface Phase 4 evolves or replaces)

| Route | File | Disposition |
|---|---|---|
| `GET /api/schools/search?q=&country=` | `src/app/api/schools/search/route.ts` | **EXTEND** — add `?domain=` short-circuit for auto-suggest (§4.2). Existing typeahead ranking unchanged. |
| `GET /api/teacher/school` + `PATCH /api/teacher/school` | `src/app/api/teacher/school/route.ts` | **EXTEND** — PATCH wraps in `school_setting_changes` for the actor's first school-attach (low-stakes). Existing GET unchanged. |
| `POST /api/schools` (welcome wizard creates a user_submitted school) | `src/app/api/schools/route.ts` | **EXTEND** — add fuzzy-match gate before INSERT (master-spec §8.2 layer 3); short-circuit returns "did-you-mean" payload if similarity > 0.7. |
| `GET /api/admin/schools` | `src/app/api/admin/schools/route.ts` | **REPLACE** — current paper-only stub returns flat class list per "No schools entity exists yet (FU-P)". Phase 4 returns `{ schools: [{ id, name, country, teacher_count, class_count, status, subscription_tier }, ...] }`. |
| `GET /admin/schools` | `src/app/admin/schools/page.tsx` | **REPLACE** — paper-only client list of classes-by-teacher. New: school directory with link-out to `/admin/school/[id]`. |
| `GET /api/teacher/school-calendar` | `src/app/api/teacher/school-calendar/route.ts` | **EXTEND** — bubble-up adapter: read precedence is `class_units.schedule_overrides_jsonb` → `schools.academic_calendar_jsonb` → fallback to `school_calendar_terms` for in-flight schools. Don't drop the legacy table this phase (Phase 6 cutover). |

### 3.4 NEW routes Phase 4 ships

| Route | Method | Purpose | Phase |
|---|---|---|---|
| `/api/school/[id]` | GET | Returns the school's settings + recent activity feed for §4.4. RLS: same-school teacher only. | 4.4 |
| `/api/school/[id]/settings` | PATCH | Single endpoint for low-stakes settings change. Wraps in `school_setting_changes` low-tier. | 4.4 |
| `/api/school/[id]/proposals` | GET | List of pending high-stakes proposals (`applied_at IS NULL` + not expired). | 4.4 |
| `/api/school/[id]/proposals` | POST | Create a high-stakes proposal. | 4.4 |
| `/api/school/[id]/proposals/[changeId]/confirm` | POST | 2nd-teacher confirm flips `applied_at`. | 4.4 |
| `/api/school/[id]/changes/[changeId]/revert` | POST | Revert within 7-day window for low-stakes. | 4.4 |
| `/api/school/[id]/library` | GET | School Library: read-only units from same-school teachers. Cursor-paginated. | 4.6 |
| `/api/school/[id]/domains` | GET / POST / DELETE | Manage `school_domains` rows. POST auto-verifies if requesting teacher's email matches the domain. | 4.2 |
| `/api/admin/school/[id]` | GET | Super-admin school detail (gated on `is_platform_admin`). | 4.7 |
| `/api/admin/school/[id]/merge-requests` | GET / POST | Super-admin merge queue. POST = approve. | 4.5 + 4.7 |
| `/api/admin/school/[id]/impersonate` | POST | (Optional, §3.8 Q9 — defer to Phase 5 if blocking) Read-only impersonation for support. | 4.7 |
| `/cron/school-bootstrap-expiry` | (cron) | Sets `bootstrap_expires_at` to `now()` when 2nd teacher joins; expires high-stakes proposals past 48h; downgrades schools to `dormant` after 90d inactivity. | 4.3 + 4.5 |

**~10–11 new routes** depending on §3.8 Q9 (impersonation in 4.7 vs deferred). Add ~5 page renders (`/school/[id]/settings`, `/school/[id]/library`, `/admin/school/[id]`, `/admin/school/[id]/merge-requests`, possibly `/admin/schools` revamp).

### 3.5 Existing teacher-scoped settings to bubble UP (§8.5 master spec)

| Setting | Today | Phase 4 disposition |
|---|---|---|
| Academic calendar (`school_calendar_terms.teacher_id`) | Per-teacher (mig `037_school_calendar.sql`) | **MIGRATE** in §4.8 to `schools.academic_calendar_jsonb`. Multiple teachers in same auto-created school → keep most-recently-edited; notify others via in-app banner. |
| Period length, workshop config (`teachers.school_profile` JSONB) | Per-teacher | **PARTIAL MIGRATE** — bubble period length + bell times to `schools.timetable_skeleton_jsonb` (NEW); keep workshop equipment per-teacher (it's room-specific, not school-wide). |
| Framework defaults (`teachers.school_profile.frameworks`) | Per-teacher | **MIGRATE** to `schools.frameworks_in_use_jsonb` (NEW). Class-level override unchanged. |
| Default grading scale | Per-class via FrameworkAdapter | **NO CHANGE** — already class-resolvable. School default added as new column `schools.default_grading_scale` (NEW). |
| Preflight machine list / lab roster | School-scoped already (Preflight Phase 8.1 `current_teacher_school_id()` + `fabrication_labs.school_id`) | **NO CHANGE** — already correct. |
| Notification footer text / sender branding | Hardcoded today | **NEW** — `schools.notification_branding_jsonb` (NEW). Default values + per-school override surfaced in §4.4 settings page. |
| Safeguarding contacts | Hardcoded today (none) | **NEW** — `schools.safeguarding_contacts_jsonb` (NEW). |
| Content sharing default | Implicit "all teachers see all" | **NEW** — `schools.content_sharing_default` enum: `school_visible` / `private`. Defaults `school_visible`. Overridable per-unit via existing `units.is_public`. |
| AI policy / per-student token budget default | Hardcoded global 100k | **NEW** — `schools.default_student_ai_budget` (NEW; Phase 5's resolver consumes it; Phase 4 just adds the column + UI). |

**Net: one consolidated migration `4.8_schools_settings_columns.sql`** adds the JSONB + scalar columns. Bubble-up backfill is per-column in the same migration (e.g., `UPDATE schools SET academic_calendar_jsonb = (SELECT jsonb_agg(...) FROM school_calendar_terms WHERE teacher_id IN (SELECT id FROM teachers WHERE school_id = schools.id))` — handles multi-teacher conflict by aggregating from the most-recently-updated teacher per group).

### 3.6 Department concept + dept_head auto-tag (§3 line 240, FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL)

Two architectural options, **§3.8 Q7**:

**Option A — `classes.department TEXT` + extended `school_responsibilities.responsibility_type`:**
- Add `classes.department TEXT NULL` (free-text first; enum if naming convention emerges). Backfill `'design_tech'` etc from `classes.subject` keyword match.
- Extend `school_responsibilities.responsibility_type` enum to include per-department head: `dept_head_design_tech`, `dept_head_humanities`, …  *Or* keep generic `dept_head` and add `school_responsibilities.department TEXT NULL`.
- Trigger: when a `school_responsibilities` row of type=`dept_head` is INSERTed, scan all `classes WHERE school_id = X AND department = Y` and INSERT `class_members.dept_head` rows for the responsibility-holder (bypass UNIQUE on conflict-do-nothing).
- Trigger: when a NEW `classes` row INSERTs with `school_id = X AND department = Y`, scan `school_responsibilities` for matching dept_head rows and auto-INSERT `class_members.dept_head` entries.

**Option B — separate `department_responsibilities` table:**
- New table `department_responsibilities (id, school_id, department, teacher_id, ...)`.
- Triggers same as above, just on a different source table.

**Recommendation:** Option A. Reuses Phase 0's `school_responsibilities` table; adds one column instead of a whole new table; the enum-vs-`department` choice is a clean call (recommend `department TEXT` + keep `responsibility_type='dept_head'` — extensible to future "ScD = Service & Design" combos).

**Either way:** cron / trigger needs to sync correctly when:
- Dept_head responsibility is REVOKED → cascade-soft-remove all auto-tagged class_members rows where role=dept_head and department matches.
- A class's `department` CHANGES → re-tag (remove old, add new).
- A teacher's `school_id` CHANGES (e.g., merge) → re-evaluate.

### 3.7 Registry cross-check (Step 5c per build methodology)

| Registry | State (2 May 2026) | Drift caught | Fix in |
|---|---|---|---|
| `WIRING.yaml` | `auth-system` v2 ✅, `permission-helper` v1 ✅, `class-management` v2 ✅. **No `school-governance` system. No `school-library` system.** Existing `teacher-school-settings` v1 mis-summarises today's behaviour (says "calendar/terms structure" — actually only writes `teachers.school_profile`). | (a) Add `school-governance` system. (b) Add `school-library` system. (c) Demote `teacher-school-settings` summary to match reality OR mark `superseded by school-governance` once Phase 4 ships. | §4.10 close-out |
| `schema-registry.yaml` | `schools` entry has `applied_date: null` ✅ (cosmetic). 3 new tables not yet present. School-calendar bubble-up needs `school_calendar_terms` spec_drift entry. | Add `school_domains`, `school_setting_changes`, `school_merge_requests` entries; backfill `applied_date: 2026-04-XX` on `schools`; add spec_drift on `school_calendar_terms`. | §4.10 close-out |
| `api-registry.yaml` | 208 routes (post-Phase-3). ~10–11 new routes adds. | Sync via `python3 scripts/registry/scan-api-routes.py --apply`. | §4.10 close-out |
| `feature-flags.yaml` | `auth.permission_helper_rollout` flag exists from Phase 3.0. No school-governance flag. | (Optional) Add `school.governance_engine_rollout` kill-switch. See §3.8 Q4. | §4.10 close-out |
| `vendors.yaml` | 9 vendors registered. None affected by Phase 4 (no new vendor). | None. | n/a |
| `data-classification-taxonomy.md` | School + teacher tables classified. New 3 tables need entries. | Add `school_domains.domain` (PII-adjacent? `domain_metadata`); `school_setting_changes` payload (heterogeneous; classify by change_type — most are operational metadata, two-tier rule treats high-stakes as `governance_decision`); `school_merge_requests` (operational metadata + reason text for audit). | §4.10 close-out |
| `rls-coverage.json` | 0 `no_rls`, 0 `rls_enabled_no_policy` post-Phase-3. Three NEW tables must each ship with policies in their own migration to keep this clean. | Verify post-§4.5 by rerunning `scan-rls-coverage.py`. | §4.10 close-out |

**Spot-checks performed** (Lesson #54):

- WIRING `auth-system.key_files` → grep confirmed all 8 files exist. Clean.
- schema-registry `schools` entry → all 22 columns present in code; `applied_date: null` is the only drift.
- WIRING `teacher-school-settings.data_fields` → claims `teachers.school_profile` only. Grep confirmed: that's correct as written; the WIRING **summary** is what overstates ("calendar/terms structure" — calendar lives elsewhere).
- api-registry `/api/teacher/school-calendar` entry → confirmed route exists at `src/app/api/teacher/school-calendar/route.ts`. Reads `school_calendar_terms` filtered by `teacher_id`. Calendar bubble-up audit start point.

### 3.8 Open questions (must resolve before §4)

These are the §1 STOP-and-report items. Each one is signed off by Matt before code lands.

1. **Phase 4 estimate delta — is ~7–8 days acceptable?** Master spec says 3 days, written before this audit. The 12 sub-items × audit + governance + bubble-up + dept-head trigger work expand it considerably. **Proposal:** carry the realistic ~7–8 day estimate; if too long, propose splitting Phase 4 into 4A (registration + governance + library, ~5 days) and 4B (super-admin + dept_head + calendar bubble-up, ~3 days) with separate Checkpoints A5a / A5b. **Acceptable?**

2. **Stake-tier classification — exactly which fields are low-stakes vs high-stakes?** Master spec §8.3 gives 5 + 6 examples; reality has ~25 settings. **Proposal:** the brief enumerates each setting in §3.5 + assigns tier. Bubble up the table in §3.8 sign-off; Matt edits inline. **Default:** identity (name/logo/region) = high-stakes; auth modes = high-stakes; deleting historical data = high-stakes; all others (calendar dates, period names, machine list, framework edits, AI budget, content sharing toggle, notification footer) = low-stakes.

3. **`schools.default_student_ai_budget` column — Phase 4 or Phase 5?** Phase 5 reads it. Phase 4 needs it for the settings UI to surface "this school's default daily token budget." **Proposal:** add the column in Phase 4 §4.8 (no resolver yet, just the column + UI). Phase 5 wires the resolver. **Acceptable?**

4. **Kill-switch flag for governance engine?** Phase 3 added `auth.permission_helper_rollout`. Phase 4 governance is a similar high-blast-radius change. **Proposal:** YES — `school.governance_engine_rollout` boolean flag in `admin_settings`, default `true`. Every governance route wraps `if (!flag) return legacyOrFallback`. The fallback for "schools haven't onboarded yet" reads/writes pass-through. Removed in Phase 6 cutover. **OK?** (If NO, skip §4.0 flag; ship unconditionally.)

5. **Merge redirect column — reuse `schools.parent_school_id` (Phase 0) or add `merged_into_id`?** `parent_school_id` was reserved for the multi-campus / consortium pattern (e.g., NIS → IB regional federation). Re-using it for merge redirects conflates two semantics. **Proposal:** add `schools.merged_into_id UUID NULL` (NEW column, FK to schools); leave `parent_school_id` for federation use. **Acceptable?**

6. **Bootstrap grace edge case — what if a 2nd teacher joins BEFORE the 7-day window closes?** Master spec line 395 says "the column is set to `now()` on the 2nd teacher's insert." But what if the 2nd teacher leaves the same day? Reset window? Auto-extend? **Proposal:** ONCE the window closes (whether by 7 days OR 2nd teacher join), it stays closed. If the 2nd teacher leaves and the school becomes single-teacher again, the school enters single-teacher mode but does NOT reopen the bootstrap window — too easy to game ("invite-then-fire"). The lone teacher CAN make high-stakes proposals, they just sit in `pending` forever (or until a 2nd teacher joins to confirm). **OK?**

7. **Department concept — Option A or Option B?** (§3.6 above.) **Proposal:** Option A. **Acceptable?**

8. **Dept_head auto-tag retroactivity — when feature ships, should existing schools auto-populate?** Today (1 May 2026) NIS has 0 `school_responsibilities` rows. So retroactive backfill is null-op for prod. But the migration applies to ALL schools (~150 seeded in §4.1). **Proposal:** auto-populate runs as a one-shot `INSERT … FROM …` in `4.9_classes_department.sql` after the trigger lands. Dry-run logged; backfill runs. **Acceptable?**

9. **Super-admin impersonate-as-teacher — Phase 4 or Phase 5?** Master spec §8.4 lists impersonation as a deliverable. Implementing it requires either session-spoofing (security risk, audit trail subtle) or a "view-as" UI mode (less risky, no auth change). **Proposal:** Phase 4 ships a "view-as" UI mode (read-only `?as_teacher_id=...` query param on teacher pages, gated on `is_platform_admin`). NO session-spoofing. NO write. The `/api/admin/school/[id]/impersonate` route returns a signed URL with the `as_teacher_id` param, logged to `audit_events`. **Acceptable?** (If too much for Phase 4, defer to Phase 5.)

10. **`schools.timezone` migration — multi-teacher schools may have conflicting timezones today (NIS = `Asia/Shanghai`, hypothetical other-school co-teacher = `Australia/Sydney`).** When backfilling, what wins? **Proposal:** the schools table already defaults to `Asia/Shanghai`. The Phase 4 settings UI lets one teacher set the school's timezone explicitly (low-stakes); until then, the default holds. **Acceptable?**

11. **Schools seed scope — how many entries per market?** §4.1 ships ~150 entries spanning IB / GCSE / IGCSE / A-Level / ACARA / US-independent. **Proposal:** ~30 per market = ~150 total. Hand-curated. NOT 5–10k. NOT scraped. **Acceptable?**

12. **School Library scope in Phase 4 — read-only across same-school, or also forkable?** Master spec §8.1 line 358 says "browseable + forkable." But forking touches `unit-forking` system v1 (Phase 0.10) which is class-scoped today. **Proposal:** Phase 4 ships **browse-only**. Forking from school library = follow-up `FU-AV2-PHASE-4-LIBRARY-FORK` P3, scheduled when a 2nd teacher actually wants to fork (post-pilot reality check). **Acceptable?**

---

## 4. Sub-phases

Each sub-phase is a separate commit (Lesson #45 surgical changes; methodology rule 7 separate commits no squashing). Stop triggers documented per phase. Total ~7–8 days; see §9.

### Phase 4.0 — Pre-flight + decisions (~0.5 day)

**Output:** Matt-signed-off answers to §3.8 question 1–12. Active-sessions row claimed for new branch. Optional `school.governance_engine_rollout` flag added to `admin_settings` if §3.8 Q4 = YES.

**Migrations:** 0 (or 1 if flag added).

**Stop trigger:** Any §3.8 answer NOT received → STOP.

### Phase 4.1 — Seed schools dataset extension (~0.5 day)

**Output:** 1 migration timestamped `<UTC>_phase_4_1_seed_schools_extension.sql` (data only, no schema). Adds ~120 schools across 6 markets to the existing 18 (mig 085_schools_seed):

- **UK:** ~25 entries spanning state-funded (LSE Academy Network), independent (Westminster, Eton, Wycombe Abbey), MAT trusts (Harris, Ark, GLF). Subject mix: GCSE / A-Level / IB.
- **Australia:** ~20 entries from ACARA-listed (Sydney Grammar, MLC, Wesley, Knox, Newington, public selective). NSW/VIC/QLD distribution.
- **US independent:** ~25 entries (NAIS member schools — Phillips Exeter, Andover, Sidwell, Lakeside, Punahou, etc.).
- **Asia non-China expansion:** ~15 entries (Singapore American, UWC SEA, Hong Kong International, Tokyo American, Yokohama International, Bangkok Patana, Jakarta Intercultural, Mumbai American School).
- **Europe non-UK:** ~15 entries (International School of Geneva, Vienna International, Munich International, Frankfurt International, École Active Bilingue Paris).
- **Middle East / Africa starter set:** ~10 entries (American Community School Beirut, Cairo American, Dubai American Academy, AISJ Johannesburg).

Source `'curated'` (NEW source enum value? OR reuse `'imported'` per existing CHECK constraint — see §3.8 Q11 sub-decision). All `verified=true`, `created_by=NULL`. ON CONFLICT DO NOTHING (relies on `idx_schools_unique_name_country`).

**Tests:** 1 migration test asserting row count adds + per-market sampling. ~3 unit tests for `/api/schools/search` post-seed (e.g., `q=eton` returns Eton College).

**Apply to prod:** Direct via Supabase SQL Editor. Idempotent.

**Stop trigger:** If post-seed search returns garbled UTF-8 (mig 085 had no encoding issue but new entries with Latin-1 names like "École" need verification) → STOP, fix encoding.

### Phase 4.2 — `school_domains` table + signup auto-suggest (~0.75 day)

**Output:**

- 1 migration `<UTC>_phase_4_2_school_domains.sql`:

  ```sql
  CREATE TABLE school_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX idx_school_domains_domain ON school_domains(lower(domain));
  CREATE INDEX idx_school_domains_school_id ON school_domains(school_id);

  ALTER TABLE school_domains ENABLE ROW LEVEL SECURITY;

  -- Same-school teachers can read/insert/delete their domain rows
  CREATE POLICY school_domains_school_teacher_rw ON school_domains
    FOR ALL TO authenticated
    USING (school_id = current_teacher_school_id())
    WITH CHECK (school_id = current_teacher_school_id());

  -- Public unauthenticated read on (domain, school_id) only — for the
  -- signup auto-suggest path before login. NO other columns exposed.
  -- Implemented via SECURITY DEFINER function not direct policy
  -- (avoids leaking added_by + created_at).
  CREATE FUNCTION public.lookup_school_by_domain(_domain TEXT)
    RETURNS TABLE (school_id UUID, school_name TEXT)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = public, pg_temp AS $$
      SELECT s.id, s.name FROM school_domains sd
      JOIN schools s ON s.id = sd.school_id
      WHERE lower(sd.domain) = lower(_domain) AND sd.verified = true
      LIMIT 1;
    $$;
  REVOKE EXECUTE ON FUNCTION public.lookup_school_by_domain FROM PUBLIC, authenticated, anon;
  GRANT EXECUTE ON FUNCTION public.lookup_school_by_domain TO anon, authenticated;
  ```

- New routes:
  - `GET /api/school/[id]/domains` — list (same-school teacher only)
  - `POST /api/school/[id]/domains` — add. Auto-verifies if requester's email matches the domain.
  - `DELETE /api/school/[id]/domains/[domainId]` — remove (low-stakes change, wraps `school_setting_changes`).
  - `GET /api/schools/lookup-by-domain?domain=foo.org` — public, calls `lookup_school_by_domain` SECURITY DEFINER.

- Welcome wizard wiring: `src/app/teacher/welcome/page.tsx` — on email field blur, call `/api/schools/lookup-by-domain` with the email's domain. If a match is returned, prefill the school picker with the suggestion AND a "use this school" button. Teacher can override to free-search.

**Tests:** ~12 — RLS isolation (other-school teacher 404s); auto-verify pathway (domain matches → verified=true); duplicate domain (second school tries to register `nis.org.cn` → 409); welcome wizard suggestion flow (mocked); SECURITY DEFINER lock-down assertions.

**Apply to prod:** Mid-phase. After verification, seed Matt's NIS school_domains entries (`nis.org.cn`, `nanjing-school.com`).

**Stop trigger:** SECURITY DEFINER lookup returns more than 1 row → STOP, schema bug. RLS read returns cross-school rows → STOP.

### Phase 4.3 — Governance engine: `school_setting_changes` + helper + cron (~1 day)

**Output:**

- 1 migration `<UTC>_phase_4_3_school_setting_changes.sql`:

  ```sql
  CREATE TYPE school_setting_change_tier AS ENUM ('low_stakes', 'high_stakes');
  CREATE TYPE school_setting_change_status AS ENUM ('pending', 'applied', 'reverted', 'expired');

  CREATE TABLE school_setting_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    change_type TEXT NOT NULL,         -- e.g. 'name', 'period_bells', 'add_machine', 'rename_school'
    tier school_setting_change_tier NOT NULL,
    payload_jsonb JSONB NOT NULL,        -- { before: …, after: …, scope: {…} }
    status school_setting_change_status NOT NULL DEFAULT 'pending',
    applied_at TIMESTAMPTZ NULL,        -- low-stakes: now(); high-stakes: null until confirmed
    confirmed_by_user_id UUID REFERENCES auth.users(id),
    reverted_at TIMESTAMPTZ NULL,
    reverted_by_user_id UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NULL,        -- 48h from created_at for high-stakes pending
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX idx_ssc_school_status ON school_setting_changes(school_id, status);
  CREATE INDEX idx_ssc_pending_expiry ON school_setting_changes(expires_at) WHERE status = 'pending';

  ALTER TABLE school_setting_changes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ssc_school_teacher_rw ON school_setting_changes FOR ALL TO authenticated
    USING (school_id = current_teacher_school_id())
    WITH CHECK (school_id = current_teacher_school_id());
  ```

- TypeScript helper at `src/lib/access-v2/governance/setting-change.ts`:

  ```ts
  export type SettingChangeTier = 'low_stakes' | 'high_stakes';

  // Single entry-point for any settings write.
  export async function proposeSchoolSettingChange(args: {
    schoolId: string;
    actorUserId: string;
    changeType: string;
    tier: SettingChangeTier;
    payload: { before: unknown; after: unknown; scope?: unknown };
  }): Promise<{ changeId: string; appliedAt: Date | null }> { … }

  export async function confirmHighStakesChange(args: { changeId: string; confirmerUserId: string }): Promise<void> { … }
  export async function revertChange(args: { changeId: string; revoker: string }): Promise<void> { … }
  ```

  - Low-stakes path: INSERT row with `applied_at = now()`, `status = 'applied'`. Apply the actual change to `schools` (or wherever) in the same transaction. Insert `audit_events` row.
  - High-stakes path: INSERT row with `applied_at = NULL`, `status = 'pending'`, `expires_at = now() + interval '48 hours'`. **Bootstrap grace exception:** if `schools.bootstrap_expires_at IS NULL OR bootstrap_expires_at > now()`, treat as low-stakes (single-teacher mode auto-confirms).

- Cron route `/cron/school-governance-tick` (Vercel Scheduled Function — runs every 15 min):
  - Expire `pending` rows past `expires_at` → set `status = 'expired'`.
  - Auto-revert `applied` low-stakes rows past `applied_at + 7 days`? **NO** — that's the user's choice (they may not want to revert). Cron just *makes the revert button unavailable* by reading `applied_at < now() - interval '7 days'` in the helper.
  - Downgrade `schools.status` to `'dormant'` for schools where `MAX(audit_events.created_at) < now() - interval '90 days'` AND `status = 'active'`.
  - Bootstrap-window auto-close: when `INSERT INTO teachers WITH school_id = X` brings teacher count from 1 → 2, set `schools.bootstrap_expires_at = now()` if it's still NULL or in future. **Implemented as trigger on `teachers` INSERT, not in cron** (immediate effect).

- 1 SECURITY DEFINER helper: `is_school_teacher(_school_id UUID) RETURNS BOOLEAN` — wraps `current_teacher_school_id() = _school_id`. Used by some routes.

**Tests:** ~25 — low-stakes apply path; high-stakes propose-then-confirm path; bootstrap grace path; expiry path; revert path; cron expiry pass; concurrent-confirmer race (the 2nd-confirmer loses, 1st wins); 7-day-revert window enforcement; cross-school RLS isolation.

**Apply to prod:** Mid-phase, after the helper + cron route ship. Cron registered in `vercel.json`.

**Stop trigger:** Concurrent-confirmer race produces inconsistent state → STOP, transaction logic bug. Cron expiry skips a row → STOP, query bug.

### Phase 4.4 — `/school/[id]/settings` page + activity feed (~1 day)

**Output:**

- New page at `src/app/school/[id]/settings/page.tsx` (server component):
  - Header: school name, country, status, `currentVersion` of `subscription_tier`.
  - Section A: Identity (name, logo, region, country, timezone) — high-stakes panel; pending banner pinned to top if any active.
  - Section B: Academic Calendar (terms, holidays) — low-stakes; uses `schools.academic_calendar_jsonb` (NEW from §4.8) once that ships.
  - Section C: Timetable Skeleton (period names, bell times) — low-stakes.
  - Section D: Frameworks in Use (multi-select) — low-stakes.
  - Section E: Auth Policy (which modes allowed; required SSO domains via `school_domains` link-out) — high-stakes.
  - Section F: AI Policy (default token budget, allowed providers) — low-stakes.
  - Section G: Notification Branding (sender name, reply-to, footer) — low-stakes.
  - Section H: Safeguarding Contacts (alert recipient emails) — low-stakes.
  - Section I: Content Sharing Default (school-visible vs private) — low-stakes.
  - Activity Feed (right rail or bottom): 30-day window. "Bob updated period bells 2h ago [Revert]." "Alice proposed renaming the school → [Confirm] [Dismiss] (expires 40h)."
  - **Bootstrap banner** when `schools.bootstrap_expires_at > now()`: "You're the only teacher in this school. While in single-teacher mode, all settings apply instantly. Once a 2nd teacher joins, high-stakes changes (school name, region, etc.) require a 2nd confirm. Window closes at: 2026-MM-DD HH:MM."
  - **No save button.** Each field has its own Apply / Propose button per tier. Aligns with the governance model — these are individual changes, not a form submission.

- New page at `src/app/school/[id]/proposals/[changeId]/page.tsx` — full detail view of a pending high-stakes proposal with confirm + dismiss controls.

- New routes (per §3.4): GET `/api/school/[id]`, PATCH `/api/school/[id]/settings`, GET/POST `/api/school/[id]/proposals`, POST `/api/school/[id]/proposals/[changeId]/confirm`, POST `/api/school/[id]/changes/[changeId]/revert`.

- Cache-Control: private on all routes (Lesson #11; Cache-Control gap closed for `/api/admin/*` 1 May).

- Smoke run with two simulated teacher accounts in same school: low-stakes apply visible to other; high-stakes pending visible; confirm-by-other-teacher flips applied; revert by either teacher works; expired proposal shows expired badge.

**Tests:** ~20 — page renders for same-school teacher; 404 for cross-school teacher; activity feed shape; proposal lifecycle; bootstrap banner shows under bootstrap; doesn't show post-bootstrap; revert button hidden after 7-day window.

**Stop trigger:** Settings UI calls a route that mutates `schools` directly (bypasses governance) → STOP, refactor. Activity feed shows cross-school events → STOP, RLS leak.

### Phase 4.5 — `school_merge_requests` table + 90-day redirect schema (~0.75 day)

**Output:**

- 1 migration `<UTC>_phase_4_5_school_merge_requests.sql`:

  ```sql
  CREATE TYPE school_merge_status AS ENUM ('pending', 'approved', 'rejected', 'completed');

  CREATE TABLE school_merge_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    into_school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    requested_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    reason TEXT NOT NULL,
    status school_merge_status NOT NULL DEFAULT 'pending',
    approved_by_user_id UUID REFERENCES auth.users(id),
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX idx_smr_from ON school_merge_requests(from_school_id, status);
  CREATE UNIQUE INDEX idx_smr_unique_pending ON school_merge_requests(from_school_id, into_school_id) WHERE status = 'pending';

  ALTER TABLE school_merge_requests ENABLE ROW LEVEL SECURITY;
  -- Same-school teachers (either side) can read; only platform admin can mutate
  CREATE POLICY smr_school_teacher_read ON school_merge_requests FOR SELECT TO authenticated
    USING (current_teacher_school_id() IN (from_school_id, into_school_id));
  CREATE POLICY smr_platform_admin_all ON school_merge_requests FOR ALL TO authenticated
    USING ((SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()))
    WITH CHECK ((SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()));

  ALTER TABLE schools ADD COLUMN merged_into_id UUID REFERENCES schools(id) ON DELETE SET NULL;
  CREATE INDEX idx_schools_merged_into ON schools(merged_into_id) WHERE merged_into_id IS NOT NULL;
  ```

- Helper `src/lib/access-v2/governance/school-merge.ts`:
  - `proposeMergeRequest({fromSchoolId, intoSchoolId, requesterId, reason})` — same-school teacher only.
  - `approveMergeRequest({changeId, approverId})` — platform admin only. Cascades `school_id` updates across `teachers`, `classes`, `students`, `units`, `class_members`, `school_responsibilities`, `student_mentors`, `school_resources`, `consents`, `audit_events`, `school_setting_changes`, `school_merge_requests`. Sets `from_school.status = 'merged_into'` + `from_school.merged_into_id = into_school.id`. Schedules 90-day redirect by leaving the row intact (no auto-delete cron — manual cleanup post-90d via super-admin).
  - `resolveSchoolId(_schoolId)` — follow `merged_into_id` chain (max depth 5; raise if cycle).

- Routes:
  - `POST /api/school/[id]/merge-requests` — same-school teacher creates request. Auto-rejects if pending one exists between same pair.
  - `GET /api/admin/school/[id]/merge-requests` — platform admin list.
  - `POST /api/admin/school/[id]/merge-requests/[mergeId]/approve` — platform admin approve. Cascades.

- 90-day redirect implementation: any route reading by `school_id` calls `resolveSchoolId(schoolId)` first; if it returns a different ID (i.e. the school was merged), the route logs an `audit_events` row of type `school_redirect_followed` and proceeds with the new ID. **Implemented at the route guard level**, NOT as middleware — explicit per route to avoid cache-poisoning surprises.

**Tests:** ~18 — merge request happy path; cross-school teacher cannot see other-side request; platform admin approve cascade verification (count rows in 12 tables before/after); double-approve idempotency; cycle detection; 90-day redirect lookup follows once.

**Stop trigger:** Cascade leaves orphan rows → STOP, FK ON DELETE missed somewhere. Cycle detection misses → STOP.

### Phase 4.6 — School Library browse view (~0.5 day)

**Output:**

- New route: `GET /api/school/[id]/library?q=&grade=&type=&cursor=`. Returns same-school teachers' published units + master units (read-only).
- Reads from existing `units.school_id` (Phase 0). Filters: `units.school_id = X AND units.is_published = true AND units.deleted_at IS NULL`.
- Tags fetched from `units.tags` array (existing).
- Cursor pagination (limit 30, cursor on `units.updated_at, id`).
- New page at `src/app/school/[id]/library/page.tsx` (server component) — grid of unit cards using existing `<UnitCard>` component, "Browse only" badge.
- "Browse only" — no fork action in v1 per §3.8 Q12. Card click → read-only unit view at `/teacher/units/[unitId]?source=library` (which the existing teacher unit detail page handles via the `source` query param to suppress edit controls — verify this page handles cross-author read; if not, add `?as=read_only` flag).

**Tests:** ~10 — list shape; cross-school teacher gets 404; pagination cursor; deleted unit excluded; published filter respected; only same-school surfaces (RLS via SECURITY DEFINER `is_school_teacher`).

**Stop trigger:** Cross-school unit appears in list → STOP, RLS leak.

### Phase 4.7 — Platform super-admin view at `/admin/school/[id]` (~0.75 day)

**Output:**

- Replace `/api/admin/schools/route.ts` with real implementation: returns `[{ id, name, country, teacher_count, class_count, status, subscription_tier, last_active_at }, …]` for ALL schools (gated on `is_platform_admin`).
- Replace `/admin/schools/page.tsx` with directory view + link-out to per-school detail.
- New page at `src/app/admin/school/[id]/page.tsx`:
  - Teachers list (with last-active timestamp + class counts)
  - Fabricators list (per Preflight Phase 8)
  - Settings snapshot (current state)
  - 30-day change history (joins `school_setting_changes`)
  - Audit log feed (`audit_events` filtered by `school_id`)
  - Merge request controls (links to §4.5 routes)
  - "View as teacher" button per §3.8 Q9 (read-only impersonation; URL `/teacher/dashboard?as_teacher_id=...`).
- New API route `GET /api/admin/school/[id]` (super-admin only, returns the bundle above).
- New API route `POST /api/admin/school/[id]/impersonate` (returns signed view-as URL; Phase 4 ships read-only mode only — see §3.8 Q9).
- All routes gate on `is_platform_admin = true` from `user_profiles`. **NEW** `requirePlatformAdmin(request)` helper at `src/lib/auth/require-platform-admin.ts` — wraps Supabase SSR, returns 403 on non-admin.

**Tests:** ~15 — admin GET succeeds for Matt; admin GET 403 for non-admin teacher; school detail returns settings snapshot; view-as URL produces signed link; impersonate audit row inserted.

**Stop trigger:** Admin endpoint returns row to non-admin → STOP, severe.

### Phase 4.8 — Migrate scattered school-level settings up (~0.5 day)

**Output:**

- 1 migration `<UTC>_phase_4_8_schools_settings_columns.sql`:

  ```sql
  ALTER TABLE schools
    ADD COLUMN academic_calendar_jsonb JSONB NULL,
    ADD COLUMN timetable_skeleton_jsonb JSONB NULL,
    ADD COLUMN frameworks_in_use_jsonb JSONB NULL,
    ADD COLUMN default_grading_scale TEXT NULL,
    ADD COLUMN notification_branding_jsonb JSONB NULL,
    ADD COLUMN safeguarding_contacts_jsonb JSONB NULL,
    ADD COLUMN content_sharing_default TEXT NOT NULL DEFAULT 'school_visible'
      CHECK (content_sharing_default IN ('school_visible', 'private')),
    ADD COLUMN default_student_ai_budget INTEGER NULL;

  -- Backfill academic_calendar_jsonb from school_calendar_terms most-recently-edited per school
  UPDATE schools s SET academic_calendar_jsonb = (
    SELECT jsonb_agg(jsonb_build_object('term_name', t.term_name, 'term_order', t.term_order, 'academic_year', t.academic_year, 'start_date', t.start_date, 'end_date', t.end_date, 'holidays', t.holidays_jsonb))
    FROM school_calendar_terms t
    JOIN teachers tr ON tr.id = t.teacher_id
    WHERE tr.school_id = s.id
    ORDER BY t.updated_at DESC LIMIT 1
  ) WHERE academic_calendar_jsonb IS NULL;

  -- Similar backfill for timetable_skeleton from teachers.school_profile.{periodLength,bellTimes}
  -- Similar backfill for frameworks_in_use from teachers.school_profile.frameworks
  ```

- Read precedence helper at `src/lib/access-v2/school/calendar.ts`:
  - For a class lesson, lookup order: `class_units.schedule_overrides_jsonb` → `schools.academic_calendar_jsonb` (NEW) → `school_calendar_terms WHERE teacher_id = ?` (legacy fallback).
  - **Don't drop `school_calendar_terms` in Phase 4.** Phase 6 cutover decides drop.

- Settings UI from §4.4 binds to the new columns. Banner: "We've moved your academic calendar to school level. Other teachers in your school can now see and edit it. The old per-teacher calendar is preserved for now."

- Notify side teachers: a new `audit_events` row of type `school_calendar_bubbled_up` per school where multiple-teacher conflict was resolved. Settings page surfaces "Calendar moved up from {teacherName}'s view → school view 2h ago [Details]." for 7 days.

**Tests:** ~12 — backfill correctness for single-teacher school; backfill chooses most-recently-edited for multi-teacher school; legacy fallback fires when `academic_calendar_jsonb IS NULL`; settings UI binds.

**Stop trigger:** Backfill creates duplicate rows OR loses term data → STOP.

### Phase 4.9 — Department concept + dept_head auto-tag (~0.75 day)

**Output:**

- 1 migration `<UTC>_phase_4_9_classes_department_and_dept_head_trigger.sql`:

  ```sql
  ALTER TABLE classes ADD COLUMN department TEXT NULL;
  CREATE INDEX idx_classes_school_dept ON classes(school_id, department) WHERE department IS NOT NULL;
  ALTER TABLE school_responsibilities ADD COLUMN department TEXT NULL;

  -- Backfill classes.department from classes.subject keyword match
  UPDATE classes SET department = CASE
    WHEN lower(subject) LIKE '%design%' OR lower(subject) LIKE '%dt%' THEN 'design_tech'
    WHEN lower(subject) LIKE '%math%' THEN 'mathematics'
    WHEN lower(subject) LIKE '%science%' THEN 'science'
    WHEN lower(subject) LIKE '%history%' OR lower(subject) LIKE '%humanities%' THEN 'humanities'
    WHEN lower(subject) LIKE '%english%' OR lower(subject) LIKE '%lang%' THEN 'languages'
    ELSE NULL
  END;

  -- Trigger: when a school_responsibilities row of type='dept_head' is INSERTed
  -- with a non-null department, auto-INSERT class_members.dept_head rows
  -- for every active class in that school + department.
  CREATE OR REPLACE FUNCTION public.tg_auto_tag_dept_head_on_responsibility_insert()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp AS $$
  BEGIN
    IF NEW.responsibility_type = 'dept_head' AND NEW.department IS NOT NULL THEN
      INSERT INTO class_members (class_id, member_user_id, role, added_by, source)
      SELECT c.id, NEW.teacher_user_id, 'dept_head', NEW.added_by, 'auto_dept_head'
      FROM classes c
      WHERE c.school_id = NEW.school_id
        AND c.department = NEW.department
        AND c.deleted_at IS NULL
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER tg_school_responsibility_dept_head_insert
    AFTER INSERT ON school_responsibilities
    FOR EACH ROW EXECUTE FUNCTION tg_auto_tag_dept_head_on_responsibility_insert();

  -- Reverse trigger on UPDATE / soft-delete
  CREATE OR REPLACE FUNCTION public.tg_remove_dept_head_class_members_on_revoke()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp AS $$
  BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      UPDATE class_members
      SET removed_at = now()
      WHERE class_id IN (SELECT id FROM classes WHERE school_id = NEW.school_id AND department = NEW.department)
        AND member_user_id = NEW.teacher_user_id
        AND role = 'dept_head'
        AND source = 'auto_dept_head'
        AND removed_at IS NULL;
    END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER tg_school_responsibility_dept_head_update
    AFTER UPDATE ON school_responsibilities
    FOR EACH ROW EXECUTE FUNCTION tg_remove_dept_head_class_members_on_revoke();

  -- Trigger on classes.department CHANGE: re-evaluate.
  CREATE OR REPLACE FUNCTION public.tg_resync_dept_head_on_class_dept_change()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp AS $$
  BEGIN
    IF NEW.department IS DISTINCT FROM OLD.department THEN
      -- Remove auto-tags from old department
      UPDATE class_members SET removed_at = now()
      WHERE class_id = NEW.id AND role = 'dept_head' AND source = 'auto_dept_head' AND removed_at IS NULL;
      -- Add auto-tags from new department
      INSERT INTO class_members (class_id, member_user_id, role, added_by, source)
      SELECT NEW.id, sr.teacher_user_id, 'dept_head', sr.added_by, 'auto_dept_head'
      FROM school_responsibilities sr
      WHERE sr.school_id = NEW.school_id
        AND sr.responsibility_type = 'dept_head'
        AND sr.department = NEW.department
        AND sr.deleted_at IS NULL
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER tg_classes_department_change
    AFTER UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION tg_resync_dept_head_on_class_dept_change();

  -- ALSO trigger on classes INSERT for new classes in a tagged department
  CREATE OR REPLACE FUNCTION public.tg_auto_tag_dept_head_on_class_insert()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp AS $$
  BEGIN
    IF NEW.department IS NOT NULL AND NEW.school_id IS NOT NULL THEN
      INSERT INTO class_members (class_id, member_user_id, role, added_by, source)
      SELECT NEW.id, sr.teacher_user_id, 'dept_head', sr.added_by, 'auto_dept_head'
      FROM school_responsibilities sr
      WHERE sr.school_id = NEW.school_id
        AND sr.responsibility_type = 'dept_head'
        AND sr.department = NEW.department
        AND sr.deleted_at IS NULL
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  END $$;
  CREATE TRIGGER tg_classes_insert_dept_head
    AFTER INSERT ON classes FOR EACH ROW EXECUTE FUNCTION tg_auto_tag_dept_head_on_class_insert();
  ```

- `class_members.source TEXT NULL` (NEW column? Or already exists from Phase 0.6c? Check before authoring.) — disambiguates manual vs auto. If column missing, prepend the migration with `ALTER TABLE class_members ADD COLUMN source TEXT NULL DEFAULT 'manual';`.

- UI: `/school/[id]/settings` Section J — Departments. Lists dept_head responsibilities + class membership preview. Add/remove dept_head row (creates `school_responsibilities` row of type `dept_head` + `department`). Trigger fires.

- Chip extension: Phase 3.5's `RoleChip` already renders `dept_head` for non-lead-teacher roles. **NEW** chip variant: "Head of Design Tech" (resolved from `school_responsibilities.responsibility_type='dept_head' + department`) shown on dashboard when user has the responsibility. `resolveRoleChip()` helper in `dashboard-v2-build` extended.

- Helper `has_dept_head_responsibility(_school_id UUID, _department TEXT) RETURNS BOOLEAN` — SECURITY DEFINER. Lets `can()` resolve dept_head via responsibility table for richer reads (e.g., "can this teacher see all DT department classes?" answers Y if responsibility row exists, regardless of class_members row count).

- One-shot backfill: any existing `class_members.role = 'dept_head'` rows from Phase 3 manual seed? Audit; convert to auto-tag if appropriate. (Likely 0 rows in prod since Phase 3 didn't seed dept_head.)

**Tests:** ~22 — INSERT responsibility creates auto-tags; revoke responsibility soft-removes auto-tags; manual `class_members.dept_head` row is NOT removed by revoke (source='manual' protects it); class department change re-syncs auto-tags; new class in tagged department auto-tagged; cross-school RLS holds.

**Stop trigger:** Trigger firing pattern leaves orphan rows OR removes manual rows → STOP, fix.

### Phase 4.10 — Co-teacher / dept_head / governance smoke (~0.5 day)

**Output:** Smoke run report `docs/projects/access-model-v2-phase-4-smoke.md` documenting scenarios:

1. **New teacher signup with email domain** — domain auto-suggests real school; teacher accepts; lands on welcome with school prefilled.
2. **Same-school teacher edits low-stakes setting** — change applies instantly; second teacher sees activity feed; revert button works for both.
3. **Same-school teacher proposes high-stakes change** — pending banner appears for both teachers; second teacher confirms; applies; activity feed shows confirmation.
4. **High-stakes proposal expires** — without confirm, status flips to `expired` after 48h (cron tested at compressed interval). Settings field still on old value.
5. **Bootstrap grace** — fresh single-teacher school shows banner; high-stakes apply instantly; 2nd teacher joins; bootstrap_expires_at set to now(); next high-stakes is 2-tier.
6. **Department auto-tag** — Matt (logged-in as a NIS teacher) sets himself as `dept_head` of `design_tech`; lands as auto-tagged on every DT class; revokes; auto-tags removed; manual dept_head row preserved.
7. **School Library browse** — Matt sees own school's units; cross-school request returns empty.
8. **Super-admin school detail** — Matt navigates to `/admin/school/<NIS-id>`; sees teachers + classes + audit feed; "view as teacher" navigates to teacher dashboard with `?as_teacher_id` param + read-only banner.
9. **Merge request flow** — Matt creates a 2nd "test" school; opens merge request; approves as super-admin; verifies `from_school.status='merged_into'` + `merged_into_id` set; verifies a route reading by old school_id resolves to new ID via `resolveSchoolId`.

Manual prod-preview smoke — branch alias URL (Lesson #63 — not deployment-pinned URL).

**Stop trigger:** Any scenario fails → STOP, diagnose. Don't paper over.

### Phase 4.11 — Registry hygiene + close-out (~0.5 day)

**Output:**

- **`schema-registry.yaml`** —
  - Add `school_domains`, `school_setting_changes`, `school_merge_requests` entries with full columns + RLS + classification.
  - Backfill `applied_date: 2026-04-XX` on `schools` (cosmetic Lesson #54 cleanup).
  - Add Phase 4 spec_drift entries on `school_calendar_terms` (legacy fallback; Phase 6 drop).
  - Add NEW columns on `schools` (8 from §4.8) + on `classes` (`department`) + on `class_members` (`source` if added) + on `school_responsibilities` (`department`).
- **`WIRING.yaml`** —
  - **NEW** `school-governance` system: depends_on `[auth-system, permission-helper]`; affects every school-level setting; key_files `src/lib/access-v2/governance/setting-change.ts`, `src/lib/access-v2/governance/school-merge.ts`, `/api/school/[id]/*` routes.
  - **NEW** `school-library` system: depends_on `[school-governance, content-forking]`; affects `dashboard-v2`, `unit-management`; key_files `/api/school/[id]/library/route.ts`.
  - **MODIFY** `teacher-school-settings` v1 → mark `superseded_by: school-governance`. Trim summary to only describe what `teachers.school_profile` actually does (workshop equipment).
  - **MODIFY** `auth-system`: add `school-governance` to `affects` list.
  - **MODIFY** `permission-helper`: extend summary to mention dept_head auto-tag via `has_dept_head_responsibility`.
- **`api-registry.yaml`** — `python3 scripts/registry/scan-api-routes.py --apply`; expect +10–11 routes.
- **`feature-flags.yaml`** — if §3.8 Q4 = YES, register `school.governance_engine_rollout`.
- **`data-classification-taxonomy.md`** — add 3 new tables + new column entries on `schools`.
- **`docs/scanner-reports/rls-coverage.json`** — rerun `python3 scripts/registry/scan-rls-coverage.py`; verify still 0 + 0.
- **`docs/projects/access-model-v2-followups.md`** —
  - **CLOSE** FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL P2 (resolved by §4.9).
  - **FILE** FU-AV2-PHASE-4-LIBRARY-FORK P3 (school-library forking deferred from §3.8 Q12).
  - **FILE** FU-AV2-PHASE-6-LEGACY-CALENDAR-DROP P3 (drop `school_calendar_terms` post-Phase-6).
  - **FILE** FU-AV2-PHASE-4-SCHOOL-DIRECTORY-EXPANSION P3 (expand seed from ~150 → 5–10k post-pilot).
  - **FILE** FU-AV2-PHASE-5-IMPERSONATE-SESSION P3 if §3.8 Q9 = "view-as only" (full session-spoof impersonation deferred).
  - **FILE** FU-AV2-PHASE-4-OAUTH-DOMAIN-ENFORCE P3 (domain enforcement, not just auto-suggest).
- **`docs/decisions-log.md`** — append §3.8 sign-offs + tier-classification table + Option-A dept-head choice.
- **`docs/changelog.md`** — append session entry: what shipped, migrations applied, registries synced.
- **`docs/lessons-learned.md`** — capture any new Lesson; finalise candidate Lesson #66 ("audit existing RLS policies + helper functions on adjacent tables when introducing a new junction-shaped table") if not already saveme'd into the file.

**Stop trigger:** Any registry diff fails review → STOP, fix before commit.

---

## 5. Don't-stop-for list

Per build-methodology rule 4 (don't paper over surprises) — these are items where stopping would be over-cautious:

- Cosmetic seed entry typos in §4.1 (e.g., "Etón College" vs "Eton College") — fix in same commit.
- Test-mock updates required as helpers gain new arguments.
- Helper file path imports.
- Incidental school name normalisation differences (e.g., "St. Paul's" vs "St Paul's" in seed).
- Adjacent route discovering it ALSO writes school-level settings without using the governance helper — note in `FU-AV2-PHASE-6-CALLSITE-AUDIT` for cutover.
- The `school_calendar_terms` legacy table — leave intact this phase; Phase 6 cutover decides drop.
- Existing `teacher_profiles.school_name` text column drift — out of Phase 4 scope; Phase 6.

---

## 6. Stop triggers

Per build-methodology rule 4 — STOP and report findings before continuing:

- Any §3.8 open question NOT signed off before Phase 4.0 → STOP.
- Any Postgres helper `pg_proc` verification returns unexpected definition → STOP.
- A migrated callsite changes a teacher's pre-Phase-4 baseline access → STOP, diagnose.
- Cross-school read succeeds in §4.10 smoke → STOP, RLS not enforcing.
- Test count regresses below 2895 baseline without explanation → STOP.
- `npx tsc --noEmit --project tsconfig.check.json` fails → STOP.
- A Postgres dept_head trigger fires recursively (e.g., the sync_on_class_change trigger somehow re-triggers itself via class_members write) → STOP, fix the trigger guard.
- The `school_setting_changes` cron skips a row OR double-applies → STOP.
- The merge cascade leaves orphan rows on any of the 12 tables it touches → STOP.
- Cross-school super-admin endpoint returns row to non-admin → STOP, severe.
- The bootstrap-window auto-close trigger fires when 2nd teacher LEAVES (mistakes departure for arrival) → STOP, audit trigger condition.

---

## 7. Checkpoint A5 — gate criteria

Phase 4 closes when ALL pass:

### Code

- [ ] `school_domains`, `school_setting_changes`, `school_merge_requests` tables created with full RLS + indexes per §3.2.
- [ ] `src/lib/access-v2/governance/setting-change.ts` exists + propose/confirm/revert helpers per §4.3.
- [ ] `src/lib/access-v2/governance/school-merge.ts` exists + cascade helper per §4.5.
- [ ] `src/lib/access-v2/school/calendar.ts` precedence resolver exists per §4.8.
- [ ] `src/lib/auth/require-platform-admin.ts` helper exists.
- [ ] All 10–11 new routes per §3.4 ship + tested.
- [ ] All 5 new pages per §3.4 ship.
- [ ] Welcome wizard auto-suggest wired per §4.2.
- [ ] Department + dept_head trigger machinery per §4.9.
- [ ] Tests updated; **2895 → ≥2980 (≥85 new)**, 0 regressions.
- [ ] `npx tsc --noEmit --project tsconfig.check.json` 0 errors.

### Migrations

- [ ] Phase 4.1 (seeds), 4.2 (school_domains), 4.3 (school_setting_changes), 4.5 (school_merge_requests + schools.merged_into_id), 4.8 (schools settings columns), 4.9 (classes.department + dept_head trigger) — 6 migrations applied to prod.
- [ ] Optional 4.0 admin_settings flag if §3.8 Q4 = YES.
- [ ] `pg_proc` verification per helper confirms `SECURITY DEFINER` + `STABLE` + `search_path = public, pg_temp` + `REVOKE FROM PUBLIC, anon` + `GRANT TO authenticated, service_role`.
- [ ] `bash scripts/migrations/verify-no-collision.sh` exits 0 against `origin/main`.

### Smoke (prod-preview, branch-alias URL — Lesson #63)

- [ ] All 9 §4.10 scenarios PASS.
- [ ] Vercel logs: zero `Invalid session` or RLS-policy errors during smoke.
- [ ] `/school/[id]/settings` renders for same-school teacher; 404 for cross-school.
- [ ] No regression on existing `/teacher/*` flows under read-as-platform-admin path.

### Registries (Phase 4.11)

- [ ] schema-registry.yaml: 3 new tables + 8 new schools columns + classes.department + class_members.source.
- [ ] WIRING.yaml: school-governance + school-library systems added; teacher-school-settings v1 superseded.
- [ ] api-registry.yaml: 10+ new routes registered.
- [ ] feature-flags.yaml: school.governance_engine_rollout (if §3.8 Q4 = YES).
- [ ] data-classification-taxonomy.md: 3 new tables + new column entries.
- [ ] rls-coverage.json: still 0 `no_rls`, 0 `rls_enabled_no_policy`.

### Documentation

- [ ] This brief at HEAD with completion notes appended.
- [ ] `docs/projects/access-model-v2-phase-4-smoke.md` written (9-scenario report).
- [ ] `docs/projects/access-model-v2-followups.md` updated: FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL closed; 4–5 new FUs filed.
- [ ] `docs/decisions-log.md` appended with §3.8 sign-offs + tier-classification table.
- [ ] `docs/changelog.md` session entry written.
- [ ] Handoff doc written for next session (Phase 5 prep).

### Followups

- [ ] FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL P2 → ✅ RESOLVED.
- [ ] FU-AV2-PHASE-4-LIBRARY-FORK P3 → filed.
- [ ] FU-AV2-PHASE-6-LEGACY-CALENDAR-DROP P3 → filed.
- [ ] FU-AV2-PHASE-4-SCHOOL-DIRECTORY-EXPANSION P3 → filed.
- [ ] FU-AV2-PHASE-5-IMPERSONATE-SESSION P3 → filed (if Q9 = view-as).
- [ ] FU-AV2-PHASE-4-OAUTH-DOMAIN-ENFORCE P3 → filed.

---

## 8. Risks + mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **Estimate underestimates substantially** — §3.8 Q1 already flags ~7–8 days vs master-spec 3 days; Phase 4 scope is broader than any prior phase | High | High | Lesson #59 — buffer included (§9). Stop trigger: if 4.4 takes >2 days, STOP and re-scope. Optionally split into 4A + 4B per §3.8 Q1. |
| **Dept_head trigger recurses or fires unexpectedly** — Lesson #65 (old triggers don't know about new user types) is a sibling; the trigger pattern is more complex than Phase 1's `handle_new_teacher` | High | Medium | Triggers all `SECURITY DEFINER` + `search_path` locked; explicit guards on `source = 'auto_dept_head'` for removal; extensive smoke; idempotent INSERT...ON CONFLICT DO NOTHING. |
| **Merge cascade leaves orphan rows on a forgotten table** — Phase 4 cascades `school_id` across 12+ tables; missing one means orphan data | High | Medium | Audit list captured in §4.5 helper; migration test counts rows in all 12 tables before/after; smoke run scenario 9 covers this. |
| **High-stakes proposal lifecycle race** — two teachers click confirm at same time; stale read sees pending while update has flipped to applied | Medium | Low | TX-level locking on UPDATE; SELECT...FOR UPDATE in helper; 2nd-confirmer gets "already applied" error. |
| **Bootstrap grace gaming** — invite a fake 2nd teacher, fire them next day, claim single-teacher mode reopens | Medium | Low | §3.8 Q6 proposal: bootstrap window does NOT reopen on teacher departure. Once closed, stays closed. |
| **Backfill conflict** — multi-teacher school has 3 different academic_calendars; backfill picks wrong one | Medium | Medium | Backfill picks most-recently-edited; surfaces "calendar moved up from X" notice in activity feed for 7 days; revertable to the previous teacher's data via revert button (low-stakes change). |
| **Welcome-wizard domain auto-suggest false positive** — teacher emails from a personal domain (gmail.com) triggers a "did you mean Google?" suggestion | Medium | High (gmail/outlook common) | School_domains seed excludes free-email providers; `lookup_school_by_domain` returns NULL for blocklisted domains. |
| **Settings UI write bypasses governance helper** — direct `UPDATE schools SET name = ?` somewhere | High | Medium | Code review + linter rule (post-Phase-4 follow-up): grep for `\.update\(\.{0,20}\bschools\b` outside `governance/*.ts` files. |
| **Super-admin "view-as" leaks teacher data to non-admin** | High | Low | `requirePlatformAdmin` helper checks `is_platform_admin = true` from `user_profiles`; signed URL has 5-minute expiry; audit_events log every impersonation. |
| **Dept_head auto-tag fires on archived class** | Low | Medium | Trigger filter `WHERE deleted_at IS NULL`. Smoke covers archived-class case. |
| **`schools.timezone` mass-set during settings UI rollout** breaks existing reset logic for AI budget cron in some schools | Medium | Low | Phase 4 doesn't change the hardcoded `Asia/Shanghai` default; new schools start from default; existing schools keep current value; only opt-in changes flip. |
| **3-Matts NIS prod data: 3 teachers with same name share a department** — dept_head auto-tag reads ambiguous when display_name is "Matt" 3 times | Medium | High (prod data) | Dept_head responsibility row keys on `teacher_user_id` (auth.uid()), not display_name. NIS keeps 3 separate rows. Cross-account access not auto-granted. |

---

## 9. Estimate

| Sub-phase | Estimate |
|---|---|
| 4.0: Pre-flight + decisions | 0.5 day |
| 4.1: Seed schools dataset extension (+ ~120 entries) | 0.5 day |
| 4.2: school_domains + signup auto-suggest | 0.75 day |
| 4.3: Governance engine + cron | 1 day |
| 4.4: /school/[id]/settings page + activity feed | 1 day |
| 4.5: school_merge_requests + 90-day redirect | 0.75 day |
| 4.6: School Library browse | 0.5 day |
| 4.7: Platform super-admin /admin/school/[id] | 0.75 day |
| 4.8: Bubble-up scattered settings (calendar etc.) | 0.5 day |
| 4.9: Department + dept_head auto-tag triggers | 0.75 day |
| 4.10: Smoke run | 0.5 day |
| 4.11: Registry hygiene + close-out | 0.5 day |
| Buffer (Lesson #59 — estimates lie) | 1 day |
| **Total** | **~9 days** (round to **~7–9 day band; aim 8**) |

This is +5 days over master-spec's 3-day estimate. The delta is real:
- 12 sub-items vs Phase 3's tighter scope.
- ~150-school seed adds 0.5 day not in the 3-day estimate.
- Dept_head trigger work adds 0.75 day (FU fold-in).
- Calendar bubble-up + read precedence adds 0.5 day not in master spec line breakdown.
- Super-admin view + impersonation adds 0.75 day.
- Merge cascade adds 0.75 day.
- Lesson-#59 buffer adds 1 day.

If §3.8 Q1 = SPLIT into 4A + 4B: 4A is 4.1+4.2+4.3+4.4+4.6 (5 days; settings + library + governance) → Checkpoint A5a; 4B is 4.5+4.7+4.8+4.9 (3 days; merge + super-admin + bubble-up + dept-head) → Checkpoint A5b. Net same total but two ship windows.

If §3.8 Q9 = defer impersonation entirely: shave 0.25 day. If Q12 = browse-only library: shave 0 (already assumed). If Q4 = NO governance flag: shave 0.1 day.

---

## 10. References

- **Master spec:** [`docs/projects/access-model-v2.md`](./access-model-v2.md) §4 Phase 4 (line 253); §8.1–§8.6 (lines 339–528); Decision 8 (line 336 — flat governance).
- **Parent briefs:** [`access-model-v2-phase-0-brief.md`](./access-model-v2-phase-0-brief.md), [`access-model-v2-phase-1-brief.md`](./access-model-v2-phase-1-brief.md), [`access-model-v2-phase-2-brief.md`](./access-model-v2-phase-2-brief.md), [`access-model-v2-phase-3-brief.md`](./access-model-v2-phase-3-brief.md).
- **Phase 0 schools migrations** (already applied to prod):
  - `supabase/migrations/085_schools.sql` (table + extension + seed support)
  - `supabase/migrations/085_schools_seed.sql` (~18 IB MYP entries)
  - `supabase/migrations/20260428142618_user_profiles.sql` (`is_platform_admin` flag)
  - `supabase/migrations/20260501045136_allowed_auth_modes.sql` (Phase 2.3 — `allowed_auth_modes` array)
  - `supabase/migrations/116_teachers_school_id_reserved.sql` + `117_classes_school_id_reserved.sql`
  - `supabase/migrations/20260427134953_fabrication_labs.sql` (`current_teacher_school_id()` SECURITY DEFINER pattern)
- **Phase 3 reference patterns:**
  - `supabase/migrations/<UTC>_phase_3_1_permission_helpers.sql` — SECURITY DEFINER pattern for the new dept_head triggers.
  - `src/lib/access-v2/can.ts` + `src/lib/access-v2/permissions/actions.ts` — extension surface for new actions (`school.settings.*`, `school.library.*`).
- **Existing routes Phase 4 evolves:** `src/app/api/teacher/school/route.ts`, `src/app/api/schools/route.ts`, `src/app/api/schools/search/route.ts`, `src/app/api/admin/schools/route.ts`, `src/app/admin/schools/page.tsx`, `src/app/api/teacher/school-calendar/route.ts`.
- **Lessons:** #43, #45, #47, #54, #59, #60, #61, #62, #64, #65, candidate #66. Re-read pre-flight.
- **Followups (open at Phase 4 start):** FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL P2 (will close); FU-AV2-PHASE-3-CALLSITES-REMAINING P3 (parallel); FU-AV2-PHASE-3-COLUMN-CLASSIFICATION P3 (parallel; could fold into §4.11).
- **Methodology:** [`docs/build-methodology.md`](../build-methodology.md). Pre-flight ritual; checkpoint discipline; registry cross-check Step 5c.
- **Loominary OS-seam principle (ADR-001):** `school-governance` + `school-library` should keep interfaces clean enough that a second product (Makloom) could plug in. School entity is a domain-level concept; per-product specialisation happens in `governance/setting-change.ts` (which fields are stake-tiered).

---

## 11. Sign-off

**Pre-flight + audit complete (2 May 2026 AM).** Brief drafted with:

- Phase 0 schema seams confirmed live in prod (rich `schools` table; only 3 NEW tables needed).
- 6 existing routes identified for evolve-or-replace disposition; 10–11 new routes mapped.
- 12 sub-items decomposed across 11 sub-phases (4.0–4.11).
- 4 SECURITY DEFINER discipline patterns specified.
- 3 NEW table designs with full RLS specified.
- `dept_head` department concept resolved via Option A (extend `school_responsibilities.department` + `classes.department`).
- 12 open questions surfaced, each with a default proposal awaiting Matt's sign-off.

**STOP — awaiting Matt's sign-off on:**

- All 12 §3.8 open questions (Q1 estimate delta, Q2 stake-tier table, Q3 ai_budget column phase, Q4 rollout flag, Q5 merge redirect column, Q6 bootstrap edge case, Q7 dept Option A vs B, Q8 dept_head retroactive backfill, Q9 impersonation scope, Q10 timezone migration, Q11 seed count, Q12 library forking).
- §4 sub-phase ordering (4.0 → 4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6 → 4.7 → 4.8 → 4.9 → 4.10 → 4.11) — note 4.5 sequencing AFTER 4.4 deliberately so super-admin work (4.7) has the merge surface to reference.
- §9 estimate (~8–9 days; flag if too aggressive or too padded; or split into 4A + 4B).
- Concerns about scope creep — anything in §3.5 (settings to bubble up) that should NOT bubble?

When signed off, Phase 4.0 starts with branch-active-sessions row claim + (if Q4 = YES) the rollout flag migration. Phase 4 expected close: ~10–11 May 2026 with Checkpoint A5 PASS (or A5a + A5b if split).
