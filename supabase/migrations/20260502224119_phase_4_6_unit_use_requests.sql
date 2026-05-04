-- Migration: phase_4_6_unit_use_requests
-- Created: 20260502224119 UTC
-- Phase: Access Model v2 Phase 4.6 (school library + request-to-use)
--
-- WHY: Per Decision 8 amendment + brief §4.6 §3.8 Q12: the
--   curriculum-library moat. School-tier members can browse units
--   colleagues have published WITHIN the school. To USE another
--   teacher's unit they must request → author approves/denies →
--   on approve, the requester gets a fork with attribution preserved.
--
--   Khan/MagicSchool sidestep this with one-author models. StudioLoom's
--   value-add for multi-author schools is making colleague-to-colleague
--   sharing explicit + author-controlled.
--
--   IMPLICIT TIER-AWARENESS (audit finding 3 May 2026): no new RLS gate
--   on units library reads. The existing school_id filter naturally
--   returns the right set per tier:
--     - free/pro tier: teacher alone in personal school → sees own
--       units only (library = my own published units)
--     - school tier: teacher among colleagues → sees all published
--       units in the school
--   No tier-gate RLS policy needed; the membership model does the work.
--
-- IMPACT:
--   - 1 NEW table: unit_use_requests
--   - units table: 1 new column
--       forked_from_author_id  UUID REFERENCES teachers(id) ON DELETE SET NULL
--     Set when a fork happens via approve-flow; preserves author attribution.
--     The brief §4.6 specced an additional `forked_from_unit_id` column,
--     but mig 007 already added `units.forked_from` UUID REFERENCES
--     units(id) — same semantic. Pre-flight audit (Lesson #54 + #59 in
--     action: brief-vs-schema audit) caught the duplication; this
--     migration uses the existing column and only adds the missing
--     author attribution.
--   - 4 indexes (lookup by unit, by author, by requester, partial unique
--     active per (unit, requester) tuple)
--   - 4 RLS policies on unit_use_requests
--
-- ROLLBACK: paired .down.sql drops the table + columns. Refuses if any
--   active (pending) requests exist or if any units have non-NULL
--   forked_from_*.

-- ============================================================
-- 1. unit_use_requests table
-- ============================================================
-- Lifecycle: pending → approved (terminal happy; fork created) OR
--                    → denied (terminal sad)
--                    → withdrawn (terminal — requester cancelled)
--
-- Uniqueness: only ONE pending request per (unit_id, requester_user_id).
-- After terminal state, requester can ask again. Partial unique index.

