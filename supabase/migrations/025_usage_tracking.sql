-- Usage tracking for all AI API calls
-- Enables cost visibility, per-student tracking, and abuse detection

CREATE TABLE ai_usage_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,                          -- teacher (Supabase Auth) or null
  student_id uuid,                       -- student (token session) or null
  endpoint text NOT NULL,                -- e.g. 'design-assistant', 'generate-unit', 'generate-journey'
  model text NOT NULL,                   -- e.g. 'claude-haiku-4-5-20250315'
  input_tokens int,
  output_tokens int,
  estimated_cost_usd numeric(10,6),
  metadata jsonb DEFAULT '{}',           -- conversation_id, unit_id, response_length, etc.
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_usage_user ON ai_usage_log(user_id, created_at DESC);
CREATE INDEX idx_usage_student ON ai_usage_log(student_id, created_at DESC);
CREATE INDEX idx_usage_endpoint ON ai_usage_log(endpoint, created_at DESC);
CREATE INDEX idx_usage_created ON ai_usage_log(created_at DESC);

-- RLS: service-role-only. Admin pages (/admin/cost-usage,
-- /admin/ai-budget) read this table via createAdminClient() which
-- bypasses RLS — there is NO separate admin SELECT policy. The
-- "service-role" policy below is the ONLY policy on this table; the
-- earlier "admins can read" comment (corrected 9 May 2026, F-18) was
-- imprecise — admins read via service-role bypass, not via a granted
-- read role.
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON ai_usage_log
  FOR ALL
  USING (auth.role() = 'service_role');
