-- Rollback for: fix_handle_new_teacher_skip_students
-- Pairs with: 20260501103415_fix_handle_new_teacher_skip_students.sql
--
-- Restores the original handle_new_teacher trigger function (no
-- user_type guard). Cannot restore the deleted teacher rows since they
-- had zero associated data — equivalent to "do nothing".
-- Re-running the original trigger on the next student auth.users insert
-- would re-create the leak.

CREATE OR REPLACE FUNCTION handle_new_teacher()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO teachers (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
