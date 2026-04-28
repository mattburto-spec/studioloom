# Project: Access Model v2 — Auth Unification, Multi-Tenancy & Privacy Foundation

**Created:** 25 April 2026
**Status:** DESIGN PHASE — plan signed off by Matt 25 April 2026 (8 decisions, see §7). **Restructured 28 April 2026 PM** after IT security audit (`studioloom-it-audit-2026-04-28.docx`) added 7 deliverables (MFA, RLS test harness, ENCRYPTION_KEY rotation, retention cron, RLS-no-policy docs, multi-Matt audit, unknown-auth triage). Preflight Phase 8 trilogy + 8-4 SHIPPED 28 Apr — schools entity, `current_teacher_school_id()` helper, school-scoped RLS pattern all live in prod. Phase 0 trigger conditions met; ready to start when Matt says go.

**Approach:** **Path B (chosen 28 April 2026 PM)** — ship every phase of v2 (Phases 0–6) before any NIS student logs in. Cleaner architectural baseline at pilot start; no manual data-export stopgap; no pilot-freeze coordination overhead; methodical-over-fast matches the build methodology. Pilot blockers from the IT audit (§12) close in parallel with v2 work or shortly after. See §1.5 for Path A vs Path B comparison.
**Priority:** P1 — gates school-level deployments, paid customer onboarding, and `PH6-FU-MULTI-LAB-SCOPING`
**Estimated effort:** 19–25 days across 6 phases (Path B — single pilot-readiness milestone at the end). Phase 6 absorbs the API-versioning rename pass; Phase 0 absorbs timezone + locale columns at zero added time.
**Worktree (when work begins):** new worktree `/Users/matt/CWORK/questerra-access-v2` on branch `access-model-v2`. Do **not** mix with `preflight-active` or `dashboard-v2-build` — surface area is too large.
**Dependencies blocked by this:**
- ~~`PH6-FU-MULTI-LAB-SCOPING` P2~~ — **REMOVED 28 Apr 2026.** Now absorbed into Preflight Phase 8 (`docs/projects/preflight-phase-8-brief.md`), no longer waiting on Access v2.
- FU-O / FU-P / FU-R (collapsed into this project)
- FU-Q (dual student identity unification)
- FU-W (no audit log)
- All paying-school-customer onboarding

**Follow-up project (post-Access-v2 cleanup):**
- [`docs/projects/class-architecture-cleanup.md`](class-architecture-cleanup.md) — 4 gaps surfaced 28 Apr during Phase 2.5 multi-class smoke. §4 (Option B URL-scoped classId, ~10-11d) is queued behind Access v2 because Access v2 will rewire every URL anyway. §1 (archived class auto-unenrollment, ~2hr) can ship BEFORE Access v2 Phase 0 — recommend doing it first.

**ADRs to revise once shipped:** ADR-003 (auth model). New ADR-011 (school/org entity). New ADR-012 (audit log model).

---

## 1. Why Now

Matt's framing (25 Apr 2026): "There still aren't any students using it." This is the cheapest possible window to do this work. Once real students from EU/US schools log in, every item below becomes a migration with downtime, data-shape risk, and procurement-blocking gaps.

Current reality:
- Students authenticate via classcode + name → opaque token in cookie. No `auth.users` row.
- Teachers authenticate via Supabase Auth.
- Fabricators authenticate via Argon2id + opaque session tokens (Phase 1B-2).
- Three parallel auth systems, none unified at the session-resolution layer.
- No school/org entity. No co-teacher / dept head / school admin roles.
- No audit log. No data export endpoint. No soft-delete discipline. No per-student AI cost ceiling.
- China classes legally cannot use OAuth/email auth → the classcode+name path must remain a first-class option, not a fallback.

This project locks in the foundation now while the user count is zero, so a school can be onboarded later without architectural surgery.

---

## 1.5 Path B — ship-before-pilot (chosen 28 April 2026 PM)

The 28 Apr IT audit (`studioloom-it-audit-2026-04-28.docx`) split deployment requirements into 12 pilot blockers and 11 ongoing conditions. Two paths to NIS pilot were considered:

- **Path A** (audit-recommended, sequenced for fastest pilot start): ship Phase 0+1+5a, run pilot, ship 2+3+4+5b+6 during/after pilot under freeze discipline. ~10–12 v2-days to pilot-readiness; ~23–26 days total.
- **Path B** (chosen): ship ALL of v2 Phases 0–6 before any student logs in. ~18–24 v2-days to pilot-readiness with no split between dev and pilot windows.

**Why Path B:**
- Cleaner architectural baseline when students arrive (no `_unused` legacy paths, no manual SQL export stopgap, no half-shipped role model)
- No mental overhead of "pilot freeze policy" vs "active dev" coordination — it's all one mode at a time
- Single pilot-readiness milestone (end of Phase 6) instead of two (5a-pilot-ready + 6-production-ready)
- Removes a class of regression risk: an audit-log instrumentation gap that surfaces 3 weeks into a pilot is much more painful than the same gap caught at Checkpoint A6 with no live students
- Methodical-over-fast aligns with `docs/build-methodology.md` and Matt's stated preference (*"make this world class. there still aren't any students using it. this is the cheapest possible window to do this work"*)
- Real-world tradeoff: ~2 weeks of additional wait before pilot; the audit acknowledges this and explicitly says either path is defensible — Path A is faster, Path B is cleaner

**Path B sequencing:**

1. **Phase 0** (foundation schema + MFA + RLS test harness + ENCRYPTION_KEY rotation + multi-Matt audit + unknown-auth triage) — ~3–4 days
2. **Phase 1** (auth unification — every student → `auth.users`, `getStudentSession()` helper) — ~3 days
3. **Phase 2** (OAuth: Google + Microsoft + email/PW; Apple deferred) — ~3 days
4. **Phase 3** (class roles + `class_members` + `can()` permission helper) — ~3 days
5. **Phase 4** (school registration + settings + governance + library) — ~3 days
6. **Phase 5** (audit log + per-student AI budgets + export endpoint + delete endpoint + retention cron) — ~3 days
7. **Phase 6** (cutover + ADRs + registry sync + RLS-no-policy docs + 3-Matts merge decision) — ~2 days

**Pilot-readiness milestone:** Phase 6 signed off + parallel pilot-blockers closed (§12). One named gate, not two.

**Pilot freeze policy** (audit F39, post-pilot-start): once the NIS pilot begins, no production deploys during NIS class hours (school day Nanjing time). This applies to bug fixes during the pilot, NOT to v2 development (which will already be done). Tag pilot baseline as `v0.x-pilot1` for one-tag rollback.

---

## 2. Architecture Decisions

### Decision 1: Every student is an `auth.users` row from day one
The classcode+name path becomes a **custom Supabase auth flow**, not a parallel session system. Server-side, the route mints a Supabase session (custom JWT or admin-created user) tied to a student record. Cookie shape converges with teacher cookies.

