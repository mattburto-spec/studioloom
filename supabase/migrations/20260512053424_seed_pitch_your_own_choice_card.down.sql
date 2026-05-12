-- Rollback for: seed_pitch_your_own_choice_card
-- Pairs with: 20260512053424_seed_pitch_your_own_choice_card.sql
--
-- Safety guard: refuses if any student has already picked the sentinel
-- (their selection would orphan).

DO $$
DECLARE
  v_pick_count INT;
BEGIN
  SELECT COUNT(*) INTO v_pick_count
  FROM choice_card_selections
  WHERE card_id = '_pitch-your-own';
  IF v_pick_count > 0 THEN
    RAISE EXCEPTION
      'Refusing rollback: % student selection(s) reference _pitch-your-own. '
      'Delete or reassign those first.',
      v_pick_count;
  END IF;
END $$;

DELETE FROM choice_cards WHERE id = '_pitch-your-own';
