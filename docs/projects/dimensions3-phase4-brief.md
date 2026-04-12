# Phase 4 Brief — Library Health & Operational Automation

**Date:** 12 April 2026
**Spec reference:** `docs/projects/dimensions3-completion-spec.md` §6 (lines 925-1049)
**Master spec:** `docs/projects/dimensions3.md` §9 (Library Health), §9.3 (Operational Automation), §14.8 (Wiring Health Checks)
**Lessons to re-read:** #24 (column assumptions), #34 (test baseline drift), #38 (verify expected values), #43 (think before coding), #44 (simplicity first), #45 (surgical changes)

---

## Pre-flight checklist

- [ ] `git status` clean, on `main`, HEAD is `445b1a9` (edit tracker fix)
- [ ] `npm test` baseline: **905 tests passing** (capture exact count)
- [ ] Verify migration numbering: latest is `071_feedback_reasoning_jsonb.sql`, next is **072**
- [ ] Audit existing admin routes: `/admin/library/page.tsx` (block browser), `/admin/pipeline/page.tsx` (run history) — these are NOT the health sub-routes
- [ ] Confirm activity_blocks missing columns: `last_used_at`, `archived_at`, `embedding_generated_at`, `decay_applied_total`
- [ ] Confirm `total_cost` on generation_runs is JSONB (not `total_cost_usd` float) — queries must extract from JSONB
- [ ] Confirm no `system_alerts`, `library_health_flags`, or `usage_rollups` tables exist
- [ ] Confirm pgvector enabled (migration 010) — cosine similarity available via `<=>` operator on `halfvec(1024)`
- [ ] Confirm no email library installed — will install `resend`

## Stop triggers

STOP and report if:
- Migration 072 touches any existing column or constraint on activity_blocks (additive only)
- Any of the 8 query functions returns unexpected types from Supabase (schema drift)
- Cosine similarity query on halfvec produces a Postgres error (operator compatibility)
- `npm test` count drops below 905 at any point
- A job writes to system_alerts but the row shape doesn't match what the dashboard expects
- Email delivery fails silently (Resend returns 200 but no email)

## Don't stop for

- Empty result sets from health queries (library may have sparse data — zeros are valid)
- `total_cost` JSONB having varied internal shapes across runs (handle gracefully)
- Resend env vars not set in dev (use console.log fallback, test email in prod only)

---

## Sub-task breakdown

### 4A — Migration 072 (schema)
**New tables:**
1. `system_alerts(id UUID PK, alert_type TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'info', payload JSONB NOT NULL DEFAULT '{}', acknowledged BOOLEAN DEFAULT false, acknowledged_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now())`
2. `library_health_flags(id UUID PK, block_id UUID FK→activity_blocks ON DELETE CASCADE, flag_type TEXT NOT NULL, severity TEXT NOT NULL, reason TEXT, resolved_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now())`
3. `usage_rollups(id UUID PK, period_type TEXT NOT NULL, period_start DATE NOT NULL, teacher_id UUID, student_id UUID, metrics JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT now())` + UNIQUE on (period_type, period_start, teacher_id, student_id)

**New columns on activity_blocks:**
- `last_used_at TIMESTAMPTZ` (nullable, no default — backfill from updated_at later if needed)
- `archived_at TIMESTAMPTZ` (nullable)
- `embedding_generated_at TIMESTAMPTZ` (nullable)
- `decay_applied_total INT DEFAULT 0`

**Verify:** All tables exist, columns added, FK cascades work.

### 4B — Library health queries
**File:** `src/lib/admin/library-health-queries.ts`
8 exported, typed, unit-tested query functions. Each takes a Supabase client, returns typed rows.
1. `getBlocksBySourceType()` → `{source_type, count}[]`
2. `getCategoryDistribution()` → `{activity_category, count}[]`
3. `getStaleBlocks(days=90)` → `{id, title, last_used_at, times_used}[]`
4. `getDuplicateSuspects(minSim=0.88, maxSim=0.92)` → `{block_a_id, block_b_id, similarity, title_a, title_b}[]` — uses pgvector `<=>` operator via RPC function
5. `getLowEfficacyBlocks(threshold=40, minUsage=3)` → `{id, title, efficacy_score, times_used}[]`
6. `getOrphanBlocks()` → `{id, title, missing_fields: string[]}[]`
7. `getEmbeddingHealth()` → `{total, missing_embedding, healthy}` 
8. `getCoverageHeatmap()` → `{phase, activity_category, count}[]`