CREATE TABLE IF NOT EXISTS unit_use_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  -- The teacher who wants to use someone else's unit
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Denormalised for fast filtering and tamper-resistance:
  -- captured at request time. If a unit's author_teacher_id later
  -- changes (e.g. transfer), historical requests retain the original
  -- author's identity for forensic purposes.
  author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Same school for both sides — library is school-scoped. Captured
  -- at request time as a defensive snapshot.
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  -- Why the requester wants the unit. 1-2k chars typical.
  intent_message TEXT CHECK (intent_message IS NULL OR length(trim(intent_message)) > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'withdrawn')),
  -- Optional author response when denying (e.g. "still drafting; ask
  -- again in 2 weeks") or approving with caveats.
  author_response TEXT NULL,
  -- Set when status flips out of pending; matches the actor of the flip.
  decided_at TIMESTAMPTZ NULL,
  decided_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  -- When status='approved', this points at the resulting forked unit
  -- (set by the approve route AFTER the fork is created — leaves a
  -- brief window where status='approved' but forked_unit_id IS NULL).
  forked_unit_id UUID NULL REFERENCES units(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Coherence: a teacher can't request their own unit
  CHECK (requester_user_id != author_user_id),
  -- Coherence: status timestamps match status value
  CHECK (
    (status = 'pending' AND decided_at IS NULL AND decided_by_user_id IS NULL AND forked_unit_id IS NULL)
    OR (status = 'denied' AND decided_at IS NOT NULL AND decided_by_user_id IS NOT NULL AND forked_unit_id IS NULL)
    OR (status = 'withdrawn' AND decided_at IS NOT NULL AND decided_by_user_id IS NOT NULL AND forked_unit_id IS NULL)
    OR (status = 'approved' AND decided_at IS NOT NULL AND decided_by_user_id IS NOT NULL)
    -- Approved allows forked_unit_id either NULL (mid-flight) or set (after fork)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_uur_unit_status
  ON unit_use_requests(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_uur_author_pending
  ON unit_use_requests(author_user_id, created_at DESC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_uur_requester_created
  ON unit_use_requests(requester_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_uur_unique_pending
  ON unit_use_requests(unit_id, requester_user_id)
  WHERE status = 'pending';

-- ============================================================
-- 2. units.forked_from_author_id — author attribution column
-- ============================================================
-- Mig 007 already added `units.forked_from UUID REFERENCES units(id)`.
-- Phase 4.6 reuses that column for the unit-pointer side of attribution
-- and only ADDS the author-id side. Library can show "originally by X"
-- via this column; survives source-unit deletion (forked_from goes
-- NULL via existing FK, but forked_from_author_id remains).

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS forked_from_author_id UUID
    REFERENCES teachers(id) ON DELETE SET NULL;

COMMENT ON COLUMN units.forked_from_author_id IS
  'Phase 4.6 — denormalised author of the source unit at fork time. '
  'Pairs with the existing units.forked_from (mig 007) which points '
  'at the source unit itself. Survives source-unit deletion.';

-- ============================================================
-- 3. RLS policies on unit_use_requests
-- ============================================================
-- Read access:
--   - Requester reads their own requests
--   - Author reads requests for their units
--   - school_admin / platform_admin reads all requests for their school
-- Write access (INSERT):
--   - Authenticated user can request use of a unit IF they're in the
--     same school AND they're not the author themselves
--   - Service-role inserts allowed (for tests / admin tools)
-- Write access (UPDATE):
--   - Author can update status to approved/denied
--   - Requester can update status to withdrawn
--   - Service role for the approve-flow's fork-completion step
--
-- The author_user_id and school_id fields are CAPTURED at INSERT time
-- by the route — RLS doesn't validate they match the unit's actual
-- author/school (that's the route's job). RLS just gates who can read
-- and who can transition status.

ALTER TABLE unit_use_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uur_requester_self_read"
  ON unit_use_requests FOR SELECT
  TO authenticated
  USING (requester_user_id = auth.uid());

CREATE POLICY "uur_author_self_read"
  ON unit_use_requests FOR SELECT
  TO authenticated
  USING (author_user_id = auth.uid());

CREATE POLICY "uur_admin_read"
  ON unit_use_requests FOR SELECT
  TO authenticated
  USING (
    (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR public.is_school_admin(auth.uid(), school_id)
  );

-- INSERT: requester must be self; cross-school + same-author guards
-- enforced at the route layer (RLS doesn't have a clean way to express
-- "school_id matches unit's school" without recursing). The CHECK
-- constraint blocks self-author requests.
CREATE POLICY "uur_requester_insert"
  ON unit_use_requests FOR INSERT
  TO authenticated
  WITH CHECK (requester_user_id = auth.uid());

-- UPDATE: author can decide, requester can withdraw. Service role
-- bypasses RLS for the approve-flow's forked_unit_id backfill.
CREATE POLICY "uur_author_or_requester_update"
  ON unit_use_requests FOR UPDATE
  TO authenticated
  USING (
    author_user_id = auth.uid() OR requester_user_id = auth.uid()
  )
  WITH CHECK (
    author_user_id = auth.uid() OR requester_user_id = auth.uid()
  );

COMMENT ON TABLE unit_use_requests IS
  'Phase 4.6 — colleague-to-colleague unit-share request flow. '
  'Requester (teacher A) asks author (teacher B) for permission to '
  'use unit X. On approval, A gets a fork with attribution '
  '(units.forked_from_*). RLS: requester / author / admin read; '
  'self-INSERT (cross-school guard at route); author or requester '
  'UPDATE (status transitions).';

-- ============================================================
-- 4. Sanity check
-- ============================================================

DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_forked_unit_col BOOLEAN;
  v_forked_author_col BOOLEAN;
  v_unique_pending BOOLEAN;
  v_policy_count INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'unit_use_requests'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: unit_use_requests missing';
  END IF;

  -- Verify the existing units.forked_from is still there (mig 007)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'units'
      AND column_name = 'forked_from'
  ) INTO v_forked_unit_col;
  IF NOT v_forked_unit_col THEN
    RAISE EXCEPTION 'Sanity failed: units.forked_from column missing — '
                    'expected from mig 007. Cannot proceed.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'units'
      AND column_name = 'forked_from_author_id'
  ) INTO v_forked_author_col;
  IF NOT v_forked_author_col THEN
    RAISE EXCEPTION 'Migration failed: units.forked_from_author_id missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'unit_use_requests'
      AND indexname = 'idx_uur_unique_pending'
  ) INTO v_unique_pending;
  IF NOT v_unique_pending THEN
    RAISE EXCEPTION 'Migration failed: unique-pending partial index missing';
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'unit_use_requests';
  IF v_policy_count != 5 THEN
    RAISE EXCEPTION 'Migration failed: expected 5 RLS policies, got %',
                    v_policy_count;
  END IF;

  RAISE NOTICE 'Migration phase_4_6_unit_use_requests applied OK: '
               '1 table, 2 columns, 4 indexes, 5 RLS policies';
END $$;
