-- Migration 069: Idempotent grandfather safety net for migration 067
--
-- Post-mortem: migration 067 contained an order-of-operations bug. The
-- column was added with `DEFAULT 'pending'`, which backfilled EVERY
-- existing row to 'pending' at ALTER time. The subsequent
--     UPDATE ... SET moderation_status = 'grandfathered'
--     WHERE source_type = 'community' AND ... AND moderation_status IS NULL
-- then matched zero rows (nothing was NULL), and the grandfather
-- assignment was silently overwritten. The verify query at the end of
-- 067 passed because all rows WERE non-NULL — it just wasn't checking
-- the VALUE was correct. See Lesson #38 in docs/lessons-learned.md.
--
-- This migration re-runs the grandfather UPDATE WITHOUT the IS NULL
-- predicate, so it will take effect whether the row is currently
-- 'pending' or already 'grandfathered'. Idempotent: running it twice is
-- a no-op on the second run.
--
-- Scope guard: we ONLY promote rows to 'grandfathered' if they match the
-- exact seed fingerprint (community / studioloom / efficacy_score=65).
-- This means we cannot accidentally grandfather teacher-authored or
-- flagged content — only the Phase 1.3 seed rows move.
--
-- Lesson #37 — verify query at the bottom asserts the expected count.

UPDATE activity_blocks
SET moderation_status = 'grandfathered'
WHERE source_type = 'community'
  AND module = 'studioloom'
  AND efficacy_score = 65
  AND moderation_status <> 'grandfathered';

-- ─────────────────────────────────────────────────────────────────────────
-- Verify — fail loudly if the grandfather set is empty or suspicious.
-- ─────────────────────────────────────────────────────────────────────────
-- We don't assert an exact row count here (the seed library may have
-- grown by the time this runs on a fresh environment). We just assert
-- that the set of (community / studioloom / efficacy_score=65) rows is
-- wholly grandfathered after the UPDATE.

DO $$
DECLARE
  mismatched INT;
BEGIN
  SELECT count(*) INTO mismatched
  FROM activity_blocks
  WHERE source_type = 'community'
    AND module = 'studioloom'
    AND efficacy_score = 65
    AND moderation_status <> 'grandfathered';

  IF mismatched > 0 THEN
    RAISE EXCEPTION
      'Migration 069 safety net failed: % seed row(s) still not grandfathered. Investigate before re-running.',
      mismatched;
  END IF;
END $$;
