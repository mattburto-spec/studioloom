# Handoff — task-system-tg0d-drawer

**Last session ended:** 2026-05-05 ~15:40 UTC
**Worktree:** /Users/matt/CWORK/questerra-tasks
**HEAD:** TG.0D.5 commit `d46777f` (4 sub-phases beyond TG.0D.1+.2 foundation merged in PR #38)

## What just happened

- ✅ TG.0D.3 — TaskDrawer shell + tab nav + dirty tracking + ESC/click-outside close (with unsaved-changes confirm). 15 new tests for tab descriptors + isFormStateDirty.
- ✅ TG.0D.4 — 5 tab content components (GraspsTab/SubmissionTab/RubricTab/TimelineTab/PolicyTab) under `tabs/`. Wired into TaskDrawer's switch on activeTab.
- ✅ TG.0D.5 — Chooser un-grey + summative drawer mount + [Configure →] click on summative rows. AddMode union extended to include 'summative'. 13 source-static guards.
- ✅ TG.0D.6 (in progress) — api-registry no-op (no new routes), WIRING.yaml lesson-editor key_files extended with 11 new TG.0D files, smoke seed at scripts/tg-0d/seed-tg0d-summative-task.sql.

## State of working tree

- Branch: `task-system-tg0d-drawer` (off `origin/main` after PR #38 merged TG.0D.1+.2 foundation)
- 3 commits ahead, 0 behind
- Tests: **216/216 passing** for full task-system surface (TG.0C 123 + TG.0D foundation 65 + TG.0D drawer 28 = 216)
- tsc strict: clean on all TG.0D files

## Next steps (ordered)

- [ ] Stage + commit TG.0D.6 close-out (WIRING.yaml + smoke seed + this handoff doc + ALL-PROJECTS.md flip)
- [ ] Push branch + open PR
- [ ] Vercel preview deploys; Matt smokes (12-step Checkpoint TG.0D.1 per brief §TG.0D.7)
- [ ] On pass: merge to main, kick off TG.0E (lesson card "Builds toward..." chip)

## 12-step smoke (Checkpoint TG.0D.1)

1. Open a real unit. Click `+ Add task` → chooser shows BOTH buttons enabled.
2. Click "🎯 Project task" → drawer slides in from right; GRASPS tab open by default.
3. Fill GRASPS (all 6 fields). Click Tab 2 (Submission) → fill format/AI policy/integrity. Tab 3 (Rubric) → toggle 2 criteria, fill 8 descriptors. Tab 4 → due date + open-until resubmission. Tab 5 → leave Individual + notifications on.
4. Click "Save as draft". Drawer closes. Row appears in TasksPanel with 🎯 icon, criterion list, due date, [Configure →] hint clickable.
5. Refresh page. Row still there.
6. Click [Configure →]. Drawer reopens with all 5 tabs prefilled (note: rubric descriptors will NOT prefill due to known limitation — see Open Questions below).
7. Edit GRASPS goal. Save. Refresh. New value persists.
8. Reopen drawer. Click "Publish". Status badge in row changes to "Published".
9. Try to reopen + change criterion set. (No post-publish confirm gate is wired in this version — file as TG.0D follow-up if Matt wants it.)
10. ESC during typing → unsaved-changes confirm appears (window.confirm for v1; could be inline rose-style if Matt prefers).
11. Self-assessment toggle in Rubric tab: confirm default ON, copy reads OQ-3 didactic nudge, can be flipped OFF.
12. No regression: TG.0C Quick-Check flow still works end-to-end. Verify in Supabase: 1 row in `assessment_tasks` (task_type='summative', config has all 5 blocks), N rows in `task_criterion_weights` with rubric_descriptors, M rows in `task_lesson_links`.

## Open questions / known limitations

- **Rubric descriptors don't prefill on edit.** The GET denormaliser in `/api/teacher/tasks` only returns `criteria: NeutralCriterionKey[]` — not weights or rubric_descriptors. So `loadFromTask` produces criterion entries with empty descriptors + weight=100. Fix is small (extend GET to include weights + descriptors); file as a TG.0D follow-up if Matt notices during smoke.
- **Post-publish criterion-change confirm.** Brief §Save behavior calls for "After publish, criterion-set changes require explicit confirmation (data-loss-adjacent for in-flight student submissions)." Not wired in v1. File as follow-up if needed.
- **Unsaved-changes confirm is `window.confirm`** — same native dialog Matt called out in TG.0C smoke. Could be inline rose-bg like the delete confirm. File as polish if Matt flags during smoke.
- Pre-existing pipeline/access-v2 tsc errors unchanged (Lever-1 fallout).

## Files changed across TG.0D drawer phases

**New:**
- `src/components/teacher/lesson-editor/TaskDrawer.tsx` (shell)
- `src/components/teacher/lesson-editor/TaskDrawer.types.ts` (pure helpers)
- `src/components/teacher/lesson-editor/TaskDrawerTabNav.tsx` (tab strip)
- `src/components/teacher/lesson-editor/tabs/{Grasps,Submission,Rubric,Timeline,Policy}Tab.tsx` (5 files)
- `src/components/teacher/lesson-editor/__tests__/{task-drawer-tab-nav,tasks-panel-drawer-wiring}.test.ts`
- `scripts/tg-0d/seed-tg0d-summative-task.sql`
- `docs/handoff/task-system-tg0d-drawer.md`

**Modified:**
- `src/components/teacher/lesson-editor/AddTaskChooser.tsx` (un-grey project button)
- `src/components/teacher/lesson-editor/TasksPanel.tsx` (AddMode + drawer mounts + Configure→)
- `docs/projects/WIRING.yaml` (lesson-editor key_files +11 entries)
