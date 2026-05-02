-- Rollback for: phase_4_3_y_handle_new_teacher_auto_personal_school
-- Pairs with: 20260502105711_phase_4_3_y_handle_new_teacher_auto_personal_school.sql
--
-- Restores the May-2 body (Lesson #66 fix — search_path + public.teachers
-- but no auto-personal-school logic). Future teacher signups will go back
-- to having school_id = NULL (Decision 2 implementation gap).
--
-- WARNING: rolling back means /teacher/welcome step-3 create-class will
-- fail with 'Teacher missing school context' for every fresh teacher.
-- Only roll back if the auto-personal-school logic itself causes a
-- regression we need to bisect.
--
-- Personal schools already created by the new trigger PERSIST after
-- rollback. Those rows belong to real teachers — Phase 4 super-admin
-- tooling can clean them up later if needed.

CREATE OR REPLACE FUNCTION public.handle_new_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF (NEW.raw_app_meta_data->>'user_type') = 'student' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.teachers (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$function$;
