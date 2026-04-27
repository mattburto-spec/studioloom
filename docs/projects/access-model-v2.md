# Project: Access Model v2 — Auth Unification, Multi-Tenancy & Privacy Foundation

**Created:** 25 April 2026
**Status:** DESIGN PHASE — plan signed off by Matt 25 April 2026; all 7 open questions resolved (see §7). **Waiting on Preflight Phase 8 ship + merge to main before Phase 0 begins.**
**Priority:** P1 — gates school-level deployments, paid customer onboarding, and `PH6-FU-MULTI-LAB-SCOPING`
**Estimated effort:** 16–22 days across 6 phases
**Worktree (when work begins):** new worktree `/Users/matt/CWORK/questerra-access-v2` on branch `access-model-v2`. Do **not** mix with `preflight-active` or `dashboard-v2-build` — surface area is too large.
**Dependencies blocked by this:**
- `PH6-FU-MULTI-LAB-SCOPING` P2 (needs school/lab role scoping)
- FU-O / FU-P / FU-R (collapsed into this project)
- FU-Q (dual student identity unification)
- FU-W (no audit log)
- All paying-school-customer onboarding

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

## 2. Architecture Decisions

### Decision 1: Every student is an `auth.users` row from day one
The classcode+name path becomes a **custom Supabase auth flow**, not a parallel session system. Server-side, the route mints a Supabase session (custom JWT or admin-created user) tied to a student record. Cookie shape converges with teacher cookies.

