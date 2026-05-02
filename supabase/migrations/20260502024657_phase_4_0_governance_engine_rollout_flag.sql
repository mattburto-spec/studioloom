-- Phase 4.0 — school.governance_engine_rollout admin_settings flag
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-4-brief.md §3.8 Q4 + §4 Phase 4.0
-- Date: 2 May 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- The Phase 4 governance engine adds school_setting_changes — a high-blast-
-- radius mechanism that determines whether a teacher's settings edit
-- applies instantly (low-stakes), proposes a 2-teacher confirm
-- (high-stakes), or 429s on rate limit. A regression in tier-resolution,
-- bootstrap-grace logic, or rate-limit accounting could lock teachers out
-- of their own school's settings — painful to roll back via code revert.
--
-- This flag is a kill-switch. Every governance route wraps:
--
--   if (!await isGovernanceEngineRolloutEnabled()) {
--     return legacySettingsPathOrPassThrough();
--   }
--   return proposeSchoolSettingChange(...);
--
-- Default: true (engine active). If a regression surfaces in prod, set
-- the flag to false in admin_settings (via /admin/controls/registries
-- or direct SQL) and the next route call falls back to the legacy /
-- pass-through path. No code revert needed; no deploy required.
--
-- Removed in Phase 6 cutover when governance becomes unconditional.
--
-- Sibling pattern: 20260501123351_phase_3_0_permission_helper_rollout_flag.sql
-- (Phase 3.0 used the same kill-switch shape; copy that ritual.)
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One INSERT into admin_settings (idempotent — ON CONFLICT DO NOTHING)
-- - Default value: true (engine active)
-- - No schema change, no data migration
-- - feature-flags.yaml gets the corresponding registry entry in §4.11
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql DELETEs the row. Safe to roll back any time —
-- isGovernanceEngineRolloutEnabled() defaults to true when the row is
-- absent (matches "feature on by default" semantics).

INSERT INTO admin_settings (key, value)
VALUES (
  'school.governance_engine_rollout',
  'true'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Sanity check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_settings
    WHERE key = 'school.governance_engine_rollout'
  ) THEN
    RAISE EXCEPTION 'Migration failed: school.governance_engine_rollout flag missing';
  END IF;
  RAISE NOTICE 'Migration phase_4_0_governance_engine_rollout_flag applied OK';
END $$;
