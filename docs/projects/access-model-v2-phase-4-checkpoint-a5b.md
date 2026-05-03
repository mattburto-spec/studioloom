# Checkpoint A5b — Phase 4 Part 2 Close

**Status:** ✅ PASS — signed off 3 May 2026 PM. Merge-to-main in progress.
**Phase:** Access Model v2 Phase 4 part 2 (sub-phases 4.5 / 4.7 / 4.7b / 4.6 / 4.8 / 4.8b / 4.9)
**Predecessor:** Checkpoint A5a (shipped 2 May 2026 — covered 4.0 → 4.4d)
**Branch:** `access-model-v2-phase-4-part-2`
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**Drafted:** 3 May 2026 PM

---

## 1. Sub-phases shipped

| Sub-phase | Status | Migration | Apply | Smoke | Commit |
|---|---|---|---|---|---|
| 4.5 school_merge_requests + cascade | ✅ | 1 | applied | ✓ | `f864172` |
| 4.7 super-admin /admin/school/[id] + view-as | ✅ | 0 (app-only) | n/a | ✓ via UI | `d0d8035` |
| 4.7 hotfix — classes.is_archived not deleted_at | ✅ | 0 | n/a | ✓ | `ea2cf6e` |
| 4.7b-0 NIS tier flip (ops) | ✅ | n/a (data) | done | ✓ | n/a |
| 4.7b-1 school_admin role + INSERT-policy | ✅ | 1 | applied | ✓ | `0b756b3` |
| 4.7b-2 invite flow + auto-join dismantle | ✅ | 1 | applied | ✓ | `8fe3a77` |
| 4.7b-3 tier-gate 4 RLS leak surfaces | ✅ | 1 | applied | ✓ | `0380102` |
| 4.6 school library + request-to-use | ✅ | 1 | applied | ✓ | `f177ce9` |
| 4.8 settings bubble-up columns | ✅ | 1 | applied | ✓ | `57f001c` |
| 4.8b freemium-build seam bake-in | ✅ | 1 | applied | ✓ | `ef7ca66` |
| 4.9 dept_head triggers | ✅ | 1 | **applied** | **pending** | `1177cdf` |

**Total: 11 commits + 8 migrations applied to prod + 1 ops change (NIS tier flip).** Phase 4 part 1 had 47 commits + 7 migrations; part 2 closes with 11 commits + 8 migrations.

---

## 2. Code-level criteria

### NEW tables
- [x] `school_merge_requests` — Phase 4.5 (12 cols + RLS + 3 indexes)
- [x] `school_invitations` — Phase 4.7b-2 (12 cols + RLS + 3 indexes)
- [x] `unit_use_requests` — Phase 4.6 (13 cols + RLS + 4 indexes)

### NEW columns
- [x] `schools.merged_into_id` (Phase 4.5)
- [x] `schools.academic_calendar_jsonb` + 7 sibling settings cols (Phase 4.8)
- [x] `schools.stripe_customer_id` (Phase 4.8b)
- [x] `teachers.subscription_tier` + `teachers.stripe_customer_id` (Phase 4.8b)
- [x] `teacher_access_requests.school_id` FK (Phase 4.7b-2)
- [x] `classes.department` (Phase 4.9)
- [x] `class_members.source` (Phase 4.9)
- [x] `school_responsibilities.department` (Phase 4.9)
- [x] `units.forked_from_author_id` (Phase 4.6)

### NEW SECURITY DEFINER helpers
- [x] `is_school_admin(user, school)` — 4.7b-1
- [x] `can_grant_school_admin(user, school)` — 4.7b-1
- [x] `current_teacher_school_tier_school_id()` — 4.7b-3
- [x] `lookup_school_by_domain(domain)` extended to return tier — 4.7b-2
- [x] 4 dept_head triggers — 4.9

All locked search_path per Lesson #66. All REVOKE FROM PUBLIC + GRANT TO authenticated/service_role per Lesson #64.

### NEW TS modules
- [x] `src/lib/access-v2/governance/school-merge.ts` (cascade + audit per table) — 4.5
- [x] `src/lib/access-v2/school/invitations.ts` (token + lifecycle) — 4.7b-2
- [x] `src/lib/access-v2/school/unit-use-requests.ts` (request/approve/deny/withdraw + fork) — 4.6
- [x] `src/lib/access-v2/school/calendar.ts` (3-layer read-precedence) — 4.8
- [x] `src/lib/access-v2/plan-gates.ts` (pass-through helpers) — 4.8b
- [x] `src/lib/auth/require-platform-admin.ts` — 4.7
- [x] `src/lib/auth/impersonation.ts` (HMAC-SHA256 view-as token) — 4.7