**Why:** A single session-resolution helper (`getStudentSession()`) replaces three. Eliminates the class of bugs around CDN + Cache-Control + cookie stripping (Lesson #29 area). RLS policies stop branching on auth-type.

**Alternative rejected:** Dual-auth (nullable `auth_user_id`) is simpler short-term but permanently bifurcates RLS, session middleware, and every student-touched route. Not world-class.

### Decision 2: School/Organization is a first-class entity, governed without a designated admin
New `schools` table. `teachers.school_id`, `students.school_id`, `classes.school_id` (where applicable) all populate. Every existing teacher gets a personal school during backfill — no NULL `school_id` ever.

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

### Decision 6: Per-student AI budgets are enforced at the route layer
New `ai_budgets` table (`student_id`, `daily_token_cap`, `tokens_used_today`, `reset_at`). Middleware on every AI route checks before invocation. School-level override at `schools.default_student_ai_budget`.

**Why:** A single stuck loop or abuse vector becomes real money fast. Trivial to build now; surgery to retrofit during a real incident.

### Decision 7: Roles are explicit at class level, flat at school level
New `class_members` table replacing the current `author_teacher_id` direct ownership. Class-level roles: `lead_teacher`, `co_teacher`, `dept_head`, `lab_tech`, `observer`. **School-level membership is flat** — every teacher with `school_id = X` is a full member of school X, no sub-roles. Permissions resolved through a single `can(actor, action, resource)` helper.

**Why:** Co-teaching is the most common school-procurement question. Hardcoded `author_teacher_id` is the FU-O blocker. Flat school membership (no `school_admin` role) pairs with Decision 2 and §8 to eliminate the admin-management problem.

**Platform admin (Matt) is separate:** `is_platform_admin` flag on `auth.users` gates the super-admin view at `/admin/school/[id]`. This is Matt's view into any school. Not a school-level role.

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
26. **Forward-compat schema only:** SIS integration columns `external_id`, `sis_source`, `last_synced_at` on students, teachers, classes — unblocks future Google / Microsoft / PowerSchool / ManageBac roster sync without rewrite (see §8.6)
27. **Forward-compat schema only:** `consents` table tracking per-subject opt-ins (media release, AI usage, directory visibility, community contact, third-party share) — required for FERPA / GDPR / PIPL; UX wired in Phase 5 alongside privacy endpoints (see §8.6)
28. **Forward-compat schema only:** `schools.status` lifecycle enum (`active` / `dormant` / `archived` / `merged_into`) — covers teacher turnover, school closure, post-merge redirect window (see §8.6)

### Explicitly NOT in scope (deferred)
- Teacher MFA — Supabase has it built in; toggle when first paying school asks
- Regional Supabase project splits — `region` column is the only forward-prep
- Immutable submission snapshot reconstruction UI — only the `unit_version_id` reference is shipped here
- SSO via SAML — wait for a school that actually asks
- Audit log retention policies / export tooling — basic logging ships; tooling is later
- `PH6-FU-MULTI-LAB-SCOPING` itself — unblocked by this but built separately
- **External community member auth** — invite + simple login for guest speakers, community partners, NGO mentors surfaced via the Service/PYP library. Schema seam designed (`auth.users.user_type` extensible enum + `class_members` role enum extensible). Full flow explored later (see §8.7)
- **School Resources Library UI** — Matt's people / places / things browse experience for Service/PYP students. Schema lands in Phase 0; the browse UI, search, filtering, contact-reveal flow, and student-facing card/list views are a separate future project that builds on the schema seam
- **Parent portal UI, SIS roster sync code, alumni directory UI** — schema seams ship; user-facing features are separate future projects

---

## 4. Phase Plan

Each phase ends with a named Matt Checkpoint. No phase begins until the previous one is signed off. Detailed phase briefs written via `build-phase-prep` skill once Matt approves this plan.

### Phase 0 — Foundation Schema (~3 days)
- **Core access tables:** `schools` (incl. `status`, `region`, `bootstrap_expires_at` columns), `class_members`, `audit_events`, `ai_budgets`
- **Forward-compat tables (schema only, no UX wiring):** `school_resources`, `school_resource_relations`, `guardians`, `student_guardians`, `consents`
- **Column additions:** soft-delete (`deleted_at`) on every user-touched table; `unit_version_id` on submission-shaped tables; SIS forward-compat (`external_id`, `sis_source`, `last_synced_at`) on students / teachers / classes
- **User type extensibility:** `auth.users.user_type` enum starting with `student | teacher | fabricator | platform_admin` — designed extensible for future `community_member` (§8.7) and `guardian` without migration
- **Backfill:** every teacher → personal school; every existing class membership → `class_members.lead_teacher`; soft-delete columns default `NULL`; SIS columns default `NULL`
- No app-code changes yet — pure schema + scaffolding
- **Checkpoint A1:** schema verified against schema-registry; backfill verified row-counts; RLS policies pass `scan-rls-coverage.py`; forward-compat tables exist with empty rows + working FKs; no app regressions

### Phase 1 — Auth Unification (~3 days)
- Custom Supabase auth flow for classcode+name (server-side mints session)
- Backfill: every existing student → `auth.users` row (idempotent, dry-run first)
- `getStudentSession()` / `getActorSession()` helpers
- Migrate every student-facing route to the unified helper (touch every middleware, every cookie reader)
- **Checkpoint A2:** all existing student flows work end-to-end; no route still reads the legacy token shape directly; RLS on student-touched tables simplified

### Phase 2 — OAuth + Email/Password (~3 days)
- Google OAuth (Supabase dashboard config + callback route)
- Microsoft (Azure AD) OAuth
- Apple OAuth (incl. $99/yr Apple Developer prereq + bundle config) — gate behind feature flag if Apple Dev account not ready
- Email/password flow for students + teachers
- Per-class auth-mode allowlist UI (teacher add-student page)
- Per-school auth-mode default
- **Checkpoint A3:** all 4 providers work; China-locked class cannot offer OAuth/email options in UI; teacher invite flow exercises every path

### Phase 3 — Class Roles & Permissions (~3 days)
- `can(actor, action, resource)` permission helper
- `class_members` table with class-level roles (lead_teacher, co_teacher, dept_head, lab_tech, observer)
- Co-teacher invite flow + UI
- Migrate every `author_teacher_id` check to the permission helper
- **Checkpoint A4:** co-teacher can edit a class they're invited to; dept head sees all classes in department; permission helper covers all routes per WIRING audit

### Phase 4 — School Registration, Settings & Governance (~3 days)
- Seed `schools` from curated directory (IB / GCSE / ACARA / US independent)
- `school_domains` table + domain-based auto-suggest on teacher signup
- Fuzzy-match gate on "create new school" (trigram + tsvector)
- `school_merge_requests` + platform-admin merge approval flow + 90-day redirect
- `/school/[id]/settings` page — all school-owned fields (see §8.1)
- `school_setting_changes` governance engine: tier classification, instant-apply for low-stakes, pending-confirm for high-stakes, 48h expiry
- Bootstrap grace window (`schools.bootstrap_expires_at`, 7 days for single-teacher schools)
- School activity feed + 7-day revert UI for low-stakes; pending-confirm banner for high-stakes
- School Library browse view (read-only units from same-school teachers)
- Platform super-admin view at `/admin/school/[id]` gated on `is_platform_admin`
- Migrate scattered school-level settings up (academic calendar from teachers; Preflight labs/machines scoped properly)
- **Checkpoint A5:** new teacher signs up → domain suggests real school → joins → sees existing settings; low-stakes change applies instantly + revertable by another teacher; high-stakes change waits for 2nd confirm; bootstrap grace verified on a fresh single-teacher school

### Phase 5 — Privacy & Compliance (~2–3 days)
- `audit_events` insert wired into every mutation route
- Per-student AI budget middleware (100k tokens/day default per §7 decision 5)
- `GET /api/student/[id]/export` (JSON dump of all student-owned data, RLS-checked)
- `DELETE /api/student/[id]` soft-delete + 30-day hard-delete cron
- `GET /api/teacher/students/[id]/audit-log` (teacher view of student's actions)
- **Checkpoint A6:** export verified for a real student record; delete verified to soft → hard cascade in test; AI budget triggers on synthetic abuse run

### Phase 6 — Cutover & Cleanup (~2 days)
- Deprecate legacy student token system (delete dead code, not just leave with `_unused` rename)
- Remove `author_teacher_id` direct-ownership reads (everything goes through `class_members`)
- Update all 6 registries (schema, api, ai-call-sites, feature-flags, vendors, WIRING)
- Update ADR-003; write ADR-011 (school entity + governance), ADR-012 (audit log)
- Update `data-classification-taxonomy.md` for new tables
- **Checkpoint A7:** no legacy code paths remain; all registries pass `saveme` cleanly; no tests skipped; production cutover plan written

---

## 5. Migration Strategy

- **All migrations idempotent + rollback-safe.** Pattern: each phase's migrations include a `down` script tested in the sandbox before forward apply.
- **Backfills run in dry-run first**, with row-count assertions, before mutating prod.
- **No new migration touches an unrelated table.** One concern per migration file.
- **Feature flags gate every user-visible change**: `auth.oauth_google_enabled`, `auth.email_password_enabled`, etc. Default `false`. Flip per-school after smoke verifies.
- **Production cutover is per-phase, not big-bang.** Phase 0 schema → Phase 1 auth unify → Phase 2 OAuth → etc. Each can sit live for days before the next ships.

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

---

## 7. Resolved Decisions (signed off by Matt 25 April 2026)

1. **Apple OAuth:** SKIP in v1. Gated behind feature flag `auth.oauth_apple_enabled` (default `false`). Phase 2 ships Google + Microsoft + email/PW only. Add Apple when first iOS-native school asks; the $99/yr Apple Developer account isn't worth the spend pre-customer.
2. **School entity:** AUTO-CREATE personal school per teacher during Phase 0 backfill. Every teacher gets `school_id` populated from day one. UX flow to "claim" / "join" a real school added in a later phase or follow-up — not in scope here.
3. **Data export format:** JSON ONLY in v1. CSV / PDF added when a real GDPR or FERPA request asks for it.
4. **Audit log retention:** FOREVER in v1. Partition by month from day one for query performance. Revisit retention policy when storage cost matters or legal counsel weighs in.
5. **Per-student AI budget:** TOKEN COUNT, default **100,000 tokens/day/student**. School-level override via `schools.default_student_ai_budget`. Teacher-visible exhaustion warning surfaces in class hub before hard cap. Reset rolls over at midnight in school's local timezone.
6. **Co-teacher permissions:** FULL EDIT in v1 (matches real school co-teaching workflows). Suggest-only mode added if/when a school requests it.
7. **Timing:** START AFTER Preflight Phase 8 ships + merges to main, AND after dashboard-v2 polish wraps to a quiescent state. Reason: this project touches every student route — running parallel to Preflight (which is also rewiring student/fabrication routes) guarantees merge pain. Estimated wait ~1–2 weeks. **Trigger to begin Phase 0:** main branch is clean of `preflight-active` + `dashboard-v2-build`, all checkpoints signed off, all migrations applied to prod.
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

These five additions are pure schema in Phase 0 — no UX, no business logic. Each unblocks a future feature without forcing a future migration. The cost is a handful of empty tables and columns; the benefit is that every one of these features becomes additive, not architectural.

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

**3. SIS external ID columns**

On students, teachers, and classes:
- `external_id text nullable` — the ID from whatever SIS the school uses
- `sis_source text nullable` — `'manual'` (default) | `'google'` | `'microsoft'` | `'powerschool'` | `'managebac'` | `'veracross'` | extensible
- `last_synced_at timestamptz nullable`

Without these columns, future roster sync from a school's existing SIS becomes a rewrite of every user-shaped table. With them, integration is additive — a sync job can read `WHERE sis_source = 'managebac' AND last_synced_at < NOW() - interval '1 day'` and update.

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
- `students`, `teachers`, `classes`: `external_id`, `sis_source`, `last_synced_at` (SIS forward-compat)
- All user-touched tables: `deleted_at` (soft delete)
- Submission-shaped tables: `unit_version_id`
- `auth.users`: `user_type` (extensible enum), `is_platform_admin` (boolean)
- `schools`: `status` (lifecycle enum), `region`, `bootstrap_expires_at`

---

## 10. Pre-Build Checklist (before Phase 0 brief)

1. ✅ Matt signed off on plan + 8 decisions resolved (25 Apr 2026 — see §7)
2. Confirm trigger conditions met: Preflight Phase 8 shipped + merged + migrations applied to prod; dashboard-v2 polish quiescent
3. Read `docs/build-methodology.md` end-to-end
4. Read ADR-003 (`../Loominary/docs/adr/003-auth-model.md`) — confirm what's changing
5. Read Lessons Learned #29 (UNION pattern) and any auth/cookie-related lessons
6. Run `scan-api-routes.py` to capture baseline route inventory (will diff against post-Phase 5)
7. Run `scan-rls-coverage.py` to capture baseline RLS coverage
8. Create new worktree `/Users/matt/CWORK/questerra-access-v2` on branch `access-model-v2`
9. Open the new worktree's `npm test` baseline; capture count
10. Use `build-phase-prep` skill to write the Phase 0 brief

---

## 11. References

- Backlog items collapsed into this project: FU-O, FU-P, FU-R, FU-Q, FU-W (and unblocks `PH6-FU-MULTI-LAB-SCOPING`)
- `docs/build-methodology.md` — phase discipline
- `../Loominary/docs/adr/003-auth-model.md` — current auth ADR (will be revised)
- `../Loominary/docs/os/master-architecture.md` — tenant boundary alignment
- `docs/lessons-learned.md` Lesson #29 — UNION pattern, NULL class_id safety
- `docs/projects/preflight-phase-1b-2-brief.md` — Fabricator auth pattern (reference for opaque session tokens)
- `docs/data-classification-taxonomy.md` — will need new entries for `schools`, `class_members`, `audit_events`, `ai_budgets`
- `docs/api-registry.yaml`, `docs/schema-registry.yaml` — diff baseline before Phase 0
