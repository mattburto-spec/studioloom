-- Migration: grading_v1_student_tile_grades
-- Created: 20260427133507 UTC
--
-- WHY: Per-tile grading data primitive for Phase G1's Calibrate / Synthesize UX.
--   The existing `assessment_records` table is unit-level (one row per
--   student × unit × class). Calibrate's workload — 8 tiles × 24 students =
--   ~192 micro-judgements per lesson — demands a per-tile indexed table.
--   Per-criterion rollup at Synthesize time is computed from this table;
--   "Release to <student>" snapshots into both `released_*` columns here AND
--   `assessment_records.data.criterion_scores[]` (the canonical released-grade
--   record for backwards compatibility).
--
-- IMPACT:
--   - NEW TABLE: student_tile_grades            -- per-tile grade primitive
--   - NEW TABLE: student_tile_grade_events      -- append-only audit history
--   - units.content_data BACKFILL: mints stable activityId / id on the ~10%
--     legacy V2/V3/V4 tiles that lack one (probe 27 Apr 2026: 64/635 = 10.1%)
--   - 5 indexes on grades, 4 indexes on events, 2 RLS policies per table
--
-- ROLLBACK: paired .down.sql drops the two tables + helper trigger function.
--   The JSONB backfill is intentionally NOT reversed — once student_tile_grades
--   rows reference the minted IDs, removing them orphans grade data. See
--   docs/decisions-log.md (entry: 27 Apr 2026, grading G1).

-- ============================================================
-- 1. Backfill stable activity IDs onto legacy tiles in units.content_data
-- ============================================================
-- Probe (27 Apr 2026): 64/635 tiles (10.1%) lack stable IDs across 4 units.
-- V2/V3 sections need `activityId`; V4 timeline entries need `id`. Both are
-- nanoid(8)-shaped opaque strings — alphabet doesn't matter, uniqueness does.
-- We mint via `substr(md5(random()::text || clock_timestamp()::text), 1, 8)`:
-- hex-only (16 chars), 4B combinations, zero collision risk for 64 rows.
-- Idempotent: skip-if-present guards make repeated runs safe.

DO $backfill$
DECLARE
  unit_rec      RECORD;
  pages_arr     JSONB;
  new_pages     JSONB;
  page_obj      JSONB;
  sections_arr  JSONB;
  new_sections  JSONB;
  section_obj   JSONB;
  new_section   JSONB;
  timeline_arr  JSONB;
  new_timeline  JSONB;
  tl_obj        JSONB;
  new_tl        JSONB;
  unit_changed  BOOLEAN;
  page_changed  BOOLEAN;
  minted_v2v3   INT := 0;
  minted_v4     INT := 0;
BEGIN
  -- ---- V2 / V3 shape: pages[].content.sections[] — section.activityId ----
  FOR unit_rec IN
    SELECT id, content_data FROM units WHERE content_data ? 'pages'
  LOOP
    pages_arr := unit_rec.content_data -> 'pages';
    IF pages_arr IS NULL OR jsonb_typeof(pages_arr) <> 'array' THEN
      CONTINUE;
    END IF;

    new_pages := '[]'::jsonb;
    unit_changed := false;

    FOR page_obj IN SELECT value FROM jsonb_array_elements(pages_arr) AS t(value) LOOP
      sections_arr := page_obj #> '{content,sections}';

      IF sections_arr IS NULL OR jsonb_typeof(sections_arr) <> 'array' THEN
        new_pages := new_pages || page_obj;
        CONTINUE;
      END IF;

      new_sections := '[]'::jsonb;
      page_changed := false;

      FOR section_obj IN SELECT value FROM jsonb_array_elements(sections_arr) AS t(value) LOOP
        IF NOT (section_obj ? 'activityId')
           OR section_obj ->> 'activityId' IS NULL
           OR section_obj ->> 'activityId' = ''
        THEN
          new_section := section_obj || jsonb_build_object(
            'activityId',
            substr(md5(random()::text || clock_timestamp()::text), 1, 8)
          );
          unit_changed := true;
          page_changed := true;
          minted_v2v3 := minted_v2v3 + 1;
        ELSE
          new_section := section_obj;
        END IF;
        new_sections := new_sections || new_section;
      END LOOP;

      IF page_changed THEN
        page_obj := jsonb_set(page_obj, '{content,sections}', new_sections);
      END IF;
      new_pages := new_pages || page_obj;
    END LOOP;

    IF unit_changed THEN
      UPDATE units
        SET content_data = jsonb_set(content_data, '{pages}', new_pages)
      WHERE id = unit_rec.id;
    END IF;
  END LOOP;

  -- ---- V4 shape: timeline[] — TimelineActivity.id ----
  FOR unit_rec IN
    SELECT id, content_data FROM units WHERE content_data ? 'timeline'
  LOOP
    timeline_arr := unit_rec.content_data -> 'timeline';
    IF timeline_arr IS NULL OR jsonb_typeof(timeline_arr) <> 'array' THEN
      CONTINUE;
    END IF;

    new_timeline := '[]'::jsonb;
    unit_changed := false;

    FOR tl_obj IN SELECT value FROM jsonb_array_elements(timeline_arr) AS t(value) LOOP
      IF NOT (tl_obj ? 'id')
         OR tl_obj ->> 'id' IS NULL
         OR tl_obj ->> 'id' = ''
      THEN
        new_tl := tl_obj || jsonb_build_object(
          'id',
          substr(md5(random()::text || clock_timestamp()::text), 1, 8)
        );
        unit_changed := true;
        minted_v4 := minted_v4 + 1;
      ELSE
        new_tl := tl_obj;
      END IF;
      new_timeline := new_timeline || new_tl;
    END LOOP;

    IF unit_changed THEN
      UPDATE units
        SET content_data = jsonb_set(content_data, '{timeline}', new_timeline)
      WHERE id = unit_rec.id;
    END IF;
  END LOOP;

  RAISE NOTICE 'grading_v1 backfill: minted % V2/V3 activityIds, % V4 ids',
    minted_v2v3, minted_v4;
