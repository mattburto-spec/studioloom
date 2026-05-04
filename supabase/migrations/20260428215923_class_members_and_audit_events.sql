-- Migration: class_members_and_audit_events
-- Created: 20260428215923 UTC
-- Phase: Access Model v2 Phase 0.7a (load-bearing access infrastructure)
--
-- WHY: Two architectural cornerstones for Phases 1+ —
--
--   1. class_members — class-level role assignments. Replaces
--      classes.teacher_id direct ownership reads in Phase 6 cutover.
--      Phase 3's permission helper has_class_role(class_id, role?)
--      reads this. Phase 0.8 backfills lead_teacher rows from existing
--      classes.teacher_id (NIS prod has the 3-Matts case to handle).
--      Role enum decided 28 Apr: lead_teacher / co_teacher / dept_head
--      / mentor / lab_tech / observer (mentor added for class-wide
--      cover/sub teacher cases — distinct from per-student
--      student_mentors from Phase 0.6c).
--
--   2. audit_events — immutable append-only audit log. Wired into every
--      mutation route in Phase 5 via logAuditEvent() wrapper. School
--      procurement (per IT audit F22 BLOCKER) requires answering "who
--      accessed this student's record between [date] and [date]?" —
--      this table is that answer. Tags every row with
--      school_subscription_tier_at_event for monetisation analytics
--      (per §8.6 item 6).
--
-- IMPACT: 2 new tables. RLS Phase-0 baseline scoped reads. INSERT on
--   class_members deny-by-default (Phase 4 invite UI + service role).
--   audit_events INSERT-only (no UPDATE/DELETE policies — immutable by
--   design). No backfill in this migration — class_members seeded by
--   Phase 0.8.
-- ROLLBACK: paired .down.sql drops both tables.
--
-- Partitioning by month for audit_events: deferred. Single table
-- ships in v2; performance + retention tools added when row count
-- justifies (filed as FU-AV2-AUDIT-EVENTS-PARTITION P3).

-- ============================================================
-- 1. class_members — class-level role assignments
-- ============================================================
-- member_user_id REFERENCES auth.users so the role enum can include
-- 'mentor' (community_member) and 'observer' (parent/guardian) once
-- those identities have auth.users rows. Today only teachers do.
--
-- removed_at semantics: when a teacher is removed from the class
-- (teacher leaves school, swap roles, etc.), the row stays for audit
-- but is_active = (removed_at IS NULL). Re-adding the same person
-- creates a new row.

CREATE TABLE class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  member_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL
    CHECK (role IN ('lead_teacher','co_teacher','dept_head','mentor','lab_tech','observer')),
  invited_at TIMESTAMPTZ NULL,
  invited_by UUID NULL REFERENCES teachers(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ NULL,
  removed_by UUID NULL REFERENCES teachers(id) ON DELETE SET NULL,
  removal_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Coherence: removed_at must be NULL or after accepted_at
  CHECK (removed_at IS NULL OR removed_at >= accepted_at)
);

-- One active membership per (class, member, role). When removed, a new
-- row can be created for re-invitation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_members_unique_active
  ON class_members(class_id, member_user_id, role)
  WHERE removed_at IS NULL;

-- Primary lookup: "what's the lead_teacher of class X?"
CREATE INDEX IF NOT EXISTS idx_class_members_class_role
  ON class_members(class_id, role)
  WHERE removed_at IS NULL;

-- Reverse lookup: "what classes is teacher T in?"
CREATE INDEX IF NOT EXISTS idx_class_members_user
  ON class_members(member_user_id)
  WHERE removed_at IS NULL;

