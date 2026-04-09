# Loominary — Blue Sky Applications
## Cutting-Edge Ideas for the 3D Engine Platform

**Date:** April 2026  
**Status:** Future Vision / R&D Exploration  
**Context:** Built on R3F + Supabase + Claude API + Next.js  

---

## 1. AI-Generated Worlds from Student Briefs

Student types "I'm designing a water bottle for hikers who climb mountains in hot weather." Claude generates a Designville scene: a mountain trail, a sweating hiker NPC, a broken water bottle on the ground, a stream they can't drink from. The world *is* the brief. The AI doesn't just create text — it creates an environment to explore, a character to empathize with, and a problem to discover. Every student gets a unique world generated from their specific design context.

**Technical path:** Claude API generates the scene JSON (environment, character, props, dialogue) from a natural language prompt. The renderer composes the scene from the asset library. The Discovery Builder format we already designed is the target schema.

**Feasibility:** High. The hardest part is curating the asset library to be large enough for diverse scene generation. The AI generation itself is straightforward prompt engineering.

---

## 2. Digital Twin Prototyping

Student builds a physical prototype in the workshop, photographs it from a few angles, and an AI model reconstruction tool (Luma, Tripo3D, Meshy) generates a rough .glb. That model appears in their Designville world — Rosa is literally holding the student's actual prototype in her 3D hands, testing it, reacting to it. The gap between physical making and digital feedback collapses.

**Technical path:** Student uploads photos → cloud reconstruction API → .glb file → loaded into R3F scene via useGLTF. NPC animation system positions the model in the character's hands.

**Feasibility:** Medium. Reconstruction tools are improving rapidly. Quality varies. Works well for simple geometric prototypes, less well for organic shapes. Cost per reconstruction currently ~$0.10–0.50 via API.

---

## 3. Live Audience Testing in the Gallery

During Exhibition Night, parents don't just view — they *use*. A parent walks up to a student's displayed prototype in the 3D gallery, and a feedback form appears contextually: "How easy would this be to hold with one hand? Rate 1–5." The student gets real user testing data from their gallery visitors, mapped to their Evaluate phase tasks. The exhibition becomes a live research session.

**Technical path:** Proximity detection in the multiplayer gallery triggers a React overlay feedback form. Responses stored in Supabase, linked to the student's project and the Evaluate phase. Real-time aggregation shows the student a dashboard of responses.

**Feasibility:** High. We already have proximity detection and the multiplayer gallery. Just needs a feedback overlay and data pipeline. Could ship with the gallery MVP.

---

## 4. Voice NPCs Powered by Claude

Rosa doesn't read from a script — she *is* Claude, with a system prompt that says "You are Rosa, a baker in Designville. You have a cup problem. The student is in the Inquire phase. Respond naturally to their questions. Stay in character. Guide them toward understanding the problem without giving solutions." The student has a real conversation. They ask "How many cups do you sell per day?" and Rosa answers with fabricated-but-consistent data. Combined with ElevenLabs (already used for the james2 project), Rosa speaks aloud in a warm voice. The NPC becomes an AI-powered interview subject the student practices real inquiry skills on.

**Technical path:** Claude API with character system prompt → text response → ElevenLabs TTS → Howler.js playback. Character animation system triggers talk/gesture animations synced to audio duration. Conversation history maintained per session for consistency.

**Feasibility:** High. All components exist independently. The integration is the work. Latency is the main UX challenge (2–4 seconds for Claude + TTS). Could mitigate with streaming responses + partial audio playback.

**MYP alignment:** This is potentially transformative for the Inquire phase. Students practice real interview skills on AI characters before interviewing real people. The AI can be programmed to give vague answers (like real clients) forcing students to ask better follow-up questions.

---

## 5. Procedural Problem Generation

Instead of hand-authored quests, the system generates novel design problems by combining constraint variables:

