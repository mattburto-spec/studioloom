# Handoff — grading-v1

**Last session ended:** 2026-04-27T14:05Z
**Worktree:** /Users/matt/CWORK/questerra-grading
**HEAD:** 86f1577 "docs(grading): handoff updated — migration body authored, awaiting apply"

## What just happened

Migration `20260427133507_grading_v1_student_tile_grades` is **APPLIED TO PROD** (27 Apr 2026, direct via Supabase dashboard SQL editor — no local-staging step, no real students in prod yet so prod is effectively dev). Verified clean. G1.0 (Pre-flight + audit + unblocking migration) is closed.

- `b4ffc3d` — Empty stub minted via `new-migration.sh` and pushed to claim timestamp `20260427133507`.
- `33a0f76` — Full migration body. Two new tables + 9 indexes + 4 RLS policies + updated_at trigger + idempotent JSONB backfill PL/pgSQL DO block. Six future-proof additions baked in (audit table, released snapshot, numeric AI confidence, `graded_by`, `ai_model_version`+`prompt_version`, `marking_session_id`).
- `86f1577` — Pre-apply handoff doc.
- **Apply verified post-fact:** probe (`scripts/grading/probe-tile-id-coverage.ts`) reports 0% legacy (was 10.1% / 64 tiles); all 635 prod tiles now carry stable activityId/id. `bash scripts/migrations/verify-no-collision.sh` exits clean — safe to merge whenever G1 as a whole signs off.

## State of working tree

- **Clean.** No staged or unstaged changes.
- **Branch:** `grading-v1` tracking `origin/grading-v1`. 7 commits ahead of `origin/main`, none merged. Stays this way until full G1 checkpoint signs off (per `feedback_push_discipline`).
- **Migration in prod:** ✅ applied 27 Apr. Audit table + grade table + RLS all live. `student_tile_grades` and `student_tile_grade_events` exist and accept the 8 neutral keys via CHECK constraint.
- **Test count:** 2215 passed, 9 skipped (unchanged — no app code touched yet).
- **`.env.local`** symlinked to `/Users/matt/CWORK/questerra/.env.local` (production env).

## Next steps — ordered

- [ ] **Begin G1.1 (Calibrate view + tile-strip queue, ~1 day).** Per brief §10, this is a Matt Checkpoint gate — write the sub-phase brief first via `build-phase-prep` skill, get Matt sign-off, then code.
- [ ] **First component to extract: `ScorePill`** (the dashed-when-unconfirmed / solid-when-confirmed score atom) from [`docs/prototypes/grading-v2/grading-v2.jsx:248`](../prototypes/grading-v2/grading-v2.jsx). Lives at `src/components/grading/ScorePill.tsx`. Test fixture: 4 visual states (empty, ai-suggested-unconfirmed, teacher-confirmed, teacher-overridden).
- [ ] **Service module:** `src/lib/grading/save-tile-grade.ts` — wraps INSERT/UPDATE on `student_tile_grades` AND INSERT on `student_tile_grade_events` in one transaction. Source enum picked by call site (`teacher_confirm` vs `teacher_override` vs `teacher_revise` etc). This is the single-write-site pattern that keeps the audit trail honest.
- [ ] **API route:** `src/app/api/teacher/grading/tile-grades/route.ts` (POST/PATCH). Mirrors the auth pattern from `src/app/api/teacher/assessments/route.ts`.
- [ ] **Page:** `src/app/teacher/marking/page.tsx` — Calibrate landing. Tile-strip queue across the top. Per-row Confirm + override expand. Brief §0 has the locked-in UX model; prototype at [`docs/prototypes/grading-v2/Grading v2.html`](../prototypes/grading-v2/) is the visual reference.

## Open questions / blockers

- **Q2 (per-class AI default OFF) deferred** — column add (`ai_grading_enabled BOOLEAN DEFAULT false` on `classes`) is a separate micro-migration during G1.3 when AI pre-score actually wires up. Not part of G1.1 work.
- **`assessment_records` rollup-write (Synthesize "Release to <student>")** — defer to G1.4. Migration didn't touch `assessment_records`; that table remains the canonical released-grade record. Rollup writer at `src/lib/grading/release-to-student.ts` (planned) maps neutral → framework via `FrameworkAdapter.toLabel()` and writes both to `assessment_records.data.criterion_scores[]` AND snapshots `released_score`/`released_criterion_keys` on the tile rows.
- **PL/pgSQL DO block precedent set** — first migration in this codebase to use `DO $$ ... FOR ... LOOP ... END $$` for JSONB walking. Future tile-denormalization migrations can follow the same pattern (see `20260427133507_grading_v1_student_tile_grades.sql` §1).
