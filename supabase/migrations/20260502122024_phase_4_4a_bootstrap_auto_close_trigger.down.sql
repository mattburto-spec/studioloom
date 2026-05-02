-- Rollback for: phase_4_4a_bootstrap_auto_close_trigger
-- Pairs with: 20260502122024_phase_4_4a_bootstrap_auto_close_trigger.sql
--
-- Drops the trigger + function. Existing schools.bootstrap_expires_at
-- values are NOT reset on rollback (they remain wherever they were
-- last set — either by Phase 0 backfill, by this trigger before
-- rollback, or NULL for fresh schools).
--
-- Idempotent — uses IF EXISTS.

DROP TRIGGER IF EXISTS tg_teachers_close_bootstrap_on_insert ON public.teachers;
DROP FUNCTION IF EXISTS public.tg_close_bootstrap_on_second_teacher();
