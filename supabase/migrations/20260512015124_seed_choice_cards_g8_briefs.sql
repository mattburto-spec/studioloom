-- Migration: seed_choice_cards_g8_briefs
-- Created: 20260512015124 UTC
-- Phase: Choice Cards Block v1 Phase 7 — seed library
--
-- WHY: First production deck — Matt's G8 cohort picks one of 6 project
--   briefs for the StudioLoom debut. 3 ship to platform (designer
--   mentor, theme, scaffold — these can become real Loominary assets if
--   strong) and 3 are physical making briefs (1m² space, desktop
--   object, board game).
--
-- IMPACT:
--   6 INSERTs into choice_cards with is_seeded=TRUE, created_by=NULL.
--   image_url NULL on all rows — Matt uploads real images this week via
--   the lesson editor's library picker (Phase 6 upload route).
--   emoji + bg_color fallback renders meanwhile.
--   on_pick_action references archetype IDs ('app-digital-tool',
--   'architecture-interior', 'toy-design') that don't exist in code yet
--   — Project Spec block isn't built. These are structured payloads that
--   subscribers register for later (Phase 8's action dispatcher logs
--   the event to learning_events). For v1, the action is logged + the
--   onPicked callback fires — that's it.
--
-- ROLLBACK: paired .down.sql DELETEs the 6 seeded rows by id. Safety
--   guard refuses if any student has picked one of them (preserves
--   audit history).

INSERT INTO choice_cards (id, label, hook_text, detail_md, emoji, bg_color, tags, on_pick_action, ships_to_platform, is_seeded) VALUES

-- ─────────────────────────────────────────────────────────────────────
-- StudioLoom-design path (ships_to_platform = TRUE)
-- ─────────────────────────────────────────────────────────────────────
('g8-brief-designer-mentor', 'Design a Designer Mentor',
 'Bring a designer to life as an AI mentor for future StudioLoom students.',
 'Pick a real designer (or invent one). Create their persona, 3 themes they think about, 5 questions they''d ask a student stuck on ideation, and a one-page character sheet.

**You''ll deliver:** mentor card pack + 3-min pitch.
**Ships?** If strong, yes — into the Designer Mentor System.',
 '🎨', '#F5C97A',
 ARRAY['brief', 'g8', 'design-pathway', 'studioloom-contribution'],
 '{"type":"set-archetype","payload":{"archetypeId":"app-digital-tool","seedKanban":[
   {"title":"Pick your designer and write 3 reasons you chose them","listKey":"todo"},
   {"title":"Draft a one-paragraph persona","listKey":"todo"},
   {"title":"Write 5 questions this mentor would ask a student stuck on ideation","listKey":"todo"},
   {"title":"Sketch a one-page character sheet","listKey":"todo"}
 ]}}'::jsonb,
 TRUE, TRUE),

('g8-brief-studio-theme', 'Design a Studio Theme',
 'Pick a domain you care about and build a theme pack.',
 'Pick a domain (sustainability, kids, accessibility, sport, food…). Build: name + concept + 5-colour palette + 5 starter prompts + hero image + 3 mood images.

**You''ll deliver:** theme pack (digital) + physical swatch tray.
**Ships?** If strong, yes — into the Themes library.',
 '🎭', '#F4A3C7',
 ARRAY['brief', 'g8', 'design-pathway', 'studioloom-contribution'],
 '{"type":"set-archetype","payload":{"archetypeId":"app-digital-tool","seedKanban":[
   {"title":"Pick your domain and write a one-line theme concept","listKey":"todo"},
   {"title":"Gather 10 mood images and pin them to a board","listKey":"todo"},
   {"title":"Draft a 5-colour palette with hex codes + reason for each","listKey":"todo"},
   {"title":"Write 5 starter prompts a student in this theme would see","listKey":"todo"}
 ]}}'::jsonb,
 TRUE, TRUE),

