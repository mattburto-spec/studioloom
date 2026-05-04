-- ====================================================================
-- Lever 1 — test unit seed (Matt Checkpoint 1.1)
-- ====================================================================
-- Purpose:
--   Create one fully-formed v2 unit (3 lessons × 4 sections each) with
--   framing/task/success_signal populated on every section, plus the
--   composed legacy `prompt` so any non-migrated reader still works.
--   Assigns the unit to a class so the Phase 0.5 lesson editor mounts
--   (the legacy /edit page redirects when a unit has any class assignment).
--
-- Design intent:
--   - One section is intentionally LEGACY-ONLY (prompt set, no slots) to
--     verify the renderer falls back to MarkdownPrompt.
--   - One section is intentionally PARTIAL-SLOTS (framing + task only,
--     no success_signal) to verify the renderer composes correctly with
--     gaps.
--   - Three sections are FULL v2 (all three slots) to exercise the
--     hybrid spec — muted framing → bold task → 🎯 success_signal.
--   - Mix of responseType (text, upload) and a content-only section
--     (no responseType) to exercise the renderer's response-type fork.
--
-- How to run:
--   1. Open Supabase SQL editor on the production database.
--   2. Find your teacher_id with the comment block at the top below
--      (or know it already from prior work). Paste it into the
--      :teacher_id binding.
--   3. Optional: change :class_name to anything you want — the seed
--      reuses an existing class with that name if one exists, else
--      creates a new one.
--   4. Run the whole file. It returns the new unit_id and the URL to
--      visit.
--
-- Cleanup:
--   - Run the rollback block at the bottom (commented out) to remove
--     the unit + its class_units row. Class is left intact.
-- ====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- Bindings — pre-filled for mattburton@nanjing-school.com:
-- ─────────────────────────────────────────────────────────────────────
-- IMPORTANT: log into StudioLoom as mattburton@nanjing-school.com
-- before visiting the editor URL — the Phase 0.5 editor's RLS check
-- matches the unit's teacher_id against your authenticated session.
-- Logging in as the gmail account would 403/redirect.
-- ─────────────────────────────────────────────────────────────────────

