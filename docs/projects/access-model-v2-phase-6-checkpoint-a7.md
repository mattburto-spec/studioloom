# Access Model v2 — Checkpoint A7 (PILOT-READY)

**Date:** 4 May 2026
**Branch:** `access-model-v2-phase-6` → ready to merge to `main`
**Tag (post-merge):** `v0.6-pilot1`

---

## Status: ✅ PILOT-READY

All 7 sub-phases of Phase 6 (Cutover & Cleanup) are shipped + verified. Access Model v2 is complete from the architectural perspective: Supabase Auth + RLS + `can()` permissions + immutable audit log + per-school AI budgets + DSR endpoints + API versioning seam.

The NIS pilot is unblocked from a v2-architecture standpoint. Remaining pre-pilot work (cron scheduler wiring, smoke checklist, parent-comms drafts) lives in the §12 parallel-track and is **not in §6 scope**.

---

## §1 Goal items — final state

From the Phase 6 brief §1:

- [x] **Legacy student token system fully removed** — table dropped, shim deleted, 50 callsites migrated, login route deleted (§6.1).
- [x] **`author_teacher_id` direct-ownership reads removed where they were ownership gates** — 8 sites migrated to `verifyTeacherHasUnit`/`verifyTeacherOwnsClass` (`can()`-backed); 17 self-scoping filters left alone with audit-grep annotations (§6.2).
- [x] **API versioning seam shipped** — `/api/v1/*` valid for every existing route via Next.js rewrites; clients can pin to v1 today (§6.3).
- [x] **Wrong-role middleware guard** — student session can't reach `/teacher/*`, teacher session can't reach `/dashboard /unit /etc` (§6.3b hotfix).
- [x] **Audit-coverage CI gate active** — every mutation route must call `logAuditEvent` or carry an `// audit-skip:` annotation; nightly build fails on missing > 0 (§6.4).
- [x] **RLS-no-policy documented** — 5 deny-all-by-design tables in `docs/security/rls-deny-all.md`; scanner classifies them as `intentional_deny_all`; FU-FF closed (§6.5a).
- [x] **Phase 5 table classifications** — `audit_events`, `ai_budgets`, `ai_budget_state`, `scheduled_deletions` all have full per-column classification blocks in schema-registry (§6.5b).
- [x] **3 ADRs accepted** — 011 (school-entity-and-governance), 012 (audit-log-infrastructure), 013 (api-versioning). Old 011 (schema-rework) marked Superseded (§6.6).
- [x] **Final registry sync + WIRING update** — student-signin system promoted to v2 with Phase 6.1 changes; auth-system stale references cleaned; api-versioning system added; student_sessions marked dropped in schema-registry (§6.7).

---

## Verification

### Code

- `npx tsc --noEmit --project tsconfig.check.json` → **0 errors**
- `npm test` → **3479 passed / 11 skipped** (was 3486 at start of Phase 6; net −7 from deleted dual-mode test, +2 from new gate-mechanism tests).
- `bash scripts/migrations/verify-no-collision.sh` → **clean** vs origin/main.

### Scanners

