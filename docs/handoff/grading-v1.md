# Handoff — grading-v1

**Last session ended:** 2026-04-27T12:55Z
**Worktree:** /Users/matt/CWORK/questerra-grading
**HEAD:** b3e53b8 "docs(grading): Path A locked — framework-neutral criterion_keys[]"

## What just happened

This session was the full G1 pre-flight ritual. No application code, no migrations applied — the worktree is set up but the migration body is not yet authored. Five commits on `grading-v1`, none pushed:

- `b53649c` — Scaffolded G1 on `main`: brief, Grading v2 prototype, ALL-PROJECTS.md / dashboard.html registration. Branched `grading-v1` from this.
- `72ef34e` — Pre-flight audit findings appended to brief §13. Discovered existing grading writes to `assessment_records` (migration `019_assessments.sql`), unit-level. Recommended Option B (new per-tile table). Captured baseline `npm test` = **2215 passed, 9 skipped** (locked).
- `e6d4f4a` — Matt confirmed Option B. Source-level verification: `ActivitySection.activityId` is documented as "stable across rebalancing"; lesson editor preserves it; production canonical response key format is `activity_<id>` / `section_<idx>` ([lesson page line 277](../../src/app/(student)/unit/[unitId]/[pageId]/page.tsx)). `ActivitySection.criterionTags` already carries per-tile criterion mapping.
- `8e584ef` — Live prod probe via `scripts/grading/probe-tile-id-coverage.ts` against `units.content_data` (635 tiles, 11 units): 89.9% have stable IDs (V4 timeline.id + V2/V3 activityId, unified at render time via [`src/lib/timeline.ts:142`](../../src/lib/timeline.ts)). 10.1% legacy → backfill required. **74.3% of tiles lack `criterionTags`** → criterion identifiers must be denormalized onto the grade table.
- `b3e53b8` — Matt confirmed Path A (framework-neutral). Verified `FrameworkAdapter` API at [`src/lib/frameworks/adapter.ts:143,160`](../../src/lib/frameworks/adapter.ts) — `fromLabel()` returns `readonly NeutralCriterionKey[]` (PLURAL — MYP A maps to both `researching` AND `analysing`). Schema revised to `criterion_keys TEXT[]` with GIN index. Dual-shape with `assessment_records` documented (Lesson #42 absorber pattern, fifth shape).

## State of working tree

- **Clean.** No staged or unstaged changes (`git status -uno` clean).
- **Branch:** `grading-v1`. **No upstream** — never pushed. Local-only.
- **Test count:** 2215 passed, 9 skipped (baseline at start of phase, unchanged — no code touched).
- **`.env.local`** symlinked to `/Users/matt/CWORK/questerra/.env.local` (main worktree's env).
- **`.active-sessions.txt`** has a row for this worktree at `2026-04-27T12:40Z`.
- **node_modules installed.**
- **No migrations** authored, minted, or applied. The next migration filename is unclaimed on origin (no push has happened).

## Next steps — ordered

- [ ] **Read [`docs/projects/grading-phase-g1-brief.md`](../projects/grading-phase-g1-brief.md) end-to-end.** §13 contains the audit findings, the locked-in schema (Path A, `criterion_keys TEXT[]`), the FrameworkAdapter wiring path, and the dual-shape boundary with `assessment_records`. **The brief is the canonical pickup — every decision required to author the migration is in there.**
- [ ] **Mint the migration stub.** From the worktree:
  ```
  bash scripts/migrations/new-migration.sh grading_v1_student_tile_grades
  ```
  Then **commit + push the empty stubs IMMEDIATELY** to claim the timestamp on origin. The script prints the commands. Push needed even though we're not pushing the body yet — the timestamp claim is the point.
- [ ] **Author the migration body** using the schema in brief §13.H ("Updated migration body shape (REVISED §13.C — superseded)"). Includes:
  - `student_tile_grades` table (per §13.H)
  - GIN index on `criterion_keys`
  - Standard btree indexes (class+unit, teacher, unconfirmed-only partial)
  - RLS policies (mirror `assessment_records` from migration 019: `class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())` + service-role policy)
  - **Inline backfill block** for the 10.1% legacy tiles (mint `nanoid(8)` for sections lacking `activityId` in V2/V3 units AND `id` in V4 timelines; re-save `units.content_data`). Idempotent — guards on `IS NULL` / `NOT (s ? 'activityId')` / `NOT (s ? 'id')` per shape.
  - Re-run [`scripts/grading/probe-tile-id-coverage.ts`](../../scripts/grading/probe-tile-id-coverage.ts) post-backfill: legacy must be 0%.
  - Paired `.down.sql` (drops table, reverses backfill via the audit history if needed — backfill reversal is best-effort, document the limit).
- [ ] **Apply to local Supabase first.** Verify the schema, RLS, GIN index. Run the probe again to confirm 0% legacy.
- [ ] **Apply to prod Supabase.** Standard procedure. Verify via probe + a row insert smoke from `psql`.
- [ ] **Run `bash scripts/migrations/verify-no-collision.sh`.** Must exit clean before any merge to main.
- [ ] **Begin G1.1 (Calibrate view) only after migration applied to prod.** First component to extract: `ScorePill` (the dashed/solid border atom from [`docs/prototypes/grading-v2/grading-v2.jsx:248`](../prototypes/grading-v2/grading-v2.jsx)).

## Open questions / blockers

- **Pushing `grading-v1` to origin** — never done in this session. Next session must push as part of the migration-claim ritual. Per discipline: feature branches push freely, only `origin/main` is gated by checkpoint sign-off.
- **Backfill reversibility** — `down.sql` for the migration must drop the table cleanly, but the legacy-ID backfill into `units.content_data` is harder to reverse (you can't tell which IDs were minted by this migration vs. organically). Recommended: log to `decisions-log.md` and accept that the down migration leaves the activityIds in place. Confirm before authoring.
- **Q2 (AI off-by-default per class)** — still unconfirmed by Matt explicitly. Default applied in code unless he overrides. Default per the brief is OFF; he flips ON for his own classes during smoke. No blocker — the migration doesn't depend on this.
- **`assessment_records` rollup-write trigger** — the design says Synthesize "Release to <student>" maps neutral → framework via `toLabel()` and writes to `assessment_records.data.criterion_scores[]`. This is not part of the migration; it's a code change at the rollup write site. Defer to G1.4 (Synthesize view) authoring. **Migration does NOT touch `assessment_records`.**
- **Legacy backfill volume** — 64 tiles across 4 V2/V3/v? units. Small. If for any reason the backfill is too risky (e.g., one of those 4 units is in active use by Matt's current class), feature-flag the inline backfill OFF and run it as a separate one-shot `scripts/grading/backfill-legacy-activity-ids.ts` after migration apply. Re-check this trade before authoring.

