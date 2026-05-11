# Handoff — claude/sleepy-liskov-ee8322 (CLOSED)

**Last session ended:** 2026-05-11T~10:30 UTC
**Worktree:** `/Users/matt/CWORK/questerra/.claude/worktrees/sleepy-liskov-ee8322`
**HEAD:** `8e33ec5` "audit(prod-migration): Phase F + G — AUDIT CLOSED" (plus final saveme commit after this file is written)
**PR:** [#178](https://github.com/mattburto-spec/studioloom/pull/178) — MERGED to main this session.

## What happened — full session

This was a long single session that started as a 500-error incident debug and ended with a 7-phase systemic-fix audit fully shipped. Three meaningfully distinct blocks of work:

### Block 1 — Student-creation incident (morning)
- Diagnosed `POST /api/teacher/students` returning 500 with `"Failed to provision student auth — please retry"`.
- Traced through Vercel logs → Supabase auth logs → root cause: `handle_new_teacher` trigger in prod was migration-001's buggy version (unqualified `teachers`, no `search_path`, no `EXCEPTION`).
- Hand-patched the trigger in prod via Supabase SQL Editor.
- Codified the patch as repo migration `20260511085324_handpatch_handle_new_teacher_skip_students_search_path.sql`.
- Fixed `src/app/teacher/classes/[classId]/page.tsx:347` silent-error swallow — single-add modal now displays the server's error in a red banner.
- Banked Lesson #83 (prod has NO application migration tracking table).

### Block 2 — Saveme + audit scope (mid-morning)
- Saveme run; lesson + changelog + FU-tracker entries written.
- Audit brief at `docs/projects/prod-migration-backlog-audit-brief.md` filed.
- Interim apply log created so migrations applied during the audit didn't create new drift.
- CLAUDE.md interim rule added; audit registered as active build plan.

### Block 3 — Audit shipped end-to-end (afternoon/evening)
All 7 phases A→G of the audit shipped in one session:
- **A (Enumerate):** 83 migrations catalogued with probes. Truth doc filed.
- **B (Probe):** Single CTE with 83 UNION-ALL probes. 77 true on first run. 4 false-negatives re-probed → only 1 genuine APPLY.
- **C (Categorise):** 76 APPLIED + 4 SKIP-EQUIVALENT + 2 RETIRE + 1 APPLY.
- **D (Apply):** Single INSERT for `admin_settings('school.governance_engine_rollout','true'::jsonb)`.
- **E (Tracker):** Created `public.applied_migrations` table (RLS platform-admin-only). Backfilled 81 rows.
- **F (Tooling):** New `scripts/migrations/check-applied.sh`. `scripts/migrations/new-migration.sh` extended with apply-reminder banner.
- **G (Close-out):** CLAUDE.md mandates added; saveme step 11(h) wired; FU resolved; interim log deleted; 2 follow-up FUs filed.

## State of working tree

- `git status`: clean after final saveme commit.
- Tests: not run this session (no npm code changes after Bucket 2 — only docs, SQL, bash scripts).
- PR #178: merged to main.
- Branch `claude/sleepy-liskov-ee8322` can be deleted post-merge.

## Pickup considerations for next session

This branch + worktree are now redundant. Next session should:

- **Use the main worktree** (`/Users/matt/CWORK/questerra`) for new work, or spin up a fresh feature-branch worktree.
- **Delete this branch + worktree** when convenient: `git worktree remove .claude/worktrees/sleepy-liskov-ee8322 && git branch -D claude/sleepy-liskov-ee8322`.

## Open follow-ups filed this session

- `FU-AUDIT-PASS4-CLASSES-DEFAULT-LAB` (P3) — Phase 8-1 backfill's Pass 4 didn't propagate to `classes.default_lab_id`. Non-blocking. Re-run the Pass 4 SQL if class-level default lab routing matters later.
- `FU-MIGRATION-CI-CHECK` (P2) — Optional GitHub Action for PR-time drift block. ~1-2 hours. Last 1% of bulletproofing the migration discipline.

## Companion docs

- [`docs/projects/prod-migration-backlog-audit-brief.md`](docs/projects/prod-migration-backlog-audit-brief.md) — the brief (all 7 phases marked complete).
- [`docs/projects/prod-migration-backlog-audit-2026-05-11-truth.md`](docs/projects/prod-migration-backlog-audit-2026-05-11-truth.md) — 83-row truth doc (Phase A-E complete).
- [`docs/projects/prod-migration-backlog-audit-2026-05-11-probes.sql`](docs/projects/prod-migration-backlog-audit-2026-05-11-probes.sql) — Phase B probe query.
- [`docs/projects/prod-migration-backlog-audit-2026-05-11-probes-review.sql`](docs/projects/prod-migration-backlog-audit-2026-05-11-probes-review.sql) — Phase B re-probes for REVIEW cases.
- [`docs/projects/prod-migration-backlog-audit-2026-05-11-apply-and-tracker.sql`](docs/projects/prod-migration-backlog-audit-2026-05-11-apply-and-tracker.sql) — Phase D + E combined SQL.
- [`scripts/migrations/check-applied.sh`](scripts/migrations/check-applied.sh) — new Phase F drift-detection tool.
- [`CLAUDE.md`](CLAUDE.md) "Migration discipline" — the permanent mandate that closes the drift class.
- [`docs/lessons-learned.md`](docs/lessons-learned.md) → Lesson #83 — the systemic write-up.

## Closing note

The bug class that started this session — *"repo migration silently fails to land in prod; gap detected 12 days later via user error"* — is now structurally prevented. The discipline is mandated in CLAUDE.md, the safety net is wired in saveme, and the optional FU-MIGRATION-CI-CHECK can add CI enforcement when needed.

The next "what's next" item is your call — Lever 0 (manual unit builder), Lever 2-5 (lints / voice / exemplar / sequencing), Open Studio v2, Dimensions3 generation pipeline, or something else entirely.
