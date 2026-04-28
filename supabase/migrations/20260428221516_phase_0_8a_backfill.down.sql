-- Rollback for: phase_0_8a_backfill
-- Pairs with: 20260428221516_phase_0_8a_backfill.sql
-- Phase: Access Model v2 Phase 0.8a
--
-- LIMITATION: this is a best-effort undo. Fully reversing the
-- personal-school cascade requires identifying which schools were
-- created by THIS migration vs other paths — there's no migration
-- audit column on schools. The down script makes the simplest
-- possible reversal:
--
--   1. NULL out class_members rows that match the seed pattern
--      (role='lead_teacher', invited_at IS NULL, member matches
--      classes.teacher_id) — only deletes rows that look like seeds.
--   2. Does NOT undo the orphan-teacher → personal-school links —
--      those would need manual cleanup based on the (Personal School)
--      naming suffix.
--
-- If you need a real rollback, restore from the Supabase backup
-- taken before applying 0.8a.

DELETE FROM class_members
WHERE role = 'lead_teacher'
  AND invited_at IS NULL
  AND removed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM classes c
    WHERE c.id = class_members.class_id
      AND c.teacher_id = class_members.member_user_id
  );

-- Personal-school + teachers.school_id changes are NOT reversed here.
-- See LIMITATION comment above. Manual cleanup pattern:
--
--   SELECT id, name FROM schools WHERE name LIKE '% (Personal School)';
--   -- inspect, then for each teacher you want to detach:
--   UPDATE teachers SET school_id = NULL WHERE school_id IN (...);
--   DELETE FROM schools WHERE id IN (...);
