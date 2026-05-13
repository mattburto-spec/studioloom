-- Rollback for: class_dj_block
-- Pairs with: 20260513122638_class_dj_block.sql
--
-- Drops the 5 Class DJ tables (RLS + policies + indexes + FK constraints
-- cascade automatically) and removes the seed row from activity_blocks.
-- Safe even on partially-applied state — uses IF EXISTS.

BEGIN;

-- Remove the activity_blocks seed row first (FK references are
-- nullable / not cross-cutting, so order doesn't matter much, but doing
-- the seed first keeps the table-drop chain clean if anything fails).
DELETE FROM public.activity_blocks
WHERE response_type = 'class-dj' AND toolkit_tool_id = 'class-dj';

-- Drop tables. RLS policies + indexes + FK cascades come along.
DROP TABLE IF EXISTS public.class_dj_veto_overrides;
DROP TABLE IF EXISTS public.class_dj_ledger_resets;
DROP TABLE IF EXISTS public.class_dj_fairness_ledger;
DROP TABLE IF EXISTS public.class_dj_suggestions;
DROP TABLE IF EXISTS public.class_dj_rounds;

COMMIT;