END;
$backfill$;

-- ============================================================
-- 2. student_tile_grades — per-tile grade primitive
-- ============================================================

CREATE TABLE student_tile_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity / scope
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id    UUID NOT NULL REFERENCES units(id)    ON DELETE CASCADE,
  page_id    UUID NOT NULL,                                              -- computed/dynamic; no FK target
  tile_id    TEXT NOT NULL,                                              -- "activity_<nanoid>" or "section_<idx>"; matches student_progress response key
  class_id   UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- denormalized for RLS — primary class teacher
  graded_by  UUID          REFERENCES auth.users(id) ON DELETE SET NULL, -- who actually scored (co-teacher future-proof)

  -- Live scoring state
  score          SMALLINT,                                               -- framework-agnostic; rendered scale per class.framework
  confirmed      BOOLEAN  NOT NULL DEFAULT false,
  override_note  TEXT,                                                   -- private teacher note

  -- Released-grade snapshot (frozen at "Release to <student>" rollup so the
  -- value the student/parent saw can never be silently mutated by later edits)
  released_at              TIMESTAMPTZ,
  released_score           SMALLINT,
  released_criterion_keys  TEXT[],

  -- AI assistance metadata
  ai_pre_score      SMALLINT,
  ai_quote          TEXT,                                                -- 8-15 word evidence quote from student work
  ai_confidence     NUMERIC(3,2)
                    CHECK (ai_confidence IS NULL OR ai_confidence BETWEEN 0 AND 1),
  ai_reasoning      TEXT,
  ai_model_version  TEXT,                                                -- e.g. 'claude-haiku-4-5-20251001'
  prompt_version    TEXT,                                                -- e.g. 'grading.v1.0.0'

  -- Cohort / consistency
  marking_session_id UUID,                                               -- groups rows graded in same sitting (G4 consistency checker)

  -- Framework-neutral criterion identifiers from the 8-key taxonomy.
  -- Render via FrameworkAdapter.toLabel(neutralKey, class.framework).
  -- See docs/specs/neutral-criterion-taxonomy.md.
  criterion_keys TEXT[] NOT NULL DEFAULT '{}',

  -- Timestamps
  graded_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(student_id, unit_id, page_id, tile_id, class_id),

  -- Enforce neutral key vocabulary at the DB layer.
  CONSTRAINT student_tile_grades_criterion_keys_neutral CHECK (
    criterion_keys <@ ARRAY[
      'researching','analysing','designing','creating',
      'evaluating','reflecting','communicating','planning'
    ]::TEXT[]
  ),
  CONSTRAINT student_tile_grades_released_criterion_keys_neutral CHECK (
    released_criterion_keys IS NULL
    OR released_criterion_keys <@ ARRAY[
      'researching','analysing','designing','creating',
      'evaluating','reflecting','communicating','planning'
    ]::TEXT[]
  )
);

-- ============================================================
-- 3. student_tile_grades indexes
-- ============================================================

-- GIN: enables `WHERE 'designing' = ANY(criterion_keys)` and `&&` overlap queries
CREATE INDEX idx_student_tile_grades_criterion_keys
  ON student_tile_grades USING GIN(criterion_keys);

-- Class-scoped queries (Calibrate "this lesson, all students")
CREATE INDEX idx_student_tile_grades_class_unit
  ON student_tile_grades(class_id, unit_id);

