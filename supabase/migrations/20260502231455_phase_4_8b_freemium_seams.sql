-- Migration: phase_4_8b_freemium_seams
-- Created: 20260502231455 UTC
-- Phase: Access Model v2 Phase 4.8b (freemium-build seam bake-in)
--
-- WHY: Pre-bake schema seams that the post-access-v2 freemium project
--   needs, so it becomes a fill-in (~6.75 eng days) rather than a
--   full schema-rewrite cycle. Per the freemium audit signed off
--   2 May 2026 PM (master spec Decision 8 amendment context):
--
--     - schools.subscription_tier already exists (mig 20260428125547)
--     - teachers.subscription_tier — ADD HERE (Pro Teacher self-serve
--       slot; CHECK enum mirrors schools)
--     - stripe_customer_id — ADD on both schools + teachers (nullable
--       + unique-when-set; ready for Stripe webhook UPDATEs without
--       a future schema cycle)
--
-- IMPACT:
--   - teachers gains 2 columns (subscription_tier + stripe_customer_id)
--   - schools gains 1 column (stripe_customer_id)
--   - 2 unique-when-set partial indexes on stripe_customer_id
--     (so Stripe webhook UPDATE … WHERE stripe_customer_id = ? is
--     unambiguous)
--   - 1 index on teachers.subscription_tier for tier-aware queries
--
-- ROLLBACK: paired .down.sql drops all 3 columns. Refuses if any
--   non-default values present (would lose data).
--
-- OUT OF SCOPE (deferred to post-access-v2 freemium build):
--   - Stripe SDK / webhook routes / pricing UI
--   - Plan-limit count queries + admin_settings constants
--   - Tier-feature matrix decisions (PRODUCT call required before
--     freemium build kicks off)
--   - Trial / grace-period state machine

-- ============================================================
-- 1. teachers.subscription_tier (Pro Teacher slot)
-- ============================================================
-- Mirrors schools.subscription_tier exactly so the SubscriptionTier
-- type in src/lib/access-v2/permissions/actions.ts works for both.
-- Default 'free' — every existing teacher today (just NIS-Matt + Gmail-Matt
-- post-3-Matts cleanup) starts on free.

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
  CHECK (subscription_tier IN ('pilot','free','starter','pro','school'));

CREATE INDEX IF NOT EXISTS idx_teachers_subscription_tier
  ON teachers(subscription_tier);

COMMENT ON COLUMN teachers.subscription_tier IS
  'Phase 4.8b — per-teacher subscription tier (Pro Teacher self-serve '
  'slot). Mirrors schools.subscription_tier enum. Resolution at session '
  'level via actor-session.ts: teacher-tier wins, then school-tier '
  'inherits, then free fallback.';

-- ============================================================
-- 2. stripe_customer_id columns (nullable, unique-when-set)
-- ============================================================
-- Nullable: most existing rows have no Stripe customer yet (none today,
-- since freemium build hasn't shipped). Unique-when-set: Stripe webhook
-- UPDATEs by stripe_customer_id; we want exactly-one-row matching at
-- write time.

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT NULL;

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_stripe_customer
  ON schools(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_stripe_customer
  ON teachers(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN schools.stripe_customer_id IS
  'Phase 4.8b — Stripe customer id (cus_xxx). Null until school '
  'upgrades. Unique-when-set so Stripe webhook UPDATE … WHERE '
  'stripe_customer_id = ? is unambiguous.';

COMMENT ON COLUMN teachers.stripe_customer_id IS
  'Phase 4.8b — Stripe customer id for self-serve Pro Teacher (cus_xxx). '
  'Null until teacher upgrades. Unique-when-set.';

-- ============================================================
-- 3. Sanity check
-- ============================================================

DO $$
DECLARE
  v_teachers_tier_exists BOOLEAN;
  v_teachers_stripe_exists BOOLEAN;
  v_schools_stripe_exists BOOLEAN;
  v_teachers_default_free INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teachers'
      AND column_name = 'subscription_tier'
  ) INTO v_teachers_tier_exists;
  IF NOT v_teachers_tier_exists THEN
    RAISE EXCEPTION 'Migration failed: teachers.subscription_tier missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teachers'
      AND column_name = 'stripe_customer_id'
  ) INTO v_teachers_stripe_exists;
  IF NOT v_teachers_stripe_exists THEN
    RAISE EXCEPTION 'Migration failed: teachers.stripe_customer_id missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schools'
      AND column_name = 'stripe_customer_id'
  ) INTO v_schools_stripe_exists;
  IF NOT v_schools_stripe_exists THEN
    RAISE EXCEPTION 'Migration failed: schools.stripe_customer_id missing';
  END IF;

  -- All existing teachers default to 'free'
  SELECT COUNT(*) INTO v_teachers_default_free
  FROM teachers
  WHERE subscription_tier = 'free';

  RAISE NOTICE 'Migration phase_4_8b_freemium_seams applied OK: '
               '3 columns added, 3 indexes, % teachers defaulted to free tier',
               v_teachers_default_free;
END $$;
