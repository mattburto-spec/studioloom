-- Migration 013: Fix overly permissive RLS policy on units table
-- Previously: "Service role manages units" allowed ANY authenticated user to write/delete any unit.
-- Now: INSERT open to authenticated, UPDATE/DELETE restricted to author (or unowned drafts).

DROP POLICY IF EXISTS "Service role manages units" ON units;

-- Any authenticated teacher can create units
CREATE POLICY "Teachers insert units"
  ON units FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only the author can update (OR unowned drafts during transition)
CREATE POLICY "Authors update own units"
  ON units FOR UPDATE
  USING (author_teacher_id = auth.uid() OR author_teacher_id IS NULL);

-- Only the author can delete (OR unowned drafts during transition)
CREATE POLICY "Authors delete own units"
  ON units FOR DELETE
  USING (author_teacher_id = auth.uid() OR author_teacher_id IS NULL);
