# Handoff — claude/saveme-student-ui-rename

**Last session ended:** 2026-05-16T12:30:00Z (approx)
**Worktree:** `/Users/matt/CWORK/questerra/.claude/worktrees/vigorous-darwin-2befdc`
**HEAD:** `f0160f79` "refactor(student-ui): rename "Unit" → "Project" in student-facing copy (#329)"

## What just happened
- Two-pass audit + apply of the student-side "Unit" → "Project" UI rename. PR [#329](https://github.com/mattburto-spec/studioloom/pull/329) merged to main; squash commit `f0160f79`.
- 10 files / 25 string sites. Surface change only — no data model, routes, API paths, types, or AI prompts touched. Teacher-side "Unit" vocabulary preserved.
- Production smoke confirmed by Matt: top nav "Projects", section heading "Your projects · …", smooth scroll on anchor click, all renamed surfaces reading correctly.
- This branch (`claude/saveme-student-ui-rename`) carries the follow-up saveme commit: changelog entry, decisions-log entries, scanner-report refresh. Will merge as its own PR.

## State of working tree
- Clean except for: (a) intentional saveme additions to `docs/changelog.md`, `docs/decisions-log.md`, `docs/scanner-reports/*.json`; (b) untracked items from prior sessions (`docs/handoff/claude__fold-attention-into-nm-tab.md`, `docs/mockups/`, `docs/projects/agency-primitive-and-unit-openers.md`, `docs/projects/class-dj-followups.md` — not mine).
- Pre-existing WIP for `CLAUDE.md`, `docs/decisions-log.md` (prior), `docs/projects/3delements.md`, `docs/projects/ALL-PROJECTS.md` was stashed before saveme work began (stash message: "pre-saveme-wip"). Restore with `git stash pop` after switching back to `fix-class-dj-teacher-thinking-rotation`.
- Pending push: this branch is fresh from origin/main + my saveme commit. Push when ready.
- Test count: 5180 baseline preserved (no tests touched).

## Next steps
- [ ] Push + PR + merge this saveme branch
- [ ] After saveme merge: switch back to `fix-class-dj-teacher-thinking-rotation` and `git stash pop` to restore the unrelated WIP on CLAUDE.md / decisions-log / 3delements / ALL-PROJECTS for whoever picks up that work
- [ ] **Phase 3 (URL rename)** — `/student/unit/[unitId]` → `/student/project/[projectId]` + `/api/student/unit/...` → `/api/student/project/...`. Should bundle the page route + API route renames together. Includes Next.js folder renames + middleware updates + all consumer fixes. Estimate ~1 day.
- [ ] **Phase 4 (data model rename)** — `units` table → `projects`, `unit_type` → `project_type`, `UnitBrief` → `ProjectBrief`, `class_units` → `class_projects`. Plus WIRING.yaml, schema-registry, all internal docs vocabulary sweep. Multi-day. Should be a single coordinated PR with a migration + a docs sweep + a code refactor.
- [ ] **FU-SCHEMA-REGISTRY-YAML-PARSE** (P3) — `docs/schema-registry.yaml:2384` has a YAML parse error blocking `scan-api-routes.py`. Pre-existing, surfaced during saveme registry sync. Fix would unblock the api-registry scanner.
- [ ] Decide what to do with the unrelated class-dj follow-up commit (`69bae83a` on `fix-class-dj-teacher-thinking-rotation`) — was the local branch ever pushed? Need to confirm with the prior session's author.

## Open questions / blockers
- The `refresh-project-dashboard` scheduled task lives at CWORK level (not inside questerra) — saveme step 5 says to trigger it on every saveme but I can't from inside questerra. Matt usually runs this from the parent dir; flagging as not done this session.

_None blocking the rename phases._
