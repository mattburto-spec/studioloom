-- Migration: task_system_v1_schema
-- Created: 20260505032750 UTC
-- Phase: TG.0B — Task System Architecture v1 schema
--
-- WHY: Locks the unified architecture for gradeable events per
--   docs/projects/task-system-architecture.md (PR #23, signed off
--   5 May 2026 + TG.0A pre-flight findings absorbed via PR #29).
--   Replaces the half-shipped G1 grading work; unblocks Lever 0
--   (manual unit designer) which can now emit assessment_tasks
--   rows natively from day one.
--
--   Per OQ-2 sign-off: NO BACKFILL. Existing single-grade-per-unit
--   data is dummy/test data on dummy accounts; gets deleted in TG.0K.
--   This migration is PURELY ADDITIVE — no data migration, no row
--   transformation. Just new tables + 1 ALTER on assessment_records.
--
-- IMPACT (per brief §Data model + TG.0A F1 amendment):
--   6 NEW tables:
--     1. assessment_tasks         — unified primitive (formative | summative | peer | self)
--     2. task_lesson_links        — many-to-many lessons ↔ tasks (Cowork correction #2)
--     3. task_criterion_weights   — weight on the criterion-task EDGE (Cowork correction #3)
--     4. submissions              — POLYMORPHIC source_kind (inquiry-mode future-proof)
--     5. grade_entries            — criterion-scored against a submission
--     6. student_tile_grades      — RE-MINT with task_id NOT NULL FK (G1 roll-forward)
--
--   1 ALTERed table (TG.0A F1 finding):
--     7. assessment_records       — ADD task_id UUID; SET NOT NULL deferred to TG.0K after legacy delete
--
--   ~25 indexes total (FK-targeted + filter-targeted)
--   ~12 RLS policies (school-scoped via is_school_admin() helper, teacher-scoped via class ownership)
--   3 updated_at triggers (assessment_tasks, submissions, student_tile_grades)
--
--   NO new tables for Layer 2 PM tools (deferred sister project).
--   NO new tables for inquiry-mode (deferred sister project; submissions
--     polymorphism makes this cheap to add later).
--
-- DEPENDENCIES:
--   - schools, classes, students, units, auth.users, user_profiles, teachers (existing)
--   - is_school_admin(UUID, UUID) helper (mig 20260502215604)
--   - assessment_records (mig 019_assessments.sql) — ALTER target
--   - set_updated_at() function (existing pattern from class_units etc.)
--
-- ROLLBACK: paired .down.sql drops in reverse order. Refuses if any
--   non-empty assessment_tasks rows exist (production-safety guard).

-- ============================================================
-- 1. assessment_tasks — the unified primitive
-- ============================================================
-- Discriminator-based design: task_type drives the UI surface (split
-- per Tasks v1 prototype verdict) but data lives in one table.
--
-- Universal columns are relational; type-specific config lives in
-- the JSONB `config` field (Cowork correction #4 — avoids nullable
-- mega-column anti-pattern). Application layer validates config
-- shape per task_type.
--
-- Cross-unit support (Cowork correction #6): unit_id is NULLABLE.
-- Capstones / MYP Personal Project / A-Level coursework spanning
-- units use task_units join (added when inquiry-mode lands; for v1
-- structured tasks, unit_id is always set).

CREATE TABLE IF NOT EXISTS assessment_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Universal fields
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),

  -- Discriminator. v1 ships formative + summative. peer/self deferred.
  task_type TEXT NOT NULL DEFAULT 'formative'
    CHECK (task_type IN ('formative', 'summative', 'peer', 'self')),

  -- Task's own status (NOT submission status — separate lifecycle per
  -- Cowork correction #1). draft → published → closed.
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'closed')),

  -- Type-specific config — shape varies by task_type. Validated in
  -- application layer. See brief §`assessment_tasks.config` for the
  -- canonical extension point (CBCI generalizations, Paul-Elder
  -- intersections, GRASPS scaffolding, late_policy, ai_use_policy,
  -- resubmission settings, due_date, submission_format, etc.).
  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_tasks_unit
  ON assessment_tasks(unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_class
  ON assessment_tasks(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_school
  ON assessment_tasks(school_id);
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_type
  ON assessment_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_status
  ON assessment_tasks(status);
CREATE INDEX IF NOT EXISTS idx_assessment_tasks_creator
  ON assessment_tasks(created_by);

COMMENT ON TABLE assessment_tasks IS
  'TG v1 unified primitive for gradeable events (formative/summative/peer/self). '
  'Tasks v1 prototype verdict: split UI per task_type, unified data. '
  'Per Cowork review: submissions split out (separate lifecycle), weight '
  'on criterion-task edge, polymorphic submissions, version-based resubmissions. '
  'Brief: docs/projects/task-system-architecture.md (PR #23 + #29).';

COMMENT ON COLUMN assessment_tasks.config IS
  'Canonical extension point for cross-framework tagging (CBCI generalizations, '
  'Paul-Elder element-standard intersections, GRASPS scaffolding, AI policy, '
  'late policy, resubmission settings, due_date, submission_format). '
  'Lever 0 unit designer writes here at task creation time. '
  'See brief §`assessment_tasks.config` for shape examples.';

-- ============================================================
-- 2. task_lesson_links — many-to-many lessons ↔ tasks
-- ============================================================
-- Cowork correction #2: was task.page_ids[] (array on task pointing
-- AT lessons), reversed to a join table queryable from either side:
--   "what tasks does this lesson contribute to?"  → WHERE unit_id, page_id
--   "what lessons feed this task?"                → WHERE task_id

CREATE TABLE IF NOT EXISTS task_lesson_links (
  task_id UUID NOT NULL REFERENCES assessment_tasks(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL CHECK (length(trim(page_id)) > 0),
  -- 'L01' | 'A1' | etc. — page identifier inside units.content_data.pages[].id
  PRIMARY KEY (task_id, unit_id, page_id)
);

CREATE INDEX IF NOT EXISTS idx_task_lesson_links_task
  ON task_lesson_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_lesson_links_unit_page
  ON task_lesson_links(unit_id, page_id);

COMMENT ON TABLE task_lesson_links IS
  'TG v1 — many-to-many between tasks and lesson pages. Replaces the '
  'task.page_ids[] array proposal (Cowork correction #2). page_id is '
  'a TEXT identifier matching units.content_data.pages[].id (e.g. "L01").';

-- ============================================================
-- 3. task_criterion_weights — weight on the EDGE
-- ============================================================
-- Cowork correction #3: was task.weight (a single 0-100 number on the
-- task), moved to the criterion-task edge. MYP samples each criterion
-- across multiple tasks; tasks don't sum to 100% within a unit.
-- Each row says "this task assesses criterion X with weight Y; here
-- are the rubric descriptors at 4 achievement levels for criterion X."

CREATE TABLE IF NOT EXISTS task_criterion_weights (
  task_id UUID NOT NULL REFERENCES assessment_tasks(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL CHECK (length(trim(criterion_key)) > 0),
  -- Framework-neutral key: 'A' | 'B' | 'AO1' | 'researching' | etc.
  -- MYPflex resolves display labels at render time per class.framework.
  weight INTEGER NOT NULL DEFAULT 100
    CHECK (weight BETWEEN 0 AND 100),
  rubric_descriptors JSONB,
  -- Shape: { level1_2: '...', level3_4: '...', level5_6: '...', level7_8: '...' }
  -- For non-MYP frameworks, MYPflex maps the level-band labels at render.
  PRIMARY KEY (task_id, criterion_key)
);

CREATE INDEX IF NOT EXISTS idx_task_criterion_weights_task
  ON task_criterion_weights(task_id);

COMMENT ON TABLE task_criterion_weights IS
  'TG v1 — weight + rubric descriptors per (task, criterion). '
  'Tasks no longer carry a single weight; each criterion that a task '
  'assesses gets its own weight + descriptors. Cowork correction #3.';

-- ============================================================
-- 4. submissions — POLYMORPHIC student evidence + lifecycle
-- ============================================================
-- Cowork correction (inquiry-mode future-proofing): polymorphic
-- source_kind so the table serves both structured (source_kind='task')
-- AND inquiry mode (source_kind='milestone' | 'project') without
-- schema migration when inquiry-mode lands.
--
-- Cowork correction #5: version-based resubmissions. Don't mutate
-- a single row through "draft → submitted → resubmitted." Each
-- attempt is its own row; version_of_submission_id links them.
--
-- FK enforcement on source_id is APPLICATION-LAYER (not database)
-- because it varies by source_kind. Trigger or service-layer
-- assertion ensures referential integrity.

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic source. v1 only writes source_kind='task'.
  -- 'milestone' (inquiry mode) and 'project' (inquiry mode) reserved.
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('task', 'milestone', 'project')),
  source_id UUID NOT NULL,

  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Versioning (Cowork correction #5)
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  version_of_submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,

  -- Submission content
  text_response TEXT,
  uploads JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ url, filename, mime, size_bytes, uploaded_at }, ...]
  ai_use_declaration TEXT,

  -- Self-assessment scaffold (Hattie d=1.33 — locked-on for summative
  -- per OQ-3 sign-off). Required-before-submit gate enforced at app layer.
  self_assessment JSONB,
  -- [{ criterion: 'A', level: '5-6', evidence_note: '...' }, ...]

  -- Lifecycle (separate from task.status — Cowork correction #1)
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'graded', 'returned')),
  draft_saved_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,

  late_days INTEGER NOT NULL DEFAULT 0 CHECK (late_days >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One active submission per student per source per version
  UNIQUE(source_kind, source_id, student_id, version)
);

