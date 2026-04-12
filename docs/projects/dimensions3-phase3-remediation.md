# Dimensions3 Phase 3 Remediation Brief

**Date:** 12 Apr 2026
**Context:** Phase 3 was rushed without following the build methodology. Audit revealed 5 real gaps. This brief applies the discipline retroactively.

## What went wrong

- **No pre-flight ritual** — didn't capture git status, test baseline, or audit existing code before editing
- **No phase brief** — no stop triggers, no "don't stop for" list, no assumptions block
- **No truth capture** — wrote code without first running the existing system to understand what signals actually exist in the database
- **CLI script duplicates formula** — two sources of truth (Lesson #44 violation)
- **Signals read pre-aggregated fields, not real source tables** — spec explicitly says "must read from real `generation_runs`, real teacher edits, and real `student_progress` rows"
- **Skipped checkpoints 3.1 and 3.2** — spec has TWO gated Matt checkpoints; neither was run

## Gap list

### Gap A — `signals.ts` reads shortcuts, not real sources (BIGGEST)

Spec §5.2 signal source table says:
- `completion` → `student_progress.is_completed` → **code reads `activity_blocks.avg_completion_rate` instead**
- `time_accuracy` → actual vs declared duration → **code reads `activity_blocks.avg_time_spent` instead**
- `pace` → `lesson_pulse` table → **`lesson_pulse` table doesn't exist; hardcoded to 0.5**

Files: `src/lib/feedback/signals.ts` lines 52-81 (`getStudentSignals`), lines 87-94 (`getPaceSignals`)

### Gap B — CLI script formula duplication

`scripts/run-efficacy-update.mjs` has inline `computeScore()` and `getSignals()` that duplicate `efficacy.ts` and `signals.ts`. If the formula changes, the script won't match.

### Gap C — ProposalReasoning text format

Spec says: "Kept in 2/8 units — teachers removed it for being too long." Current code shows bar charts with percentages. Functional but doesn't match the spec's human-readable narrative format.

File: `src/components/admin/feedback/ProposalReasoning.tsx`

### Gap D — Field naming (`requires_matt` vs `requires_manual_approval`)

Spec says `requires_matt: true`. Code uses `requires_manual_approval`. Minor but should be consistent or documented.

### Gap E — Accept action naming

Spec says `action='accept'` in audit log. Code uses `action='approved'`. Pre-existing from initial build.

### Gap F — Cascade delete not verified with real DELETE

Spec §5.1 says "verify with a real DELETE." Migration 070 was applied but cascade not tested.

## What's NOT a gap (on re-inspection)

- **Edit tracker hook points (§5.5):** Spec says three hooks but the diff-on-save approach covers all three (edits, deletes, reorders) via `computeEditDiffs` comparing full before/after snapshots. Acceptance checklist §5.7 says "Edit tracker logs delete/edit/reorder events" — the diff approach does this.
- **The `update-efficacy.ts` filename:** Spec suggests this but `efficacy.ts` + `signals.ts` cover the same functionality.
- **Pace signal at 0.5:** `lesson_pulse` table doesn't exist. Stub is the correct approach.

## Execution plan

### Pre-flight (STOP after this — report findings before any code)

1. `git status` clean, on main, expected HEAD
2. `npm test` baseline captured (current: 891 tests)
3. Check what data actually exists in prod:
   - `SELECT count(*) FROM student_progress` — any student data at all?
   - `SELECT count(*) FROM generation_feedback` — any edit tracking data?
   - `SELECT column_name FROM information_schema.columns WHERE table_name = 'activity_blocks'` — do `avg_completion_rate` and `avg_time_spent` exist?
   - `SELECT count(*) FROM activity_blocks WHERE times_used >= 3` — any blocks eligible for efficacy computation?
4. Audit `signals.ts` line-by-line against spec signal source table
5. **STOP and report audit findings**

### Sub-task R1: Fix `signals.ts` to read real source tables

- `getStudentSignals()`: query `student_progress` table directly for `is_completed` and time data, joined to activities that reference this block
- `time_accuracy`: compute from `student_progress` time observations vs block's `time_weight` expected duration
- `pace`: keep at 0.5 stub with clear "lesson_pulse table does not exist" comment — document in followups
- Write tests that verify each signal source queries the correct table (not `activity_blocks` pre-aggregated fields)
- If `student_progress` has zero rows → the signals will return defaults (0.5), which is correct per spec's "Default when no data" column. But document this state.

### Sub-task R2: Rewrite CLI script as `.ts` with tsx import

**Decision: Option B** — rewrite as `.ts` that imports `runEfficacyBatch`, `efficacyToProposals`, `analyzeSelfHealing`, `healingToProposals` directly from the library. Run via `./node_modules/.bin/tsx scripts/run-efficacy-update.ts`. Single source of truth for formula and query logic. ~40 lines instead of 180. When Phase 4 wires the scheduler, it imports the same functions — zero migration cost. Lesson #15's warning about `npx tsx` doesn't apply because Matt only runs this locally from the project root where `node_modules` exists.

### Sub-task R3: ProposalReasoning narrative text

Add human-readable summary line above the bar charts:
- "Kept in 6/8 units (75%). 85% student completion. Time accuracy 72%."
- Uses `signal_breakdown` counts + `reasoning` rates to build the sentence
- Keep bar charts as supplementary detail

### Sub-task R4: Field naming — document divergence, keep current names

**Decision: Option B** — `requires_manual_approval` is more correct long-term than `requires_matt` (scales to multiple admins/schools). `approved`/`rejected` is standard approval-queue vocabulary. Add a mapping comment in `src/lib/feedback/types.ts` and a note in the spec doc so anyone reading spec alongside code knows the translation. Churn for naming parity with a less-generic spec term isn't discipline — it's busywork.

### Sub-task R5: Cascade delete verification

- In Supabase SQL editor, create a test block, create a feedback_proposal and audit_log row referencing it, then DELETE the block
- Verify proposals + audit rows are gone
- Screenshot or paste query results

## Stop triggers

- If `student_progress` has zero rows → stop, report, discuss whether to seed test data or defer signals to when real data exists
- If `activity_blocks` doesn't have `avg_completion_rate` / `avg_time_spent` columns → stop, the schema doesn't match what `signals.ts` currently reads
- If rewriting `signals.ts` would break the 60 existing feedback tests → stop, audit test dependencies before changing
- If any sub-task reveals a deeper schema mismatch → stop, report

## Don't stop for

- Pace signal staying at 0.5 (lesson_pulse doesn't exist, this is known and accepted)
- Minor naming differences if Matt chooses Option B (document rather than rename)
- Empty `generation_feedback` table (edit tracker is wired but may not have fired yet)

## Checkpoints

- **Checkpoint 3.1** (spec §5.3): Matt generates 2 test units, deletes activities, runs CLI, reviews proposals, verifies reasoning matches expectations
- **Checkpoint 3.2** (spec §5.6): Matt does full cycle: generate → delete → run efficacy → review → accept → verify block score changed → verify audit log

## Lessons to apply

- **#38** — Verify = expected values. Check actual DB state before assuming signals work.
- **#43** — Think before coding. Surface assumptions about data availability.
- **#44** — Simplicity first. CLI script should not duplicate the formula.
- **#45** — Surgical changes. Only touch `signals.ts` signal sources, not the formula or guardrails.
- **#46** — Goal-driven execution. Success = Checkpoint 3.2 passes end-to-end.

## Code agent involvement

**Sub-tasks that MUST go through Code (Claude Code agent) with proper briefs:**

- **R1 (signals.ts rewrite)** — Changes query logic that feeds the entire efficacy pipeline. Needs:
  - Pre-flight: audit `student_progress` schema, verify column names, check what join path links blocks to student data
  - New/updated tests that verify each signal queries the correct table
  - NC verification on the signal source tests
  - The brief must include exact column names from the migration, exact table relationships, and expected query shapes

- **R2 (CLI script rewrite)** — Needs:
  - Rewrite from `.mjs` (180 lines, duplicated logic) to `.ts` (~40 lines, direct library import)
  - Verify `./node_modules/.bin/tsx` runs it successfully from project root
  - Delete the old `.mjs` file

**Sub-tasks that can stay in Cowork:**

- **R3 (ProposalReasoning text)** — Small React component text addition, no pipeline risk
- **R4 (naming documentation)** — Comment additions to `types.ts` and spec doc
- **R5 (cascade delete verification)** — Manual SQL in Supabase dashboard, Matt does this

**Execution order:**
1. Pre-flight (Cowork — schema audit queries)
2. STOP — report findings
3. R1 (Code — with proper brief based on pre-flight findings)
4. R2 (Code — same session as R1, or immediately after)
5. R3 + R4 (Cowork — quick)
6. R5 (Matt — manual SQL verification)
7. Checkpoint 3.1 (Matt)
8. Checkpoint 3.2 (Matt)
