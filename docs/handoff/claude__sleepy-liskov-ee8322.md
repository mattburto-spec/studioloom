# Handoff — claude/sleepy-liskov-ee8322

**Last session ended:** 2026-05-11T~09:30 UTC
**Worktree:** `/Users/matt/CWORK/questerra/.claude/worktrees/sleepy-liskov-ee8322`
**HEAD:** `ec58b2a` "fix(teacher/classes): surface server error on failed single-add student"

## What just happened

- **Incident closed:** Student-creation 500 traced + fixed. Hand-patched `handle_new_teacher` trigger in prod via Supabase SQL Editor. Codified as repo migration `20260511085324_handpatch_handle_new_teacher_skip_students_search_path.sql`. UI silent-error swallow on `/teacher/classes/[classId]` add-student modal fixed to display the server's `error` field. **PR [#178](https://github.com/mattburto-spec/studioloom/pull/178) is OPEN — needs Matt to merge.**
- **Lesson #83 banked:** prod has NO application-level migration tracking table. Generalises Lessons #65/#66 — same root cause silently sank both prior fixes.
- **Audit brief filed:** [`docs/projects/prod-migration-backlog-audit-brief.md`](docs/projects/prod-migration-backlog-audit-brief.md) — 7-phase plan A→G with named Matt Checkpoints. End-state: a `public.applied_migrations` table backfilled from the audit so this drift class cannot recur.
- **Registries synced:** `api-registry.yaml` picked up 1 new route from a prior PR. `ai-call-sites.yaml` no diff. `vendors.yaml` ok. `rls-coverage.json` clean (124/124). `feature-flags.json` drift unchanged (known FU-CC / FU-DD).
- **Changelog updated** with the full incident timeline + audit scoping note.
- **FU tracker entry** for `FU-PROD-MIGRATION-BACKLOG-AUDIT` extended with the 11 May severity upgrade.

## State of working tree

- `git status`: 5 modified files staged-uncommitted (lessons + changelog + tracker + 2 registry yamls + 1 new brief). The 2 commits already on the branch (`86a2ba9` + `ec58b2a`) are the incident fix (PR #178).
- Tests: not re-run this session (no code changes after the Bucket 2 typecheck). Baseline assumed unchanged from prior `npm test` run.
- Pending push: 2 commits already on `origin/claude/sleepy-liskov-ee8322` (PR #178). This session's saveme work needs to be committed + pushed as a third commit to update the PR — OR split to a new branch if reviewer wants PR #178 to stay scoped to the incident fix alone.

## Next steps — ordered

- [ ] **Commit + push saveme follow-up.** Add lesson + changelog + brief + tracker + scanner-output to PR #178 as a third commit (`docs(saveme): ...`). Decision point: bundle vs split-PR — bundle is fine because the brief is directly downstream of the incident.
- [ ] **Merge PR #178** once you've reviewed it. After merge, the trigger fix is in main.
- [ ] **Answer the 4 open questions at the bottom of the audit brief** before Phase A begins:
  1. Use this worktree or create fresh `questerra-migration-audit`?
  2. Cut-off date (default proposed: 1 Apr 2026)?
  3. Smoke depth per-group (default proposed: light unless RLS/auth)?
  4. Tracking table location (default proposed: `public.applied_migrations`)?
- [ ] **Start the audit (Phase A)** in a dedicated session — fresh head, 4+ uninterrupted hours.
  - Sub-step 1: Pre-flight checklist at the top of the brief.
  - Sub-step 2: Enumerate migrations newer than 2026-04-01.
  - Sub-step 3: Assign each a probe SQL.
  - Sub-step 4: Commit truth-doc skeleton.
  - Sub-step 5: STOP at Checkpoint A.1 for Matt sign-off.

## Open questions / blockers

- **PR #178 open**, not yet merged. The hand-patched SQL is live in prod — the PR only updates the repo. Safe to merge any time; no race condition.
- **Audit open questions** (4) noted above — needed before Phase A.
- **Worktree decision** for the audit: this worktree is on branch `claude/sleepy-liskov-ee8322` which is the incident branch. A fresh worktree would be cleaner. Recommend creating `questerra-migration-audit` for the audit work.

## Companion docs to read on pickup

- [`docs/projects/prod-migration-backlog-audit-brief.md`](docs/projects/prod-migration-backlog-audit-brief.md) — the brief, full plan.
- [`docs/lessons-learned.md`](docs/lessons-learned.md) — Lesson #83 (and #65, #66, #68 as background).
- [`docs/build-methodology.md`](docs/build-methodology.md) — Phase + Checkpoint discipline.
- [`docs/projects/dimensions3-followups.md`](docs/projects/dimensions3-followups.md) — FU-PROD-MIGRATION-BACKLOG-AUDIT entry (now expanded with 11 May findings).
