-- Migration: fix_grading_v1_page_id_type
-- Created: 20260428024002 UTC
--
-- WHY: Migration 20260427133507 created student_tile_grades.page_id as
--   UUID NOT NULL. This is wrong — the canonical page_id format throughout
--   StudioLoom is TEXT (nanoid(8) strings, or letter-prefixed page slugs
--   like 'A1', 'B3'). Pages are computed/dynamic from content_data JSONB,
--   not first-class entities with UUID primary keys. Every other table
--   that references a page (competency_assessments, lesson_intelligence,
--   activity_cards, knowledge_library, student_tool_sessions,
--   portfolio_entries, design_assistant_logs) uses TEXT.
--
--   Audit caught this before any rows were inserted into
--   student_tile_grades, so the change is a no-op data-wise.
--
--   Mirrors migration 032_fix_nm_page_id_type.sql (same correction was
--   needed on competency_assessments after migration 030 made the same
--   mistake — pattern bug, fixed twice now).
--
-- IMPACT: ALTER COLUMN TYPE on student_tile_grades.page_id (UUID → TEXT).
--   The UNIQUE(student_id, unit_id, page_id, tile_id, class_id) constraint
--   and its underlying index are rebuilt automatically by Postgres.
--   No other column or constraint depends on page_id's type.
--
-- ROLLBACK: paired .down.sql reverses the type change. Reversal is safe
--   only while the column is empty — once non-UUID TEXT page_ids are
--   written, the down migration's cast back to UUID would fail.

ALTER TABLE student_tile_grades
  ALTER COLUMN page_id TYPE TEXT USING page_id::TEXT;
