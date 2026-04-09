# Dimensions3 Phase E — Admin Dashboard + Polish

## CRITICAL: Git & File Rules

1. **Work directly on the `main` branch.** Do NOT use worktrees, do NOT create a new branch.
2. **All file paths use the full path from `/questerra/`.** Not relative paths.
3. **When all tasks are complete, `git add` the new/changed files and `git commit` them on main.**
4. **Verify the commit exists with `git log --oneline -3` before reporting done.**

---

## Context

You are building Phase E (Admin Dashboard + Polish) of the Dimensions3 pipeline rebuild for StudioLoom. Phases A-D are COMPLETE and committed on `main`. The full pipeline (generation + ingestion + feedback) is built — Phase E adds the admin dashboard, unit import flow, smoke tests, and operational monitoring that make it production-ready.

---

## What Already Exists (on `main`)

**Phase A-D files:**
- `/questerra/src/types/activity-blocks.ts` — All type definitions
- `/questerra/src/lib/pipeline/stages/` — 6 real pipeline stages
- `/questerra/src/lib/pipeline/orchestrator.ts` — Pipeline runner with sandbox/live modes
- `/questerra/src/lib/pipeline/generation-log.ts` — Generation run logging
- `/questerra/src/lib/ingestion/` — Full ingestion pipeline (pass registry, Pass A + B, extraction, PII scan)
- `/questerra/src/lib/feedback/` — Edit tracker, efficacy computation, signals, guardrails, self-healing
- `/questerra/src/app/admin/feedback/page.tsx` — Approval queue page (Phase D)
- `/questerra/src/components/admin/feedback/` — ApprovalQueue.tsx, AdjustmentCard.tsx
- `/questerra/src/app/api/admin/feedback/route.ts` — Feedback CRUD API
- `/questerra/supabase/migrations/060_activity_blocks.sql` — activity_blocks table
- `/questerra/supabase/migrations/061_generation_runs.sql` — generation_runs logging
- `/questerra/supabase/migrations/064_feedback_proposals.sql` — feedback tables (generation_feedback, feedback_proposals, feedback_audit_log)

**Existing admin pages:**
- `/questerra/src/app/admin/layout.tsx` — Admin layout with header, "Back to Dashboard" link, purple Admin badge
- `/questerra/src/app/admin/sandbox/page.tsx` — Pipeline sandbox (Phase A)
- `/questerra/src/app/admin/feedback/page.tsx` — Approval queue (Phase D)
- `/questerra/src/app/admin/controls/page.tsx` — Existing controls page
- `/questerra/src/app/admin/ai-model/page.tsx` — Existing AI model picker

---

## What to Build: Phase E (Admin + Polish, ~3 days)

The master spec is at `/questerra/docs/projects/dimensions3.md`:
- Section 14.7 "Admin Section — Full Design" (line ~1654) — dashboard landing + 12 tabs
- Section 9.3 "Operational Automation" (line ~1234) — 7 monitoring systems
- Section 14.8 "Wiring Health Checks" (line ~1700) — 6 E2E flow tests
- Section 4 "Unit Import Flow" (line ~556) — upload → reconstruct → match report

### Task E1: Unit Import Flow

**Purpose:** Teachers upload an existing unit plan document, the system runs ingestion + reconstruction, and shows a match report.

**Spec reference (line ~556):**
1. Teacher uploads a document that IS a full unit plan (not just a resource)
2. Run the existing ingestion pipeline (Pass A classify, Pass B enrich, block extraction)
3. **Reconstruction stage:** AI call (medium model = Sonnet) that:
   - Takes the extracted blocks from ingestion
   - Detects lesson boundaries, sequence order, learning progression, assessment points
   - Assembles into a StudioLoom unit structure matching the original
4. **Match Report:** Side-by-side comparison showing original (left) vs reconstruction (right), per-lesson match %, colour-coded diff
5. Teacher can accept, edit, or reject the reconstruction

**Where to put code:**
- `/questerra/src/lib/ingestion/unit-import.ts` — Reconstruction logic (uses ingestion pipeline + AI reconstruction call)
- `/questerra/src/app/teacher/knowledge/import/page.tsx` — Import UI page
- `/questerra/src/components/teacher/knowledge/MatchReport.tsx` — Match report component (side-by-side diff view)
- `/questerra/src/app/api/teacher/knowledge/import/route.ts` — Upload + reconstruct API endpoint

### Task E2: Admin Dashboard Landing Page

