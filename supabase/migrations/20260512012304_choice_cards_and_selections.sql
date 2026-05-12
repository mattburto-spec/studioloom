-- Migration: choice_cards_and_selections
-- Created: 20260512012304 UTC
-- Phase: Choice Cards Block v1 Phase 1 — schema
--
-- WHY: Reusable "Choice Cards" Activity Block. Students see a Framer
--   Motion deck of flippable cards (front: image + hook; back: detail +
--   Pick button), tap to pick one. First consumer: G8 cohort's 6 project
--   briefs. Future: pathway choices, designer mentors, themes,
--   constraints, group roles. Decoupled from any specific consumer — the
--   `on_pick_action` payload is a structured event that downstream
--   subscribers (Project Spec block, themes system, mentor system) can
--   register for. Project Spec block does NOT exist yet — design must
--   not bake it in.
--
-- IMPACT:
--   2 NEW tables:
--     - choice_cards: library of reusable cards (TEXT slug primary key
--       for human-readable handles like 'g8-brief-designer-mentor').
--     - choice_card_selections: a student's pick from a block instance.
--       One row per (student_id, activity_id). UUID primary key so
--       learning_events can reference it via subject_id.
--   3 indexes (GIN on tags + lookup indexes on selections).
--   3 RLS policies (teacher SELECT on selections, library SELECT for all
--     authenticated, teacher INSERT/UPDATE on own cards). Students access
--     selections via service-role API (Lesson #4 — token sessions). No
--     student RLS — matches sibling student_unit_product_briefs pattern.
--   1 updated_at trigger on choice_cards.
--
-- DEPENDENCIES:
--   - students, units, classes, class_units (existing)
--   - user_profiles (platform-admin escape hatch)
--   - set_updated_at() shared trigger function
--   - learning_events (existing, migration 106) — Phase 8 writes events
--     with subject_type='choice_card_selection', subject_id=<this table's id>
--
-- ROLLBACK: paired .down.sql drops both tables. Safety guard refuses if
--   any choice_card_selections row exists (= student picks present).

-- ─────────────────────────────────────────────────────────────────────
-- choice_cards — library of reusable cards
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS choice_cards (
  id            TEXT PRIMARY KEY,                   -- slug, e.g. 'g8-brief-designer-mentor'
  label         TEXT NOT NULL,
  hook_text     TEXT NOT NULL,                      -- one-line front-of-card hook
  detail_md     TEXT NOT NULL,                      -- markdown shown on flip
  image_url     TEXT,                               -- proxy URL; null → emoji + bg_color fallback
  image_prompt  TEXT,                               -- for future AI gen
  emoji         TEXT,                               -- fallback front icon
  bg_color      TEXT,                               -- hex fallback background
  tags          TEXT[] NOT NULL DEFAULT '{}',       -- e.g. ['brief','g8','design-pathway']
  on_pick_action JSONB NOT NULL,                    -- structured event payload (see action shapes in dispatcher)
  ships_to_platform BOOLEAN NOT NULL DEFAULT FALSE, -- student-visible "🚀 Can ship" badge
  is_seeded     BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    UUID REFERENCES auth.users(id),     -- null for seeded cards
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE choice_cards IS
  'Library of reusable Choice Cards. TEXT slug primary key for human-readable handles. '
  'Decoupled from consumers via on_pick_action JSONB — subscribers register at runtime.';

COMMENT ON COLUMN choice_cards.on_pick_action IS
  'Discriminated union shape: { type: set-archetype|set-theme|set-mentor|set-constraint|navigate|pitch-to-teacher|emit-event, payload: {...} }. '
  'See src/lib/choice-cards/action-dispatcher.ts for the TypeScript contract.';

-- ─────────────────────────────────────────────────────────────────────
-- choice_card_selections — a student's pick from a block instance
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS choice_card_selections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_id     TEXT,                                          -- ActivitySection.activityId (nanoid8); nullable for ad-hoc picks
  unit_id         UUID REFERENCES units(id) ON DELETE CASCADE,
  class_id        UUID REFERENCES classes(id) ON DELETE SET NULL,
  card_id         TEXT NOT NULL REFERENCES choice_cards(id),     -- slug FK
  action_resolved JSONB,                                         -- snapshot of on_pick_action that fired (for audit/history)
  picked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One pick per student per block instance. NULL activity_id (ad-hoc) intentionally bypasses
  -- the uniqueness check — PostgreSQL treats NULL ≠ NULL in UNIQUE constraints.
  UNIQUE (student_id, activity_id)
);

COMMENT ON TABLE choice_card_selections IS
  'A student''s pick from a Choice Cards block instance. learning_events references this via '
  'subject_type=''choice_card_selection'' + subject_id=<id>. activity_id is the lesson '
  'ActivitySection.activityId (nanoid8 string), not a UUID.';

-- ─────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS choice_cards_tags_idx        ON choice_cards USING GIN (tags);
CREATE INDEX IF NOT EXISTS ccs_student_unit_idx         ON choice_card_selections(student_id, unit_id);
CREATE INDEX IF NOT EXISTS ccs_class_idx                ON choice_card_selections(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ccs_card_idx                 ON choice_card_selections(card_id);

-- ─────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE choice_cards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE choice_card_selections  ENABLE ROW LEVEL SECURITY;

-- choice_cards — library is readable by any authenticated user.
CREATE POLICY "choice_cards_read"
  ON choice_cards FOR SELECT
  TO authenticated
  USING (true);

-- Teachers can author new cards (created_by must be themselves).
CREATE POLICY "choice_cards_insert_own"
  ON choice_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );

-- Teachers can update their own cards; platform admin can update any.
CREATE POLICY "choice_cards_update_own"
  ON choice_cards FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );

-- choice_card_selections — teachers read selections for units they teach.
-- Students write via service-role API (Lesson #4 — token sessions) — no
-- student-side RLS policy. The class_units join also handles the NULL
-- class_id case naturally (we route through unit_id, not class_id), so
-- Lesson #29 fallback isn't needed here.
CREATE POLICY "ccs_teacher_read"
  ON choice_card_selections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM class_units cu
      JOIN classes c ON c.id = cu.class_id
      WHERE cu.unit_id = choice_card_selections.unit_id
        AND cu.is_active = true
        AND c.teacher_id = auth.uid()
    )
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
  );

-- ─────────────────────────────────────────────────────────────────────
-- updated_at trigger on choice_cards
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_choice_cards_updated_at
  BEFORE UPDATE ON choice_cards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- Sanity check
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cards_exists BOOLEAN;
  v_sel_exists   BOOLEAN;
  v_index_count  INT;
  v_policy_count INT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='choice_cards')
    INTO v_cards_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='choice_card_selections')
    INTO v_sel_exists;
  IF NOT v_cards_exists OR NOT v_sel_exists THEN
    RAISE EXCEPTION 'Migration failed: choice_cards (%) or choice_card_selections (%) not created',
      v_cards_exists, v_sel_exists;
  END IF;

  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname='public'
    AND tablename IN ('choice_cards','choice_card_selections')
    AND indexname IN ('choice_cards_tags_idx','ccs_student_unit_idx','ccs_class_idx','ccs_card_idx');
  IF v_index_count <> 4 THEN
    RAISE EXCEPTION 'Migration failed: expected 4 named indexes, got %', v_index_count;
  END IF;

  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN ('choice_cards','choice_card_selections');
  IF v_policy_count < 4 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 4 RLS policies, got %', v_policy_count;
  END IF;

  RAISE NOTICE 'Migration choice_cards_and_selections applied OK: 2 tables, % indexes, % RLS policies',
    v_index_count, v_policy_count;
END $$;