WITH bindings AS (
  SELECT
    '27818389-9d3b-4760-988e-d9f166cd42e5'::uuid AS teacher_id,  -- mattburton@nanjing-school.com
    'Lever 1 Smoke Class'             AS class_name,
    'Lever 1 — Three-Slot Smoke Unit' AS unit_title,
    'Year 8'                          AS grade_level
),
-- Find or create a class for this teacher.
existing_class AS (
  SELECT c.id
  FROM classes c, bindings b
  WHERE c.teacher_id = b.teacher_id
    AND c.name = b.class_name
  LIMIT 1
),
new_class AS (
  INSERT INTO classes (teacher_id, name)
  SELECT b.teacher_id, b.class_name
  FROM bindings b
  WHERE NOT EXISTS (SELECT 1 FROM existing_class)
  RETURNING id
),
class_id_resolved AS (
  SELECT id FROM existing_class
  UNION ALL
  SELECT id FROM new_class
),
-- Insert the unit. content_data follows v3 (journey-based) shape since
-- that's what the Phase 0.5 lesson editor and ComposedPrompt renderer
-- consume. Pages → content.sections[] holds the activity slots.
new_unit AS (
  INSERT INTO units (
    teacher_id,
    author_teacher_id,
    title,
    description,
    grade_level,
    duration_weeks,
    topic,
    unit_type,
    is_published,
    content_data
  )
  SELECT
    b.teacher_id,
    b.teacher_id,
    b.unit_title,
    'Three-lesson v2 unit with framing/task/success_signal slot fields populated. '
      || 'Used to smoke-test Lever 1 Matt Checkpoint 1.1. '
      || 'Section L1.S2 is legacy-only (prompt no slots), L2.S3 is partial-slots (no success_signal), '
      || 'rest are full v2.',
    b.grade_level,
    2,
    'Roller coaster physics (test fixture)',
    'design',
    false,
    jsonb_build_object(
      'version', 3,
      'generationModel', 'journey',
      'lessonLengthMinutes', 60,
      'pages', jsonb_build_array(
        -- ─── LESSON 1: Investigate ─────────────────────────────────
        jsonb_build_object(
          'id', 'L01',
          'type', 'lesson',
          'title', 'Investigate — How do roller coasters use energy?',
          'content', jsonb_build_object(
            'title', 'Investigate — How do roller coasters use energy?',
            'learningGoal', 'Identify how potential energy converts to kinetic energy in a roller coaster.',
            'sections', jsonb_build_array(
              -- L1.S1 — full v2 slots, text response
              jsonb_build_object(
                'activityId', 'l01s1',
                'framing', 'Energy never disappears — it just changes form. Today you''ll spot that change happening on a roller coaster.',
                'task', 'Watch the 90-second video of the loop. Pause at the top of the first hill, the bottom of the loop, and the top of the loop. At each pause, write what kind of energy the cart has the most of (potential or kinetic) and one sentence explaining why.',
                'success_signal', 'Submit three labelled observations — one per pause point.',
                'prompt', 'Energy never disappears — it just changes form. Today you''ll spot that change happening on a roller coaster.

Watch the 90-second video of the loop. Pause at the top of the first hill, the bottom of the loop, and the top of the loop. At each pause, write what kind of energy the cart has the most of (potential or kinetic) and one sentence explaining why.

Submit three labelled observations — one per pause point.',
                'responseType', 'text',
                'criterionTags', jsonb_build_array('A')
              ),
              -- L1.S2 — LEGACY-ONLY (no slots, prompt set) — exercises fallback
              jsonb_build_object(
                'activityId', 'l01s2',
                'prompt', 'Sketch a roller coaster you''d ride. Label the highest point, the lowest point, and one place you''d feel weightless. Take a photo of your sketch and upload it.',
                'responseType', 'upload',
                'criterionTags', jsonb_build_array('B')
              ),
              -- L1.S3 — full v2 slots, content-only (no responseType)
              jsonb_build_object(
                'activityId', 'l01s3',
                'framing', 'Quick safety reminder before next lesson''s build.',
                'task', 'Marble runs use the same energy principles as roller coasters. When you build yours next lesson, **the marble must never leave the track**. Tape any joins. Don''t hold the run vertical or build above shoulder height.',
                'success_signal', 'Note the safety rules before starting the build next lesson.',
                'prompt', 'Quick safety reminder before next lesson''s build.

Marble runs use the same energy principles as roller coasters. When you build yours next lesson, **the marble must never leave the track**. Tape any joins. Don''t hold the run vertical or build above shoulder height.

Note the safety rules before starting the build next lesson.',
                'contentStyle', 'warning'
              ),
              -- L1.S4 — full v2 slots, reflection
              jsonb_build_object(
                'activityId', 'l01s4',
                'framing', 'One sentence to lock in today''s key idea.',
                'task', 'Complete this sentence in your own words: "Roller coasters work because the energy at the top of the first hill _________."',
                'success_signal', 'Submit your one-sentence completion.',
                'prompt', 'One sentence to lock in today''s key idea.

Complete this sentence in your own words: "Roller coasters work because the energy at the top of the first hill _________."

Submit your one-sentence completion.',
                'responseType', 'text'
              )
            )
          )
        ),
        -- ─── LESSON 2: Develop ─────────────────────────────────────
        jsonb_build_object(
          'id', 'L02',
          'type', 'lesson',
          'title', 'Develop — Design your marble run',
          'content', jsonb_build_object(
            'title', 'Develop — Design your marble run',
            'learningGoal', 'Design a marble run that uses gravity to keep a marble moving for at least 5 seconds.',
            'sections', jsonb_build_array(
              -- L2.S1 — full v2 slots, text
              jsonb_build_object(
                'activityId', 'l02s1',
                'framing', 'A good design starts with constraints, not ideas.',
                'task', 'List three constraints your marble run must meet (e.g. fits on the desk, uses only cardboard + tape, marble travels for ≥ 5 seconds). Add one constraint of your own that''s harder than the others.',
                'success_signal', 'Submit a numbered list of four constraints.',
                'prompt', 'A good design starts with constraints, not ideas.

List three constraints your marble run must meet (e.g. fits on the desk, uses only cardboard + tape, marble travels for ≥ 5 seconds). Add one constraint of your own that''s harder than the others.

Submit a numbered list of four constraints.',
                'responseType', 'text',
                'criterionTags', jsonb_build_array('B')
              ),
              -- L2.S2 — full v2 slots, upload
              jsonb_build_object(
                'activityId', 'l02s2',
                'framing', 'Cheap to draw, expensive to build.',
                'task', 'Sketch **three different** marble run layouts on one page. Each must use the constraints from the previous activity. Spend no more than 5 minutes per sketch — speed matters more than detail right now.',
                'success_signal', 'Upload one photo containing all three sketches side by side.',
                'prompt', 'Cheap to draw, expensive to build.

Sketch **three different** marble run layouts on one page. Each must use the constraints from the previous activity. Spend no more than 5 minutes per sketch — speed matters more than detail right now.

Upload one photo containing all three sketches side by side.',
                'responseType', 'upload',
                'criterionTags', jsonb_build_array('B')
              ),
              -- L2.S3 — PARTIAL slots (framing + task only, no success_signal)
              jsonb_build_object(
                'activityId', 'l02s3',
                'framing', 'Designers don''t fall in love with their first idea.',
                'task', 'Pick one of your three sketches and write down two reasons it''s the strongest, and one reason it might fail.',
                'prompt', 'Designers don''t fall in love with their first idea.

Pick one of your three sketches and write down two reasons it''s the strongest, and one reason it might fail.',
                'responseType', 'text',
                'criterionTags', jsonb_build_array('C')
              ),
              -- L2.S4 — full v2 slots, reflection
              jsonb_build_object(
                'activityId', 'l02s4',
                'framing', 'Quick gut-check before tomorrow''s build.',
                'task', 'On a scale of 1–5, how confident do you feel that your chosen design will work? What''s the one thing you''re most worried about?',
                'success_signal', 'Submit your confidence rating + one-line worry.',
                'prompt', 'Quick gut-check before tomorrow''s build.

On a scale of 1–5, how confident do you feel that your chosen design will work? What''s the one thing you''re most worried about?

Submit your confidence rating + one-line worry.',
                'responseType', 'text'
              )
            )
          )
        ),
        -- ─── LESSON 3: Create ──────────────────────────────────────
        jsonb_build_object(
          'id', 'L03',
          'type', 'lesson',
          'title', 'Create — Build and test your marble run',
          'content', jsonb_build_object(
            'title', 'Create — Build and test your marble run',
            'learningGoal', 'Build the marble run from your design and improve it through testing.',
            'sections', jsonb_build_array(
              -- L3.S1 — full v2 slots, content-only intro
              jsonb_build_object(
                'activityId', 'l03s1',
                'framing', 'Building is where designs meet reality.',
                'task', 'You have 25 minutes to build version 1 of your marble run. **Don''t test it yet** — get the whole shape built first. Common mistake: spending 20 minutes on a perfect first joint and not finishing the run.',
                'success_signal', 'Be ready to test in 25 minutes — even if it''s scrappy.',
                'prompt', 'Building is where designs meet reality.

You have 25 minutes to build version 1 of your marble run. **Don''t test it yet** — get the whole shape built first. Common mistake: spending 20 minutes on a perfect first joint and not finishing the run.

Be ready to test in 25 minutes — even if it''s scrappy.',
                'contentStyle', 'practical'
              ),
              -- L3.S2 — full v2 slots, upload
              jsonb_build_object(
                'activityId', 'l03s2',
                'framing', 'Test fast, learn faster.',
                'task', 'Run the marble three times. Time each run with your phone. Record any spots where the marble slows, stops, or jumps off track.',
                'success_signal', 'Upload a short video (≤ 15 seconds) of one of your runs + your three timings.',
                'prompt', 'Test fast, learn faster.

Run the marble three times. Time each run with your phone. Record any spots where the marble slows, stops, or jumps off track.

Upload a short video (≤ 15 seconds) of one of your runs + your three timings.',
                'responseType', 'upload',
                'criterionTags', jsonb_build_array('C')
              ),
              -- L3.S3 — full v2 slots, text
              jsonb_build_object(
                'activityId', 'l03s3',
                'framing', 'Iteration is the design cycle in miniature.',
                'task', 'Pick the **one** weakest spot from your test. Describe what you would change if you had another 10 minutes, and why that change would help.',
                'success_signal', 'Submit your one-change improvement plan in 2–3 sentences.',
                'prompt', 'Iteration is the design cycle in miniature.

Pick the **one** weakest spot from your test. Describe what you would change if you had another 10 minutes, and why that change would help.

Submit your one-change improvement plan in 2–3 sentences.',
                'responseType', 'text',
                'criterionTags', jsonb_build_array('D')
              ),
              -- L3.S4 — full v2 slots, reflection
              jsonb_build_object(
                'activityId', 'l03s4',
                'framing', 'Looking back to lock learning in.',
                'task', 'In your own words: how did your marble run use the same energy idea you investigated in lesson 1? Where in your run does potential energy turn into kinetic energy?',
                'success_signal', 'Submit a short paragraph (3–4 sentences) connecting your build back to the energy concept.',
                'prompt', 'Looking back to lock learning in.

In your own words: how did your marble run use the same energy idea you investigated in lesson 1? Where in your run does potential energy turn into kinetic energy?

Submit a short paragraph (3–4 sentences) connecting your build back to the energy concept.',
                'responseType', 'text',
                'criterionTags', jsonb_build_array('A', 'D')
              )
            )
          )
        )
      )
    )
  FROM bindings b
  RETURNING id
),
-- Assign the unit to the class.
class_unit_link AS (
  INSERT INTO class_units (class_id, unit_id, is_active)
  SELECT c.id, u.id, true
  FROM class_id_resolved c, new_unit u
  RETURNING class_id, unit_id
)
-- Output the IDs + the FULL prod URLs Matt needs to visit for the smoke.
-- (Just click the editor_url cell value in the Supabase result pane.)
SELECT
  cul.unit_id,
  cul.class_id,
  'https://studioloom.org/teacher/units/' || cul.unit_id || '/class/' || cul.class_id || '/edit'  AS editor_url,
  'https://studioloom.org/teacher/units/' || cul.unit_id || '/preview/L01'                         AS student_preview_url
FROM class_unit_link cul;

-- ====================================================================
-- ROLLBACK (uncomment to remove the seed unit when smoke is done):
-- ====================================================================
--
-- DELETE FROM units
--  WHERE teacher_id = '27818389-9d3b-4760-988e-d9f166cd42e5'::uuid
--    AND title = 'Lever 1 — Three-Slot Smoke Unit';
--
-- (class_units row cascades on unit DELETE. The 'Lever 1 Smoke Class'
-- row is left intact — drop it manually if you also want it gone:
--
-- DELETE FROM classes
--  WHERE teacher_id = '27818389-9d3b-4760-988e-d9f166cd42e5'::uuid
--    AND name = 'Lever 1 Smoke Class';
-- )
