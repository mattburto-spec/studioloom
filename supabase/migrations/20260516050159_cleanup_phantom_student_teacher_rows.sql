-- Migration: cleanup_phantom_student_teacher_rows
-- Created: 20260516050159 UTC
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Companion cleanup to 20260516044909_fix_handle_new_teacher_check_user_
-- metadata_bucket. That migration closed the trigger bug; this one removes
-- the 53 phantom teacher rows that accumulated between the 11 May handpatch
-- and the 16 May trigger fix.
--
-- The phantoms are public.teachers rows whose email matches the synthetic
-- pattern 'student-<uuid>@students.studioloom.local' — created by the
-- handle_new_teacher trigger fall-through when gotrue's late-bound
-- raw_app_meta_data caused the user_type='student' guard to miss.
--
-- Diagnostic evidence (16 May 2026 prod queries):
--   Q3 — 53 phantom rows total, all post-handpatch
--        (earliest 2026-05-11 08:39, latest 2026-05-14 23:54)
--   Q5 — 0 FK references across ALL 17 columns pointing at teachers(id):
--          CASCADE: classes.teacher_id, ingestion_corrections.teacher_id,
--                   school_invitations.invited_by,
--                   school_responsibilities.teacher_id,
--                   teacher_integrations.teacher_id
--          SET NULL: class_members.invited_by, class_members.removed_by,
--                    content_moderation_log.overridden_by,
--                    fabrication_labs.created_by_teacher_id,
--                    machine_profiles.created_by_teacher_id,
--                    school_invitations.revoked_by,
--                    school_resources.verified_by_teacher_id,
--                    school_responsibilities.granted_by,
--                    student_mentors.granted_by,
--                    student_projects.mentor_teacher_id,
--                    students.author_teacher_id,
--                    units.forked_from_author_id
--   Q5 confirmed: phantoms are pure orphans, safe to DELETE.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - DELETEs ≤53 rows from public.teachers (filtered on synthetic-email pattern).
-- - Does NOT touch auth.users — students keep their logins, profiles,
--   class enrollments, work, briefs, progress.
-- - Does NOT touch public.students — student rows are untouched.
-- - Belt-and-braces: re-runs the full FK-safety check INSIDE the migration
--   body and aborts if any phantom has gained an FK reference between
--   the 16 May Q5 check and the migration apply moment.
-- - Belt-and-braces: hard-asserts the email-pattern filter is the ONLY
--   filter being used, so a typo in a hand-patch can't accidentally
--   delete real teachers.
--
-- The cleanup is independent of the trigger fix: even if applied alone
-- (without the trigger fix), it just empties the phantom queue once. But
-- without the trigger fix, new phantoms would accumulate again. The
-- trigger fix MUST land first. (This migration is timestamp-ordered AFTER
-- it for that reason.)
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql is a documented no-op — phantom rows are pure orphans
-- with no real meaning, and reconstructing them would require pulling
-- auth.users.id values + email + name from the corresponding student
-- auth.users rows. Not implemented because the rows are by definition
-- garbage and rolling back this DELETE would not restore any meaningful
-- state.

DO $$
DECLARE
  v_pre_count INT;
  v_fk_refs   INT;
  v_deleted   INT;
  v_post_count INT;
