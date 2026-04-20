# Preflight — Phase 1B-1 Brief: Schema + Storage + AI Guardrails

> **Goal:** Land the schema changes, Supabase Storage buckets, and admin-settings seed that Phase 1B-2 (UI + email dispatch) and Phase 2 (scanner worker + AI enrichment) need. Schema only — no UI, no email, no Python worker.
> **Spec sources:** `docs/projects/fabrication-pipeline.md` §11 · `docs/projects/fabrication/migration-098-candidates.md` (signed off 20 Apr 2026) · `docs/projects/fabrication/ui-mockups-v0.md` · `docs/projects/fabrication/phase-0-decisions.md` D-04.
> **Estimated effort:** ~1 day elapsed (6 migrations, mostly additive). Runs through apply + verify + commit loop similar to Phase 1A.
> **Checkpoint:** **Checkpoint 1.1B-1** — all 6 migrations applied to prod, new columns/policies verified, 3 Storage buckets created, admin_settings seeded, no test regression.
> **Push discipline:** Stay on `main`. Commit per-sub-task. `phase-1b-1-wip` backup branch after each commit. **DO NOT push to `origin/main` until Checkpoint 1.1B-1 is signed off AND all migrations applied to prod Supabase.**

---

## Decisions already locked (carried forward)

| Ref | Decision |
|---|---|
| D-01 | Product name: Preflight. Schema stays `fabrication_*` (domain); user-facing surfaces say Preflight. |
| D-04 | 30-day retention post-terminal state. Column `retention_clock_started_at` exists (mig 095). App layer writes it on status transition (Phase 1B-2); deletion cron lands Phase 9. |
| D-05 | Fabricator own auth, not Supabase Auth. `fabricator_sessions` is the token-session table (mig 097). |
| D-07 | Per-profile rule-override JSONB on `machine_profiles` landed in Phase 1A. |
| D-10 | WIRING systems: `preflight-pipeline`, `preflight-scanner`, `machine-profiles`. |
| M-098 signed off | 8 candidates approved, decomposed into 6 migrations + 1 registry sync commit. See `migration-098-candidates.md`. |
| 098e variant | `students.fabrication_notify_email BOOLEAN` — NEW single-purpose column, NOT a JSONB reuse. Confirmed by audit: `students` has no existing `notification_preferences` pattern. |
| 102 model | All 3 Storage buckets get service-role-only RLS (matches FU-FF pattern with `fabrication_scan_jobs`, `fabricator_sessions`). Granular path-based RLS deferred to Phase 2. |

---

## Pre-work findings (captured in audit, 20 Apr 2026)

- Latest migration: **097** → Phase 1B-1 starts at **098**.
- Test baseline: **1362 passing, 8 skipped, 79 files.** Confirmed no drift from yesterday's saveme.
- Git: HEAD at `5bf339f`; 2 pre-existing unrelated mods in working tree; origin/main in sync.
- `students` table: **no existing notification-preference column** (grep across all migrations zero hits for `notification_preferences` / `notify_email` / `email_notifications`). Greenlit for new column.
- Storage: **no existing bucket setup in migrations.** Writing from scratch. Precedent: other services use `storage.buckets` via Supabase dashboard; policies via SQL on `storage.objects`.
- admin_settings: pattern is `INSERT ... ON CONFLICT (key) DO NOTHING` with JSONB values (migration 077).
- FK target for `lab_tech_picked_up_by` → `fabricators(id)` still deferred (raw UUID); not touching in 1B-1 per surgical rule.

---

## Lessons to re-read (full text, not titles)

- **#24** (`docs/lessons-learned.md:86`) — Never assume column names exist. Applies more to selects than additions but idempotent guards matter on ALL migrations.
- **#29** (`docs/lessons-learned.md:101`) — RLS UNION dual-visibility. Not directly applicable to 1B-1 (adding columns to existing-RLS tables) but if Storage RLS ever grows path-based policies, this pattern will reappear.
- **#38** (`docs/lessons-learned.md:141`) — Verify expected values, not just non-null. Every new column + policy needs a `SELECT` verify query with specific expected output.
- **#43–46** (`docs/lessons-learned.md:241-311`) — Karpathy discipline. Especially #45 — don't sneak scope; don't "while we're here" add columns not in the signed-off candidates list. Stick to the 8 candidates.
- **#47** (`docs/lessons-learned.md:315`) — Adding to shared yaml requires auditing writers. We'll sync schema-registry + WIRING in the final phase commit.
- **#51** (`docs/lessons-learned.md:380`) — Supabase dashboard "Run and enable RLS" parser bug. ALL migrations in 1B-1 avoid DO blocks with variable names matching RLS-sensitive identifiers. Verification happens via separate post-apply queries.