**Purpose:** Single landing page at `/admin` showing system health at a glance.

**Spec reference (line ~1656):**
1. **Health strip:** 5 traffic lights (green/amber/red) for Pipeline, Library, Cost, Quality, Wiring
2. **Active alerts:** Red badges, click to expand. Alerts from: failed generation runs, high cost, low Pulse scores, broken wiring
3. **Quick stats row:** Active teachers, active students, units generated, blocks in library, open bug reports
4. **Trend sparklines:** 7-day trend for each stat (tiny inline charts)
5. **Navigation:** Links/tabs to all admin sections

**Health check logic:**
- Pipeline: Check `generation_runs` for recent failures vs successes
- Library: Check `activity_blocks` count, flagged blocks, stale blocks
- Cost: Aggregate from `ai_usage_log` (if exists) or `generation_runs` cost data
- Quality: Average Pulse scores from recent runs
- Wiring: Results from E2E smoke tests (Task E4)

**Where to put code:**
- `/questerra/src/app/admin/page.tsx` — Dashboard landing page
- `/questerra/src/components/admin/dashboard/HealthStrip.tsx` — Traffic light health indicators
- `/questerra/src/components/admin/dashboard/QuickStats.tsx` — Stats row with sparklines
- `/questerra/src/components/admin/dashboard/AlertsFeed.tsx` — Active alerts list
- `/questerra/src/lib/admin/health-checks.ts` — Health check computation logic
- `/questerra/src/app/api/admin/health/route.ts` — Health data API

### Task E3: Admin Tab Navigation + Key Tabs

**Purpose:** Build the tab navigation shell and the most critical tabs. Not all 12 tabs need full implementations — build the shell + 4-5 key tabs with real data, stubs for the rest.

**Spec reference (line ~1662):** The spec describes 12 tabs. Build these fully:

1. **Pipeline Health tab** — Recent generation runs (from `generation_runs` table), per-stage success/failure rates, error log, average generation time. Use data from `generation_runs.stage_results` JSONB.

2. **Block Library tab** — Browse/search blocks from `activity_blocks`. Show: title, bloom_level, phase, activity_category, efficacy_score, times_used. Filter by category, phase, source_type. Sort by efficacy, usage, date. Bulk actions placeholder.

3. **Sandbox tab** — Already exists at `/admin/sandbox`. Link to it from the tab bar.

4. **Cost & Usage tab** — Aggregate costs from `generation_runs.total_cost` (or `stage_results` cost breakdowns). Daily/weekly/monthly views. Per-teacher breakdown if teacher_id available on runs.

5. **Settings tab** — Model selection per tier (Tier 1 ingestion/Haiku, Tier 2 analysis/Sonnet, Tier 3 generation/Sonnet). Feature flags placeholders. Guardrail config viewer (read-only display of hard limits from `/questerra/src/lib/feedback/guardrails.ts`).

**Stub tabs** (just a placeholder page with title + "Coming soon"):
- Quality, Wiring, Teachers, Students, Schools, Bug Reports, Audit Log

**Where to put code:**
- `/questerra/src/app/admin/layout.tsx` — UPDATE to add tab navigation bar below the header
- `/questerra/src/app/admin/pipeline/page.tsx` — Pipeline Health tab
- `/questerra/src/app/admin/library/page.tsx` — Block Library browser
- `/questerra/src/app/admin/costs/page.tsx` — Cost & Usage tab
- `/questerra/src/app/admin/settings/page.tsx` — Settings tab
- `/questerra/src/components/admin/pipeline/RunHistory.tsx` — Recent runs table
- `/questerra/src/components/admin/library/BlockBrowser.tsx` — Block search + browse
- `/questerra/src/components/admin/costs/CostOverview.tsx` — Cost aggregation views
- `/questerra/src/app/api/admin/pipeline/route.ts` — Pipeline data API
- `/questerra/src/app/api/admin/library/route.ts` — Block library API (search, filter, browse)

### Task E4: Smoke Tests

**Purpose:** 6 end-to-end flow tests that verify the full pipeline wiring works.

**Spec reference (line ~1703):**
1. **Ingestion → Library:** Call ingestion pipeline with test content → verify blocks created in `activity_blocks` with correct metadata
2. **Library → Generation:** Call generation pipeline with test unit brief → verify blocks retrieved from library
3. **Generation → Delivery:** Verify generated unit content renders (content_data has valid structure)
4. **Delivery → Tracking:** Simulate student interaction → verify `student_progress` data saved
5. **Tracking → Feedback:** Simulate teacher edit on generated unit → verify `generation_feedback` entry created
6. **Feedback → Library:** Process feedback → verify efficacy score adjustment proposed

