-- Rollback for: seed_choice_cards_g8_briefs
-- Pairs with: 20260512015124_seed_choice_cards_g8_briefs.sql
--
-- Safety guard: refuse to delete if any student has picked one of these
-- cards (= real audit history that would be lost).

DO $$
DECLARE
  v_picks INT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='choice_card_selections') THEN
    SELECT COUNT(*) INTO v_picks
    FROM choice_card_selections
    WHERE card_id LIKE 'g8-brief-%';
    IF v_picks > 0 THEN
      RAISE EXCEPTION 'Rollback refused: % student picks reference g8-brief-* cards. '
                      'Cascade through choice_card_selections first if intentional.', v_picks;
    END IF;
  END IF;
END $$;

DELETE FROM choice_cards WHERE id IN (
  'g8-brief-designer-mentor',
  'g8-brief-studio-theme',
  'g8-brief-scaffold',
  'g8-brief-1m2-space',
  'g8-brief-desktop-object',
  'g8-brief-board-game'
);
