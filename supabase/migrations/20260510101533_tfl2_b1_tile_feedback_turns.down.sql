-- Rollback for: tfl2_b1_tile_feedback_turns
-- Pairs with: 20260510101533_tfl2_b1_tile_feedback_turns.sql
-- Phase: TFL.2 Pass B sub-phase B.1
--
-- WHY ROLLBACK MAY BE NEEDED:
--   If the sync trigger has an unexpected interaction with the
--   existing marking-page write path that surfaces only in prod
--   (e.g. double-fires under a specific race condition), we drop
--   the trigger + function + table to restore the pre-migration
--   shape. The existing student_facing_comment column is untouched
--   by this migration, so rolling back leaves the application fully
--   functional — the only loss is the new turns table's data + the
--   forward-compat hook for the Pass B sub-phases.
--
--   Pass B sub-phases B.2–B.5 all depend on this table. Rolling
--   back B.1 implicitly rolls back any merged sub-phase that came
--   after. Coordinate the route reverts before applying this
--   rollback.
--
-- ORDER MATTERS:
--   1. Drop the trigger first (so subsequent UPDATEs to
--      student_tile_grades don't try to write to a vanishing table)
--   2. Drop the function (no callers left after the trigger is gone)
--   3. Drop the table (CASCADE picks up the index + RLS policies)
--
-- IDEMPOTENCY: every DROP uses IF EXISTS — safe to re-run.

DROP TRIGGER IF EXISTS trg_sync_tile_feedback_from_comment ON student_tile_grades;

DROP FUNCTION IF EXISTS sync_tile_feedback_from_comment();

DROP TABLE IF EXISTS tile_feedback_turns CASCADE;
