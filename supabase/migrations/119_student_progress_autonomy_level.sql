-- Migration 119: student_progress.autonomy_level
--
-- Adds a per-(student,page) pedagogical scaffolding preference, set by the
-- AutonomyPicker on the Lesson Bold page. Three values:
--   - 'scaffolded'   → "Show me the path" (hints auto-open, examples expanded)
--   - 'balanced'     → "Keep hints nearby" (hints behind try-first button,
--                       examples behind <details> — current behaviour)
--   - 'independent'  → "I want to drive" (no hints, no examples)
--
-- Lesson #38: NO DEFAULT, NO NOT NULL, NO BACKFILL.
--   - DEFAULT 'pending'-style ergonomics would have shadowed any future
--     conditional UPDATE on existing rows. Not an issue today (no backfill
--     planned), but the pattern is the trap, so we avoid it.
--   - NULL passes the CHECK constraint automatically (NULL → unknown → pass)
--     and is the explicit "not yet picked" sentinel. The UI resolves NULL to
--     'balanced' for display; storage stays accurate to user intent.
--   - No backfill: existing student_progress rows stay NULL. The next time
--     the student opens a lesson and clicks a card, the column populates.
--
-- Numbering note: 112 was free at the time of writing but Matt picked 116 to
-- sit above other parallel branches in flight (preflight 113/114, dashboard
-- 115). Sub-Phase 3 of the Lesson Bold build —
-- see docs/projects/lesson-bold-brief.md.

ALTER TABLE student_progress
  ADD COLUMN IF NOT EXISTS autonomy_level TEXT
  CHECK (autonomy_level IN ('scaffolded', 'balanced', 'independent'));

-- No index. Reads of this column are always row-scoped (single page lookup
-- via the existing student_id + page_id index). No analytics aggregation
-- planned in this phase.
