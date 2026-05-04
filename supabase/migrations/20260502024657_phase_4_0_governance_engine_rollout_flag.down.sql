-- Rollback for: phase_4_0_governance_engine_rollout_flag
-- Pairs with: 20260502024657_phase_4_0_governance_engine_rollout_flag.sql
--
-- Idempotent — DELETE is a no-op if the row was already absent.

DELETE FROM admin_settings
WHERE key = 'school.governance_engine_rollout';