---

## Sub-tasks

Each sub-task = one migration file + one commit + one post-apply verify + one report cycle. Separate commits, no squashing (Lesson's "no squash" rule).

### 1B-1-1 — Migration 098: `fabrication_jobs` extended

Adds 3 columns to the existing table from migration 095:

```sql
ALTER TABLE fabrication_jobs
  ADD COLUMN IF NOT EXISTS student_intent JSONB;
ALTER TABLE fabrication_jobs
  ADD COLUMN IF NOT EXISTS printing_started_at TIMESTAMPTZ;
ALTER TABLE fabrication_jobs
  ADD COLUMN IF NOT EXISTS notifications_sent JSONB;
```

**Purposes:**
- `student_intent`: Pre-check answers (size bucket, units, material, optional description) per candidate 098a. Drives scanner context + AI enrichment.
- `printing_started_at`: "Currently printing" sub-state per candidate 098c. Fabricator UI derives state from `status='picked_up' + timestamp IS NOT NULL`.
- `notifications_sent`: Email idempotency per candidate 098d. Shape: `{approved_at, returned_at, rejected_at, picked_up_at, printing_started_at, completed_at}`.

**Post-apply verify:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fabrication_jobs'
  AND column_name IN ('student_intent', 'printing_started_at', 'notifications_sent')
ORDER BY column_name;
-- Expect: 3 rows, all nullable YES
```

**Commit:** `feat(preflight): migration 098 - fabrication_jobs pre-check + printing + notifications (1B-1-1)`

---

### 1B-1-2 — Migration 099: `fabricator_sessions.is_setup`

Adds one column for invite/password-reset flow per candidate 098b:

```sql
ALTER TABLE fabricator_sessions
  ADD COLUMN IF NOT EXISTS is_setup BOOLEAN NOT NULL DEFAULT false;
```

**Purpose:** `is_setup=true` marks a session as a one-time invite link (not a login). Consumed by `/fab/set-password` (Phase 1B-2).

**Post-apply verify:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'fabricator_sessions' AND column_name = 'is_setup';
-- Expect: 1 row, boolean, NOT NULL, default false

SELECT COUNT(*) FROM fabricator_sessions WHERE is_setup = true;
-- Expect: 0 (table is empty anyway)
```

**Commit:** `feat(preflight): migration 099 - fabricator_sessions.is_setup for invite flow (1B-1-2)`

---

### 1B-1-3 — Migration 100: `students.fabrication_notify_email`

Adds student email preference for Preflight notifications per candidate 098e:

```sql
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS fabrication_notify_email BOOLEAN NOT NULL DEFAULT true;
```

**Purpose:** Student opt-out toggle. Defaults `true` — keeps backward compat (existing students get notifications by default).

**Post-apply verify:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'students' AND column_name = 'fabrication_notify_email';
-- Expect: 1 row, boolean, NOT NULL, default true

SELECT COUNT(*) FROM students WHERE fabrication_notify_email = true;
-- Expect: count of all students (defaulted true on backfill)
```

**Safety note:** `students` is a hot table. ADD COLUMN with DEFAULT on Postgres 11+ is metadata-only — no table rewrite. Safe to run in a single transaction.

**Commit:** `feat(preflight): migration 100 - students.fabrication_notify_email preference (1B-1-3)`

---

### 1B-1-4 — Migration 101: `fabrication_job_revisions` extended

Adds 2 columns to the revisions table from migration 095:

```sql
ALTER TABLE fabrication_job_revisions
  ADD COLUMN IF NOT EXISTS ai_enrichment_cost_usd NUMERIC;
ALTER TABLE fabrication_job_revisions
  ADD COLUMN IF NOT EXISTS thumbnail_views JSONB;
```

**Purposes:**
- `ai_enrichment_cost_usd`: Per-scan AI cost tracking per candidate 098f. NULL = disabled or skipped; 0 = ran with full cache hit; > 0 = actual spend.
- `thumbnail_views`: Multi-angle + heatmap metadata per candidate 098g. Shape: `{views: {iso, front, side, top, walls_heatmap, overhangs_heatmap}, annotations: [{view, bbox, rule_id}]}`.

**Post-apply verify:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fabrication_job_revisions'
  AND column_name IN ('ai_enrichment_cost_usd', 'thumbnail_views')
ORDER BY column_name;
-- Expect: 2 rows, both nullable YES
```

**Commit:** `feat(preflight): migration 101 - job_revisions ai cost + thumbnail views (1B-1-4)`

---

### 1B-1-5 — Migration 102: Supabase Storage buckets + RLS

Creates 3 buckets + service-role-only RLS policies on `storage.objects`. No StudioLoom precedent — writing from scratch following Supabase docs.

```sql
-- ============================================================
-- 1. Create buckets (private; signed-URL access only)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('fabrication-uploads', 'fabrication-uploads', false),
  ('fabrication-thumbnails', 'fabrication-thumbnails', false),
  ('fabrication-pickup', 'fabrication-pickup', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. RLS policies on storage.objects — service-role-only for all 3 buckets
-- ============================================================
-- Matches FU-FF pattern (fabrication_scan_jobs, fabricator_sessions):
-- deny-all for authenticated role; service role bypasses RLS.
-- Granular path-based policies deferred to Phase 2.

DROP POLICY IF EXISTS "fabrication_uploads_service_role_all" ON storage.objects;
CREATE POLICY "fabrication_uploads_service_role_all"
  ON storage.objects FOR ALL
  USING (bucket_id = 'fabrication-uploads' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'fabrication-uploads' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "fabrication_thumbnails_service_role_all" ON storage.objects;
CREATE POLICY "fabrication_thumbnails_service_role_all"
  ON storage.objects FOR ALL
  USING (bucket_id = 'fabrication-thumbnails' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'fabrication-thumbnails' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "fabrication_pickup_service_role_all" ON storage.objects;
CREATE POLICY "fabrication_pickup_service_role_all"
  ON storage.objects FOR ALL
  USING (bucket_id = 'fabrication-pickup' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'fabrication-pickup' AND auth.role() = 'service_role');
```

**Post-apply verify:**
```sql
-- 1. Buckets exist
SELECT id, name, public FROM storage.buckets
WHERE id IN ('fabrication-uploads', 'fabrication-thumbnails', 'fabrication-pickup')
ORDER BY id;
-- Expect: 3 rows, all public=false

-- 2. Policies exist — 3 rows, one per bucket
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'fabrication_%_service_role_all'
ORDER BY policyname;
-- Expect: 3 rows, all cmd='ALL'
```

**Dashboard caveat (Lesson #51-adjacent):** the Supabase dashboard may intercept `storage.buckets` writes and prompt differently than regular CREATE TABLE. If the INSERT path fails, fallback is to create each bucket manually via Dashboard → Storage → New bucket (private), then apply only the RLS portion of this migration.

**Commit:** `feat(preflight): migration 102 - Storage buckets + service-role RLS (1B-1-5)`

---

### 1B-1-6 — Migration 103: `admin_settings` seed for AI guardrails

Inserts 3 key/value rows into the existing `admin_settings` table (migration 077):

```sql
INSERT INTO admin_settings (key, value) VALUES
  ('preflight.ai_enrichment_enabled', 'true'::jsonb),
  ('preflight.ai_enrichment_daily_cap_usd', '5.00'::jsonb),
  ('preflight.ai_enrichment_tiers_enabled', '["tier1"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
```

**Purposes:**
- `preflight.ai_enrichment_enabled`: Platform-wide kill switch. Worker reads this before every Haiku call.
- `preflight.ai_enrichment_daily_cap_usd`: Max AI spend per day. Worker sums today's `fabrication_job_revisions.ai_enrichment_cost_usd`; if ≥ cap, skip AI + emit `system_alerts` row.
- `preflight.ai_enrichment_tiers_enabled`: Which enrichment tiers to run. Pilot starts tier 1 only; tier 2/3 enabled post-validation.

**Post-apply verify:**
```sql
SELECT key, value
FROM admin_settings
WHERE key LIKE 'preflight.ai_enrichment_%'
ORDER BY key;
-- Expect: 3 rows
--   preflight.ai_enrichment_daily_cap_usd → 5.00
--   preflight.ai_enrichment_enabled       → true
--   preflight.ai_enrichment_tiers_enabled → ["tier1"]
```

**Commit:** `feat(preflight): migration 103 - admin_settings seed for AI guardrails (1B-1-6)`

---

### 1B-1-7 — Registry sync (final commit of the phase)

After all 6 migrations applied + verified, sync the governance registries:

1. **schema-registry.yaml** — update 3 existing entries:
   - `fabrication_jobs`: add 3 new columns to `columns` block
   - `fabricator_sessions`: add `is_setup`
   - `fabrication_job_revisions`: add 2 new columns
   - `students`: add `fabrication_notify_email` (existing table entry — I'll audit if it has one)
   - `admin_settings`: no schema change, but bump `last_updated`
2. **WIRING.yaml** — update `preflight-pipeline` `data_fields` to list new columns; update `preflight-scanner` to reference AI cost tracking + thumbnail_views.
3. **Storage system entry** — if `storage` doesn't exist in WIRING, add it (otherwise update its `affects` list).
4. **api-registry.yaml** — rerun `scan-api-routes.py --apply`, commit any drift (probably none since no new API routes yet).

**Commit:** `docs(preflight): schema-registry + WIRING sync after Phase 1B-1 (1B-1-7)`

---

## Success criteria — Checkpoint 1.1B-1

- [ ] `npm test` — still **1362 passing / 8 skipped** (DDL-only phase, no new tests, no regression)
- [ ] All 6 migrations applied successfully on prod
- [ ] 3 new columns on `fabrication_jobs` (`student_intent`, `printing_started_at`, `notifications_sent`)
- [ ] 1 new column on `fabricator_sessions` (`is_setup` NOT NULL DEFAULT false)
- [ ] 1 new column on `students` (`fabrication_notify_email` NOT NULL DEFAULT true)
- [ ] 2 new columns on `fabrication_job_revisions` (`ai_enrichment_cost_usd`, `thumbnail_views`)
- [ ] 3 Storage buckets (`fabrication-uploads`, `fabrication-thumbnails`, `fabrication-pickup`) exist as private
- [ ] 3 RLS policies on `storage.objects` scoped by bucket_id, service-role-only
- [ ] 3 admin_settings keys (`preflight.ai_enrichment_enabled`, `preflight.ai_enrichment_daily_cap_usd`, `preflight.ai_enrichment_tiers_enabled`) present with expected values
- [ ] `docs/schema-registry.yaml` updated for 4 tables
- [ ] `docs/projects/WIRING.yaml` `preflight-pipeline` + `preflight-scanner` entries updated to reference new columns
- [ ] `git log --oneline` shows 7 separate commits (6 migrations + 1 registry sync)
- [ ] `phase-1b-1-wip` branch pushed to origin; `main` **NOT pushed** until checkpoint signed off
- [ ] Checkpoint report in chat with pre-work findings, per-sub-task verify output verbatim, test count delta, commit hashes, any FU items filed

---

## Stop triggers (halt Phase 1B-1, report, wait for decision)

- **Storage bucket creation via SQL rejected by Supabase** → fall back to Dashboard-manual bucket creation. Confirm path, then resume with RLS-only part of migration 102. **Stop + tell Matt before proceeding.**
- **`ADD COLUMN` on `students` takes > 10s** → suggests rewrite on a large table. Halt, check row count, consider chunked approach. (ADD COLUMN + default on PG 11+ should be metadata-only — if slow, something's wrong.)
- **Test count drops below 1362** → halt; a migration broke a type assumption.
- **Any scanner (api-registry, ai-calls) strips the governance registry `version:` field on rewrite** → FU-DD pattern per Lesson #47, halt + fix scanner before committing registry sync.
- **Storage RLS policy syntax rejected on prod** → Supabase may restrict `storage.objects` ownership. Report exact error; may need to create policies via Dashboard instead.
- **admin_settings key collision** (existing row with same key) → shouldn't happen (new keys), but if the INSERT is non-empty-change, investigate why.

---

## Don't stop for

- Missing API routes for new columns (Phase 1B-2 will build them).
- No UI surfacing the new fields (Phase 1B-2 / Phase 2 scope).
- `fabrication_jobs.lab_tech_picked_up_by` still raw UUID — FK hardening stays deferred.
- Pre-existing rls-coverage drift (7 deny-all tables) — all intentional + documented.
- Minor diff in pre-existing tables' `applied_date` null entries (FU-AA scope).
- YAML parse warnings on `WIRING.yaml` scanner reports that don't relate to Preflight.

---

## Out of scope (deferred to 1B-2, Phase 2, or later)

| Deferred to | Why |
|---|---|
| Phase 1B-2 | Teacher Fabricator-invite UI, `/fab/login`, `/fab/set-password`, email dispatch at status transitions, student settings toggle UI |
| Phase 2 | Python scanner worker on Fly.io, actual AI enrichment Haiku calls, multi-angle thumbnail rendering, inline SVG overlay frontend |
| Phase 9 | Retention deletion cron (columns exist; no cron yet) |
| Future FU | FK hardening on `fabrication_jobs.lab_tech_picked_up_by`. Anonymous/anon-key RLS explicit verification. Granular path-based Storage RLS. Per-class override of `requires_teacher_approval`. Weekly Fabricator digest cron. |

---

## Execution note

Since Code (me) is executing this in the same session as the planning, each sub-task will land as:

1. I write the migration file + push status report
2. Matt applies in Supabase dashboard
3. Matt pastes verify query output
4. I commit, push to `phase-1b-1-wip` (not main)
5. Move to next sub-task

Matches the Phase 1A rhythm. Checkpoint 1.1B-1 happens once all 7 commits land (6 migrations + 1 registry sync) and all verify queries pass.
