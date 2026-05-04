-- Migration: phase_5_4_scheduled_deletions
-- Created: 20260503143034 UTC
-- Phase: Access Model v2 Phase 5.4 (data-subject endpoints — soft-delete queue)
--
-- WHY: Q5 resolution (3 May 2026 PM). Phase 5.4's DELETE endpoint
--   (and Phase 5.5's retention cron) need a place to record "this row
--   was soft-deleted on date X; hard-delete it after Y." Pure
--   query-based deletion (DELETE WHERE deleted_at < now() - 30d)
--   would work for v1 but blocks the legal-hold path: when a
--   GDPR/PIPL legal-hold request lands, we need a per-row "skip
--   this deletion" flag.
--
--   `scheduled_deletions.status='held'` is that flag. Cron skips
--   held rows. Pure-query approach would require schema change at
--   the moment a hold lands — not great. Tiny upfront cost (one
--   table, ~7 cols) prevents that future migration.
--
-- Two consumers from day one:
--   (a) Phase 5.4 DELETE /api/v1/student/[id] writes a pending row.
--   (b) Phase 5.5 retention cron writes pending rows for expired data.
--   (c) Phase 5.5 hard-delete cron reads pending rows where
--       scheduled_for < now() AND status != 'held', deletes the
--       target row (cascades via FK), updates status='completed'.
--
-- IMPACT: 1 new table. RLS Phase-0 baseline: SELECT for platform_admin
--   + same-school teachers (visibility into pending deletions of their
--   school's students). INSERT/UPDATE service-role only (Phase 5.4
--   endpoint + Phase 5.5 cron use service role).
-- ROLLBACK: paired .down.sql DROPs the table.

-- ============================================================
-- 1. scheduled_deletions table
-- ============================================================

CREATE TABLE scheduled_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- target_type CHECK enumerates the 3 row types Phase 5 hard-deletes.
  -- Extend when a future cron adds a new target (e.g. 'unit', 'class').
  target_type TEXT NOT NULL
    CHECK (target_type IN ('student', 'teacher', 'unit')),
  target_id UUID NOT NULL,
  -- When the hard-delete should run (typically deleted_at + 30 days).
  -- Cron query is WHERE scheduled_for < now() AND status = 'pending'.
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'held')),
  -- For audit-event correlation when the hard-delete fires.
  scheduled_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  -- For legal-hold UX (future): when an admin sets status='held',
  -- record why so future-them knows what's blocking.
  hold_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  -- Coherence: completed_at populated iff status='completed'
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed' AND completed_at IS NULL)
  )
);

-- One pending deletion per target. If a target is soft-deleted twice
-- (e.g., undo + re-delete), the cron should pick up the latest scheduling.
-- Partial unique index on (target_type, target_id) WHERE status='pending'
-- ensures we don't queue duplicate hard-deletes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_deletions_unique_pending
  ON scheduled_deletions(target_type, target_id)
  WHERE status = 'pending';

-- Cron-friendly index: "give me all pending rows whose scheduled_for has passed."
-- Plain b-tree on scheduled_for — partial index would need an IMMUTABLE
-- predicate (Lesson #61) and now() is STABLE not IMMUTABLE.
CREATE INDEX IF NOT EXISTS idx_scheduled_deletions_due
  ON scheduled_deletions(scheduled_for, status)
  WHERE status = 'pending';

-- Status-faceted index for admin dashboards ("show me held deletions").
CREATE INDEX IF NOT EXISTS idx_scheduled_deletions_status_created
  ON scheduled_deletions(status, created_at DESC);

-- ============================================================
-- 2. RLS — Phase 5.4 baseline
-- ============================================================
-- SELECT:
--   - Platform admin (any row).
--   - Teachers in same school as the target (so they can see what's
--     scheduled to be deleted from their school). Resolution depends
--     on target_type — for 'student', join via students.school_id;
--     for 'teacher', via teachers.school_id; for 'unit', via units.school_id.
-- INSERT/UPDATE/DELETE: deny-by-default. Phase 5.4 + Phase 5.5 use
--   service role to write.

ALTER TABLE scheduled_deletions ENABLE ROW LEVEL SECURITY;

-- Platform admin can read all
CREATE POLICY "scheduled_deletions_platform_admin_read"
  ON scheduled_deletions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_platform_admin = TRUE
    )
  );

