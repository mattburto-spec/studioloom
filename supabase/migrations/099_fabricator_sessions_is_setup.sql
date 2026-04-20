-- Migration 099: fabricator_sessions.is_setup — invite / password-reset flow
--
-- Preflight Phase 1B-1-2. One nullable-default column on an existing table
-- (fabricator_sessions created in migration 097). No RLS changes — column
-- inherits the deny-all deny-all pattern from 097.
--
-- Refs:
--   - Brief:      docs/projects/preflight-phase-1b-1-brief.md (1B-1-2)
--   - Candidates: docs/projects/fabrication/migration-098-candidates.md (098b)
--   - Decision:   docs/projects/fabrication/phase-0-decisions.md (D-05 Fabricator auth)
--   - Lessons:    #24 (idempotent guards), #45 (surgical), #51 (no DO blocks)

-- ============================================================
-- 1. ADD COLUMN (idempotent guard)
-- ============================================================

ALTER TABLE fabricator_sessions
  ADD COLUMN IF NOT EXISTS is_setup BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 2. Column documentation
-- ============================================================

COMMENT ON COLUMN fabricator_sessions.is_setup IS
  'True for one-time invite / password-reset sessions; false for normal '
  'login sessions (candidate 098b). /fab/set-password consumes setup '
  'sessions: verify is_setup=true + expires_at > now(), allow password '
  'set, then DELETE the setup row and INSERT a normal (is_setup=false) '
  'session. 24h TTL via existing expires_at.';

-- ============================================================
-- 3. Post-apply verification (run as separate queries in the dashboard)
-- ============================================================
-- No DO block per Lesson #51.
--
--   -- (a) Column shape
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'fabricator_sessions' AND column_name = 'is_setup';
--   -- Expected 1 row: is_setup | boolean | NO | false
--
--   -- (b) Comment present
--   SELECT pg_catalog.col_description(
--            (SELECT oid FROM pg_catalog.pg_class WHERE relname='fabricator_sessions'),
--            (SELECT ordinal_position FROM information_schema.columns
--               WHERE table_name='fabricator_sessions' AND column_name='is_setup')
--          );
--   -- Expected: comment starting "True for one-time invite…"
--
--   -- (c) No existing setup sessions (table empty anyway)
--   SELECT COUNT(*) FROM fabricator_sessions WHERE is_setup = true;
--   -- Expected: 0
--
--   -- (d) RLS unchanged (still 0 policies — deny-all pattern from 097)
--   SELECT COUNT(*) FROM pg_policies WHERE tablename = 'fabricator_sessions';
--   -- Expected: 0