-- Cross-class teacher view ("everything I need to grade across all my classes")
CREATE INDEX idx_student_tile_grades_teacher
  ON student_tile_grades(teacher_id);

-- "Needs grading" feed — partial index because most rows go confirmed=true over time
CREATE INDEX idx_student_tile_grades_unconfirmed
  ON student_tile_grades(class_id, confirmed)
  WHERE NOT confirmed;

-- Marking-session lookup (G4 consistency checker)
CREATE INDEX idx_student_tile_grades_session
  ON student_tile_grades(marking_session_id)
  WHERE marking_session_id IS NOT NULL;

-- ============================================================
-- 4. student_tile_grades RLS
-- ============================================================
-- Mirrors assessment_records (migration 019). UNION-pattern dual-visibility
-- (Lesson #29) is NOT used here because tile grades are class-scoped — no
-- school-admin / dept-head visibility until Access Model v2 ships.

ALTER TABLE student_tile_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage tile grades for their classes"
  ON student_tile_grades FOR ALL
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access tile grades"
  ON student_tile_grades FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 5. student_tile_grades updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_student_tile_grades_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER student_tile_grades_updated_at
  BEFORE UPDATE ON student_tile_grades
  FOR EACH ROW EXECUTE FUNCTION update_student_tile_grades_updated_at();

-- ============================================================
-- 6. student_tile_grade_events — append-only audit history
-- ============================================================
-- Every meaningful change to a tile grade writes one row here. Foundation for:
--   - parent-dispute defensibility ("the grade you saw on date X was Y")
--   - AI-vs-teacher override analytics ("Matt overrode AI on 18% of designing tiles")
--   - drift detection ("standards shifted in week 4")
--   - G4 consistency checker (cross-session comparisons)
--
-- Writes: app code in same transaction as student_tile_grades INSERT/UPDATE
--   (planned: src/lib/grading/save-tile-grade.ts in G1.2).
-- Reads: future analytics + parent-dispute viewer.
-- Append-only by RLS convention: no UPDATE/DELETE policies for teachers.

CREATE TABLE student_tile_grade_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  grade_id UUID NOT NULL REFERENCES student_tile_grades(id) ON DELETE CASCADE,

  -- Denormalized scope (fast filter without joining grade row)
  student_id UUID NOT NULL REFERENCES students(id)   ON DELETE CASCADE,
  class_id   UUID NOT NULL REFERENCES classes(id)    ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What happened
  source TEXT NOT NULL CHECK (source IN (
    'ai_pre_score',      -- AI populated initial suggestion on a fresh row
    'teacher_confirm',   -- teacher accepted AI as-is (no score change, confirmed → true)
    'teacher_override',  -- teacher set value different from AI (score change + confirmed → true)
    'teacher_revise',    -- teacher changed an already-confirmed value
    'rollup_release',    -- "Release to <student>" snapshotted into released_*
    'system_correction'  -- bulk fix / migration / admin tool
  )),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  prev_score      SMALLINT,
  new_score       SMALLINT,
  prev_confirmed  BOOLEAN,
  new_confirmed   BOOLEAN,

  -- AI snapshot at time of event (for AI-only events; null for teacher events)
  ai_confidence    NUMERIC(3,2)
                   CHECK (ai_confidence IS NULL OR ai_confidence BETWEEN 0 AND 1),
  ai_model_version TEXT,
  prompt_version   TEXT,

  note TEXT,                                                             -- override_note copy or system reason

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. student_tile_grade_events indexes
-- ============================================================

-- Per-grade history view (parent dispute, "show me the audit trail")
CREATE INDEX idx_tile_grade_events_grade
  ON student_tile_grade_events(grade_id, created_at DESC);

-- Per-class timeline (drift detection, weekly review)
CREATE INDEX idx_tile_grade_events_class_created
  ON student_tile_grade_events(class_id, created_at DESC);

-- Per-teacher activity (cross-class analytics)
CREATE INDEX idx_tile_grade_events_teacher_created
  ON student_tile_grade_events(teacher_id, created_at DESC);

-- Source-specific queries ("how many AI overrides this term?")
CREATE INDEX idx_tile_grade_events_source
  ON student_tile_grade_events(source);

-- ============================================================
-- 8. student_tile_grade_events RLS
-- ============================================================
-- Append-only by convention: SELECT for teachers, full access for service role.
-- No teacher INSERT policy — events are written via service role from
-- save-tile-grade.ts, ensuring every event has a verified teacher_id.

ALTER TABLE student_tile_grade_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers read tile grade events for their classes"
  ON student_tile_grade_events FOR SELECT
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access tile grade events"
  ON student_tile_grade_events FOR ALL
  USING (auth.role() = 'service_role');
