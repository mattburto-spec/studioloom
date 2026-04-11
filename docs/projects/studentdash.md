# StudentDash — Student Dashboard Reimagination

> **Status:** 🔴 Active — direction chosen, 2 prototypes built, open questions parked
> **Priority:** P1 (post-Dimensions3)
> **Category:** Student XP
> **Created:** 9 April 2026
> **Updated:** 10 April 2026 — Second prototype (Miro-Bench variant) built; see *Prototype v2* section below

---

## Prototype v2 (10 April 2026) — Miro-Bench Variant

A second, lighter-weight take at `docs/dashboard/r3f-motion-sample.html` (single-file HTML, React 18 + R3F + Framer Motion via esm.sh import map). This version pivots away from the dark studio room toward a **flat 2D Miro-style workbench** with a single 3D object embedded in it. Built to explore whether the "workspace not LMS" feeling still holds when the 3D is reduced to a single accent object rather than a full scene.

### What was built
- **Flat wood workbench** filling the viewport — lighter tan gradient (`#e8b87a → #d09858 → #a6703a`), wood-grain via `repeating-linear-gradient` + SVG turbulence filter, hand-placed bench marks (rings, scratches, paint blobs, dust), soft edge vignette. Feels like a top-down Miro board with a worn-workshop skin.
- **One R3F 3D object — a low-poly boombox speaker** sitting in the top-right corner. Built with ~10 flat-shaded meshes (body, 2 octagonal speaker cones + domes, display, knobs, half-torus handle, antenna, feet). Fixed camera at `[1.6, 3.6, 2.2]` fov 30 looking down onto the top of the speaker so the handle and top face read clearly. Fake contact shadow via dark circle. Draggable — because the R3F camera is fixed inside its own Canvas, dragging just translates the rendered bitmap and the perspective stays identical everywhere on screen.
- **3D badge button** in the bottom-right — a low-poly hex gold medal with a bevelled front face, inset centre disc, 5 raised star-point boxes, red ribbon flap, and loop at top. Hover boosts emissive intensities on rim/face/star, bumps pointLight from 1.0 → 3.5, fades in a blurred radial CSS glow behind it, warms the "BADGES" pill label cream → amber, and scales the anchor 1.06× via Framer. Click is a placeholder (`console.log`) — ready to wire to a real route.
- **Three draggable student cards** with interactive corners:
  1. **Current Unit** — Bluetooth Speaker, lesson 4 of 7, progress bar, "Due Fri 17 Apr"
  2. **Next Step** — "Sketch 3 form variations", points to Ideate toolkit → Morphological chart, ~25 min
  3. **Feedback · Ms. Chen** — mentor quote + concrete adjustment suggestion, timestamp

### Card interaction model (worth keeping)
- **Drag** with `dragConstraints={constraintsRef}` on `.cards-layer` (covers viewport) + `dragElastic: 0.25` — cards pulled off-screen spring back into view instead of getting lost.
- **Rotate** via a single top-right corner handle with `↻` glyph. Pointer-down computes the angle from the card's centre to the cursor; move event rotates around centre with ±180° seam unwrap so continuous spinning past a full turn feels smooth.
- **Resize** via bottom-right corner with diagonal stripes. Averages x+y delta for natural diagonal feel, clamps scale 0.6×–1.8×.
- **Snap-to-stack** on `onDragEnd`: finds nearest sibling via a shared `registry` ref, if within 140px snaps to `(+26, +22)` offset and `+2°` rotation so you can see a sliver of the card underneath. Bumps a `zCounter` so the dragged card pops to front.
- **No-drag-during-corner-use** — `drag={!cornerActive}` toggles off card body drag when a corner handler fires, so resize/spin don't fight the drag gesture.
- **Iteration notes from this session:** started with 4 corners (3 rotate + 1 resize), dropped to 1 rotate corner + 1 resize corner because 4 was visual clutter. First version used `onWheel` for rotation but it was unintuitive — corner grab-and-spin reads as a clear affordance.

