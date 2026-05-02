-- Rollback for: phase_4_3_x_fix_handle_new_teacher_search_path
-- Pairs with: 20260502102745_phase_4_3_x_fix_handle_new_teacher_search_path.sql
--
-- WARNING: rolling back restores the May-1 BROKEN body (no search_path,
-- unqualified table reference). Email/password teacher signups will
-- fail again with `relation "teachers" does not exist`.
--
-- Only run this if you need to bisect a future regression. NOT for
-- production use.

CREATE OR REPLACE FUNCTION public.handle_new_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF (NEW.raw_app_meta_data->>'user_type') = 'student' THEN
    RETURN NEW;
  END IF;

  INSERT INTO teachers (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$function$;
