-- Rollback for: fix_handle_new_teacher_check_user_metadata_bucket
-- Pairs with: 20260516044909_fix_handle_new_teacher_check_user_metadata_bucket.sql
--
-- WARNING: rolling back re-opens the Lesson #92 trigger bug. Every new
-- student provisioned via auth.admin.createUser will create a phantom
-- teacher row again because the guard checks raw_app_meta_data which
-- gotrue late-binds AFTER the trigger fires.
--
-- Restores the 11 May handpatch body (single-bucket guard).

CREATE OR REPLACE FUNCTION public.handle_new_teacher()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Skip student auth.users rows (Lesson #65)
  IF (NEW.raw_app_meta_data->>'user_type') = 'student' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.teachers (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email::text, '@', 1)),
    NEW.email::text
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'handle_new_teacher failed: %', SQLERRM;
    RETURN NEW;
END;
$$;
