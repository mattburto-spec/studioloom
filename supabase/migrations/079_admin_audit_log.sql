-- Migration 079: admin_audit_log table
--
-- General audit log for admin actions (settings changes, alert acknowledgements, etc.)
-- Spec §9.14 + §9.15 — settings changes audited here.
--
-- RLS: service_role only. No policies created intentionally (same pattern as
-- ai_model_config, ai_model_config_history per FU-FF). Scanner will flag as
-- rls_enabled_no_policy — that's by design, not a bug.

-- ============================================================
-- 1. CREATE TABLE admin_audit_log
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  target_table TEXT,
  target_key   TEXT,
  old_value    JSONB,
  new_value    JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
  ON admin_audit_log (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON admin_audit_log (target_table, target_key, created_at DESC);

-- ============================================================
-- 3. RLS — service_role only (no explicit policies = deny-all for non-service-role)
-- ============================================================

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