### Which prototype wins?
**Not decided yet.** Prototype v1 (dark Studio Desk room with 5 cards) feels like a *place*; prototype v2 (flat Miro bench with 1 3D accent + badge) feels like a *workspace* you'd actually use day-to-day. Student testing should compare both. The Miro-Bench variant is cheaper to ship because:
- Only one R3F Canvas instead of a full 3D scene — much lower GPU load on school devices.
- Flat 2D CSS bench is trivially responsive.
- Cards are standard Framer Motion motion.divs — easy to iterate.
- The "one 3D thing" pattern (speaker in corner, badge in corner) is a reusable primitive — we could add more 3D anchors later (e.g. 3D trophy shelf, 3D sketchbook spine, 3D mentor avatar) without committing to a scene-level rebuild.

### Reusable primitives to come back to
1. **Flat workbench surface** — the wood-grain + turbulence + bench-marks + vignette recipe is strong and cheap.
2. **Fixed-camera R3F anchor in a draggable motion.div** — embeds 3D at any screen position without perspective distortion. Good pattern for putting 3D accents in 2D UIs.
3. **Hover-glow 3D badge** — emissive + pointLight + CSS radial glow. Great for nav entry points (Badges, Portfolio, Mentor, Journal) where each could be a distinct 3D object in its own corner.
4. **Single-corner card interactivity** — rotate corner + resize corner + snap-to-stack. Cleaner than Miro's 8-handle selection UI.
5. **Snap-to-stack via shared registry ref** — cards communicate positions through a ref map on the parent, not through state. Enables cross-card behaviours (stacking, magnetic alignment, grouping) without re-renders.
6. **Student content cards > unit thumbnails** — Current Unit / Next Step / Feedback is more actionable than 3 unit cards. Cards should answer "what now?" not "what's there?".
7. **Focus mode toggle** — iOS-style pill switch in the header-right area. When on: every non-essential element (speaker, badge, other cards, header title) fades to opacity 0 with pointer-events disabled; the Next Step card springs to screen centre at 1.35× scale with rotation zeroed via framer-motion's imperative `animate()`. Current position/rotate/scale are snapshotted to a `savedRef` at the moment focus turns on, so toggling off flies the card back to exactly where it was — drag it anywhere, resize it, rotate it, hit focus, hit focus again, and it returns to the exact prior state. The toolbar + focus toggle stay visible so the user can always turn it off. This is a reusable primitive: any complex dashboard can have a single "what matters right now" mode that doesn't destroy state.

