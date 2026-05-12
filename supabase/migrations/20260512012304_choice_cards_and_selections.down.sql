-- Rollback for: choice_cards_and_selections
-- Pairs with: 20260512012304_choice_cards_and_selections.sql
--
-- Safety guard: refuse to drop if any student picks exist (= real work).

DO $$
DECLARE
  v_pick_count INT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='choice_card_selections') THEN
    SELECT COUNT(*) INTO v_pick_count FROM choice_card_selections;
    IF v_pick_count > 0 THEN
      RAISE EXCEPTION 'Rollback refused: % choice_card_selections rows exist (student work). '
                      'Truncate first if intentional.', v_pick_count;
    END IF;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_choice_cards_updated_at ON choice_cards;

DROP TABLE IF EXISTS choice_card_selections;
DROP TABLE IF EXISTS choice_cards;
-- Note: set_updated_at() function is shared with many other tables — do NOT drop it here.
