-- Migration 034: Safety Certifications
-- Teacher-granted workshop skill certifications for students.
-- These are real-world competencies verified by the teacher (laser cutter, 3D printer, etc.)

-- Safety certifications table
CREATE TABLE IF NOT EXISTS safety_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  class_id text NOT NULL,
  cert_type text NOT NULL,          -- e.g. 'laser-cutter', '3d-printer', 'soldering'
  granted_by uuid NOT NULL,          -- teacher user ID (Supabase Auth)
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,            -- optional expiry (e.g. annual renewal)
  notes text,                        -- optional teacher note
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate certs for same student + type
  UNIQUE(student_id, cert_type)
);

-- Index for student lookup (most common query)
CREATE INDEX IF NOT EXISTS idx_safety_certs_student ON safety_certifications(student_id);

-- Index for class lookup (teacher viewing class certs)
CREATE INDEX IF NOT EXISTS idx_safety_certs_class ON safety_certifications(class_id);

-- Index for teacher lookup
CREATE INDEX IF NOT EXISTS idx_safety_certs_granted_by ON safety_certifications(granted_by);

-- RLS policies
ALTER TABLE safety_certifications ENABLE ROW LEVEL SECURITY;

-- Students can read their own certs
CREATE POLICY "Students can read own certs"
  ON safety_certifications FOR SELECT
  USING (student_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR student_id = current_setting('app.student_id', true));

-- Teachers can read certs for their classes
CREATE POLICY "Teachers can read class certs"
  ON safety_certifications FOR SELECT
  USING (granted_by = auth.uid());

-- Teachers can insert certs
CREATE POLICY "Teachers can grant certs"
  ON safety_certifications FOR INSERT
  WITH CHECK (granted_by = auth.uid());

-- Teachers can revoke (delete) certs they granted
CREATE POLICY "Teachers can revoke certs"
  ON safety_certifications FOR DELETE
  USING (granted_by = auth.uid());

-- Protect created_at from being overwritten on update
CREATE OR REPLACE FUNCTION update_safety_certs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = OLD.created_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_safety_certs_created_at
  BEFORE UPDATE ON safety_certifications
  FOR EACH ROW
  EXECUTE FUNCTION update_safety_certs_updated_at();
