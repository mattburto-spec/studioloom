-- Phase 3.0 — auth.permission_helper_rollout admin_settings flag
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-3-brief.md §3.8 Q6 + §4 Phase 3.0
-- Date: 1 May 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- The Phase 3 can(actor, action, resource) helper replaces ~50 direct
-- author_teacher_id / classes.teacher_id ownership reads. Even with
-- comprehensive unit tests + smoke runs, a permission regression would
-- break teacher UX in a way that's painful to roll back via code revert
-- alone (the 50 callsites span 39 files; reverting all of them on a
-- single bug would itself be high-risk).
--
-- This flag is a kill-switch. When the can() helper is wired into
-- routes (Phase 3.4 callsite migration), each call wraps:
--
--   if (await isPermissionHelperRolloutEnabled()) {
--     return can(actor, action, resource);
--   }
--   return legacyCheck(...);
--
-- Default: true (helper active). If a regression surfaces in prod, set
-- the flag to false in admin_settings (via /admin/controls/registries
-- or direct SQL) and the next route call falls back to the legacy
-- helper path. No code revert needed; no deploy required.
--
-- Removed in Phase 6 cutover when the legacy helpers are deleted and
-- can() becomes unconditional.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One INSERT into admin_settings (idempotent — ON CONFLICT DO NOTHING)
-- - Default value: true (helper active)
-- - No schema change, no data migration
-- - feature-flags.yaml gets the corresponding registry entry in §4.6
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql DELETEs the row. Safe to roll back any time —
-- isPermissionHelperRolloutEnabled() should default to true when the
-- row is absent (matches "feature on by default" semantics).

INSERT INTO admin_settings (key, value)
VALUES (
  'auth.permission_helper_rollout',
  'true'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Sanity check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_settings
    WHERE key = 'auth.permission_helper_rollout'
  ) THEN
    RAISE EXCEPTION 'Migration failed: auth.permission_helper_rollout flag missing';
  END IF;
  RAISE NOTICE 'Migration phase_3_0_permission_helper_rollout_flag applied OK';
END $$;
