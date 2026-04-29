# Handoff — main

**Last session ended:** 2026-04-29T08:30Z (approx)
**Worktree:** `/Users/matt/CWORK/questerra`
**HEAD:** to be set on next commit (saveme commit incoming)

## What just happened

Long session covering:

- **Bug-report screenshot signed URL TTL** bumped 30 min → 4 hr (`d97decd`). Old admin tabs were dying with `InvalidJWT`.
- **Repo hygiene Tier 1** (`9b83a71`) — relocated 247 MB of tracked reference material (`3delements/`, `docs/safety/`, `docs/newmetrics/`, `comic/`, `docs/newlook/`, `docs/lesson plans/`) to `/Users/matt/CWORK/_studioloom-reference/` (sibling, not in git). 5,307 files removed; recovered ~3 GiB free across 7 worktrees. `.gitignore` blocks re-add. Future `git worktree add` skips the bulk.
- **Test fixtures restored** (`5ce589b`) — CI caught that `tests/e2e/checkpoint-1-2-ingestion.test.ts` legitimately depends on 2 of the relocated files. Restored to `tests/fixtures/ingestion/`. Net hygiene saving ~230 MB. Lesson: cross-check `tests/` not just `src/` + `scripts/`.
- **FU-REGISTRY-DRIFT-CI filed** (`3007f38`) — P2 follow-up + 3-layer recommendation (skill update done; pre-commit + CI gate deferred).
- **`build-phase-prep` skill — Step 5c added** — registry consultation now mandatory for any phase touching ≥3 files. Lists 7 registries to consult, requires spot-check vs code, requires registry-sync sub-phase in commit plan. Master CLAUDE.md "Non-negotiables per phase" gets a 9th item codifying the rule.
- **Phase 1 brief DRAFTED** on `access-model-v2-phase-1` branch (`42b2cf7` + amendment `5be1599`, 585 lines). 6 sub-phases covering auth unification: backfill students → auth.users, custom Supabase classcode+name flow, `getStudentSession()`/`getActorSession()` polymorphic helpers, 3-batch route migration of 63 student routes + 17 teacher routes, RLS simplification on 7 tables, registry hygiene. Registry cross-check found WIRING `auth-system.key_files` had drifted to non-existent file (`student-session.ts` — actual is `student.ts`); brief now closes that drift + 4 pre-existing follow-ups (FU-FF, FU-Q, FU-R, partial FU-HH). Awaiting Matt sign-off on synthetic email format + grace-period decisions before §4.1 code starts.

## State of working tree

- `git status --short`: clean (after saveme commit lands)
- `main` pushed to origin (`c3c6457..3007f38` so far this session; saveme commit next)
- Tests: 2642+ baseline (no production code changed today; only docs + .gitignore + skill + test fixture relocation)
- Branches:
  - `main` — clean, all today's work pushed
  - `access-model-v2-phase-1` — 2 commits ahead of main, **local-only**, awaiting sign-off
  - `access-model-v2` — fully merged to main; worktree fast-forwarded
  - Other worktrees (preflight, integrity, dashboard, tap-a-word) — fast-forwarded to main earlier in session

## Next steps

- [ ] **Matt reviews Phase 1 brief** (`/Users/matt/CWORK/questerra-access-v2/docs/projects/access-model-v2-phase-1-brief.md`):
  - [ ] Approve / push back on synthetic email format `student-<uuid>@students.studioloom.local`
  - [ ] Approve / push back on dual-cookie grace-period strategy
  - [ ] Approve / push back on the 6-decision list at end of §3
  - [ ] Optional: push `access-model-v2-phase-1` branch to origin for visibility
- [ ] **Once Matt says "go"**: Phase 1 pre-flight ritual (lessons re-read, baseline tests, active-sessions claim) + research spike to verify Supabase `auth.admin.createSession()` works on Pro Small tier
- [ ] **Phase 1 code work** in `/Users/matt/CWORK/questerra-access-v2` worktree on `access-model-v2-phase-1` branch
- [ ] **After Phase 1 ships + Checkpoint A2 passes**: merge to main, then Phase 2 (OAuth + email/password)

## Open questions / blockers

- **Supabase admin SDK capability** — Phase 1 §4.2 needs `auth.admin.createSession()` (or magic-link fallback) to mint sessions for classcode+name students. Pro Small tier *should* support it but unverified. First action when Phase 1 starts is the research spike.
- **Cookie shape transition** — during the grace window both `questerra_student_session` and `sb-*` cookies coexist. Risk #2 in brief; mitigation in §4.3.
- **`student_sessions` is RLS-enabled-no-policy** (FU-FF was P3 "likely intentional"). Phase 1 promotes it to load-bearing via SSR client paths. Brief §4.5 closes it with explicit deny-all. Before Phase 1 starts, no action — already in plan.
- **FU-REGISTRY-DRIFT-CI Layers 2 + 3** — pre-commit hook + CI gate. Deferred post-Phase-1. Layer 1 (skill update) is live so the next phase brief automatically gets the cross-check.

## Key references

- Phase 1 brief (on feature branch): `/Users/matt/CWORK/questerra-access-v2/docs/projects/access-model-v2-phase-1-brief.md`
- Master spec: `docs/projects/access-model-v2.md`
- Phase 0 brief: `docs/projects/access-model-v2-phase-0-brief.md`
- Build methodology: `docs/build-methodology.md`
- Lessons learned: `docs/lessons-learned.md` — re-read #43, #47, #49, #51, #54, #60, #61
- Today's decisions: `docs/decisions-log.md` — registry cross-check discipline + repo hygiene + bug-report TTL
- Active-sessions tracker: `/Users/matt/CWORK/.active-sessions.txt`
- Reference materials (not in git): `/Users/matt/CWORK/_studioloom-reference/`
- FU-REGISTRY-DRIFT-CI: `docs/projects/dimensions3-followups.md` (last entry)
