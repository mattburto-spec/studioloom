# Handoff — task-system-tg0c-build

**Last session ended:** 2026-05-05 ~13:35 UTC
**Worktree:** /Users/matt/CWORK/questerra-tasks
**HEAD:** TG.0C.5 commit `0453510` (4 sub-phases beyond brief PR #33)

## What just happened

- ✅ TG.0A pre-flight + TG.0B schema (PRs #29/#30/#31 + close-out #32) — 5 new tables on prod, 2 ALTERs (student_tile_grades + assessment_records both gain nullable task_id). Path A pivot after 2 prod-apply failures. Lesson #72 banked.
- ✅ TG.0C brief shipped (PR #33). 4 architecture questions all resolved with defaults: panel above lesson list, single-select criterion, empty default linked-pages, project-task button greyed-out.
- ✅ TG.0C.1 — types + validators + client wrappers (`src/lib/tasks/`)
- ✅ TG.0C.2 — POST/GET `/api/teacher/tasks` routes
- ✅ TG.0C.3 — TasksPanel sidebar (read-only, mounted in LessonEditor between UnitThumbnailEditor + LessonSidebar)
- ✅ TG.0C.4 — AddTaskChooser + QuickCheckRow inline form (write surface + reducer extracted per Lesson #71)
- ✅ TG.0C.5 — PATCH/DELETE routes + edit/delete affordances on rows (hover ✎ ✕ icons)
- 🟡 TG.0C.6 — registry sync IN PROGRESS (api-registry scanner picked up 4 routes; WIRING.yaml updated; smoke seed at `scripts/tg-0c/seed-tg0c-test-tasks.sql`)
- ⏸️ TG.0C.7 — Matt Checkpoint TG.0C.1 (8-step smoke per brief) — pending push + PR

## State of working tree

- Branch: `task-system-tg0c-build` (off `origin/main`)
- 6 commits ahead, 0 behind
- Tests: **123/123 passing** for TG.0C surface (66 lib/tasks + route tests, 32 form-state, 25 panel render)
- Full suite baseline at branch start: 3800 passing / 11 skipped
- tsc strict: clean on all TG.0C files (pre-existing pipeline/access-v2 errors unchanged, see FU-LEVER1-PIPELINE-TSC-CLEANUP if it exists, else file as P3)

## Next steps (ordered)

- [ ] Stage + commit registry sync (api-registry.yaml + WIRING.yaml + smoke seed)
- [ ] Push branch to origin + open PR
- [ ] Vercel preview deploys automatically — share preview URL with Matt
- [ ] Matt runs Checkpoint TG.0C.1 8-step smoke (per brief §TG.0C.7)
- [ ] On pass: merge to main, mark TG.0C complete in ALL-PROJECTS
- [ ] Kick off TG.0D (5-tab summative drawer) — separate brief

## Files changed across TG.0C

**New:**
- `src/lib/tasks/{types,validators,client}.ts` + `__tests__/validators.test.ts`
- `src/app/api/teacher/tasks/route.ts` + `__tests__/route.test.ts`
- `src/app/api/teacher/tasks/[id]/route.ts` + `__tests__/route.test.ts`
- `src/components/teacher/lesson-editor/{TasksPanel,TasksPanel.types,AddTaskChooser,QuickCheckRow,quick-check-form-state}.{tsx,ts}`
- `src/components/teacher/lesson-editor/__tests__/{tasks-panel-render,quick-check-form-state}.test.ts`
- `scripts/tg-0c/seed-tg0c-test-tasks.sql`

**Modified:**
- `src/components/teacher/lesson-editor/LessonEditor.tsx` (mount TasksPanel)
- `docs/api-registry.yaml` (4 new routes via scanner)
- `docs/projects/WIRING.yaml` (lesson-editor system gains 9 new key_files + change_impacts)

## Open questions / blockers

- `pages` prop into TasksPanel maps `UnitPage[]` → `{id, title}[]` — coerced inline at the LessonEditor mount. If `UnitPage.id` or `.title` shape changes, the coercion at `LessonEditor.tsx:937-940` needs a tweak.
- The smoke seed (`scripts/tg-0c/seed-tg0c-test-tasks.sql`) is parameter-bound (`\set` directives). Matt either pastes real UUIDs or skips the seed and creates tasks via the UI — both flows tested.
- No JSX boundary tests for the React components themselves (Lesson #71 — vitest config has no `@vitejs/plugin-react`). All testable logic was extracted to `.ts` siblings; component-mount tests can wait for Playwright if needed.
