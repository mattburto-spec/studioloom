# Handoff — main

**Last session ended:** 2026-05-13T17:00Z
**Worktree:** `/Users/matt/CWORK/questerra` (note: silently moved to `class-dj-block` branch mid-session — see "Open questions" below)
**HEAD on origin/main:** `85c587b` "fix(progress): sticky-complete — autosave can't downgrade complete pages"

> Supersedes the morning's 13-May handoff. Same calendar day, just extended into the afternoon with 4 small journal-card follow-ups + 1 sticky-complete fix surfaced by Matt's class-day smoke.

## What just happened (13 May 2026 — full day)

**Morning session (already in earlier handoff):** 5 wins shipped — Preflight quantity Option A end-to-end (migration `20260513051223`), Tier 2 per-class lesson scheduling (migration `20260513034648`), edit-lesson shortcut in Teaching Mode, relaxed DELETE gate for orphaned students, onboarding "nothing to share" skip fix. Both migrations applied to prod + logged to `applied_migrations`. Saveme covered the broader sweep.

**Afternoon follow-ups (this addendum):** 4 commits, all small + targeted, all on origin/main:

1. **`1b53e48` — drop per-block sentence starters** from JOURNAL_PROMPTS. Matt's call after seeing the per-prompt starter chips: defer sentence-starter scaffolding to a future cross-block system rather than authoring chips per preset. `sentenceStarters` field on `StructuredPrompt` stays in the type for forward compat (future cross-block system will use it). Test regression guard asserts absence in JOURNAL_PROMPTS.
2. **`690ad87` — Phase C: criterion-based target backfill.** Root cause: prompts are SNAPSHOTTED into the activity block JSONB at create-time (`BlockPalette.tsx:235`), so journal blocks created before `a840a85` still rendered 0/80 even though the file had `targetChars: 40`. New `CRITERION_TARGET_DEFAULTS` map (DO=40, NOTICE=40, DECIDE=50, NEXT=30) in the MQR adapter provides fallback when criterion is present but targetChars is not. Adapter extracted to `adapter.ts` sibling per Lesson #71. 7 unit tests.
3. **`c0ac4d1` — Phase C-2: id-based target backfill.** Matt's lesson-1 example exposed a PRE-LIS.D journal block (no criterion tags either). Added `ID_TARGET_DEFAULTS` keyed on prompt ids (`did`/`noticed`/`decided`/`next`) as a third-tier fallback. False-positive risk nil. 2 more tests; 9 total.
4. **`85c587b` — sticky-complete guard in /api/student/progress.** Matt noticed his lesson 1 lost its sidebar green tick after editing the journal. Pre-existing bug: `usePageResponses.ts:202` defaults autosave to `status: "in_progress"`, silently overwriting `"complete"` on every keystroke. Fix at the API: if incoming status would write `"in_progress"` AND existing row is already `"complete"`, drop status from upsert. Applied to both page_id path and page_number fallback.

**Final precedence ladder for journal targetChars (lock for any future edit):**
1. `sp.targetChars` (explicit author override)
2. `CRITERION_TARGET_DEFAULTS[sp.criterion]` (Phase C)
3. `ID_TARGET_DEFAULTS[sp.id]` (Phase C-2)
4. `DEFAULT_TARGET` (80)
Capped by `softCharCap` throughout.

## State of working tree

- **WARNING:** Current local worktree is on `class-dj-block` branch (not main), at `809c88a`. All afternoon commits went to `origin/main` via parallel internal worktrees (`.claude/worktrees/intelligent-thompson-2d91ab`). The user-visible main is `origin/main = 85c587b`. The next session should `git checkout main` in this worktree before continuing — or use the explicit `.claude/worktrees/intelligent-thompson-2d91ab` worktree which IS on main.
- 4 commits on `origin/main` since last saveme, all pushed (`1b53e48 → 690ad87 → c0ac4d1 → 85c587b`)
- Test count: ~4874 → ~4883 (+9 from adapter precedence tests in `adapter-criterion-targets.test.ts`)
- tsc baseline: 266 (preserved)
- RLS coverage: 131/131 (unchanged)
- No new migrations this afternoon (pure app fixes)

## Next steps

- [ ] **Re-stamp lesson 1 as `complete` for Matt's own student account.** The autosave-downgrade bug already moved his row to `in_progress`. Either click "Complete & continue" on lesson 1 again, or run a one-off SQL:
  ```sql
  UPDATE student_progress
  SET status='complete'
  WHERE student_id='<your-student-id>'
    AND page_id='<lesson-1-page-id>';
  ```
- [ ] **Verify the journal counter shows 0/40 (not 0/80)** on existing journal blocks after Vercel rebuild + hard-refresh. Both lesson 1 (pre-LIS.D, id-backfilled) and any post-LIS.D blocks (criterion-backfilled) should now render the per-criterion targets.
- [ ] **Worktree hygiene** — verify which worktree is on main before next session's first commit. `git rev-parse --abbrev-ref HEAD` at start of each commit cycle. Worktree drift caught today via the file-edit notifications showing OLD content (presets.ts still had sentenceStarters) — branch had silently flipped mid-session.
- [ ] Optional cleanup: 2 untracked files in this worktree (`docs/projects/class-dj-block-brief.md`, `docs/projects/class-dj-card-brief.md`) + `research/` dir are scaffolding from a prior class-dj-block session. Decide whether to commit them to that branch or remove.

## Open questions / blockers

- **Worktree branch drift mystery:** at some point between the morning's saveme (which ran in this worktree on `main`) and the afternoon's journal work, this worktree's branch flipped to `class-dj-block`. No `git checkout` was issued in this session's bash history. Most likely cause: an external tool (Claude internal `.claude/worktrees/*` automation, IDE workspace switch, etc.) checked out the branch. The commits still landed correctly on `origin/main` because the `.claude/worktrees/intelligent-thompson-2d91ab` worktree IS on main and that's where the actual commit shipping happened (the local working tree we were editing in stayed on class-dj-block; the writes propagated via stash + checkout + apply cycle when I detected the drift later). The fact that this happens silently is a footgun worth filing as an FU if it recurs.
- **Future cross-block sentence-starter system** — deferred but no design exists yet. When you're ready, the pattern is: a single source of truth (maybe in admin_settings or a constant file) that the renderer reads at runtime, not at create-time. Same precedence ladder we built for targetChars works.
- **Meta-pattern (carry forward from morning handoff):** Matt built 9 things today, sold 0. CompliMate has GACC Decree 280 deadline ~10 days out and 0 customer conversations. If next session starts with "what's next?", gently surface the validation gap before listing more StudioLoom builds.
