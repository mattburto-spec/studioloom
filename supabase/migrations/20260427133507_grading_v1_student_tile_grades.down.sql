-- Rollback for: grading_v1_student_tile_grades
-- Pairs with: 20260427133507_grading_v1_student_tile_grades.sql
--
-- Drops the two new tables and the helper trigger function.
--
-- The units.content_data backfill is intentionally NOT reversed. Once any
-- student_tile_grades row references a minted activityId / id, removing those
-- IDs from content_data orphans real grade data — strictly worse than leaving
-- them in place. The backfilled IDs are property-correct (every tile has a
-- stable identifier) regardless of whether this table exists, so leaving them
-- post-rollback is safe.
--
-- See docs/decisions-log.md (entry: 27 Apr 2026, grading G1) for the full
-- rationale.

DROP TABLE IF EXISTS student_tile_grade_events;
DROP TABLE IF EXISTS student_tile_grades;

DROP FUNCTION IF EXISTS update_student_tile_grades_updated_at();
