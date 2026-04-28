-- Migration: schools_v2_columns
-- Created: 20260428125547 UTC
-- Phase: Access Model v2 Phase 0.1
--
-- WHY: Phases 1-6 of Access Model v2 need somewhere to write lifecycle
--   state, residency hint, governance bootstrap window, monetisation tier,
--   timezone for scheduled jobs, and locale for i18n forward-compat. This
--   migration adds 6 columns to the existing schools table (mig 085) so
--   later phases can consume them without further schema work.
-- IMPACT: schools table gains 6 columns + 2 indexes. No RLS changes (RLS
--   already enabled on schools per mig 085; column-level access is the
--   same as row-level today). No effect on existing readers.
-- ROLLBACK: paired .down.sql drops all 6 columns + 2 indexes.
--
-- All defaults are total (no conditional backfill needed) so Lesson #38
-- (ADD COLUMN DEFAULT silently overrides conditional UPDATE) doesn't bite.
-- Defaults apply uniformly to every existing row.
--
-- Existing rows: schools (mig 085) + 085_schools_seed. NIS school
-- (school_id 636ff4fc-...) plus seeded IB / CIS / ECIS rows. None
-- have multi-teacher bootstrap state (mig 085 is pre-Phase-0), so
-- bootstrap_expires_at stays NULL for all existing rows. New schools
-- created post-this-migration get NOW() + 7 days set by app code in
-- Phase 4 (school registration).

-- Lifecycle status: every existing school is 'active'.
ALTER TABLE schools
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','dormant','archived','merged_into'));

-- Data residency hint. Default 'default' (means: use platform default,
-- which is the single Supabase project today). Future regional splits
-- read this column to know who would move.
ALTER TABLE schools
  ADD COLUMN region TEXT NOT NULL DEFAULT 'default';

-- Bootstrap grace window for governance §8.3 of access-model-v2.md.
-- NULL on existing rows (they predate the bootstrap concept). New
-- schools created in Phase 4 get NOW() + 7 days set on insert; the
-- column flips to NULL when the second teacher joins (handled by
-- Phase 4 trigger or app code).
ALTER TABLE schools
  ADD COLUMN bootstrap_expires_at TIMESTAMPTZ NULL;

-- Monetisation seam (see access-model-v2.md §8.6 item 6). Every existing
-- school starts on 'pilot'; NIS gets bumped manually post-pilot.
-- monetisation.md tier-gates against this column via the can() helper
-- and the AI budget cascade.
ALTER TABLE schools
  ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'pilot'
  CHECK (subscription_tier IN ('pilot','free','starter','pro','school'));

-- Timezone for AI budget reset (Decision 6), retention cron (Phase 5),
-- audit log day-bucketing. IANA format. App layer validates new values
-- via PostgreSQL's "now() AT TIME ZONE timezone" round-trip. Default
-- 'Asia/Shanghai' because every existing school today is China-based;
-- Phase 4 school registration flow asks during onboarding.
ALTER TABLE schools
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai';

-- Locale seam (regret-prevention pass — see access-model-v2.md §3 item 39).
-- No translation system in v2 — just the column. Resolution chain in
-- Phase 1+ session helpers: user.locale ?? school.default_locale ?? 'en'.
-- When i18n eventually lands, the columns are populated and routes
-- already pass locale through.
ALTER TABLE schools
  ADD COLUMN default_locale TEXT NOT NULL DEFAULT 'en';

-- Indexes — partial because most queries don't filter on status/tier
-- but admin queries and tier-gated features do.
CREATE INDEX IF NOT EXISTS idx_schools_status_active
  ON schools(status) WHERE status != 'active';
CREATE INDEX IF NOT EXISTS idx_schools_subscription_tier
  ON schools(subscription_tier);

-- Sanity check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='schools' AND column_name='status'
  ) THEN
    RAISE EXCEPTION 'Migration schools_v2_columns failed: status column missing';
  END IF;
  RAISE NOTICE 'Migration schools_v2_columns applied OK: 6 columns + 2 indexes added';
END $$;
