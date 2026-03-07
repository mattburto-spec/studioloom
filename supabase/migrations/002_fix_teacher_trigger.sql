-- Fix the teacher profile trigger to handle edge cases

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_teacher();

CREATE OR REPLACE FUNCTION handle_new_teacher()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.teachers (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email::text, '@', 1)
    ),
    NEW.email::text
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'handle_new_teacher failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_teacher();
