-- 090_teacher_display_name.sql
-- Adds an optional "display name" teachers can set for community-facing
-- attribution on published units (e.g. "Mr. Burton", "Ms. Chen"). Falls
-- back to teachers.name, then to the literal "Teacher", on publish.
--
-- Writers: /api/teacher/profile (PATCH)
-- Readers: /api/teacher/units (POST action=publish)

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN teachers.display_name IS
  'Public attribution name for community-published units. Prefer format like "Mr. Burton" or "Ms. Chen". If null, units fall back to teachers.name.';