- **User:** elderly, child, athlete, teacher, wheelchair user, visually impaired
- **Context:** kitchen, playground, transit, classroom, hospital, outdoor
- **Object:** seating, packaging, tool, clothing, container, signage
- **Constraint:** low cost, biodegradable, one-handed, waterproof, portable, flat-pack

Example output: "Design a one-handed waterproof packaging solution for a child on public transit."

A unique NPC is generated with a backstory that justifies exactly why they need this. Every student in the class gets a different problem. No two design briefs are ever the same.

**Technical path:** Constraint matrix → Claude generates NPC profile + dialogue + quest structure → scene composed from asset library. Teacher sets the constraint categories and difficulty level, system generates the combinations.

**Feasibility:** High. This is mostly prompt engineering + the Discovery Builder pipeline we already have. The constraint matrix is the novel contribution.

**Differentiation:** No other education platform offers procedurally generated design briefs with narrative context. This could be a headline feature.

---

## 6. WebXR — Walk Into Designville

R3F has first-class WebXR support. The same scene renders in a Meta Quest headset through the browser — no app install. Student puts on a headset, walks around Rosa's bakery in actual 3D space, picks up the cups, looks at them at eye level. Exhibition Night becomes a VR experience parents can attend from home.

**Technical path:** drei has `<XR>`, `<Controllers>`, and `<Hands>` components. The same scene code works — just add the XR provider wrapper. Hand tracking allows natural interaction (pick up calipers, measure the cup).

**Feasibility:** Medium. The code is trivial. The hardware dependency is the bottleneck — schools need headsets. However, WebXR also works on phones (hold phone up, see 3D scene through camera = AR mode). Phone-based AR is more accessible.

**Timeline:** Code-ready now. Deployment-ready when schools have hardware. Worth building a demo for investor presentations.

---

## 7. Design Replay System

Record the student's entire design journey as a time-lapse through the world. Every task completed, every measurement taken, every sketch uploaded — each event gets a timestamp and a position in the 3D world. At the end of the project, the student watches their avatar walk through the journey: entering the bakery, talking to Rosa, picking up calipers, moving to the workshop, sketching at the bench, building at the forge, returning to Rosa with the prototype.

It's a visual process journal that plays like a cinematic. MYP assessors watching this would lose their minds — it's direct evidence of the Design Cycle in action, rendered as a walkable narrative.

**Technical path:** Event log table in Supabase (timestamp, event_type, position, metadata). Replay system reads the log and animates the avatar along the recorded path with camera following. Key events trigger scene changes (sketches appear on wall, prototype materializes on bench).

**Feasibility:** High. Event logging is simple. The replay renderer is a scripted camera system we've already built. The key insight is mapping abstract project events to physical positions in the 3D world.

**MYP alignment:** Strand D (Evaluating) and ATL skills documentation. This could replace or supplement the traditional process journal for assessment purposes.

---

## 8. Cross-School Shared Worlds

Designville isn't one village — it's a network. A school in Nanjing has their village. A school in Tokyo has theirs. A bridge connects them. Students can visit each other's galleries, see different design problems, leave guestbook messages. A student in Tokyo solved a similar cup problem — your student can see their approach.

IB's global mindedness goal achieved through a shared game world.

**Technical path:** Supabase Realtime already supports cross-tenant data sharing. Each school's village is a scene with a portal/bridge to other schools. Gallery exhibitions can be set to "public" to allow cross-school visits. Guestbook and reaction systems already built.

**Feasibility:** Medium. Technical implementation is straightforward. The challenges are governance (content moderation across schools), privacy (student work visibility), and coordinating exhibition schedules across time zones.

**IB alignment:** International-mindedness, global engagement, intercultural understanding. This is a flagship IB talking point.

---

## 9. Emotional AI Adaptation

The system reads engagement signals: how fast is the student moving through the world? Are they reading dialogue carefully or skipping? Have they been stuck on the same task for three sessions? Did they just fail a measurement? The world responds.

