-- ============================================================
-- Migration 065: OS seams + student_progress.class_id
-- Phase 0 (Dimensions3 Completion Spec §2.5 + §2.9), 10 Apr 2026
-- ============================================================
--
-- Context:
--   Phase 0.5 (OS migration seams) audit found all 4 seams already
--   in place from earlier migrations:
--     - Seam 1: stateless pass functions — verified in code
--       (src/lib/ingestion/pass-a.ts, pass-b.ts, types.ts)
--     - Seam 2: activity_blocks.module — added in migration 060
--     - Seam 3: content_items (module/pass_results/file_hash/
--       processing_status) — added in migration 063
--     - Seam 4: activity_blocks.media_asset_ids — added in migration 060
--   No schema changes required for Phase 0.5.
--
--   Phase 0.9 (student_progress.class_id) is the sole schema payload
--   of this migration. It closes a long-standing multi-class enrollment
--   gap where student_progress rows could not be disambiguated when the
--   same student was enrolled in multiple classes via class_students.
--
-- ============================================================

-- Phase 0.9 — add class_id to student_progress
ALTER TABLE student_progress
  ADD COLUMN class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

CREATE INDEX idx_student_progress_class
  ON student_progress(class_id, student_id);

-- Backfill: single-class students get auto-linked. Multi-class
-- students stay NULL for manual resolution.
UPDATE student_progress sp
SET class_id = cs.class_id
FROM class_students cs
WHERE sp.student_id = cs.student_id
  AND (
    SELECT COUNT(*) FROM class_students cs2
    WHERE cs2.student_id = sp.student_id
  ) = 1;

-- ============================================================
-- Post-migration ambiguity report (run manually in SQL editor):
--
--   SELECT COUNT(*) AS ambiguous_rows
--   FROM student_progress
--   WHERE class_id IS NULL
--     AND student_id IN (
--       SELECT student_id FROM class_students
--       GROUP BY student_id HAVING COUNT(*) > 1
--     );
--
-- If ambiguous_rows > 0, the operator must resolve manually before
-- Phase 0 is considered complete. Phase 0 spec §2.9 instruction:
-- "If ambiguous_rows > 0, STOP and report the count to Matt".
-- ============================================================
