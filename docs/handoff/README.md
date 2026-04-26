# Session Handoff Notes

Forward-looking pickup state per branch. Each file is overwritten on every
`saveme` — it represents "where I left off RIGHT NOW," not a history log.

History lives in `docs/changelog.md`. Decisions live in `docs/decisions-log.md`.
Lessons live in `docs/lessons-learned.md`. **This directory is for continuity
between sessions on the same branch.**

## Convention

- One file per branch: `docs/handoff/<branch-name>.md`
- Replace `/` in branch names with `__` (so `feature/foo` → `feature__foo.md`).
- Overwrite, don't append. The next session reads it once and picks up.
- Wired into the `saveme` ritual (step 12 in `questerra/CLAUDE.md`).

## How a new session uses it

When you start a session on a branch, the **first** thing to do is:

```
Read docs/handoff/<branch-name>.md and continue from where it left off.
```

If the file is missing or empty, treat the branch as fresh — read CLAUDE.md
and the relevant project doc to bootstrap.

## Template

```markdown
# Handoff — <branch-name>

**Last session ended:** 2026-04-26T18:42Z
**Worktree:** /Users/matt/CWORK/questerra-foo
**HEAD:** abc1234 "feat(foo): bar baz"

## What just happened
- Shipped sub-phase 3 of the X build (commit `abc1234`).
- Tests 1856 → 1872 (+16). Typecheck clean.
- Smoke-tested S1 happy-path → PASS.

## State of working tree
- Clean (nothing staged or unstaged).
- Pending pushes: 2 commits ahead of origin/<branch-name>.
- Migrations applied to local dev: yes / no / not applicable.

## Next steps
- [ ] Sub-phase 4 — wire <component> into <route>.
- [ ] Verify <edge case> from FU-NN.
- [ ] Apply migration <NNN_descriptor> to prod once Checkpoint X.Y signs off.

## Open questions / blockers
- Waiting on Matt's call between Option A vs B for <decision>.
- Vercel build flaky on <reason>; investigate if it recurs.
```