BEGIN
  -- 1. Capture pre-count for audit trail (RAISE NOTICE goes to Postgres
  --    server log + Supabase SQL Editor output).
  SELECT COUNT(*) INTO v_pre_count
  FROM public.teachers
  WHERE email LIKE 'student-%@students.studioloom.local';

  RAISE NOTICE 'cleanup_phantom_student_teacher_rows: pre-count = %', v_pre_count;

  IF v_pre_count = 0 THEN
    RAISE NOTICE 'No phantom rows to clean up — nothing to do.';
    RETURN;
  END IF;

  -- 2. Belt-and-braces FK-safety re-assertion across ALL 17 FK columns
  --    pointing at public.teachers(id). If ANY phantom has gained a real
  --    cross-table reference between the 16 May Q5 check and now,
  --    abort — do NOT silently delete + cascade/null those refs.
  --
  --    Lesson #65 safety pattern, extended to the full FK enumeration
  --    found via information_schema.referential_constraints (16 May 2026).
  SELECT COUNT(*) INTO v_fk_refs
  FROM public.teachers t
  WHERE t.email LIKE 'student-%@students.studioloom.local'
    AND (
      -- CASCADE columns
         (SELECT COUNT(*) FROM public.classes WHERE teacher_id = t.id) > 0
      OR (SELECT COUNT(*) FROM public.ingestion_corrections WHERE teacher_id = t.id) > 0
      OR (SELECT COUNT(*) FROM public.school_invitations WHERE invited_by = t.id) > 0
      OR (SELECT COUNT(*) FROM public.school_responsibilities WHERE teacher_id = t.id) > 0
      OR (SELECT COUNT(*) FROM public.teacher_integrations WHERE teacher_id = t.id) > 0
      -- SET NULL columns
      OR (SELECT COUNT(*) FROM public.class_members WHERE invited_by = t.id) > 0
      OR (SELECT COUNT(*) FROM public.class_members WHERE removed_by = t.id) > 0
      OR (SELECT COUNT(*) FROM public.content_moderation_log WHERE overridden_by = t.id) > 0
      OR (SELECT COUNT(*) FROM public.fabrication_labs WHERE created_by_teacher_id = t.id) > 0
      OR (SELECT COUNT(*) FROM public.machine_profiles WHERE created_by_teacher_id = t.id) > 0
      OR (SELECT COUNT(*) FROM public.school_invitations WHERE revoked_by = t.id) > 0
      OR (SELECT COUNT(*) FROM public.school_resources WHERE verified_by_teacher_id = t.id) > 0
      OR (SELECT COUNT(*) FROM public.school_responsibilities WHERE granted_by = t.id) > 0
      OR (SELECT COUNT(*) FROM public.student_mentors WHERE granted_by = t.id) > 0
      OR (SELECT COUNT(*) FROM public.student_projects WHERE mentor_teacher_id = t.id) > 0
      OR (SELECT COUNT(*) FROM public.students WHERE author_teacher_id = t.id) > 0
      OR (SELECT COUNT(*) FROM public.units WHERE forked_from_author_id = t.id) > 0
    );

  IF v_fk_refs > 0 THEN
    RAISE EXCEPTION 'cleanup_phantom_student_teacher_rows: FK-safety FAILED — % phantom rows have cross-table references that would be CASCADEd or SET NULLed by this DELETE. Migration aborted. Run the Q5 FK-safety query manually to enumerate which rows + columns have refs, then decide row-by-row.', v_fk_refs;
  END IF;

  -- 3. Belt-and-braces: assert the only filter we're about to apply is
  --    the synthetic-email pattern. (Documentary — forces a future
  --    maintainer to read this paragraph before broadening the filter.)
  --
  -- The DELETE we are about to run:
  --     DELETE FROM public.teachers
  --     WHERE email LIKE 'student-%@students.studioloom.local'
  --
  -- Filter narrowness: 'student-' prefix + '@students.studioloom.local'
  -- suffix is the EXACT shape produced by syntheticEmailForStudentId() in
  -- src/lib/access-v2/provision-student-auth-user.ts. Real teachers
  -- never have this email shape (real signups go through the teacher
  -- onboarding flow with their school/personal email).

  -- 4. Run the DELETE.
  DELETE FROM public.teachers
  WHERE email LIKE 'student-%@students.studioloom.local';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RAISE NOTICE 'cleanup_phantom_student_teacher_rows: deleted % phantom rows', v_deleted;

  -- 5. Post-condition: zero phantom rows remaining.
  SELECT COUNT(*) INTO v_post_count
  FROM public.teachers
  WHERE email LIKE 'student-%@students.studioloom.local';

  IF v_post_count <> 0 THEN
    RAISE EXCEPTION 'cleanup_phantom_student_teacher_rows: post-cleanup count is % (expected 0). Aborting transaction.', v_post_count;
  END IF;

  RAISE NOTICE 'cleanup_phantom_student_teacher_rows: complete — pre=% deleted=% post=0', v_pre_count, v_deleted;
END $$;
