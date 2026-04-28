-- Migration: machine_profiles_school_scoped
-- Created: 20260428074205 UTC
-- Phase: Preflight Phase 8-3 (mirror lab pattern: school-scoped + audit-only creator)
--
-- WHY: Phase 8-1 made labs school-scoped but left machine_profiles
--   teacher-scoped. Under flat school membership (any teacher at the
--   school can manage any of the school's machines), this is incoherent
--   — Cynthia couldn't manage machines created by Matt persona 2 even
--   though they're in the same school's labs. Audit MED-2 + MED-5
--   (Option 1 — full mirror of lab pattern, signed off 28 Apr).
--
-- IMPACT (machine_profiles):
--   BACKFILL  school_id from teacher_id → teachers.school_id chain
--             (or lab_id → fabrication_labs.school_id if lab_id present)
--   ADD       created_by_teacher_id UUID NULL REFERENCES teachers(id)
--             ON DELETE SET NULL — audit-only, mirrors lab pattern.
--             Backfilled from teacher_id (same UUID; teachers.id = auth.users.id).
--   ADD CHECK is_system_template = true OR school_id IS NOT NULL
--   DROP      idx_machine_profiles_teacher_id (replaced by school index)
--   DROP      uq_machine_profiles_teacher_name (school-scoped uniqueness now)
--   DROP      idx_machine_profiles_teacher_lab_name_active (mig 118)
--             — replaced by lab-scoped uniqueness
--   ADD       idx_machine_profiles_school_id, idx_machine_profiles_created_by,
--             uq_machine_profiles_lab_name_active
--   REPLACE   4 RLS policies — teacher_id = auth.uid() → school_id =
--             current_teacher_school_id() (helper from mig 20260427134953)
--
-- LEGACY: machine_profiles.teacher_id column STAYS (not dropped). Reads
--   stop reading it for access control after this migration; a future
--   cleanup migration can drop the column once we've verified no
--   downstream consumers (RLS on other tables, FK references, etc.)
--   still depend on it. Current: orchestration writes both teacher_id
--   AND created_by_teacher_id on insert; reads only created_by_teacher_id.
--
-- ROLLBACK: paired .down.sql restores teacher-scoped indexes + policies.
--   The new school_id values stay (they're real and correct); created_by
--   column stays (additive). Only access-control surfaces revert.
--
-- DEPS: 093 (machine_profiles base + RLS), 094 (template seed),
--       085 (teachers.school_id), 118 (uq_machine_profiles_teacher_lab_name_active),
--       20260427134953 (current_teacher_school_id() helper).

-- ============================================================
-- 1. Backfill: machine_profiles.school_id (currently NULL on all
--    non-template rows) <- teachers.school_id via teacher_id.
--
--    Belt-and-braces: prefer fabrication_labs.school_id if lab_id is
--    set (canonical post Phase 8-1), else teacher chain. Templates
--    keep school_id = NULL (global seed data).
-- ============================================================

UPDATE machine_profiles AS mp
SET school_id = COALESCE(fl.school_id, t.school_id)
FROM teachers AS t
LEFT JOIN fabrication_labs AS fl
  ON fl.id = mp.lab_id
WHERE mp.is_system_template = false
  AND mp.teacher_id = t.id
  AND t.school_id IS NOT NULL
  AND mp.school_id IS DISTINCT FROM COALESCE(fl.school_id, t.school_id);

-- ============================================================
-- 2. Add created_by_teacher_id column (audit-only, mirrors labs).
--
--    teachers.id = auth.users.id (FK cascade, mig 001), so the same
--    UUID that lives in machine_profiles.teacher_id can be reused as
--    created_by_teacher_id. The FK target changes (auth.users vs
--    teachers) but the values are identical.
-- ============================================================

ALTER TABLE machine_profiles
  ADD COLUMN IF NOT EXISTS created_by_teacher_id UUID
    REFERENCES teachers(id) ON DELETE SET NULL;

-- Backfill: copy teacher_id → created_by_teacher_id for non-templates.
-- Only update where the value is actually different to keep updated_at
-- noise low. (Templates: teacher_id IS NULL, created_by stays NULL.)
UPDATE machine_profiles
SET created_by_teacher_id = teacher_id
WHERE is_system_template = false
  AND teacher_id IS NOT NULL
  AND created_by_teacher_id IS DISTINCT FROM teacher_id;

CREATE INDEX IF NOT EXISTS idx_machine_profiles_created_by
  ON machine_profiles(created_by_teacher_id);

-- ============================================================
-- 3. CHECK constraint: non-templates must now have school_id.
--
--    Idempotent via DO block — Postgres has no IF NOT EXISTS for
--    table constraints (as of 15.x). NOT VALID on add (cheap, only
--    new INSERTs/UPDATEs check), then VALIDATE in the same block to
--    retro-check existing rows.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'machine_profile_school_for_non_template'
      AND conrelid = 'machine_profiles'::regclass
  ) THEN
    ALTER TABLE machine_profiles
      ADD CONSTRAINT machine_profile_school_for_non_template
      CHECK (is_system_template = true OR school_id IS NOT NULL)
      NOT VALID;

    ALTER TABLE machine_profiles
      VALIDATE CONSTRAINT machine_profile_school_for_non_template;
  END IF;
END $$;

-- ============================================================
-- 4. Replace teacher-scoped indexes with school-scoped + lab-scoped.
-- ============================================================

DROP INDEX IF EXISTS idx_machine_profiles_teacher_id;
DROP INDEX IF EXISTS uq_machine_profiles_teacher_name;
DROP INDEX IF EXISTS idx_machine_profiles_teacher_lab_name_active;

CREATE INDEX IF NOT EXISTS idx_machine_profiles_school_id
  ON machine_profiles(school_id)
  WHERE school_id IS NOT NULL;

-- Lab-scoped uniqueness: same lab can't have two active machines with
-- the same name. Multi-teacher safe (any teacher at the school manages
-- the lab's machines as a unified pool). Templates excluded — they're
-- globally unique by `uq_machine_profiles_system_template_name` (mig 093).
-- Orphan machines (lab_id IS NULL) excluded — the partial predicate
-- skips NULL by definition.
CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_profiles_lab_name_active
  ON machine_profiles(lab_id, name)
  WHERE is_active = true
    AND is_system_template = false
    AND lab_id IS NOT NULL;

-- ============================================================
-- 5. Replace RLS policies with school-scoped versions.
--
--    Service role bypasses RLS (orchestration layer uses createAdminClient).
--    Authenticated teachers see + manage machines whose school_id
--    matches current_teacher_school_id() — flat membership, mirrors
--    fabrication_labs RLS.
-- ============================================================

-- SELECT: templates visible to all + school-scoped non-templates
DROP POLICY IF EXISTS machine_profiles_select_teacher ON machine_profiles;
CREATE POLICY machine_profiles_select_teacher
  ON machine_profiles
  FOR SELECT
  USING (
    is_system_template = true
    OR school_id = current_teacher_school_id()
  );

-- INSERT: teacher creates non-templates into their own school
DROP POLICY IF EXISTS machine_profiles_insert_teacher ON machine_profiles;
CREATE POLICY machine_profiles_insert_teacher
  ON machine_profiles
  FOR INSERT
  WITH CHECK (
    is_system_template = false
    AND school_id = current_teacher_school_id()
  );

-- UPDATE: teacher updates non-templates within their school
DROP POLICY IF EXISTS machine_profiles_update_teacher ON machine_profiles;
CREATE POLICY machine_profiles_update_teacher
  ON machine_profiles
  FOR UPDATE
  USING (
    is_system_template = false
    AND school_id = current_teacher_school_id()
  )
  WITH CHECK (
    is_system_template = false
    AND school_id = current_teacher_school_id()
  );

-- DELETE: teacher deletes non-templates within their school
--   (orchestration soft-deletes via UPDATE is_active = false; the
--    DELETE policy is here for completeness + admin-tool use)
DROP POLICY IF EXISTS machine_profiles_delete_teacher ON machine_profiles;
CREATE POLICY machine_profiles_delete_teacher
  ON machine_profiles
  FOR DELETE
  USING (
    is_system_template = false
    AND school_id = current_teacher_school_id()
  );

-- ============================================================
-- 6. Post-apply verification (run as separate queries):
--
--   -- Every non-template should have school_id NOT NULL after backfill:
--   SELECT COUNT(*) FROM machine_profiles
--    WHERE is_system_template = false AND school_id IS NULL;
--   -- expect: 0
--
--   -- Every non-template should have created_by_teacher_id matching teacher_id:
--   SELECT COUNT(*) FROM machine_profiles
--    WHERE is_system_template = false
--      AND created_by_teacher_id IS DISTINCT FROM teacher_id;
--   -- expect: 0
--
--   -- 4 RLS policies on machine_profiles, all school-scoped:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename='machine_profiles';
--   -- expect 4 rows: select_teacher, insert_teacher, update_teacher, delete_teacher
--
--   -- New indexes present:
--   SELECT indexname FROM pg_indexes WHERE tablename='machine_profiles'
--    AND indexname IN ('idx_machine_profiles_school_id',
--                      'idx_machine_profiles_created_by',
--                      'uq_machine_profiles_lab_name_active');
--   -- expect 3 rows
-- ============================================================
