# Operational Automation Jobs (Phase 4C)

7 jobs that monitor system health, cost, quality, and usage. Each job:
- Reads from appropriate data tables (generation_runs, activity_blocks, generation_feedback, etc.)
- Computes metrics or flags
- Writes a row to `system_alerts` with the result
- Returns `{alertId, summary}` for logging

## Job 1: Pipeline Health Monitor (`pipeline-health-monitor.ts`)
**Alert type:** `pipeline_health`

Queries generation_runs for last 24h:
- Computes: success rate, failure count, avg/p95 timing, avg cost
- Severity: "info" (≥95%), "warning" (80-94%), "critical" (<80%)

## Job 2: Cost Alert (`cost-alert.ts`)
**Alert type:** `cost_alert`

Sums generation_runs costs for today/week/month:
- Compares against thresholds: `COST_ALERT_DAILY_USD`, `COST_ALERT_WEEKLY_USD`, `COST_ALERT_MONTHLY_USD`
- Debounces: skips alert if similar warning exists within last 6h
- Severity: "warning" if threshold crossed, "info" otherwise

## Job 3: Quality Drift Detector (`quality-drift-detector.ts`)
**Alert type:** `quality_drift`

Compares quality scores (pulse_score or overall_score from quality_report):
- Last 7 days vs prior 30 days (days 8-37)
- If drop > 10%: severity "warning"
- If insufficient data: severity "info" with note

## Job 4: Teacher Edit Tracker (`teacher-edit-tracker.ts`)
**Alert type:** `teacher_edits`

Aggregates generation_feedback table:
- Counts edits by type (kept, deleted, rewritten, reordered, etc.)
- Identifies most-edited and most-deleted blocks (top 5 each)
- Severity: always "info"

## Job 5: Stale Data Watchdog (`stale-data-watchdog.ts`)
**Alert type:** `stale_data`

Checks for data quality issues:
- NULL embeddings (should be 0)
- Blocks with last_used_at > 90 days or NULL
- Failed runs in last 24h (spike = >3)
- Teacher style profiles > 6 months old
- Severity: "warning" if any issue found, "info" if clean

## Job 6: Smoke Tests (`smoke-tests.ts`)
**Alert type:** `smoke_tests`

6 wiring health checks:
1. activity_blocks table queryable
2. generation_runs table queryable + FK intact
3. feedback_proposals table queryable
4. system_alerts table queryable (self-referential)
5. generation_feedback table queryable
6. feedback_audit_log table queryable

Each check records: pass/fail, latency (ms), count, error message.
- Severity: "info" if all pass, "warning" if any fail

## Job 7: Usage Analytics (`usage-analytics.ts`)
**Alert type:** `usage_analytics`

Rolls up daily usage into `usage_rollups`:
- Counts generation_runs per teacher (last 24h)
- Counts student_progress entries created (last 24h)
- Total blocks in library (non-archived)
- Uses UPSERT to avoid duplicates
- Severity: always "info"

## Running Jobs

Each job has a runner script in `scripts/ops/`:
```bash
npx ts-node scripts/ops/run-pipeline-health.ts
npx ts-node scripts/ops/run-cost-alert.ts
npx ts-node scripts/ops/run-quality-drift.ts
npx ts-node scripts/ops/run-edit-tracker.ts
npx ts-node scripts/ops/run-stale-watchdog.ts
npx ts-node scripts/ops/run-smoke-tests.ts
npx ts-node scripts/ops/run-usage-analytics.ts
```

## Testing

All jobs have happy-path tests in `src/lib/jobs/__tests__/ops-jobs.test.ts`:
```bash
npm test -- src/lib/jobs/__tests__/ops-jobs.test.ts
```

Each test verifies:
- Job returns alertId and summary
- system_alerts.insert is called
- Correct alert_type is written