- Disengaged: Tomás runs up — "Hey! Rosa's been asking about you. She's worried you gave up on her cup problem."
- Rushing: Mayor Lin appears — "Slow down, designer. The best solutions come from deep thinking, not speed."
- Stuck: Auntie Mei wanders over — "When I get stuck in the garden, I take a different path. Have you tried looking at this from the user's perspective?"
- Succeeding: Rosa's bakery gets busier, more NPCs appear, the world feels more alive.

**Technical path:** Engagement scoring model based on session metrics (time per task, skip rate, revisit patterns, idle time). Score triggers NPC intervention events. Each intervention is a short dialogue with contextual advice.

**Feasibility:** Medium. The metrics collection is simple. The challenge is tuning the intervention thresholds so they feel helpful rather than annoying. Needs user testing with real students.

**Differentiation:** The world itself becomes a formative assessment tool and motivation engine. No other platform has the game world respond to student engagement patterns.

---

## 10. Physical-Digital Craft Bridge

Student is at the workbench building a prototype. Their phone is propped up running Loominary. The camera watches them work (with permission). Computer vision identifies when they pick up a tool, make a cut, or measure something. The quest journal auto-checks tasks: "✓ Built prototype" appears because the system saw them building.

Rosa's PiP companion reacts in real time: she leans in when they start cutting, winces when they almost drop something, claps when the prototype takes shape.

**Technical path:** MediaPipe or TensorFlow.js for hand/object detection in browser. Activity classification model trained on workshop actions (cutting, measuring, gluing, sanding). Events piped to the quest state machine.

**Feasibility:** Low-Medium. The CV models exist but accuracy in a messy workshop environment is challenging. Lighting, angles, and object variety make this hard. More realistic as a future R&D project than a near-term feature.

**Alternative:** Simpler version — student takes a photo of their work-in-progress, Claude Vision analyzes it and provides feedback through Rosa: "I can see you've cut the cardboard. The edges look clean! But the fold line seems off-center — want me to help you measure?"

---

## 11. 3D Design Thinking Toolkit — Spatial Ideation

Design thinking tools that are normally flat text exercises become spatial, visual, interactive experiences inside the 3D engine. The concept being designed exists as a live 3D object that students manipulate through structured creative frameworks.

### SCAMPER in 3D

Student runs SCAMPER on Rosa's coffee cup. Each SCAMPER prompt transforms the 3D model in real-time:

- **Substitute:** Tap "material" → swap paper to bamboo, cork, silicone. The cup visually changes texture, color, and translucency. Material properties card shows thermal conductivity, cost, and environmental impact.
- **Combine:** Merge the sleeve into the cup wall. Combine the lid with a drinking spout. The model morphs to show the integration.
- **Adapt:** Import a feature from another object. "What if it had the grip texture of a tennis racket?" The cup surface updates with a cross-hatch pattern.
- **Modify/Magnify:** Scale the handle, thicken the walls, extend the height. Sliders control dimensions and the model updates live. Proportions visually obvious.
- **Put to another use:** The cup rotates and appears in different contexts — plant pot, pen holder, measuring scoop. Scene changes around the same object.
- **Eliminate:** Remove the handle, the base, the rim. Each removal shows structural consequences — does it still stand? Does it still hold liquid?
- **Reverse:** Flip the taper (wide bottom, narrow top), invert the insulation layer to the outside, reverse the lid direction. Unexpected perspectives emerge.

Each SCAMPER action generates a snapshot saved to the student's ideation log. At the end, they have a visual gallery of 7+ concept variations — not text descriptions, but actual 3D models they can compare side-by-side, rotate, and evaluate.

### Six Thinking Hats in 3D

The entire environment shifts to reflect the current thinking mode:

