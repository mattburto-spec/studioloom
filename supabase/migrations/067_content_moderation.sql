-- Migration 067: Content moderation (ingestion side)
--
-- Closes Phase 1.5 items 4+7 of docs/projects/dimensions3-completion-spec.md.
-- Adds moderation_status to activity_blocks and a content_moderation_log table
-- that records every moderation decision against a specific content version
-- (via content_fingerprint) so re-moderation after an edit creates a new row
-- rather than overwriting history.
--
-- The broader §17 / Phase 5 student-facing moderation (student_progress,
-- gallery posts, peer review, image moderation, client-side blocklist) is NOT
-- in this migration. This is the ingestion slice only — enough to let Pass B
-- run a Haiku moderation pass on extracted activity blocks before they reach
-- the review queue.
--
-- Lesson #29 (audit RLS policies on the same table): the activity_blocks
-- SELECT policy is re-created here to also filter by moderation_status so
-- unapproved / flagged content cannot leak into student-facing queries that
-- rely on is_public=true.
--
-- Lesson #37 (backfill verify query + decision comment): the block at the
-- bottom of this migration fails loudly if any row is left with a NULL
-- moderation_status. If that happens, the migration aborts — we do NOT want
-- silently-orphaned content reaching the catalogue.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. activity_blocks.moderation_status
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE activity_blocks
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending';

-- CHECK constraint added after backfill so existing NULL rows don't violate.

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Backfill
-- ─────────────────────────────────────────────────────────────────────────
--
-- Seed rows from scripts/seed-teaching-moves.mjs are pre-vetted (Matt curated
-- the 55 Teaching Moves before they landed) and should not go through the
-- moderation queue. They get 'grandfathered'.
--
-- Everything else (anything a teacher or the sandbox has created) goes to
-- 'pending' so the next Haiku moderation pass picks it up.

UPDATE activity_blocks
SET moderation_status = 'grandfathered'
WHERE source_type = 'community'
  AND module = 'studioloom'
  AND efficacy_score = 65
  AND moderation_status IS NULL;

UPDATE activity_blocks
SET moderation_status = 'pending'
WHERE moderation_status IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Lesson #37 — verify query
-- ─────────────────────────────────────────────────────────────────────────
-- Fail loudly (not silently) if any row slipped past the backfill. If this
-- RAISE fires, the migration is rolled back — an orphan row must be resolved
-- by hand before this migration can be applied.

DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM activity_blocks
  WHERE moderation_status IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Migration 067 backfill failed: % activity_blocks row(s) still have NULL moderation_status. Resolve manually before re-running.',
      orphan_count;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. NOT NULL + CHECK constraint (safe to apply after backfill + verify)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE activity_blocks
  ALTER COLUMN moderation_status SET NOT NULL;

ALTER TABLE activity_blocks
  ADD CONSTRAINT activity_blocks_moderation_status_check
  CHECK (moderation_status IN ('approved','flagged','rejected','pending','grandfathered'));

CREATE INDEX IF NOT EXISTS idx_activity_blocks_moderation_status
  ON activity_blocks(moderation_status);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. content_moderation_log
-- ─────────────────────────────────────────────────────────────────────────
--
-- One row per moderation decision against one content version. If a block
-- is edited and re-moderated, insert a NEW row (keyed by content_fingerprint)
-- instead of overwriting — this preserves the full decision history for
-- audit and for future human-reviewer overrides.

CREATE TABLE IF NOT EXISTS content_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES activity_blocks(id) ON DELETE CASCADE,
  content_fingerprint TEXT,                         -- ties row to exact content version
  status TEXT NOT NULL
    CHECK (status IN ('approved','flagged','rejected','pending','grandfathered')),
  reason TEXT,                                      -- model rationale or rule name
  model_id TEXT,                                    -- e.g. 'claude-haiku-4-5-20251001'
  flags JSONB DEFAULT '[]'::jsonb,                  -- array of {category, severity, snippet}
  cost JSONB,                                       -- CostBreakdown shape
  overridden_by UUID REFERENCES teachers(id),       -- nullable — future human-reviewer override
  overridden_at TIMESTAMPTZ,                        -- nullable — set when overridden_by is set
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_moderation_log_block
  ON content_moderation_log(block_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_moderation_log_status
  ON content_moderation_log(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_moderation_log_fingerprint
  ON content_moderation_log(content_fingerprint);

ALTER TABLE content_moderation_log ENABLE ROW LEVEL SECURITY;

-- Only admins / service-role access the log. Teachers see their own moderation
-- results indirectly via the review queue, not this table.
CREATE POLICY content_moderation_log_service_only ON content_moderation_log
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Lesson #29 — re-audit activity_blocks SELECT policy
-- ─────────────────────────────────────────────────────────────────────────
--
-- The existing policy (from migration 060) let any row with is_public=true
-- be selected. With moderation in place, that would leak 'pending', 'flagged'
-- and 'rejected' blocks into any query that filters on is_public.
--
-- New rule: owners still see everything they own (including pending), but
-- "public" visibility is gated on moderation_status being approved or
-- grandfathered. This also implicitly protects /api/admin/library-type
-- queries that read public-owned blocks.

DROP POLICY IF EXISTS activity_blocks_select ON activity_blocks;

CREATE POLICY activity_blocks_select ON activity_blocks
  FOR SELECT
  USING (
    teacher_id = auth.uid()
    OR (
      is_public = true
      AND moderation_status IN ('approved','grandfathered')
    )
  );
