# Handoff — grading-v1

**Last session ended:** 2026-04-28T13:20Z
**Worktree:** /Users/matt/CWORK/questerra-grading
**HEAD:** bc8bdab "feat(grading): G1.4 — Synthesize view + release-to-student rollup"

## What just happened

**G1 phase is code-complete.** All four sub-phases shipped + pushed. Vercel preview rebuilds automatically on push (PR #1 is the source of truth). Awaiting Matt's smoke pass on the preview URL before merge.

Commits on `grading-v1` (14 in total, none merged):

| Commit | What |
|---|---|
| `b53649c` | Scaffold G1: brief, prototype, project registration |
| `72ef34e` | Pre-flight audit findings (baseline 2215 tests) |
| `e6d4f4a` | Q1 closed — Option B locked |
| `8e584ef` | Live prod probe — tile-ID coverage |
| `b3e53b8` | Path A locked — framework-neutral `criterion_keys[]` |
| `b4ffc3d` | Migration stub claim |
| `33a0f76` | **Migration body** — `student_tile_grades` + audit + JSONB backfill |
| `f65b9ed` | G1.0 closed (migration applied to prod) |
| `d94e2c7` | **page_id UUID→TEXT fix** (audit-caught pattern bug, applied to prod) |
| `dd63006` | **G1.1.1** — `ScorePill` atom + 25 tests |
| `6904f71` | **G1.1.2** — `save-tile-grade` service + PUT API + 26 tests |
| `4bc688c` | **G1.1.3** — Calibrate page + class picker + tile strip + rows |
| `ca159dd` | Class-units query fix |
| `4565299` | **G1.2** — inline override expand panel |
| `7c3be92` | **G1.3** — AI pre-score + evidence quote (Haiku 4.5) |
| `bc8bdab` | **G1.4** — Synthesize view + release-to-student rollup |

**Test count:** 2215 → **2301 (+86)**. Every sub-phase added pure-helper tests; service-layer mocked Supabase tests; route tests via the prod-smoke loop on the Vercel preview.

**Migrations applied to prod (via Supabase dashboard):**
- `20260427133507_grading_v1_student_tile_grades` — schema + idempotent JSONB backfill
- `20260428024002_fix_grading_v1_page_id_type` — UUID→TEXT correction

## State of working tree

- **Clean.** No staged/unstaged changes.
- **Branch:** `grading-v1` tracks `origin/grading-v1`. **14 commits ahead of `origin/main`**, none merged. Per push discipline + the methodology, stays this way until Checkpoint G1.1 signs off.
- **Tests:** 2301 passed, 9 skipped. TypeScript clean on every new file added in this phase.
- **Vercel preview:** auto-deployed at `studioloom-git-grading-v1-mattburto-specs-projects.vercel.app`. PR #1 (draft) tracks the rebuild status.

## Next steps — ordered

- [ ] **Matt smokes the preview deploy** (the only thing I can't do from this session — auth-gated).
  1. Open the preview URL; log in as teacher.
  2. Navigate to `/teacher/marking`.
  3. Pick a class → Calibrate view loads with tile strip + per-row Confirm.
  4. Click "✨ AI suggest (N)" on the active tile prompt → Haiku populates `ai_pre_score`/`ai_quote`/`ai_confidence`/`ai_reasoning` per student. Quote appears as italic purple text under the student name; expand a row to see the full reasoning + Accept-AI button.
  5. Confirm a row (or override + Confirm) → row writes to `student_tile_grades` + event row writes to `student_tile_grade_events` with the right `source` enum.
  6. Switch to **Synthesize** tab → per-student vertical view with neutral-key rollup pills.
  7. Add a comment + click **Release to <student>** → writes to `assessment_records.data.criterion_scores[]` (framework-labelled via `FrameworkAdapter.toLabel`) AND snapshots `released_score`/`released_criterion_keys` on the contributing tile rows.
- [ ] **Checkpoint G1.1 sign-off** — full smoke report, then I merge `grading-v1` → `main` + mark PR #1 ready for review.
- [ ] **G2 planning** — the brief's §3 lays out the deferred work. Likely first picks: anchored inline feedback, criteria coverage heatmap on Class Hub, past-feedback memory in Synthesize ("3 weeks ago you said …").

## Open questions / blockers

- **Visual smoke is the only gate.** Code, tests, types all green. The dev-server route bug (`GRADING-FU-DEVSERVER-NEWROUTE`) is environmental and irrelevant once Vercel handles routing.
- **`GRADING-FU-RPC-ATOMICITY`** (P3) — `save-tile-grade` writes are sequential, not atomic. Migrate to Supabase RPC before G4 consistency checker reads the audit table seriously.
- **AI cost ceiling** — currently MAX_BATCH=50 students/click in the AI prescore endpoint. ~$0.10 per click cap. Bump if Matt has a 100-student cohort and trusts the spend.
- **Per-class `ai_grading_enabled` toggle** — not shipped. The AI button is the manual opt-in. If Matt wants auto-fire on tile open, that's a small add (one-column micro-migration + useEffect).
- **Past-feedback memory** in Synthesize was called out as the "unconventional feature" in the brief; deferred to G2 since it needs an assessment_records read path that's not built yet.
