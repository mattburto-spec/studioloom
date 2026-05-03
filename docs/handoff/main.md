# Handoff — main

**Last session ended:** 2026-05-03T07:50Z (Phase 4 part 2 SHIPPED + Checkpoint A5b PASS + merged to main)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**Branch:** `main` — fully synced with origin after FF-merge of `access-model-v2-phase-4-part-2`
**Pending push:** 0
**Tag:** `v0.4-phase-4-closed` at the merge commit

## What just happened (this session)

Marathon Phase 4 part 2 ship. 9 sub-phases shipped end-to-end + applied to prod + smoke-verified + Checkpoint A5b PASS + merged to main.

- **9 sub-phases shipped** (4.5 / 4.7 / 4.7b-0/1/2/3 / 4.6 / 4.8 / 4.8b / 4.9). 11 commits on the feature branch. 8 prod migrations applied in timestamp order. 1 ops change (NIS tier flip + Gmail-Matt detach).
- **3189 → 3291 tests** (+102 new, 0 regressions, tsc strict 0 errors throughout).
- **All sub-phases smoke-verified on prod** via Supabase SQL Editor — schema sanity, CHECK constraints, partial unique indexes, lifecycle transitions, helper return values, trigger end-to-end (4.9 dept_head triggers verified via UPDATE → resync → revoke flow).
- **9 new FUs filed**, 1 closed (FU-AV2-DEPT-HEAD-DEPARTMENT-MODEL).
- **Lessons #54, #59, #64, #66 applied throughout.** Proposed Lesson #67 captured in decisions-log: brief-vs-schema audit at PHASE start (not sub-phase start). Phase 4 part 2 caught the same gap pattern in 4 sub-phases (4.5/4.6/4.8/4.9) — phase-start audit would've batched all 4 catches.
- **Checkpoint A5b PASS** — `docs/projects/access-model-v2-phase-4-checkpoint-a5b.md` written. All criteria green.
- **Merged to main** via throwaway worktree FF-merge per migration discipline.

## State of working tree

- `git status -s`: clean.
- Branch: `main` synced with origin.
- Tag `v0.4-phase-4-closed` at merge commit — rollback baseline.
- Tests: 3291 passed | 11 skipped.
- Typecheck: 0 errors (`tsconfig.check.json` strict).
- Vercel: prod main deployed green at `studioloom.org` with all of Phase 4 part 2 live.
- Branches preserved on origin: `access-model-v2-phase-4-part-2` (record), `access-model-v2-phase-4-hotfix-a5a` (record), `access-model-v2-phase-4-hotfix-topnav` (record), `access-model-v2-phase-4` (record).

## Next steps — Phase 5 (Privacy & Compliance)

Per master spec §4 line 267 (~3 days). Triggers Checkpoint A6.

- [ ] **Audit log infrastructure** — wire `logAuditEvent()` wrapper into every state-mutating route. The wrapper inserts into `audit_events` (table already exists from mig 20260428215923; Phase 4 part 2 already populated it via various inserts during 4.5 cascade / 4.7 impersonation / 4.7b-2 invitations / 4.6 use-requests). CI gate: extend `scan-api-routes.py` to flag any POST/PATCH/DELETE/PUT route lacking the wrapper. Pre-flight check: count routes that already have audit-event inserts vs total mutation routes.
- [ ] **Per-student AI budget middleware** — cascade resolution + atomic state updates via `ai_budget_state` (table already exists from mig 20260428220303). 4-layer cascade per Decision 6: tier default (from `schools.subscription_tier` mapped by admin_settings) → school override (`schools.default_student_ai_budget` — Phase 4.8 column) → class override (`ai_budgets WHERE subject='class'`) → student override (`ai_budgets WHERE subject='student'`). Reset rolls over at midnight in `schools.timezone`. Teacher-visible warning before hard cap.
- [ ] **Data export endpoint** — `GET /api/student/[id]/export` (JSON dump of all student-owned data, RLS-checked).
- [ ] **Data delete endpoint** — `DELETE /api/student/[id]` soft-delete + 30-day hard-delete cron.
- [ ] **Teacher view of student audit log** — `GET /api/teacher/students/[id]/audit-log`.
- [ ] **Retention enforcement cron** — monthly job at `scripts/ops/run-retention-enforcement.ts`. Reads `data-classification-taxonomy.md` `retention_days` per column. Soft-deletes past horizon; hard-deletes past `retention_days + 30`.
- [ ] **Cost-alert pipeline live test** — set `COST_ALERT_DAILY_USD=$0.01`, trigger one AI call, confirm Resend delivers email. Document at `docs/security/cost-alert-fire-drill.md`.
- [ ] **Sentry PII scrubbing verification** — open Sentry dashboard, confirm scrubbing enabled, screenshot to `docs/security/sentry-pii-scrub-{date}.png`.
- [ ] **Checkpoint A6** — audit row appears for every state-mutating route in a smoke run; AI budget triggers on synthetic abuse run; export verified for a real student record producing valid JSON; delete verified to soft → hard cascade; retention cron runs cleanly on test data; cost-alert fire drill landed; Sentry PII scrub verified.

