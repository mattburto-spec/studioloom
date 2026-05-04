# Handoff — access-model-v2-phase-6

**Last session ended:** 2026-05-04 (post-saveme)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** `9ca8e5f` "fix(deps): Next 15.3.9 → 15.5.15 (Bucket B) + file Bucket C residual vulns FU"

> **Status: Access Model v2 PILOT-READY ✅** — `v0.6-pilot1` tagged on the merge commit. All architectural blockers closed. CRON_SECRET set in Vercel + redeployed. Only operational polish remaining.

## What just happened (this session)

- Closed Phase 6 sub-phases 6.0 → 6.7 across multiple commits, merged to main as `912ddd8` + `b66f04a` + `394c4fb`. Tagged `v0.6-pilot1`.
- Wired Vercel Cron Jobs (3 routes) + set CRON_SECRET in Vercel — closes FU-AV2-CRON-SCHEDULER-WIRE.
- Fixed npm audit 6 → 4 vulns (xmldom + dompurify HIGH + Next.js 15.3.9 → 15.5.15). 4 moderate residuals filed as P3 FU-DEPS-RESIDUAL-MODERATE-VULNS.
- Ran `saveme` — registries synced, ALL-PROJECTS.md status updated, changelog session entry appended.

## State of working tree

- Branch: `access-model-v2-phase-6`
- Working tree state at `saveme` time: clean apart from saveme-generated changes (registry yaml updates, ALL-PROJECTS.md, changelog.md, this handoff)
- Tests: 3494 passed / 11 skipped
- Migrations: clean vs origin/main; phase_6_1_drop_student_sessions APPLIED to prod
- Scanner reports: clean status (modulo unrelated pre-existing feature-flags drift on SENTRY_AUTH_TOKEN, auth.permission_helper_rollout, RUN_E2E)
- Vercel: deploys live with Next 15.5.15 + CRON_SECRET active

## Next steps — Matt's action checklist

- [ ] **Watch the first cron fire** — Vercel dashboard → Logs → filter path `/api/cron/cost-alert` (fires daily 06:00 UTC = 14:00 Nanjing). Should see `{ok: true, job: "cost-alert", ...}` JSON response. If 401, CRON_SECRET wasn't picked up by the deploy.
- [ ] **Sentry alerts setup** (post-pilot polish, not blocking):
  - Alert on first `audit_events` insert failure in 24h (catches the `failureMode: 'soft-sentry'` path firing for real)
  - Alert on first cost-alert email send (so you know when AI cost crossed the threshold)
- [ ] **Pilot smoke checklist** when first NIS student lands in prod — verify the 5 critical paths work for a real student in a real class.
- [ ] **Tag pilot baseline** as `v0.x-pilot1` once first NIS class lands (separate from the architectural `v0.6-pilot1` tag) for one-tag rollback per master spec freeze policy.
- [ ] (Optional) Address dashboard.html ↔ ALL-PROJECTS.md drift surfaced by `check-dashboard-sync.ts` — drift predates Phase 6; ~50 missing dashboard entries plus 1 status mismatch on "ELL — Language Support". Causes nightly red email but doesn't block anything.

## Open questions / blockers

_None pilot-blocking._

7 follow-ups carry forward (none pilot-blocking):
- FU-AV2-LTI-PHASE-6-REWORK (P2) — needed before next-school onboarding (NIS doesn't use LTI)
- FU-AV2-CROSS-TAB-ROLE-COLLISION (P2) — mitigated by middleware; deeper fix is post-pilot
- FU-AV2-WRONG-ROLE-TOAST (P3) — UX polish on the redirect
- FU-AV2-STALE-TIMETABLE-LINK (P3) — Next.js prefetch noise
- FU-STUDENT-PROGRESS-CLIENT-400 (P3) — frontend widget hits stale column
- FU-AV2-API-V1-FILESYSTEM-RESHUFFLE (P3) — opportunistic when v2 actually ships
- FU-DEPS-RESIDUAL-MODERATE-VULNS (P3) — wait for upstream (Next bundles old postcss; uuid in exceljs transitive)
