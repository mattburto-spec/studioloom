-- 016: Make activity cards system curriculum-agnostic
--
-- Changes:
-- 1. Default curriculum_frameworks to empty array (not IB_MYP)
-- 2. Remove hard-coded MYP criterion constraint from usage table
-- 3. Update column comment to be framework-neutral

-- 1. Change default from '{IB_MYP}' to '{}'
-- New cards should be framework-agnostic unless explicitly tagged.
ALTER TABLE activity_cards
  ALTER COLUMN curriculum_frameworks SET DEFAULT '{}';

-- 2. Drop the CHECK constraint that locks criterion to A/B/C/D only.
-- Different frameworks use different criterion identifiers (e.g., GCSE AO1/AO2,
-- ACARA, etc.). Accept any text value.
ALTER TABLE activity_card_usage
  DROP CONSTRAINT IF EXISTS activity_card_usage_criterion_check;

-- 3. Update column comments to be framework-neutral
COMMENT ON COLUMN activity_cards.criteria IS
  'Assessment criteria tags — e.g. IB MYP {A,B,C,D}, GCSE {AO1,AO2,AO3}, or empty for framework-agnostic cards';

COMMENT ON COLUMN activity_cards.curriculum_frameworks IS
  'Which curriculum frameworks this card has been mapped to — empty means framework-agnostic';

COMMENT ON COLUMN activity_card_usage.criterion IS
  'Assessment criterion the card was used on (framework-dependent, e.g. A/B/C/D for MYP)';