**Note on #4:** Supabase JS client can't do cosine similarity joins directly. Options: (a) Supabase RPC function, (b) raw SQL via admin client. Use RPC — create a `find_duplicate_blocks` SQL function in migration 072.

**Tests:** Mock Supabase client, verify query construction and type mapping. At least 8 tests (one per query).

### 4C — 7 operational automation systems
All in `src/lib/jobs/`. Each: (a) module with `run()` export, (b) script in `scripts/ops/`, (c) writes to `system_alerts`, (d) unit test.

1. **pipeline-health-monitor.ts** — query generation_runs last 24h, compute success rate, write alert if < 95%
2. **cost-alert.ts** — sum total_cost JSONB per day/week/month, compare to env thresholds ($10/$50/$200), write alert + trigger email on threshold cross
3. **quality-drift-detector.ts** — compare 7d avg Pulse score (from quality_report JSONB) vs prior 30d, flag if drop > 10%
4. **teacher-edit-tracker.ts** — aggregate generation_feedback by day into summary buckets (most-edited, most-deleted blocks), write to system_alerts
5. **stale-data-watchdog.ts** — find embeddings > 90 days old, blocks without usage, incomplete teacher profiles, failed generation_runs spike
6. **smoke-tests.ts** — 6 wiring checks per §14.8 (verify tables queryable, FK chains intact, basic CRUD on each pipeline stage)
7. **usage-analytics.ts** — roll up per-teacher/per-student usage into usage_rollups table

**Scripts:** Each gets a `scripts/ops/run-{name}.ts` that imports the module and calls `run()` with a real Supabase client. Run with `npx tsx scripts/ops/run-{name}.ts`.

### 4D — Weekly + monthly hygiene jobs
- `src/lib/jobs/library-hygiene-weekly.ts` — staleness decay, flag duplicates, flag low-efficacy, reembed changed blocks, write summary to system_alerts
- `src/lib/jobs/library-hygiene-monthly.ts` — consolidation pass (>0.95 cosine + both <60 efficacy → merge proposal via feedback_proposals), orphan archival (12+ months untouched + efficacy <30 → set archived_at), health summary to system_alerts
- `scripts/run-hygiene.ts weekly|monthly`

### 4E — Library health dashboard
**Route:** `src/app/admin/library/health/page.tsx`
Tab container with 8 widgets. Each calls its query on mount. "Last refreshed" timestamp. No auto-polling.
- API route: `src/app/api/admin/library/health/route.ts` (or individual endpoints per widget)

### 4F — Pipeline health dashboard  
**Route:** `src/app/admin/pipeline/health/page.tsx`
Reads from system_alerts + generation_runs. Widgets: success rate gauge, stage failure heatmap, cost strip, error log tail, quality drift chart.
- API route: `src/app/api/admin/pipeline/health/route.ts`

### 4G — Cost alert delivery
**File:** `src/lib/monitoring/cost-alert-delivery.ts`
Install `resend` package. On threshold cross: write system_alerts + send email. Env vars: `COST_ALERT_EMAIL`, `COST_ALERT_DAILY_USD=10`, `COST_ALERT_WEEKLY_USD=50`, `COST_ALERT_MONTHLY_USD=200`, `RESEND_API_KEY`. Debounce: check system_alerts for same threshold within 6h before sending.
Console.log fallback when RESEND_API_KEY not set.

### 4H — Ops runbook + final verification
- `docs/projects/dimensions3-ops-runbook.md` listing all 7 systems, scripts, schedules, alert types
- Final test run: all tests pass, count >= 905 + new tests
- Review all commits for spec compliance

---

## Named checkpoints

**🛑 Checkpoint 4.1** — All widgets populated, all jobs runnable (spec §6.7)

Matt verifies:
1. `/admin/library/health` — every widget has real data
2. Each of 7 ops scripts runs and writes to system_alerts
3. `/admin/pipeline/health` — reflects system_alerts data
4. Cost alert email fires (temp threshold)
5. Cost alert debounce works (no duplicate emails within 6h)

---

## Commit plan (one per sub-task)

1. Migration 072 (schema only)
2. Library health queries + tests
3. 7 ops automation systems + tests + scripts
4. Hygiene jobs + tests
5. Library health dashboard (UI + API)
6. Pipeline health dashboard (UI + API)
7. Cost alert delivery + Resend integration
8. Ops runbook
