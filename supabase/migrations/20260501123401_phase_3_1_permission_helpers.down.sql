-- Rollback for: phase_3_1_permission_helpers
-- Pairs with: 20260501123401_phase_3_1_permission_helpers.sql
--
-- Drops the 3 SECURITY DEFINER permission helpers. Safe to roll back
-- BEFORE Phase 3.4 wires can() into routes; once consumers exist,
-- prefer flipping auth.permission_helper_rollout=false (Phase 3.0
-- kill-switch) to fall back to the legacy helper path without
-- dropping the SQL functions.

DROP FUNCTION IF EXISTS public.has_class_role(UUID, TEXT);
DROP FUNCTION IF EXISTS public.has_school_responsibility(UUID, TEXT);
DROP FUNCTION IF EXISTS public.has_student_mentorship(UUID, TEXT);
