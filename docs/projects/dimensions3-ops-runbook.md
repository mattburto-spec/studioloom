# Dimensions3 Ops Runbook

**Created:** 12 April 2026
**Phase:** 4 — Library Health & Operational Automation

---

## Overview

Seven operational automation systems monitor the Dimensions3 pipeline, block library, and usage. Each system writes to the `system_alerts` table on every run (even "all green"). Two hygiene jobs maintain library quality on weekly/monthly schedules.

All systems are designed for a solo developer: detect problems automatically, surface them for human decision. Nothing auto-fixes without approval.

---

## Operational Automation Systems

### 1. Pipeline Health Monitor

**Purpose:** Track generation pipeline success rate, timing, and cost over 24h.

**File:** `src/lib/jobs/pipeline-health-monitor.ts`
**Script:** `npx tsx scripts/ops/run-pipeline-health.ts`
**Schedule:** Every hour (or on-demand)
**Alert type:** `pipeline_health`
**Severity rules:** green (>=95%), amber (80-95%), red (<80%)

**What it checks:**
- Total generation runs in last 24h
- Completed vs failed count
- Success rate
- Average and p95 execution time
- Average cost per run (extracted from `total_cost` JSONB)

### 2. Cost Alert

**Purpose:** Monitor AI spend against configurable thresholds.

**File:** `src/lib/jobs/cost-alert.ts`
**Script:** `npx tsx scripts/ops/run-cost-alert.ts`
**Schedule:** Daily (or on-demand)
**Alert type:** `cost_alert`

**Thresholds (env vars):**
- `COST_ALERT_DAILY_USD` — default $10
- `COST_ALERT_WEEKLY_USD` — default $50
- `COST_ALERT_MONTHLY_USD` — default $200

**Debounce:** Won't send email for same threshold if alert exists within last 6 hours.

**Email delivery:** `src/lib/monitoring/cost-alert-delivery.ts` — uses Resend API via direct fetch. Falls back to console.log if `RESEND_API_KEY` not set.

**Required env vars for email:**
- `RESEND_API_KEY`
- `COST_ALERT_EMAIL` (default: mattburto@gmail.com)

### 3. Quality Drift Detector

**Purpose:** Detect degradation in generation quality over time.

**File:** `src/lib/jobs/quality-drift-detector.ts`
**Script:** `npx tsx scripts/ops/run-quality-drift.ts`
**Schedule:** Daily
**Alert type:** `quality_drift`
**Severity:** warning if 7d avg drops >10% vs prior 30d

**Data source:** `generation_runs.quality_report` JSONB — extracts `pulse_score` or `overall_score`.

### 4. Teacher Edit Tracker

**Purpose:** Aggregate teacher edit patterns for feedback loop visibility.

**File:** `src/lib/jobs/teacher-edit-tracker.ts`
**Script:** `npx tsx scripts/ops/run-edit-tracker.ts`
**Schedule:** Daily
**Alert type:** `teacher_edits`

**What it tracks:**
- Edit counts by type (kept, deleted, rewritten, reordered, scaffolding_changed)
- Most-edited blocks (candidates for improvement)
- Most-deleted blocks (candidates for removal)

### 5. Stale Data Watchdog

**Purpose:** Find data quality issues before they cause problems.

**File:** `src/lib/jobs/stale-data-watchdog.ts`
**Script:** `npx tsx scripts/ops/run-stale-watchdog.ts`
**Schedule:** Daily
**Alert type:** `stale_data`

**Checks:**
- Blocks with missing embeddings (should be 0)
- Blocks unused for 90+ days
- Failed generation_runs spike (>3 in 24h)
- Stale teacher style profiles (6+ months)

### 6. Automated Smoke Tests

**Purpose:** Verify end-to-end wiring integrity (per master spec section 14.8).

**File:** `src/lib/jobs/smoke-tests.ts`
**Script:** `npx tsx scripts/ops/run-smoke-tests.ts`
**Schedule:** Daily + after deploys
**Alert type:** `smoke_test`

