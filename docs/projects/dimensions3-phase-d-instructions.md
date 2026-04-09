# Dimensions3 Phase D — Feedback System

## CRITICAL: Git & File Rules

1. **Work directly on the `main` branch.** Do NOT use worktrees, do NOT create a new branch.
2. **All file paths use the full path from `/questerra/`.** Not relative paths.
3. **When all tasks are complete, `git add` the new/changed files and `git commit` them on main.**
4. **Verify the commit exists with `git log --oneline -3` before reporting done.**

---

## Context

You are building Phase D (Feedback) of the Dimensions3 pipeline rebuild for StudioLoom. Phases A-C are COMPLETE and committed on `main`. The generation pipeline is fully built — Phase D adds the learning loop that makes it get better over time.

---

## What Already Exists (on `main`)

**Phase A-C files:**
- `/questerra/src/types/activity-blocks.ts` — All type definitions including ActivityBlock, CostBreakdown, etc.
- `/questerra/src/lib/pipeline/stages/` — 6 real pipeline stage implementations
- `/questerra/src/lib/pipeline/orchestrator.ts` — Pipeline runner with sandbox/live modes
- `/questerra/src/lib/pipeline/generation-log.ts` — Generation run logging
- `/questerra/src/lib/ingestion/` — Full ingestion pipeline
- `/questerra/src/lib/ai/unit-types.ts` — FormatProfile definitions
- `/questerra/supabase/migrations/060_activity_blocks.sql` — activity_blocks table (includes `efficacy_score`, `times_used`)
- `/questerra/supabase/migrations/061_generation_runs.sql` — generation_runs logging table

**Existing feedback infrastructure:**
- `/questerra/src/lib/teacher-style/profile-service.ts` — Teacher style profile with passive signal collection
- Generation feedback table already exists (in migration 060) — `generation_feedback` table for tracking teacher edits
- Student progress tracking: `student_progress` table with `time_spent_seconds`, `attempt_number`, responses
- Pace feedback: existing pace feedback collection in student experience

---

## What to Build: Phase D (Feedback, ~3 days)

The master spec is at `/questerra/docs/projects/dimensions3.md` — Section 5 "The Feedback System" (starts line 569). Read it thoroughly.

### Task D1: Teacher Edit Tracker (Diff Detection)

**Purpose:** When a teacher saves a unit that was generated via the pipeline, detect what they changed.

1. **On unit save**, compare the saved `content_data` against the original generation output stored in `generation_runs.stage_results`
2. **Per-activity diff detection:** For each activity in the generated unit, classify the edit:
   - `kept` — no changes (or trivial whitespace)
   - `rewritten` — substantial text changes (>20% diff)
   - `scaffolding_changed` — only scaffolding/hints modified
   - `reordered` — moved to a different position
   - `deleted` — removed entirely
   - `added` — teacher added a new activity not in the original
3. **Store diffs** in the `generation_feedback` table with: `generation_run_id`, `source_block_id` (if from library), `edit_type`, `before_snapshot`, `after_snapshot`, `diff_percentage`
4. **Trigger:** Hook into the existing unit save flow. Check if the unit has a `generation_run_id` — if so, compute diffs.

**Key spec detail (line ~270):** Generated activities with <20% text diff from original get auto-queued to review queue with `source_type: 'generated'`, `efficacy_score: 50`. Activities with 20-60% diff queued with `efficacy_score: 45`. Activities with >60% diff are teacher-authored (not library candidates).

**Where to put code:**
- `/questerra/src/lib/feedback/edit-tracker.ts` — Diff computation logic
- `/questerra/src/lib/feedback/types.ts` — Feedback system types
- Hook into existing unit save API route (find it at `/questerra/src/app/api/teacher/units/` or similar)

### Task D2: Efficacy Computation

**Purpose:** Compute an efficacy score for each activity block based on real usage signals.

**Formula (spec line ~607):**
```
efficacy_score = (
  0.30 * kept_rate +        // teacher kept the block as-is
  0.25 * completion_rate +   // students completed the activity
  0.20 * time_accuracy +     // actual time matched expected time
  0.10 * (1 - deletion_rate) +  // teacher didn't delete it
  0.10 * pace_score +        // student pace feedback
  0.05 * (1 - edit_rate)     // teacher didn't rewrite it
) * 100
```

