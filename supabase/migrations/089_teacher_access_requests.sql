-- 089_teacher_access_requests.sql
-- Public-facing "Request Access" form that feeds into the admin Teachers tab.
-- Prospective teachers submit their email/name; admin reviews and can send an invite.
--
-- Writers: /api/teacher/request-access (anon), /api/admin/teacher-requests (admin)
-- Readers: /api/admin/teacher-requests (admin only)

CREATE TABLE IF NOT EXISTS teacher_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  school TEXT,
  role TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'invited', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_access_requests_status
  ON teacher_access_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_access_requests_email
  ON teacher_access_requests(email);

-- Enable RLS — all access goes through server-side API routes using the
-- service role key. No direct client reads/writes allowed.
ALTER TABLE teacher_access_requests ENABLE ROW LEVEL SECURITY;

-- Deny-all for public/authenticated clients. Service role bypasses RLS.
-- (No policies = deny by default under RLS.)

COMMENT ON TABLE teacher_access_requests IS
  'Prospective teacher signup requests submitted from the public login page. Reviewed from /admin/teachers.';
