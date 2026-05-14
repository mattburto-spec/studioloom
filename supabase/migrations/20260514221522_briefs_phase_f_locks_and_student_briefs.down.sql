-- Rollback for: briefs_phase_f_locks_and_student_briefs
-- Pairs with: 20260514221522_briefs_phase_f_locks_and_student_briefs.sql
--
-- SAFETY GUARDS:
--   1. Refuses rollback if any student_briefs rows have student work
--      present (any non-NULL brief_text, non-empty constraints, or
--      non-NULL diagram_url). Once a student has authored, dropping
--      the table silently strips their work.
--   2. Refuses rollback if any unit_briefs rows have a non-empty
--      locks JSONB (= teacher has set field locks).
--   3. Refuses rollback if any choice_cards rows have brief template
--      data (brief_text non-NULL or brief_constraints / brief_locks
--      non-empty).
--
-- To force rollback in any of these cases:
--   DELETE FROM student_briefs;                              -- explicit data loss
--   UPDATE unit_briefs SET locks = '{}'::jsonb;              -- explicit
--   UPDATE choice_cards SET brief_text = NULL,
--                           brief_constraints = '{}'::jsonb,
--                           brief_locks = '{}'::jsonb;       -- explicit

DO $$
DECLARE
  v_student_work_count INT;
  v_locks_count        INT;
  v_card_brief_count   INT;
BEGIN
  -- student_briefs work check (table may not exist yet if rollback is
  -- being re-run, hence the EXISTS gate)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_briefs'
  ) THEN
    EXECUTE $sql$
      SELECT COUNT(*) FROM student_briefs
      WHERE brief_text IS NOT NULL
         OR diagram_url IS NOT NULL
         OR constraints <> '{}'::jsonb
    $sql$ INTO v_student_work_count;
    IF v_student_work_count > 0 THEN
      RAISE EXCEPTION
        'Refusing rollback: % student_briefs row(s) have student work present. '
        'DELETE FROM student_briefs; first if intentional.',
        v_student_work_count;
    END IF;
  END IF;

  -- unit_briefs.locks check (column may not exist after partial rollback)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'unit_briefs'
      AND column_name = 'locks'
  ) THEN
    EXECUTE $sql$
      SELECT COUNT(*) FROM unit_briefs WHERE locks <> '{}'::jsonb
    $sql$ INTO v_locks_count;
    IF v_locks_count > 0 THEN
      RAISE EXCEPTION
        'Refusing rollback: % unit_briefs row(s) have non-empty locks. '
        'UPDATE unit_briefs SET locks = ''{}''::jsonb; first if intentional.',
        v_locks_count;
    END IF;
  END IF;

  -- choice_cards brief template check
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'choice_cards'
      AND column_name = 'brief_text'
  ) THEN
    EXECUTE $sql$
      SELECT COUNT(*) FROM choice_cards
      WHERE brief_text IS NOT NULL
         OR brief_constraints <> '{}'::jsonb
         OR brief_locks <> '{}'::jsonb
    $sql$ INTO v_card_brief_count;
    IF v_card_brief_count > 0 THEN
      RAISE EXCEPTION
        'Refusing rollback: % choice_cards row(s) have brief template data. '
        'Clear brief_text/brief_constraints/brief_locks first if intentional.',
        v_card_brief_count;
    END IF;
  END IF;

  RAISE NOTICE 'Rollback safety guards passed — proceeding to drop changes.';
END $$;

-- Drop in reverse order of creation.

DROP TRIGGER IF EXISTS trigger_student_briefs_updated_at ON public.student_briefs;
DROP TABLE IF EXISTS public.student_briefs CASCADE;

ALTER TABLE public.choice_cards
  DROP COLUMN IF EXISTS brief_locks,
  DROP COLUMN IF EXISTS brief_constraints,
  DROP COLUMN IF EXISTS brief_text;

ALTER TABLE public.unit_briefs
  DROP COLUMN IF EXISTS locks;

-- Verify rollback (assert nothing remains)
DO $$
DECLARE
  v_remaining BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_briefs'
  ) INTO v_remaining;
  IF v_remaining THEN
    RAISE EXCEPTION 'Rollback failed: student_briefs table still present';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'unit_briefs'
      AND column_name = 'locks'
  ) INTO v_remaining;
  IF v_remaining THEN
    RAISE EXCEPTION 'Rollback failed: unit_briefs.locks column still present';
  END IF;

  RAISE NOTICE 'Rollback briefs_phase_f_locks_and_student_briefs complete.';
END $$;