-- Teachers see scheduled deletions of targets in their school
CREATE POLICY "scheduled_deletions_school_teacher_read"
  ON scheduled_deletions FOR SELECT
  USING (
    CASE target_type
      WHEN 'student' THEN
        target_id IN (
          SELECT s.id FROM students s
          JOIN teachers t ON t.school_id = s.school_id
          WHERE t.id = auth.uid()
            AND t.school_id IS NOT NULL
            AND s.school_id IS NOT NULL
        )
      WHEN 'teacher' THEN
        target_id IN (
          SELECT t2.id FROM teachers t2
          JOIN teachers t ON t.school_id = t2.school_id
          WHERE t.id = auth.uid()
            AND t.school_id IS NOT NULL
            AND t2.school_id IS NOT NULL
        )
      WHEN 'unit' THEN
        target_id IN (
          SELECT u.id FROM units u
          JOIN teachers t ON t.school_id = u.school_id
          WHERE t.id = auth.uid()
            AND t.school_id IS NOT NULL
            AND u.school_id IS NOT NULL
        )
      ELSE false
    END
  );

COMMENT ON TABLE scheduled_deletions IS
  'Phase 5.4 — soft-delete + 30-day hard-delete queue. '
  'Two writers: /api/v1/student/[id] DELETE endpoint (Phase 5.4) + '
  'retention cron (Phase 5.5). One reader: scheduled_hard_delete cron '
  '(Phase 5.5) processes WHERE status=pending AND scheduled_for < now() '
  'AND status != held. Legal-hold path: UPDATE status=held + hold_reason.';

-- ============================================================
-- 3. Sanity DO-block (Lesson #38: assert specific values)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scheduled_deletions'
  ) THEN
    RAISE EXCEPTION 'Migration failed: scheduled_deletions table missing';
  END IF;

  -- target_type CHECK has the 3 expected values
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = cc.constraint_name
    WHERE ccu.table_name = 'scheduled_deletions'
      AND ccu.column_name = 'target_type'
      AND cc.check_clause LIKE '%student%'
      AND cc.check_clause LIKE '%teacher%'
      AND cc.check_clause LIKE '%unit%'
  ) THEN
    RAISE EXCEPTION
      'Migration failed: scheduled_deletions.target_type CHECK missing one of (student, teacher, unit)';
  END IF;

  -- status CHECK has the 3 expected values
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.check_constraints cc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = cc.constraint_name
    WHERE ccu.table_name = 'scheduled_deletions'
      AND ccu.column_name = 'status'
      AND cc.check_clause LIKE '%pending%'
      AND cc.check_clause LIKE '%completed%'
      AND cc.check_clause LIKE '%held%'
  ) THEN
    RAISE EXCEPTION
      'Migration failed: scheduled_deletions.status CHECK missing one of (pending, completed, held)';
  END IF;

  -- RLS enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'scheduled_deletions'
      AND rowsecurity = TRUE
  ) THEN
    RAISE EXCEPTION 'Migration failed: scheduled_deletions RLS not enabled';
  END IF;

  -- 2 SELECT policies present
  IF (
    SELECT COUNT(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scheduled_deletions'
      AND cmd = 'SELECT'
  ) < 2 THEN
    RAISE EXCEPTION
      'Migration failed: scheduled_deletions missing platform_admin or school_teacher SELECT policies';
  END IF;

  -- INSERT/UPDATE/DELETE policies are intentionally absent (service-role only)
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scheduled_deletions'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION
      'Migration failed: scheduled_deletions has unexpected INSERT/UPDATE/DELETE policy (must be service-role only)';
  END IF;

  -- Unique partial index on (target_type, target_id) WHERE pending
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'scheduled_deletions'
      AND indexname = 'idx_scheduled_deletions_unique_pending'
  ) THEN
    RAISE EXCEPTION
      'Migration failed: scheduled_deletions missing unique-pending partial index';
  END IF;

  RAISE NOTICE
    'Migration phase_5_4_scheduled_deletions applied OK: 1 table + 3 indexes + RLS with 2 SELECT policies';
END $$;