CREATE INDEX IF NOT EXISTS idx_submissions_source
  ON submissions(source_kind, source_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student
  ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_school
  ON submissions(school_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status
  ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_version_chain
  ON submissions(version_of_submission_id)
  WHERE version_of_submission_id IS NOT NULL;

COMMENT ON TABLE submissions IS
  'TG v1 — student-submitted evidence with version-based resubmissions. '
  'POLYMORPHIC source_kind: v1 only writes "task"; "milestone" and '
  '"project" reserved for inquiry-mode (Cowork future-proofing call). '
  'FK enforcement on source_id is application-layer due to polymorphism.';

COMMENT ON COLUMN submissions.source_kind IS
  'Discriminator for polymorphic source. v1: only "task" written. '
  'Inquiry-mode (sister project) adds "milestone" + "project" without '
  'schema migration. Adding the polymorphism now costs nothing; '
  'retrofitting later is painful.';

-- ============================================================
-- 5. grade_entries — criterion-scored grades against a submission
-- ============================================================
-- The synthesis layer's per-criterion grades. Working state for the
-- teacher's Synthesize view. When teacher clicks Release, these get
-- rolled up into assessment_records.data.criterion_scores[].

CREATE TABLE IF NOT EXISTS grade_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  criterion_key TEXT NOT NULL CHECK (length(trim(criterion_key)) > 0),
  achievement_level TEXT NOT NULL CHECK (length(trim(achievement_level)) > 0),
  -- '1-2' | '3-4' | '5-6' | '7-8' for MYP; MYPflex maps at render
  numeric_score NUMERIC,
  -- Optional normalised numeric for analytics. NULL when only level matters.
  feedback_text TEXT,
  graded_by UUID NOT NULL REFERENCES auth.users(id),
  graded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_published BOOLEAN NOT NULL DEFAULT false,
  -- Separate from task.status; controls student visibility of THIS
  -- specific criterion's grade. Released en-masse via the release route.
  UNIQUE(submission_id, criterion_key)
);

CREATE INDEX IF NOT EXISTS idx_grade_entries_submission
  ON grade_entries(submission_id);
CREATE INDEX IF NOT EXISTS idx_grade_entries_criterion
  ON grade_entries(criterion_key);
CREATE INDEX IF NOT EXISTS idx_grade_entries_published
  ON grade_entries(is_published) WHERE is_published = true;

COMMENT ON TABLE grade_entries IS
  'TG v1 — per-criterion grades against a submission. Working state '
  'for Synthesize view; released en-masse into assessment_records '
  'via /api/teacher/grading/release.';

-- ============================================================
-- 6. student_tile_grades — RE-MINT with task_id NOT NULL FK
-- ============================================================
-- This is the migration that was rolled back in the original G1 work
-- (status='dropped' in schema-registry.yaml). Re-minted here with the
-- missing task_id FK that makes per-tile calibration scopeable.
--
-- G1's React components (ScorePill, ScoreSelector), lib helpers
-- (extractTilesFromPage, tileProgress, computeStudentRollup), and
-- the /teacher/marking page all roll forward to consume this re-minted
-- table. Calibrate becomes "tiles within this task." Synthesize
-- aggregates per criterion per task per student.

CREATE TABLE IF NOT EXISTS student_tile_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES assessment_tasks(id) ON DELETE CASCADE,
  -- ^ The FK that was missing in the rolled-back attempt
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL CHECK (length(trim(page_id)) > 0),
  tile_id TEXT NOT NULL CHECK (length(trim(tile_id)) > 0),
  -- 'activity_<nanoid>' | 'section_<idx>' per existing pattern
  criterion_key TEXT NOT NULL CHECK (length(trim(criterion_key)) > 0),
  achievement_level TEXT NOT NULL CHECK (length(trim(achievement_level)) > 0),
  ai_pre_score NUMERIC,
  ai_evidence_quote TEXT,
  ai_confidence NUMERIC CHECK (ai_confidence IS NULL OR ai_confidence BETWEEN 0 AND 1),
  confirmed BOOLEAN NOT NULL DEFAULT false,
  override_note TEXT,
  graded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, student_id, page_id, tile_id, criterion_key)
);

