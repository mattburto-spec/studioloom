# Phase 3R Code Brief — R1 (signals.ts) + R2 (CLI script rewrite)

**Branch:** main
**Test baseline:** 902 passed, 8 skipped, 45 files
**tsc baseline:** 80 errors (pre-existing, none in feedback/ files)

## Context

The feedback system's signal aggregation (`src/lib/feedback/signals.ts`) currently reads student completion and time data from pre-aggregated fields on `activity_blocks` (which are always NULL/0 — nobody writes to them). The spec requires reading from real source tables. This brief fixes that.

## Pre-flight (MANDATORY — do this before any edits)

1. `git status` — must be clean on main
2. `npx vitest run src/lib/feedback/__tests__/feedback.test.ts` — baseline: 60 tests pass
3. Read `src/lib/feedback/signals.ts` in full (201 lines)
4. Read `src/lib/feedback/types.ts` — understand `EfficacySignals` interface
5. Grep for all callers of `aggregateSignals` and `getBlocksForRecomputation`
6. **STOP and report** what you found before making any changes

## R1: Fix `getStudentSignals()` in signals.ts

### Current state (WRONG)

Lines 52-81: `getStudentSignals()` queries `activity_blocks` table for `avg_time_spent, avg_completion_rate, times_used`. These columns exist but are always at default values (NULL/0) because nothing populates them.

### Required state

Query `student_progress` table directly. Schema (from migration 001 + 011 + 065):

```
student_progress:
  id UUID PK
  student_id UUID FK → students
  unit_id UUID FK → units
  page_id TEXT
  status TEXT ('not_started' | 'in_progress' | 'complete')
  responses JSONB
  time_spent INTEGER DEFAULT 0
  class_id UUID FK → classes
  created_at, updated_at TIMESTAMPTZ
```

**There is NO direct FK from student_progress to activity_blocks.** The join path is indirect:

```
student_progress.unit_id = activity_blocks.source_unit_id
AND student_progress.page_id = activity_blocks.source_page_id
```

This gives page-level granularity, not activity-level. That's acceptable — document the approximation in a comment.

### New `getStudentSignals()` implementation

```typescript
async function getStudentSignals(
  supabase: SupabaseClient,
  blockId: string
): Promise<{ completions: number; starts: number; avgTimeSpent: number; timeObservations: number }> {
  try {
    // First, get the block's source unit + page for the join
    const { data: block } = await supabase
      .from("activity_blocks")
      .select("source_unit_id, source_page_id")
      .eq("id", blockId)
      .maybeSingle();

    if (!block?.source_unit_id) {
      return { completions: 0, starts: 0, avgTimeSpent: 0, timeObservations: 0 };
    }

    // Query student_progress rows for pages containing this block's activities
    // NOTE: Page-level granularity — one student_progress row per page, not per activity.
    // This is an acceptable approximation until per-activity tracking exists.
    let query = supabase
      .from("student_progress")
      .select("status, time_spent")
      .eq("unit_id", block.source_unit_id);

    if (block.source_page_id) {
      query = query.eq("page_id", block.source_page_id);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return { completions: 0, starts: 0, avgTimeSpent: 0, timeObservations: 0 };
    }

    const rows = data as Array<{ status: string; time_spent: number }>;
    const starts = rows.length;
    const completions = rows.filter(r => r.status === "complete").length;
    const timeRows = rows.filter(r => r.time_spent > 0);
    const avgTimeSpent = timeRows.length > 0
      ? timeRows.reduce((sum, r) => sum + r.time_spent, 0) / timeRows.length
      : 0;

    return {
      completions,
      starts,
      avgTimeSpent,
      timeObservations: timeRows.length,
    };
  } catch {
    return { completions: 0, starts: 0, avgTimeSpent: 0, timeObservations: 0 };
  }
}
```

### What NOT to change

- `getTeacherSignals()` — already correct, reads from `generation_feedback`
- `getPaceSignals()` — correctly returns 0.5 stub, `lesson_pulse` table doesn't exist
- `aggregateSignals()` — the aggregation logic is fine, only the data source for student signals changes
- `getBlocksForRecomputation()` — correct
- `getBlockUsageStats()` — correct (used by self-healing, different path)

### Tests to add/update

