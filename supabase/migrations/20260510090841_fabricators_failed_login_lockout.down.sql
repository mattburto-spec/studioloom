-- Rollback for: fabricators_failed_login_lockout
-- Pairs with: 20260510090841_fabricators_failed_login_lockout.sql
--
-- WARNING: re-opens the credential-stuffing surface flagged by F-14
-- (no per-account lockout, only in-memory rate-limit). Use only if the
-- lockout logic in /api/fab/login surfaces a hard regression.

BEGIN;

ALTER TABLE fabricators
  DROP COLUMN IF EXISTS failed_login_locked_until,
  DROP COLUMN IF EXISTS failed_login_count;

COMMIT;