CREATE INDEX IF NOT EXISTS idx_student_tile_grades_task
  ON student_tile_grades(task_id);
CREATE INDEX IF NOT EXISTS idx_student_tile_grades_student
  ON student_tile_grades(student_id);
CREATE INDEX IF NOT EXISTS idx_student_tile_grades_class
  ON student_tile_grades(class_id);
CREATE INDEX IF NOT EXISTS idx_student_tile_grades_confirmed
  ON student_tile_grades(confirmed) WHERE confirmed = true;
CREATE INDEX IF NOT EXISTS idx_student_tile_grades_grader
  ON student_tile_grades(graded_by);

COMMENT ON TABLE student_tile_grades IS
  'TG v1 — per-tile calibration data, RE-MINT of the rolled-back '
  'migration 20260427133507_grading_v1_student_tile_grades. The FK '
  'that was missing then (task_id) is now NOT NULL. Calibrate / '
  'Synthesize G1 UX rolls forward to consume this re-minted table. '
  'Brief: docs/projects/task-system-architecture.md.';

-- ============================================================
-- 7. assessment_records.task_id — TG.0A finding F1 amendment
-- ============================================================
-- The brief's first draft missed assessment_records. TG.0A audit
-- caught it: this is the canonical published-grade endpoint that
-- students/parents see, data-subject exports include, and G1's
-- past-feedback memory feeds from. 8 consumers depend on it.
--
-- v1 ADDs nullable task_id. Per OQ-2 sign-off (no backfill), legacy
-- dummy rows get DELETED in TG.0K, then a follow-up migration sets
-- this column NOT NULL.