**Implementation:**
- These are Vitest test files, NOT runtime tests
- Each test exercises the real functions (not mocks where possible) against test data
- Can be run via `npx vitest run src/lib/__tests__/smoke-tests.test.ts`
- Also runnable from admin dashboard (on-demand trigger via API)

**Where to put code:**
- `/questerra/src/lib/__tests__/smoke-tests.test.ts` — All 6 E2E flow tests
- `/questerra/src/app/api/admin/smoke-tests/route.ts` — On-demand trigger endpoint (runs tests, returns results)

### Task E5: Operational Monitoring Hooks

**Purpose:** Wire the 7 operational automation systems (spec line ~1234) into queryable functions that the admin dashboard can call.

**The 7 systems:**
1. **Pipeline Health Monitor** — Query `generation_runs` for last 24h: success/failure rate, avg time, cost trend
2. **Cost Alert System** — Check if daily spend exceeds threshold, single generation cost spikes, monthly trend
3. **Quality Drift Detector** — Compare average Pulse scores this week vs 4-week rolling average
4. **Teacher Edit Tracker Summary** — Most-edited blocks, most-deleted, new patterns teachers add
5. **Stale Data Watchdog** — Find: stale profiles (6+ months), unscanned blocks (7+ days), failed runs spiking, orphaned data
6. **Smoke Test Results** — Last run results from Task E4
7. **Usage Analytics** — Active teachers/students, units generated, blocks in library, toolkit usage counts

**Implementation:** Each system is a pure function that queries the database and returns a typed result. These feed into the admin dashboard (E2) and can be called from API routes.

**Where to put code:**
- `/questerra/src/lib/admin/monitors/pipeline-health.ts`
- `/questerra/src/lib/admin/monitors/cost-alerts.ts`
- `/questerra/src/lib/admin/monitors/quality-drift.ts`
- `/questerra/src/lib/admin/monitors/edit-tracker-summary.ts`
- `/questerra/src/lib/admin/monitors/stale-watchdog.ts`
- `/questerra/src/lib/admin/monitors/usage-analytics.ts`
- `/questerra/src/lib/admin/monitors/index.ts` — Export all monitors
- `/questerra/src/app/api/admin/monitors/route.ts` — API to run any/all monitors

---

## Critical Constraints

1. **Haiku model ID:** `claude-haiku-4-5-20251001`
2. **Build must pass clean** — `npx next build`
3. **All new code must have tests.** Test the monitor functions, smoke tests, health check logic, unit import reconstruction.
4. **Admin layout must integrate existing pages.** Don't break the existing sandbox, feedback, controls, or ai-model pages. They should be accessible from the new tab navigation.
5. **Tab navigation:** Use a horizontal tab bar or sidebar that shows all admin sections. Existing pages (`/admin/sandbox`, `/admin/feedback`, `/admin/controls`, `/admin/ai-model`) should appear in the navigation.
6. **No authentication changes.** Use the existing admin check pattern (the layout already has admin-only access).
7. **Queries should handle empty tables gracefully.** In dev/staging there may be zero generation_runs, zero activity_blocks, etc. Show "No data yet" states, not errors.

## Spec References (READ THESE)

- **Primary spec:** `/questerra/docs/projects/dimensions3.md`
  - Section 14.7 Admin Section Full Design (line ~1654)
  - Section 9.3 Operational Automation (line ~1234)
  - Section 14.8 Wiring Health Checks (line ~1700)
  - Section 4 Unit Import Flow (line ~556)
- **Types:** `/questerra/src/types/activity-blocks.ts`
- **Generation runs schema:** `/questerra/supabase/migrations/061_generation_runs.sql`
- **Feedback schema:** `/questerra/supabase/migrations/064_feedback_proposals.sql`
- **Activity blocks schema:** `/questerra/supabase/migrations/060_activity_blocks.sql`
- **Existing admin layout:** `/questerra/src/app/admin/layout.tsx`
- **Existing feedback page:** `/questerra/src/app/admin/feedback/page.tsx`
- **Pipeline stages:** `/questerra/src/lib/pipeline/stages/`
- **Ingestion pipeline:** `/questerra/src/lib/ingestion/`
- **Feedback system:** `/questerra/src/lib/feedback/`
