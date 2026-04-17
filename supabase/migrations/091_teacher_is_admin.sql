-- 091_teacher_is_admin.sql
-- Adds is_admin flag to teachers so admin-only routes/pages can gate access
-- at the database level instead of relying solely on the ADMIN_EMAILS env var.
--
-- Combined with the ADMIN_EMAILS env var (belt-and-suspenders):
--   * Primary check: teachers.is_admin = true
--   * Fallback: email in ADMIN_EMAILS (so we can't lock ourselves out during
--     rollout or if the DB flag gets accidentally unset).
--
-- Writers: (none yet — manual UPDATE or future admin UI)
-- Readers: src/lib/auth/require-admin.ts, middleware.ts

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_teachers_is_admin
  ON teachers(is_admin)
  WHERE is_admin = true;

-- Seed the founder account as admin so we have at least one admin once the
-- flag is enforced. Any additional admins can be promoted by updating this
-- row manually or via the ADMIN_EMAILS env var fallback.
UPDATE teachers
  SET is_admin = true
  WHERE lower(email) = 'mattburto@gmail.com';

COMMENT ON COLUMN teachers.is_admin IS
  'When true, user has access to /admin area and /api/admin/* routes. Seeded for founder in migration 091. Fallback is ADMIN_EMAILS env var (see src/lib/auth/require-admin.ts).';