### NEW pages
- [x] `/admin/schools` (replaced stub with real super-admin directory) — 4.7
- [x] `/admin/school/[id]` (super-admin detail bundle) — 4.7
- [x] `/school/[id]/library` (browse + request-use compose drawer) — 4.6
- [x] `/teacher/notifications/use-requests` (inbox + outbox) — 4.6

### NEW routes (15+)
| Route | Method | Phase |
|---|---|---|
| `/api/admin/schools` (replaced) | GET | 4.7 |
| `/api/admin/school/[id]` | GET | 4.7 |
| `/api/admin/school/[id]/impersonate` | POST | 4.7 |
| `/api/admin/school/[id]/merge-requests` | GET | 4.5 |
| `/api/admin/school/[id]/merge-requests/[mergeId]/approve` | POST | 4.5 |
| `/api/admin/school/[id]/merge-requests/[mergeId]/reject` | POST | 4.5 |
| `/api/school/[id]/merge-requests` | POST | 4.5 |
| `/api/school/[id]/invitations` | POST/GET | 4.7b-2 |
| `/api/school/[id]/invitations/[inviteId]/revoke` | POST | 4.7b-2 |
| `/api/school/[id]/library` | GET | 4.6 |
| `/api/school/[id]/library/[unitId]/request-use` | POST | 4.6 |
| `/api/auth/accept-school-invitation` | POST | 4.7b-2 |
| `/api/teacher/welcome/request-school-access` | POST | 4.7b-2 |
| `/api/teacher/me/unit-use-requests` | GET | 4.6 |
| `/api/teacher/me/unit-use-requests/[requestId]/{approve,deny,withdraw}` | POST × 3 | 4.6 |

### Welcome wizard updates
- [x] Tier-aware domain-match banner (school-tier → "ask IT to invite you"; others → existing auto-join legacy) — 4.7b-2
- [x] Auto-join code-path NOT yet fully dismantled — pilot/starter tier still allows auto-join (legacy seed schools). Will retire when all seed schools tier-flip. **NOT a checkpoint blocker.**

### Middleware
- [x] View-as mutation gate: any request with `?as_token=` + non-GET/HEAD method returns 403 — 4.7

---

## 3. Test count

| Sub-phase | New tests | Cumulative |
|---|---|---|
| Baseline (start of part 2) | — | 3189 |
| 4.5 school-merge | +25 | 3214 |
| 4.7 impersonation | +16 | 3230 |
| 4.7b-1 can.ts school_admin branch | +7 | 3237 |
| 4.7b-2 invitations | +22 | 3259 |
| 4.7b-3 tier-gate (RLS-only) | 0 | 3259 |
| 4.6 unit-use-requests | +16 | 3275 |
| 4.8 calendar helper | +11 | 3286 |
| 4.8b plan-gates | +5 | 3291 |
| 4.9 dept_head triggers (RLS-only) | 0 | 3291 |
| **Final** | **+102** | **3291 passing / 11 skipped** |

tsc strict: 0 errors throughout. No regressions.

---

## 4. Migrations applied to prod

| Timestamp | Description | Applied | Smoke |
|---|---|---|---|
| 20260502210353 | phase_4_5_school_merge_requests | ✓ | ✓ |
| 20260502215604 | phase_4_7b_1_school_admin_role | ✓ | ✓ |
| 20260502221646 | phase_4_7b_2_school_invitations | ✓ | ✓ |
| 20260502223059 | phase_4_7b_3_tier_gate_leak_surfaces | ✓ | ✓ |
| 20260502224119 | phase_4_6_unit_use_requests | ✓ | ✓ |
| 20260502230242 | phase_4_8_schools_settings_columns | ✓ | ✓ |
| 20260502231455 | phase_4_8b_freemium_seams | ✓ | ✓ |
| 20260502233618 | phase_4_9_dept_head_triggers | ✓ | ✓ (4 triggers verified end-to-end via UPDATE → resync → revoke flow) |

**Plus 1 ops change**: NIS `subscription_tier` flipped `'pilot'` → `'school'` (Phase 4.7b-0 prerequisite).

`bash scripts/migrations/verify-no-collision.sh` runs clean against `origin/main`.

---

## 5. Decisions made during execution

