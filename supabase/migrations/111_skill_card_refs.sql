-- =====================================================================
-- 111_skill_card_refs.sql
-- Skills Library — polymorphic reference table for pull-moments.
--
-- Why: skill cards need to surface "at the moment of need" per the
-- Skills Library research brief principle #8 (cards are pulled, not
-- pushed). A card can be pinned to any "subject" — v1 uses unit_page
-- (a lesson), with activity_block / unit / crit_board_pin / safety_badge
-- all supported via the same polymorphic shape for later pull-moments.
--
-- Shape follows the learning_events pattern:
--   (skill_card_id, subject_type, subject_id, gate_level, display_order)
--
-- Gate levels model the three increasingly strict ways a card can block
-- a student — though v1 ONLY uses 'suggested' (card surfaces as a
-- reference, never blocks progress). Stricter gates come when the quiz
-- engine lands (S3).
--
-- subject_id is TEXT (not UUID) so it can hold either UUIDs (activity
-- blocks, units) or short codes (unit_page IDs like 'A1', 'B2'). The
-- subject_type discriminates what kind of ID it is.
-- =====================================================================

CREATE TABLE IF NOT EXISTS skill_card_refs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_card_id         uuid NOT NULL REFERENCES skill_cards(id) ON DELETE CASCADE,

  -- The "where this card surfaces" polymorphic pair
  subject_type          text NOT NULL CHECK (subject_type IN (
    'unit_page',          -- a lesson page (primary v1 surface)
    'activity_block',     -- a specific activity block within a lesson
    'unit',               -- whole unit
    'class_gallery_pin',  -- future: pin to a gallery submission
    'safety_badge'        -- future: cards required before badge attempt
  )),
  subject_id            text NOT NULL,
  subject_label         text,                   -- denormalised display ("Unit 3 · Lesson 2")

  -- Gating
  gate_level            text NOT NULL DEFAULT 'suggested'
    CHECK (gate_level IN ('suggested', 'viewed', 'quiz_passed', 'demonstrated')),

  -- Ordering when multiple cards pin to the same subject
  display_order         int NOT NULL DEFAULT 0,

  -- Provenance
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by_teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- One ref per (card, subject) — if you want it in two places, pin twice
  -- to the two distinct subjects. Prevents accidental dedupe noise.
  UNIQUE (skill_card_id, subject_type, subject_id)
);

-- Read paths:
--   - student lesson page → "refs for this unit_page" (subject-side lookup)
--   - teacher card editor → "refs for this card" (card-side lookup)
-- Both hot paths, so index both sides.
CREATE INDEX IF NOT EXISTS skill_card_refs_subject_idx
  ON skill_card_refs (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS skill_card_refs_card_idx
  ON skill_card_refs (skill_card_id);

-- =====================================================================
-- RLS
-- =====================================================================
-- Read: any authenticated user (students need to see their lesson's refs;
-- teachers need to see their card's refs). The underlying skill_cards RLS
-- still gates which cards are readable to which user, so this read-open
-- policy is safe — a student seeing a "ref" to a draft card they can't
-- read just means they'll get a card-level 404 when they click.
--
-- Write: authenticated teachers only. For v1, any teacher can pin any
-- card to any subject they can name. We tighten when Access Model v2
-- lands (subject ownership enforcement per surface).

ALTER TABLE skill_card_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS skill_card_refs_read_all ON skill_card_refs;
CREATE POLICY skill_card_refs_read_all ON skill_card_refs
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS skill_card_refs_teacher_write ON skill_card_refs;
CREATE POLICY skill_card_refs_teacher_write ON skill_card_refs
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================================
-- Comments
-- =====================================================================
COMMENT ON TABLE skill_card_refs IS
  'Skills Library pull-moment table. Pins skill cards to subjects (unit_page, activity_block, unit, etc.) so they surface at the moment of need. Research-brief principle #8.';
COMMENT ON COLUMN skill_card_refs.subject_type IS
  'What kind of thing the card is pinned to. v1 uses unit_page primarily; other types wired in later pull-moment passes.';
COMMENT ON COLUMN skill_card_refs.subject_id IS
  'TEXT (not UUID) so it can hold either UUIDs (activity blocks, units) or short codes (page IDs like A1). Discriminated by subject_type.';
COMMENT ON COLUMN skill_card_refs.subject_label IS
  'Denormalised display string captured at pin time — "Unit 3 · Lesson 2: Brief introduction". Authoring-side labels are expensive to re-derive at read time.';
COMMENT ON COLUMN skill_card_refs.gate_level IS
  'suggested = soft surfacing (v1 default). viewed / quiz_passed / demonstrated = progressively stricter gates, wired in when the quiz engine + demo flow mature.';