### What's NOT in v2 (intentional)
- No designer mentor presence (parked — v1 has this)
- No XP/skill rings (parked — v1 has this)
- No project growth visualisation (parked — this is v1's Growth-over-Gamification hook)
- No recent captures gallery (parked)
- No map/trail mode (parked)

### Open questions from v2
7. Should the 3D object change per unit (e.g. speaker → chair → lamp as student switches current unit)? Or stay as a "current build" slot that auto-generates 3D from student photos?
8. Is one accent 3D object enough, or does it need a small cluster (speaker + badge + trophy + mentor avatar)?
9. Does the snap-to-stack metaphor translate to touch? On tablet, drop targets might need to be more generous.
10. Can the bench host non-card objects too (sticky notes, pinned images, voice memos as icons)?

---

## Chosen Direction (10 April 2026) — Studio Desk

After exploring the 7 directions below, **Studio Desk** is the chosen direction. Source files: `docs/dashboard/studio-desk-session-summary.docx`, `docs/dashboard/studio-desk-references.docx`, `docs/dashboard/student-workspace.jsx` (working React + Three.js prototype).

### What was built
A working React + Three.js prototype (`student-workspace.jsx`) with:
- **3D desk scene** — dark wood surface, PCF soft shadow mapping, physical objects (pencil cup with coloured pencils, sketchbook with spiral binding, ruler, micro:bit with glowing LEDs). Warm directional light, fill light, ambient light. Sits as atmospheric background layer, fading upward with a mask gradient.
- **Five draggable frosted-glass cards** over the desk — each lifts with shadow boost and slight rotation when grabbed, settles back on release. Pointer-event based:
  1. **Next Action** — current design cycle phase, progress ring, sessions remaining
  2. **AI Mentor** — matched designer (Dieter Rams in prototype), trait match %, current prompt
  3. **Recent Captures** — thumbnail grid with AI annotation preview
  4. **Project Progress** — 4-phase design cycle checklist (Research → Plan → Develop → Evaluate)
  5. **XP & Skills** — three skill rings (Making, Thinking, Iterating), Open Studio unlock progress
- **Visual treatment** — dark warm palette (workshop at night), backdrop-blur glass, amber/copper accent (#C4763A), DM Sans + DM Serif Display, subtle grain overlay.

### Key decision: Growth over Gamification
**Apple closing rings considered and rejected.** What they get right: the close is the reward, multiple dimensions, colour as identity. But the fundamental issue is rings still have a "hit your target" energy — they frame learning as a daily grind to complete.

The philosophical distinction:
- **Gamification** says "You need to do X to earn Y" — motivates through obligation
- **Growth** says "Here's what's happened so far, look what it's becoming" — motivates through curiosity

Three growth metaphors explored: (1) plant on desk, (2) thickening sketchbook, (3) structure being built. **Landed decision:** the growing/building object is the **student's actual project**. If they're building a Bluetooth speaker, they see a speaker slowly assembling on their desk — raw materials → housing → components → finished object. This ties abstract process evidence to the concrete thing being made, communicates "what stage am I at" without a progress bar, and creates personal attachment.

### The Map — parked, not killed
The journey map concept from *Direction 2* below is still interesting but shouldn't compete with the desk for screen space. Two integration options:
- **Mode flip** — desk is main view, map is separate mode (flip the desk, pull open a drawer). Same screen, different layer.
- **Translucent underside** — tilt camera down and desk becomes translucent, revealing the journey path underneath. Desk objects sit at a specific point along that path.

Core principle: **the desk is where you work, the map is where you reflect.** Most days you don't need the map. But when you do, it's right there — not a separate page.

### External design references (6)
From `studio-desk-references.docx`, six products with "steal this" takeaways:
- **Miro / FigJam** — infinite canvas as workspace; spatial position carries meaning. *Steal:* the dashboard IS the workspace, not a portal to one.
- **Things 3** — restraint and typography create physicality. *Steal:* substantial cards, desk surface showing through, generous spacing.
- **Forest App** — living 3D object replaces progress bar; emotional stake in growth/withering. *Steal:* desk objects change with progress (sketchbook thickens, pencils shorten, micro:bit LEDs light up as skills unlock).
- **Animal Crossing (inventory/home)** — drag-and-place with physics feedback, arranging as play. *Steal:* cards feel like objects you place, not windows you tile. Snap zones, gentle bounce, sound feedback.
- **Minecraft Education Edition** — portfolio embedded in the world, not a separate UI layer. *Steal:* don't separate "work" from "reflection on work" — dashboard feels like part of the studio, not an admin panel.
- **Notion Gallery View** — cover images as corkboard. *Steal:* use actual student work (photos, sketches) as Recent Captures card covers.

**Cross-cutting principles:** objects have weight (shadows, thickness, material feel); position is meaningful; interface changes as you use it (desk at week 1 ≠ week 8); lead with next action, not full menu; anti-pattern = the report dashboard (Google Classroom, Canvas LMS).

### Open questions from the session (not yet resolved)
1. **How does the project-specific 3D growth object get generated?** Teacher defines project type → matching .glb template selected? Or does the system need a library of generic build stages? Procedural approach?
2. **What triggers growth stages?** Captures submitted? Iterations completed? Teacher sign-offs? Some combination? Needs careful thought to avoid re-introducing gamification.
3. **Card persistence.** Saved per student? Per project? Reset when a new project starts?
4. **Map interaction model.** Mode flip vs translucent underside — which feels right? Needs prototyping.
5. **Snap zones.** Should cards snap to defined areas (active work / reference / parked) or remain fully free-form?
6. **Interactive desk objects.** Tapping the 3D sketchbook opens captures? Tapping the micro:bit launches the 3D engine? Or does interaction stay in the cards?
7. **.glb model pipeline.** Blender commission (~$200-400) covers desk objects. Project-specific growth objects would need a much larger asset library or a procedural approach.

### How the chosen direction maps to the earlier exploration
- **Direction 1 (Studio Desk)** → core direction, implemented in prototype
- **Direction 2 (Map/Trail)** → parked as secondary mode (mode flip or translucent underside)
- **Direction 3 (Portfolio-First)** → absorbed as the Recent Captures card with thumbnail corkboard treatment
- **Direction 4 (Focus/Zen)** → still TBD, possibly as a layout preset
- **Direction 5 (Card-Based)** → absorbed — the cards ARE the interaction primitive
- **Direction 6 (Mood-Responsive)** → still TBD, possibly via lamp warmth + card density
- **Direction 7 (Messy Desk)** → still TBD, possibly as a snap-zone mode toggle

---

## Problem Statement

The current student dashboard follows a project-management pattern — cards, progress bars, task lists. It looks like a management board (MB), not a creative workspace. Secondary students (ages 11-18) don't think in sprints and status boards. They think in terms of: what am I making, what's exciting, what do I need to do next, and how far have I come.

**Goal:** Reimagine the student dashboard as *their space* — less busy, more personal, customizable, and oriented around the work itself rather than task management.

---

## Design Directions to Explore

### 1. The Studio Desk

The student lands on a virtual desk — their workspace. The current project sits "open" in the center (like a sketchbook lying open). Surrounding it are things they've pinned: inspiration images, their last reflection, a sticky note from the AI mentor.

- The wayfinder isn't a sidebar nav — it's like looking up from the desk to see a wall with their journey mapped out
- Draggable, resizable, rearrangeable — students choose what's on their desk
- Some students will want their brief front and center; others will want their mood board taking up half the screen
- Personal space that remembers their layout

### 2. The Map / Trail

Instead of progress bars or percentages, show the design cycle as a landscape the student is physically moving through. Not gamified floating islands — something more like a hand-drawn trail map.

- "You are here" is literal
- Upcoming phases are visible but slightly faded
- Completed phases have artifacts pinned to them — the research they did, the sketches they made
- The reflection area becomes a campfire or rest stop — a place you pause, look back, and the AI asks a good question

### 3. The Portfolio-First View

The default view isn't "here's your tasks" but "here's your work." A beautiful, auto-generated spread of everything the student has produced — photos, sketches, writing, prototypes — laid out like a design portfolio.

- "What to do next" is a subtle nudge at the top, not the organizing principle
- Reframes the dashboard from "todo list" to "look what you've built"
- The wayfinder becomes a timeline scrubber along the bottom — slide it to see work from different phases
- Builds intrinsic motivation through visible progress

### 4. The Focus Mode / Zen

The dashboard has exactly one thing on it by default: the next thing you should do, presented large and clear with context. Everything else is accessible but tucked away.

- Think meditation app — one intention at a time
- Students who want the full picture can expand to see more, but the default is calm
- The stones could work here as ambient progress indicators — they glow or fill in peripherally, not demanding attention but always there
- Good for younger students or those who get overwhelmed

### 5. Card-Based Workspace (ref: Concept Capers)

Everything is a card — projects, phases, activities, reflections, mentor notes. Cards are physical objects you arrange, flip, stack, and collect. Inspired by the illustrated character-card + flip-to-reveal UX of [Concept Capers](https://conceptcapers.com).

- **Projects as collectible cards** — each unit has a cover illustration (AI-generated from the brief, or student-chosen). Flip to see progress, next steps, recent work. Finished projects get a visual treatment (gold border, stamp, foil effect) that makes completing work feel like collecting something
- **Phase cards within a project** — Research, Design, Create, Evaluate are each their own card. Flip to see what you did. Stack them, spread them, rearrange. The non-linear design cycle *looks* non-linear because you physically arrange the order you worked in
- **Activity cards dealt to you** — instead of a task list, next activities are dealt like a hand. You pick which to work on. The AI mentor "deals" a new card when you finish one. Agency over a checklist
- **Flip mechanic for reflection** — front: your work artifact (photo, sketch). Back: your reflection, AI feedback, peer comments. More engaging than scrolling to a "reflection" section
- **Tilt/scatter aesthetic** — cards sit at slight angles, overlapping on a surface. Not a grid. Feels like *your stuff on your desk*, not a management board
- **Designer Mentor card** — your mentor's illustrated card sits on the desk alongside project cards, ties into the Designer Mentor System's 20 character illustrations
- **Collectibility** — the card format naturally creates a sense of accumulation and achievement without gamification points

### 6. Mood-Responsive Theming

The student picks how they're feeling when they log in, and the dashboard subtly adapts.

- Colors, density, tone of AI prompts shift
- A stressed student gets a calmer, sparser layout with gentler language
- An energised student gets more content, bolder visuals
- Ties into student wellbeing signals for the teacher dashboard

### 6. Peer Glimpses

Small anonymized windows showing classmates' progress or artifacts, creating social presence without surveillance.

- Not a leaderboard — more like seeing someone else's desk from across the room
- Normalises different speeds and approaches
- Optional / teacher-toggleable

### 7. The Messy Desk Option

Some students work better in visual chaos. Let them scatter things. Not everything needs to be in a grid.

- Freeform canvas mode alongside structured layouts
- Physics-based dragging — things stack, overlap, pile up
- The student who pins 30 inspiration images and buries their brief is *using the tool correctly*

---

## 3D Desk Surface (R3F)

The desk isn't a background image — it's a 3D scene rendered with React Three Fiber. Objects sit *on* a surface and cast real shadows. This is what makes the whole concept feel physical rather than flat UI with a desk skin.

### Core Setup

- Desk surface is a shadow-receiving plane with a wood/material texture
- Single warm directional light (the desk lamp) creates consistent shadow direction
- Every object casts a soft shadow that moves when you drag it
- Subtle ambient occlusion where objects meet the desk surface
- Leverages existing R3F pipeline from 3D Elements + Kenney asset packs

### Student Work as Physical Objects

- **Uploaded photos** → polaroids: 3D planes with slight thickness, white border, tiny corner curl, cast shadows. Stack three and they fan out with overlapping shadows
- **Sketches** → pieces of paper with a slight wrinkle/wave in the mesh
- **3D model assignments** → the model itself sits on the desk as a small rotating object
- **Design briefs** → folded card standing upright
- **Written work** → notebook pages, dog-eared
- Each object type has a different physical form factor — the desk tells you at a glance what *kind* of work you've been doing

### Other Desk Objects

- **Sticky notes / Post-its** — stack, peel, stick anywhere. Quick thoughts, AI mentor nudges, teacher messages. Layer and overlap naturally. Crumple and toss
- **Sketchbook** — sits open to current page, flip through for past work. Spine thickness shows progress without a progress bar. Could *be* the wayfinder
- **Cork/pin board on the wall behind the desk** — look up from desk to see it. Pinned: brief, inspiration, rubric criteria, class announcements. Desk = active work, wall = reference material
- **Pencil pot / mug** — holds toolkit tools as physical pens/markers. Pull out the SCAMPER pen, the brainstorming marker
- **Calendar / planner** — open to this week, page-flip to next week. Deadlines, lesson schedule
- **Desk lamp** — mood/state indicator. Warm glow = going well, dims = inactive, color shifts with mood-responsive system. In Focus mode, light narrows to a spotlight on one object — everything else falls into soft shadow
- **Stickers** — earned achievements, badges, teacher feedback stamps. Students stick them on project cards, sketchbook cover, wherever. Safety badges become physical stickers you collect and place
- **Crumpled paper / bin** — discarded drafts visible near a bin. Makes iteration visible and positive. Fish something out if you want it back

### Lighting as UX

- Time of day could subtly shift shadow direction
- Focus mode → spotlight narrows to one object, periphery falls to soft shadow
- Stressed/calm mood → warmer/cooler light temperature
- Mood through lighting, not UI chrome

### Performance Notes

- Manageable on school devices if kept to planes + simple geometry with baked materials
- Not rendering complex meshes — flat cards and simple shapes on a plane
- Kenney low-poly style (already validated) for desk furniture objects
- Single soft shadow map for top-down desk view is within budget
- Heavy 3D (rotating models, particle effects) can be opt-in / progressive enhancement

---

## Customisation System

### Smart Defaults (avoid blank-canvas problem)

Three preset layouts so students aren't staring at an empty configurable grid:

1. **Focus** — minimal, one-thing-at-a-time, zen approach
2. **Explorer** — map/trail with artifacts, journey-oriented
3. **Organizer** — structured grid, closest to current dashboard

Students pick one during onboarding, then customise from there.

### What Students Can Control

- Drag and resize dashboard areas/widgets
- Choose which widgets appear (wayfinder, reflection, recent work, peer glimpses, AI mentor, inspiration board, etc.)
- Phase-aware layouts — their research layout can look different from their making layout, and the system remembers
- Pin/unpin items to their workspace
- Theme/color choices (beyond mood-responsive)

---

## Reflection Reimagined

Current state: reflection is a form ("fill in this box"). Proposed directions:

- **Conversation with past self** — AI pulls up what you said last week, shows how your thinking has evolved, surfaces contradictions
- **Work-triggered reflection** — upload a new photo and the AI asks "how does this compare to your original sketch?" right there, in context
- **Reflection as a place** rather than a form — somewhere you go, not something you fill in
- **Visual reflection** — timeline of your work with annotations, not just text boxes
- **Micro-reflections** — quick 10-second prompts embedded in the workflow vs. big end-of-phase forms

---

## Wayfinder Reimagined

Current wayfinder is navigational. Proposed directions:

- **Journey map** — spatial/visual representation of where you are in the design cycle, not a list of phases
- **Artifact-anchored** — each phase shows what you produced, not just a checkmark
- **Non-linear** — reflects that design thinking isn't a straight line; allow branching, looping back
- **Peripheral** — always visible but not dominant; the work is the focus, the wayfinder is context

---

## Stones Reimagined

The stones (progress markers) could work in several modes:

- **Ambient glow** — peripheral indicators that fill/light up as you progress, not demanding attention
- **Physical objects on the desk** — stones sitting on your virtual workspace that change as you work
- **Trail markers** — placed along the map/trail path
- **May be a stretch** — worth prototyping to see if students connect with them in any of these forms

---

## Student Testing Plan

This project is explicitly designed to be tested with actual students before committing to a direction. Testing approach:

1. **Build 2-3 lightweight prototypes** (HTML/React mockups, not full functionality) of the strongest directions
2. **Run preference tests** with students across age groups (11-13, 14-16, 16-18)
3. **Observe natural customisation patterns** — what do students move, resize, hide, pin?
4. **A/B test** calm vs. dense defaults
5. **Collect qualitative feedback** — "show me your ideal workspace" exercise

---

## Dependencies & Connections

- **Journey Engine** — the wayfinder reimagination connects to the trail/map metaphor
- **3D Elements** — the studio desk / physical objects could use R3F scenes
- **Designer Mentor System** — mentor presence on the dashboard (sticky notes, nudges)
- **Student Learning Profile** — mood-responsive theming needs student state data
- **Work Capture Pipeline** — portfolio-first view needs rich work artifacts

---

## Open Questions

1. How much customisation is too much for different age groups? (11-year-olds vs 17-year-olds)
2. Does a freeform canvas work on tablets / school devices with small screens?
3. How do we handle the transition from guided (younger) to self-directed (older)?
4. Should teachers be able to set a default layout for their class?
5. How does this interact with Teaching Mode — does the teacher see each student's personalised view?
6. Performance implications of draggable/resizable everything — especially on school devices
