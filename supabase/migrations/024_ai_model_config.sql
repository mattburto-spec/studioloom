-- AI Model Configuration
-- Single-row table for platform-wide AI model parameters.
-- Empty config {} means all hardcoded defaults are used.

CREATE TABLE IF NOT EXISTS ai_model_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config JSONB NOT NULL DEFAULT '{}',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 'default')
);

-- History table for audit trail
CREATE TABLE IF NOT EXISTS ai_model_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config JSONB NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_note TEXT
);

-- Insert the default row
INSERT INTO ai_model_config (id, config)
VALUES ('default', '{}')
ON CONFLICT (id) DO NOTHING;

-- RLS: only service role can read/write (admin API uses createAdminClient)
ALTER TABLE ai_model_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_model_config_history ENABLE ROW LEVEL SECURITY;
