-- Migration: fabricators_failed_login_lockout
-- Created: 20260510090841 UTC
--
-- WHY: closes F-14 from the 9 May 2026 external security review (cowork).
-- Pre-fix the fabricator login at /api/fab/login uses an in-memory
-- rate-limit (lib/rate-limit.ts Map) that resets on Vercel cold-start
-- AND doesn't survive multiple Lambda instances. There's no per-account
-- lockout — a credential-stuffing attack from rotating IPs hits the
-- bcrypt.compare path on every attempt with no upper bound.
--
-- Q4 option A (chosen 9 May 2026): DB-column lockout. Mirrors the
-- existing classcode rate-limit pattern, no new vendor dependency,
-- persists across Lambda cold-starts.
--
-- IMPACT: 2 nullable columns added to fabricators table.
--   - failed_login_count INTEGER NOT NULL DEFAULT 0 — incremented on
--     each failed bcrypt.compare; reset to 0 on success.
--   - failed_login_locked_until TIMESTAMPTZ NULL — set to now() + 30min
--     when failed_login_count crosses threshold (10). Login route checks
--     this BEFORE running bcrypt.compare and returns 429 if active;
--     resets on the eventual successful login (when the lockout has
--     expired and the next correct credential succeeds).
--
-- No data migration — existing rows get DEFAULT 0 / NULL.
--
-- Source review:    docs/security/external-review-2026-05-09-findings.md F-14
-- Closure brief:    docs/projects/security-closure-2026-05-09-brief.md Phase S6
--
-- ROLLBACK: paired .down.sql drops the columns. Re-opens the
-- credential-stuffing surface; use only if the lockout logic surfaces
-- a hard regression.

BEGIN;

ALTER TABLE fabricators
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_login_locked_until TIMESTAMPTZ NULL;

COMMENT ON COLUMN fabricators.failed_login_count IS
  'F-14 (S6 9 May 2026) — incremented on each failed bcrypt.compare in /api/fab/login. Reset to 0 on successful login.';

COMMENT ON COLUMN fabricators.failed_login_locked_until IS
  'F-14 (S6 9 May 2026) — when failed_login_count crosses threshold (10), set to now() + 30 min. /api/fab/login returns 429 if now() < this. NULL = no active lockout.';

COMMIT;