**6 wiring checks:**
1. `activity_blocks` table queryable
2. `generation_runs` table queryable
3. `feedback_proposals` table queryable
4. `system_alerts` table queryable (self-referential)
5. `generation_feedback` table queryable
6. `feedback_audit_log` table queryable

Each check records pass/fail + latency in ms.

### 7. Usage Analytics

**Purpose:** Roll up usage metrics for the admin Cost & Usage dashboard.

**File:** `src/lib/jobs/usage-analytics.ts`
**Script:** `npx tsx scripts/ops/run-usage-analytics.ts`
**Schedule:** Nightly
**Alert type:** `usage_analytics`

**Rollups (written to `usage_rollups` table):**
- Per-teacher generation run counts (daily)
- Student progress entries created (daily)
- Total active blocks in library

---

## Hygiene Jobs

### Weekly Hygiene

**File:** `src/lib/jobs/library-hygiene-weekly.ts`
**Script:** `npx tsx scripts/run-hygiene.ts weekly`
**Schedule:** Sundays
**Alert type:** `weekly_hygiene`

**Steps:**
1. Staleness decay: blocks unused 6+ months get efficacy_score -= 1 (capped at -6 total via `decay_applied_total`)
2. Flag duplicate suspects: cosine similarity 0.88-0.92 via `find_duplicate_blocks` RPC → `library_health_flags`
3. Flag low-efficacy blocks: efficacy < 40, times_used >= 3 → `library_health_flags`
4. Flag stale embeddings: updated_at > embedding_generated_at → `library_health_flags`

### Monthly Hygiene

**File:** `src/lib/jobs/library-hygiene-monthly.ts`
**Script:** `npx tsx scripts/run-hygiene.ts monthly`
**Schedule:** 1st of month
**Alert type:** `monthly_hygiene`

**Steps:**
1. Consolidation pass: cosine > 0.95 AND both blocks efficacy < 60 → merge proposal via `feedback_proposals` (reuses Phase 3 approval queue)
2. Orphan archival: unused 12+ months AND efficacy < 30 → set `archived_at`, `is_archived = true` (NEVER deleted)

---

## Dashboards

### Library Health Dashboard

**Route:** `/admin/library/health`
**API:** `/api/admin/library/health`

8 widgets: blocks by source type, category distribution, stale blocks, duplicate suspects, low efficacy, orphan blocks, embedding health, coverage heatmap.

### Pipeline Health Dashboard

**Route:** `/admin/pipeline/health`
**API:** `/api/admin/pipeline/health`

Widgets: 24h summary KPIs, stage failure heatmap, cost alert strip, error log, quality drift indicator, recent alerts.

---

## Database Tables (Migration 072)

| Table | Purpose |
|-------|---------|
| `system_alerts` | All automation system outputs (type, severity, payload JSONB) |
| `library_health_flags` | Per-block health issues (duplicate, low_efficacy, stale_embedding) |
| `usage_rollups` | Aggregated usage metrics (period_type + period_start + teacher/student) |

**New columns on `activity_blocks`:**
- `last_used_at` — when the block was last used in generation
- `archived_at` — soft-archive timestamp
- `embedding_generated_at` — when embedding was last computed
- `decay_applied_total` — staleness decay counter (capped at 6)

**RPC function:** `find_duplicate_blocks(min_similarity, max_similarity, max_results)` — cosine similarity search on halfvec(1024) embeddings.

---

## Troubleshooting

**All scripts output "Alert ID" + "Summary" JSON.** If a script fails:
1. Check Supabase connection: `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be set
2. Check migration 072 is applied (tables must exist)
3. Check the specific table being queried has data (empty is OK, missing table is not)

**Cost alert email not sending:**
- Verify `RESEND_API_KEY` is set (console fallback logs the alert text)
- Check debounce: existing cost_alert warning in last 6h blocks sending
- Verify `COST_ALERT_EMAIL` points to correct address

**Duplicate detection returning empty:**
- Blocks need embeddings (`halfvec(1024)`) populated
- The RPC function filters out archived blocks
- Check `find_duplicate_blocks` function exists in Supabase (migration 072)
