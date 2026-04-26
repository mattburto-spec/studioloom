-- Migration: word_definitions_cache
-- Created: 20260426140609 UTC
--
-- WHY: Tap-a-word v1 (language-scaffolding-redesign Phase 1A) needs a
-- class-shared cache for student-friendly word definitions. First student
-- in a class to look up a given word triggers an Anthropic Haiku call
-- (~250 tokens, ~$0.0001); subsequent students hit the cache for free.
-- Definitions are public-domain content (no PII) so the cache is shared
-- across the entire platform, not scoped per-student or per-class.
--
-- IMPACT: New table `word_definitions` with composite PK + RLS policy
-- allowing SELECT for anon + authenticated. No INSERT/UPDATE/DELETE
-- policies — writes go through the API route via createAdminClient()
-- (service_role) which bypasses RLS. anon + authenticated have no write
-- grants on this table by default; absence of a write policy denies
-- writes for those roles.
--
-- ROLLBACK: paired .down.sql drops the policy then the table.
--
-- PHASE 1 SHAPE: language='en', context_hash='', l1_target='en' on
-- every row. The composite PK supports Phase 2 expansion (per-student
-- L1 translations + context-aware polysemy disambiguation via the
-- context_hash slot) without schema change.
--
-- LESSON #51: no DO $$ DECLARE ... $$ verify block — variable names
-- could collide with the Supabase dashboard's "Run and enable RLS"
-- parser. Verify queries below are runnable post-apply as plain SELECTs.
-- LESSON #52: not applicable here (no CREATE FUNCTION) but the pattern
-- to remember is REVOKE EXECUTE FROM PUBLIC, anon, authenticated for any
-- future RPC.

CREATE TABLE IF NOT EXISTS word_definitions (
  word              TEXT NOT NULL,
  language          TEXT NOT NULL DEFAULT 'en',
  context_hash      TEXT NOT NULL DEFAULT '',
  l1_target         TEXT NOT NULL DEFAULT 'en',
  definition        TEXT NOT NULL,
  l1_translation    TEXT,
  example_sentence  TEXT,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (word, language, context_hash, l1_target)
);

ALTER TABLE word_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY word_definitions_read
  ON word_definitions
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Post-apply verify (run as plain SELECTs in the Supabase SQL editor):
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'word_definitions';
--     -- Expected: t
--   SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'word_definitions'::regclass;
--     -- Expected: word_definitions_read | r (SELECT)
--   SELECT count(*) FROM word_definitions;
--     -- Expected: 0 (empty on first apply; pre-warm seed lands in Phase 1C)
