# Handoff — task-system-tg0d-build

**Last session ended:** 2026-05-05 ~14:35 UTC
**Worktree:** /Users/matt/CWORK/questerra-tasks
**HEAD:** TG.0D.2 commit `4dc0dc6`

## What just happened

- ✅ TG.0C polish merged (PR #36) — inline rose delete confirm + thumbnail aspect 16/9→16/5
- ✅ TG.0D brief shipped (PR #37) — 5 architecture questions all defaulted ("go" from Matt)
- ✅ TG.0D.1 — `SummativeConfig` types promoted (5 concrete blocks: GraspsBlock, SubmissionPolicy, ResubmissionPolicy, TimelineBlock, PolicyBlock); validators (`validateSummativeConfig` + helpers); validator dispatch on `task_type='summative'`; route's TG.0D-rejection guard removed; PATCH validator accepts both shapes; `createSummativeTask` client wrapper. 24 new tests.
- ✅ TG.0D.2 — `summative-form-state.ts` pure reducer with 12 actions, INITIAL state matching Matt's brief defaults (1 criterion researching/100, resubmission off, individual, self-assessment ON, integrity ON, notifications ON), `validateSummativeForm` returning per-tab errors, `errorCountsByTab` for tab nav badges, `buildSummativeCreateInput` with throw-on-incomplete guard. 41 new tests.

## State of working tree

- Branch: `task-system-tg0d-build` (off `origin/main`)
- 2 commits ahead, 0 behind
- **Tests: 188/188 passing** for full task-system surface (147 + 41 new today)
- tsc strict: clean on all TG.0D files (2 cast tightenings absorbed in TG.0D.2)

## Next steps (ordered)

- [ ] **TG.0D.3 — TaskDrawer shell + tab nav** (~3hr)
  - `TaskDrawer.tsx`: right-side fixed drawer, w-[480px] per Matt's default, scrim z-40 + panel z-50, ESC + click-outside close (with unsaved-changes confirm via dirty flag), match `StudentDrawer.tsx` pattern from `class-hub/`
  - `TaskDrawerTabNav.tsx` (sibling, pure-ish): 5 tabs in fixed order (1. GRASPS / 2. Submission / 3. Rubric / 4. Timeline / 5. Policy), red badge with error count from `errorCountsByTab(validateSummativeForm(state))`, click → `onTabChange`
  - `__tests__/task-drawer-tab-nav.test.ts`: pure-logic tests for the badge renderer
- [ ] TG.0D.4 — 5 tab content components (~5hr): GraspsTab, SubmissionTab, RubricTab (with self-assessment toggle + nudge copy), TimelineTab, PolicyTab. All thin — read state via reducer, dispatch on input change. No new state.
- [ ] TG.0D.5 — wire chooser un-grey + Configure→ click on summative rows in TasksPanel; addMode gains 'summative' variant; handleSaved already wires through. ~5 source-static guards.
- [ ] TG.0D.6 — registry sync (api-registry no-op since no new routes; WIRING.yaml lesson-editor key_files extension), smoke seed `scripts/tg-0d/seed-tg0d-summative-task.sql`, handoff update, ALL-PROJECTS flip
- [ ] TG.0D.7 — push branch, open PR, Matt smokes (12-step Checkpoint TG.0D.1 per brief). On pass: merge, kick off TG.0E (lesson chip)

## Open questions / blockers

- **Drawer pattern reference:** `src/components/teacher/class-hub/StudentDrawer.tsx` lines 110-115 has the exact backdrop+panel scaffold (`fixed inset-0 bg-black/20 z-40` scrim + `fixed top-0 right-0 h-full w-[420px]` panel). Use 480px instead of 420px per Matt's brief default. Same ESC + click-outside hooks.
- **Self-assessment nudge copy** locked at "Self-assessment is locked-on by default. Hattie's research shows it's the highest-effect feedback mechanism we have (d=1.33). Disable only if you've discussed reasons with students." (didactic version per Matt's "go").
- **Rubric default** = 1 criterion (researching, weight 100). Already in INITIAL_SUMMATIVE_STATE.
- **Resubmission default** = off. Already in INITIAL_SUMMATIVE_STATE.
- **Policy tab ships** as separate (default per Matt). Already wired in tab order + reducer.
- The `loadFromTask` reducer action in TG.0D.2 currently maps `task.criteria` → criterion entries with weight=100 (stub), because the GET denormaliser doesn't yet surface per-criterion weights or rubric_descriptors. **This is a known limitation** — when the drawer opens for an existing summative task, the rubric tab will show empty descriptors. Could be fixed by extending the GET to denormalise weights+descriptors (small route change). File as TG.0D follow-up if Matt notices during smoke.
- Pre-existing pipeline/access-v2 tsc errors unchanged (Lever-1 fallout, FU exists or to be filed).

## Files changed across TG.0D so far

**New:**
- `src/components/teacher/lesson-editor/summative-form-state.ts` (480 lines pure logic)
- `src/components/teacher/lesson-editor/__tests__/summative-form-state.test.ts` (41 tests)

**Modified:**
- `src/lib/tasks/types.ts` (+85 lines for 5 promoted blocks)
- `src/lib/tasks/validators.ts` (+280 lines for summative validators)
- `src/lib/tasks/client.ts` (+24 lines for createSummativeTask)
- `src/lib/tasks/__tests__/validators.test.ts` (+260 lines for 24 summative tests)
- `src/components/teacher/lesson-editor/TasksPanel.types.ts` (1-line cast tightening)
- `src/components/teacher/lesson-editor/QuickCheckRow.tsx` (1-line cast tightening)
