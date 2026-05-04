# Access Model v2 — Phase 5 (Privacy & Compliance) — Brief

**Status:** READY — §3.8 decisions resolved 3 May 2026 PM. §5.0 may begin.
**Drafted:** 3 May 2026 PM CST
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**Branch:** `access-model-v2-phase-5` (cut from `main` at tag `v0.4-phase-4-closed`, commit `62c8ba1`)
**Predecessor:** Checkpoint A5b (PASS — Phase 4 part 2 close, 3 May 2026 AM)
**Successor checkpoint:** **A6** (Privacy & Compliance signed off → unblocks Phase 6 cutover)
**Master spec:** [`docs/projects/access-model-v2.md`](access-model-v2.md) §4 Phase 5 (lines 267–276) + Decisions 3, 4, 6 + §3 items 33–35 + §6 risks + §12 parallel-track
**Estimate:** ~3 days per master spec; **revised after audit to ~4–4.5 days** (Lesson #59; +0.6d for Q2 3-mode failure + Q5 `scheduled_deletions` table + Q6 budget-coverage scanner extension).

---

## 1. Goal

Wire the privacy + compliance infrastructure into the live route layer. The schema (Phase 0.7a + 0.7b shipped 28 Apr) and the supporting tables (cost-alert, Sentry, admin_audit_log, schools.default_student_ai_budget) are in prod. Phase 5 is the **wiring + new endpoints + cron + verification** phase — not a new-tables phase.

When this phase closes:

1. **Every state-mutating route** (POST / PATCH / DELETE / PUT) calls `logAuditEvent()` exactly once per successful mutation, and `scan-api-routes.py` enforces this as a CI gate.
2. **Every student-facing AI route** routes its call through `withAIBudget(studentId, fn)` — cascade-resolved tier-aware cap (tier default → school override → class override → student override), atomic increment via `ai_budget_state`, soft warning at 80% → hard block at 100%, reset at midnight in `schools.timezone`.
3. **Data subject endpoints** exist — `GET /api/v1/student/[id]/export` returns a single JSON dump of all student-owned data (FERPA / GDPR / PIPL "right to access"), `DELETE /api/v1/student/[id]` soft-deletes the student and queues hard-delete for 30 days later.
4. **Retention enforcement cron** at `scripts/ops/run-retention-enforcement.ts` reads `data-classification-taxonomy.md` `retention_days` per column, soft-deletes past horizon, hard-deletes past `retention_days + 30`, logs every action to `audit_events`.
5. **Manual SQL data export runbook** at `docs/security/student-data-export-runbook.md` exists as the audit-F32 stopgap (in case the endpoint isn't ready for the first DSR).
6. **Teacher view of a student's audit log** at `GET /api/v1/teacher/students/[id]/audit-log` works (RLS-checked).
7. **Cost-alert pipeline** verified live (set threshold to $0.01, trigger AI call, confirm Resend delivery within 5 min). Documented at `docs/security/cost-alert-fire-drill.md`.
8. **Sentry PII scrubbing** verified in dashboard (screenshot to `docs/security/sentry-pii-scrub-2026-05.png`, quarterly schedule documented).

### Why now

- Path B (master spec §1.5) ships every phase before any pilot student logs in. Audit log + retention cron + DSR endpoints must exist before the first NIS student touches the platform — IT audit F19 (retention) + F22 (audit log) + F32 (export runbook) are all promoted to v2-internal under Path B.
- Phase 4's 9 direct `db.from('audit_events').insert(...)` callsites (school-merge cascade, impersonation, accept-invitation, classcode-login, request-school-access, invitation-revoke, school-changes-revert) are inconsistent shapes today. The `logAuditEvent()` wrapper retrofits them in one pass and unlocks the CI gate.
- IT audit F22 (audit log) named the missing instrumentation as a pilot blocker. Phase 5 closes it.

### Non-goals (explicitly out of scope this phase)

- **No new audit-log table.** `audit_events` (mig 20260428215923) is the table. Phase 5 wires it in. Partitioning by month is filed as **FU-AV2-AUDIT-EVENTS-PARTITION P3**, deferred until row count justifies (per master-spec Decision 4 amended). Do NOT add partitioning here.
- **No `admin_audit_log` migration.** The pre-existing log (mig 079) writes only `admin_settings` changes via `src/lib/admin/settings.ts:143`. Two parallel logs is fine for v2; consolidation is a Phase 6 cutover decision (FU-AV2-AUDIT-LOG-CONSOLIDATION, file as P3 if decision is to defer).
- **No RLS-no-policy doc work** for the 5 tables in `docs/scanner-reports/rls-coverage.json` (`admin_audit_log`, `ai_model_config`, `ai_model_config_history`, `fabricator_sessions`, `teacher_access_requests`). Phase 6 owns this per master-spec line 284.
- **No Stripe / billing UI / plan-upgrade flow.** AI budget tier defaults read from `admin_settings` keys (`ai.budget.tier_default.{free,starter,pro,school,pilot}`); no monetisation surface change.
- **No CSV / PDF export formats.** JSON only per Decision 3 (resolved 25 Apr). Add when a real DSR asks.
- **No DPA signing / privacy policy / China network test / parental consent forms.** Those are §12 parallel-track items, owned outside v2.
- **No new `/api/v1/*` rename pass.** Phase 5 ships its NEW routes under `/api/v1/...` per the API-versioning seam. Existing route renames are Phase 6 cutover.

---

## 2. Pre-flight ritual

Before touching any code:

- [x] **Working tree clean.** `git status` shows clean on `access-model-v2-phase-5` branch (cut from `v0.4-phase-4-closed`, HEAD `62c8ba1`).
- [x] **Baseline tests green.** `npm test` reports **3291 passed | 11 skipped (3302 total) across 205 test files** — verified 3 May 2026 PM on this branch.
- [ ] **Typecheck clean.** `npx tsc --noEmit --project tsconfig.check.json` exits 0 (verify before §4.0 ships).
- [x] **Active-sessions row claimed** — `/Users/matt/CWORK/.active-sessions.txt` row updated to this branch + this phase. Remove on phase close.
- [ ] **Re-read these Lessons** (numbered per `docs/lessons-learned.md`) before any sub-phase code:
  - **#29 (RLS policies must be updated when adding junction tables — they silently filter rows).** `audit_events` already has school-scoped read policies; verify the teacher-audit-log-view route returns the right set with RLS enabled.
  - **#34 (Test assumptions drift silently — run tests before any refactor session).** Lock baseline 3291 before §5.1 retrofits the 9 callsites; assert delta after each sub-phase.
  - **#38 (ADD COLUMN DEFAULT silently overrides subsequent conditional UPDATEs).** Phase 5 has zero new ADD-COLUMN steps; only matters if the §3.8 Q1 admin_settings seed migration uses INSERT ON CONFLICT — assert seeded values, not just non-null.
  - **#39 (Silent max_tokens truncation in tool_use calls drops required fields).** `withAIBudget()` increments by `usage.input_tokens + usage.output_tokens` from the response; verify the response was not silently truncated before counting (don't bill incomplete responses).
  - **#43 (Think before coding: surface assumptions, don't hide confusion).** §3.8 has 7 open questions — **STOP and report findings** before §5.0 starts.
  - **#44 (Simplicity first).** No abstract `AuditLogProvider` class. `logAuditEvent()` is a single async function with a typed payload object. No event-bus / queue. Direct insert via service-role client.
  - **#45 (Surgical changes — touch only what each sub-task names).** §5.1 retrofits 9 known callsites — does not "while I'm here" sweep for missing audit calls outside that list. The CI gate (5.1d) is what enforces completeness for the future.
  - **#54 (Registries can lie — audit by grep before trusting any system summary).** Spot-check performed in §3.7. **Lesson #67 (proposed during A5b)** — brief-vs-schema audit run at PHASE start, not sub-phase start. See §3.6.
  - **#59 (Brief estimates can lie when audit hasn't happened yet).** Phase 5 master-spec estimate of 3 days predates the audit; revised to ~3.5–4 days after counting 9 retrofit sites + audit-derived AI route enumeration + cron infrastructure setup.
  - **#60 (Side-findings discovered inside the code you're already touching belong in the same commit).** If §5.1 retrofit reveals a 10th audit_events.insert site outside the known 9, fix it in the same commit; if it reveals a missing audit_events.insert in a mutation route, file as the CI gate's first finding.
  - **#61 (Index predicates can't contain non-IMMUTABLE functions).** Retention cron's "rows past `retention_days`" query MUST run at execution time, not as an index predicate. The `created_at` b-tree on every target table satisfies the query plan.
  - **#64 (Cross-table RLS subqueries silently recurse — use SECURITY DEFINER).** New teacher-audit-log-view route: if its policy joins through `teachers` + `audit_events.school_id`, ensure the join goes through an existing SECURITY DEFINER helper (`current_teacher_school_id()`), not an inline subquery. Re-verify on apply.
  - **#65 (Old triggers don't know about new user types).** Phase 5 adds NO triggers. (If §3.8 Q3 resolves to "yes — a trigger on AI calls", this lesson re-activates.)
  - **#66 (SECURITY DEFINER function rewrites must re-apply search_path lockdown).** Phase 5 may add 1–2 SECURITY DEFINER helpers (`atomic_ai_budget_increment`, possibly the export-helper). Each ships with `SET search_path = public, pg_temp` and a sanity DO-block at apply time.
- [ ] **Read** the existing infrastructure FIRST (audit pre-empts surprises):
  - `supabase/migrations/20260428215923_class_members_and_audit_events.sql` — `audit_events` shape + indexes + 4 RLS policies (actor-self-read + school-teacher-read; INSERT/UPDATE/DELETE all deny-by-default — SELECT only).
  - `supabase/migrations/20260428220303_ai_budgets_and_state.sql` — `ai_budgets` (polymorphic subject) + `ai_budget_state` (per-student counter, `last_warning_sent_at` for nag throttle).
  - `src/lib/access-v2/governance/school-merge.ts` — 5 direct `audit_events.insert(...)` sites (per-table cascade audit + summary). The retrofit pattern lives here.
  - `src/app/api/auth/student-classcode-login/route.ts:114` — direct insert with try/catch warn-only fallback. The retrofit MUST preserve the "audit failure does not break login" semantic.
  - `src/lib/jobs/cost-alert.ts` + `scripts/ops/run-cost-alert.ts` — cron pattern Phase 5's retention cron mirrors.
  - `src/instrumentation.ts` + `src/instrumentation-client.ts` + `package.json` (`@sentry/nextjs 10.43.0`) — Sentry IS installed, scrubbing config TBD (see §3.5).
- [ ] **STOP and report findings.** Confirm with Matt the answers to §3.8 open questions before §4. Wait for explicit "go".

---

## 3. Audit — surface of this phase

Compiled 3 May 2026 PM. Numbers are exact unless marked approximate.

### 3.1 Schema seams already in prod (Phase 0.7a + 0.7b shipped 28 Apr)

| Column / Table | Source migration | State | Notes |
|---|---|---|---|
| `audit_events` (full schema) | `20260428215923_class_members_and_audit_events.sql` | ✅ live | 11 columns + 5 indexes + 2 SELECT policies (actor-self + school-teacher-read). NO INSERT/UPDATE/DELETE policies — service role only writes; immutability enforced by absence. |
| `audit_events.school_subscription_tier_at_event` | same migration | ✅ live | Monetisation analytics seam (§8.6 item 6). `logAuditEvent()` MUST resolve + populate this from `schools.subscription_tier` lookup at insert time. |
| `audit_events.impersonated_by` | same migration | ✅ live | Phase 4.7 super-admin view-as flow already populates this when present. `logAuditEvent()` honours an optional `impersonatedBy` arg. |
| `ai_budgets` (polymorphic) | `20260428220303_ai_budgets_and_state.sql` | ✅ live | `subject_type ∈ {student, class, school}`, `daily_token_cap >= 0`, UNIQUE(subject_id, subject_type). 0 rows in prod today. |
| `ai_budget_state` (per-student counter) | same migration | ✅ live | PK `student_id`, `tokens_used_today INT >= 0`, `reset_at TIMESTAMPTZ`, `last_warning_sent_at TIMESTAMPTZ`. 0 rows in prod today. |
| `schools.default_student_ai_budget` | Phase 4.8 (`20260502230242_phase_4_8_schools_settings_columns.sql`) | ✅ live | Per-school override of tier default. NULL means "fall through to tier default". CHECK + governance helper from Phase 4.3 already gate writes. |
| `schools.timezone` (IANA) | Phase 0 | ✅ live | Cron's "midnight in school's timezone" reset hangs off this. Default `'Asia/Shanghai'`. |
| `schools.subscription_tier` (5 values) | Phase 0 | ✅ live | `pilot/free/starter/pro/school`. Drives tier-default cascade layer. |
| `students.deleted_at` | Phase 0 | ✅ live | Soft-delete column. `DELETE /api/v1/student/[id]` writes here. |
| `teachers.deleted_at` | Phase 0 | ✅ live | Same pattern; needed for retention cron coverage even though Phase 5 doesn't expose a teacher-delete endpoint. |
| `units.deleted_at` | Phase 0 | ✅ live | Same. |
| `students.school_id`, `class_students.daily_token_cap_override` (per master spec §4.5) | Phase 0 + Phase 4 | ✅ live | Cascade resolution chain. `class_students.daily_token_cap_override` exists as `BIGINT NULL` per Phase 4 audit. |

**Net: zero new tables, zero new columns expected this phase.** Modulo §3.8 Q1 (admin_settings seed for tier defaults — depends on whether seed lives in admin_settings or in code constants), Phase 5 ships **0–1 migrations**.

### 3.2 Tables / SQL helpers that need NEW migrations (Phase 5)

| Migration | Purpose | Sub-phase | Notes |
|---|---|---|---|
| `phase_5_2_atomic_ai_budget_increment` | Adds SECURITY DEFINER `atomic_increment_ai_budget(student_id UUID, tokens INT)` helper. Locked search_path per Lesson #66. Sanity DO-block at apply time. INSERT-on-conflict against `ai_budget_state`; auto-zeros + bumps `reset_at` if past midnight in school's timezone. | 5.2 | One thin SQL helper, no schema change. |
| `phase_5_5_scheduled_deletions` | Creates `scheduled_deletions` table (Q5 resolution): `(id UUID PK, target_type TEXT CHECK IN ('student','teacher','unit'), target_id UUID, scheduled_for TIMESTAMPTZ, status TEXT CHECK IN ('pending','completed','held') DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT now(), completed_at TIMESTAMPTZ NULL, hold_reason TEXT NULL)`. RLS: SELECT for platform_admin + same-school teachers; INSERT/UPDATE deny-by-default (service role only). Two consumers: student-delete endpoint (5.4) writes pending row; retention cron (5.5) writes pending rows for expired data; both crons read pending rows due. | 5.5 | Foundation for legal-hold UX without committing to it now. |

**Migration count for Phase 5: 2** (both small; both ship with sanity DO-blocks).
**No NEW user-data tables.** `audit_events` + `ai_budgets` + `ai_budget_state` already in prod from Phase 0.7a/b. `scheduled_deletions` is operational metadata, not user data.

Tier defaults are NOT a migration (Q1 → Option A): code constants in `src/lib/access-v2/ai-budget/tier-defaults.ts` with admin_settings runtime override. Constants are the FLOOR not the source of truth — if admin_settings row exists, it wins. Mirrors cost-alert pattern.

### 3.3 Existing routes — direct `audit_events.insert(...)` callsites to RETROFIT (§5.1)

The 9 sites that bypass a wrapper today (per-grep against `src/`):

| File | Site count | Action context | Notes |
|---|---|---|---|
| `src/lib/access-v2/governance/school-merge.ts` | 5 | per-table-cascade event + summary event | The cascade emits one event PER touched table (15 tables) + one merge-completed summary. Refactor: collect `cascade_table_events: string[]`, then a single `logAuditEvent({ kind: 'school.merge.completed', payload: { tables: [...] } })` plus per-table debug events under one parent event ID. **Decision needed (§3.8 Q4):** keep per-table fan-out, or batch-summarise? Recommend keep — auditors want per-row visibility. |
| `src/app/api/auth/student-classcode-login/route.ts:114` | 1 | login attempt audit | Try/catch with `console.warn` on failure — login succeeds even if audit fails. Retrofit MUST preserve this semantic (audit IS NOT load-bearing for auth flow). The wrapper accepts `{ failureMode: 'soft' | 'throw' }`. |
| `src/app/api/admin/school/[id]/impersonate/route.ts:128` | 1 | view-as token mint | Sets `impersonated_by` from `actor.id`; payload includes `target_school_id`, `target_school_name`. |
| `src/app/api/school/[id]/changes/[changeId]/revert/route.ts` | 1 | low-stakes setting revert (revert is itself an event) | Tier classification: low-stakes (revert of revert is itself revertable). |
| `src/app/api/school/[id]/invitations/[inviteId]/revoke/route.ts:107` | 1 | invitation lifecycle | Payload includes invitee email, role. |
| `src/app/api/auth/accept-school-invitation/route.ts` | 1 | school-invite acceptance | Per route header comment line 32; lives inside `acceptInvitation()` lib function, not the route handler — verify. |
| `src/app/api/teacher/welcome/request-school-access/route.ts:133` | 1 | school-tier teacher requests access | New `school_invitations` flow from Phase 4.7b-2. |
| `src/lib/access-v2/can.ts:96` | 1 | TODO comment for platform_admin.action audit emission | Wire in §5.1; this is the only TODO of the 9 — net new audit, not a retrofit. |
| **Total** | **10 callsites across 8 files (5 in school-merge.ts)** | — | All retrofitted in one §5.1 commit. Tests: each site gets a payload-shape test (mirror Phase 4.5 cascade test pattern). |

**§5.1d CI gate:** extend `scripts/registry/scan-api-routes.py` to flag any route file containing `export async function (POST|PATCH|DELETE|PUT)` that does NOT contain `logAuditEvent`. Allowlist via comment marker `// audit-skip: <reason>` on the export line for read-only mutations like webhook acks.

### 3.4 NEW routes Phase 5 ships

All under `/api/v1/...` prefix per master-spec §3 item #38 (API versioning seam).

| Route | Method | Purpose | Sub-phase |
|---|---|---|---|
| `/api/v1/student/[id]/export` | GET | Returns full JSON dump of all student-owned data. RLS-checked: only platform admin OR `verifyTeacherCanManageStudent(actor, studentId)`. Auto-emits `student.data_export.requested` audit event. | 5.4 |
| `/api/v1/student/[id]` | DELETE | Soft-delete (`students.deleted_at = now()`) + queue 30-day hard-delete (writes a row to `scheduled_deletions` — see §3.8 Q5 — OR reads `students WHERE deleted_at < now() - interval '30 days'` from the cron). Auto-emits `student.deleted.soft` audit event. | 5.4 |
| `/api/v1/teacher/students/[id]/audit-log` | GET | Returns audit_events for the student's `actor_id` + events targeting the student (target_table='students' AND target_id=studentId). RLS implicit via `audit_events_school_teacher_read` policy. Pagination: `?limit=50&before=<cursor>`. | 5.6 |

**Net: 3 new routes**, all under `/api/v1/`. Note that the canonical Phase 5 spec mentions a separate audit-log route inside the route table — included.

### 3.5 Existing AI call sites (where `withAIBudget()` wraps in §5.3)

Direct grep for `new Anthropic` + `messages.create` + the wrapper `src/lib/ai/anthropic.ts`:

| File | Type | In §5.3 scope? |
|---|---|---|
| `src/app/api/student/word-lookup/route.ts:160` | Student-facing AI call | **YES** — wrap with `withAIBudget(studentId, fn)` |
| `src/app/api/student/quest/mentor/route.ts:171` | Student-facing AI mentor | **YES** — wrap |
| `src/app/api/student/design-assistant/route.ts` (calls via wrapper) | Student-facing design assistant | **YES** — wrap (audit via the wrapper, not direct Anthropic) |
| `src/app/api/student/safety/check-requirements/route.ts` | Student safety scan | **YES** — wrap (uses Sentry tag, AI budget should still apply) |
| `src/app/api/student/tool-sessions/route.ts` + `[id]/route.ts` | Student tool sessions (varies — some toolkit tools call AI through `usePageData` chain, ultimately through one of the design-assistant routes) | **MAYBE** — audit in §5.0 (Q3) whether tool-sessions route makes its own AI call or proxies. Wrap if it makes its own call. |
| `src/lib/ai/anthropic.ts:23` | Shared client wrapper (NOT a route) | **N/A** — wrap callers, not the client |
| `src/lib/ai/quality-evaluator.ts:135` | Background job (no student context) | **NO** — not student-attributed |
| `src/app/api/admin/ai-model/test*` | Admin sandbox | **NO** — admin attribution |
| `src/app/api/teacher/wizard-suggest/route.ts` | Teacher wizard | **NO** — per-student budget is for student-attributed calls only |
| `src/app/api/teacher/wizard-autoconfig/route.ts` | Teacher wizard | **NO** |
| `src/app/api/teacher/lesson-editor/suggest/route.ts` | Teacher lesson editor | **NO** |
| `src/app/api/teacher/lesson-editor/ai-field/route.ts` | Teacher lesson editor | **NO** |
| `src/app/api/tools/report-writer/*` | Public free tool (Sentry-tagged anonymous use) | **NO** — no studentId; rate-limited differently (out of scope) |
| `src/app/api/tools/marking-comments/route.ts` | Public free tool | **NO** — same |

**Net: 4 confirmed routes + 1 audit target in §5.0 (Q3)** for §5.3 wrapping. Spec says budget is "per-student"; teacher-attributed AI calls are out of scope (separate cost-alert pipeline already monitors aggregate spend).

### 3.6 Brief-vs-schema audit findings (Lesson #67 — proposed post-A5b)

Phase 4 part 2 caught the same "brief-specced-X-but-X-doesn't-exist" pattern in 4 different sub-phases (4.5 cascade list / 4.6 forked_from / 4.8 school_profile / 4.9 class_members.source). Each catch added 5–15 minutes of audit + decision time at sub-phase start. A 30-minute brief-vs-schema pass at PHASE start would have caught all 4 in one batch + saved time. Lesson #67 (proposed) is filed as a recommended addition to Lesson #54.

**Phase-5-start brief-vs-schema audit (run during this brief authoring):**

| Master-spec claim | Reality on `main` (verified 3 May PM) | Action |
|---|---|---|
| "audit_events table NEEDS to be created in Phase 5" (Decision 3 reads as if forward-looking) | ✅ Already exists since 28 Apr (Phase 0.7a). Schema includes `school_subscription_tier_at_event`, `impersonated_by`, `severity` — all 11 cols. | Brief reframes Phase 5 as WIRING, not table creation. |
| "ai_budgets + ai_budget_state are Phase 5 work" | ✅ Already exist since 28 Apr (Phase 0.7b). Polymorphic subject + per-student state both present. RLS in place. | Brief reframes Phase 5 as cascade resolver + middleware + tier seed. |
| "schools.default_student_ai_budget needs adding (Phase 4 §3.8 Q3)" | ✅ Added in Phase 4.8 (`20260502230242_phase_4_8_schools_settings_columns.sql`). Governance tier-resolver in `tier-resolvers.ts:157` already classifies its changes. | Brief uses existing column. |
| "audit log retention FOREVER + partition by month from day one" (Decision 4) | ❌ Migration explicitly says "Partitioning by month for audit_events: deferred. Single table ships in v2; performance + retention tools added when row count justifies (filed as FU-AV2-AUDIT-EVENTS-PARTITION P3)." Decision 4 was AMENDED (master spec lines 305–326 risk row says "Partition by month from day one" but the migration shipped without partitioning per a deliberate scope cut.) | Brief honours the migration's scope cut: NO partitioning in Phase 5. Note in close-out as a known divergence from Decision 4 verbatim. **Recommend: amend Decision 4 in master spec to "partition deferred to FU-AV2-AUDIT-EVENTS-PARTITION".** |
| "Sentry PII scrubbing — verify in dashboard" | ✅ Sentry installed (`@sentry/nextjs 10.43.0`, `src/instrumentation.ts`, `src/instrumentation-client.ts`). 8 routes import Sentry. PII scrub config NOT inspected — verification IS the work. | Brief includes manual verification + screenshot. |
| "Cost-alert pipeline live test" | ✅ Pipeline exists (`src/lib/jobs/cost-alert.ts` + `scripts/ops/run-cost-alert.ts`). Threshold env vars `COST_ALERT_DAILY_USD` / `WEEKLY` / `MONTHLY` already in feature-flags.yaml. | Brief includes fire-drill + Resend delivery confirmation. |
| "Retention enforcement cron at scripts/ops/run-retention-enforcement.ts" | ❌ File does NOT exist. Cron pattern exists (7 jobs in `src/lib/jobs/` + 7 entry points in `scripts/ops/`). Phase 5 builds the 8th. | Brief includes cron build (mirror existing pattern). |
| "Manual SQL data export runbook (audit F32)" | ❌ File does NOT exist (`docs/security/student-data-export-runbook.md`). | Brief includes runbook authoring. |
| "Teacher view of student audit log" | ❌ Route does NOT exist. | Brief includes route build. |

**Audit yield: 9 brief-vs-schema items checked, 5 reality matches, 4 misses, 0 surprises that block work.** Lesson #67 saved an estimated 30–60 minutes of mid-sub-phase scrambling.

### 3.7 Registry cross-check (Step 5c per build methodology)

| Registry | State (3 May PM) | Drift caught | Fix in |
|---|---|---|---|
| `WIRING.yaml` | `auth-system` v2 ✅, `permission-helper` v2 ✅, `class-management` v2 ✅, `school-governance` ✅ (added Phase 4). **No `audit-log` system. No `ai-budget` system. No `data-subject-rights` system.** | Add 3 new systems with deps + affects + change_impacts. `audit-log` deps = every mutation route. `ai-budget` affects = every student AI route. `data-subject-rights` affects = `students`, `student_progress`, `student_tool_sessions`, all student-touched tables (~15 per `data-classification-taxonomy.md`). | §5.8 close-out |
| `schema-registry.yaml` | `audit_events` entry present (line 1495) — 5 indexes listed, RLS coverage clean. `ai_budgets` (line 1101) + `ai_budget_state` (line 1094) present. | Add `writers: [src/lib/access-v2/audit-log.ts]` to `audit_events` entry post-§5.1. Add `writers: [src/lib/access-v2/ai-budget/middleware.ts]` to `ai_budget_state` post-§5.3. | §5.8 close-out |
| `api-registry.yaml` | 398 routes (per header comment, last synced 2026-04-14). 3 new routes adds. | Sync via `python3 scripts/registry/scan-api-routes.py --apply` post-§5.1, §5.4, §5.6. **Extend the scanner with the audit-call CI gate** (per §5.1d). | §5.8 close-out |
| `ai-call-sites.yaml` | 54 call sites. `withAIBudget` wrapper does not yet exist. | Sync via `python3 scripts/registry/scan-ai-calls.py --apply` post-§5.3. Each wrapped site gets a new `wrapped_by: withAIBudget` field if scanner is extended (§3.8 Q6); otherwise no schema change. | §5.8 close-out |
| `feature-flags.yaml` | 4 SENTRY env vars + 4 COST_ALERT env vars present. No `ai.budget.*` admin_settings keys. | Add `ai.budget.tier_default.{pilot,free,starter,pro,school}` admin_settings keys with `default_value: 50000/50000/75000/100000/200000`. (No new ENV vars — runtime keys live in admin_settings table.) Add `ai.budget.warning_threshold_percent` (default 80). | §5.8 close-out |
| `vendors.yaml` | 9 vendors. Resend already registered for cost-alert delivery. | None — no new vendor in Phase 5. (Cost-alert + retention emails reuse Resend.) | n/a |
| `data-classification-taxonomy.md` | `retention_days` documented per column for student PII (2555d = 7yr) and other classifications. | None new from Phase 5; the retention cron READS this taxonomy authoritatively. Verify the taxonomy covers every column the cron will touch (audit during §5.5). | n/a (read-only) |
| `rls-coverage.json` | 5 tables flagged `rls_enabled_no_policy` (admin_audit_log, ai_model_config, ai_model_config_history, fabricator_sessions, teacher_access_requests). All pre-existing; **explicitly Phase 6 cleanup per master-spec line 284, NOT Phase 5.** | Phase 5 must NOT clean these up (scope discipline — Lesson #45). Re-verify post-§5.6 that no NEW `rls_enabled_no_policy` entries appear from Phase 5 routes. | Verify in §5.8 |

**Spot-checks performed (Lesson #54):**
- `audit_events.school_subscription_tier_at_event` enum — verified `('pilot','free','starter','pro','school')` matches `schools.subscription_tier` enum (Phase 0). Clean.
- `ai_budget_state.last_warning_sent_at` — verified column NULLABLE TIMESTAMPTZ, used by 80%-warning throttle. Clean.
- WIRING `school-governance.affects` — verified contains `audit-log` placeholder; ready for §5.8 to wire downstream.
- `src/lib/jobs/cost-alert.ts` `run(supabase)` signature — verified pattern matches what `run-retention-enforcement.ts` will use.
- `students.deleted_at` column — verified NULLABLE TIMESTAMPTZ from Phase 0; the soft-delete pattern is already in code.

### 3.8 Resolved decisions (signed off by Matt 3 May 2026 PM)

All 7 originally-open questions resolved before §5.0 ships. Listed here for traceability + decisions-log entry. Where the brief's default proposal was upgraded by the resolution, the upgrade is documented inline.

**Q1 — Tier-default storage: code constants + admin_settings runtime override.**

- Code constants live in `src/lib/access-v2/ai-budget/tier-defaults.ts`: `pilot/free → 50000`, `starter → 75000`, `pro → 100000`, `school → 200000`.
- Constants are the FLOOR (system always works on fresh deploy) — admin_settings keys `ai.budget.tier_default.<tier>` override at runtime when set.
- When the monetisation admin UI later ships, it reads admin_settings, defaults to constants, writes back. **No UI in Phase 5.**
- §5.8 documents the admin_settings keys in `feature-flags-taxonomy.md` so future admin UI work doesn't require archaeology.
- 0 migrations for tier defaults (was: 0 or 1 in original Q1 proposal).

**Q2 — Audit failure semantics: 3 modes, not 2 (UPGRADED from 'throw'/'soft').**

- `'throw'` (default): audit failure throws → action fails atomically with audit. Use for all mutations, governance changes, data ops, financial ops.
- `'soft-warn'`: audit failure → `console.warn` only → action continues. ONLY for the auth flow (`student-classcode-login`) where audit failure must not break login. Preserves pre-existing semantic.
- `'soft-sentry'` (NEW — world-class addition): audit failure → captures Sentry exception (so the gap is loud) → action continues. Use for routes where action MUST not break but silent audit gaps are unacceptable. Default for any retrofit site that wasn't auth-flow.
- Rationale: silent audit gaps are worse than silent feature failures — they look fine in normal ops and only surface during a real DSR. Sentry alerting closes the loop.
- 5 of the 9 retrofit sites move from today's silent `console.warn` pattern to `'soft-sentry'`. Only `student-classcode-login` stays `'soft-warn'`.

**Q3 + Q6 — Resolved together (same question): extend `scan-ai-calls.py` for budget-coverage CI gate.**

- New scanner mode: detect any `route.ts` under `src/app/api/student/...` that calls `messages.create` / `new Anthropic` without going through `withAIBudget()`.
- Allowlist marker: `// budget-skip: <reason>` on the export line.
- New scanner output: `docs/scanner-reports/ai-budget-coverage.json` with `{wrapped, skipped, missing}`.
- Wired into `nightly.yml` GitHub Action: exits non-zero if `missing` non-empty.
- Same exact pattern as the §5.1d audit-coverage gate. New sub-phase **5.3d**.
- Q3 (manual tool-sessions enumeration) collapses: scanner finds the missing wrappings; §5.3 wraps them as discovered.
- Cost: +0.25d in §5.3d, +5 tests. Saves unbounded debugging post-pilot.

**Q4 — School-merge cascade: per-table fan-out (default) + file `parent_event_id` as P2.**

- Per-table fan-out preserves auditor `WHERE target_table='students'` filter capability across merges. 15 events per merge is the truth, not noise.
- File **FU-AV2-AUDIT-EVENT-GROUPING P2**: future `audit_events.parent_event_id UUID NULL REFERENCES audit_events(id)` column unlocks event-grouping queries without payload-JSON scans + foundation for future event-stream / event-sourcing.
- Add column when 2nd multi-row cascade pattern surfaces (likely Phase 6 cutover or a Phase 7+ feature). Don't bake it in for one consumer (Lesson #44).

**Q5 — Hard-delete tracking: `scheduled_deletions` table (UPGRADED from query-based).**

- Reason for upgrade: TWO consumers from day one — student-delete endpoint (5.4) AND retention cron (5.5) hard-delete step. Two consumers justifies the table now.
- Schema (minimal): `(id UUID PK, target_type TEXT CHECK IN ('student','teacher','unit'), target_id UUID, scheduled_for TIMESTAMPTZ, status TEXT CHECK IN ('pending','completed','held') DEFAULT 'pending', created_at, completed_at NULL, hold_reason TEXT NULL)`.
- Legal-hold path: future `UPDATE scheduled_deletions SET status='held', hold_reason='...' WHERE target_id=...`. No UI now; the column exists. When first GDPR/PIPL legal-hold request lands (likely within first paying customer's year 1), it's a SQL update, not a refactor.
- Cost: +1 thin migration in §5.5, +0.25d, +10 tests.

**Q7 — Retention cron: strict timestamp-based (default) + honour `scheduled_deletions.status='held'` + file `FU-AV2-RETENTION-ACTIVE-STUDENT P2`.**

- Cron operates strictly on `created_at` + `retention_days`; no active-student exemption logic.
- BUT: must SKIP any `scheduled_deletions` row where `status='held'` (legal-hold guardrail — Q5 enables this).
- BUT: must NEVER touch a column whose `data-classification-taxonomy.md` entry says `retention_days: indefinite` (sanity assertion in cron, not just trust the taxonomy reader).
- Edge case (2-year MYP Personal Project students with year-1 chat logs vanishing under shorter retention): documented in retention runbook with worked example. File **FU-AV2-RETENTION-ACTIVE-STUDENT P2** to revisit when first complaint or when a column with `retention_days < 365` lands.

**Net effect of upgrades vs original brief defaults:**

| Q | Original default | Resolution | Δ Effort | Δ Tests | Δ Migrations |
|---|---|---|---|---|---|
| Q1 | A (constants + override) | A — confirmed | 0 | 0 | 0 |
| Q2 | 2 modes | **3 modes (added `'soft-sentry'`)** | +0.1d in §5.1 | +5 | 0 |
| Q3 | Manual audit in §5.0 | **Subsumed by Q6 scanner** | -0.1d (no manual audit) | 0 | 0 |
| Q4 | Per-table | Per-table — confirmed; file FU-AV2-AUDIT-EVENT-GROUPING P2 | 0 | 0 | 0 |
| Q5 | A (query-based) | **B (`scheduled_deletions` table)** | +0.25d in §5.5 | +10 | +1 |
| Q6 | A (extend scanner) | A — confirmed; **new sub-phase 5.3d** | +0.25d in §5.3d | +5 | 0 |
| Q7 | B (strict) | B + held guardrail; file FU-AV2-RETENTION-ACTIVE-STUDENT P2 | 0 | 0 | 0 |
| **Net** | — | — | **+0.5d (3.5–4d → ~4–4.5d)** | **+20 (3424 → 3444)** | **+1 (1 → 2)** |

---

## 4. Sub-phases

Eight sub-phases (5.0 → 5.8). Each ends with a sub-phase commit on `access-model-v2-phase-5`. **No push to origin/main until Checkpoint A6 signs off AND migrations applied to prod.** Use `phase-5-wip` backup branch for WIP if needed.

### Phase 5.0 — Pre-flight + scaffolds + audit (~0.25 day)

- Cut branch `access-model-v2-phase-5` from `v0.4-phase-4-closed` ✅ (done — HEAD `62c8ba1`).
- Run `npx tsc --noEmit --project tsconfig.check.json`; assert 0 errors.
- Run `bash scripts/migrations/verify-no-collision.sh`; assert clean against origin/main.
- Resolve §3.8 Q3 audit (5 min): grep `tool-sessions/route.ts` for `Anthropic`/`messages.create`. Capture finding in §3.5 update.
- Author `docs/security/student-data-export-runbook.md` skeleton (full content in §5.4 close-out).
- Pre-create scaffolds (empty files with TODO markers + WIRING entries):
  - `src/lib/access-v2/audit-log.ts`
  - `src/lib/access-v2/ai-budget/tier-defaults.ts`
  - `src/lib/access-v2/ai-budget/cascade-resolver.ts`
  - `src/lib/access-v2/ai-budget/middleware.ts`
  - `src/lib/access-v2/data-subject/export-student.ts`
  - `src/lib/access-v2/data-subject/delete-student.ts`
  - `src/lib/jobs/retention-enforcement.ts`
  - `scripts/ops/run-retention-enforcement.ts`
  - `scripts/ops/run-student-hard-delete-cron.ts`
- Commit: `chore(phase-5): scaffold + tool-sessions audit + runbook skeleton`.

### Phase 5.1 — Audit log infrastructure (~0.85 day)

- Build `src/lib/access-v2/audit-log.ts` with `logAuditEvent(supabase, payload)` signature:
  ```ts
  type LogAuditEventInput = {
    actorId: string | null;
    actorType: 'student'|'teacher'|'fabricator'|'platform_admin'|'community_member'|'guardian'|'system';
    impersonatedBy?: string | null;
    action: string;                // 'unit.create', 'school.invitation.revoked', etc.
    targetTable?: string | null;
    targetId?: string | null;
    schoolId?: string | null;      // wrapper auto-resolves from actor if omitted + actor is teacher/student
    classId?: string | null;
    payload?: Record<string, unknown>;
    ip?: string | null;
    userAgent?: string | null;
    severity?: 'info'|'warn'|'critical';
    // Q2 resolution — 3 modes, not 2:
    failureMode?: 'throw' | 'soft-warn' | 'soft-sentry';
    // 'throw' (default): action fails atomically with audit. Use for mutations/governance/data ops.
    // 'soft-warn': console.warn + continue. ONLY for student-classcode-login (preserve auth flow).
    // 'soft-sentry': Sentry.captureException + continue. Use for any retrofit/route where action
    //                must not break BUT silent gaps are unacceptable (default for non-auth retrofits).
  };
  async function logAuditEvent(...): Promise<{ id: string } | { error: string }>;
  ```
- Wrapper auto-resolves `school_subscription_tier_at_event` from `schools.subscription_tier` lookup (single read; cached by request).
- Wrapper auto-emits 1 row per call. Multi-row events (school-merge cascade) emit 1 call per row.
- Retrofit the 9 known sites listed in §3.3 to call `logAuditEvent(...)` with explicit `failureMode`:
  - `student-classcode-login` → `'soft-warn'` (preserve current semantic).
  - All 5 school-merge sites → `'throw'` (cascade integrity matters; merge already runs in a logical transaction).
  - `impersonation`, `invitation-revoke`, `school-changes-revert`, `accept-invitation`, `request-school-access`, `can.ts platform_admin.action` → `'soft-sentry'` (action shouldn't break on audit DB hiccup; gap must be visible in Sentry).
- Wire the `can.ts:96` TODO to emit `platform_admin.action` audit events.
- Build payload-shape test per retrofit site (mirror Phase 4.5 cascade-test pattern) + per-mode failure-handling test.
- Test count target: +35 (10 sites × ~3 tests each + 5 tests for the 3-mode failure semantics including a mocked Sentry capture assertion).
- Commit: `feat(phase-5.1): logAuditEvent wrapper (3-mode failure) + retrofit 10 callsites`.

### Phase 5.1d — `scan-api-routes.py` CI gate extension (~0.5 day)

- Extend `scripts/registry/scan-api-routes.py` to identify any `route.ts` that:
  1. Exports `POST | PATCH | DELETE | PUT`, AND
  2. Does NOT contain `logAuditEvent` (textual match), AND
  3. Does NOT contain the comment `// audit-skip: <reason>` on the export line.
- New scanner output: `docs/scanner-reports/audit-coverage.json` with `{covered: [...], skipped: [...{file, reason}], missing: [...]}`.
- Run scanner against current tree → expect non-empty `missing` list (everything outside the 10 retrofitted sites). File each as either:
  - Wire `logAuditEvent` in same Phase 5 sub-phase (if simple), OR
  - Mark `// audit-skip: <reason>` (if read-only-ish — e.g. /api/student/quest/milestones/[id]/route.ts may PATCH but is non-sensitive), OR
  - File as **FU-AV2-AUDIT-MISSING-{ROUTE}** P2 for post-Phase-6 catchup.
- Add to `nightly.yml` GitHub Action: `python3 scripts/registry/scan-api-routes.py --check-audit-coverage` exits non-zero if `missing` is non-empty.
- Test count target: +5 (scanner unit tests).
- Commit: `feat(phase-5.1d): scan-api-routes audit-coverage CI gate`.

### Phase 5.2 — AI budget cascade resolver + tier defaults (~0.5 day)

- Build `src/lib/access-v2/ai-budget/tier-defaults.ts`:
  ```ts
  export const TIER_DEFAULTS = {
    pilot: 50_000, free: 50_000, starter: 75_000, pro: 100_000, school: 200_000,
  } as const;
  export async function readTierDefault(supabase, tier): Promise<number>;
  // Reads admin_settings.ai.budget.tier_default.<tier> first, falls back to TIER_DEFAULTS[tier].
  ```
- Build `src/lib/access-v2/ai-budget/cascade-resolver.ts`:
  ```ts
  export async function resolveStudentCap(supabase, studentId): Promise<{
    cap: number;
    source: 'student'|'class'|'school'|'tier_default';
    school_id: string | null;
  }>;
  // 1. Read student → school_id (Phase 0 column).
  // 2. ai_budgets WHERE subject_type='student' AND subject_id=studentId — wins if set.
  // 3. ai_budgets WHERE subject_type='class' AND subject_id IN (student's class_students.class_id) — wins if set (any class with override).
  // 4. ai_budgets WHERE subject_type='school' AND subject_id=school_id — wins if set.
  // 5. schools.default_student_ai_budget — wins if set.
  // 6. readTierDefault(school.subscription_tier).
  ```
- Build `atomic_increment_ai_budget(student_id UUID, tokens INT)` SQL helper (SECURITY DEFINER, search_path locked):
  ```sql
  -- INSERT ON CONFLICT pattern; if reset_at < now(), zero before incrementing + bump reset_at to next midnight in school's timezone.
  -- Returns updated tokens_used_today + reset_at + cap_exceeded BOOL.
  ```
- Mig-discipline: this 1 SQL helper ships in a thin migration (not a table change). Mint with `bash scripts/migrations/new-migration.sh phase_5_2_atomic_ai_budget_increment`.
- Test: cascade resolver returns expected source for each layer; SQL helper handles concurrent increments correctly (race test if feasible in mock env).
- Test count target: +20.
- Commit: `feat(phase-5.2): AI budget cascade resolver + atomic increment SQL helper`.

### Phase 5.3 — `withAIBudget()` middleware + wire into student AI routes (~0.75 day)

- Build `src/lib/access-v2/ai-budget/middleware.ts`:
  ```ts
  export async function withAIBudget<T>(
    supabase, studentId, fn: (estimateTokens: (input: string) => number) => Promise<{ result: T; usage: { input_tokens: number; output_tokens: number; stop_reason: string } }>
  ): Promise<{ ok: true; result: T; cap: number; remaining: number } | { ok: false; reason: 'over_cap' | 'truncated' | 'lookup_failed'; cap: number; used: number }>;
  // 1. resolveStudentCap → cap.
  // 2. Read ai_budget_state → tokens_used_today.
  // 3. If used >= cap → return { ok: false, reason: 'over_cap' }; ALSO call sendBudgetWarningEmail() if not sent today (throttled via last_warning_sent_at).
  // 4. Call fn(estimateTokens) — fn returns the API response.
  // 5. If usage.stop_reason === 'max_tokens' → return { ok: false, reason: 'truncated' } and DON'T bill (per Lesson #39).
  // 6. atomic_increment_ai_budget(studentId, usage.input_tokens + usage.output_tokens) → check returned cap_exceeded.
  // 7. Emit logAuditEvent if cap_exceeded ('warn' severity, failureMode 'soft-sentry').
  // 8. Return { ok: true, result, cap, remaining: cap - tokens_used_today }.
  ```
- Wire into student AI routes per §3.5. Initial pass = 4 known routes (`word-lookup`, `quest/mentor`, `design-assistant`, `safety/check-requirements`); §5.3d scanner finds the rest.
- Each route returns 429 + JSON `{ error: 'budget_exceeded', cap, used, reset_at }` on `over_cap`.
- Update `audit-log.ts` to support `severity: 'warn'` for cap-warn events.
- Test count target: +30 (4–5 routes × ~6 tests each: happy path, at-cap block, 80% warning emit, truncated-no-bill, cascade resolution per layer).
- Commit: `feat(phase-5.3): withAIBudget middleware + wire 4 known student AI routes`.

### Phase 5.3d — `scan-ai-calls.py` budget-coverage CI gate extension (~0.25 day, Q6 resolution)

- Extend `scripts/registry/scan-ai-calls.py` to identify any `route.ts` under `src/app/api/student/...` that:
  1. Calls `messages.create` / `new Anthropic` / imports from `@/lib/ai/anthropic`, AND
  2. Does NOT contain `withAIBudget` (textual match), AND
  3. Does NOT contain the comment `// budget-skip: <reason>` on the export line.
- New scanner output: `docs/scanner-reports/ai-budget-coverage.json` with `{wrapped: [...], skipped: [...{file, reason}], missing: [...]}`.
- Run scanner against current tree post-§5.3 → expect `missing` list to surface tool-sessions routes (Q3 resolution: scanner finds, not manual audit) + any other student-attributed AI calls not yet wrapped.
- Wrap each missing route in same sub-phase if simple, OR mark `// budget-skip: <reason>` with explicit justification, OR file as **FU-AV2-AI-BUDGET-MISSING-{ROUTE}** P2 if structurally complex.
- Add to `nightly.yml` GitHub Action: `python3 scripts/registry/scan-ai-calls.py --check-budget-coverage` exits non-zero if `missing` is non-empty.
- Test count target: +5 (scanner unit tests).
- Commit: `feat(phase-5.3d): scan-ai-calls budget-coverage CI gate + nightly.yml integration`.

### Phase 5.4 — Data subject endpoints: export + soft-delete (~0.75 day)

- Build `src/lib/access-v2/data-subject/export-student.ts`:
  - Fetches all student-owned data per `data-classification-taxonomy.md` (read every column tagged `pii: 'student_pii'` OR `pii: 'student_voice'` OR `pii: 'student_generated'`).
  - Returns nested JSON: `{ student: {...}, enrollments: [...], submissions: [...], tool_sessions: [...], audit_events: [...], ai_budget_state: {...}, ... }`.
  - Read-time cap: 10MB JSON. Larger sets stream + chunk.
- Build `src/app/api/v1/student/[id]/export/route.ts` (GET):
  - Auth: `verifyTeacherCanManageStudent(actor, studentId)` OR `is_platform_admin`.
  - Audit: emits `student.data_export.requested` BEFORE the response (so the audit row exists even if export fails).
  - Headers: `Content-Disposition: attachment; filename="student-<id>-export-<date>.json"`, `Cache-Control: private, no-store`.
- Build `src/lib/access-v2/data-subject/delete-student.ts`:
  - Sets `students.deleted_at = now()`.
  - Inserts `scheduled_deletions(target_type='student', target_id=studentId, scheduled_for=now()+30d, status='pending')` (Q5 resolution — table consumes 5.5 cron).
  - Emits `student.deleted.soft` audit event (failureMode `'throw'` — atomic with the soft-delete).
  - Returns `{ scheduledHardDeleteAt: <ISO+30d>, scheduledDeletionId: <uuid> }` for response payload.
- Build `src/app/api/v1/student/[id]/route.ts` (DELETE):
  - Same auth as export.
  - Confirmation pattern: requires `?confirm=true` query param OR JSON body `{ confirmed: true }` to fire (defence in depth — clicking the wrong link shouldn't soft-delete).
- Build `docs/security/student-data-export-runbook.md` — manual SQL queries that produce the same JSON structure for the audit-F32 stopgap path.
- Test count target: +25.
- Commit: `feat(phase-5.4): /api/v1/student/[id]/{export,delete} endpoints + manual runbook`.

### Phase 5.5 — `scheduled_deletions` table + retention cron + hard-delete cron (~0.75 day)

- Mint migration `phase_5_5_scheduled_deletions` (per §3.2). Schema + RLS + sanity DO-block. Apply to dev first; prod-apply waits for Checkpoint A6.
- Build `src/lib/jobs/retention-enforcement.ts`:
  - `run(supabase)`: reads `data-classification-taxonomy.md` `retention_days` per column.
  - **Sanity assertion (Q7 guardrail):** if any column the cron is about to touch has `retention_days: indefinite`, ABORT the run + emit `severity: 'critical'` audit event. Don't trust the taxonomy reader silently.
  - For each column where `retention_days != 'indefinite'`:
    - Soft-delete rows past horizon (`UPDATE table SET deleted_at = now() WHERE deleted_at IS NULL AND created_at < now() - interval 'X days'`) — only for tables with `deleted_at` column.
    - For each soft-deleted row, INSERT into `scheduled_deletions(target_type, target_id, scheduled_for=now()+30d, status='pending')`.
  - Logs every action to `audit_events` (`retention.soft_delete` action, severity = `'info'`, failureMode `'throw'`).
  - Returns `{ runId, summary: { tables: [{ table, soft_deleted }] } }`.
- Build `src/lib/jobs/scheduled-hard-delete-cron.ts` (single cron, both consumers — Q5 win):
  - Reads `scheduled_deletions WHERE status='pending' AND scheduled_for < now()`.
  - Skips rows where `status='held'` (legal-hold guardrail per Q5/Q7).
  - For each due row, DELETE from the target table (cascades via FK ON DELETE).
  - Updates `scheduled_deletions.status='completed', completed_at=now()` per processed row.
  - Logs `<target_type>.deleted.hard` audit event per row (failureMode `'throw'`).
  - Returns `{ runId, summary: { processed: N, skipped_held: M } }`.
- Build entry points: `scripts/ops/run-retention-enforcement.ts` + `scripts/ops/run-scheduled-hard-delete.ts` (mirror `run-cost-alert.ts`).
- Add both jobs to `nightly.yml` GitHub Action.
- Test count target: +25 (15 retention cron + 10 scheduled-hard-delete cron + held-row skip + sanity assertion).
- Commit: `feat(phase-5.5): scheduled_deletions table + retention cron + scheduled hard-delete cron`.

### Phase 5.6 — Teacher view of student audit log (~0.25 day)

- Build `src/app/api/v1/teacher/students/[id]/audit-log/route.ts` (GET):
  - Auth: `verifyTeacherCanManageStudent(actor, studentId)` OR `is_platform_admin`.
  - Query: `SELECT * FROM audit_events WHERE (actor_id = $studentId AND actor_type = 'student') OR (target_table = 'students' AND target_id = $studentId) ORDER BY created_at DESC LIMIT $limit`.
  - Pagination: `?limit=50&before=<cursor created_at>`.
  - RLS: `audit_events_school_teacher_read` already returns the right scope; verify in test.
- Test count target: +8.
- Commit: `feat(phase-5.6): GET /api/v1/teacher/students/[id]/audit-log`.

### Phase 5.7 — Cost-alert fire drill + Sentry PII scrub verification (~0.25 day, MANUAL)

- **Cost-alert fire drill:**
  1. Set `COST_ALERT_DAILY_USD=0.01` in Vercel env (temporary).
  2. Trigger one student AI call (use a dev account with budget room).
  3. Run `bash scripts/ops/run-cost-alert.ts` (or wait for nightly).
  4. Confirm Resend dashboard shows email sent within 5 minutes.
  5. Restore production threshold.
  6. Document at `docs/security/cost-alert-fire-drill.md` with timestamps + screenshot.
- **Sentry PII scrub verification:**
  1. Open Sentry dashboard → Project Settings → Security & Privacy.
  2. Confirm "Scrub Data" is enabled with default scrubber + custom rules for `email`, `student_id`, `bearer_token`, `api_key`, `*_secret`.
  3. Confirm `Sensitive Fields` list includes `password`, `secret`, `passwd`, `api_key`, `apikey`, `access_token`, `refresh_token`, `private_key`.
  4. Screenshot to `docs/security/sentry-pii-scrub-2026-05.png`.
  5. Document at top of `docs/security/sentry-pii-scrub-procedure.md` with quarterly review cadence (next: 2026-08).
- Test count target: +0 (manual verification, not test code).
- Commit: `docs(phase-5.7): cost-alert fire drill + Sentry PII scrub verification`.

### Phase 5.8 — Registry hygiene + close-out (~0.25 day)

- Run all 5 registry scanners:
  - `python3 scripts/registry/scan-api-routes.py --apply` — expect 3 new routes (5.4 export, 5.4 delete, 5.6 audit-log-view).
  - `python3 scripts/registry/scan-ai-calls.py --apply` — expect no new sites (only wrapping); scanner extension per §3.8 Q6 is optional.
  - `python3 scripts/registry/scan-feature-flags.py` — expect 5 new admin_settings keys (`ai.budget.tier_default.{pilot,free,starter,pro,school}`) + 1 new (`ai.budget.warning_threshold_percent`); update yaml manually.
  - `python3 scripts/registry/scan-vendors.py` — expect no diff.
  - `python3 scripts/registry/scan-rls-coverage.py` — expect SAME 5 `rls_enabled_no_policy` (Phase 5 must NOT introduce new ones).
- Update WIRING.yaml:
  - Add `audit-log` system (deps: every mutation route; affects: governance / privacy / retention surfaces).
  - Add `ai-budget` system (deps: schools, students, class_students, ai_budgets, ai_budget_state, admin_settings; affects: every student-AI route).
  - Add `data-subject-rights` system (deps: students + 15 student-touched tables per data-classification taxonomy; affects: legal compliance posture).
- Update `schema-registry.yaml`:
  - `audit_events` writer: add `src/lib/access-v2/audit-log.ts`.
  - `ai_budget_state` writer: add `src/lib/access-v2/ai-budget/middleware.ts`.
  - `students` writer: confirm `src/lib/access-v2/data-subject/delete-student.ts` is captured.
- Update `docs/changelog.md` session entry.
- Update `docs/projects/access-model-v2.md` Decision 4 footer to note partitioning is FU-AV2-AUDIT-EVENTS-PARTITION P3 (per §3.6 finding).
- File any new follow-ups discovered during the phase (target: ≤5 new FUs to feel proud of the audit work).
- Run `bash scripts/check-session-changes.sh`; if `SAVEME RECOMMENDED`, recommend `saveme` to Matt for the changelog + handoff entries.
- Commit: `chore(phase-5.8): registry sync + close-out`.

---

## 5. Don't-stop-for list

Per build-methodology rule 4 (don't paper over surprises) — these are items where stopping would be over-cautious:

- A 10th `audit_events.insert(...)` site discovered during §5.1 retrofit grep — fix in same commit (Lesson #60).
- Tool-sessions §3.5 Q3 audit reveals 1 extra wrapping target — wrap in §5.3, no separate sub-phase.
- A test fixture needs an `ai_budget_state` row for assertion setup — create in test, not in migration.
- Existing `admin_audit_log` writer (`src/lib/admin/settings.ts`) — leave alone (out of scope; pre-existing parallel system per §1 non-goals).
- Cosmetic typo in retention runbook — fix in same commit.
- A SECURITY DEFINER helper introduced this phase auto-fails its DO-block sanity check — STOP (this IS a stop trigger; not don't-stop).
- An out-of-tree migration appears between branch cut and first commit (rare) — re-run `verify-no-collision.sh`, document in close-out.

---

## 6. Stop triggers

Per build-methodology rule 4 — STOP and report findings before continuing:

- Any §3.8 open question NOT signed off before §5.0 → STOP.
- `npm test` regresses below 3291 baseline without explanation → STOP.
- `npx tsc --noEmit --project tsconfig.check.json` fails → STOP.
- `bash scripts/migrations/verify-no-collision.sh` flags collision → STOP.
- A retrofit in §5.1 changes audit semantics (e.g., a route that today writes 1 event now writes 2 or 0) → STOP, diagnose.
- A SECURITY DEFINER helper from §5.2 fails its sanity DO-block at apply time → STOP (Lesson #66).
- The retention cron in §5.5 dry-run hard-deletes a row that classifies as `retention_days: indefinite` → STOP, audit cron logic.
- The `withAIBudget()` middleware double-bills a single AI call (atomic increment runs twice) → STOP, race condition.
- The `withAIBudget()` middleware silently bills on a `stop_reason: 'max_tokens'` truncated response (Lesson #39 violation) → STOP.
- The Sentry verification screenshot shows PII scrubbing DISABLED → STOP, fix Sentry config (NOT a passable Checkpoint A6 condition).
- Cost-alert fire drill produces NO email within 5 min → STOP, Resend integration broken.
- A new `rls_enabled_no_policy` table appears in `docs/scanner-reports/rls-coverage.json` after §5.6 → STOP (Phase 5 must not introduce new ones).
- The `audit-coverage.json` scanner reports a Phase 5 NEW route in `missing` (i.e., one of our 3 new routes forgot `logAuditEvent`) → STOP, fix the route.

---

## 7. Checkpoint A6 — gate criteria

Phase 5 closes when ALL pass:

### Code

- [ ] `src/lib/access-v2/audit-log.ts` exists + `logAuditEvent()` signature per §5.1 + 9 retrofit sites use it.
- [ ] `src/lib/access-v2/ai-budget/{tier-defaults,cascade-resolver,middleware}.ts` exist per §5.2 + §5.3.
- [ ] `src/lib/access-v2/data-subject/{export-student,delete-student}.ts` exist per §5.4.
- [ ] `src/lib/jobs/{retention-enforcement,student-hard-delete-cron}.ts` exist per §5.5.
- [ ] `scripts/ops/run-retention-enforcement.ts` + `scripts/ops/run-student-hard-delete-cron.ts` exist + reference `src/lib/jobs/*` per §5.5.
- [ ] 3 new routes ship under `/api/v1/...` per §3.4.
- [ ] `scripts/registry/scan-api-routes.py` extended with audit-coverage CI gate per §5.1d; `nightly.yml` includes the check.
- [ ] `docs/security/student-data-export-runbook.md` exists per §5.4.
- [ ] `docs/security/cost-alert-fire-drill.md` exists per §5.7.
- [ ] `docs/security/sentry-pii-scrub-procedure.md` + `sentry-pii-scrub-2026-05.png` exist per §5.7.
- [ ] Tests updated; **3291 → ≥3444 (≥153 new)**, 0 regressions.
- [ ] `npx tsc --noEmit --project tsconfig.check.json` 0 errors.

### Migrations

- [ ] 2 migrations shipped: `phase_5_2_atomic_ai_budget_increment` (SQL helper) + `phase_5_5_scheduled_deletions` (table per Q5 resolution).
- [ ] All sanity DO-blocks fired correctly at apply time.
- [ ] `bash scripts/migrations/verify-no-collision.sh` clean against `origin/main`.

### Smoke (live in dev or staging)

- [ ] `logAuditEvent()` round-trip: invite a co-teacher to a class → check `audit_events` has the row with correct `school_subscription_tier_at_event`, `actor_id`, `action='class_member.invited'`.
- [ ] AI budget cascade: set `students.daily_token_cap_override = 1000` for a test student → call student AI route → confirm 429 returned with `{ error: 'budget_exceeded', cap: 1000, ... }`.
- [ ] AI budget atomic increment: 5 concurrent AI calls for one student → verify `tokens_used_today` is the SUM of all 5 (not less = lost increments, not more = double-bill).
- [ ] Export endpoint: `GET /api/v1/student/<id>/export` for a real student returns valid JSON, attachment header set, audit_events has `student.data_export.requested` row.
- [ ] Delete endpoint: `DELETE /api/v1/student/<id>?confirm=true` returns `{ scheduledHardDeleteAt: <iso>, scheduledDeletionId: <uuid> }`, `students.deleted_at` set, `scheduled_deletions` row created with `status='pending'`, audit_events has `student.deleted.soft` row.
- [ ] Legal-hold guardrail: manually flip a `scheduled_deletions` row to `status='held'` before its `scheduled_for` → run hard-delete cron → assert row NOT deleted; `summary.skipped_held` incremented.
- [ ] Retention cron dry-run on test data: produces correct soft-delete counts + writes `scheduled_deletions` rows for each + emits per-table audit_events; sanity assertion fires (`severity: 'critical'`) if test data includes a `retention_days: indefinite` column.
- [ ] Teacher audit-log view: `GET /api/v1/teacher/students/<id>/audit-log` returns events for a student the teacher manages; returns 403 for an unaffiliated student.
- [ ] Cost-alert fire drill: $0.01 threshold + 1 AI call → Resend delivers email within 5 min; documented.
- [ ] Sentry PII scrub: dashboard screenshot confirms scrubbing enabled with all required field patterns; documented.

### Documentation

- [ ] This brief finalised + linked from `docs/projects/access-model-v2.md` Phase 5 section.
- [ ] `docs/projects/access-model-v2-phase-5-checkpoint-a6.md` written + signed.
- [ ] `docs/changelog.md` session entry.
- [ ] Forward-looking handoff written for Phase 6 (cutover + cleanup).
- [ ] `docs/projects/access-model-v2-followups.md` updated with any new FUs.

### Operational

- [ ] Migration(s) applied to prod in timestamp order with sanity DO-blocks green.
- [ ] Active-sessions row updated for next session (Phase 6 prep).
- [ ] Cost-alert threshold restored to production value.
- [ ] If Sentry PII scrub config required updates → those updates deployed + re-screenshot taken.

---

## 8. Sub-phase / commit / migration summary (planning view)

| Sub-phase | Goal | Tests Δ | Migrations | Commit |
|---|---|---|---|---|
| 5.0 | Pre-flight + scaffolds + runbook skeleton (tool-sessions audit dropped — Q3 subsumed by 5.3d) | +0 | 0 | `chore(phase-5.0): scaffold + runbook skeleton` |
| 5.1 | logAuditEvent wrapper (3-mode failure per Q2) + 10 retrofits + can.ts TODO | +35 | 0 | `feat(phase-5.1): logAuditEvent wrapper (3-mode failure) + retrofit 10 callsites` |
| 5.1d | scan-api-routes audit-coverage CI gate | +5 | 0 | `feat(phase-5.1d): audit-coverage scanner + nightly.yml integration` |
| 5.2 | AI budget cascade + atomic increment SQL helper | +20 | 1 | `feat(phase-5.2): AI budget cascade resolver + atomic increment helper` |
| 5.3 | withAIBudget middleware + wire 4 known student-AI routes | +30 | 0 | `feat(phase-5.3): withAIBudget middleware + wire 4 known student AI routes` |
| 5.3d | scan-ai-calls budget-coverage CI gate (Q6 resolution) | +5 | 0 | `feat(phase-5.3d): scan-ai-calls budget-coverage CI gate + nightly.yml integration` |
| 5.4 | Export + soft-delete endpoints + manual runbook + scheduled_deletions writeback | +25 | 0 | `feat(phase-5.4): /api/v1/student/[id]/{export,delete} + runbook` |
| 5.5 | scheduled_deletions table + retention cron + scheduled hard-delete cron (Q5 + Q7 resolutions) | +25 | 1 | `feat(phase-5.5): scheduled_deletions table + retention cron + hard-delete cron` |
| 5.6 | Teacher audit-log view route | +8 | 0 | `feat(phase-5.6): GET /api/v1/teacher/students/[id]/audit-log` |
| 5.7 | Cost-alert fire drill + Sentry PII scrub verification (manual) | +0 | 0 | `docs(phase-5.7): cost-alert + Sentry PII scrub verification` |
| 5.8 | Registry hygiene + close-out + 2 new FUs filed | +0 | 0 | `chore(phase-5.8): registry sync + close-out` |
| **Total** | — | **+153 (3291 → 3444)** | **2** | **11 commits** |

**Estimated effort: ~4–4.5 days** (master spec said 3; Lesson #59 audit + Q2 3-mode failure + Q5 scheduled_deletions table + Q6 5.3d scanner push it to 4–4.5d).
**FUs to be filed at close:** `FU-AV2-AUDIT-EVENT-GROUPING P2` (Q4 deferral), `FU-AV2-RETENTION-ACTIVE-STUDENT P2` (Q7 deferral).

---

## 9. References

- Master spec — Phase 5 section: `docs/projects/access-model-v2.md` lines 267–276
- Master spec — Decision 3 (audit log): lines 105–108
- Master spec — Decision 4 (retention forever, partition deferred): line 4 of §7
- Master spec — Decision 6 (per-student AI budgets, cascade): lines 120–131
- Master spec — §3 items 33–35 (manual export runbook, retention cron, RLS-no-policy doc)
- Master spec — §6 risks (Phase 5a audit gate; MFA reset)
- Master spec — §12 Parallel pilot-readiness track (audit log F22, data export F32, retention F19, cost-alert F24, Sentry F25)
- Predecessor brief — Phase 4 part 2: `docs/projects/access-model-v2-phase-4-brief.md`
- Predecessor checkpoint — A5b: `docs/projects/access-model-v2-phase-4-checkpoint-a5b.md`
- Build methodology: `docs/build-methodology.md`
- Lessons learned: `docs/lessons-learned.md` (re-read #29, #34, #38, #39, #43–46, #54, #59, #60, #61, #64, #66, proposed #67)
- Existing audit log table migration: `supabase/migrations/20260428215923_class_members_and_audit_events.sql`
- Existing AI budget tables migration: `supabase/migrations/20260428220303_ai_budgets_and_state.sql`
- Existing cost-alert pattern: `src/lib/jobs/cost-alert.ts` + `scripts/ops/run-cost-alert.ts` + `src/lib/jobs/README.md`
- Sentry installation: `package.json` (`@sentry/nextjs 10.43.0`) + `src/instrumentation.ts` + `src/instrumentation-client.ts`
- Active-sessions tracker: `/Users/matt/CWORK/.active-sessions.txt`
- IT audit referenced throughout: `docs/projects/studioloom-it-audit-2026-04-28.docx` (filed in repo per master-spec §1.5)