**Why:** A single session-resolution helper (`getStudentSession()`) replaces three. Eliminates the class of bugs around CDN + Cache-Control + cookie stripping (Lesson #29 area). RLS policies stop branching on auth-type.

**Alternative rejected:** Dual-auth (nullable `auth_user_id`) is simpler short-term but permanently bifurcates RLS, session middleware, and every student-touched route. Not world-class.

**Existing helpers to integrate, not rebuild (added 28 Apr 2026 — parallel session work on `main`):**
- `src/lib/auth/verify-teacher-unit.ts` — `requireTeacherAuth()`, `verifyTeacherHasUnit()`, `verifyTeacherOwnsClass()`, **`verifyTeacherCanManageStudent()`** (this last one is the de-facto "teacher → student" permission rule today; see Decision 7).
- `src/lib/student-support/resolve-class-id.ts` — `resolveStudentClassId()` already does (classId | unitId) → verified non-archived classId resolution. Includes `filterOutArchivedClasses()` helper. The `getStudentSession()` Decision 1 helper should **wrap or compose** this, not re-implement it. Consider this the prototype that proves the unified-session pattern works.
- `src/app/api/student/me/unit-context/route.ts` — already implements URL-aware class context for the topnav. Pattern to reuse for unified session shape.
- `src/app/api/auth/student-session/route.ts` — already does `ORDER BY enrolled_at DESC + filter is_archived` for session-default class. Don't revert; promote to the new model.

### Decision 2: School/Organization is a first-class entity, governed without a designated admin
**Reality check (28 Apr 2026 — Phase 8 already shipped most of this):**
- `schools` table EXISTS (mig 085) — has dedup index, RLS, `parent_school_id` for districts.
- `teachers.school_id` EXISTS (mig 085, nullable).
- `classes.school_id` EXISTS (mig 117, nullable, reserved).
- `machine_profiles.school_id` EXISTS (mig 093, nullable, reserved).
- `fabricators.school_id` EXISTS (mig 097/116, nullable, reserved).
- `fabrication_labs.school_id` EXISTS NOT NULL with working school-scoped RLS (Phase 8).
- `current_teacher_school_id()` SECURITY DEFINER helper EXISTS (Phase 8) — flat-school-membership canonical pattern, validated in prod across 3 NIS Matt personas.

**What Phase 0 still adds:** `students.school_id`, `units.school_id` (gaps — both critical for school library + clean RLS), `schools.status` lifecycle enum, `schools.region`, `schools.bootstrap_expires_at`. Backfill `classes.school_id`, `machine_profiles.school_id`, `fabricators.school_id` from the existing nullable columns + tighten to NOT NULL. Every existing teacher with NULL `school_id` gets a personal school during backfill — no NULL `school_id` ever after Phase 0 completes.

School settings are **editable by any teacher in the school** under a two-tier rule: low-stakes changes apply instantly (audit-logged + 7-day revert); high-stakes changes require a second teacher's confirm within 48 hours or they expire. No designated school admin role. No separate school-admin login. See §8 for the full governance model.

**Why:** Multi-tenancy retrofitting is the most painful migration in edtech. With the column there from day one, school licensing is a config change. The flat governance model avoids the "who manages the admin?" problem and matches how real faculty rooms actually work — collaborative with a paper trail.

**OS-seam alignment:** Matches Loominary master architecture's tenant boundary. ADR-001 says don't extract until product #2, but designing the seam well now is free.

### Decision 3: Audit log is append-only, immutable, and built into the route layer
New `audit_events` table. `(actor_id, actor_type, action, target_table, target_id, payload_jsonb, ip, user_agent, created_at)`. Insert-only RLS. Wrapper function `logAuditEvent()` called from every mutation route.

**Why:** Cannot backfill history. School procurement asks for it on day one. Pairs with Privacy Phase for GDPR/FERPA "right to know."

### Decision 4: Region is a column, not a project topology
Add `region` to `schools` (default `'default'`). Single Supabase project for now. Real regional split (EU project, US project, etc.) is a future migration triggered by a customer who demands it. The column tells us *who* would move.

**Why:** Splitting Supabase projects mid-flight is hard regardless of when. The column is cheap insurance, not a commitment.

### Decision 5: `unit_version_id` on every submission-shaped table
Every student work artefact stores a snapshot reference. Means "what content existed at the moment they submitted" is recoverable, even after a teacher edits the master unit. Builds on the version-history APIs from 23 Mar 2026.

**Why:** Assessment integrity. Doable now, painful to backfill (would need version-history reconstruction guesswork).

### Decision 6: Per-student AI budgets are enforced at the route layer (with cascade pattern)
**Config (cascade resolution)** — follows the same pattern as `support_settings` and `ell_level / ell_level_override` shipped in Phase 2.5 (commits e52105a + 1406e6c, 28 Apr 2026):
- `schools.default_student_ai_budget` (school default)
- `students.daily_token_cap` (per-student override of school default)
- `class_students.daily_token_cap_override` (per-class override of per-student value)
- Resolution order: class override > student override > school default > global 100k fallback

**State (separate runtime table)** — `ai_budget_state (student_id, class_id, tokens_used_today, reset_at, last_increment_at)`. Kept separate from config because state mutates frequently (every AI call) and atomic increments don't play well with JSONB. Middleware on every AI route reads cascaded config + checks state before invocation.

**Why:** A single stuck loop or abuse vector becomes real money fast. Trivial to build now; surgery to retrofit during a real incident. Cascade pattern matches existing `support_settings` precedent — teachers learn one mental model, not five.

**Alternative considered:** Stuff `daily_token_cap` into existing `students.support_settings` JSONB. Rejected — `support_settings` is for human-edited support preferences (ELL level, accessibility); AI budget is system policy. Different lifecycle, different audience, different safe-default behaviour. Same cascade pattern, separate columns.

### Decision 7: Roles are explicit at class level, flat at school level
New `class_members` table replacing the current `author_teacher_id` direct ownership. Class-level roles: `lead_teacher`, `co_teacher`, `dept_head`, `lab_tech`, `observer`. **School-level membership is flat** — every teacher with `school_id = X` is a full member of school X, no sub-roles. Permissions resolved through a single `can(actor, action, resource)` helper.

**Why:** Co-teaching is the most common school-procurement question. Hardcoded `author_teacher_id` is the FU-O blocker. Flat school membership (no `school_admin` role) pairs with Decision 2 and §8 to eliminate the admin-management problem.

**Platform admin (Matt) is separate:** `is_platform_admin` flag on `auth.users` gates the super-admin view at `/admin/school/[id]`. This is Matt's view into any school. Not a school-level role.

**`verifyTeacherCanManageStudent()` is the base permission, not a stricter overlay (28 Apr 2026):** the `can()` helper's default for any plain teacher checking access to a specific student must be: *"the teacher owns at least one active non-archived class the student is enrolled in."* This is what `src/lib/auth/verify-teacher-unit.ts:verifyTeacherCanManageStudent()` already does today, used by the unified Support tab at `/teacher/students/[id]?tab=support`. Class-level roles (lead_teacher, co_teacher, dept_head, lab_tech, observer) ADD permissions on top of this base; they don't gate it. A `co_teacher` of a class containing student S has the same student-management access as the `lead_teacher` of another class containing S — both share an active non-archived class with S, both can manage. Anything stricter breaks shipped UX.

---

## 3. Scope

### In scope
1. Auth unification: classcode+name → Supabase custom flow; teacher path unchanged; fabricator path unchanged
2. OAuth providers: Google, Microsoft (Azure AD), Apple — student + teacher
3. Email/password for students (where regionally allowed)
4. Per-class and per-school auth-mode allowlist (China classes lock to classcode+name only)
5. `schools` table + backfill personal schools for existing teachers
6. `class_members` table replacing `author_teacher_id` direct ownership
7. Soft delete discipline: `deleted_at` on every user-touched table; hard-delete cron after 30 days
8. `audit_events` table + `logAuditEvent()` wrapper + route-layer integration
9. Per-student AI budgets + rate limit middleware
10. Data export endpoint: `GET /api/student/[id]/export` (full JSON)
11. Data delete endpoint: `DELETE /api/student/[id]` (soft → hard cascade)
12. `region` column on `schools`
13. `unit_version_id` on submission-shaped tables (jobs, gallery posts, NM observations, integrity reports)
14. `getStudentSession()` / `getActorSession()` unification helpers
15. Account recovery: teacher-mediated reset for students; standard email reset for teachers + email/PW students
16. Middleware: every student-facing route resolves through the unified session helper
17. School registration: curated directory seed (~5–10k schools from IB / GCSE / ACARA / US independent lists), `school_domains` table for domain-based auto-suggest on signup, fuzzy-match gate on "create new school" (trigram + tsvector similarity > 0.7), merge queue via `school_merge_requests` with 90-day redirect window
18. School settings page at `/school/[id]/settings` — all school-owned fields (identity, calendar, timetable, frameworks, Preflight labs+machines, auth policy, AI policy, notification branding, safeguarding contacts, content sharing policy)
19. School governance engine: `school_setting_changes` table tracks every change with tier classification (low-stakes / high-stakes), `applied_at`, `confirmed_by`, `expires_at`, `reverted_at` columns
20. Bootstrap grace window: `schools.bootstrap_expires_at` — single-teacher schools have 7 days where high-stakes changes skip the 2-teacher rule
21. School activity feed on settings page: live stream of recent changes with inline "revert" button for low-stakes items within 7 days; pending-confirm banner for high-stakes items within 48h
22. School Library browse view: teachers in the same school can see each other's units as read-only, fork into their own class
23. Platform super-admin view at `/admin/school/[id]` (gated on `auth.users.is_platform_admin`) — teachers, fabricators, settings snapshot, audit log, merge request controls
24. **Forward-compat schema only (Phase 0, no UX):** `school_resources` + `school_resource_relations` polymorphic tables — first consumer is Matt's future Service/PYP people-places-things library; pattern reusable for alumni / partner / shared-rubric collections (see §8.6)
25. **Forward-compat schema only:** `guardians` + `student_guardians` relational tables — unblocks future parent comms, report sharing, parent portal SSO (see §8.6)
26. **SIS integration seam — already partially exists in mig 005 (28 Apr 2026 pre-flight finding).** Mig 005_lms_integration.sql added `students.external_id`, `students.external_provider`, `classes.external_class_id`, `classes.external_provider`, `classes.last_synced_at` under different names than the v2 plan called for (`sis_source` → `external_provider`; `external_id` on classes → `external_class_id`). Renaming touches every reader of the LMS integration code path. **Decision (28 Apr PM):** keep mig 005's column names as-is for v2; canonicalisation deferred to Phase 6 cutover audit (or post-pilot follow-up). `teachers.external_id` / `teachers.sis_source` not added — `teachers` uses the separate `teacher_integrations` table (mig 005) for ManageBac/Toddle/Canvas API config. See §8.6 for updated forward-compat narrative.
27. **Forward-compat schema only:** `consents` table tracking per-subject opt-ins (media release, AI usage, directory visibility, community contact, third-party share) — required for FERPA / GDPR / PIPL; UX wired in Phase 5 alongside privacy endpoints (see §8.6)
28. **Forward-compat schema only:** `schools.status` lifecycle enum (`active` / `dormant` / `archived` / `merged_into`) — covers teacher turnover, school closure, post-merge redirect window (see §8.6)
29. **`students.school_id` + `units.school_id` columns** (NEW — gap surfaced by 28 Apr audit). Without these, school library queries can't filter cleanly and RLS on student-touched tables has to traverse `students → class_students → classes.school_id` per row. Phase 0 adds both as nullable, backfills from the canonical class chain, then tightens to NOT NULL.
30. **Teacher MFA enforcement (PROMOTED FROM DEFERRED — IT audit F6 BLOCKER 28 Apr):** enable Supabase TOTP MFA at project level; require enrollment on first login for every teacher + platform-admin account before pilot starts. ~1 day in Phase 0. Audit explicitly named this as a pilot blocker.
31. **Live Supabase RLS test harness (NEW — IT audit F14 HIGH):** integration test that authenticates as student-A in class-A, attempts to read student-B's data in class-B, asserts zero rows returned. Catches the class of bug that produced today's HIGH-1 cross-school leak. ~1–2 days in Phase 0 pre-flight; precondition for Phase 1 cutover.
32. **`ENCRYPTION_KEY` rotation script + fire-drill (NEW — IT audit F9 HIGH):** documented script that loads all rows with encrypted credentials, decrypts with old key, re-encrypts with new, writes back atomically. Run once during pilot setup as a fire drill. ~1 day in Phase 0.
33. **Manual SQL-based data export runbook (NEW — IT audit F32 stopgap):** step-by-step procedure to extract everything for a single `student_id` as JSON before the formal `/api/student/[id]/export` endpoint ships in Phase 5b. ~0.5 day in Phase 5a; tested once before pilot.
34. **Retention enforcement cron (NEW — IT audit F19 MEDIUM):** monthly job at `scripts/ops/run-retention-enforcement.ts` that reads `data-classification-taxonomy.md` `retention_days` per column, soft-deletes rows past the horizon, hard-deletes rows past `retention_days + 30`, logs every action to `audit_events`. ~1 day in Phase 5b. Surface "rows due to expire next quarter" in admin dashboard.
35. **RLS-no-policy documentation (NEW — IT audit F12 HIGH, also FU-FF):** for the 7 tables flagged by `scan-rls-coverage.py` (`admin_audit_log`, `ai_model_config`, `ai_model_config_history`, `fabrication_scan_jobs`, `fabricator_sessions`, `student_sessions`, `teacher_access_requests`), either add explicit deny-all policies with comments, or write `docs/security/rls-deny-all.md` naming each table + reason + which paths legitimately access via service role. Update scanner to recognize documented exceptions. ~0.5 day in Phase 6.
36. **Monetisation seams (NEW — forward-compat for [`monetisation.md`](monetisation.md)):** three small additions so future tier-gating doesn't require touching v2 surfaces. (a) `schools.subscription_tier` column added in Phase 0 (enum: `pilot | free | starter | pro | school`, default `pilot` for existing rows + new schools created during pilot). (b) `can(actor, action, resource, { requiresTier? })` signature in Phase 3 accepts an optional tier gate — default-unchanged behaviour, opt-in per route. (c) AI budget cascade in Phase 5 reads tier as topmost default (e.g. `free → 50k, starter → 75k, pro → 100k, school → 200k`) before falling through to school override → student override → class override. Schema + helper seams only — no Stripe, no billing UI, no plan upgrade flow. Those stay in `monetisation.md`. See §8.6 item 6.
37. **Timezone column on schools (NEW — 28 Apr regret-prevention pass):** `schools.timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai'` (IANA format, validated). Replaces the ambiguous "midnight in school's local timezone" reference in Decision 6. Every scheduled job reads this: AI budget reset, dormant-school cron, retention enforcement, audit log day-bucketing, Resend send windows. ~5 minutes of Phase 0 work; saves a backfill migration the day a US or EU school onboards.
38. **API versioning seam (NEW — 28 Apr regret-prevention pass):** all new v2-introduced routes ship under `/api/v1/...` prefix from Phase 0 onward. Existing 388 unversioned routes get a one-PR find-replace rename in Phase 6 cutover (`/api/teacher/*` → `/api/v1/teacher/*`, etc.) with a 90-day legacy-redirect alias on the old paths. Without versioning, the first SIS / LMS / parent-portal integration locks shape forever; with it, future v2 endpoints are non-breaking adds. ~30 minutes per phase of mechanical care; one focused day in Phase 6 for the rename pass.
39. **Locale columns (NEW — 28 Apr regret-prevention pass):** `teachers.locale TEXT DEFAULT 'en'`, `students.locale TEXT DEFAULT 'en'`, `schools.default_locale TEXT DEFAULT 'en'`. No translation system in v2 — just the columns. Resolution: `user.locale ?? school.default_locale ?? 'en'`. When i18n eventually lands (likely within a year given Chinese parent / non-Anglophone international audience), the columns are populated and routes already pass `locale` through. Two columns of effort now; eliminates the cross-table user backfill that would otherwise gate any translation effort.

### Explicitly NOT in scope (deferred)
- Regional Supabase project splits — `region` column is the only forward-prep
- Immutable submission snapshot reconstruction UI — only the `unit_version_id` reference is shipped here
- SSO via SAML — wait for a school that actually asks (audit F5 BLOCKER for production but only HIGH-mitigated for pilot)
- Audit log retention policies / advanced export tooling — basic logging + retention enforcement cron ship; advanced tooling is later
- ~~`PH6-FU-MULTI-LAB-SCOPING`~~ — Preflight Phase 8 absorbed it. Closed.
- **External community member auth** — invite + simple login for guest speakers, community partners, NGO mentors surfaced via the Service/PYP library. Schema seam designed (`auth.users.user_type` extensible enum + `class_members` role enum extensible). Full flow explored later (see §8.7)
- **School Resources Library UI** — Matt's people / places / things browse experience for Service/PYP students. Schema lands in Phase 0; the browse UI, search, filtering, contact-reveal flow, and student-facing card/list views are a separate future project that builds on the schema seam
- **Parent portal UI, SIS roster sync code, alumni directory UI** — schema seams ship; user-facing features are separate future projects
- **DPAs, privacy policy, ToS, China network test, incident response runbook, parental consent forms, pentest, dependency scanning, second engineer, status page** — pilot-blocking but NOT v2 work. Run as parallel track per §12

---

## 4. Phase Plan

Each phase ends with a named Matt Checkpoint. No phase begins until the previous one is signed off. Detailed phase briefs written via `build-phase-prep` skill once Matt approves this plan.

### Phase 0 — Foundation Schema + Audit Pre-Reqs (~3–4 days)
- **Core access tables:** `class_members`, `audit_events`, `ai_budgets`, `ai_budget_state`. (Note: `schools` already exists from mig 085 — Phase 0 only ADDS `status`, `region`, `bootstrap_expires_at` columns to it.)
- **Column additions on schools:** `schools.status` lifecycle enum, `schools.region`, `schools.bootstrap_expires_at`, `schools.subscription_tier` (monetisation seam — see §8.6 item 6), `schools.timezone` (IANA, default `'Asia/Shanghai'`), `schools.default_locale` (default `'en'`)
- **Locale columns on user tables:** `teachers.locale TEXT DEFAULT 'en'`, `students.locale TEXT DEFAULT 'en'`. No translation system — just the seam. Resolution: `user.locale ?? school.default_locale ?? 'en'`.
- **API versioning ritual (starts here, no migration):** every new route introduced by v2 ships under `/api/v1/...` prefix. Existing routes stay where they are until Phase 6's rename pass. Document in `docs/conventions/api-versioning.md` so future contributors don't drift.
- **NEW gap-fill columns (28 Apr audit):** `students.school_id`, `units.school_id` — backfilled from class chain, tightened to NOT NULL
- **Forward-compat tables (schema only, no UX wiring):** `school_resources`, `school_resource_relations`, `guardians`, `student_guardians`, `consents`
- **Column additions:** soft-delete (`deleted_at`) on `students` / `teachers` / `units` only — `classes` / `knowledge_items` / `activity_blocks` keep their existing `is_archived` patterns (mig 033 / 017 / 060+072); harmonisation deferred to Phase 6. `unit_version_id UUID NULL REFERENCES unit_versions(id) ON DELETE SET NULL` on 7 submission-shaped tables (`assessment_records`, `competency_assessments`, `portfolio_entries`, `student_progress`, `gallery_submissions`, `fabrication_jobs`, `student_tool_sessions`) — wires into the existing `unit_versions` table from mig 040, no new versioning system. *(SIS forward-compat originally planned here — partially exists via mig 005 under different names; see §3 item #26 + §8.6 item 3. Phase 0 does NOT add SIS columns; canonicalisation deferred to Phase 6.)*
- **User type extensibility:** `auth.users.user_type` enum starting with `student | teacher | fabricator | platform_admin` — designed extensible for future `community_member` (§8.7) and `guardian` without migration
- **Backfill:** populate `teachers.school_id` for orphan teachers (creates personal schools); backfill `classes.school_id`, `machine_profiles.school_id`, `fabricators.school_id` from teacher chain (already nullable); seed `class_members.lead_teacher` from existing `classes.teacher_id`; soft-delete columns default `NULL`; SIS columns default `NULL`
- **🛡️ MFA enablement (audit F6 BLOCKER):** turn on Supabase TOTP MFA at project level; require enrollment on first login for every teacher account; require Matt's platform-admin account to enroll before pilot. ~1 day. Documented procedure for MFA reset.
- **🛡️ Live RLS test harness (audit F14):** authenticate as student-A in class-A, assert cross-class reads return zero rows; covers the HIGH-1 leak class. ~1–2 days. Integration test runs in CI.
- **🛡️ ENCRYPTION_KEY rotation script + fire-drill (audit F9):** atomic re-encrypt of all stored credentials. Test in dev. Run rotation once during Phase 0 as a real fire drill. ~1 day.
- **🛡️ 8 unknown-auth routes triage (audit F10):** classify each route in api-registry.yaml `auth: unknown` rows as `service-role` / `teacher` / `student` / `fabricator` / `public`. Fix scanner heuristic or annotate manually. ~2 hours.
- **🛡️ Multi-Matt prod data audit:** query `SELECT id, display_name, name, email FROM teachers ORDER BY name, created_at` — surface 3-Matts and any other duplicate-name candidates. Decide before backfill whether merges happen (Phase 5b) or each gets a personal school. Do NOT silently merge.
- **Checkpoint A1:** schema verified against schema-registry; backfill verified row-counts (every teacher has school_id, every class has school_id, every student has school_id, every unit has school_id); RLS policies pass `scan-rls-coverage.py`; forward-compat tables exist with empty rows + working FKs; live RLS test harness green; MFA enrolled on platform-admin + every teacher; rotation script tested; no app regressions

### Phase 1 — Auth Unification (~3 days)
- Custom Supabase auth flow for classcode+name (server-side mints session)
- Backfill: every existing student → `auth.users` row (idempotent, dry-run first)
- `getStudentSession()` / `getActorSession()` helpers (compose existing `verifyTeacherCanManageStudent`, `resolveStudentClassId`, `current_teacher_school_id` — DON'T re-implement)
- Migrate every student-facing route to the unified helper (touch every middleware, every cookie reader)
- **Checkpoint A2:** all existing student flows work end-to-end; no route still reads the legacy token shape directly; RLS on student-touched tables simplified; live RLS harness still green

### Phase 2 — OAuth + Email/Password (~3 days)
- Google OAuth (Supabase dashboard config + callback route)
- Microsoft (Azure AD) OAuth
- Apple OAuth (incl. $99/yr Apple Developer prereq + bundle config) — gate behind feature flag if Apple Dev account not ready
- Email/password flow for students + teachers
- Per-class auth-mode allowlist UI (teacher add-student page)
- Per-school auth-mode default
- **Checkpoint A3:** all 4 providers work; China-locked class cannot offer OAuth/email options in UI; teacher invite flow exercises every path

### Phase 3 — Class Roles & Permissions (~3 days)
- `can(actor, action, resource, options?)` permission helper. `options.requiresTier` is the monetisation seam — opt-in tier gate, default-unchanged behaviour. Resolution: feature is allowed if `school.subscription_tier ∈ allowedTiers`. Used like `can(teacher, 'use_school_library', school, { requiresTier: ['pro', 'school'] })`. Most v2-internal `can()` calls don't pass it; tier-gated features wired in `monetisation.md` opt in.
- `class_members` table with class-level roles (lead_teacher, co_teacher, dept_head, lab_tech, observer)
- Co-teacher invite flow + UI
- Migrate every `author_teacher_id` check to the permission helper
- **`can()` default for plain teachers preserves `verifyTeacherCanManageStudent` semantics** — see Decision 7
- **Checkpoint A4:** co-teacher can edit a class they're invited to; dept head sees all classes in department; permission helper covers all routes per WIRING audit; no `verifyTeacherCanManageStudent` regression; `requiresTier` accepts a synthetic test (e.g., school on `pilot` tier blocked from a `school`-tier-gated test action)

### Phase 4 — School Registration, Settings & Governance (~3 days)
- Seed additional schools beyond the existing mig 085 dataset (IB / GCSE / ACARA / US independent)
- `school_domains` table + domain-based auto-suggest on teacher signup
- Fuzzy-match gate on "create new school" (trigram + tsvector — pg_trgm already enabled by mig 085)
- `school_merge_requests` + platform-admin merge approval flow + 90-day redirect
- `/school/[id]/settings` page — all school-owned fields (see §8.1)
- `school_setting_changes` governance engine: tier classification, instant-apply for low-stakes, pending-confirm for high-stakes, 48h expiry
- Bootstrap grace window (`schools.bootstrap_expires_at`, 7 days for single-teacher schools)
- School activity feed + 7-day revert UI for low-stakes; pending-confirm banner for high-stakes
- School Library browse view (read-only units from same-school teachers — uses new `units.school_id`)
- Platform super-admin view at `/admin/school/[id]` gated on `is_platform_admin`
- Migrate scattered school-level settings up (academic calendar from teachers; Preflight labs/machines stay school-scoped per Phase 8)
- **Checkpoint A5:** new teacher signs up → domain suggests real school → joins → sees existing settings; low-stakes change applies instantly + revertable by another teacher; high-stakes change waits for 2nd confirm; bootstrap grace verified on a fresh single-teacher school

### Phase 5 — Privacy & Compliance (~3 days)
- **Audit log infrastructure (Decision 3):** `audit_events` insert wired into every mutation route. `logAuditEvent()` wrapper called from every `/api/teacher/*`, `/api/admin/*`, and any `/api/student/*` route that mutates state. CI gate: `scan-api-routes.py` extended to flag any POST/PATCH/DELETE/PUT route that doesn't call `logAuditEvent`.
- **Per-student AI budget middleware (Decision 6):** cascade resolution + atomic state updates via `ai_budget_state`. Resolution order (top to bottom): tier default (from `schools.subscription_tier` — `pilot/free → 50k`, `starter → 75k`, `pro → 100k`, `school → 200k`; values configurable in admin_settings) → `schools.default_student_ai_budget` (per-school override) → `students.daily_token_cap` (per-student override) → `class_students.daily_token_cap_override` (per-class override). The tier layer is the new default ceiling so monetisation can change ceilings without per-school configuration. Reset rolls over at midnight in `schools.timezone` (IANA — see §3 item 37) so a school in Sydney and a school in Nanjing both reset at their own local midnight. Teacher-visible warning before hard cap.
- **Data export endpoint:** `GET /api/student/[id]/export` (JSON dump of all student-owned data, RLS-checked).
- **Data delete endpoint:** `DELETE /api/student/[id]` soft-delete + 30-day hard-delete cron.
- **Teacher view of student audit log:** `GET /api/teacher/students/[id]/audit-log`.
- **Retention enforcement cron (audit F19):** monthly job at `scripts/ops/run-retention-enforcement.ts`. Reads `data-classification-taxonomy.md` `retention_days` per column. Soft-deletes past horizon; hard-deletes past `retention_days + 30`. Logs every action to `audit_events`. Admin dashboard surfaces "rows due to expire next quarter".
- **Cost-alert pipeline live test (audit F24):** set `COST_ALERT_DAILY_USD=$0.01`, trigger one AI call, confirm Resend delivers email within 5 minutes. Document at `docs/security/cost-alert-fire-drill.md`.
- **Sentry PII scrubbing verification (audit F25):** open Sentry dashboard, confirm PII scrubbing enabled, screenshot to `docs/security/sentry-pii-scrub-{date}.png`, schedule next quarterly verification.
- **Checkpoint A6:** audit log row appears for every state-mutating route in a smoke run; AI budget triggers on synthetic abuse run; export verified for a real student record producing valid JSON; delete verified to soft → hard cascade in test; retention cron runs cleanly on test data; cost-alert fire drill landed an email; Sentry PII scrub verified.

### Phase 6 — Cutover & Cleanup (~2–3 days, before NIS pilot starts)
- Deprecate legacy student token system (delete dead code, not just leave with `_unused` rename)
- Remove `author_teacher_id` direct-ownership reads (everything goes through `class_members`)
- Update all 6 registries (schema, api, ai-call-sites, feature-flags, vendors, WIRING)
- Update ADR-003; write ADR-011 (school entity + governance), ADR-012 (audit log), ADR-013 (API versioning convention)
- Update `data-classification-taxonomy.md` for new tables
- **RLS-no-policy documentation (audit F12):** for the 7 tables flagged by `scan-rls-coverage.py`, either add explicit deny-all policies OR write `docs/security/rls-deny-all.md` documenting intent + service-role access paths. Update scanner to zero out the drift report.
- **Decision on 3-Matts merge (audit F26 / multi-Matt prod data):** Matt manually decides whether to merge his three teacher rows into one canonical account. If yes, write the merge migration. If no, document the per-account separation in `docs/security/multi-account-pattern.md`.
- **API versioning rename pass (per §3 item 38):** rename all 388 existing unversioned routes to `/api/v1/*` (`/api/teacher/*` → `/api/v1/teacher/*`, etc.). Add legacy-redirect aliases on the old paths with a 90-day expiry comment. Update `api-registry.yaml` accordingly. ~1 focused day; one find-replace PR with full test sweep. Skip if Matt elects to defer (not ideal but defensible if the rename feels too big to absorb pre-pilot).
- Tag pilot baseline as `v0.x-pilot1` so rollback is one git tag away.
- **Checkpoint A7 — PILOT-READY signoff:** no legacy code paths remain; all registries pass `saveme` cleanly; no tests skipped; production cutover plan written; second-school onboarding unblocked; tagged baseline ready; `/api/v1/` rename complete with legacy aliases live. **Pair with §12 parallel-track closure for full pilot GO.**

---

## 5. Migration Strategy

- **All migrations idempotent + rollback-safe.** Pattern: each phase's migrations include a `down` script tested in the sandbox before forward apply.
- **Backfills run in dry-run first**, with row-count assertions, before mutating prod.
- **No new migration touches an unrelated table.** One concern per migration file.
- **Feature flags gate every user-visible change**: `auth.oauth_google_enabled`, `auth.email_password_enabled`, etc. Default `false`. Flip per-school after smoke verifies.
- **Production cutover is per-phase, not big-bang.** Phase 0 schema → Phase 1 auth unify → Phase 2 OAuth → etc. Each can sit live for days before the next ships.
- **Migration discipline v2 — TIMESTAMP PREFIXES (added 28 Apr 2026).** New migrations use `YYYYMMDDHHMMSS_descriptor.sql` format, not 3-digit numbers. Mint with `bash scripts/migrations/new-migration.sh <descriptor>`. **Claim immediately**: commit + push the empty stub to the feature branch BEFORE writing the SQL body — reserves the timestamp on origin in seconds, not days. **Pre-merge gate**: `bash scripts/migrations/verify-no-collision.sh` runs before every merge. Wire into every Matt Checkpoint that includes migration work. See `questerra/CLAUDE.md` → "Migration discipline (v2)" for the full ritual.
- **Compute headroom is real (28 Apr 2026):** Matt upgraded Supabase from free → Pro Small. No more 7-day idle pause. Schema migrations + backfills (especially Phase 0's polymorphic `school_resources` + `class_members` rebuild + Phase 1's auth.users backfill) won't be IO-throttled.
- **🚦 Pilot freeze policy (audit F39, post-Phase-6 only):** Path B ships every phase before any student logs in, so the freeze policy does NOT apply during v2 development. It activates the moment Checkpoint A7 signs off and the pilot baseline is tagged. From that point: **no production deploys during NIS class hours** (school day Nanjing time, ~07:00–17:00 CST). Bug-fix-during-pilot work happens in feature branches; merges to main during evening freeze windows only. Security hotfixes are exempt but require a written justification in the changelog before deploy. Rationale: a platform with live students is a platform where each commit is an opportunity for regression that interrupts teaching. (Under Path A this freeze would have applied during Phase 2/3/4/5b development; Path B avoids that complexity entirely.)

---

## 6. Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Student session cookies break during Phase 1 cutover | Medium | Dual-read window: new helper falls back to legacy token reader for one release. Drop in Phase 5. |
| China classes accidentally get OAuth options exposed | Low | Per-class allowlist defaults to `['classcode']` for any class in `region='china'`. Auth-mode UI hidden when only one option. |
| Backfill creates duplicate `auth.users` rows | Low | Idempotent backfill keyed on `students.id`. Pre-flight scan reports duplicates before any mutation. |
| Apple Developer account delays Phase 2 | Medium | Apple OAuth gated behind feature flag. Phase 2 ships Google + Microsoft + email/PW first; Apple lands when account ready. |
| Per-student AI budget triggers false positives in classroom use | Medium | Budget defaults sized at 10× normal-day usage; school-level override; teacher-visible budget exhaustion warning before hard cap. |
| Audit log table grows unbounded | Low (long-term) | Partition by month from day one; archival cron deferred to Phase 4 follow-up. |
| Permission helper misses a route, granting incorrect access | High | Per-phase WIRING audit + `scan-api-routes.py` cross-check; route inventory diffed before every checkpoint. |
| Rogue teacher spams low-stakes settings changes to disrupt school | Low | Per-teacher rate limit on `school_setting_changes` (e.g. 10/hr); revert button visible to all teachers; audit log names + shames; bootstrap grace cannot be extended. |
| High-stakes change expires without confirm, losing legitimate intent | Medium | Pending-change banner pinned on every teacher's dashboard in that school; 24h-remaining email nudge; re-submit is one click. |
| Duplicate schools created despite 4-layer dedup | Medium | Merge queue exposed to Matt; 90-day redirect after merge; admin merge action cascades `school_id` across all FK references with transaction. |
| **Multi-Matt-teacher-account prod data (28 Apr 2026)** — three teacher rows for "Matt" in prod (`0f610a0b mattburto@gmail.com`, `e59fb92f hello@loominary.org`, `27818389 mattburton@nanjing-school.com`) plus one system row (`3ac01f99 system@studioloom.internal`). Students are `author_teacher_id`-linked; classes are `teacher_id`-linked similarly. | High (prod) | Phase 0 backfill MUST NOT silently merge teacher rows with the same display name. Each existing teacher row gets its own personal `school_id`. Matt manually decides whether to merge his three accounts as a Phase 6 cutover step (or keep them separate). Add an explicit "duplicate-name detection" check to Phase 0 backfill that lists candidates without acting. |
| **Bus factor of one (audit F26, HIGH)** — solo developer, no on-call rotation, no documented succession path. If Matt is unreachable for 24h+ during the pilot, response time is undefined. | High (operational) | (a) Document the constraint in the NIS pilot agreement: "operated by a solo developer; expected response within X business hours." (b) Configure Vercel status page so school can see uptime. (c) Store break-glass credentials in a school-accessible 1Password vault. (d) Plan to add a second on-call before any second-school deployment. Pre-pilot prerequisite, not a blocker for v2 development itself. |
| ~~High-velocity development during pilot window (audit F39, MEDIUM)~~ — **REMOVED under Path B.** Phase 2/3/4 ship before pilot, so no in-flight v2 dev competes with live teaching. Pilot-time risk reduces to bug fixes only, governed by the post-Phase-6 freeze policy (§5). | n/a | n/a — Path B eliminates this risk class. Resurfaces if pilot starts and Phase 7+ work begins concurrently; defer that decision until pilot is running. |
| **Phase 5a audit log instrumentation misses a route** — a state-mutating endpoint forgets `logAuditEvent()`, so admin queries return false negatives. | Medium | Wrapper applied via API middleware where possible; `scan-api-routes.py` extended to flag any POST/PATCH/DELETE/PUT route that doesn't import `logAuditEvent`. CI gate: empty diff required. Manual audit at Checkpoint A3-pilot. |
| **MFA enrollment locks a teacher out (audit F6 fallout)** — TOTP device lost or new teacher can't enroll, blocks pilot start. | Medium | Documented MFA reset procedure (currently undefined — write before pilot). Backup codes generated at enrollment. Platform-admin (Matt) holds reset capability via Supabase service role. |

---

## 7. Resolved Decisions (signed off by Matt 25 April 2026)

1. **Apple OAuth:** SKIP in v1. Gated behind feature flag `auth.oauth_apple_enabled` (default `false`). Phase 2 ships Google + Microsoft + email/PW only. Add Apple when first iOS-native school asks; the $99/yr Apple Developer account isn't worth the spend pre-customer.
2. **School entity:** AUTO-CREATE personal school per teacher during Phase 0 backfill. Every teacher gets `school_id` populated from day one. UX flow to "claim" / "join" a real school added in a later phase or follow-up — not in scope here.
3. **Data export format:** JSON ONLY in v1. CSV / PDF added when a real GDPR or FERPA request asks for it.
4. **Audit log retention:** FOREVER in v1. Partition by month from day one for query performance. Revisit retention policy when storage cost matters or legal counsel weighs in.
5. **Per-student AI budget:** TOKEN COUNT, default **100,000 tokens/day/student**. School-level override via `schools.default_student_ai_budget`. Teacher-visible exhaustion warning surfaces in class hub before hard cap. Reset rolls over at midnight in school's local timezone.
6. **Co-teacher permissions:** FULL EDIT in v1 (matches real school co-teaching workflows). Suggest-only mode added if/when a school requests it.
7. **Timing:** ~~START AFTER Preflight Phase 8 ships~~ → **TRIGGER MET 28 Apr 2026 PM.** Preflight Phase 8 trilogy + 8-4 paths 1+2 all SHIPPED + merged to main + verified end-to-end in prod (full smoke + multi-teacher flat-school-membership smoke across 3 NIS personas). Phase 8's `current_teacher_school_id()` helper + school-scoped RLS pattern actually paved the road for v2 — Phase 0 inherits a working flat-school-membership precedent rather than inventing it. Phase 0 ready to begin per Path A (§1.5).
8. **School governance model:** FLAT membership (no `school_admin` role, no designated admin). Two-tier change rules: low-stakes apply instantly with 7-day revert; high-stakes require a 2nd teacher's confirm within 48h or expire. Single-teacher schools have 7-day bootstrap grace. Platform super-admin view (Matt) sits on a separate `is_platform_admin` flag. Full spec in §8.

---

## 8. School Settings & Governance

### 8.1 What lives at school level

**School-owned (single source of truth):**
- **Identity:** name, logo, region, country, address, default timezone
- **Academic calendar:** terms, holidays *(migrates up from current teacher-level — the School Calendar / Term System shipped 21 Mar 2026 goes school-scoped)*
- **Timetable skeleton:** day cycle (A/B weeks), periods, bell times *(TimetableGrid work from 22 Mar becomes a school-level template with per-class overrides)*
- **Frameworks in use:** multi-select (MYP + GCSE combo is common); default grading scale per framework
- **Preflight stack:** `fabrication_labs` (unblocks `PH6-FU-MULTI-LAB-SCOPING`), machines, fabricator roster, scanner rule ack defaults, filename conventions, pickup SLAs
- **Auth policy:** which modes allowed per school (OAuth / email / classcode+name), required SSO domains if any
- **AI policy:** default per-student daily token budget (overrides global 100k default), allowed providers
- **Notification branding:** sender name, reply-to, footer text
- **Safeguarding contacts:** emails that receive audit-log alerts
- **Content sharing policy:** can teachers see each other's units + knowledge base by default?

**Teacher-owned but visible school-wide:**
- Units (browseable via School Library, forkable into any teacher's class)
- Classes + rosters (read-only view for other teachers in the same school)

### 8.2 Registration — preventing duplicate schools

Four-layer dedup strategy, in order of leverage:

1. **Curated directory seed.** Pre-populate `schools` with ~5–10k entries from IB World Schools registry, major GCSE/DfE schools, ACARA-listed AU schools, common US independent schools. Each seeded row marked `verified = true`. Teachers search and pick.
2. **Domain-based auto-suggest on signup.** New `school_domains (school_id, domain)` table. A teacher signing up with `@nis.org.cn` auto-matches Nanjing International School if the domain is on file. Biggest single dedup lever — teacher can override but default is "use match."
3. **Fuzzy-match gate on "Create new school".** Before creating, run trigram + tsvector similarity against existing schools. If similarity > 0.7, show "Did you mean: *existing match*?" with side-by-side compare. Teacher must explicitly dismiss before creating.
4. **Merge queue.** If duplicates still slip through, any teacher in either school can flag "this is the same school" via `school_merge_requests`. Matt approves in the platform super-admin panel. Post-merge, all `school_id` references redirect via a redirect table for 90 days.

### 8.3 Governance model — flat, no designated admin

Every teacher with `school_id = X` is a full member of school X. No admin sub-role. Changes to school settings are governed by a **two-tier rule keyed to the change itself, not to the actor:**

**Low-stakes (instant apply, audit-logged, 7-day revert):**
- Term dates, holidays, bell times, period names
- Machine list additions, scanner rule toggles, ack defaults
- Lab hours, pickup SLAs, fabricator invites
- Notification footer text, framework list edits
- Content sharing defaults, AI budget default (within sensible bounds)

**High-stakes (require a 2nd teacher's confirm within 48h, or the change expires):**
- School name, logo, region, country change
- Removing a teacher from the school
- Deleting a lab or machine with historical fabrication jobs
- Auth policy changes (disabling a mode, adding SSO requirement)
- Mass-delete of student data or audit log truncation
- Approving a school merge

**Implementation:**
- New table `school_setting_changes (id, school_id, actor_id, change_type, tier, payload_jsonb, applied_at, confirmed_by, reverted_at, expires_at, created_at)`
- Low-stakes: insert with `applied_at = now()`, expose revert button for 7 days
- High-stakes: insert with `applied_at = NULL`, expose to all school teachers as "pending — confirm or expires in 48h"; on second-teacher confirm, flip `applied_at`; on expiry, mark expired (cron)
- Every change (low or high tier) emits an `audit_events` row
- School settings page shows a live activity feed: *"Bob updated period bells 2h ago — revert"*, *"Pending: Alice wants to rename the school → confirm / dismiss (expires 40h)"*

**Bootstrap edge case:** the first teacher at a new school has nobody to confirm with. They get a **7-day grace window** (`schools.bootstrap_expires_at`) where high-stakes changes are single-teacher. Once a second teacher joins, the 2-teacher rule activates permanently — the column is set to `now()` on the 2nd teacher's insert.

**Why this works:** removes "who manages the admin?" entirely. Avoids a separate school-admin login. Matches how real faculty rooms collaborate — with a paper trail. Social pressure from the audit feed + revert button + pending banner beats hierarchy for a teacher-run system. Every decision is traceable.

### 8.4 Platform super-admin view (Matt only)

`/admin/school/[id]` page gated on `auth.users.is_platform_admin` — Matt's view into any school. **Not exposed to teachers.** Contents:
- Teachers list: all school members, last-active timestamp, class counts
- Fabricators list: roster + machine access + Preflight activity
- Settings snapshot: current state + 30-day change history
- Audit log feed: filtered to `school_id = X`
- Merge request controls: approve / reject / merge with transaction across all FK references
- Impersonate-as-teacher button (read-only view) for support

Teachers see their own school at `/school/[id]/settings` with the governance UI from §8.3.

### 8.5 Migration of existing school-level settings

Several things currently teacher-scoped should bubble up. Phase 4 migration handles:
- **Academic calendar** — currently per-teacher. Bubble up to school. On migration, if multiple teachers in the same (auto-created) school have conflicting calendars, keep the most-recently-edited and notify the others.
- **Preflight labs + machines** — currently seeded globally. Re-scope per school during Phase 4; existing seeded machines stay available as templates but each school owns its own copy.
- **Framework defaults** — currently per-class. School gets a default list; class inherits unless overridden.

### 8.6 Forward-compatibility seams (schema in Phase 0, features later)

These six additions are pure schema in Phase 0 — no UX, no business logic. Each unblocks a future feature without forcing a future migration. The cost is a handful of empty tables and columns; the benefit is that every one of these features becomes additive, not architectural.

**1. Generic `school_resources` polymorphic pattern (Matt's library + future collections)**

The Service/PYP "people, places, things" library Matt described isn't a one-off — it's the first instance of a school-scoped content collection pattern. Future instances likely include: alumni directory, partner organizations, shared rubric bank, school media asset library, guest-speaker roster, exemplar archive.

```
school_resources (
  id uuid pk,
  school_id uuid fk schools.id,
  resource_type text,           -- 'person' | 'place' | 'thing' | 'organization' | extensible
  name text,
  summary text,
  details_jsonb jsonb,           -- type-specific fields (e.g. address for places, expertise for people)
  contact_info_jsonb jsonb,      -- ENCRYPTED at rest, gated read permission
  tags text[],
  visibility text,               -- 'school' | 'class' | 'private'
  class_id uuid nullable,        -- only when visibility='class'
  added_by uuid fk auth.users.id,
  verified_by_teacher_id uuid nullable,
  verified_at timestamptz nullable,
  consent_status text,           -- 'pending' | 'granted' | 'revoked' | 'expired'
  last_verified_at timestamptz nullable,
  deleted_at timestamptz nullable,
  created_at timestamptz default now()
)

school_resource_relations (
  id uuid pk,
  from_resource_id uuid fk school_resources.id,
  to_resource_id uuid fk school_resources.id,
  relation_type text,            -- 'works_at' | 'located_at' | 'partners_with' | extensible
  notes text,
  created_at timestamptz default now()
)
```

**Tiered read permission:** name + summary + tags + visibility = visible to all in scope. `contact_info_jsonb` revealed only on explicit "I'm contacting them" click, the click logs an `audit_events` row. This is the primary privacy control for external humans appearing in the database.

**2. Guardians relational model**

```
guardians (id, school_id, name, email, phone, relationship_type, deleted_at, created_at)
student_guardians (student_id, guardian_id, is_primary, receives_reports, created_at)
```

No UI in v1. Schema unblocks future parent comms, report sharing, parent-portal SSO, emergency contact retrieval. Email/phone encrypted at rest like `school_resources.contact_info_jsonb`.

**3. SIS external ID columns — reality check (28 April 2026 pre-flight)**

The seam ALREADY EXISTS in mig 005_lms_integration.sql with different naming than this plan originally called for:

| What v2 plan said | What mig 005 actually shipped |
|---|---|
| `students.sis_source` | `students.external_provider` |
| `students.external_id` | `students.external_id` ✓ |
| `classes.sis_source` | `classes.external_provider` |
| `classes.external_id` | `classes.external_class_id` |
| `classes.last_synced_at` | `classes.last_synced_at` ✓ |
| `teachers.{sis_source,external_id,last_synced_at}` | not added — `teachers` uses separate `teacher_integrations` table for API tokens |

The seam is real, just under different names. Renaming touches every reader of the LMS integration code path (currently quarantined behind unused `teacher_integrations` flow). **Decision 28 Apr PM:** keep mig 005's names for v2; canonicalise to `sis_source` / `external_id` in Phase 6 cutover audit OR a post-pilot follow-up, whichever surfaces a real reason to break things. The forward-compat goal is achieved as-is — a future sync job reads `WHERE external_provider = 'managebac' AND last_synced_at < NOW() - interval '1 day'` instead of the originally-planned `sis_source` filter, and that's fine.

**Why not rename now:** Lesson #44 (simplicity first — no speculative refactors) and Lesson #45 (surgical changes — touch only what each sub-task names). Renaming a year-old column to satisfy a forward-compat plan is the kind of yak-shave the methodology explicitly warns against. The seam works.

**4. Consent tracking model**

```
consents (
  id uuid pk,
  subject_id uuid,               -- student_id, teacher_id, guardian_id, or community_member_id
  subject_type text,
  consent_type text,             -- 'media_release' | 'ai_usage' | 'directory_visibility' | 'community_resource_contact' | 'third_party_share' | extensible
  basis text,                    -- 'opt_in' | 'opt_out' | 'parental' | 'institutional'
  granted_at timestamptz nullable,
  granted_by uuid fk auth.users.id,
  revoked_at timestamptz nullable,
  revoked_by uuid fk auth.users.id nullable,
  scope_jsonb jsonb,             -- e.g. specific class_id / project_id / time-bound
  created_at timestamptz default now()
)
```

Schools set regional defaults driven by `schools.region` — EU defaults to opt-in, US opt-out, China strict. Individuals can override. UX surfaces in Phase 5 alongside the privacy export/delete endpoints; schema lands in Phase 0 so historical consent state is recordable from day one.

**5. School lifecycle status**

`schools.status` enum: `active` (default) | `dormant` (no teachers active in 90+ days) | `archived` (school closed, data retained read-only) | `merged_into` (during 90-day post-merge redirect window). Routes check `status = 'active'` before allowing writes. Cron downgrades `active → dormant` after inactivity. Manual transition for `archived` and `merged_into`. Covers teacher turnover, school closure, the merge redirect already planned in §8.2 layer 4.

**6. Monetisation tier seam (forward-compat for `monetisation.md`)**

```
schools (existing — adds one column in Phase 0):
  + subscription_tier text NOT NULL DEFAULT 'pilot'
    CHECK (subscription_tier IN ('pilot','free','starter','pro','school'))
```

Three concrete touchpoints, all opt-in for monetisation to drive later:

- **Permission helper hook (Phase 3):** `can(actor, action, resource, { requiresTier? })` accepts an optional tier gate. If supplied, `can()` looks up `school.subscription_tier` and short-circuits to `false` when the tier isn't in the allowed set. Default behaviour unchanged — most v2-internal `can()` calls don't use it. `monetisation.md` opts in per gated feature.
- **AI budget cascade (Phase 5):** the resolver reads tier as the topmost default ceiling (e.g. `pilot/free → 50k`, `starter → 75k`, `pro → 100k`, `school → 200k`; numbers configurable in `admin_settings`). Per-school / per-student / per-class overrides still win. This means changing the free-tier ceiling is a config change, not a backfill.
- **Audit log tier tag:** every `audit_events` row records `school_subscription_tier_at_event` so monetisation analytics can later answer "what did pro-tier users do that free-tier users didn't?" without re-deriving from join history.

What v2 deliberately does NOT build:
- Stripe integration / billing UI / invoicing / dunning / plan upgrade or downgrade flows / coupon codes / trial expiry / payment-failed lockouts / receipts. All of those live in `monetisation.md`.
- The actual list of which features are tier-gated. v2 ships the seam; monetisation decides which `can()` calls get a `requiresTier` argument and which features bump the cascade lookup.
- Tier UI (the "you've hit your free-plan limit" upsell card). Built in monetisation.md after seams are live.

The seam adds ~1–2 hours of work spread across Phases 0/3/5. The cost of NOT adding it now is touching every `can()` call, every AI budget resolver, and possibly every audit-log producer when monetisation lands — exactly the retrofitting we avoid for `school_resources`, `guardians`, `consents`, and the others above.

### 8.7 External community member access (future — explore later)

The Service/PYP `school_resources` library will surface real humans — community partners, guest speakers, NGO mentors. A natural follow-up is letting those external people log in to a limited surface: *"I'm a guest speaker, I want to comment on these 3 students' work"* or *"I'm a community partner mentoring this Service project, show me the milestone updates."*

**Out of scope for v1.** The auth foundation in this project should not block it. Notes for the future build:

- New `user_type = 'community_member'` value on `auth.users.user_type`. The unified session helper from Decision 1 already covers this — no new auth path, just a new role.
- **Invite-only signup.** A teacher invites from a `school_resources.resource_type = 'person'` entry. Invite generates a single-use token + email with a magic link or simple "set password" page. Argon2id like the Fabricator flow from Phase 1B-2.
- **Time-bounded permissions.** Access tied to a specific `class_id` or project, with `expires_at` on the membership row. Defaults to end-of-semester. Auto-revoke on expiry.
- **Privacy-scoped views.** Community members see only what the inviting teacher explicitly shares — typically a project landing page, milestone updates, designated student work for review. They are NOT in the school's safeguarding regime in the same way teachers are: no audit-log alert subscription, no platform-wide visibility, no other-class visibility.
- **Class-member role extension.** `class_members.role` extended with `community_member` value, designed extensible in Phase 3 so this lands as a config change, not a schema migration.
- **Consent + identity verification.** Inviting teacher confirms the community member's consent to be on the platform (one-click affirmation logged in `consents`). For under-18 community members (rare but possible — student peer reviewers from another school), additional guardian consent path required.
- **No teacher-equivalent privileges.** Community members cannot create classes, invite other users, see other students, or access AI tools beyond comment-on-work scope. This is deliberately the simplest possible "external collaborator" model — sufficient for guest-speaker, mentor, partner-organization use cases. Anything more complex (full B2B partner portal, alumni network with social features, parent-volunteer coordinator) is a separate future project.

This appendix is a placeholder so the Phase 3 / Phase 4 work doesn't accidentally close off the seam.

**First concrete consumer (tracked in [ALL-PROJECTS.md](ALL-PROJECTS.md) → High Priority Ideas):**

> **Mentor Manager (PYP / G5 / Service Learning)** — Annual mentor recruitment + matching for PYP Exhibition coordinators, G5 teachers, and Service Learning leads. Mentor roster lives as `school_resources` rows (`resource_type = 'person'`); `details_jsonb` carries expertise areas, availability, language. Bulk invite + intake survey + AI-assisted student matching + light-weight mentor login for comment-on-work and milestone updates. This is the first feature that proves both §8.6 and §8.7 carry their weight.

Estimated 4–6 days to build *after* access-model-v2 ships. Tracking this as the canonical "did the seams work?" validation.

---

## 9. Impact on Existing Systems (per WIRING.yaml)

Systems touched (incomplete — full audit before Phase 0):
- `auth-system` — major rewrite; ADR-003 revision
- `student-progress` — soft-delete + `unit_version_id` columns
- `class-management` — `class_members` replaces `author_teacher_id`
- `fabrication-pipeline` — student session resolution touches `/api/student/fabrication/*` routes (~24 endpoints from Phase 5–7); lab + machine + fabricator scoping moves under school; unblocks `PH6-FU-MULTI-LAB-SCOPING`
- `nm-assessment` — `class_id` resolution under new model (resolves FU-N follow-up cleanly)
- `student-content-moderation-log` — actor_id semantics change (resolves FU-GG-style "system" sentinel issues)
- `ingestion-pipeline` — actor_id for FU-KK pattern issue
- `school-calendar` — calendar bubbles up from teacher-level to school-level (Phase 4 migration)
- All routes in `api-registry.yaml` reading student session (~80+ endpoints, full audit during Phase 1)

**New systems created:**
- `school-governance` — two-tier change engine, pending-confirm queue, bootstrap grace, audit feed
- `school-registration` — curated directory, domain auto-suggest, fuzzy-match, merge queue
- `school-library` — read-only cross-teacher unit browse within a school
- `platform-admin-console` — Matt's super-admin view gated on `is_platform_admin`

**New tables (Phase 0 + 4):**
- **Core:** `schools`, `school_domains`, `school_merge_requests`, `school_setting_changes`, `class_members`, `audit_events`, `ai_budgets`
- **Forward-compat (schema-only in Phase 0, see §8.6):** `school_resources`, `school_resource_relations`, `guardians`, `student_guardians`, `consents`

**New columns on existing tables:**
- `teachers.locale TEXT NOT NULL DEFAULT 'en'`, `students.locale TEXT NOT NULL DEFAULT 'en'` (Phase 0.2 — locale forward-compat)
- ~~`students`, `teachers`, `classes`: `external_id`, `sis_source`, `last_synced_at`~~ — already in mig 005 under different names; canonicalisation deferred to Phase 6 (see §3 item #26 + §8.6 item 3)
- All user-touched tables: `deleted_at` (soft delete)
- Submission-shaped tables: `unit_version_id`
- `auth.users`: `user_type` (extensible enum), `is_platform_admin` (boolean)
- `schools`: `status` (lifecycle enum), `region`, `bootstrap_expires_at`

---

## 10. Pre-Build Checklist (before Phase 0 brief)

1. ✅ Matt signed off on plan + 8 decisions resolved (25 Apr 2026 — see §7)
2. ✅ Parallel-session context integrated 28 Apr 2026 (multi-class fixes on `main`, support_settings cascade pattern, verifyTeacherCanManageStudent base rule, multi-Matt prod data, migration discipline v2, Supabase Pro Small upgrade, class-architecture-cleanup project filed)
3. ✅ Preflight Phase 8 trilogy + 8-4 SHIPPED 28 Apr (trigger condition for Path A met)
4. ✅ IT security audit reviewed 28 Apr (`studioloom-it-audit-2026-04-28.docx`); v2 plan restructured for **Path B** (chosen 28 Apr PM) with 7 audit-derived deliverables added (MFA, RLS test harness, ENCRYPTION_KEY rotation, retention cron, RLS-no-policy docs, multi-Matt audit, unknown-auth triage)
5. ✅ class-architecture-cleanup §1 (archived class auto-unenroll trigger + backfill) shipped — mig `20260428081225`
6. **Reconcile `docs/projects/fu-p-access-model-v2-plan.md`** — superseded by Phase 8 implementation + this plan. Mark with header banner "SUPERSEDED — see access-model-v2.md" or move to `docs/archive/`. Migration 117's comment ("FU-P-2 will rewrite RLS") needs updating to point here.
7. Read `docs/build-methodology.md` end-to-end
8. Read ADR-003 (`../Loominary/docs/adr/003-auth-model.md`) — confirm what's changing
9. Read Lessons Learned #29 (UNION pattern), #54 (PostgREST FK ambiguity), and **#60 (side-findings inside touched code belong in the same commit, not "follow-up later")**
10. Read `src/lib/auth/verify-teacher-unit.ts` and `src/lib/student-support/resolve-class-id.ts` end-to-end before designing `getStudentSession()` / `can()` helpers — both prefigure the unified-session pattern; integrate them rather than rebuild
11. Read `src/lib/fabrication/lab-orchestration.ts` for the Phase 8 school-scoped pattern (`loadTeacherSchoolId`, `loadSchoolOwnedLab`, cross-school → 404). Mirror this pattern for any new school-scoped resources.
12. Run `python3 scripts/registry/scan-api-routes.py --apply` to capture baseline route inventory (will diff against post-Phase 6)
13. Run `python3 scripts/registry/scan-rls-coverage.py` to capture baseline RLS coverage
14. **Audit existing teacher rows for duplicate display names** — query `SELECT id, display_name, name, email, created_at FROM teachers ORDER BY name, created_at`. Surface 3-Matts and any other duplicate-name candidates. Decide before Phase 0 backfill whether merges happen (Phase 6) or each teacher gets a separate personal school.
15. **Identify the 8 unknown-auth routes (audit F10):** `grep "auth: unknown" docs/api-registry.yaml` and review each before Phase 0 → fold the classifications into Phase 0's pre-flight ritual.
16. Create new worktree `/Users/matt/CWORK/questerra-access-v2` on branch `access-model-v2`
17. Open the new worktree's `npm test` baseline; capture count (currently 2433 on main per Preflight Phase 8 close)
18. Use `build-phase-prep` skill to write the Phase 0 brief — explicitly include the 5 audit-derived deliverables (MFA enable, RLS test harness, ENCRYPTION_KEY rotation script, unknown-auth triage, multi-Matt audit) as named sub-tasks with their own checkpoint criteria.

---

## 11. References

- **`/Users/matt/CWORK/questerra/studioloom-it-audit-2026-04-28.docx`** — IT security/privacy/operational audit (28 Apr 2026, "skeptical school IT director" framing). 28 findings across 10 domains, 8 pilot blockers, 12 pre-pilot conditions, 11 ongoing conditions. v2 named as critical path for findings F22 (audit log), F32 (data export/erasure), F7 (auth unification), F5 (SSO timeline). This plan's §1.5 Path A is the audit's recommended sequencing.
- **`docs/projects/preflight-audit-28-apr.md`** — internal Preflight audit, 12 findings, all closed in-session. Established the school-scoped RLS pattern + 4-HIGH cross-tenant leak class that v2's `class_members` + `getActorSession()` work prevents recurring.
- **`docs/projects/fu-p-access-model-v2-plan.md`** — SUPERSEDED 28 Apr 2026 by this plan. Was drafted 25 Apr in parallel with `access-model-v2.md`; contradicts the flat-school-membership model that Phase 8 actually shipped. Reconciliation: mark with superseded banner or archive.
- **`docs/projects/class-architecture-cleanup.md`** — companion follow-up project (4 gaps from Phase 2.5 multi-class smoke). §1 (archived auto-unenroll) SHIPPED 28 Apr (mig `20260428081225`). §2 (`student_progress.class_id`) decision pending. §3 (cohort label) decision pending. §4 (Option B URL-scoped classId) deferred until AFTER Access v2.
- **`docs/projects/monetisation.md`** — separate project (status: IDEA). Defines 4-tier model (Free / Starter / Professional / School). Access v2 ships three forward-compat seams in §8.6 item 6 (subscription_tier column, `can()` tier hook, AI budget tier default) so monetisation can land additively. v2 does NOT build Stripe, billing UI, or plan upgrade flows.
- Backlog items collapsed into this project: FU-O, FU-P, FU-R, FU-Q, FU-W. (`PH6-FU-MULTI-LAB-SCOPING` no longer waiting on this — absorbed into Preflight Phase 8.)
- `docs/build-methodology.md` — phase discipline
- `../Loominary/docs/adr/003-auth-model.md` — current auth ADR (will be revised)
- `../Loominary/docs/os/master-architecture.md` — tenant boundary alignment
- `docs/lessons-learned.md` Lesson #29 (UNION pattern, NULL class_id safety) · Lesson #54 (PostgREST FK ambiguity) · **Lesson #60 (side-findings in same commit)**
- `docs/projects/preflight-phase-1b-2-brief.md` — Fabricator auth pattern (reference for opaque session tokens)
- **Existing helpers to integrate (28 Apr 2026):** `src/lib/auth/verify-teacher-unit.ts` (`requireTeacherAuth`, `verifyTeacherCanManageStudent`), `src/lib/student-support/resolve-class-id.ts` (`resolveStudentClassId`, `filterOutArchivedClasses`), `src/app/api/student/me/unit-context/route.ts` (URL-aware class context), `src/app/api/auth/student-session/route.ts` (deterministic session-default selection), `src/lib/fabrication/lab-orchestration.ts` (`loadTeacherSchoolId`, `loadSchoolOwnedLab` — Phase 8 school-scoped pattern), `current_teacher_school_id()` SECURITY DEFINER helper (Phase 8, prod)
- **Phase 2.5 cascade precedent (28 Apr 2026 commits e52105a + 1406e6c):** `support_settings` JSONB cascade pattern (school default → student override → class override) — Decision 6 follows this for AI budget config
- `docs/data-classification-taxonomy.md` — will need new entries for `class_members`, `audit_events`, `ai_budgets`, `ai_budget_state`, `school_resources`, `school_resource_relations`, `guardians`, `student_guardians`, `consents`, `school_domains`, `school_merge_requests`, `school_setting_changes`. (`schools` already classified.)
- `docs/api-registry.yaml`, `docs/schema-registry.yaml` — diff baseline before Phase 0

---

## 12. Parallel Pilot-Readiness Track (NOT v2 work, but pilot-blocking)

The 28 Apr IT audit identified 12 pre-pilot conditions. Of these, **2 are inside v2** (audit log F22 → Phase 5; data export F32 → Phase 5). The remaining **10 run as a parallel non-code track** owned outside the v2 scope but blocking pilot start.

**Path B timing:** these run in parallel with v2 development OR after v2 ships, whichever Matt prefers. They DON'T gate v2 phases — v2 can ship Phase 0–6 without any of them — but they DO gate the moment the first NIS student logs in. DPA signatures and China network testing involve real-world wait times (legal turnaround, IT scheduling), so kicking some off early during Phase 1 or 2 is sensible. Privacy policy + ToS are easier to write once the audit log + retention cron actually exist (Phase 5 onward).

This track is listed here for visibility — not done by the v2 worktree, but tracked alongside so pilot-readiness is evaluated holistically at Checkpoint A7 + parallel-track closure.

### Pilot blockers (must close before first NIS student logs in)

| # | Audit ref | Item | Owner | Effort | v2 dependency |
|---|---|---|---|---|---|
| 1 | F1 | Sign DPAs with Anthropic (incl. ZDR addendum), Supabase, Voyage AI, Vercel, Sentry, Resend, ElevenLabs (9 vendors). File PDFs in `docs/legal/dpa/`. Update `vendors.yaml` with signed dates. | Matt | 2–5 days (mostly waiting on signatures) | none |
| 2 | F2 | Publish Data Processing Notice at `studioloom.org/privacy`. One-page parent-readable diagram of sub-processors, data categories, retention horizons, parental consent path, DSR mechanism. Source from `vendors.yaml` + `data-classification-taxonomy.md`. | Matt | 2 days | none |
| 3 | F3 | Anthropic ZDR addendum (separate signature from DPA). Drops conversation retention from 30 days to abuse-review only. | Matt | bundled with #1 | none |
| 4 | F31 | Privacy policy + Terms of Service pages at `studioloom.org/privacy`, `/terms`. 8th-grade reading level. Generated from same registries as #2. | Matt | 1 day after #2 | none |
| 5 | F27 | China network test from NIS school WiFi: studioloom.org reachable, Design Assistant turn completes, latency under 5s, error rate under 5% over 24h. Document arrangement (proxy / VPN / leased line). PIPL Article 38 cross-border-transfer assessment. | Matt + NIS IT | 1 day testing + N days arranging | none |
| 6 | F23 | Incident response runbook at `docs/security/incident-response.md`. Categories (key leak / RLS bypass / vendor breach / abuse incident), school notification timeline (GDPR 72h, PIPL immediate), escalation, take-platform-offline procedure, comms template. | Matt | 1 day | none |
| 7 | F33 | Parental consent forms (paper). Per-student. Discloses Anthropic US transfer specifically. Filed with school. | Matt + NIS | depends on school | F1, F31 |
| 8 | F26 | Two-engineer break-glass plan documented. Where credentials live (1Password Family share with NIS admin), out-of-hours contact, platform-down procedure. Pilot agreement language acknowledging solo-developer constraint. | Matt | 0.5 day | none |
| 9 | (audit pre-condition) | Status page configured (Vercel ships one). NIS sees uptime in real time. | Matt | 0.5 day | none |

**Total non-v2 pilot-readiness effort:** ~8–11 days plus signature/network arrangement waits.

### Pilot is GO when

- All 9 parallel-track items above closed
- v2 Phases 0–6 complete and signed off (Checkpoint A7)
- Smoke run on staging passes end-to-end with audit log producing rows for every mutation
- Retention cron green-lit on test data
- Pilot baseline tagged `v0.x-pilot1`
- Pilot freeze policy activates from this moment

### Ongoing conditions (close during pilot or before second-school onboarding — see audit §6 for full list)

External pentest, Dependabot + npm audit + Semgrep CI, API rate limiting, staging Supabase project, bucket lifecycle policy, quarterly sub-processor list publication, DR exercise, second engineer. Most of v2's audit-derived items (retention cron, RLS-no-policy docs, MFA, RLS test harness) ship inside v2 phases under Path B, not after — so the post-pilot list is shorter than under Path A.

