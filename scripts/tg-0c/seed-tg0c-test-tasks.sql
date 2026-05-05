-- ====================================================================
-- TG.0C smoke seed — pre-existing assessment_tasks against an existing unit
-- ====================================================================
-- Purpose:
--   Seed 2 Quick-Check formative tasks against a unit Matt already has
--   from Lever-1 smoke (or any unit on prod) so the TasksPanel renders
--   something on first load. Optional — the panel handles empty state
--   gracefully, so Matt can also smoke from a clean state.
--
-- How to run:
--   1. Open Supabase SQL editor on prod.
--   2. Find a unit + teacher to bind to:
--        SELECT u.id, u.title, u.author_teacher_id
--        FROM units u
--        WHERE u.author_teacher_id = '<your-teacher-id>'
--        ORDER BY u.created_at DESC LIMIT 5;
--   3. Replace :unit_id, :teacher_id, :school_id, :class_id below with
--      real values (or use the SELECT-into-CTE form below).
--   4. Run the whole script. Returns the 2 new task IDs.
--
-- Cleanup:
--   DELETE FROM assessment_tasks WHERE id IN (
--     '<task-1-uuid>', '<task-2-uuid>'
--   );  -- cascades to task_criterion_weights + task_lesson_links.
--
-- Idempotent? NO — running twice creates 4 tasks. Either delete first or
-- only run once. (Dummy seed for smoke; not worth ON CONFLICT logic.)
-- ====================================================================

-- ─── Bindings (paste your real values) ───────────────────────────────
\set unit_id    '00000000-0000-0000-0000-000000000000'
\set teacher_id '00000000-0000-0000-0000-000000000000'
\set school_id  '00000000-0000-0000-0000-000000000000'
\set class_id   '00000000-0000-0000-0000-000000000000'

-- ─── Insert tasks ────────────────────────────────────────────────────
WITH inserted AS (
  INSERT INTO assessment_tasks
    (unit_id, class_id, school_id, title, task_type, status, config, created_by)
  VALUES
    (:'unit_id'::uuid, :'class_id'::uuid, :'school_id'::uuid,
     'Sketch check — Lesson 1',
     'formative', 'draft',
     jsonb_build_object(
       'criteria',  ARRAY['researching']::text[],
       'due_date',  NULL,
       'linked_pages', NULL
     ),
     :'teacher_id'::uuid),
    (:'unit_id'::uuid, :'class_id'::uuid, :'school_id'::uuid,
     'Quiz 1 — design vocab',
     'formative', 'published',
     jsonb_build_object(
       'criteria',  ARRAY['analysing']::text[],
       'due_date',  '2026-05-15',
       'linked_pages', NULL
     ),
     :'teacher_id'::uuid)
  RETURNING id, title
)
SELECT id, title FROM inserted;

-- ─── Insert criterion weights for each task ──────────────────────────
-- (Reuses the IDs we just returned. Run the section below by hand if
-- the seed is split across two sessions; otherwise the WITH-CTE chain
-- could nest deeper.)

WITH t AS (
  SELECT id, title FROM assessment_tasks
  WHERE created_by = :'teacher_id'::uuid
    AND title IN ('Sketch check — Lesson 1', 'Quiz 1 — design vocab')
)
INSERT INTO task_criterion_weights (task_id, criterion_key, weight)
SELECT
  t.id,
  CASE t.title
    WHEN 'Sketch check — Lesson 1' THEN 'researching'
    WHEN 'Quiz 1 — design vocab' THEN 'analysing'
  END,
  100
FROM t
ON CONFLICT (task_id, criterion_key) DO NOTHING;

-- ─── Verify ──────────────────────────────────────────────────────────
SELECT
  t.id,
  t.title,
  t.task_type,
  t.status,
  t.config,
  ARRAY(
    SELECT criterion_key FROM task_criterion_weights
    WHERE task_id = t.id
  ) AS criteria
FROM assessment_tasks t
WHERE t.unit_id = :'unit_id'::uuid
ORDER BY t.created_at DESC;