## Then Phase 6 (Cutover & Cleanup) → Checkpoint A7 PILOT-READY

Per master spec §4 line 278 (~2-3 days):
- Deprecate legacy student token system (delete dead code, not just `_unused` rename)
- Remove `author_teacher_id` direct-ownership reads (everything via `class_members`)
- Update all 6 registries (schema, api, ai-call-sites, feature-flags, vendors, WIRING)
- Update ADR-003; write ADR-011 (school+governance), ADR-012 (audit log), ADR-013 (API versioning)
- RLS-no-policy documentation for the 7 flagged tables (audit F12)
- API versioning rename pass `/api/*` → `/api/v1/*` with 90-day legacy aliases
- Tag pilot baseline `v0.x-pilot1`
- Checkpoint A7 — PILOT-READY

**Total to PILOT-READY: ~5-6 focused build days from here.**

## Pre-flight ritual for Phase 5 (DON'T SKIP)

1. Re-read `docs/build-methodology.md`
2. Re-read Lessons **#54** (registries can lie — TRIGGERED 4 TIMES IN PHASE 4 PART 2), **#59** (estimates lie when audit hasn't happened), **#64** (RLS recursion), **#65** (old triggers don't know about new user types), **#66** (SECURITY DEFINER search_path lockdown). **Apply Lesson #67 (proposed)** — run a single brief-vs-schema audit at the START of Phase 5 covering all sub-phases at once.
3. Pre-flight registry cross-check (Step 5c) for all sub-phases:
   - Audit `audit_events` table — what columns exist, what the existing inserters write, what the schema-registry says
   - Audit `ai_budget_state` table — same
   - Audit `data-classification-taxonomy.md` — what `retention_days` values are set + which tables have them
4. Run baseline `npm test` (expect 3291 passing).
5. Run `bash scripts/migrations/verify-no-collision.sh` against `origin/main` before any new migration mints.

## Open questions / blockers for Phase 5

- **`logAuditEvent()` wrapper signature decision** — should it be a synchronous fire-and-forget (don't block route response) or sync await? Phase 4 inserts use sync-await. Phase 5 may want async-fire to avoid latency cost on hot routes. Decision belongs in Phase 5 brief.
- **Retention defaults in data-classification-taxonomy.md** — how aggressive is the hard-delete? 30 days post soft-delete is the master-spec default but some tables (audit_events, school_setting_changes) are explicitly "forever in v1" per Decision 4. Reconcile in pre-flight.
- **AI budget reset cron scheduling** — Vercel Cron Jobs vs Supabase Edge Function vs external. Phase 5 picks one.

## Don't forget

- **Phase 4 part 2 fully closed + merged + smoke-verified on prod main.** All 8 migrations applied. Tag `v0.4-phase-4-closed` is the rollback baseline.
- **9 new FUs from part 2 are tracked**: 4 P2 + 5 P3. None blocking Phase 5; some pair with Phase 5 work (FU-WELCOME-WIZARD-STUDENT-EMAIL-GUARD pairs with audit log; FU-AV2-IMPERSONATION-RENDER-WIRING pairs with view-as-as-real-impersonation).
- **`is_platform_admin=true` is on `mattburto@gmail.com`, NOT NIS-Matt.** Gmail-Matt has `school_id=NULL` post-Option-A.
- **NIS is on `'school'` tier**. NIS-Matt has manual `school_admin` responsibility (id `fa8b1cd1-...`). `class_members.source` column populated only for `auto_dept_head` rows from triggers.
- **Loominary-Matt soft-deleted + auth banned** — don't muddy by editing.
- **Wednesday students arrive at NIS.** Phase 5 work is admin-side / cron-side; doesn't affect student-facing teaching directly. Safe to continue through Wednesday's transition.
- **Methodology rule 8** — Phase 5 work happens on a feature branch (`access-model-v2-phase-5`), not main. FF-merge through throwaway worktree at A6 sign-off.

## Key references

- **Brief**: `docs/projects/access-model-v2-phase-4-brief.md` (record — locked at A5b PASS)
- **Checkpoint A5b**: `docs/projects/access-model-v2-phase-4-checkpoint-a5b.md` (written this session)
- **Master spec**: `docs/projects/access-model-v2.md` — Phase 5 §4 line 267, Phase 6 §4 line 278
- **Decisions-log**: `docs/decisions-log.md` — 13+ new entries from Phase 4 part 2
- **Followups**: `docs/projects/access-model-v2-followups.md` — 9 new + 1 closed
- **Changelog**: `docs/changelog.md` — full Phase 4 part 2 session entry
- **Tag**: `v0.4-phase-4-closed`
- **Active sessions**: `/Users/matt/CWORK/.active-sessions.txt` — to-be-updated for Phase 5
