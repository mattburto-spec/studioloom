-- Migration 077: admin_settings table + seed rows
--
-- Singleton key/value store for admin-controlled pipeline settings (spec §9.15).
-- Wires the /admin/controls page backend (Phase 7I).
--
-- Uses UUID primary key (not SERIAL) to match post-060 convention (D2).
-- Seed values are placeholders — real numbers set by Matt via /admin/controls.

-- ============================================================
-- 1. CREATE TABLE admin_settings
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT UNIQUE NOT NULL,
  value        JSONB NOT NULL,
  updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. RLS on admin_settings
-- ============================================================

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Service role full access (admin reads/writes via createAdminClient)
CREATE POLICY "Service role full access admin_settings"
  ON admin_settings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 3. Seed default rows
--    These are pipeline defaults — real values set via /admin/controls (Phase 7I).
-- ============================================================

INSERT INTO admin_settings (key, value) VALUES
  ('pipeline.stage_enabled', '{"retrieve": true, "assemble": true, "gap_fill": true, "polish": true, "timing": true, "score": true}'::jsonb),
  ('pipeline.cost_ceiling_per_run_usd', '5.00'::jsonb),
  ('pipeline.cost_ceiling_per_day_usd', '50.00'::jsonb),
  ('pipeline.model_override', '{}'::jsonb),
  ('pipeline.starter_patterns_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
