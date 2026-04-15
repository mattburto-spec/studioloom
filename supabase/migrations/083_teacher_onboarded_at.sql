-- Migration 083 — teachers.onboarded_at
--
-- Adds the first-login welcome-flow marker. NULL means the teacher has not
-- completed the /teacher/welcome wizard yet; the teacher layout redirects
-- them there on every request until this is set.
--
-- Existing teachers get backfilled to now() so returning users don't get
-- trapped in a welcome flow they never needed. New invites land with
-- onboarded_at NULL (default) and go through the wizard once.
--
-- Part of ShipReady Phase 1B (Teacher Onboarding Flow).
-- See docs/projects/ship-ready-build-plan.md

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Backfill existing accounts — they already have classes/units and should
-- not be forced through the welcome flow.
UPDATE teachers
  SET onboarded_at = COALESCE(onboarded_at, created_at, now())
  WHERE onboarded_at IS NULL;

-- Index so the teacher layout redirect check stays fast at scale. Teachers
-- who have finished onboarding (the common case) fall out of the partial
-- index immediately, so the redirect check only scans the pending set.
CREATE INDEX IF NOT EXISTS idx_teachers_onboarded_pending
  ON teachers (id)
  WHERE onboarded_at IS NULL;

COMMENT ON COLUMN teachers.onboarded_at IS
  'Timestamp the teacher completed the /teacher/welcome wizard. NULL = redirect to welcome on every request. Backfilled to created_at for pre-migration accounts.';
