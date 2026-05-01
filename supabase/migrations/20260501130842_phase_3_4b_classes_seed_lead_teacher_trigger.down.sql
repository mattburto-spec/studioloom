-- Rollback for: phase_3_4b_classes_seed_lead_teacher_trigger
-- Pairs with: 20260501130842_phase_3_4b_classes_seed_lead_teacher_trigger.sql
--
-- Drops the AFTER-INSERT trigger on classes + its function. New classes
-- created post-rollback no longer auto-seed a class_members.lead_teacher
-- row. has_class_role(?, 'lead_teacher') will regress to false for those
-- class owners until a manual backfill runs.
--
-- Existing class_members rows (Phase 0.8a backfill + any rows created
-- by the trigger before rollback) remain untouched. No data loss.

DROP TRIGGER IF EXISTS seed_lead_teacher_on_class_insert ON classes;
DROP FUNCTION IF EXISTS public.classes_seed_lead_teacher_membership();
