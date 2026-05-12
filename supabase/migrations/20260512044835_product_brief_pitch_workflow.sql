-- Migration: product_brief_pitch_workflow
-- Created: 20260512044835 UTC
-- Phase: Pitch-to-teacher MVP workflow (FU-PLATFORM-CUSTOM-PROJECT-PITCH).
--
-- WHY: Students whose ideas don't fit any preset archetype currently
--   pick "Other / Pitch your own" and dump into the Product Brief
--   slot walker with no formal teacher checkpoint. For class today,
--   Matt needs a real pitch workflow:
--     1. Student writes a pitch (free-form proposal)
--     2. Submits → status = pending
--     3. Teacher reviews → approve / request revision / reject
--     4. Student can only proceed to the Product Brief slot walker
--        AFTER pitch_status = 'approved'
--   Skips the deeper FU goal of auto-generating a mini-archetype from
--   the approved pitch (deferred to Phase 2 of the FU when AI budget
--   + build time allow).
--
-- IMPACT:
--   5 NEW columns on student_unit_product_briefs:
--     pitch_text TEXT — the student's free-form proposal
--     pitch_status TEXT — 'pending' | 'approved' | 'revise' | 'rejected'
--     pitch_teacher_note TEXT — optional feedback from teacher
--     pitch_decided_at TIMESTAMPTZ — when teacher decided
--     pitch_decided_by UUID REFERENCES auth.users(id) — which teacher
--   1 NEW index on pitch_status (partial, WHERE status IS NOT NULL +
--     status != 'approved' — drives the teacher's pending-pitches list)
--   1 CHECK constraint on pitch_status enum values
--
-- DEPENDENCIES: student_unit_product_briefs (existing).
--
-- ROLLBACK: paired .down.sql drops the columns. Safety guard refuses
--   if any row has pitch_text set (= student work).

ALTER TABLE student_unit_product_briefs
  ADD COLUMN IF NOT EXISTS pitch_text          TEXT,
  ADD COLUMN IF NOT EXISTS pitch_status        TEXT,
  ADD COLUMN IF NOT EXISTS pitch_teacher_note  TEXT,
  ADD COLUMN IF NOT EXISTS pitch_decided_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pitch_decided_by    UUID REFERENCES auth.users(id);

-- Enum guard. NULL allowed (no pitch yet). The 4 valid states cover
-- the full state machine.
ALTER TABLE student_unit_product_briefs
  DROP CONSTRAINT IF EXISTS product_briefs_pitch_status_chk;
ALTER TABLE student_unit_product_briefs
  ADD CONSTRAINT product_briefs_pitch_status_chk
  CHECK (pitch_status IS NULL OR pitch_status IN ('pending', 'approved', 'revise', 'rejected'));

-- Index: pending + revise rows are what the teacher review queue
-- shows. Approved + rejected don't need indexing (read via student's
-- own brief lookup).
CREATE INDEX IF NOT EXISTS idx_product_briefs_pitch_status_pending
  ON student_unit_product_briefs(pitch_status)
  WHERE pitch_status IN ('pending', 'revise');

COMMENT ON COLUMN student_unit_product_briefs.pitch_text IS
  'Free-form pitch proposal from the student. Required when archetype_id = "other". Edit allowed while pitch_status = "pending" or "revise".';

COMMENT ON COLUMN student_unit_product_briefs.pitch_status IS
  'State machine: null (no pitch yet) → pending (submitted) → approved | revise | rejected. Student gated on slot walker until approved.';

-- Sanity check
DO $$
DECLARE
  v_cols INT;
  v_check_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'student_unit_product_briefs'
    AND column_name IN (
      'pitch_text', 'pitch_status', 'pitch_teacher_note',
      'pitch_decided_at', 'pitch_decided_by'
    );
  IF v_cols < 5 THEN
    RAISE EXCEPTION 'Migration failed: expected 5 pitch_* columns, got %', v_cols;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'product_briefs_pitch_status_chk'
      AND table_name = 'student_unit_product_briefs'
  ) INTO v_check_exists;
  IF NOT v_check_exists THEN
    RAISE EXCEPTION 'Migration failed: pitch_status CHECK constraint missing';
  END IF;

  RAISE NOTICE 'Migration product_brief_pitch_workflow applied OK: 5 columns + 1 CHECK + 1 partial index';
END $$;
