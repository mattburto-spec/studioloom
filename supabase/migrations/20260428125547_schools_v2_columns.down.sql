-- Rollback for: schools_v2_columns
-- Pairs with: 20260428125547_schools_v2_columns.sql
-- Phase: Access Model v2 Phase 0.1
--
-- Drops the 2 indexes first (they reference the columns), then the 6
-- columns in reverse order of their addition. IF EXISTS guards make
-- this idempotent for partial-apply recovery.

DROP INDEX IF EXISTS idx_schools_subscription_tier;
DROP INDEX IF EXISTS idx_schools_status_active;

ALTER TABLE schools
  DROP COLUMN IF EXISTS default_locale,
  DROP COLUMN IF EXISTS timezone,
  DROP COLUMN IF EXISTS subscription_tier,
  DROP COLUMN IF EXISTS bootstrap_expires_at,
  DROP COLUMN IF EXISTS region,
  DROP COLUMN IF EXISTS status;