| Decision | Rationale |
|---|---|
| **Cascade list grew 12 → 15 tables (Phase 4.5)** | Brief was paper-only on the cascade target list. Pre-flight grep caught Preflight surfaces (machine_profiles, fabrication_jobs, fabrication_labs, fabricators) + guardians as additional tables with school_id FK. Audit-derived 15-table cascade. Lesson #54 + #59 in action. |
| **`units.forked_from_unit_id` reused existing `units.forked_from` column (Phase 4.6)** | Brief specced a NEW `forked_from_unit_id` column. Grep found mig 007 already added `units.forked_from` UUID with same semantic. Migration only adds the missing `forked_from_author_id`. Lesson #54 + #59 again. |
| **`teachers.school_profile` JSONB skipped as backfill source (Phase 4.8)** | Brief specced backfill from `teachers.school_profile.{periodLength,bellTimes,frameworks}`. Pre-flight grep: column does not exist. Only `school_calendar_terms` has real backfill data. Lesson #54 + #59 (3rd time). |
| **`class_members.source` column added in Phase 4.9** | Brief specced INSERT INTO class_members with `source = 'auto_dept_head'` assuming column existed. It didn't. Migration adds it. Lesson #54 + #59 (4th time — note for next phase: schedule a brief-vs-schema audit pass at the START of any Phase 5+ work). |
| **`requires_plan` field schema-only on feature-flags.yaml (Phase 4.8b)** | Decided to ship the field definition + 1 exemplar annotation rather than annotate all 15 flags. Per-flag tier requires PRODUCT decisions about the tier-feature matrix. FU-FREEMIUM-FLAGS-PLAN-ANNOTATION P3 filed. |
| **Gmail-Matt detached from NIS (Phase 4.7b-0 supplemental)** | Audit query revealed Gmail-Matt was attached to NIS school_id from the three-Matts consolidation. Per master-spec separation invariant ("Admin = Gmail-Matt; Teacher = NIS-Matt; pure separation"), set Gmail-Matt's school_id=NULL. Cleaner state for 4.7b-3 leak-surface gating tests. |
| **`teacher_access_requests` (mig 089) extended with school_id FK (Phase 4.7b-2)** | CWORK Q4 audit caught: brief assumed mig 089 had invite-flow infra. It's a waitlist (TEXT `school` field, no FK / no token). New `school_invitations` table added; existing 089 extended with `school_id` FK for the request-access flow. |
| **Library tier-gate is implicit (Phase 4.6)** | Audit insight: under tier-aware membership, free/pro teachers are alone in personal schools. The existing `WHERE school_id = my_school` filter naturally returns the right set per tier. NO new RLS gate needed for library browse. The membership model does the work. |
| **`starter` tier kept dormant** | 5-tier enum stays (pilot/free/starter/pro/school). v1 only uses pilot/free/pro/school. Collapsing `starter` would force a CHECK migration on the immutable audit_events log. Defer to post-pilot cleanup. Per Gemini Q6 + CWORK Q6 review. |

---

## 6. Open follow-ups (filed during Phase 4 part 2)

| FU | Priority | Description |
|---|---|---|
| FU-FREEMIUM-CAN-PATTERN-ADR | P3 | Write ADR-014: all plan-aware gating goes through `can(...)` with `requiresTier:` |
| FU-FREEMIUM-CALLSITE-PLAN-AUDIT | P3 | Grep `subscription_tier` outside canonical readers; refactor or exempt |
| FU-FREEMIUM-SCHOOL-DOWNGRADE-OWNERSHIP | P2 | Design school→free downgrade split flow (post-real-downgrade case) |
| FU-WELCOME-WIZARD-STUDENT-EMAIL-GUARD | P2 | Student `@school-domain` emails can teacher-signup; needs role gate |
| FU-AV2-IMPERSONATION-RENDER-WIRING | P3 | Teacher pages don't yet render-as target teacher when as_token present |
| FU-AV2-TEACHER-DIRECTORY-ROUTE-GATE | P3 | Route-level tier check on /school/[id]/settings teacher list |
| FU-FREEMIUM-FLAGS-PLAN-ANNOTATION | P3 | Annotate remaining 14 feature-flags with `requires_plan` |
| FU-AV2-DEPT-HEAD-UI | P2 | Settings Section J + RoleChip variant + dept picker + admin Roles tab |
| FU-AV2-DEPT-BACKFILL-FROM-NAME | P3 | Extend backfill to fall back to `classes.name` when `subject` is NULL (NIS surfaced this) |

**Total: 9 new FUs filed during part 2.** None are checkpoint blockers; all have clear "done when" criteria + target gates.

### FUs CLOSED during part 2
- FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL → ✅ closed by Phase 4.9 (data model + triggers)

---

## 7. Lessons applied + lessons surfaced

### Applied this phase
- **Lesson #54** (registries can lie) — caught 4 brief-vs-schema gaps before they bit at apply time
- **Lesson #59** (estimates can lie when audit hasn't happened) — same as above; pre-flight saved each sub-phase from a "huh, this column doesn't exist" surprise
- **Lesson #64** (cross-table RLS subqueries silently recurse) — every new SECURITY DEFINER helper uses the pattern correctly
- **Lesson #66** (SECURITY DEFINER + locked search_path) — every new helper has `SET search_path = public, pg_temp`
- **Lesson #38** (verify expected values, not just non-null) — sanity DO-blocks assert specific column / policy / helper presence, not just count

