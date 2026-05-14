-- ────────────────────────────────────────────────────────────────────
-- G7 problem-first cards — seed script for Choice Cards block
-- ────────────────────────────────────────────────────────────────────
--
-- 11 cards (10 friction prompts + 1 "Pitch your own" sentinel).
-- The "restless hands" card was added 14 May 2026 as a redirect for
-- a student who walked in wanting to make fidget toys — it captures
-- the underlying friction (need motion to focus) without naming the
-- form, so the student investigates the workaround pattern first.
--
-- Each card uses on_pick_action.type = 'commit-to-friction', which is
-- a NEW event type that today's resolvers (extractArchetypeId,
-- extractSeedKanban) ignore — by design. The pick is recorded in
-- choice_card_selections but no archetype is suggested, so when the
-- student reaches Product Brief in lesson 7 they go through the
-- normal archetype picker. That's the engineering test: ship the
-- framing change without touching code.
--
-- The "Pitch your own friction" sentinel uses the same
-- 'pitch-to-teacher' action as G8's existing sentinel so existing
-- pitch routing (if any) continues to work.
--
-- Frictions selected to AVOID the Scope Chasm failure mode (Gemini):
-- mid-level, frequent, observable workarounds. Not "climate change",
-- not "my brother is annoying".
--
-- Run via Supabase SQL Editor on prod. is_seeded = true marks these
-- as platform-seeded (same as G8 cards). created_by = NULL because
-- they're shared, not owned by one teacher.
--
-- Idempotent: ON CONFLICT (id) DO NOTHING so re-running is safe.

INSERT INTO choice_cards
  (id, label, hook_text, detail_md, emoji, bg_color, tags,
   on_pick_action, ships_to_platform, is_seeded, version)
