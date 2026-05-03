# Handoff — access-model-v2-phase-5

**Last session ended:** 2026-05-04T02:30Z (approx)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** to be set on §5.8 close-out commit
**Branch:** `access-model-v2-phase-5` (10 commits ahead of `main` at `v0.4-phase-4-closed`)

## What just happened

Phase 5 (Privacy & Compliance) shipped end-to-end. 11 commits across 11 sub-phases (5.0 → 5.8), 195+ new tests (3291 → 3486), 2 migrations (1 applied, 1 pending Matt). Coverage scanners both wired into nightly.yml.

Highlights:
- `logAuditEvent` wrapper with 3-mode failure (`'throw'` / `'soft-warn'` / `'soft-sentry'`) — 12 retrofits + can.ts TODO redesign
- `withAIBudget` middleware with 5-layer cascade + atomic SQL helper — 3 student AI routes wired
- `scheduled_deletions` table + 3 v1-routes (`/api/v1/student/[id]/{export,delete}` + `/api/v1/teacher/students/[id]/audit-log`)
- Two crons (retention + scheduled-hard-delete) shipped as code; scheduling deferred to FU-AV2-CRON-SCHEDULER-WIRE P2
- §5.7 manual-verification runbooks for cost-alert + Sentry PII scrub
- §5.8 registry hygiene: 3 new WIRING systems, scheduled_deletions schema entry, changelog entry, A6 checkpoint doc

7 FUs filed during phase (none A6 blockers). Two NCs caught real test weaknesses + improved them.

## State of working tree

- `git status --short`: clean (after final §5.8 commit)
- Local-only branch — no push to origin
- Tests: 3486 passing / 11 skipped
- tsc strict: 0 errors
- `verify-no-collision.sh`: clean against `origin/main`

## Next steps (Matt's actions for Checkpoint A6)

- [ ] **Apply migration** `20260503143034_phase_5_4_scheduled_deletions.sql` to prod (Supabase Dashboard → SQL Editor; sanity DO-block will fire at apply time)
- [ ] **Smoke test (5 min)**: deploy branch to Vercel preview, test the 3 new endpoints:
  - `GET /api/v1/student/<test-id>/export` → expect JSON with 12 sections
  - `DELETE /api/v1/student/<test-id>?confirm=true` → expect 200 + `students.deleted_at` set + `scheduled_deletions` row visible in Supabase
  - `GET /api/v1/teacher/students/<test-id>/audit-log` → expect the 2 events from above + dedup
- [ ] **AI budget live check (2 min)**: set `students.daily_token_cap_override = 1000` for a test student via SQL Editor; trigger word-lookup; expect 429 with `{ error: 'budget_exceeded', cap: 1000, ... }`
- [ ] **Cost-alert fire drill** per [`docs/security/cost-alert-fire-drill.md`](../security/cost-alert-fire-drill.md) — expect Resend delivers within 5 min; restore threshold + screenshot Resend dashboard
- [ ] **Sentry PII scrub verification** per [`docs/security/sentry-pii-scrub-procedure.md`](../security/sentry-pii-scrub-procedure.md) — confirm toggles + Sensitive Fields list + screenshot
- [ ] **Sign off Checkpoint A6** in [`docs/projects/access-model-v2-phase-5-checkpoint-a6.md`](../projects/access-model-v2-phase-5-checkpoint-a6.md) (tick the PENDING boxes)
- [ ] **Merge to main** via fast-forward in throwaway worktree (`git worktree add ../questerra-merge main` → `git merge --ff-only access-model-v2-phase-5`)
- [ ] **Tag** `v0.5-phase-5-closed` at the merge commit
- [ ] **Update active-sessions row** to point at next session's worktree/branch (probably `access-model-v2-phase-6`)

## Open questions / blockers

- **`FU-AV2-CRON-SCHEDULER-WIRE P2`** — pre-pilot blocker. The Phase 5.5 crons are written + tested but NOT scheduled. Without the cron running, the first DSR delete via `/api/v1/student/[id]` queues a `scheduled_deletions` row that sits forever. Recommended: GitHub Actions schedule with workflow_dispatch + bundle the SUPABASE_SERVICE_ROLE_KEY add with cost-alert wiring. Schedule before Phase 6 ships.
- **`FU-AV2-AUDIT-MISSING-PHASE-6-CATCHUP P2`** — 228 mutation routes inherited from Phase 4 still need audit triage. Phase 6 cutover is the natural seam (touches every route file for `/api/v1/*` rename). Bulk-skip the public/admin-sandbox/lib-delegating tier; inline-wire admin-ops; file as needed.
- **API versioning rename pass** — Phase 6 deliverable. Rename 388 existing unversioned routes to `/api/v1/*` + 90-day legacy aliases. Mechanical but touches every route file.

## Key references

- Phase 5 brief: `docs/projects/access-model-v2-phase-5-brief.md`
- Checkpoint A6 doc: `docs/projects/access-model-v2-phase-5-checkpoint-a6.md`
- Cost-alert fire drill: `docs/security/cost-alert-fire-drill.md`
- Sentry verification: `docs/security/sentry-pii-scrub-procedure.md`
- Manual SQL export runbook: `docs/security/student-data-export-runbook.md`
- Coverage scanner reports: `docs/scanner-reports/{audit-coverage,ai-budget-coverage}.json`
- All Phase 5 FUs: `docs/projects/access-model-v2-followups.md` (search FU-AV2-AI-BUDGET-* + FU-AV2-AUDIT-* + FU-AV2-CRON-* + FU-AV2-EXPORT-*)
- Master spec: `docs/projects/access-model-v2.md` Phase 5 (lines 267–276) + Decisions 3 + 6
