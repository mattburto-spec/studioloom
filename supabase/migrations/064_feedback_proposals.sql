-- Migration 064: Feedback Proposals & Audit Log
-- Part of Dimensions3 Phase D — approval queue for efficacy adjustments
-- and self-healing proposals.

-- Generation feedback table (teacher edit tracking)
CREATE TABLE IF NOT EXISTS generation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_run_id UUID REFERENCES generation_runs(id),
  unit_id UUID,
  activity_id TEXT NOT NULL,
  source_block_id UUID,

  -- Edit classification
  edit_type TEXT NOT NULL,               -- kept/rewritten/scaffolding_changed/reordered/deleted/added
  diff_percentage FLOAT DEFAULT 0,

  -- Snapshots
  before_snapshot JSONB,
  after_snapshot JSONB,
  position_before INT,
  position_after INT,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gen_feedback_run ON generation_feedback(generation_run_id);
CREATE INDEX IF NOT EXISTS idx_gen_feedback_block ON generation_feedback(source_block_id);
CREATE INDEX IF NOT EXISTS idx_gen_feedback_type ON generation_feedback(edit_type);

-- Feedback proposals table (pending approvals)
CREATE TABLE IF NOT EXISTS feedback_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES activity_blocks(id),

  -- Proposal details
  proposal_type TEXT NOT NULL,           -- efficacy_adjustment/self_healing/metadata_correction
  status TEXT NOT NULL DEFAULT 'pending', -- pending/approved/rejected/modified
  field TEXT NOT NULL,                   -- Which field to change
  current_value JSONB,
  proposed_value JSONB,

  -- Evidence
  evidence_count INT DEFAULT 0,
  evidence_summary TEXT,
  signal_breakdown JSONB,

  -- Guardrail checks
  requires_manual_approval BOOLEAN DEFAULT true,
  guardrail_flags TEXT[],

  -- Resolution
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolved_value JSONB,
  resolution_note TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposals_block ON feedback_proposals(block_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON feedback_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_type ON feedback_proposals(proposal_type);
CREATE INDEX IF NOT EXISTS idx_proposals_created ON feedback_proposals(created_at DESC);

-- Feedback audit log
CREATE TABLE IF NOT EXISTS feedback_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES feedback_proposals(id),
  block_id UUID REFERENCES activity_blocks(id),

  action TEXT NOT NULL,                  -- approved/rejected/modified/auto_approved
  field TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  evidence_count INT DEFAULT 0,

  resolved_by UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_proposal ON feedback_audit_log(proposal_id);
CREATE INDEX IF NOT EXISTS idx_audit_block ON feedback_audit_log(block_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON feedback_audit_log(created_at DESC);

-- Updated_at trigger for feedback_proposals
CREATE OR REPLACE FUNCTION update_feedback_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_feedback_proposals_updated_at ON feedback_proposals;
CREATE TRIGGER trigger_feedback_proposals_updated_at
  BEFORE UPDATE ON feedback_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_proposals_updated_at();

-- RLS
ALTER TABLE generation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_audit_log ENABLE ROW LEVEL SECURITY;

-- Generation feedback: readable by the run's teacher
CREATE POLICY gen_feedback_select ON generation_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM generation_runs gr
      WHERE gr.id = generation_feedback.generation_run_id
        AND gr.teacher_id = auth.uid()
    )
  );

CREATE POLICY gen_feedback_insert ON generation_feedback
  FOR INSERT WITH CHECK (true);

-- Feedback proposals: readable by block owner
CREATE POLICY proposals_select ON feedback_proposals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM activity_blocks ab
      WHERE ab.id = feedback_proposals.block_id
        AND ab.teacher_id = auth.uid()
    )
  );

CREATE POLICY proposals_insert ON feedback_proposals
  FOR INSERT WITH CHECK (true);

CREATE POLICY proposals_update ON feedback_proposals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM activity_blocks ab
      WHERE ab.id = feedback_proposals.block_id
        AND ab.teacher_id = auth.uid()
    )
  );

-- Audit log: readable by block owner
CREATE POLICY audit_select ON feedback_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM activity_blocks ab
      WHERE ab.id = feedback_audit_log.block_id
        AND ab.teacher_id = auth.uid()
    )
  );

CREATE POLICY audit_insert ON feedback_audit_log
  FOR INSERT WITH CHECK (true);