('g8-brief-scaffold', 'Design a Scaffold',
 'Design a new tool that helps students when they''re stuck.',
 'Pick a moment when a student gets stuck. Design the tool that helps. Define what triggers it, what the student sees, what the AI does, what fades when.

**You''ll deliver:** paper prototype + 2-min walkthrough video + spec sheet.
**Ships?** If strong, yes — into the platform as a real student scaffold.',
 '🪜', '#A8D5BA',
 ARRAY['brief', 'g8', 'design-pathway', 'studioloom-contribution'],
 '{"type":"set-archetype","payload":{"archetypeId":"app-digital-tool","seedKanban":[
   {"title":"Name the stuck moment your scaffold fixes (one sentence)","listKey":"todo"},
   {"title":"Sketch the flow: trigger, student view, AI behaviour","listKey":"todo"},
   {"title":"Draft the prompt text the student reads when it triggers","listKey":"todo"},
   {"title":"Make a paper prototype of the screen","listKey":"todo"}
 ]}}'::jsonb,
 TRUE, TRUE),

-- ─────────────────────────────────────────────────────────────────────
-- Physical-making path
-- ─────────────────────────────────────────────────────────────────────
('g8-brief-1m2-space', 'Redesign 1m² of Space',
 'Pick a real square metre and redesign it for a specific user.',
 'Reading nook, bus stop, homework corner, café table — pick one. Redesign for a named user.

**You''ll deliver:** 1:5 scale model + plan view + 2 detail shots.',
 '🏠', '#C7A8E0',
 ARRAY['brief', 'g8', 'design-pathway', 'physical-making'],
 '{"type":"set-archetype","payload":{"archetypeId":"architecture-interior","seedKanban":[
   {"title":"Choose the zone and the specific user (name + age + situation)","listKey":"todo"},
   {"title":"Sketch 3 different layouts from above","listKey":"todo"},
   {"title":"Pick the layout you''ll build and list materials for the 1:5 model","listKey":"todo"},
   {"title":"Source cardboard / foamboard / glue / craft knife before next class","listKey":"todo"}
 ]}}'::jsonb,
 FALSE, TRUE),

('g8-brief-desktop-object', 'Design a Desktop Object',
 'Observe someone''s desk. Find a real frustration. Design the object that fixes it.',
 'Watch someone use their desk for 10 min. Pick a real frustration you observed. Design the object.

**You''ll deliver:** working prototype + user-test write-up.',
 '📐', '#F5B96D',
 ARRAY['brief', 'g8', 'design-pathway', 'physical-making'],
 '{"type":"set-archetype","payload":{"archetypeId":"toy-design","seedKanban":[
   {"title":"Watch someone''s desk for 10 min. Note 5 frustrations","listKey":"todo"},
   {"title":"Pick the frustration to solve. Write a one-sentence problem statement","listKey":"todo"},
   {"title":"Sketch 3 different solutions","listKey":"todo"},
   {"title":"List materials + tools needed for prototype","listKey":"todo"}
 ]}}'::jsonb,
 FALSE, TRUE),

('g8-brief-board-game', 'Design a Board Game',
 '3 rules max. Plays in 10 minutes. 2–4 players.',
 '3 rules. 10 minutes per game. 2–4 players. Real prototype people can pick up and play.

**You''ll deliver:** playable prototype + 1-page rulebook + 3 playtester quotes.',
 '🎲', '#82B8E0',
 ARRAY['brief', 'g8', 'design-pathway', 'physical-making'],
 '{"type":"set-archetype","payload":{"archetypeId":"toy-design","seedKanban":[
   {"title":"Pick your core mechanic (roll-and-move / set-collection / push-your-luck / hidden-info)","listKey":"todo"},
   {"title":"Draft the 3 rules — write so a 10-year-old could follow","listKey":"todo"},
   {"title":"Sketch the board and pieces on A3","listKey":"todo"},
   {"title":"Cut pieces from cardboard and test ONE round with yourself","listKey":"todo"}
 ]}}'::jsonb,
 FALSE, TRUE);

-- Sanity check — RAISE NOTICE so apply-migration logs make the count visible.
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM choice_cards
  WHERE is_seeded = TRUE AND id LIKE 'g8-brief-%';
  IF v_count < 6 THEN
    RAISE EXCEPTION 'Seed migration failed: expected 6 g8-brief-* rows, found %', v_count;
  END IF;
  RAISE NOTICE 'Seed migration applied OK: % g8-brief-* cards in library', v_count;
END $$;
