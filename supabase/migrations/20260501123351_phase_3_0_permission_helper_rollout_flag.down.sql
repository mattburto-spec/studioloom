-- Rollback for: phase_3_0_permission_helper_rollout_flag
-- Pairs with: 20260501123351_phase_3_0_permission_helper_rollout_flag.sql
--
-- Removes the auth.permission_helper_rollout admin_settings flag.
-- isPermissionHelperRolloutEnabled() defaults to true when row absent,
-- so the helper stays active after rollback.

DELETE FROM admin_settings
WHERE key = 'auth.permission_helper_rollout';
