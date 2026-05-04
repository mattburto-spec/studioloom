-- Migration: phase_4_5_school_merge_requests
-- Created: 20260502210353 UTC
-- Phase: Access Model v2 Phase 4.5 (school_merge_requests + 90-day redirect)
--
-- WHY: Phase 4.4 governance specs that duplicate schools (created in
--   error / via parallel teacher onboarding / via typo) need a deterministic
--   merge path. The owner-of-record is platform admin (Matt), not flat
--   school membership — merging is data-corrective, not a school-side
--   governance action. After approval, all FK references cascade to the
--   surviving school_id; the from-school stays in the DB with `status =
--   'merged_into'` + `merged_into_id` set as a 90-day redirect tombstone
--   so any stale URLs / links / cached references resolve to the right
--   school.
--
-- IMPACT:
--   - 1 ENUM (`school_merge_status`)
--   - 1 NEW table `school_merge_requests`
--   - schools.merged_into_id column (nullable FK to schools)
--   - 3 indexes on the new table (lookup + uniqueness gate on pending)
--   - 1 partial index on schools.merged_into_id (sparse — most rows NULL)
--   - 2 RLS policies on the new table
--
-- CASCADE WORK (handled by `src/lib/access-v2/governance/school-merge.ts`,
--   not in this migration): `school_id` updates across 12 tables on
--   approve. Per §3.9 item 15 — one `audit_events` row per table touched.
--
-- ROLLBACK: paired .down.sql drops the column, table, indexes, and ENUM.
--   The cascade is not reversible from SQL alone (would need the helper's
--   reverse mode); rollback is intended for fresh-prod / pre-data scenarios.
--
-- 90-DAY REDIRECT: deliberate "leave the row intact" pattern — no
--   auto-delete cron. Manual cleanup post-90d via super-admin tool. The
--   `resolveSchoolId()` helper in school-merge.ts follows the chain on
--   read; routes call it explicitly (NOT middleware-injected, to avoid
--   cache-poisoning surprises).

-- ============================================================
-- 1. ENUM type
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'school_merge_status') THEN
    CREATE TYPE school_merge_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
  END IF;
END $$;

-- ============================================================
-- 2. school_merge_requests table
-- ============================================================
-- Lifecycle: pending → approved → completed (cascade ran)
--                  → rejected (terminal)
-- `approved` is a brief state between the platform admin clicking
-- approve and the cascade helper finishing. If the cascade fails
-- mid-flight, the row stays at 'approved' and the helper logs the
-- failure to audit_events; manual intervention or retry is needed.

