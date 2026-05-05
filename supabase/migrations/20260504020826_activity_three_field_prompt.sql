-- Migration: activity_three_field_prompt
-- Created: 20260504020826 UTC
-- Project: Lesson Quality Lever 1 — Slot Fields (sub-phase 1B)
-- Brief:   docs/projects/lesson-quality-lever-1-slot-fields.md
-- Style:   docs/specs/lesson-content-style-guide-v2-draft.md
--
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
-- ───────────────────────────────────────────────────────────────────────────
--
-- Activity prompts are currently a single `prompt TEXT NOT NULL` column.
-- The LLM has no structural pressure to separate the orient/task/signal
-- beats — it writes one prose blob. The Bad Example in the v2 style
-- guide (130 words packed into one activity, embedded "TASK 1 / TASK 2"
-- headings, table that drops, success signal buried in line 12) is the
-- canonical output today.
--
-- This migration adds three structured slot columns to activity_blocks:
--   - framing         (one-sentence orient)
--   - task            (the imperative body)
--   - success_signal  (what students produce so they know they're done)
--
-- Plus a backfill flag for sub-phase 1C:
--   - backfill_needs_review (true when the heuristic split was ambiguous)
--
-- The legacy `prompt` column STAYS for the entire transition window. It
-- is the fallback for the renderer when all three slots are null. Removal
-- is out of scope for Lever 1 — gated behind 30 days of green prod
-- dashboard health, gets its own future phase.
--
-- ───────────────────────────────────────────────────────────────────────────
-- IMPACT
-- ───────────────────────────────────────────────────────────────────────────
--
-- - activity_blocks.framing                TEXT (nullable)
-- - activity_blocks.task                   TEXT (nullable)
-- - activity_blocks.success_signal         TEXT (nullable)
-- - activity_blocks.backfill_needs_review  BOOLEAN NOT NULL DEFAULT false
-- - activity_blocks.prompt                 unchanged (still NOT NULL)
-- - content_fingerprint                    unchanged (1C must NOT recompute)
-- - No new indexes (slot fields are not search dimensions in v1)
-- - No RLS policy changes (additive nullable columns inherit existing
--   read/write policies on the row)
-- - No FK changes
--
-- Surface A (units.content_data JSONB → pages[].content.sections[]) is
-- NOT touched by this migration. The TypeScript ActivitySection type
-- gains the same three optional fields in the application layer (1D);
-- JSONB is schema-on-read so no DDL is required for that surface.
--
-- ───────────────────────────────────────────────────────────────────────────
-- PRE-FLIGHT (verify before applying to prod)
-- ───────────────────────────────────────────────────────────────────────────
--
-- 1. SELECT count(*) FROM activity_blocks;
--    → expect ~62 rows (4 May 2026 baseline; verify before applying)
--
-- 2. SELECT count(*) FROM activity_blocks
--    WHERE framing IS NOT NULL OR task IS NOT NULL
--      OR success_signal IS NOT NULL OR backfill_needs_review = true;
--    → expect 0 (columns don't exist yet)
--
-- 3. The four ADDs are pure metadata — additive nullable columns + one
--    nullable-via-default boolean. No row data is touched.
--
-- ───────────────────────────────────────────────────────────────────────────
-- VERIFY (per Lesson #38 — assert exact values, not just non-null)
-- ───────────────────────────────────────────────────────────────────────────
--
-- After APPLY in Supabase SQL Editor, run this sandbox round-trip:
--
--   -- 1. Insert a sandbox row with all three slots
--   INSERT INTO activity_blocks (
--     teacher_id, title, source_type, prompt,
--     framing, task, success_signal
--   ) VALUES (
--     (SELECT id FROM auth.users LIMIT 1),  -- any teacher
--     'LEVER-1-SANDBOX',
--     'manual',
--     'legacy prompt body',
--     'F',
--     'T',
--     'S'
--   ) RETURNING id, framing, task, success_signal, backfill_needs_review;
--
--   -- Assert: framing='F', task='T', success_signal='S',
--            backfill_needs_review=false
--
--   -- 2. Confirm fingerprint is unchanged for the existing 62 rows
--   SELECT count(DISTINCT content_fingerprint) FROM activity_blocks
--   WHERE content_fingerprint IS NOT NULL;
--   -- Assert: same as pre-migration count (1C must not change this)
--
--   -- 3. Cleanup the sandbox row
--   DELETE FROM activity_blocks WHERE title = 'LEVER-1-SANDBOX';
--
-- ───────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ───────────────────────────────────────────────────────────────────────────
--
-- Paired .down.sql DROPs the four columns. Safe to roll back as long as
-- 1C backfill has not yet populated production data — once teachers have
-- edited the new fields via the editor, rollback is destructive.

ALTER TABLE activity_blocks
  ADD COLUMN IF NOT EXISTS framing TEXT,
  ADD COLUMN IF NOT EXISTS task TEXT,
  ADD COLUMN IF NOT EXISTS success_signal TEXT,
  ADD COLUMN IF NOT EXISTS backfill_needs_review BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN activity_blocks.framing IS
  'Lever 1 slot field — one-sentence orient (≤30 words / ≤200 chars). What students are doing and why it matters today. NULL during transition window; renderer falls back to prompt when all three slot fields are null.';

COMMENT ON COLUMN activity_blocks.task IS
  'Lever 1 slot field — imperative body of the activity (≤800 chars). Bulleted/numbered list if multiple steps. The actual work students do.';

COMMENT ON COLUMN activity_blocks.success_signal IS
  'Lever 1 slot field — what students produce/record/submit (≤200 chars). One short sentence so students know when they''re done. Renderer prefixes with 🎯 + bold weight per the hybrid composition spec.';

COMMENT ON COLUMN activity_blocks.backfill_needs_review IS
  'Lever 1 sub-phase 1C heuristic backfill flag. true when the heuristic could not split the legacy prompt cleanly into framing/task/success_signal — teacher review required. Default false. Set by scripts/backfill/split-activity-prompts.ts.';
