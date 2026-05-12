-- Migration: seed_pitch_your_own_choice_card
-- Created: 20260512053424 UTC
-- Phase: Hot-fix for FK violation surfaced in Matt's G8 lesson.
--
-- WHY: The Choice Cards "Pitch your own" option resolves to the
--   sentinel cardId `_pitch-your-own` in the read path
--   (src/lib/choice-cards/resolve-for-unit.ts) AND the write path
--   (src/app/api/student/choice-cards/[activityId]/pick/route.ts:61
--   has a special-case branch that synthesises label/action without
--   looking up the card). BUT — choice_card_selections.card_id has
--   a FK to choice_cards.id (line 78 of the original choice_cards
--   migration 20260512012304), and the FK is NOT NULL. When a
--   student picks "Pitch your own" the FK violates because there's
--   no row in choice_cards with id = `_pitch-your-own`.
--
--   Matt hit this in class: "Couldn't load the deck: insert or
--   update on table 'choice_card_selections' violates foreign key
--   constraint 'choice_card_selections_card_id_fkey'."
--
-- IMPACT: 1 INSERT into choice_cards seeding the `_pitch-your-own`
--   sentinel row. No schema change. Safe to apply on prod.
--
--   The READ path already special-cases this id — it produces the
--   synthetic "Pitch your own idea" label without looking at the
--   seeded row's fields. So the label / hook_text / detail_md we
--   write here are just FK-satisfying placeholders + would only
--   surface if some other surface naively rendered the seeded card
--   (unlikely; the resolve-for-unit special case skips it).
--
-- ROLLBACK: paired .down.sql deletes the row.

INSERT INTO choice_cards (
  id,
  label,
  hook_text,
  detail_md,
  emoji,
  bg_color,
  on_pick_action,
  is_seeded,
  tags
)
VALUES (
  '_pitch-your-own',
  'Pitch your own idea',
  'Have a project idea that doesn''t fit any of these cards? Pitch it.',
  E'## Pitch your own idea\n\nWrite a short proposal for your teacher to review. Once approved, you''ll proceed to the Product Brief with the "Other" archetype.\n\n- Cover what you want to make, who it''s for, and why none of the preset archetypes fit.\n- Your teacher will approve, request a revision, or redirect you to a preset.',
  '💡',
  '#F3E8FF',
  '{"type":"pitch-to-teacher"}'::jsonb,
  true,
  ARRAY['pitch','sentinel']
)
ON CONFLICT (id) DO NOTHING;

-- Sanity check
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM choice_cards WHERE id = '_pitch-your-own') INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Seed failed: _pitch-your-own row not present in choice_cards';
  END IF;
  RAISE NOTICE 'Seed _pitch-your-own choice card OK';
END $$;