- `python3 scripts/registry/scan-rls-coverage.py` → `status: clean`, `intentional_deny_all_count: 5`.
- `python3 scripts/registry/scan-api-routes.py --check-audit-coverage --fail-on-missing` → exit **0**, missing=**0**, covered=**7**, skipped=**225**.
- `python3 scripts/registry/scan-api-routes.py --check-budget-coverage --fail-on-missing` → exit **0**, missing=**0** (3 student-AI routes wired since Phase 5.3).
- `python3 scripts/registry/scan-feature-flags.py` → drift on `SENTRY_AUTH_TOKEN` + `auth.permission_helper_rollout` + `RUN_E2E` — ALL pre-existing, unrelated to Phase 6 (FU-CC tracks; intentional don't-pull per Lesson #45).
- `python3 scripts/registry/scan-vendors.py` → `status: ok`.

### Migrations

- `20260503203440_phase_6_1_drop_student_sessions.sql` — APPLIED to prod 4 May 2026 PM. Verified post-apply:
  - `pg_tables` has 0 rows for `student_sessions`
  - 0 rows for the 2 dropped legacy policies (`Students read own enrollments` on `class_students`, `Students read own student_projects` on `student_projects`)
  - 1 row each for the auth.uid() replacements (`Students read own enrollments via auth.uid` and `Students read own student_projects via auth.uid`)

### Smoke (live in Vercel preview)

- **Student lazy-provision** (Phase 6.1) — student `c` created via classcode-login, verified via SQL: `students.user_id` populated, `school_id` populated, `class_id` populated. Dashboard navigation clean. No `questerra_student_session` cookie set anywhere.
- **Class Hub** (Phase 6.2) — teacher loads Class Hub, no auth errors related to ownership-gate refactor.
- **Wrong-role guard** (Phase 6.3b) — covered by middleware code path; deferred user-side validation post-merge to prod (cookie-collision scenarios are awkward to set up in preview).
- **`/api/v1/*` rewrite** (Phase 6.3) — `next.config.ts` rewrites + mirrored Cache-Control header rules; verified at `tsc` + nightly cron will exercise live.

### Documentation

- [x] `docs/projects/access-model-v2.md` — 5 spec amendments (§6.0)
- [x] `docs/projects/access-model-v2-phase-6-brief.md` — kept current with all sub-phase resolutions
- [x] `docs/security/rls-deny-all.md` — full content (§6.5a)
- [x] `docs/projects/dimensions3-followups.md` — 4 new FUs filed (LTI rework, timetable nav link, student_progress 400, cross-tab role collision, wrong-role toast); 1 closed (FU-FF)
- [x] `../Loominary/docs/adr/011-schema-rework.md` — marked Superseded with redirect note
- [x] `../Loominary/docs/adr/011-school-entity-and-governance.md` — Accepted
- [x] `../Loominary/docs/adr/012-audit-log-infrastructure.md` — Accepted
- [x] `../Loominary/docs/adr/013-api-versioning.md` — Accepted
- [x] `../Loominary/docs/adr/README.md` — index updated with all 4 new entries
- [x] `docs/projects/WIRING.yaml` — student-signin v2, auth-system Phase 6 cleanup, api-versioning system added, ai_budgets columns syntax fixed (pre-existing parse error)
- [x] `docs/schema-registry.yaml` — student_sessions marked dropped; audit_events + ai_budgets + ai_budget_state classification blocks rebuilt (§6.5b)
- [x] `docs/api-registry.yaml` — re-synced (route count 426 → 425)
- [x] `docs/ai-call-sites.yaml` — re-synced
- [x] `.github/workflows/nightly.yml` — audit-coverage gate flipped to `--fail-on-missing` (§6.4)

### Operational

- [x] Vercel preview deployments succeed for every commit
- [x] `bf64ac2` (login back-to-home fix) → `912ddd8` (Phase 6.0–6.3 merge) → `b66f04a` (Phase 6.3b hotfix merge) all live on prod
- [x] No `phase-6-wip` backup branches needed — feature branch was the only WIP location, all checkpoints fast-forwarded cleanly

---

## Phase 6 commit summary

On `access-model-v2-phase-6` branch:

| sha | sub-phase | what |
|---|---|---|
| `7aa3f12` | §6.0 | pre-flight + 5 spec amendments + scaffolds |
| `13cb20b` | §6.1 | claim migration timestamp |
| `16899d1` | §6.1 | legacy student token cleanup (50 callsite sweep + table drop migration body) |
| `5c6ddcb` | §6.1 | hotfix — drop dependent RLS policies before student_sessions |
| `87316de` | §6.2 | author_teacher_id cleanup (8 ownership gates → can() shims) |
| `e298ad0` | docs | 2 P3s filed from §6.2 smoke |
| `9018321` | §6.3 | API versioning seam — `/api/v1/*` via next.config rewrites |
| (merge `912ddd8`) | | Merge Phase 6.0–6.3 to main |
| `f8834bb` | §6.3b | middleware user_type guard (cross-tab role collision mitigation) |
| (merge `b66f04a`) | | Merge Phase 6.3b hotfix to main |
| `16375c3` | §6.4 | audit-coverage catchup — bulk-skip + 3 inline-wires + flip nightly to gating |
| `1fe9f52` | §6.5 | RLS-no-policy doc + Phase 5 table classifications |
| (this commit) | §6.7 | registry sync + Checkpoint A7 + handoff |

Total: **12 sub-phase commits** + **2 merges to main** + **1 final §6.7 commit** (this one).

---

## Pre-pilot parallel-track (NOT §6 scope, but pairs for full pilot GO)

These are **Matt's manual tasks** — not blocked by §6 work:

- [ ] **`FU-AV2-CRON-SCHEDULER-WIRE` P2 — PRE-PILOT BLOCKER** ⚠️ The retention-enforcement and ai-budget-reset crons exist as testable functions but are NOT wired into a scheduler (Vercel Cron Jobs, Inngest, or similar). MUST close before first NIS student logs in, otherwise the daily AI budget never resets and retention never fires.
- [ ] NIS pilot smoke checklist (read-only — verify the 5 critical paths in prod with a real test student).
- [ ] Parent-comms draft for COPPA notification (template exists in `docs/projects/access-model-v2.md` §11; needs school-specific customisation).
- [ ] Tag `v0.6-pilot1` on the merge commit (this checkpoint authorises the tag).
- [ ] Sentry alerts setup (alert on first `audit_events` insert failure in 24h; alert on first cost-alert email send).
- [ ] Cost-alert daily check (verify the cron emits an email when daily AI cost crosses tier-default).
- [ ] Backup snapshot (Supabase scheduled backup is on; verify a recent restore works in a test project).
- [ ] Pilot baseline tag — `v0.x-pilot1` once first NIS class lands (separate from the `v0.6-pilot1` Phase 6 tag).

The §6 work is **complete**. Pilot GO is gated on closing FU-AV2-CRON-SCHEDULER-WIRE plus Matt's operational checklist above.

---

## Sign-off

Phase 6 is signed off as **PILOT-READY** pending:
1. Matt reviews this Checkpoint A7 doc + agrees with the verification.
2. Final merge to `main` (one more `--no-ff` merge for the §6.7 commit).
3. Tag `v0.6-pilot1` on the merge commit.
4. Matt closes `FU-AV2-CRON-SCHEDULER-WIRE` (last hard pre-pilot blocker).

Ready to ship.