Check if existing tests mock `getStudentSignals`. If they do, update the mock to reflect the new query shape. If they don't (likely — the 60 tests focus on formula + guardrails + self-healing), add at least one test that verifies `getStudentSignals` returns the correct shape.

**NC requirement:** After tests pass, mutate the `source_unit_id` query in `getStudentSignals` (e.g., change `"source_unit_id"` to `"source_unit_id_BROKEN"`), verify the relevant test fails, revert.

## R2: Rewrite CLI script as .ts

### Current state (WRONG)

`scripts/run-efficacy-update.mjs` — 180 lines with inline formula duplication. Has its own `computeScore()`, `getSignals()`, `getBlocks()` that duplicate `efficacy.ts` and `signals.ts`.

### Required state

Delete `scripts/run-efficacy-update.mjs`. Create `scripts/run-efficacy-update.ts`:

```typescript
/**
 * Standalone CLI for the efficacy batch.
 * Single source of truth — imports library functions directly.
 *
 * Usage: ./node_modules/.bin/tsx scripts/run-efficacy-update.ts [--teacher-id UUID] [--dry-run]
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { runEfficacyBatch, efficacyToProposals } from "../src/lib/feedback/efficacy";
import { getBlockUsageStats } from "../src/lib/feedback/signals";
import { analyzeSelfHealing, healingToProposals } from "../src/lib/feedback/self-healing";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tidIdx = args.indexOf("--teacher-id");
const teacherId = tidIdx !== -1 ? args[tidIdx + 1] : null;

async function main() {
  console.log(`\n🔄 Efficacy Batch${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`   Teacher: ${teacherId || "all"}\n`);

  if (!teacherId) {
    console.error("--teacher-id required");
    process.exit(1);
  }

  // Run efficacy + self-healing (same logic as POST /api/admin/feedback)
  const efficacyResults = await runEfficacyBatch(supabase, teacherId);
  const efficacyRows = efficacyToProposals(efficacyResults);

  const blocks = await getBlockUsageStats(supabase, teacherId);
  const healingProposals = analyzeSelfHealing(blocks);
  const healingRows = healingToProposals(healingProposals);

  const allRows = [...efficacyRows, ...healingRows];
  console.log(`Computed: ${efficacyResults.length} efficacy, ${healingProposals.length} self-healing`);

  if (dryRun) {
    for (const row of allRows) {
      console.log(`  📊 ${row.block_id.slice(0, 8)} | ${row.field}: ${row.current_value} → ${row.proposed_value}`);
    }
    console.log(`\n✅ Dry run complete — ${allRows.length} proposals would be created\n`);
    return;
  }

  let inserted = 0;
  for (const row of allRows) {
    // Same dedup + 7-day rejection suppression as POST handler
    const { data: existing } = await supabase
      .from("feedback_proposals")
      .select("id")
      .eq("block_id", row.block_id)
      .eq("field", row.field)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) continue;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rejected } = await supabase
      .from("feedback_proposals")
      .select("id")
      .eq("block_id", row.block_id)
      .eq("field", row.field)
      .eq("status", "rejected")
      .gte("updated_at", sevenDaysAgo)
      .maybeSingle();
    if (rejected) continue;

    await supabase.from("feedback_proposals").insert(row);
    inserted++;
  }

  console.log(`\n✅ Done: ${inserted} proposals inserted\n`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
```

### Verification

Run `./node_modules/.bin/tsx scripts/run-efficacy-update.ts --dry-run --teacher-id <any-uuid>` and confirm it executes without import errors. It will likely produce 0 proposals (no blocks with times_used >= 3) — that's correct.

## Commit plan

Two separate commits:
1. `R1: signals.ts reads real student_progress data` — signals.ts changes + new/updated tests
2. `R2: rewrite CLI script as .ts with library imports` — delete .mjs, create .ts

## Stop triggers

- If changing `getStudentSignals` breaks > 5 existing tests → stop, audit test mocks
- If `tsx` can't resolve the library imports → stop, report the error
- If the `student_progress` join path produces unexpected results → stop, report

## Don't stop for

- 0 proposals in dry-run (expected — no blocks with times_used >= 3)
- Pace signal still at 0.5 (known, accepted)
- Pre-existing tsc errors in unrelated files
