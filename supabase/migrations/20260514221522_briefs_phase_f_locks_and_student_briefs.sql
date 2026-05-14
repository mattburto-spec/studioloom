-- Migration: briefs_phase_f_locks_and_student_briefs
-- Created: 20260514221522 UTC
-- Phase: Unit Briefs Foundation Phase F.A — locks model + student
--        authoring + choice-card brief templates (G8 case)
--
-- WHY: Phase A-E shipped teacher-only briefs. Three patterns we now
--   need to support, all with one unified student-side renderer:
--   1. Class-shared (existing v1) — teacher writes unit_brief, all
--      students work to it. UNCHANGED by this migration except for
--      the new `locks` column.
--   2. Choice-driven (G8 case) — teacher creates choice cards each
--      with its own brief template + locks. Student picks a card,
--      gets that template populated + must-have fields locked.
--   3. Per-student (pitch-your-own + future Discovery Engine) —
--      student authors from scratch (no template).
--
--   The locks model is the unifier: each field has a lock state,
--   locked fields show teacher value read-only, unlocked fields are
--   student-editable (with teacher value as a starter when present).
--
-- IMPACT:
--   1. unit_briefs.locks JSONB — flat path-keyed map for the
--      class-shared brief. Format: { "brief_text": true,
--      "constraints.budget": true, "constraints.materials_whitelist":
--      false, ... }. Default `{}` = nothing locked (Matt's call —
--      unlocked default invites student authorship; teacher locks
--      what's non-negotiable).
--   2. choice_cards.brief_text + .brief_constraints + .brief_locks —
--      same three-field shape as a brief. NULL brief_text + empty
--      objects = card has no brief template (falls through to
--      unit_briefs at render time). Cards CAN have a brief template
--      AND coexist with on_pick_action — they're independent
--      extension points (action fires at pick; brief data is render-
--      time read).
--   3. New table public.student_briefs — per-student-per-unit
--      overrides for unlocked fields. Mirrors v2
--      student_unit_product_briefs shape (UNIQUE(student_id,
--      unit_id) + RLS + service-role writes via token session).
--      Stores brief_text + constraints JSONB + diagram_url (column
--      reserved for future; no Phase F upload UI).
--
-- IDEMPOTENCE: All operations use IF NOT EXISTS — safe to re-run.
-- No DEFAULT clauses with conditional UPDATEs (Lesson #38 — would
-- silently backfill existing rows).
--
-- DEPENDENCIES:
--   - unit_briefs (existing, Phase A)
--   - choice_cards (existing, applied 2026-05-12)
--   - students, units, class_students, class_units (existing — RLS chain)
--   - user_profiles (existing — platform-admin escape hatch)
--   - set_updated_at() function (shared trigger)
--
-- ROLLBACK: paired .down.sql drops the column / table additions.
--   Safety guards refuse rollback if there's student work present.

-- ─── 1. unit_briefs.locks ────────────────────────────────────────────

ALTER TABLE public.unit_briefs
  ADD COLUMN IF NOT EXISTS locks JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.unit_briefs.locks IS
  'Flat path-keyed lock map for the class-shared brief. '
  'Keys: "brief_text", "diagram_url", "constraints.dimensions", '
  '"constraints.materials_whitelist", "constraints.budget", '
  '"constraints.audience", "constraints.must_include", '
  '"constraints.must_avoid". Value true = locked (teacher value '
  'read-only); absent or false = unlocked (student-editable). '
  'Default {} = nothing locked. Phase F.A.';

-- ─── 2. choice_cards brief template columns ──────────────────────────

ALTER TABLE public.choice_cards
  ADD COLUMN IF NOT EXISTS brief_text TEXT,
  ADD COLUMN IF NOT EXISTS brief_constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS brief_locks JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.choice_cards.brief_text IS
  'Optional brief-template prose for choice-driven units. NULL = no '
  'template (drawer falls through to unit_briefs.brief_text). When set, '
  'student who picks this card sees this prose as the locked / starter '
  'brief depending on brief_locks. Phase F.A.';

COMMENT ON COLUMN public.choice_cards.brief_constraints IS
  'Optional structured constraints template (same shape as '
  'unit_briefs.constraints — archetype-discriminated). Empty {} = '
  'no template. Phase F.A.';

COMMENT ON COLUMN public.choice_cards.brief_locks IS
  'Optional lock map (same shape as unit_briefs.locks). Lets a card '
  'mark fields like "constraints.budget" as locked while leaving '
  '"constraints.audience" student-editable. Empty {} = no overrides '
  '(no locks applied by the card). Phase F.A.';

-- ─── 3. student_briefs table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id    UUID NOT NULL REFERENCES units(id)    ON DELETE CASCADE,

  -- Student's overrides for unlocked fields. NULL = student hasn't
  -- overridden this field; renderer falls through to template
  -- (choice card or unit_brief) as a starter.
  brief_text  TEXT,
  constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
  diagram_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(student_id, unit_id)
);

