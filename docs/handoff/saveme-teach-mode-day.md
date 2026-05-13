# Handoff — saveme/teach-mode-day (13 May 2026 evening)

**Last session ended:** 2026-05-13T09:20Z
**Worktree:** `/Users/matt/CWORK/questerra/.claude/worktrees/dreamy-booth-73b3cc`
**HEAD before saveme commit:** `905b930` "Merge pull request #230 from mattburto-spec/feat/teach-mode-doing-card"
**Branch:** `chore/saveme-teach-mode-day` (saveme work) — will merge to main as final PR of the day.

## What just happened

- **Teaching Mode Phase 1 SHIPPED** end-to-end. Seven PRs (#221 → #230) including a revert (#222) + a prod incident hotfix (#223) for a Next.js sibling dynamic-route slug conflict in parallel-shipped first-move work. Phase brief at `docs/projects/teaching-mode-checkin-row-phase-1-brief.md`. Full evening summary in `docs/changelog.md`.
- **CheckInRow** above the timer with stuck / falling-behind / absent signals, snooze, empty state.
- **Pace_z math** in `src/lib/teaching-mode/pace.ts` (8 unit tests, hand-computed expected values).
- **Phase scaling** in `src/lib/teaching-mode/scale-phases.ts` (7 unit tests). Workshop phases now respect `teacher_profiles.typical_period_minutes` at render time.
- **Page-scoped `isOnline`** in live-status route — fixed the "551m" stuck-rendering bug; `isOnline` was unit-wide, conflated with page-level `lastActive`.
- **Doing-card surface** in PR #230 — each student's current First Move "doing" kanban card title shows under their name in the grid + appended to check-in chip reasons (` · Wheel design`).
- **Two lessons banked**: #87 (Next.js sibling slug-name routing crash), #88 (revert-first when uncertain). Both in `docs/lessons-learned.md`.

## State of working tree

```
M docs/api-registry.yaml          (scanner caught student_unit_kanban added to /api/teacher/teach/live-status reads)
M docs/projects/ALL-PROJECTS.md   (Last-updated paragraph extended with evening Phase 1 summary)
M docs/lessons-learned.md          (+#87, +#88 appended)
M docs/changelog.md                (new top-of-list entry for evening session)
M docs/scanner-reports/rls-coverage.json (timestamp drift; RLS clean status preserved)
?? docs/handoff/saveme-teach-mode-day.md (this file)
```

Plus ambient timestamp drift in `docs/scanner-reports/ai-budget-coverage.json` + `audit-coverage.json` from the scheduled scanner cron — left unstaged across sessions; previously stashed earlier today.

All teaching-mode tests pass (24 across 3 files: pace, scale-phases, live-status-label). `tsc --noEmit --project tsconfig.check.json` clean.

No migrations applied this evening — Phase 1 was deliberately no-migration. Earlier 13-May session applied `20260513034648_class_unit_lesson_schedule` + `20260513051223_fabrication_jobs_quantity`; both still need `applied_migrations` tracker rows logged (carried from this morning's handoff).

## Next steps

- [ ] **Merge the saveme PR to main** (this branch, `chore/saveme-teach-mode-day`).
- [ ] **Smoke the evening's work in Matt's next class** — design science class tomorrow morning is the natural moment:
  - Doing-card line appears under student names where applicable
  - Doing-card appended to stuck/behind chip reasons via ` · `
  - Period timer reads 60min (not 45) after scale-phases lands
  - Stuck signal max minutes capped by 5-min online window (no "551m")
- [ ] **Watch for stale Doing cards from yesterday's class.** Filed as `FU-TEACH-DOING-CARD-STALE` (P3). If students don't re-commit each day via First Move, prior-day cards keep showing. Decide between auto-clear (if `card.movedAt > 24h ago` → treat as null) or visual cue (gray instead of blue).
- [ ] **CI gap for Next.js routing**: `FU-CI-NEXT-ROUTING-SMOKE` (P1) — add `next build` + log-scan to CI to catch sibling-slug conflicts pre-merge. The PR #223 incident proved CI green ≠ deploy-safe for routing changes.
- [ ] **Backlog**: `FU-TEACH-PACE-PER-ACTIVITY` (P2), `FU-TEACH-CHECKIN-AI-COPY` (P3), `FU-TEACH-RESPONSE-QUALITY` (P3), `FU-TEACH-SNOOZE-PERSIST` (P3). All in the Phase 1 brief's "Phase 2 deferred" section.
- [ ] **Migration tracker backfill** from earlier 13 May session (two `INSERT INTO public.applied_migrations` rows for `class_unit_lesson_schedule` + `fabrication_jobs_quantity`).

## Open questions / blockers

_None._ The work landed clean. Production is healthy after the slug-conflict hotfix. The First Move feature (Matt's parallel session) is also healthy post-#223 and now has the doing-card surface integrated.

If you reopen Teaching Mode and the CheckInRow doesn't appear with expected signals, first verify:
1. Refresh once — the 30-second poll catches stale state
2. Confirm `teacher_profiles.typical_period_minutes` is set if the timer should show 60 (the scaling needs the value present)
3. Check console for any `slug names` errors — the hotfix should have killed those, but worth watching for a few days

The saveme branch is on `905b930`; the only thing left is the saveme commit + PR + merge.