VALUES
  ('g7-friction-stuff-forgotten',
   'Stuff that gets forgotten',
   'PE kit, lunch, homework — left at home or at school.',
   E'People forget things on the way out the door. Sometimes it''s the same thing every week. Sometimes there are weird workarounds (writing on hands, alarms, asking a sibling). What''s the friction *underneath* the forgetting?',
   '🎒', '#FEF3C7', ARRAY['friction','g7'],
   '{"type":"commit-to-friction","payload":{"friction_label":"Stuff that gets forgotten"}}'::jsonb,
   false, true, 1),

  ('g7-friction-chaotic-mornings',
   'Mornings before school feel chaotic',
   'Everyone trying to leave at the same time, things going wrong.',
   E'Toothbrush, shoes, uniform, breakfast, bag — and somebody''s late. What actually breaks down? Is it the bathroom queue? The bag-pack the night before? The decisions that take too long when you''re sleepy?',
   '🌅', '#FED7AA', ARRAY['friction','g7'],
   '{"type":"commit-to-friction","payload":{"friction_label":"Mornings before school feel chaotic"}}'::jsonb,
   false, true, 1),

  ('g7-friction-dog-walking-weather',
   'Walking the dog when it''s freezing or pouring',
   'The dog still needs out. You don''t want to be out.',
   E'Plenty of people do this every day in weather they''d rather not be in. What workarounds do they invent? What gets wet, cold, or annoying? What''s the *real* friction — the cold? The wet leash? The dog refusing? The carrying-stuff-while-holding-a-leash problem?',
   '🐕', '#BFDBFE', ARRAY['friction','g7'],
   '{"type":"commit-to-friction","payload":{"friction_label":"Walking the dog when it''s freezing or pouring"}}'::jsonb,
   false, true, 1),

  ('g7-friction-rain-failures',
   'Things that should work in the rain but don''t',
   'Umbrellas turning inside-out, soggy backpacks, slippery shoes.',
   E'Rain breaks a surprising amount of stuff. Wet shoes, ruined paper homework, phones acting weird, glasses fogging. What''s the friction that bugs *one specific person* more than others? An athlete? A commuter? Someone with glasses?',
   '🌧️', '#A5F3FC', ARRAY['friction','g7'],
   '{"type":"commit-to-friction","payload":{"friction_label":"Things that should work in the rain but don''t"}}'::jsonb,
   false, true, 1),

  ('g7-friction-after-meal-cleanup',
   'Cleaning up after a meal takes forever',
   'The dishes, the wiping, the leftovers, the bin.',
   E'A meal takes 30 minutes; cleaning up takes 30 minutes. Where''s the friction concentrated? Reaching the back of the fridge? Stacking dishes without dropping them? Knowing what''s still good vs leftover-too-long? The bin lid being awkward?',
   '🍽️', '#FECACA', ARRAY['friction','g7'],
   '{"type":"commit-to-friction","payload":{"friction_label":"Cleaning up after a meal takes forever"}}'::jsonb,
   false, true, 1),

  ('g7-friction-far-grandparents',
   'Grandparents far away miss family moments',
   'Photos and calls help, but a lot still falls through.',
   E'Grandparents in another country see grandchildren grow up through a phone screen. What do they miss? What workarounds have they invented (printed photos, scheduled calls, video albums)? What does the *grandchild* miss about not living near them?',
   '👵', '#FBCFE8', ARRAY['friction','g7'],
   '{"type":"commit-to-friction","payload":{"friction_label":"Grandparents far away miss family moments"}}'::jsonb,
   false, true, 1),

  ('g7-friction-too-many-things',
   'Carrying too many things at once',
   'School bag, water bottle, instrument, lunch, PE kit.',
   E'Some days you''re a walking pile of stuff. Where does it actually fail? Dropping water bottles? The straps cutting into shoulders? Having no hands left for the door? Forgetting one item because it doesn''t fit?',
   '🎒', '#DDD6FE', ARRAY['friction','g7'],
   '{"type":"commit-to-friction","payload":{"friction_label":"Carrying too many things at once"}}'::jsonb,
   false, true, 1),

  ('g7-friction-plants-while-away',
   'Plants die when the family goes on holiday',
   'A week away and the basil is brown.',
   E'Lots of people have this. Some use string-in-water tricks, some pay neighbours, some just buy new plants. What''s the underlying friction? The watering itself? Knowing how *much*? Different plants needing different amounts? Just remembering?',
   '🪴', '#BBF7D0', ARRAY['friction','g7'],
   '{"type":"commit-to-friction","payload":{"friction_label":"Plants die when the family goes on holiday"}}'::jsonb,
   false, true, 1),

  ('g7-friction-finding-lost-things',
   'Lost things — keys, AirPods, water bottles',
   'Where did I put it? Did I leave it at school?',
   E'Some things vanish weekly. People invent tricks: AirTags, designated spots, "the bowl by the door". What''s the actual breakdown? Forgetting to put it in the spot? Forgetting where the spot is? Multiple spots competing?',
   '🔑', '#FDE68A', ARRAY['friction','g7'],
   '{"type":"commit-to-friction","payload":{"friction_label":"Lost things — keys, AirPods, water bottles"}}'::jsonb,
   false, true, 1),

  ('g7-friction-restless-hands',
   'Hands that need to move to listen',
   'Bouncing legs, clicking pens, twisting hair — people invent fidgets to focus.',
   E'Watch any class or meeting and count: how many people have hands or feet moving? People who need motion to concentrate have invented makeshift fidgets for decades — pen clickers, paper folders, hair twisters, bouncing legs. What does *one specific person* need? When does their workaround actually work, and when does it fail — gets told off, breaks the pen, distracts someone else, looks weird? What kinds of motion help them focus, and what kinds don''t?',
   '🤲', '#E0E7FF', ARRAY['friction','g7'],
   '{"type":"commit-to-friction","payload":{"friction_label":"Hands that need to move to listen"}}'::jsonb,
   false, true, 1),

  ('_pitch-your-own-friction',
   'Pitch your own friction',
   'Didn''t see your friction here? Tell us what you noticed.',
   E'You spotted a friction in the wild that''s not on these cards. Pitch it: who experiences it, where, and what workaround they invented. Your teacher will read it and decide whether to add it to the deck.',
   '💡', '#FECDD3', ARRAY['friction','g7','pitch','sentinel'],
   '{"type":"pitch-to-teacher"}'::jsonb,
   false, true, 1)

ON CONFLICT (id) DO NOTHING;

-- Verification queries:
--
-- SELECT id, label, on_pick_action FROM choice_cards
-- WHERE 'g7' = ANY(tags) ORDER BY id;
--
-- SELECT count(*) FROM choice_cards WHERE 'g7' = ANY(tags);
-- -- expect 11
--
-- After inserting, wire these into the G7 unit's Choice Cards block
-- via the lesson editor — set cardIds[] on the block config to:
-- ['g7-friction-stuff-forgotten', 'g7-friction-chaotic-mornings',
--  'g7-friction-dog-walking-weather', 'g7-friction-rain-failures',
--  'g7-friction-after-meal-cleanup', 'g7-friction-far-grandparents',
--  'g7-friction-too-many-things', 'g7-friction-plants-while-away',
--  'g7-friction-finding-lost-things', 'g7-friction-restless-hands',
--  '_pitch-your-own-friction'].
