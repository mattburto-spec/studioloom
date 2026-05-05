-- Rollback: activity_three_field_prompt
-- Pairs with: 20260504020826_activity_three_field_prompt.sql
-- Project: Lesson Quality Lever 1 — Slot Fields (sub-phase 1B)
--
-- ───────────────────────────────────────────────────────────────────────────
-- WARNING
-- ───────────────────────────────────────────────────────────────────────────
--
-- Safe to run BEFORE sub-phase 1C populates production data via the
-- backfill script.
--
-- DESTRUCTIVE ONCE 1C HAS RUN — dropping these columns loses the split
-- legacy prompts. The original `prompt` column is preserved (1C never
-- touches it), so the data isn't *lost*-lost — but every existing row
-- would need to be re-split via the heuristic again.
--
-- Also DESTRUCTIVE if teachers have authored new content via the
-- three-box editor (1F) — those rows have new content in framing/task/
-- success_signal that has no representation in the legacy prompt column.
--
-- Use only as part of an explicit rollback plan, not as routine cleanup.

ALTER TABLE activity_blocks
  DROP COLUMN IF EXISTS framing,
  DROP COLUMN IF EXISTS task,
  DROP COLUMN IF EXISTS success_signal,
  DROP COLUMN IF EXISTS backfill_needs_review;
