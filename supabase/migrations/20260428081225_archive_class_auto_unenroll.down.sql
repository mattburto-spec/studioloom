-- Rollback for: archive_class_auto_unenroll
-- Pairs with: 20260428081225_archive_class_auto_unenroll.sql
--
-- Drops the trigger + function. Does NOT revert the one-time backfill
-- (the rows we set is_active=false on stay that way) — that's the
-- correct behaviour because:
--   1. Bug 4's resolver-level archived-class filter would re-hide them
--      anyway, so reverting them buys nothing
--   2. Re-enrolling students into an archived class would create the
--      exact "active enrollment in archived class" drift this migration
--      cleaned up

DROP TRIGGER IF EXISTS trigger_class_archive_unenroll_students ON classes;
DROP FUNCTION IF EXISTS class_archive_unenroll_students();