ALTER TABLE assessment_records
  ADD COLUMN IF NOT EXISTS task_id UUID
    REFERENCES assessment_tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_assessment_records_task
  ON assessment_records(task_id) WHERE task_id IS NOT NULL;

COMMENT ON COLUMN assessment_records.task_id IS
  'TG v1 — task association added by mig 20260505032750. Nullable '
  'now; set NOT NULL in a follow-up migration after TG.0K deletes '
  'legacy dummy data. See docs/projects/task-system-architecture.md '
  'section assessment_records.';

-- ============================================================
-- 8. RLS — enable + policies
-- ============================================================
-- Pattern: read = teachers in same school + platform admin + school admin
--          write = creator + platform admin + school admin
-- Student access (token-session) goes through service-role API routes.

ALTER TABLE assessment_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_lesson_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_criterion_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_tile_grades ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────
-- assessment_tasks RLS
-- ─────────────────────────────────────────────────────────
CREATE POLICY "assessment_tasks_read_school"
  ON assessment_tasks FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM teachers
      WHERE user_id = auth.uid() AND school_id IS NOT NULL
    )
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR public.is_school_admin(auth.uid(), school_id)
  );

CREATE POLICY "assessment_tasks_write_creator_or_admin"
  ON assessment_tasks FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid()
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR public.is_school_admin(auth.uid(), school_id)
  )
  WITH CHECK (
    created_by = auth.uid()
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR public.is_school_admin(auth.uid(), school_id)
  );

