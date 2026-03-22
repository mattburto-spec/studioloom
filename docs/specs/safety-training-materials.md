# Safety Training Materials — PRD

**Author:** Matt Burton + Claude
**Date:** 22 March 2026
**Status:** Draft
**Project:** StudioLoom (Questerra)

---

## Problem Statement

The current safety badge system has a working quiz engine but its learning materials are expandable text boxes — passive, forgettable, and indistinguishable from a PDF handout. Students read walls of text, tap through, and forget. Teachers get nothing to use in the classroom. The free tool at `/tools/safety` has zero viral potential in its current form because there's nothing worth screenshotting or sharing.

Workshop safety training in schools has two distinct moments: **classroom instruction** (teacher-led, first encounter) and **revision** (student-led, before practical work). The current system serves neither well. Teachers still pull up YouTube videos and printed worksheets. Students re-read the same text boxes they skimmed the first time.

The cost of not fixing this: the free safety tool stays invisible, teachers have no reason to share it, and the badge system remains a compliance checkbox rather than a genuine learning tool.

---

## Goals

1. **Make `/tools/safety` the most-shared free resource in D&T teacher networks** — the "Spot the Hazard" format should be screenshot-worthy and immediately useful in any workshop classroom worldwide.
2. **Achieve 70%+ knowledge retention** via interactive, scenario-based microlearning (industry benchmark: 70% for game-based vs 5% for passive reading — [EHS Global Tech](https://www.ehsglobaltech.com/games/for-the-workplace)).
3. **Give teachers a lesson-in-a-box** — one-click access to demonstration scripts, discussion prompts, station cards, and printable posters so they never need to leave StudioLoom for safety resources.
4. **Drive free-to-paid conversion** — teachers discover the free tool, use it with their class, then see the value of the full platform (unit builder, grading, portfolio).
5. **Support both moments** — classroom instruction (teacher-led, rich, interactive) AND revision (student-led, quick, reinforcing).

---

## Non-Goals

- **VR/AR training** — immersive technologies are effective but require hardware Matt's target schools don't have. Out of scope. (P2 future consideration.)
- **AI-generated safety content** — teachers must author and verify safety materials. AI can help teachers draft content, but the platform must not auto-generate safety rules that could be wrong. Safety is one domain where accuracy > speed.
- **Certification/compliance tracking for industry** — this is for schools, not OSHA/SafeWork compliance. No regulatory reporting.
- **Video hosting** — support embedding YouTube/Vimeo links, but don't build a video hosting pipeline. Future consideration.
- **Multiplayer/competitive modes** — leaderboards and PvP are wrong for safety (creates pressure to rush). Individual mastery only.

---

## Users & Their Moments

### Teacher — Classroom Instruction (First Encounter)
> "I need to teach bandsaw safety to Year 8 before their first practical. I want materials that are better than my current YouTube video + worksheet combo."

The teacher needs:
- A structured lesson flow they can project and walk through
- Discussion prompts that generate real thinking (not "any questions?")
- Printable materials for stations and wall posters
- A practical demonstration script (stand here, hold this, say this)
- A way to assign the revision materials after class

### Student — Revision (Before Practical Work)
> "I did the safety lesson last week. Now I need to pass the test before I can use the bandsaw. I vaguely remember the main points."

The student needs:
- Quick, engaging revision that resurfaces key concepts
- Interactive formats that test understanding, not just recognition
- Clear visual references (what right looks like, what wrong looks like)
- Confidence that they'll pass the quiz after doing the revision properly

### Teacher (External) — Free Tool Discovery
> "Someone shared this in my D&T Facebook group. I want to try it with my class tomorrow."

This teacher needs:
- Instant value with zero signup
- Materials that work for any school's workshop (not just IB MYP)
- Something impressive enough to share with colleagues
- A natural path to discover the full platform

---

## Learning Content Architecture

### Current: Flat LearnCards

```
LearnCard { title, content, icon }  →  Expandable text box
```

### Proposed: Rich Learning Modules

Each badge gets a **Learning Module** composed of ordered **Content Blocks**. Content blocks are typed — each type has its own renderer and interaction model.

```
LearningModule {
  badge_id: string
  learning_objectives: string[]          // shown at top
  estimated_minutes: number              // "~8 min revision"
  blocks: ContentBlock[]                 // ordered content
  teacher_guide: TeacherGuide            // classroom delivery pack
}

ContentBlock =
  | SpotTheHazardBlock      // interactive illustrated scene
  | ScenarioBlock           // branching "what would you do?"
  | BeforeAfterBlock        // side-by-side correct vs incorrect
  | MachineDiagramBlock     // labelled interactive diagram
  | MicroStoryBlock         // short incident narrative + analysis
  | KeyConceptBlock         // replaces current text cards (upgraded)
  | ComprehensionCheckBlock // inline quiz between sections
  | VideoEmbedBlock         // YouTube/Vimeo embed with timestamp markers
  | StepByStepBlock         // numbered procedure with illustrations
```

### Backward Compatibility

Existing `LearnCard[]` data maps to `KeyConceptBlock` type. Migration path: read old `learn_content` as blocks with `type: "key_concept"`. New blocks added incrementally — badges don't need all block types to work.

---

## Content Block Types — Detailed Design

### 1. Spot the Hazard (Hero Feature)

**This is the viral hook.** An illustrated workshop scene with clickable hazard zones.

```typescript
interface SpotTheHazardBlock {
  type: "spot_the_hazard"
  title: string                    // "Find the hazards in this woodworking shop"
  scene_id: string                 // references scene illustration
  scene_type: "wood" | "metal" | "textiles" | "food" | "digital_fab" | "general" | "custom"
  hazards: Array<{
    id: string
    zone: { x: number, y: number, width: number, height: number }  // % coordinates
    severity: "critical" | "warning" | "minor"
    label: string                  // "No eye protection"
    explanation: string            // "Flying debris from the lathe can..."
    rule_reference?: string        // "Workshop Rule #3"
  }>
  total_hazards: number            // students see "X of Y found"
  time_limit_seconds?: number      // optional countdown
  pass_threshold: number           // e.g. find 6 of 8
}
```

**UX Flow:**
1. Scene loads full-width with subtle "tap to find hazards" instruction
2. Student taps/clicks suspected hazards
3. Correct: green pulse + hazard label slides in from side + explanation
4. Wrong: brief red flash + "Not a hazard — try another area"
5. Progress indicator: "5 of 8 hazards found"
6. Timer (optional): adds urgency for revision mode, removed for first-time learning
7. Completion: all hazards revealed with full explanations, severity colour-coded

**Scene Illustrations:**
- Pre-built scenes for common workshop types (wood, metal, textiles, food, digital fab)
- Each scene: one high-quality SVG/PNG illustration, ~8-12 hazard zones
- Teacher can also upload a photo of THEIR actual workshop and mark hazard zones (Phase 2)
- Illustration style: clean, detailed, slightly stylised (like IKEA instruction manuals — clear enough to identify objects, not photorealistic)

**Why this goes viral:** Teachers screenshot the scene, share in Facebook groups saying "try this with your class." The visual is inherently shareable. No other free D&T tool does this.

### 2. Scenario / Decision Tree

**Branching "what would you do?" situations.** Based on [OSHA's HazFinder tool](https://www.osha.gov/hazfinder).

```typescript
interface ScenarioBlock {
  type: "scenario"
  title: string
  setup: string                    // "You're using the drill press when..."
  illustration?: string            // scene illustration
  branches: Array<{
    id: string
    choice_text: string            // "Stop and call the teacher"
    is_correct: boolean
    feedback: string               // why this choice is right/wrong
    consequence?: string           // "The drill bit snaps and..."
    next_branch_id?: string        // for multi-step scenarios
  }>
}
```

**UX Flow:**
1. Scenario text + illustration appears
2. 3-4 choices presented as cards (not radio buttons — cards feel more deliberate)
3. Student picks one → immediate feedback with consequence
4. Wrong choices explain what would happen ("The blade catches your sleeve...")
5. Multi-step scenarios: correct choice leads to next decision point
6. Summary: shows the full decision tree with student's path highlighted

### 3. Before/After Comparison

**Side-by-side: wrong way vs right way.** Visual, instant, memorable.

```typescript
interface BeforeAfterBlock {
  type: "before_after"
  title: string                    // "Holding a chisel"
  before: {
    image: string                  // illustration/photo of wrong way
    caption: string                // "Fingers in front of blade edge"
    hazards: string[]              // what's wrong
  }
  after: {
    image: string                  // illustration/photo of right way
    caption: string                // "Fingers behind blade edge, firm grip"
    principles: string[]           // why this is correct
  }
  key_difference: string           // one-sentence takeaway
}
```

**UX Flow:**
- Swipe or tap to toggle between Before (red border) and After (green border)
- Or: slider in the middle that reveals/hides the correct version (like website redesign sliders)
- Key difference text appears below

### 4. Machine Diagram (Interactive Labels)

**Drag labels onto a machine diagram.** Teaches anatomy of equipment.

```typescript
interface MachineDiagramBlock {
  type: "machine_diagram"
  title: string                    // "Parts of the Bandsaw"
  machine_image: string            // clean illustration of machine
  labels: Array<{
    id: string
    text: string                   // "Blade guard"
    correct_position: { x: number, y: number }  // % coordinates
    snap_radius: number            // how close is "correct"
    description: string            // what this part does
    safety_note?: string           // why this matters for safety
  }>
  mode: "drag_to_place" | "tap_to_identify"  // drag labels or tap parts
}
```

**UX Flow (drag_to_place):**
1. Machine diagram on left/top, shuffled labels on right/bottom
2. Student drags labels to correct positions
3. Correct: label snaps into place with green pulse
4. Wrong: label bounces back with gentle shake
5. After all placed: each label expands to show description + safety note

**UX Flow (tap_to_identify):**
1. Machine diagram with numbered hotspots
2. Student taps hotspot → multiple choice: "What is this part?"
3. Correct: part highlights green + description appears
4. After all identified: full annotated diagram as reference

### 5. Micro-Story (Incident Narrative)

**Short incident stories followed by analysis.** The brain remembers stories 22x better than facts.

```typescript
interface MicroStoryBlock {
  type: "micro_story"
  title: string                    // "The Drill Press Incident"
  narrative: string                // 3-5 sentence story
  is_real_incident: boolean        // "Based on a real incident" badge
  analysis_prompts: Array<{
    question: string               // "What went wrong?"
    reveal_answer: string          // shown after student reflects
  }>
  key_lesson: string               // one-sentence takeaway
  related_rule?: string            // links to a specific safety rule
}
```

**UX Flow:**
1. Story appears with dramatic formatting (slightly larger text, quotation style)
2. "Based on a real incident" badge if applicable (anonymised, age-appropriate)
3. Analysis prompts appear one at a time: "What went wrong?" → student taps to reveal answer
4. Key lesson appears as a highlighted callout at the end

### 6. Key Concept (Upgraded Text Card)

**Replaces current LearnCard.** Same purpose, better structure.

```typescript
interface KeyConceptBlock {
  type: "key_concept"
  title: string
  icon: string                     // emoji
  content: string                  // markdown-supported text
  tips?: string[]                  // practical tips
  examples?: string[]              // concrete examples
  warning?: string                 // critical safety warning (red callout)
  image?: string                   // optional supporting image
}
```

### 7. Comprehension Check (Inline Quiz)

**Quick check between sections.** Prevents passive scrolling.

```typescript
interface ComprehensionCheckBlock {
  type: "comprehension_check"
  question: string
  options: string[]
  correct_index: number
  feedback_correct: string
  feedback_wrong: string
  hint?: string                    // shown after first wrong attempt
}
```

**UX:** Appears inline between content blocks. Student must answer correctly to continue (soft gate — can skip after 2 attempts). Not scored, purely formative.

### 8. Step-by-Step Procedure

**Numbered procedure with illustrations per step.**

```typescript
interface StepByStepBlock {
  type: "step_by_step"
  title: string                    // "Setting up the laser cutter"
  steps: Array<{
    number: number
    instruction: string
    image?: string                 // illustration for this step
    warning?: string               // safety note for this step
    checkpoint?: string            // "Check: is the guard in place?"
  }>
}
```

---

## Teacher Guide (Classroom Delivery Pack)

Every badge's learning module includes a **TeacherGuide** — a structured lesson-in-a-box.

```typescript
interface TeacherGuide {
  badge_id: string
  estimated_lesson_minutes: number

  // Demonstration script
  demo_script: Array<{
    step: number
    action: string                 // "Stand to the left of the machine"
    say: string                    // "Watch where my hands are..."
    show: string                   // "Point to the blade guard"
    timing_seconds: number
  }>

  // Discussion prompts
  discussion_prompts: Array<{
    question: string               // "Why do you think we never reach over...?"
    expected_responses: string[]   // what students might say
    follow_up: string              // deepening question
  }>

  // Station rotation cards (printable)
  station_cards: Array<{
    station_name: string           // "Bandsaw Station"
    rules: string[]                // 5-6 key rules
    qr_code_url: string            // links to student revision
    illustration?: string
  }>

  // Printable wall poster (generated)
  poster: {
    title: string
    rules: Array<{ text: string, icon: string }>
    footer: string                 // "Scan QR code for revision"
  }

  // Practical assessment checklist
  practical_checklist: Array<{
    criterion: string              // "Student checks blade guard before starting"
    observable_action: string      // what teacher looks for
  }>
}
```

**Teacher UX:**
- "Teach This" button on each badge → opens teacher guide view
- Print button → generates formatted PDF with demo script, station cards, poster, checklist
- Project button → full-screen projector view cycling through content blocks
- QR codes on printed materials link back to the student revision module

---

## Free Tool Experience (`/tools/safety`)

### Current Flow
Browse badges → Pick one → Read text cards → Take quiz → Pass/fail

### Proposed Flow

**Landing:** Dark-themed hero with workshop illustration. Headline: "Interactive Workshop Safety Training — Free for Every Classroom." Three entry points:

1. **Spot the Hazard** (hero) — "Test your hazard awareness" → jumps straight to an interactive scene. No signup, no badge selection. Instant engagement. This is the viral entry point.
2. **Browse Safety Modules** — full badge catalog with workshop type filters (wood, metal, textiles, food, digital fab). Each module card shows block types inside ("4 scenarios, 2 diagrams, 1 spot-the-hazard").
3. **Teacher Resources** — station cards, posters, demo scripts. Printable. This is the conversion funnel — teachers who print materials see the StudioLoom branding and QR codes linking to the platform.

**Spot the Hazard standalone:**
- Pick workshop type (wood, metal, textiles, food, digital fab)
- Interactive scene loads immediately
- After completing: "Want to train your students on [workshop type] safety? See the full module →" (links to badge module, which shows all content blocks)
- Share button generates a link teachers can send to students

**Module revision flow:**
1. Learning objectives shown at top ("After this module you'll be able to...")
2. Content blocks render in order — each block type has its own interactive renderer
3. Comprehension checks gate progress (soft gate)
4. Progress bar shows % complete
5. After all blocks: "Ready for the quiz?" → transitions to existing quiz engine
6. Post-quiz: certificate graphic (shareable), link to print teacher materials

---

## User Stories

### Student Revision

- As a student preparing for a practical lesson, I want to quickly revise safety rules in an engaging way so that I feel confident I'll pass the quiz and can use the equipment safely.
- As a student, I want to try finding hazards in a workshop scene so that I develop real hazard awareness rather than just memorising rules.
- As a student who failed the quiz, I want to see which content blocks relate to my wrong answers so that I can target my revision.
- As a student, I want inline comprehension checks so that I know I'm actually understanding (not just scrolling).

### Teacher Classroom Delivery

- As a teacher about to introduce a new machine, I want a structured demo script so that I cover all safety points without forgetting anything.
- As a teacher, I want printable station cards with QR codes so that students can reference safety rules at each workstation and link to digital revision.
- As a teacher, I want a practical assessment checklist so that I can verify students can demonstrate safe use (not just pass a written test).
- As a teacher, I want to project Spot the Hazard scenes so that my whole class can discuss hazards together before anyone touches equipment.
- As a teacher, I want to print a wall poster for each machine so that safety rules are always visible in the workshop.

### Free Tool Visitor

- As a D&T teacher who found this tool via a Facebook group, I want to try Spot the Hazard immediately without signing up so that I can see if it's worth using with my class.
- As a teacher who just used the free tool, I want to easily share it with my colleagues so that they can use it too.
- As a teacher impressed by the free training materials, I want to see what the full platform offers so that I can decide whether to sign up.

---

## Requirements

### Must-Have (P0) — "Free Tool That Goes Viral"

| # | Requirement | Acceptance Criteria |
|---|------------|-------------------|
| P0-1 | **Spot the Hazard interactive renderer** | Scene loads, hazard zones are clickable/tappable, correct/wrong feedback, progress counter, completion state with all hazards revealed |
| P0-2 | **3 pre-built workshop scenes** (wood, metal, general) | Each has 8-12 hazard zones, severity levels, explanations. Illustrated in clean SVG style |
| P0-3 | **Scenario/Decision Tree renderer** | Branching choices with consequence feedback, multi-step support, path summary |
| P0-4 | **Before/After renderer** | Toggle/slider between wrong and right way, key difference callout |
| P0-5 | **Key Concept block** (upgraded text card) | Markdown rendering, tips, examples, warning callout, optional image |
| P0-6 | **Comprehension Check inline quiz** | Appears between blocks, must answer to continue (soft gate after 2 attempts), not scored |
| P0-7 | **Module progress tracking** | Progress bar, estimated time remaining, block completion state |
| P0-8 | **Free tool landing page redesign** | Spot the Hazard hero entry, module browser, teacher resources section |
| P0-9 | **Backward-compatible LearnCard migration** | Old `learn_content` arrays render as KeyConceptBlocks. No data loss. |
| P0-10 | **Content Block schema + types** | TypeScript types for all block types, JSONB storage on badges table |

### Nice-to-Have (P1) — "Teacher's Best Friend"

| # | Requirement | Acceptance Criteria |
|---|------------|-------------------|
| P1-1 | **Machine Diagram interactive labels** | Drag-to-place and tap-to-identify modes, snap detection, annotated completion view |
| P1-2 | **Micro-Story renderer** | Narrative display, sequential analysis prompts with reveal, key lesson callout |
| P1-3 | **Step-by-Step Procedure renderer** | Numbered steps with per-step illustrations, warnings, checkpoints |
| P1-4 | **Teacher Guide view** | Demo script, discussion prompts, station cards, poster, practical checklist rendered from TeacherGuide data |
| P1-5 | **Print-to-PDF** for teacher materials | Station cards, wall poster, practical checklist generate clean printable PDFs |
| P1-6 | **Projector mode for Spot the Hazard** | Full-screen display, teacher reveals hazards one at a time for class discussion |
| P1-7 | **QR codes on printed materials** | Auto-generated QR linking to student revision module |
| P1-8 | **2 more workshop scenes** (textiles, food tech) | Same quality as P0 scenes |
| P1-9 | **Teacher content authoring** for new block types | Form-based editors for Spot the Hazard zones, scenarios, before/after, diagrams |
| P1-10 | **Post-quiz targeted revision** | Wrong answers link to specific content blocks for review |

### Future Considerations (P2)

| # | Requirement | Notes |
|---|------------|-------|
| P2-1 | **Custom workshop photos** | Teacher uploads photo of THEIR workshop, marks hazard zones |
| P2-2 | **Video embed blocks** | YouTube/Vimeo with timestamp markers for key moments |
| P2-3 | **Clickable image regions in quiz** | "Click where the emergency stop is" as a question type |
| P2-4 | **Spaced repetition** | Key facts resurface in future sessions based on forgetting curve |
| P2-5 | **AI-assisted content drafting** | Teacher describes the machine/process, AI generates draft blocks for review |
| P2-6 | **Digital fab scenes** (laser cutter, 3D printer, CNC) | Expanding workshop types |
| P2-7 | **Multi-language support** | Safety materials in languages beyond English |
| P2-8 | **Student-facing analytics** | "You've revised 3 times, your weakest area is blade guards" |

---

## Success Metrics

### Leading (within 4 weeks of launch)

| Metric | Target | Stretch | Measurement |
|--------|--------|---------|-------------|
| Free tool unique visitors | 500/month | 2,000/month | Plausible analytics |
| Spot the Hazard completion rate | 70% | 85% | Event tracking |
| Average time on free tool | > 3 min | > 5 min | Plausible |
| Teacher materials printed | 50 PDFs/month | 200 PDFs/month | Server-side count |
| Social shares (link copies) | 30/month | 100/month | Share button tracking |

### Lagging (within 3 months)

| Metric | Target | Stretch | Measurement |
|--------|--------|---------|-------------|
| Free → signup conversion | 3% | 8% | Funnel tracking |
| Badges created by teachers | 20 total | 50 total | DB query |
| Repeat free tool visits | 40% return within 30 days | 60% | Plausible |
| Teacher guide print rate | 30% of badge views | 50% | Event tracking |

---

## Implementation Phases

### Phase 1: Spot the Hazard + Content Blocks (~7-9 days)

**Goal:** Ship the hero feature and content block system.

1. **Content Block schema + types** (0.5 day) — TypeScript interfaces for all block types, extend `badges` table schema (JSONB `learning_blocks` alongside existing `learn_content` for backward compat)
2. **Block renderers** (3 days) — React components for: SpotTheHazard, Scenario, BeforeAfter, KeyConcept (upgraded), ComprehensionCheck. Each is a standalone component that takes its typed block data as props.
3. **Spot the Hazard scenes** (2 days) — 3 SVG illustrations (woodwork, metalwork, general workshop). 8-12 hazard zones per scene. Clean illustrative style. Generated via ChatGPT gpt-image-1 or hand-drawn SVG.
4. **Module renderer** (1 day) — Ordered block list with progress tracking, estimated time, learning objectives header, transition to quiz.
5. **Free tool landing page** (1 day) — Redesign `/tools/safety` with Spot the Hazard hero entry, module browser with block-type badges on cards.
6. **Migration layer** (0.5 day) — Old `learn_content` arrays auto-convert to `KeyConceptBlock[]` on read.

### Phase 2: Teacher Pack + More Blocks (~5-7 days)

**Goal:** Teacher classroom delivery materials.

1. **Machine Diagram + Micro-Story + Step-by-Step renderers** (2 days)
2. **TeacherGuide data model + view** (1.5 days) — Demo script, discussion prompts, station cards, practical checklist
3. **Print-to-PDF generation** (1.5 days) — Station cards, wall poster, practical checklist as clean PDFs
4. **Projector mode** (1 day) — Full-screen Spot the Hazard for whole-class use, teacher-controlled hazard reveal
5. **2 more scenes** (1 day) — Textiles, food tech

### Phase 3: Authoring + Polish (~4-5 days)

**Goal:** Teachers can create rich content blocks, not just text cards.

1. **Block type editors** (3 days) — Form-based UI for Spot the Hazard (upload image + mark zones), Scenario (branch builder), Before/After, Machine Diagram (upload + place labels)
2. **QR codes** (0.5 day) — Auto-generated on printed materials
3. **Post-quiz targeted revision** (0.5 day) — Wrong answers link to specific blocks
4. **Polish + testing** (1 day) — Mobile responsiveness, accessibility, edge cases

**Total estimate: ~16-21 days across 3 phases.**

---

## Open Questions

| Question | Owner | Blocking? |
|----------|-------|-----------|
| What illustration style for scenes? Clean SVG (like IKEA) vs stylised (like the comic strip Discovery panels)? | Matt (Design) | Yes — needed before Phase 1 scene creation |
| Should Spot the Hazard scenes be SVG (scalable, precise zones) or raster images (faster to produce via AI image gen)? | Matt + Claude | Yes — affects tooling |
| How detailed should teacher demo scripts be? Per-sentence or per-section? | Matt (Teaching) | No — can iterate |
| Should the free tool require email to access teacher materials? (Lead capture vs friction tradeoff) | Matt (Business) | No — can add later |
| What's the policy on real incident stories? Must they all be fictional/anonymised? | Matt (Legal/Ethics) | No — default to anonymised |
| Can we reuse the existing `question_pool` format for ComprehensionCheck blocks or do they need their own schema? | Engineering | No |

---

## Technical Notes

- **Storage:** New `learning_blocks JSONB` column on `badges` table (alongside existing `learn_content` for backward compat). Each block has a `type` discriminator field.
- **Rendering:** Each block type gets a React component in `src/components/safety/blocks/`. Parent `ModuleRenderer` maps block types to components.
- **Images:** Spot the Hazard scenes stored as static assets in `/public/safety/scenes/` (SVG preferred for zone precision). Machine diagrams and before/after images stored in Supabase storage or as base64 in JSONB (small illustrations).
- **Zone coordinates:** Percentage-based (0-100 for x, y, width, height) so scenes are responsive across screen sizes.
- **Teacher Guide:** Stored as JSONB on badges table (`teacher_guide` column) or as a separate `badge_teacher_guides` table if the data gets large.
- **Print:** Use existing PDF skill infrastructure for generating station cards and posters.
- **No new dependencies needed** — renderers are pure React components with CSS. Drag-and-drop for Machine Diagram uses native HTML5 drag events (no dnd-kit needed for simple label placement).

---

## Competitive Landscape

| Competitor | What They Do Well | What We Beat Them On |
|-----------|------------------|---------------------|
| [OSHA HazFinder](https://www.osha.gov/hazfinder) | Official, comprehensive, game-based hazard identification | Ours is designed for schools (age-appropriate), specific to D&T workshops (not construction/industrial), includes teacher materials |
| [EHS Global Tech](https://www.ehsglobaltech.com/the-games/spot-the-hazard) | Polished interactive games, spot the hazard format | Ours is free, no enterprise sales process, designed for education not corporate |
| [SafetyCulture](https://training.safetyculture.com) | Most comprehensive platform, mobile-first, 45+ languages | Ours is free for schools, specific to D&T/maker spaces, includes teacher classroom materials (not just student modules) |
| YouTube safety videos | Ubiquitous, visual, free | Ours is interactive (not passive), assessable, tracks comprehension, printable materials |
| Teacher-made worksheets | Customised to their workshop | Ours is interactive, shareable, includes assessment, saves teacher time |

**Our unique position:** The only free, interactive, school-focused workshop safety training tool with both student revision AND teacher classroom delivery materials. Corporate tools are expensive and irrelevant to schools. Teacher-made materials are inconsistent and non-interactive. We sit in the gap.

---

*This spec should be reviewed against `docs/education-ai-patterns.md` for any student-facing AI interactions (ComprehensionCheck feedback, Scenario branching). The 5 education AI patterns (effort-gating, Socratic feedback, staged cognitive load, micro-feedback loops, soft gating) apply where AI is involved.*