- **White Hat (Facts):** Clinical bright lighting, neutral white surfaces. Data cards float around the object showing dimensions, material specs, cost data. The scene feels like a lab.
- **Red Hat (Feelings):** Warm emotional glow, soft lighting. NPCs appear expressing how the product makes them feel. Rosa holds the cup and her expression changes. Ambient music shifts to emotional.
- **Black Hat (Risks):** Dark shadows, dramatic lighting highlighting weak points. Cracks appear on stress points. Warning labels float near hazards. The forge fire flickers ominously.
- **Yellow Hat (Benefits):** Golden sunshine, optimistic lighting. Benefits float as glowing cards. NPCs smile. The scene feels hopeful.
- **Green Hat (Creativity):** The world becomes surreal — objects float, colors shift, impossible combinations appear. This is the SCAMPER mode. Wild ideas encouraged by the environment itself.
- **Blue Hat (Process):** Overhead view, the Design Cycle phases appear as rooms or zones. The student sees where they are in the process and what's next. Meta-cognitive reflection mode.

### Mind Mapping as 3D Constellation

Ideas aren't nodes on a flat page — they're stars in a 3D constellation. Related concepts cluster spatially. The student can walk between idea clusters, zoom into a cluster to see sub-ideas, and draw connections between distant concepts by creating visible beams of light between stars. Physical proximity = conceptual proximity. The spatial layout itself becomes a thinking tool.

### Decision Matrix as 3D Comparison

Competing concepts appear as 3D objects on pedestals. The student sets criteria (cost, durability, eco-friendliness, user comfort) and rates each concept. The pedestals rise or lower based on scores. The winning concept literally stands tallest. Students can rotate each concept, examine it from angles, and adjust scores as they notice details they missed.

### Biomimicry Explorer

Student asks "How does nature solve insulation?" The world transforms into a nature scene. A polar bear appears — tap it to see how hollow fur traps air for insulation. A penguin huddle shows collective thermal management. A lotus leaf demonstrates surface engineering. Each natural example links back to the design problem with a "Apply this to Rosa's cup?" prompt that generates a concept sketch.

**Technical path:** Each toolkit is a React component wrapping the R3F canvas. The 3D model being designed is a shared state object with swappable geometry, materials, and modifiers. SCAMPER/Hats/Matrix modes are scene presets that change lighting, environment, and overlay UI. Claude API can suggest transformations ("What if you substituted cork?" → material swap with explanation).

**Feasibility:** High for SCAMPER and Decision Matrix (direct model manipulation). Medium for Six Thinking Hats (environmental presets + NPC emotional animation). Medium for Mind Mapping (3D spatial layout with interaction). Low for Biomimicry (requires a curated database of nature examples with 3D models).

**MYP alignment:** Strand B (Developing Ideas) directly. SCAMPER and mind mapping are explicitly referenced in MYP Design guides. Making these tools 3D and interactive transforms them from worksheet activities into genuine creative experiences.

---

## Priority Matrix

| Idea | Impact | Feasibility | Priority |
|------|--------|-------------|----------|
| Voice NPCs (Claude + ElevenLabs) | Very High | High | **P1 — Ship early** |
| Live Audience Testing in Gallery | High | High | **P1 — Ship with gallery** |
| AI-Generated Worlds | Very High | High | **P1 — Core differentiator** |
| 3D Design Thinking Toolkit | Very High | High | **P1 — Core differentiator** |
| Procedural Problem Generation | High | High | **P2 — After core quests** |
| Design Replay System | High | High | **P2 — After event logging** |
| Emotional AI Adaptation | Medium | Medium | **P3 — After user testing** |
| Digital Twin Prototyping | High | Medium | **P3 — When reconstruction APIs mature** |
| Cross-School Shared Worlds | Very High | Medium | **P3 — After multi-school adoption** |
| WebXR / VR | Medium | Medium | **P4 — Demo for investors** |
| Physical-Digital Craft Bridge | Medium | Low | **P5 — R&D project** |

---

## Notes

- All ideas build on the existing R3F + Supabase + Claude API stack
- No idea requires a separate game engine or codebase
- Most P1/P2 ideas could be prototyped in 1–2 weeks each
- The asset library and tutorial system are prerequisites for most of these
- Voice NPCs + AI-generated worlds + 3D Design Toolkit together could be the product's defining feature trio
- SCAMPER in 3D alone could be a standalone selling point for schools — no other platform visualises ideation frameworks