-- ─────────────────────────────────────────────────────────
-- task_lesson_links RLS — gated by parent task
-- ─────────────────────────────────────────────────────────
CREATE POLICY "task_lesson_links_read_via_task"
  ON task_lesson_links FOR SELECT
  TO authenticated
  USING (
    task_id IN (SELECT id FROM assessment_tasks)
  );

CREATE POLICY "task_lesson_links_write_via_task"
  ON task_lesson_links FOR ALL
  TO authenticated
  USING (
    task_id IN (
      SELECT id FROM assessment_tasks
      WHERE created_by = auth.uid()
        OR public.is_school_admin(auth.uid(), school_id)
    )
  )
  WITH CHECK (
    task_id IN (
      SELECT id FROM assessment_tasks
      WHERE created_by = auth.uid()
        OR public.is_school_admin(auth.uid(), school_id)
    )
  );

-- ─────────────────────────────────────────────────────────
-- task_criterion_weights RLS — gated by parent task
-- ─────────────────────────────────────────────────────────
CREATE POLICY "task_criterion_weights_read_via_task"
  ON task_criterion_weights FOR SELECT
  TO authenticated
  USING (
    task_id IN (SELECT id FROM assessment_tasks)
  );

CREATE POLICY "task_criterion_weights_write_via_task"
  ON task_criterion_weights FOR ALL
  TO authenticated
  USING (
    task_id IN (
      SELECT id FROM assessment_tasks
      WHERE created_by = auth.uid()
        OR public.is_school_admin(auth.uid(), school_id)
    )
  )
  WITH CHECK (
    task_id IN (
      SELECT id FROM assessment_tasks
      WHERE created_by = auth.uid()
        OR public.is_school_admin(auth.uid(), school_id)
    )
  );

-- ─────────────────────────────────────────────────────────
-- submissions RLS — teachers via class; service-role for student writes
-- ─────────────────────────────────────────────────────────
-- Students use custom token sessions (NOT Supabase Auth), so student-
-- side reads/writes go through service-role API routes that bypass
-- RLS. RLS here gates teacher reads via school membership.
CREATE POLICY "submissions_read_teacher_via_school"
  ON submissions FOR SELECT
  TO authenticated
  USING (
    source_kind = 'task'
    AND source_id IN (
      SELECT id FROM assessment_tasks
      WHERE school_id IN (
        SELECT school_id FROM teachers
        WHERE user_id = auth.uid() AND school_id IS NOT NULL
      )
    )
  );