### Candidate new lesson (4 strikes warrants escalation)
- **Lesson #67 (proposed)**: Brief-vs-schema audit at the START of every phase, not at the START of each sub-phase. Phase 4 part 2 caught the same pattern of "brief specced a column that doesn't exist" in 4 different sub-phases (4.5 cascade list / 4.6 forked_from / 4.8 school_profile / 4.9 class_members.source). Each catch added 5-15 minutes of audit + decision time at sub-phase start. A 30-minute brief-vs-schema pass at phase start would've caught all 4 in one batch + saved time. Filing as recommended addition to Lesson #54.

---

## 8. A5b sign-off criteria

Phase 4 part 2 closes when ALL pass:

### Code
- [x] All 8 migrations + 11 commits shipped to feature branch
- [x] tsc strict 0 errors
- [x] 3291 tests passing, 11 skipped, 0 regressions
- [x] All NEW tables have RLS + policies (verified by `scan-rls-coverage.py`)
- [x] Phase 4.9 smoke (4 trigger scenarios) — 3 May PM

### Migrations
- [x] 8 migrations applied to prod in timestamp order
- [x] All sanity DO-blocks fired correctly at apply time (no exceptions)
- [x] `verify-no-collision.sh` clean against `origin/main`

### Smoke
- [x] 4.5 school-merge schema sanity + CHECK + unique-pending + 90-day chain
- [x] 4.7b-1 school_admin grant via INSERT policy + helper returns
- [x] 4.7b-2 invitations schema + CHECK + unique-active + lifecycle
- [x] 4.7b-3 tier-gate helper returns + 4 policies use it
- [x] 4.6 library + request-to-use schema + CHECK + unique-pending + lifecycle
- [x] 4.8 schools settings columns + backfill + content_sharing default + AI budget CHECK
- [x] 4.8b teachers.subscription_tier + stripe_customer_id × 2 + unique-when-set
- [x] 4.9 dept_head trigger end-to-end — set 2 NIS classes to design_tech → resync trigger auto-added 2 class_members rows; flipped 1 to mathematics → resync removed obsolete tag; soft-deleted responsibility → all auto-tags removed; cleanup clean

### Documentation
- [x] This A5b doc finalised + linked from brief
- [x] `docs/changelog.md` session entry written
- [x] Forward-looking handoff written for Phase 5 (audit log + AI budget)

### Operational
- [x] NIS flipped to `'school'` tier
- [x] Gmail-Matt detached from NIS (`school_id = NULL`)
- [x] NIS-Matt manually granted `school_admin` (id `fa8b1cd1...`)
- [x] Active sessions row updated for next session (Phase 5 prep)

---

## 9. Merge-to-main plan

When all "PENDING" items above resolve:

1. Final tsc + npm test + scanner pass
2. `bash scripts/migrations/verify-no-collision.sh`
3. Cut throwaway worktree at main, fast-forward merge `access-model-v2-phase-4-part-2`
4. Push main
5. Verify Vercel prod redeploys + smoke `/admin/schools` + `/school/<NIS>/settings` + `/school/<NIS>/library`
6. Tag baseline `v0.4-phase-4-closed`
7. Update `.active-sessions.txt`
8. Cleanup feature branches: keep `access-model-v2-phase-4-part-2` as record; delete throwaway worktree

---

## 10. What comes next

**Phase 5 — Privacy & Compliance** (~3 days per master spec):
- Audit log infrastructure (`logAuditEvent()` wrapper into every mutation route + CI gate)
- Per-student AI budget middleware (4-layer cascade: tier default → school → class → student)
- Data export endpoint (JSON dump, RLS-checked)
- Data delete endpoint (soft + 30-day hard cron)
- Retention enforcement cron from `data-classification-taxonomy.md`
- Cost-alert pipeline live test + Sentry PII scrub verification
- Checkpoint A6

**Phase 6 — Cutover & Cleanup** (~2-3 days, before pilot):
- Deprecate legacy student token system
- Remove `author_teacher_id` direct-ownership reads (everything via `class_members`)
- Update all 6 registries
- ADRs: update 003, write 011 (school+governance), 012 (audit log), 013 (API versioning)
- `/api/v1/*` rename pass with 90-day legacy aliases
- Tag pilot baseline `v0.x-pilot1`
- Checkpoint A7 PILOT-READY

**Estimate to PILOT-READY: ~5-6 days** of focused build (Phase 5 + Phase 6).

---

**Awaiting:** Phase 4.9 smoke + sign-off → merge to main.
