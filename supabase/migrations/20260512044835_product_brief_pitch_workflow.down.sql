-- Rollback for: product_brief_pitch_workflow
-- Pairs with: 20260512044835_product_brief_pitch_workflow.sql
--
-- SAFETY GUARD: refuses if any row has pitch_text set (= student work).

DO $$
DECLARE
  v_with_work_count INT;
BEGIN
  SELECT COUNT(*) INTO v_with_work_count
  FROM student_unit_product_briefs
  WHERE pitch_text IS NOT NULL;

  IF v_with_work_count > 0 THEN
    RAISE EXCEPTION
      'Refusing rollback: % student_unit_product_briefs row(s) have pitch_text set. '
      'This is student work. UPDATE student_unit_product_briefs SET pitch_text = NULL first if '
      'this is intentional.',
      v_with_work_count;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_product_briefs_pitch_status_pending;
ALTER TABLE student_unit_product_briefs
  DROP CONSTRAINT IF EXISTS product_briefs_pitch_status_chk;
ALTER TABLE student_unit_product_briefs
  DROP COLUMN IF EXISTS pitch_text,
  DROP COLUMN IF EXISTS pitch_status,
  DROP COLUMN IF EXISTS pitch_teacher_note,
  DROP COLUMN IF EXISTS pitch_decided_at,
  DROP COLUMN IF EXISTS pitch_decided_by;
