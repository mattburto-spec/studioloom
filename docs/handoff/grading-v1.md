# Handoff — grading-v1

**Last session ended:** 2026-04-27T13:55Z
**Worktree:** /Users/matt/CWORK/questerra-grading
**HEAD:** 33a0f76 "feat(grading): grading_v1 migration body — student_tile_grades + audit table"

## What just happened

Migration claimed on origin, body authored with six future-proof additions, decisions logged. Two new commits on `grading-v1` (`b4ffc3d` + `33a0f76`), both pushed. No SQL has hit a real Postgres yet — that's the next session's first action.

- `b4ffc3d` — Empty stub minted via `new-migration.sh grading_v1_student_tile_grades` and pushed immediately to claim timestamp `20260427133507` on origin.
- `33a0f76` — Full migration body. Two new tables (`student_tile_grades` + `student_tile_grade_events` audit), 9 indexes, 4 RLS policies, updated_at trigger, idempotent JSONB backfill in PL/pgSQL DO block. Paired `down.sql` drops both tables but does NOT reverse the JSONB backfill (rationale: once grade rows reference minted IDs, removing them orphans grade data — standard PostgreSQL pattern for additive backfills).
- **Six future-proof additions** baked into v1 schema (Matt approved 27 Apr): companion audit table, `released_score`/`released_criterion_keys` snapshot, `ai_confidence NUMERIC(3,2)` (not enum), `graded_by` separate from `teacher_id`, `ai_model_version`+`prompt_version`, `marking_session_id`. See commit message + decisions-log entry for full rationale.
- Decisions log updated — see [`docs/decisions-log.md`](../decisions-log.md) entry "Grading G1 — four data-model decisions (27 Apr 2026)" capturing all four design calls (Path A neutral keys, inline backfill, no-reverse `down.sql`, six future-proof additions).

## State of working tree

- **Clean.** No staged or unstaged changes.
- **Branch:** `grading-v1`. **Tracks `origin/grading-v1`** — both commits pushed; `origin/main` untouched per discipline.
- **7 commits ahead of origin/main**, none merged. Safe to keep this way until checkpoint signs off + migration applied to prod.
- **Test count:** 2215 passed, 9 skipped (unchanged — no app code touched).
- **`.env.local`** still symlinked to `/Users/matt/CWORK/questerra/.env.local` (production env).
- **`.active-sessions.txt`** row updated to reflect "migration body authored + pushed; awaiting apply".
- **No psql / supabase CLI available locally** in this worktree — apply must go through Supabase dashboard SQL editor (or whatever local-staging workflow Matt prefers).

## Next steps — ordered

- [ ] **Apply migration body to local/staging Supabase first.** Paste the contents of [`supabase/migrations/20260427133507_grading_v1_student_tile_grades.sql`](../../supabase/migrations/20260427133507_grading_v1_student_tile_grades.sql) into the dashboard SQL editor. The DO block at the top is the JSONB backfill — should print a NOTICE like `grading_v1 backfill: minted N V2/V3 activityIds, M V4 ids` (expected: V2/V3 minted ≈ 64 across 4 units in prod; locally depends on what data is loaded).
- [ ] **Re-run probe:** `npx tsx -r dotenv/config scripts/grading/probe-tile-id-coverage.ts`. Legacy must drop to 0%. If non-zero, the backfill missed a shape — investigate before proceeding.
- [ ] **Verify schema:** confirm both tables exist with expected columns, RLS is enabled, GIN index present on `criterion_keys`, the 4 indexes on the events table all exist. SQL: `SELECT * FROM pg_tables WHERE tablename IN ('student_tile_grades','student_tile_grade_events');` + `\d+ student_tile_grades`.
- [ ] **Smoke insert from psql or service-role:** insert one fake tile grade with criterion_keys `['designing']`, confirm CHECK constraint accepts; try inserting `['bogus_key']` and confirm CHECK rejects. Insert one event with each of the 6 source values, confirm none reject.
- [ ] **Apply to prod Supabase** once local verifies clean. Standard procedure (dashboard SQL editor). Rerun probe against prod to confirm 0% legacy.
- [ ] **Run `bash scripts/migrations/verify-no-collision.sh`.** Must exit clean before any merge to main.
- [ ] **Begin G1.1 (Calibrate view) only after migration applied to prod.** First component to extract: `ScorePill` (the dashed/solid border atom from [`docs/prototypes/grading-v2/grading-v2.jsx:248`](../prototypes/grading-v2/grading-v2.jsx)). Service module to write the grade + event rows in a single transaction lives at `src/lib/grading/save-tile-grade.ts` (planned).

## Open questions / blockers

- **Apply step is human-driven.** No CLI in this repo, `.env.local` points to prod, no apply script under `scripts/`. The next session should expect to either paste SQL into the Supabase dashboard or have a local Postgres instance set up to run the SQL against. Once it's been run somewhere real, capture any errors here.
- **PL/pgSQL DO block has no precedent in this codebase.** This is the first migration in `supabase/migrations/` to use `DO $$ ... $$` with `FOR ... LOOP` JSONB walking. Reviewed visually before commit; the loop binds `JSONB` scalars via the `SELECT value FROM jsonb_array_elements(arr) AS t(value)` form (safer than SRF-in-select-list). If the apply emits a syntax error, the most likely culprit is variable typing or `||` semantics on JSONB — fix in place + amend the body commit.
- **Q2 (AI off-by-default per class)** still pending. Default applied in code unless overridden — landing the toggle column on `classes` (`ai_grading_enabled BOOLEAN DEFAULT false`) is a separate micro-migration during G1.3, not part of this one.
- **`assessment_records` rollup-write trigger** — not part of this migration. Defer to G1.4 (Synthesize "Release to <student>" code path) when the rollup writer lives at `src/lib/grading/release-to-student.ts`. Migration does NOT touch `assessment_records`.