CREATE POLICY "submissions_admin_full"
  ON submissions FOR ALL
  TO authenticated
  USING (
    (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR (
      source_kind = 'task'
      AND source_id IN (
        SELECT id FROM assessment_tasks
        WHERE public.is_school_admin(auth.uid(), school_id)
      )
    )
  )
  WITH CHECK (
    (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR (
      source_kind = 'task'
      AND source_id IN (
        SELECT id FROM assessment_tasks
        WHERE public.is_school_admin(auth.uid(), school_id)
      )
    )
  );

-- ─────────────────────────────────────────────────────────
-- grade_entries RLS — teachers + admins; gated by submission
-- ─────────────────────────────────────────────────────────
CREATE POLICY "grade_entries_read_via_submission"
  ON grade_entries FOR SELECT
  TO authenticated
  USING (
    submission_id IN (SELECT id FROM submissions)
  );

CREATE POLICY "grade_entries_write_grader_or_admin"
  ON grade_entries FOR ALL
  TO authenticated
  USING (
    graded_by = auth.uid()
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR submission_id IN (
      SELECT s.id FROM submissions s
      JOIN assessment_tasks t ON t.id = s.source_id AND s.source_kind = 'task'
      WHERE public.is_school_admin(auth.uid(), t.school_id)
    )
  )
  WITH CHECK (
    graded_by = auth.uid()
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR submission_id IN (
      SELECT s.id FROM submissions s
      JOIN assessment_tasks t ON t.id = s.source_id AND s.source_kind = 'task'
      WHERE public.is_school_admin(auth.uid(), t.school_id)
    )
  );

-- ─────────────────────────────────────────────────────────
-- student_tile_grades RLS — teachers only (calibration data)
-- ─────────────────────────────────────────────────────────
-- Tile grades are working calibration data; never directly student-
-- visible. Students see released grades via assessment_records.
CREATE POLICY "student_tile_grades_teacher_only"
  ON student_tile_grades FOR ALL
  TO authenticated
  USING (
    graded_by = auth.uid()
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR task_id IN (
      SELECT id FROM assessment_tasks
      WHERE public.is_school_admin(auth.uid(), school_id)
    )
  )
  WITH CHECK (
    graded_by = auth.uid()
    OR (SELECT is_platform_admin FROM user_profiles WHERE id = auth.uid()) = true
    OR task_id IN (
      SELECT id FROM assessment_tasks
      WHERE public.is_school_admin(auth.uid(), school_id)
    )
  );

-- ============================================================
-- 9. updated_at triggers
-- ============================================================
-- Reusing the standard `set_updated_at()` helper from earlier migs.
-- Safe to re-CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_assessment_tasks_updated_at
  BEFORE UPDATE ON assessment_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trigger_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trigger_student_tile_grades_updated_at
  BEFORE UPDATE ON student_tile_grades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 10. Sanity check
-- ============================================================
DO $$
DECLARE
  v_table_count INT;
  v_assessment_records_task_col BOOLEAN;
  v_policy_count INT;
  v_index_count INT;
BEGIN
  -- 6 new tables exist
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('assessment_tasks', 'task_lesson_links',
                        'task_criterion_weights', 'submissions',
                        'grade_entries', 'student_tile_grades');
  IF v_table_count != 6 THEN
    RAISE EXCEPTION 'Migration failed: expected 6 new tables, got %', v_table_count;
  END IF;

  -- assessment_records gained task_id column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'assessment_records'
      AND column_name = 'task_id'
  ) INTO v_assessment_records_task_col;
  IF NOT v_assessment_records_task_col THEN
    RAISE EXCEPTION 'Migration failed: assessment_records.task_id column missing';
  END IF;

  -- RLS policies across the 6 tables
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('assessment_tasks', 'task_lesson_links',
                       'task_criterion_weights', 'submissions',
                       'grade_entries', 'student_tile_grades');
  IF v_policy_count < 9 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 9 RLS policies, got %', v_policy_count;
  END IF;

  -- ~24 indexes (6 tables + 1 on assessment_records)
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND (tablename IN ('assessment_tasks', 'task_lesson_links',
                       'task_criterion_weights', 'submissions',
                       'grade_entries', 'student_tile_grades')
         OR (tablename = 'assessment_records' AND indexname = 'idx_assessment_records_task'))
    AND indexname LIKE 'idx_%';
  IF v_index_count < 18 THEN
    RAISE EXCEPTION 'Migration failed: expected at least 18 indexes, got %', v_index_count;
  END IF;

  RAISE NOTICE 'Migration task_system_v1_schema applied OK: '
               '6 new tables, % RLS policies, % indexes, '
               'assessment_records.task_id column added',
               v_policy_count, v_index_count;
END $$;
