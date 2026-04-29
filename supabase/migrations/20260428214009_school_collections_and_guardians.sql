-- Migration: school_collections_and_guardians
-- Created: 20260428214009 UTC
-- Phase: Access Model v2 Phase 0.6a
--
-- WHY: Forward-compat schema for two related concerns —
--   (1) school-scoped people/place/thing collections (school_resources +
--       school_resource_relations) — first concrete consumer is Matt's
--       PYP/Service Learning "people, places, things" mentor library
--       (see Mentor Manager planned project + §8.6 item 1)
--   (2) parent/guardian relational records (guardians + student_guardians)
--       — no UI in v2; schema unblocks future parent comms, report
--       sharing, parent-portal SSO, emergency contact retrieval
--       (§8.6 item 2)
-- IMPACT: 4 new tables. RLS enabled on all four with simple
--   "teachers in same school can read" policy. No backfill — tables
--   ship empty; future features populate them.
-- ROLLBACK: paired .down.sql drops all 4 tables in dependency-reverse
--   order (relations + student_guardians first; resources + guardians
--   second).

-- ============================================================
-- 1. school_resources — polymorphic collection (people/places/things)
-- ============================================================
-- First consumer: PYP / Service Learning mentor + community-partner
-- library. Same pattern reusable for alumni directory, partner orgs,
-- shared rubric bank, etc.
--
-- Read permission tiered (Phase 3+):
--   - name + summary + tags + visibility   → readable to all in scope
--   - contact_info_jsonb                    → gated, "I'm contacting them"
--                                              click reveals + logs to
--                                              audit_events (Phase 5)
-- For Phase 0 the row-level permission is "teachers in the same school";
-- Phase 3 expands to the tiered contact gating.

CREATE TABLE school_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL
    CHECK (resource_type IN ('person','place','thing','organization')),
  name TEXT NOT NULL,
  summary TEXT,
  details_jsonb JSONB NOT NULL DEFAULT '{}',
  contact_info_jsonb JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  visibility TEXT NOT NULL DEFAULT 'school'
    CHECK (visibility IN ('school','class','private')),
  class_id UUID NULL REFERENCES classes(id) ON DELETE CASCADE,
  added_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_by_teacher_id UUID NULL REFERENCES teachers(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NULL,
  consent_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (consent_status IN ('pending','granted','revoked','expired')),
  last_verified_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_resources_school
  ON school_resources(school_id);
CREATE INDEX IF NOT EXISTS idx_school_resources_type
  ON school_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_school_resources_class
  ON school_resources(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_school_resources_tags
  ON school_resources USING GIN(tags);

-- ============================================================
-- 2. school_resource_relations — graph between resources
-- ============================================================
-- E.g. person "Anna Lee" works_at organization "MakerSpace Nanjing"
--      located_at place "Software Park Bldg 3".
-- relation_type extensible — start with three; add more by migration.

CREATE TABLE school_resource_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_resource_id UUID NOT NULL REFERENCES school_resources(id) ON DELETE CASCADE,
  to_resource_id UUID NOT NULL REFERENCES school_resources(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL
    CHECK (relation_type IN ('works_at','located_at','partners_with','member_of','reports_to')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_resource_id <> to_resource_id),
  UNIQUE (from_resource_id, to_resource_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_school_resource_relations_from
  ON school_resource_relations(from_resource_id);
CREATE INDEX IF NOT EXISTS idx_school_resource_relations_to
  ON school_resource_relations(to_resource_id);

-- ============================================================
-- 3. guardians — parent / guardian records (no auth.users link in v2)
-- ============================================================
-- Plain TEXT for email + phone in Phase 0; encryption-at-rest is a
-- future migration when parent portal UI ships and the columns
-- actually start receiving production data. Filed as
-- FU-AV2-GUARDIAN-CONTACT-ENCRYPTION (P3, ship before parent portal).

CREATE TABLE guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  relationship_type TEXT NULL
    CHECK (relationship_type IS NULL OR relationship_type IN
      ('mother','father','parent','step_parent','grandparent','guardian','foster_parent','other')),
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guardians_school
  ON guardians(school_id);
CREATE INDEX IF NOT EXISTS idx_guardians_email_lower
  ON guardians(LOWER(email)) WHERE email IS NOT NULL;

-- ============================================================
-- 4. student_guardians — many-to-many junction
-- ============================================================
-- A student can have multiple guardians; a guardian can have multiple
-- students. is_primary singles out the primary contact for
-- comms (one per student).

CREATE TABLE student_guardians (
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  receives_reports BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, guardian_id)
);

-- Reverse-direction lookup ("who are this guardian's students?")
CREATE INDEX IF NOT EXISTS idx_student_guardians_guardian
  ON student_guardians(guardian_id);

-- Partial unique constraint: at most one primary guardian per student
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_guardians_one_primary
  ON student_guardians(student_id) WHERE is_primary = true;

-- ============================================================
-- 5. RLS — Phase 0 baseline (teachers in same school can read)
-- ============================================================
-- Phase 3 permission helper rewrites these with the can() abstraction.
-- For now: every teacher with teachers.school_id = X can SELECT rows
-- in their school. INSERT/UPDATE/DELETE deny by default — only Phase 4+
-- school-settings UI / mentor-manager flows write via service role until
-- Phase 3 lands the permission policies.

ALTER TABLE school_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_resource_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_resources_school_read"
  ON school_resources FOR SELECT
  USING (
    school_id IN (
      SELECT t.school_id FROM teachers t
      WHERE t.id = auth.uid() AND t.school_id IS NOT NULL
    )
  );

CREATE POLICY "school_resource_relations_via_resource"
  ON school_resource_relations FOR SELECT
  USING (
    from_resource_id IN (
      SELECT id FROM school_resources sr
      WHERE sr.school_id IN (
        SELECT t.school_id FROM teachers t
        WHERE t.id = auth.uid() AND t.school_id IS NOT NULL
      )
    )
  );

CREATE POLICY "guardians_school_read"
  ON guardians FOR SELECT
  USING (
    school_id IN (
      SELECT t.school_id FROM teachers t
      WHERE t.id = auth.uid() AND t.school_id IS NOT NULL
    )
  );

CREATE POLICY "student_guardians_via_student"
  ON student_guardians FOR SELECT
  USING (
    student_id IN (
      SELECT s.id FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE c.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- 6. Sanity check
-- ============================================================

DO $$
DECLARE
  expected_tables TEXT[] := ARRAY[
    'school_resources',
    'school_resource_relations',
    'guardians',
    'student_guardians'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY expected_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE EXCEPTION 'Migration school_collections_and_guardians failed: table % missing', t;
    END IF;
  END LOOP;
  RAISE NOTICE 'Migration school_collections_and_guardians applied OK: 4 tables created with RLS + indexes';
END $$;
