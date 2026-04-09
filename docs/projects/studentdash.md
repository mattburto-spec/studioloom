# StudentDash — Student Dashboard Reimagination

> **Status:** 💡 Idea — needs student testing
> **Priority:** TBD (post-Dimensions3)
> **Category:** Student XP
> **Created:** 9 April 2026

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
