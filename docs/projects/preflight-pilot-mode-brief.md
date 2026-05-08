# Preflight Pilot Mode — Brief

**Created:** 2026-05-08
**Branch:** `preflight-pilot-mode` (cut from `origin/main` `871f94e`)
**Worktree:** `/Users/matt/CWORK/questerra-preflight`
**Status:** 🔵 IN PROGRESS

## Why

David, a student in Matt's class, tried submitting a fab job via Preflight and got knocked back. Two real problems:

1. The scanner can false-positive in the early pilot. If a BLOCK rule fires the student is forced into a re-upload loop with no escape — even when the file is fine.
2. Matt-as-teacher had no visibility into the rejection. A key teaching moment passed silently.
3. Matt-as-developer has no surface to triage flagged jobs across classes for scanner-tuning.

This brief addresses all three. **Server-side auto-orient is explicitly deferred** — defer until pilot data shows it's worth ~2-3 days; students can fix orientation in Bambu in 5 seconds today.

## Scope (in)

**P1: Pilot Override (unblocks David first)**
- Add nullable override-tracking columns to `fabrication_jobs`
- Hardcoded `PILOT_MODE_ENABLED = true` constant in a new `src/lib/fabrication/pilot-mode.ts`
- `canSubmit()` accepts a `pilotMode` flag — when true, BLOCK rules become acknowledgeable just like WARN rules (with a stronger explicit-override prompt). When false, current behavior unchanged.
- Submit endpoint accepts an `overrideBlocks: true` body field; only honored when pilot mode is on; logs `pilot_override_at` + `pilot_override_rule_ids` on the job
- Student UI: when in pilot mode + ≥1 BLOCK rule, surface an "Override and proceed anyway" path with strong amber warning copy (separate from normal acknowledge path)

**P2: Teacher Needs-Attention view**
- Add a "Needs attention" tab to `/teacher/preflight` (between "Pending approval" and "Approved/queued")
- Bucketing: jobs in `pending_approval` with rule-counts > 0 OR `pilot_override_at IS NOT NULL`
- Add an amber 🚩 chip to overridden rows showing "Override (N rule(s))"
- No new endpoint; reuse existing queue endpoint with client-side filtering on the new column

**P3: Dev review surface**
- New route: `/admin/preflight/flagged` (admin-auth gated)
- Lists ALL jobs across ALL schools with rule_counts > 0 OR pilot_override_at NOT NULL
- Per-row: download link to the original file (signed URL), rule-count breakdown, override status, school/teacher/student
- Cap at 200 newest — pagination later if needed
- Read-only; no actions. Just visibility.

## Scope (out)

- ❌ Server-side auto-orient (deferred)
- ❌ Per-class pilot-mode toggles (hardcoded constant for v1; flip via PR when first 100 jobs pass real-pilot bar)
- ❌ Student notification when teacher reviews their override
- ❌ "Undo override" once submitted
- ❌ Rule-tuning UI on the dev surface (read-only triage only)

## Migration

Single migration adding two nullable columns to `fabrication_jobs`:

```sql
ALTER TABLE fabrication_jobs
  ADD COLUMN IF NOT EXISTS pilot_override_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pilot_override_rule_ids TEXT[] NULL;
```

Additive, nullable, no constraint, no backfill. Safe to apply against the prod schema even given the migration backlog (`FU-PROD-MIGRATION-BACKLOG-AUDIT`).

## Files touched (estimated)

- **New**:
  - `supabase/migrations/<ts>_fabrication_jobs_pilot_override.sql`
  - `supabase/migrations/<ts>_fabrication_jobs_pilot_override.down.sql`
  - `src/lib/fabrication/pilot-mode.ts`
  - `src/app/admin/preflight/flagged/page.tsx`
  - `src/app/api/admin/preflight/flagged/route.ts`
  - `src/lib/fabrication/__tests__/pilot-mode.test.ts`
- **Modified**:
  - `src/lib/fabrication/rule-buckets.ts` — add `pilotMode` param to `canSubmit()`
  - `src/lib/fabrication/orchestration.ts` — `submitJob()` accepts override + writes pilot_override_*
  - `src/app/api/student/fabrication/jobs/[jobId]/submit/route.ts` — pass override flag through
  - `src/components/fabrication/ScanResultsViewer.tsx` (+ wherever the submit button lives) — add override-and-proceed CTA
  - `src/app/teacher/preflight/page.tsx` + `teacher-queue-helpers.ts` — Needs Attention tab
  - `src/lib/fabrication/teacher-orchestration.ts` — add `pilotOverrideAt` to QueueRow

## Test baseline

**4835 passing / 11 skipped** (vitest, captured at 2026-05-08).

## Sub-phase commits

Each sub-phase = its own commit, no squashing per build-methodology §7.

- **P0** — migration stub + claim (push immediately)
- **P1a** — migration body + pilot-mode.ts + canSubmit pilot-mode path + unit tests
- **P1b** — submit endpoint + student UI override button
- **P2** — teacher Needs Attention tab + override chip
- **P3** — dev review surface + admin route

## Stop triggers

- Any pre-existing test breaks in baseline run before code lands
- `tsc --noEmit` produces unrelated errors (BugReportButton.tsx html-to-image known per handoff — don't gate on that one)
- Discovery that submit endpoint has additional gating I missed (e.g. some other 400 path)
- Migration scanner finds collision with another in-flight branch

## Don't stop for

- Matt's manual smoke (per memory: ship through Vercel preview, only pause at named checkpoints)
- Cosmetic copy iterations (use a sensible default, iterate post-pilot)
- Auto-orient temptation (deferred — if it surfaces as relevant, file as `FU-PILOT-AUTO-ORIENT`)

## Registry hygiene (deferred to saveme on phase close)

- `schema-registry.yaml` — add the 2 columns to the `fabrication_jobs` entry
- `api-registry.yaml` — auto-rerun on saveme (will pick up the 2 new routes)
- WIRING.yaml — `fabrication-pipeline` system gets a `pilot_mode` flag noted in `data_fields`

## Checkpoint

**Pilot Mode 1.1** — Matt smokes one BLOCK-firing upload via Vercel preview, hits override, sees the job in his Needs Attention tab, and Matt-as-dev sees it on `/admin/preflight/flagged`. End-to-end loop closed.
