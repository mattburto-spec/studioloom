# Handoff — grading-v1

**Last session ended:** 2026-04-28T12:15Z
**Worktree:** /Users/matt/CWORK/questerra-grading
**HEAD:** 4bc688c "feat(grading): G1.1.3 — Calibrate page + ScoreSelector + lesson-tiles helper"

## What just happened

G1.1 sub-phases 0–3 all shipped on the **code side**. Visual smoke at the end of G1.1.3 hit a Next.js dev-server bug that prevents any *new* top-level route from registering — code is clean, but the screen-light-up moment is deferred. Detail in `docs/projects/grading-followups.md` → `GRADING-FU-DEVSERVER-NEWROUTE`.

- `33a0f76` G1 schema migration (student_tile_grades + audit table + JSONB backfill) **applied to prod**.
- `d94e2c7` `page_id` UUID→TEXT fix migration **applied to prod**.
- `dd63006` G1.1.1 — `ScorePill` atom + 25 helper tests.
- `6904f71` G1.1.2 — `save-tile-grade.ts` service + PUT API route + 26 tests.
- `4bc688c` G1.1.3 — Calibrate page (`/teacher/marking`) + `ScoreSelector` + `lesson-tiles` helper + 20 tests. **Visual smoke blocked** on dev-server bug.
- Tests baseline 2215 → **2286** (+71 across G1.1). All pass.
- TypeScript clean on every new file (pre-existing errors elsewhere unrelated).

## State of working tree

- **Clean.** No staged or unstaged changes.
- **Branch:** `grading-v1` tracking `origin/grading-v1`. **11 commits ahead of `origin/main`**, none merged. Stays this way until full G1 checkpoint signs off (per `feedback_push_discipline`).
- **Migrations in prod:** ✅ both `20260427133507_grading_v1_student_tile_grades` and `20260428024002_fix_grading_v1_page_id_type` applied via Supabase dashboard.
- **Tests:** 2286 passed, 9 skipped (locked baseline for the G1.1 phase).
- **Dev-server route bug:** new top-level routes 404 in this worktree's dev mode. Reproduces with both the real page and a minimal placeholder. See follow-up doc for diagnosis steps.

## Next steps — ordered

- [ ] **Resolve the dev-server bug** (per `GRADING-FU-DEVSERVER-NEWROUTE`). Recommended order:
  1. Try `npx next build && npx next start` in this worktree to confirm the code compiles in production mode.
  2. Open `/teacher/marking` from Matt's primary machine running `npm run dev` (different `fsevents` state).
  3. If both fail: `rm -rf node_modules && npm install` in the worktree.
- [ ] **Run Checkpoint G1.1 visual smoke** once the route registers. Verify:
  - `/teacher/marking` (no params) → class picker renders Matt's classes.
  - Click a class → tile strip + per-row Confirm flow renders for the most recently edited unit's first lesson.
  - Confirm a score → `student_tile_grades` row writes + `student_tile_grade_events` row writes (check via Supabase dashboard).
  - CHECK constraint round-trip: a deliberately bad `criterion_keys` payload should 400 with a clear message.
- [ ] **G1.2 — inline override expand panel** (~1 day). Click an active row → expands inline showing the student's full work + 1–8 grid + override note field. The row already has the data shape; G1.2 is presentation + state-management around it.
- [ ] **G1.3 — AI pre-score + draft feedback** (~1 day). Wire Haiku 4.5 call (with `stop_reason==='max_tokens'` guard per Lesson #39), per-class `ai_grading_enabled` toggle (one-column micro-migration on `classes`), ghost values + 1-click Accept. Cost tracked via Dimensions3 cost infra.
- [ ] **G1.4 — Synthesize view + release-to-student rollup** (~0.5–1 day). Per-student vertical, auto-assembled rubric from neutral keys → framework labels via `FrameworkAdapter.toLabel()`, snapshot to `assessment_records.data.criterion_scores[]` AND `released_score`/`released_criterion_keys` on the tile rows.

## Open questions / blockers

- **Dev-server new-route bug** — see follow-up doc. Visual smoke is gated on this. Code itself is verified (TS + 46 unit tests).
- **Q2 (per-class AI default OFF)** — column add (`ai_grading_enabled BOOLEAN DEFAULT false` on `classes`) is a separate micro-migration during G1.3 when AI pre-score wires up. Not part of G1.1.
- **`assessment_records` rollup-write** — defer to G1.4. Migration didn't touch `assessment_records`; that table remains the canonical released-grade record.
- **`GRADING-FU-RPC-ATOMICITY`** — `save-tile-grade` writes are sequential, not atomic. Migrate to Supabase RPC before G4 (consistency checker) ships.
