-- Phase 3.4b — auto-seed class_members.lead_teacher row on class INSERT
--
-- Project: Access Model v2
-- Brief: docs/projects/access-model-v2-phase-3-brief.md §4 Phase 3.4 (compressed)
-- Date: 1 May 2026
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Phase 0.8a backfilled class_members.lead_teacher rows for every class
-- that existed in prod on 28 April. From that point forward, every NEW
-- class also needs a lead_teacher class_members row — otherwise:
--
--   - has_class_role(class_id, 'lead_teacher') returns false for the
--     legitimate owner, locking them out of can() class-scope checks.
--   - The Phase 3.1 migration's backfill assertion will fail next time
--     it's re-run (e.g., a Phase 6 cutover migration that asserts the
--     same invariant).
--   - Phase 4 co-teacher invite UI assumes a lead_teacher row exists
--     to anchor the class_members chain.
--
-- Class INSERTs happen from BOTH server routes
-- (welcome/create-class, welcome/setup-from-timetable) AND client-side
-- pages (teacher/classes/page.tsx, teacher/settings/page.tsx).
-- Adding the seed at every callsite means 5+ edits with race-condition
-- risk; doing it once at the data layer via a trigger establishes the
-- invariant structurally.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - One new SECURITY DEFINER trigger function:
--     public.classes_seed_lead_teacher_membership()
-- - One new AFTER INSERT trigger on classes:
--     seed_lead_teacher_on_class_insert
-- - No data change to existing rows — Phase 0.8a already seeded them.
-- - Idempotent NOT EXISTS guard inside the trigger so backfill replays
--   or unusual race conditions don't double-insert.
--
-- The trigger is SECURITY DEFINER because class_members has RLS that
-- includes a same-school-teacher SELECT policy but NO insert policy —
-- only service-role + this trigger write to it. The trigger function
-- is owned by the postgres role; SECURITY DEFINER runs it with that
-- role's privileges so the INSERT bypasses RLS as intended.
--
-- search_path = public, pg_temp lockdown per Lesson #62 + standard
-- Supabase-Postgres SECURITY DEFINER discipline.
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql DROPs trigger + function. After rollback, new classes
-- created via INSERT no longer auto-seed a lead_teacher row. has_class_role
-- regresses to false for those classes' owners. Pair the rollback with
-- a manual backfill query if any classes were created post-trigger
-- and pre-rollback.

CREATE OR REPLACE FUNCTION public.classes_seed_lead_teacher_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only seed when teacher_id is set. classes.teacher_id is currently
  -- NOT NULL but defensive in case Phase 4+ allows nullable transfers.
  IF NEW.teacher_id IS NOT NULL THEN
    INSERT INTO class_members (class_id, member_user_id, role, accepted_at)
    SELECT NEW.id, NEW.teacher_id, 'lead_teacher', now()
    WHERE NOT EXISTS (
      SELECT 1 FROM class_members
      WHERE class_id = NEW.id
        AND member_user_id = NEW.teacher_id
        AND role = 'lead_teacher'
        AND removed_at IS NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.classes_seed_lead_teacher_membership() IS
  'Phase 3.4b — AFTER-INSERT trigger fn that auto-creates a class_members.lead_teacher row for the classes.teacher_id. Idempotent NOT EXISTS guard. SECURITY DEFINER bypasses class_members RLS (which has no INSERT policy by design — service role + this trigger only).';

REVOKE EXECUTE ON FUNCTION public.classes_seed_lead_teacher_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.classes_seed_lead_teacher_membership() TO authenticated, service_role;

CREATE TRIGGER seed_lead_teacher_on_class_insert
  AFTER INSERT ON classes
  FOR EACH ROW
  EXECUTE FUNCTION public.classes_seed_lead_teacher_membership();

COMMENT ON TRIGGER seed_lead_teacher_on_class_insert ON classes IS
  'Phase 3.4b — establishes structural invariant: every classes row with teacher_id IS NOT NULL has a matching class_members.lead_teacher (active) row. Pairs with Phase 0.8a backfill which seeded the historical rows.';

-- Sanity check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'seed_lead_teacher_on_class_insert'
      AND tgrelid = 'public.classes'::regclass
  ) THEN
    RAISE EXCEPTION 'Migration failed: trigger seed_lead_teacher_on_class_insert missing';
  END IF;
  RAISE NOTICE 'Migration phase_3_4b_classes_seed_lead_teacher_trigger applied OK';
END $$;
