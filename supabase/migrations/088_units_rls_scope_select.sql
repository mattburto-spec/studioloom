-- Migration 088: Scope units SELECT policy to own + published
--
-- The original policy from 001_initial_schema.sql was:
--   CREATE POLICY "Anyone can read units" ON units FOR SELECT USING (true);
-- This allowed any authenticated user to read ALL units from ALL teachers,
-- including unpublished drafts. This migration replaces it with a policy
-- that restricts SELECT to:
--   1. Units the teacher owns (author_teacher_id OR teacher_id = current user)
--   2. Units that are published (is_published = true) — for the community browse
--
-- Also drops the redundant 007 policy ("Teachers read published units")
-- which is now subsumed by the new combined policy.

-- Drop the overly permissive policy from 001
DROP POLICY IF EXISTS "Anyone can read units" ON units;

-- Drop the redundant 007 policy (published-only subset of the new one)
DROP POLICY IF EXISTS "Teachers read published units" ON units;

-- New scoped policy: own units + published community units
CREATE POLICY "Teachers read own or published units"
  ON units FOR SELECT
  USING (
    author_teacher_id = auth.uid()
    OR teacher_id = auth.uid()
    OR is_published = true
  );