1. **Query signals:** `generation_feedback` (teacher edits), `student_progress` (completion, time), pace feedback
2. **Compute per-block:** Aggregate across all uses of each block
3. **Output:** Proposed efficacy score adjustment with evidence (how many uses, what signals contributed)
4. **Changes go to the approval queue** — NOT applied directly to blocks
5. **Run as a batch job** — not real-time. Can be triggered manually from admin or on a schedule.

**Where to put code:**
- `/questerra/src/lib/feedback/efficacy.ts` — Efficacy computation
- `/questerra/src/lib/feedback/signals.ts` — Signal aggregation queries

### Task D3: Approval Queue UI + Guardrails

**Purpose:** Teachers/admins review proposed changes before they're applied. No silent data mutation.

**Approval queue (spec line ~617):**
1. Each computed efficacy adjustment appears in a queue
2. Shows: block title, current score, proposed score, evidence count, signal breakdown
3. Actions: approve, reject, modify (adjust the proposed score)
4. Batch-approve for high-confidence changes (evidence count > N, change < M points)
5. **Auto-approve threshold:** OFF by default. Configurable: min evidence count, max score change per cycle.

**Hard guardrails (spec line ~632, CANNOT be overridden):**
- Efficacy cannot drop below 10 or above 95 in a single cycle
- `time_weight` cannot change more than one step per cycle (quick→moderate, never quick→extended)
- `bloom_level` changes ALWAYS require manual approval
- `phase` changes ALWAYS require manual approval
- `activity_category` changes ALWAYS require manual approval
- No more than 20% of a block's metadata can change in a single cycle

**Audit log:**
- Every change: what changed, why, evidence, when, who approved (or auto-approved)
- Searchable, filterable

**Where to put code:**
- `/questerra/src/app/admin/feedback/page.tsx` — Approval queue page
- `/questerra/src/components/admin/feedback/ApprovalQueue.tsx` — Queue component
- `/questerra/src/components/admin/feedback/AdjustmentCard.tsx` — Individual adjustment card
- `/questerra/src/app/api/admin/feedback/route.ts` — CRUD for approvals
- `/questerra/src/lib/feedback/guardrails.ts` — Guardrail validation
- DB: May need a migration for `feedback_proposals` table (pending adjustments + audit log). Number it `064_feedback_proposals.sql`.

### Task D4: Self-Healing Proposals

**Purpose:** The system detects when block metadata is wrong based on usage patterns and proposes corrections.

**Trigger conditions (spec line ~640):**
- `avg_time_spent` consistently differs from `time_weight` by >50% across 8+ uses
  - Example: Block tagged `quick` but students average 19 min across 12 uses → propose change to `moderate`
- Completion rate consistently <30% across 10+ uses → propose scaffolding review
- Deletion rate >70% across 5+ uses → flag for quality review

**Implementation:**
1. Batch analysis of block usage patterns
2. Generate proposals with full evidence
3. Proposals enter the same approval queue as efficacy adjustments (D3)
4. Self-healing proposals get their own section in the admin UI

**Where to put code:**
- `/questerra/src/lib/feedback/self-healing.ts` — Pattern detection + proposal generation

---

## Critical Constraints

1. **Haiku model ID:** `claude-haiku-4-5-20251001`
2. **No silent data mutation.** ALL changes go through the approval queue. This is core Dimensions3 philosophy (Principle 6).
3. **All new code must have tests.** Test the efficacy formula, guardrails, diff detection, self-healing triggers.
4. **Build must pass clean** — `npx next build`
5. **Guardrails are hard-coded limits** — they cannot be overridden from the admin UI. Only code changes can modify them.

## Spec References (READ THESE)

- **Primary spec:** `/questerra/docs/projects/dimensions3.md` — Section 5 (Feedback System, line 569-660), Section 7.4 (Feedback Sandbox, line 909-918)
- **Types:** `/questerra/src/types/activity-blocks.ts`
- **Generation runs schema:** `/questerra/supabase/migrations/061_generation_runs.sql`
- **Activity blocks schema:** `/questerra/supabase/migrations/060_activity_blocks.sql` (has efficacy_score, times_used)
- **Existing teacher style:** `/questerra/src/lib/teacher-style/profile-service.ts`
- **Testing plan:** `/questerra/docs/projects/dimensions3-testing-plan.md`
