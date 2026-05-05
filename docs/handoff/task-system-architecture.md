# Handoff — task-system-architecture

**Last session ended:** 2026-05-05T07:30Z
**Worktree:** `/Users/matt/CWORK/questerra`
**HEAD:** `2a948a3` "Merge pull request #23 from mattburto-spec/task-system-architecture" (after pulling main)
**Branch state:** working branch `task-system-architecture` is at the merged tip; ready to merge or branch off as needed.

## What just happened

- **Task System Architecture brief MERGED to main** (PR #23, `2a948a3`) — 855 lines locking the architectural decision moment for tasks-grading + ManageBac export + Lever 0. Replaces `grading-phase-g1-brief.md` (which was a 3-day cut that sidestepped the assessment_tasks question).
- **Tasks v1 prototype MERGED to main** (PR #21, `1972dda`) — Claude Design probe with 3 artboards. Verdict: SPLIT surfaces, UNIFIED data. Three named teacher-friction moments justify the split.
- **Lever-MM preview banner gap closed** earlier in session (`35ecc9d`) — read-only NM banner on teacher preview at `/teacher/units/[unitId]/preview/[pageId]`.
- **Cowork + Gemini independent reviews completed** — both confirmed Option A (unified data primitive). Cowork's 7 spec corrections all applied to the brief.
- **Saveme ritual completed:** decisions-log appended (7 architectural decisions), changelog appended (full 5 May entry), ALL-PROJECTS.md gained "Task System Architecture (TG)" entry + Lever 0 marked as gated on TG.0B, doc-manifest gained 2 new entries (brief + prototype directory), master index timestamp updated.

## State of working tree

- `git status` clean of code changes; saveme additions in this commit
- 5 untracked unrelated docs from prior sessions still in tree (same set as previous handoff): `landing-copy-story-b.md`, `landing-redesign-prompt.md`, `units-school-id-investigation-29-apr.md`, `brief-generator.md`, `studioloom-it-audit-2026-05-04-v2.docx` — none Lever-MM or Tasks-related; owner-handle
- Tests: **3700 passing / 11 skipped** (parallel-session work absorbed; 0 regressions from this session — pure docs)
- tsc strict: clean
- Pending push count after this saveme commit: 1 (will fast-forward to main)
- Local-only branches: `task-system-architecture`, `unit-editor-nm-block` (Lever-MM), `tasks-v1-prototype` (could be deleted post-merge)

## Next steps

- [ ] **Get sign-off on the brief's 7 open questions** (most are "yes per conversation; confirm"):
  1. Brief scope confirmed (structured-classes only, inquiry/Layer 2/Lever 0 sister projects)
  2. Backfill of existing grades — auto-migrate? (Recommend: yes)
  3. Self-assessment-before-submit gate default-on for summative? (Recommend: yes — Hattie d=1.33)
  4. ManageBac admin-export tooling beyond per-task? (Defer to v1.1)
  5. 5-tab config drawer vs full-page route? (Recommend drawer; escalate at TG.0D if cramped)
  6. Lever 0 schema dependency surfaces? (Action: review Lever 0 sketch PRIOR to TG.0B)
  7. Worktree split? (Recommend: yes, dedicated `/Users/matt/CWORK/questerra-tasks`)
- [ ] **TG.0A pre-flight ritual** — re-read Lessons #67-#71, audit BlockCategory consumers, audit grade-writers, sketch the report query
- [ ] **TG.0B schema migration** (gates Lever 0) — `assessment_tasks` + `task_lesson_links` + `task_criterion_weights` + `submissions` (polymorphic) + `grade_entries` + `student_tile_grades` (re-mint with `task_id NOT NULL FK`) + backfill of existing single-grade-per-unit data
- [ ] **After TG.0B applies:** Lever 0 build can start in parallel with TG.0C-K. Both consume the locked schema.
- [ ] **Promote informal FUs into `dimensions3-followups.md`:**
  - `FU-INQUIRY-MODE-BRIEF` — sister architectural brief
  - `FU-LAYER-2-PM-TOOLS-BRIEF` — Layer 2 cross-mode PM tools
  - `FU-MANUAL-UNIT-DESIGNER-BRIEF` — Lever 0 brief itself
  - `FU-TG-DND-LINKING` (P3) — drag-and-drop section-to-task linking
- [ ] **Wednesday class** (6 May 2026) — Matt uses Lever-MM for the actual NM checkpoints. None of this work is on the critical path.

## Open questions / blockers

- **Migration backlog (`FU-PROD-MIGRATION-BACKLOG-AUDIT`)** still real and material. Lever 1 + Lever-MM smoke surfaced that prod is missing migration 051 + much of Access Model v2 schema. TG.0B applies new tables — needs to land cleanly. Probe `information_schema.columns` on each new table before committing data. Lesson #68 in action.
- **Master index `/Users/matt/CWORK/CLAUDE.md`** — outside this repo; updated this session but not committed (it's not tracked in this repo). Matt commits separately if he wants it tracked elsewhere.
- **CLAUDE.md compaction** still overdue at 56KB. Worth a focused compaction pass on a quiet session — move the historical chunk to changelog.md and leave CLAUDE.md as current-state-only.
- **`refresh-project-dashboard` scheduled task** — not triggered this saveme; assumed it may not exist on this account.
- **Lever 0 brief itself** still pending. Before TG.0B starts, worth sketching Lever 0's likely fields on `assessment_tasks` to confirm the schema's complete (Open Question #6 in the brief).

_Brief: `docs/projects/task-system-architecture.md`. Prototype: `docs/prototypes/tasks-v1/`. PRs: #21 (prototype) + #23 (brief) + previous Lever-MM #19 + Lever 1 #17. All on main._