COMMENT ON TABLE public.student_briefs IS
  'Phase F.A. Per-student-per-unit overrides for unlocked brief fields. '
  'Layered on top of: (1) choice-card brief template if student has '
  'picked one for the unit AND the card has a brief template; (2) '
  'unit_briefs row as fallback. Read at render time by both the student '
  'drawer (BriefDrawer) and the teacher Student-briefs review tab.';

COMMENT ON COLUMN public.student_briefs.brief_text IS
  'NULL = student has not overridden brief_text (drawer shows teacher/'
  'card template value). String = student override.';

CREATE INDEX IF NOT EXISTS idx_student_briefs_student_unit
  ON public.student_briefs (student_id, unit_id);

-- Teacher review index — fetches all students' brief overrides for
-- a given unit (drives the new "Student briefs" tab).
CREATE INDEX IF NOT EXISTS idx_student_briefs_unit
  ON public.student_briefs (unit_id);

-- RLS — teacher SELECT only via class-enrollment chain + admin escape
-- hatch. All writes via service-role API (Lesson #4 — students don't
-- use Supabase Auth). Mirrors the v2 student_unit_product_briefs +
-- Phase A unit_briefs pattern.
ALTER TABLE public.student_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_briefs_teacher_read"
  ON public.student_briefs FOR SELECT
  TO authenticated
  USING (
    -- Teacher manages a class that has this unit AND the student is
    -- enrolled in that class.
    EXISTS (
      SELECT 1
      FROM class_students cs
      JOIN classes c    ON c.id  = cs.class_id
      JOIN class_units cu ON cu.class_id = cs.class_id
      WHERE cs.student_id = student_briefs.student_id
        AND cu.unit_id    = student_briefs.unit_id
        AND cs.is_active  = true
        AND cu.is_active  = true
        AND c.teacher_id  = auth.uid()
    )
    -- Platform admin escape hatch
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );

-- updated_at trigger — function is idempotent across migrations
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_student_briefs_updated_at
  BEFORE UPDATE ON public.student_briefs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Sanity check (Lesson #38 — assert expected shape) ──────────────

DO $$
DECLARE
  v_locks_col_exists       BOOLEAN;
  v_cc_brief_text_exists   BOOLEAN;
  v_cc_brief_constr_exists BOOLEAN;
  v_cc_brief_locks_exists  BOOLEAN;
  v_table_exists           BOOLEAN;
  v_rls_enabled            BOOLEAN;
  v_policy_count           INT;
  v_trigger_count          INT;
  v_index_count            INT;
BEGIN
  -- 1. unit_briefs.locks
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'unit_briefs'
      AND column_name = 'locks'
  ) INTO v_locks_col_exists;
  IF NOT v_locks_col_exists THEN
    RAISE EXCEPTION 'Migration failed: unit_briefs.locks column not created';
  END IF;

  -- 2. choice_cards.brief_text, brief_constraints, brief_locks
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'choice_cards'
      AND column_name = 'brief_text'
  ) INTO v_cc_brief_text_exists;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'choice_cards'
      AND column_name = 'brief_constraints'
  ) INTO v_cc_brief_constr_exists;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'choice_cards'
      AND column_name = 'brief_locks'
  ) INTO v_cc_brief_locks_exists;
  IF NOT (v_cc_brief_text_exists AND v_cc_brief_constr_exists AND v_cc_brief_locks_exists) THEN
    RAISE EXCEPTION 'Migration failed: choice_cards brief columns missing (text=%, constraints=%, locks=%)',
                    v_cc_brief_text_exists, v_cc_brief_constr_exists, v_cc_brief_locks_exists;
  END IF;

  -- 3. student_briefs table
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'student_briefs'
  ) INTO v_table_exists;
  IF NOT v_table_exists THEN
    RAISE EXCEPTION 'Migration failed: student_briefs table not created';
  END IF;

  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'student_briefs' AND relnamespace = 'public'::regnamespace;
  IF v_rls_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'Migration failed: RLS not enabled on student_briefs (got %)', v_rls_enabled;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'student_briefs';
  IF v_policy_count <> 1 THEN
    RAISE EXCEPTION 'Migration failed: expected exactly 1 RLS policy on student_briefs, got %', v_policy_count;
  END IF;

  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'public.student_briefs'::regclass AND NOT tgisinternal;
  IF v_trigger_count <> 1 THEN
    RAISE EXCEPTION 'Migration failed: expected exactly 1 trigger on student_briefs, got %', v_trigger_count;
  END IF;

  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'student_briefs'
    AND indexname LIKE 'idx_student_briefs_%';
  IF v_index_count <> 2 THEN
    RAISE EXCEPTION 'Migration failed: expected 2 student_briefs indexes, got %', v_index_count;
  END IF;

  RAISE NOTICE 'Phase F.A applied OK: unit_briefs.locks + 3 choice_cards columns + student_briefs table (1 policy, 1 trigger, 2 indexes, RLS enabled)';
END $$;
