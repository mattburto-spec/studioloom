-- Rollback for: phase_4_3_school_setting_changes
-- Pairs with: 20260502034114_phase_4_3_school_setting_changes.sql
--
-- Drop order: function → tables → enums (reverse of CREATE order;
-- enums can't drop while a column references them, tables can't drop
-- with policies-bound functions in scope).
--
-- All rate-limit + change ledger data is lost on rollback. Audit trail
-- is gone. Acceptable for dev rollback; would NOT be acceptable in
-- prod once governance is the source of truth for school settings.

DROP FUNCTION IF EXISTS public.enforce_setting_change_rate_limit(UUID, INTEGER, INTEGER);
DROP TABLE IF EXISTS school_setting_changes_rate_state;
DROP TABLE IF EXISTS school_setting_changes;
DROP TYPE IF EXISTS school_setting_change_status;
DROP TYPE IF EXISTS school_setting_change_tier;
