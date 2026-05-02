-- Rollback for: phase_4_8b_freemium_seams
-- Pairs with: 20260502231455_phase_4_8b_freemium_seams.sql
--
-- Drops the 3 added columns. Refuses if any non-default values
-- present (would lose data — particularly stripe_customer_id, which
-- is real billing-side state we'd never want to drop without manual
-- intervention).

DO $$
DECLARE
  v_non_free_teachers INT;
  v_schools_with_stripe INT;
  v_teachers_with_stripe INT;
BEGIN
  -- Are any teachers on a non-free tier (i.e., real billing happening)?
  SELECT COUNT(*) INTO v_non_free_teachers
  FROM teachers
  WHERE subscription_tier != 'free';
  IF v_non_free_teachers > 0 THEN
    RAISE EXCEPTION 'Rollback aborted: % teachers on non-free tier '
                    '(real billing state). Set them to free first if '
                    'you really want to revert.', v_non_free_teachers;
  END IF;

  SELECT COUNT(*) INTO v_schools_with_stripe
  FROM schools
  WHERE stripe_customer_id IS NOT NULL;
  IF v_schools_with_stripe > 0 THEN
    RAISE EXCEPTION 'Rollback aborted: % schools have stripe_customer_id '
                    'set (would lose billing-side linkage).',
                    v_schools_with_stripe;
  END IF;

  SELECT COUNT(*) INTO v_teachers_with_stripe
  FROM teachers
  WHERE stripe_customer_id IS NOT NULL;
  IF v_teachers_with_stripe > 0 THEN
    RAISE EXCEPTION 'Rollback aborted: % teachers have stripe_customer_id '
                    'set (would lose billing-side linkage).',
                    v_teachers_with_stripe;
  END IF;
END $$;

-- Drop indexes first (defensive — column drops would handle this anyway)
DROP INDEX IF EXISTS idx_teachers_stripe_customer;
DROP INDEX IF EXISTS idx_schools_stripe_customer;
DROP INDEX IF EXISTS idx_teachers_subscription_tier;

-- Drop columns
ALTER TABLE teachers DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE schools  DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE teachers DROP COLUMN IF EXISTS subscription_tier;
