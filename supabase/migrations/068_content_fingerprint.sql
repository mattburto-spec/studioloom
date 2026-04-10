-- Migration 068: content_fingerprint on activity_blocks
--
-- Closes Phase 1.5 item 10 of docs/projects/dimensions3-completion-spec.md.
-- Adds a deterministic content_fingerprint column to activity_blocks so the
-- ingestion pipeline can detect (and the commit route can deduplicate)
-- semantically identical rows that survive file-level dedup but represent
-- the same activity content.
--
-- Fingerprint = sha256(normalise(title) + '\n' + normalise(prompt) + '\n' + source_type)
--
-- Normalisation rules (mirrored in src/lib/ingestion/fingerprint.ts so JS
-- and SQL produce the same value):
--   1. lowercase
--   2. collapse all whitespace runs to a single space
--   3. trim leading + trailing whitespace
--   4. strip trailing punctuation (.,;:!?)
--
-- The PRIMARY KEY (activity_blocks.id) is unchanged — it stays a random
-- UUID. content_fingerprint is a SECONDARY uniqueness key, used by the
-- commit route's ON CONFLICT clause.
--
-- Lesson #37 (fail-loud verify): the DO block at the bottom RAISEs if any
-- row is left with a NULL content_fingerprint after backfill. The unique
-- constraint is added AFTER the verify so a hidden duplicate doesn't
-- silently kill the migration in the constraint step instead of the
-- semantically meaningful place.
--
-- Lesson #24 (PostgREST 400 on unknown columns): no explicit .select()
-- list in the codebase currently references content_fingerprint, so no
-- code change is required for the column to be readable. The commit
-- route will be updated in the same Phase 1.5 item 10 commit to write to
-- this column.
--
-- Schema-drift note: the Phase 1.5 spec line refers to an
-- `is_copyright_flagged` boolean (item 6) that does not exist in the
-- schema — the audit doc and the live schema have drifted. Item 6 reused
-- the existing `copyright_flag` enum. Logged here for the next saveme.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. activity_blocks.content_fingerprint
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE activity_blocks
  ADD COLUMN IF NOT EXISTS content_fingerprint TEXT;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Backfill — derive fingerprint for every existing row
-- ─────────────────────────────────────────────────────────────────────────
--
-- The PL/pgSQL pipeline below mirrors the JS normalisation in
-- src/lib/ingestion/fingerprint.ts:
--   regexp_replace(lower(text), '\s+', ' ', 'g')   -- collapse whitespace
--   trim(...)                                       -- strip leading/trailing
--   regexp_replace(..., '[.,;:!?]+$', '', 'g')      -- strip trailing punctuation
--
-- pgcrypto's digest() returns bytea; encode(..., 'hex') matches Node's
-- crypto.createHash('sha256').digest('hex'). pgcrypto is included in the
-- standard Supabase image; no CREATE EXTENSION needed at this point —
-- migration 060 already uses gen_random_uuid().

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE activity_blocks
SET content_fingerprint = encode(
  digest(
    regexp_replace(
      trim(regexp_replace(lower(coalesce(title, '')), '\s+', ' ', 'g')),
      '[.,;:!?]+$', '', 'g'
    )
    || E'\n'
    || regexp_replace(
      trim(regexp_replace(lower(coalesce(prompt, '')), '\s+', ' ', 'g')),
      '[.,;:!?]+$', '', 'g'
    )
    || E'\n'
    || coalesce(source_type, ''),
    'sha256'
  ),
  'hex'
)
WHERE content_fingerprint IS NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Lesson #37 — verify query
-- ─────────────────────────────────────────────────────────────────────────
-- Fail loudly if any row slipped through the backfill.

DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM activity_blocks
  WHERE content_fingerprint IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Migration 068 backfill failed: % activity_blocks row(s) still have NULL content_fingerprint. Resolve manually before re-running.',
      orphan_count;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. NOT NULL + UNIQUE constraint
-- ─────────────────────────────────────────────────────────────────────────
--
-- If duplicate fingerprints already exist (e.g. the same teaching move
-- inserted twice across two seed runs), this constraint creation will
-- fail. The error message will name the duplicate fingerprint — resolve
-- by deleting the duplicate row(s) before re-running the migration.

ALTER TABLE activity_blocks
  ALTER COLUMN content_fingerprint SET NOT NULL;

ALTER TABLE activity_blocks
  ADD CONSTRAINT activity_blocks_content_fingerprint_key
  UNIQUE (content_fingerprint);

CREATE INDEX IF NOT EXISTS idx_activity_blocks_content_fingerprint
  ON activity_blocks(content_fingerprint);
