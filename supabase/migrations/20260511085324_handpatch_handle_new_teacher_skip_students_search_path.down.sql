-- Rollback for: handpatch_handle_new_teacher_skip_students_search_path
-- Pairs with: 20260511085324_handpatch_handle_new_teacher_skip_students_search_path.sql
--
-- Restores migration-001's original handle_new_teacher() body. WARNING:
-- this re-introduces the bug fixed by the UP migration —
--   - unqualified `teachers` reference will fail under Supabase Auth's
--     search_path (Lesson #65)
--   - no SET search_path on the function (Lesson #66)
--   - no EXCEPTION WHEN others — trigger failures propagate up
--   - no user_type='student' guard — student auth.users inserts will
--     attempt INSERT into teachers and either fail (search_path) or
--     create phantom rows.
--
-- Down only exists for completeness. Do not run in prod unless you have
-- a very specific reason to revert.

CREATE OR REPLACE FUNCTION public.handle_new_teacher()
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
