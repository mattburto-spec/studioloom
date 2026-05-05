-- ====================================================================
-- TG.0D smoke seed — pre-existing summative task with full GRASPS + rubric
-- ====================================================================
-- Purpose:
--   Seed 1 summative project task (task_type='summative') against an
--   existing unit so the TasksPanel renders a 🎯 row on first load
--   and Matt can click [Configure →] to open the drawer in edit mode
--   without filling 5 tabs from scratch.
--
-- How to run:
--   1. Open Supabase SQL editor on prod.
--   2. Find a unit + teacher to bind to:
--        SELECT u.id, u.title, u.author_teacher_id
--        FROM units u
--        WHERE u.author_teacher_id = '<your-teacher-id>'
--        ORDER BY u.created_at DESC LIMIT 5;
--   3. Replace :unit_id, :teacher_id, :school_id, :class_id below.
--   4. Run the whole script. Returns the new task ID.
--
-- Cleanup:
--   DELETE FROM assessment_tasks WHERE id = '<task-uuid>';
--   -- cascades to task_criterion_weights + task_lesson_links.
--
-- Idempotent? NO. Running twice creates 2 tasks. Delete first.
-- ====================================================================

\set unit_id    '00000000-0000-0000-0000-000000000000'
\set teacher_id '00000000-0000-0000-0000-000000000000'
\set school_id  '00000000-0000-0000-0000-000000000000'
\set class_id   '00000000-0000-0000-0000-000000000000'

-- ─── Insert summative task ───────────────────────────────────────────
WITH inserted AS (
  INSERT INTO assessment_tasks
    (unit_id, class_id, school_id, title, task_type, status, config, created_by)
  VALUES
    (
      :'unit_id'::uuid,
      :'class_id'::uuid,
      :'school_id'::uuid,
      'Roller Coaster Brief — Marble Run Build',
      'summative',
      'draft',
      jsonb_build_object(
        'grasps', jsonb_build_object(
          'goal',        'Design and build a marble run that demonstrates Newton''s 2nd law',
          'role',        'Engineer pitching to a theme-park investor',
          'audience',    'Year 7 peers serving as the investor panel',
          'situation',   'School STEM showcase — 3-min pitch + Q&A',
          'performance', 'Annotated sketches + working physical or digital model',
          'standards',   'Functional, creative, evidence-based reasoning'
        ),
        'submission', jsonb_build_object(
          'format',                          'multi',
          'word_count_cap',                  500,
          'ai_use_policy',                   'allowed_with_citation',
          'integrity_declaration_required',  true
        ),
        'timeline', jsonb_build_object(
          'due_date',     '2026-06-15',
          'late_policy',  '1 day grace, then 10% per day; max 3 days late',
          'resubmission', jsonb_build_object('mode', 'open_until', 'until', '2026-06-22')
        ),
        'policy', jsonb_build_object(
          'grouping',           'individual',
          'notify_on_publish',  true,
          'notify_on_due_soon', true
        ),
        'self_assessment_required', true
      ),
      :'teacher_id'::uuid
    )
  RETURNING id, title
)
SELECT id, title FROM inserted;

-- ─── Insert criterion weights with rubric descriptors ────────────────
WITH t AS (
  SELECT id FROM assessment_tasks
  WHERE created_by = :'teacher_id'::uuid
    AND title = 'Roller Coaster Brief — Marble Run Build'
  ORDER BY created_at DESC LIMIT 1
)
INSERT INTO task_criterion_weights (task_id, criterion_key, weight, rubric_descriptors)
SELECT t.id, 'researching', 25, jsonb_build_object(
  'level1_2', 'Identifies one source with limited relevance',
  'level3_4', 'Identifies relevant secondary sources with limited synthesis',
  'level5_6', 'Synthesises 2+ sources to inform design choices',
  'level7_8', 'Critically evaluates multiple sources to drive design decisions'
)
FROM t
UNION ALL
SELECT t.id, 'designing', 25, jsonb_build_object(
  'level1_2', 'Single concept with little iteration',
  'level3_4', 'Multiple concepts with limited refinement',
  'level5_6', 'Iterative concept development with informed refinement',
  'level7_8', 'Sophisticated iterative design with strong rationale'
)
FROM t
UNION ALL
SELECT t.id, 'creating', 25, jsonb_build_object(
  'level1_2', 'Incomplete or non-functional model',
  'level3_4', 'Functional model with significant flaws',
  'level5_6', 'Functional model demonstrating intended physics',
  'level7_8', 'Polished, accurate model that clearly communicates the physics'
)
FROM t
UNION ALL
SELECT t.id, 'evaluating', 25, jsonb_build_object(
  'level1_2', 'Limited reflection on outcome',
  'level3_4', 'Identifies strengths/weaknesses with limited evidence',
  'level5_6', 'Evaluates outcome against criteria with evidence',
  'level7_8', 'Critically evaluates outcome with proposed next iterations'
)
FROM t
ON CONFLICT (task_id, criterion_key) DO NOTHING;

-- ─── Verify ──────────────────────────────────────────────────────────
SELECT
  t.id,
  t.title,
  t.task_type,
  t.status,
  t.config -> 'grasps' AS grasps,
  t.config -> 'submission' ->> 'format' AS format,
  t.config -> 'self_assessment_required' AS sa_required,
  ARRAY(
    SELECT jsonb_build_object(
      'criterion', criterion_key,
      'weight', weight,
      'has_rubric', (rubric_descriptors IS NOT NULL)
    )
    FROM task_criterion_weights
    WHERE task_id = t.id
  ) AS criteria
FROM assessment_tasks t
WHERE t.unit_id = :'unit_id'::uuid
  AND t.task_type = 'summative'
ORDER BY t.created_at DESC;
