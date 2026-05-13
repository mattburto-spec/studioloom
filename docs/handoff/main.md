# Handoff — main

**Last session ended:** 2026-05-13T06:30Z
**Worktree:** `/Users/matt/CWORK/questerra` (main worktree)
**HEAD:** `01e5d87` "test(preflight): Phase 5 — quantity validation coverage on validateUploadRequest"

> Supersedes the 12 May 2026 handoff. tfl.3 C.5 (TopNav Marking badge) shipped; this session pivoted to Preflight quantity + Tier 2 scheduling + 3 quick fixes driven by mid-class friction reports.

## What just happened (13 May 2026 session)

Single long session knocked out 5 unrelated wins, all driven by friction Matt hit during his actual G8/G9 teaching:

1. **Preflight quantity (Option A) end-to-end** — migration `20260513051223_fabrication_jobs_quantity` applied to prod. `quantity INT NOT NULL DEFAULT 1 CHECK (1..20)` on `fabrication_jobs`, threaded through validation → upload UI stepper → every render layer (purple × N chip on student/teacher/fab queues + prominent banner on fab job detail). 6 phases (claim → schema → API → UI → render → tests). +6 quantity validation tests + 1 amended insert-payload assertion. Multi-file uploads explicitly deferred ("keep it like this for now" per Matt). Commit chain `2c04345 → 01e5d87`.
2. **Tier 2 per-class lesson scheduling** — migration `20260513034648_class_unit_lesson_schedule` applied to prod. New `class_unit_lesson_schedule` table (per-cohort lesson dates, separate from planning_tasks because same unit may be taught to multiple cohorts at different paces). New `pickTodaysLessonId` pure helper. New `/teacher/classes/[classId]/schedule/[unitId]` schedule editor. Teaching Mode auto-jumps to today's lesson on entry. 5 commits `746d24c → 7897ec9`. RLS coverage 130 → 131 tables.
3. **Edit-lesson shortcut** in Teaching Mode header (`3ddb191`) — 1-click deep-link instead of 3-click round-trip when a mid-class typo surfaces.
4. **Relaxed DELETE gate** for orphaned students (`8ea8ff0` + `3d9badb` + `cc0f9b8`) — `verifyTeacherCanManageStudent` was nuking T2's active student when T1 (former teacher) hard-deleted from their own surface; now checks `class_students` for active enrollments and allows delete only when zero active anywhere. CI break + new mock harness with 4 new test paths.
5. **Onboarding "nothing to share" fix** (`8aac95b`) — Learning Differences page skip pill now visually equal-weight, students without a learning difference can move on without feeling forced into a false-positive.

Then saveme: registry scanners ran clean (api/ai-call-sites yaml diffs empty), questerra changelog appended, ALL-PROJECTS.md compacted (8-May entry archived in HTML comment, tight 13-May summary at top), questerra CLAUDE.md Preflight status line bumped to 13-May, master CLAUDE.md + master changelog updated.

## State of working tree

- Working tree: clean post-saveme commit (will commit + push as part of saveme close-out)
- 0 commits ahead of `origin/main` for code work — all 6 quantity-feature commits already pushed at `01e5d87`. Saveme docs commit + push will follow.
- Test count: ~4874 passing (Preflight quantity validation tests +6)
- tsc baseline: 266 errors (preserved — none introduced this session)
- RLS coverage: 131/131 tables enabled, 126/131 with policies, 5 intentional deny-all (clean)

## Next steps

- [ ] **Log both 13-May migrations to `applied_migrations` in prod** (Lesson #83). One paste:
  ```sql
  INSERT INTO public.applied_migrations (name, applied_at, applied_by, source, notes) VALUES
    ('20260513034648_class_unit_lesson_schedule', now(), 'matt', 'manual',
     'Tier 2 per-class lesson scheduling — separate table from planning_tasks per cohort-pace requirement'),
    ('20260513051223_fabrication_jobs_quantity', now(), 'matt', 'manual',
     'Preflight Option A — quantity 1..20 on fabrication_jobs');
  ```
- [ ] **Smoke Preflight quantity on prod** once Vercel rebuilds — upload with qty=3, check × N chip on student `/fabrication`, teacher queue + detail, fab queue + banner.
- [ ] **Smoke Tier 2 scheduling** — set lesson dates for a class, walk away, return tomorrow, confirm Teaching Mode opens to today's lesson.
- [ ] **Multi-file Preflight uploads** — explicitly deferred ("keep it like this for now"). Revisit only on real demand signal (i.e. a student asks for it, not Matt assuming they will).
- [ ] **Refresh `open-followups-index.md`** if it's still stale (saveme master CLAUDE.md asks for this; nothing was filed this session so counts unchanged).
- [ ] Long-tail: `FU-PROD-MIGRATION-BACKLOG-AUDIT` P1 still open — separate effort, not blocking.

## Open questions / blockers

_None for this branch._ All work shipped + pushed. User confirmed migrations applied to prod; just needs the `applied_migrations` tracker INSERT above.

**Meta-pattern reminder for next session:** Matt built 5 features today, sold 0 things. CompliMate has GACC Decree 280 deadline ~10 days out (1 June 2026) and 0 customer conversations. If next session starts with "what's next?" — gently surface the validation gap before listing more StudioLoom builds. See master CLAUDE.md "The Pattern to Watch For".