-- ============================================================
-- 2. audit_events — immutable append-only audit log
-- ============================================================
-- IMMUTABLE: no UPDATE policy, no DELETE policy. Service role inserts
-- via logAuditEvent() wrapper from Phase 5+. RLS controls SELECT
-- visibility per scope.

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL
    CHECK (actor_type IN (
      'student','teacher','fabricator','platform_admin',
      'community_member','guardian','system'
    )),
  -- platform_admin pretending to be teacher (support flow Phase 6+)
  impersonated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  -- e.g. 'unit.create', 'student.invite', 'school.settings.update'
  target_table TEXT NULL,
  target_id UUID NULL,
  -- Denormalised for filter performance — set by logAuditEvent() wrapper
  -- when the actor / target context provides it.
  school_id UUID NULL REFERENCES schools(id) ON DELETE SET NULL,
  class_id UUID NULL REFERENCES classes(id) ON DELETE SET NULL,
  payload_jsonb JSONB NOT NULL DEFAULT '{}',
  ip_address INET NULL,
  user_agent TEXT NULL,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','warn','critical')),
  -- Monetisation analytics seam (per §8.6 item 6) — captures the
  -- school's subscription tier AT THE TIME of the event so retroactive
  -- "what did pro-tier users do in March?" queries don't have to walk
  -- subscription history.
  school_subscription_tier_at_event TEXT NULL
    CHECK (school_subscription_tier_at_event IS NULL OR
      school_subscription_tier_at_event IN
      ('pilot','free','starter','pro','school')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recent-events index (most common audit query)
CREATE INDEX IF NOT EXISTS idx_audit_events_created
  ON audit_events(created_at DESC);

-- Per-actor "what did this user do?"
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created
  ON audit_events(actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

-- School-filtered audit (every teacher in a school sees their school's events)
CREATE INDEX IF NOT EXISTS idx_audit_events_school_created
  ON audit_events(school_id, created_at DESC)
  WHERE school_id IS NOT NULL;

-- Action-faceted query ("show me all .delete actions today")
CREATE INDEX IF NOT EXISTS idx_audit_events_action_created
  ON audit_events(action, created_at DESC);

-- Severity index for "show me critical events" admin queries
CREATE INDEX IF NOT EXISTS idx_audit_events_severity_created
  ON audit_events(severity, created_at DESC)
  WHERE severity != 'info';

-- ============================================================
-- 3. RLS — Phase 0 baseline
-- ============================================================
-- class_members:
--   - SELECT: members of the class (own row) + teachers in same school
-- audit_events:
--   - SELECT: teachers in same school read events for their school
--   - SELECT: actor self-read (read your own actions)
--   - INSERT/UPDATE/DELETE: deny-by-default (only service role writes)
--     Audit immutability enforced by absence of UPDATE/DELETE policies.

ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- class_members: own membership row
CREATE POLICY "class_members_self_read"
  ON class_members FOR SELECT
  USING (member_user_id = auth.uid());

-- class_members: teachers in same school as the class
CREATE POLICY "class_members_school_teacher_read"
  ON class_members FOR SELECT
  USING (
    class_id IN (
      SELECT c.id FROM classes c
      JOIN teachers t ON t.school_id = c.school_id
      WHERE t.id = auth.uid()
        AND t.school_id IS NOT NULL
        AND c.school_id IS NOT NULL
    )
  );

-- audit_events: actor self-read
CREATE POLICY "audit_events_actor_self_read"
  ON audit_events FOR SELECT
  USING (actor_id = auth.uid());

-- audit_events: teachers in same school read school events
CREATE POLICY "audit_events_school_teacher_read"
  ON audit_events FOR SELECT
  USING (
    school_id IN (
      SELECT t.school_id FROM teachers t
      WHERE t.id = auth.uid() AND t.school_id IS NOT NULL
    )
  );

COMMENT ON TABLE audit_events IS
  'Immutable append-only audit log. Phase 5 wires logAuditEvent() wrapper '
  'into every mutation route. NO UPDATE/DELETE policies — immutability '
  'enforced by absence. Service role inserts; RLS controls SELECT.';

-- ============================================================
-- 4. Sanity check
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'class_members'
  ) THEN
    RAISE EXCEPTION 'Migration failed: class_members missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_events'
  ) THEN
    RAISE EXCEPTION 'Migration failed: audit_events missing';
  END IF;
  RAISE NOTICE 'Migration class_members_and_audit_events applied OK: 2 tables + 8 indexes + 4 RLS policies';
END $$;