CREATE TABLE IF NOT EXISTS school_merge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  into_school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  status school_merge_status NOT NULL DEFAULT 'pending',
  approved_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  rejected_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Coherence: a school cannot merge into itself
  CHECK (from_school_id != into_school_id),
  -- Coherence: status timestamps match status value
  CHECK (
    (status = 'pending'   AND approved_at IS NULL AND completed_at IS NULL AND rejected_at IS NULL) OR
    (status = 'approved'  AND approved_at IS NOT NULL AND completed_at IS NULL AND rejected_at IS NULL) OR
    (status = 'completed' AND approved_at IS NOT NULL AND completed_at IS NOT NULL AND rejected_at IS NULL) OR
    (status = 'rejected'  AND rejected_at IS NOT NULL AND completed_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_smr_from_status
  ON school_merge_requests(from_school_id, status);
CREATE INDEX IF NOT EXISTS idx_smr_into_status
  ON school_merge_requests(into_school_id, status);

-- Uniqueness: only one pending request per (from, into) pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_smr_unique_pending
  ON school_merge_requests(from_school_id, into_school_id)
  WHERE status = 'pending';

-- ============================================================
-- 3. schools.merged_into_id column + index
-- ============================================================
-- ON DELETE SET NULL chosen so deleting the surviving school doesn't
-- cascade-delete the merged-in tombstone (the tombstone row's data
-- has already been cascade-rewritten; its merged_into_id pointer just
-- becomes stale).

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schools_merged_into
  ON schools(merged_into_id)
  WHERE merged_into_id IS NOT NULL;

-- Add 'merged_into' to schools.status if not already present.
-- Phase 0.1 mig 20260428125547 added the status column with CHECK enum;
-- 'merged_into' is one of the original 4 values so this is a no-op,
-- but the assertion below catches drift.

-- ============================================================
-- 4. RLS — Phase 4.5 policies
-- ============================================================
-- Read access: same-school teachers (either side of the proposed merge)
--   can see the request; this lets the from-school surface a "merge
--   pending" banner and the into-school confirm what's being absorbed.
-- Write access: only platform admin (mutate via service role from the
--   approve route). Same-school teacher proposing a merge goes through
--   the helper which uses service role for the INSERT — no RLS INSERT
--   policy needed for non-admin (keeps surface minimal).
--
-- current_teacher_school_id() is the SECURITY DEFINER helper from
-- mig 20260427134953 — returns auth.uid()'s school_id without
-- re-entering RLS (Lesson #64 sibling).

ALTER TABLE school_merge_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smr_school_teacher_read"
  ON school_merge_requests FOR SELECT
  TO authenticated
  USING (
    current_teacher_school_id() IN (from_school_id, into_school_id)
  );

CREATE POLICY "smr_platform_admin_all"
  ON school_merge_requests FOR ALL
  TO authenticated
  USING (
    (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  )
  WITH CHECK (
    (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );

COMMENT ON TABLE school_merge_requests IS
  'Phase 4.5 — platform-admin-mediated school merges. RLS: same-school '
  'teachers (either side) can read; only platform admin mutates. Lifecycle '
  'pending → approved → completed (cascade ran) OR rejected. The cascade '
  'helper at src/lib/access-v2/governance/school-merge.ts updates school_id '
  'across 12 FK tables on approve, logs one audit_events row per table.';

COMMENT ON COLUMN schools.merged_into_id IS
  'Phase 4.5 — set when this school was merged into another. Combined with '
  'schools.status=''merged_into''. resolveSchoolId() in school-merge.ts '
  'follows this chain on read so stale FK-by-school-id references resolve '
  'to the surviving school. 90-day redirect window is by convention; no '
  'auto-cleanup cron — manual via super-admin.';

-- ============================================================
-- 5. Sanity check
-- ============================================================

DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_column_exists BOOLEAN;
  v_enum_exists BOOLEAN;
  v_helper_exists BOOLEAN;
  v_status_has_merged_into BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'school_merge_requests'
  ) INTO v_table_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schools'
      AND column_name = 'merged_into_id'
  ) INTO v_column_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'school_merge_status'
  ) INTO v_enum_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'current_teacher_school_id'
  ) INTO v_helper_exists;

  -- Verify schools.status CHECK enum still includes 'merged_into'
  -- (Phase 0.1 mig 20260428125547 added it; if a future migration
  -- narrowed the CHECK, the cascade flip in school-merge.ts will fail).
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class rel ON con.conrelid = rel.oid
    WHERE rel.relname = 'schools'
      AND con.conname LIKE 'schools_status%'
      AND pg_get_constraintdef(con.oid) LIKE '%merged_into%'
  ) INTO v_status_has_merged_into;

  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: school_merge_requests missing';
  END IF;
  IF NOT v_column_exists THEN
    RAISE EXCEPTION 'Migration failed: schools.merged_into_id missing';
  END IF;
  IF NOT v_enum_exists THEN
    RAISE EXCEPTION 'Migration failed: school_merge_status enum missing';
  END IF;
  IF NOT v_helper_exists THEN
    RAISE EXCEPTION 'Sanity failed: current_teacher_school_id() helper missing — '
                    'expected from mig 20260427134953';
  END IF;
  IF NOT v_status_has_merged_into THEN
    RAISE EXCEPTION 'Sanity failed: schools.status CHECK does not include merged_into — '
                    'cascade flip in school-merge.ts will fail. Re-check mig 20260428125547.';
  END IF;

  RAISE NOTICE 'Migration phase_4_5_school_merge_requests applied OK: '
               '1 enum + 1 table + 1 column + 4 indexes + 2 RLS policies';
END $$;
