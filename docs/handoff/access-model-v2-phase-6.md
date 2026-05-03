# Handoff — access-model-v2-phase-6

**Last session ended:** 2026-05-04 (Phase 6 closure)
**Worktree:** `/Users/matt/CWORK/questerra-access-v2`
**HEAD:** [pending §6.7 commit] — see `git log --oneline -1`

## What just happened

Phase 6 (Cutover & Cleanup) is complete. All 7 sub-phases shipped + verified:

- **§6.0** pre-flight + spec amendments + scaffolds
- **§6.1** legacy student token cleanup (`student_sessions` table dropped in prod)
- **§6.2** `author_teacher_id` cleanup (8 ownership gates → `can()` shims)
- **§6.3** API versioning seam (`/api/v1/*` via Next.js rewrites)
- **§6.3b** middleware user_type guard (cross-tab role collision hotfix)
- **§6.4** audit-coverage CI gate flipped to gating (224 bulk-skips + 3 inline-wires)
- **§6.5** RLS-no-policy doc + Phase 5 table classifications (FU-FF closed)
- **§6.6** 3 ADRs accepted (011 school-entity, 012 audit-log, 013 api-versioning); old 011 superseded
- **§6.7** registry sync + WIRING update + this Checkpoint A7

Phase 5 + Phase 6 sub-phases 6.0–6.3b already merged to main. The §6.4–6.7 work is on `access-model-v2-phase-6` branch awaiting final merge.

## State of working tree

- Branch: `access-model-v2-phase-6`
- Clean working tree (after the §6.7 commit lands)
- Tests: 3479 passed / 11 skipped
- Migrations: clean, no collisions vs origin/main
- Scanner reports: all clean

## Next steps — Matt's action checklist

- [ ] **Read the Checkpoint A7 doc** at [`docs/projects/access-model-v2-phase-6-checkpoint-a7.md`](../projects/access-model-v2-phase-6-checkpoint-a7.md) — verify the §1 goal items + verification + parallel-track all match your understanding.
- [ ] **Final merge to main**:
  ```bash
  cd /Users/matt/CWORK/questerra-access-v2
  git checkout main
  git pull origin main
  git merge --no-ff access-model-v2-phase-6 -m "Merge: Access Model v2 Phase 6 — Checkpoint A7 PILOT-READY (sub-phases 6.4–6.7)"
  git push origin main
  ```
- [ ] **Tag the pilot baseline**:
  ```bash
  git tag -a v0.6-pilot1 -m "Access Model v2 PILOT-READY — Phase 6 closed"
  git push origin v0.6-pilot1
  ```
- [ ] **Close `FU-AV2-CRON-SCHEDULER-WIRE` P2 — last hard pre-pilot blocker.** Wire `src/lib/jobs/retention-enforcement.ts` + `src/lib/jobs/ai-budget-reset-cron.ts` into a scheduler (Vercel Cron Jobs is simplest given the Vercel deployment). Without this the daily AI budget never resets in prod.
- [ ] **Smoke `wrong_role` redirects** in two browser windows (one teacher, one student) — confirm Phase 6.3b's middleware guard fires correctly when cookies collide.
- [ ] **Sentry alert setup** — alert on first `audit_events` insert failure in 24h; alert on first cost-alert email send.
- [ ] **Run `saveme`** to sync changelog + cross-project dashboard.

## Open questions / blockers

- `FU-AV2-CRON-SCHEDULER-WIRE` is the only HARD pre-pilot blocker. Everything else is operational polish.
- The cross-tab role collision (FU-AV2-CROSS-TAB-ROLE-COLLISION P2) is mitigated by the middleware guard but the underlying single-cookie limitation remains. Path forward documented in the FU; not pilot-blocking — just use incognito for student QA in the same browser.

## After pilot starts

- Tag pilot baseline as `v0.x-pilot1` (separate from the `v0.6-pilot1` Phase 6 tag) once first real NIS class lands.
- Pilot freeze policy active per master spec: no production deploys during NIS class hours (Nanjing time school day).
- The 4 new P2/P3 follow-ups from Phase 6 (LTI rework, timetable nav link, student_progress 400, cross-tab role collision, wrong-role toast) are post-pilot polish — none of them break user flows for a single-school pilot.
