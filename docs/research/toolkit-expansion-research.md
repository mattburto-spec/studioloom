# Toolkit Expansion Categories: Research & UX Patterns
**Research compiled: March 29, 2026**

This document covers the 6 expansion categories beyond the active Design Thinking category. For each tool, we document the world's best digital example, key UX insight, AI potential rating (None/Light/Heavy), and the "wow factor" that makes students want to use it.

For the 27 active Design Thinking tools, see `design-thinking-tools-research.md`.

---

## 2. VISUAL (~8 tools)

Tools for spatial thinking, sketching, visual composition, and annotation.

### Annotation Tool
**Best-in-class:** Ruttl (ruttl.com) — live website annotation with pin-drop comments, video feedback, and version history. Figma comments are strong but project-scoped. For education, Kami PDF annotation is closest (overlays on student docs).

**Key UX insight:** Pin-drop + callout pattern. Click anywhere on an image → place a numbered pin → type annotation in a connected callout. Pins are draggable, color-coded by category (praise=green, question=blue, suggestion=amber, issue=red). Layer annotations so they can be toggled on/off.

**AI potential:** **LIGHT** — AI could auto-suggest annotation categories based on content ("This area looks like it needs more contrast — tag as 'Visual Hierarchy'?"). Could also generate annotation prompts based on design criteria being assessed.

**Wow factor:** Before/after slider showing original vs annotated version. Student sees their work through a teacher's/peer's eyes.

---

### Wireframe Builder
**Best-in-class:** Balsamiq (balsamiq.com) — deliberately low-fi hand-drawn aesthetic prevents students from focusing on aesthetics. Drag-and-drop component library. The "sketchy" style communicates "this is a draft." Figma is too polished for wireframing — students confuse wireframes with final designs.

**Key UX insight:** Constrained component palette. Limit to ~20 common UI elements (button, text field, image placeholder, header, nav bar, card, list, checkbox, radio, dropdown, modal, tab, slider, icon placeholder, video placeholder, divider, form, search bar, footer, sidebar). Lock to grayscale + one accent color. Grid snap. The constraint IS the feature — it prevents premature visual design.

**AI potential:** **HEAVY** — "Describe your app in one sentence" → AI generates a starter wireframe layout. Also: AI can critique wireframe for common UX anti-patterns (no clear CTA, cluttered layout, missing navigation, inconsistent spacing). Could suggest A/B layout alternatives.

**Wow factor:** Hand-drawn rendering mode — all elements render with a subtle wobble/sketch effect (like Balsamiq but in-browser). Makes wireframes feel approachable and explicitly "draft quality."

---

### Mood Board Creator
**Best-in-class:** Milanote (milanote.com) — freeform canvas with image upload, text cards, color swatches, link embeds. Used by professional designers and taught in design schools. Canva's mood board templates are more structured but less flexible.

**Key UX insight:** Freeform canvas with snap zones. Students drag images/colors/text/links onto an infinite canvas. Optional grid snap for tidy people, freeform for expressive thinkers. Color palette auto-extraction from uploaded images (dominant 5 colors). Visual density indicator shows when the board is "full enough."

**AI potential:** **HEAVY** — Upload 3-5 inspiration images → AI extracts themes, mood keywords, color palette, suggested design direction. "Your mood board suggests a Nordic minimalist direction — consider adding texture samples to ground it." Could also suggest missing mood board elements ("You have colors and images but no typography samples").

**Wow factor:** Auto-extracted color palette strip at the bottom that updates live as images are added/removed. Each color is clickable → shows which image it came from.

---

### Comparison Sketch
**Best-in-class:** Excalidraw (excalidraw.com) — infinite canvas, hand-drawn aesthetic, split-screen possible. For comparison specifically, Ruttl's before/after slider and InVision's Design Forward tool (side-by-side mockups with annotation) are relevant patterns.

**Key UX insight:** Synchronized split canvas. Left = Option A, Right = Option B (or Before/After). Drawing tools available on both sides. A vertical divider in the middle with drag handle to resize. Annotation pins can span both sides ("Option A handles this better because..."). Template: same empty layout on both sides forces apples-to-apples comparison.

**AI potential:** **LIGHT** — AI prompts to annotate differences ("What's different about the proportions between these two options?"). Could auto-generate comparison criteria based on the design brief.

**Wow factor:** Swipe-to-compare slider (like those before/after photo sliders) but for student sketches. Drag the divider and see both options overlap.

---

### Storyboard Creator
**Best-in-class:** Boords (boords.com) — professional storyboard tool with panel grid, frame descriptions, camera notes, and dialogue fields. Canva storyboard templates are simpler. For education, Storyboard That has cartoon character assets but feels childish for MYP age (11-16).

**Key UX insight:** Panel grid with structured fields per frame. Each panel: sketch area (canvas or upload) + caption field + notes field (for technical/production notes). 6-12 panels in a grid. Drag to reorder. Duplicate panel button for iterations. Timeline view (horizontal scroll) vs grid view (2×3 or 3×4). The structure prevents students from treating it as "just drawing pictures."

**AI potential:** **HEAVY** — "Describe your scenario" → AI suggests panel breakdowns (establishing shot → close-up → action → reaction → resolution → reflection). Per-panel prompts: "Panel 3 should show the key moment of change — what does the user's face look like?" Could generate rough compositional suggestions per panel.

**Wow factor:** Cinematic framing guides overlaid on each panel (rule of thirds, golden ratio, leading lines). Toggle on/off. Makes student storyboards look intentional.

---

### Cultural Landscape Map
**Best-in-class:** No direct digital equivalent — this is a novel tool concept. Closest: Miro's context mapping templates, Kumu (kumu.io) for relationship/system mapping with geographic overlays, and Google Earth Studio for visual cultural context.

**Key UX insight:** Concentric rings radiating from the student at center: Self → Family → School → Community → City → Country → World. Students place cultural influences (traditions, values, media, language, food, beliefs) on the appropriate ring. Lines connect related influences across rings. Color-coded by domain (arts=purple, food=green, language=blue, beliefs=gold, technology=cyan).

**AI potential:** **HEAVY** — AI asks reflective questions as students place elements: "You put 'anime' in the World ring but 'Japanese food' in the Family ring — what's the connection?" Could surface hidden cultural patterns.

**Wow factor:** The radiating rings animate outward from center when first loaded, then elements placed by the student gently pulse to show the "living" cultural map.

---

### Stakeholder Power Grid
**Best-in-class:** Creately (creately.com) — stakeholder mapping templates with drag-and-drop on 2×2 matrices. Mural's stakeholder grid is also strong. Mendelow's matrix is the classic framework.

**Key UX insight:** 2×2 quadrant with drag-and-drop stakeholder cards. X-axis = Level of Interest, Y-axis = Level of Power. Cards are color-coded by stance (supporter=green, neutral=gray, opponent=red). Each card has a mini-profile (name, role, one-line motivation). Quadrant labels auto-update based on position: Monitor (low/low), Keep Informed (low power/high interest), Keep Satisfied (high power/low interest), Manage Closely (high/high).

**AI potential:** **LIGHT** — AI suggests stakeholders the student may have missed based on the project description. "For a school recycling program, have you considered the custodial staff? They'd be high-power, moderate-interest."

**Wow factor:** Relationship lines between stakeholders with influence direction arrows. Shows the network, not just positions.

---

### Paper Prototyping Cards
**Best-in-class:** POP by Marvel (now deprecated but was iconic) — photograph paper prototypes, add hotspot links, play as interactive prototype. Principle and InVision fill this gap now for digital. For physical paper prototyping, the POP pattern is still unmatched.

**Key UX insight:** Pre-made component library of common paper prototype elements (screens, buttons, text fields, navigation bars, modals, menus, arrows, gesture indicators) that students drag onto a canvas. Each "screen" is a card. Connect cards with arrows to show user flow. Play mode: click through the connected screens as if using the app. The digital version of cutting paper and taping it together.

**AI potential:** **LIGHT** — AI reviews the flow and flags common usability issues: "Screen 3 has no back button — how does the user return?" Could suggest missing screens in a flow.

**Wow factor:** "Paper texture" rendering mode — all elements look like cut paper with slight shadows and torn edges. Export as a clickable prototype with paper aesthetic intact.

---

## 3. COLLABORATE (~7 tools)

Tools for teamwork, facilitation, and group decision-making.

### Round Robin
**Best-in-class:** SessionLab (sessionlab.com) — session design tool with timed activities and facilitator scripts. For the actual Round Robin mechanic, IdeaBoardz (ideaboardz.com) is closest — structured contribution boards with categories. Google Jamboard was popular before deprecation.

**Key UX insight:** Timed rotation with anonymous contributions. Teacher sets topic + number of rounds + time per round (30s-2min). Each student sees a text card, adds one idea, timer expires → card rotates to next student who builds on previous ideas. After N rounds, all cards are revealed with the evolution trail visible (idea → build → build → build). The constraint of one-idea-per-turn prevents dominance.

**AI potential:** **HEAVY** — After rotation, AI synthesizes themes across all cards. During rotation, AI could nudge quiet students: "You have 15 seconds left — what about the material choice?" Post-round: AI identifies the most-evolved ideas (longest build chains) and highlights unexpected connections.

**Wow factor:** The "evolution trail" view — see how one seed idea transformed through 5+ student hands. Like a visual game of telephone for ideas.

---

### Gallery Walk
**Best-in-class:** PBLWorks (pblworks.org) Gallery Walk Protocol — structured peer critique. For digital: Padlet (padlet.com) gallery mode with comment threads per post. StudioLoom's Class Gallery already implements a version of this.

**Key UX insight:** Station-based navigation. Each "station" is a student's/group's work. Viewer sees the work + structured feedback form (configurable: comment, PMI, Two Stars & a Wish, TAG — Tell something good, Ask a question, Give a suggestion). Timer per station forces movement. Anonymous option. The gallery walks itself — students can't skip or rush.

**AI potential:** **LIGHT** — AI monitors feedback quality in real-time: "Your feedback so far has been positive — can you find one thing that could be improved?" Ensures feedback is balanced. Post-walk: AI synthesizes all feedback received by each student into themes.

**Wow factor:** Heat map overlay showing which parts of the displayed work received the most attention/comments. Students see WHERE people looked, not just WHAT they said.

---

### Team Charter Builder
**Best-in-class:** Mural (mural.co) Team Charter template — structured canvas with team name, roles, norms, communication, goals, and success criteria. Notion Team Wiki template is also strong for ongoing reference.

**Key UX insight:** Guided 5-section flow: (1) Team Identity (name, logo/avatar, motto), (2) Roles & Strengths (each member picks a role from archetype cards: The Maker, The Researcher, The Leader, etc. — borrowed from Discovery Engine archetypes), (3) Working Norms (template statements with fill-in-the-blank: "We will communicate via ___ at least ___ times per ___"), (4) Conflict Protocol (what to do when we disagree — 3 options to choose from), (5) Success Criteria (how we'll know we succeeded). Charter is a living document — can be reopened and updated.

**AI potential:** **LIGHT** — AI suggests role assignments based on individual Discovery profiles if available. AI generates norm suggestions based on group composition ("Your team has 3 Makers and 1 Researcher — you might need a norm about research time allocation").

**Wow factor:** Charter renders as a "contract" with each member's avatar/signature at the bottom. Printable. Feels official.

---

### Consensus Builder
**Best-in-class:** Loomio (loomio.com) — structured group decision-making with proposals, discussions, and voting (agree/abstain/disagree/block). Decision-making without meeting, with clear outcomes. Gradients of agreement scale is the key UX innovation.

**Key UX insight:** Fist-to-five voting adapted for design decisions. Someone proposes a direction. All members simultaneously show their agreement level (1=strongly disagree, 5=strongly agree) — this prevents anchoring. Disagreements must include a written reason. The tool highlights where the group converges and diverges. A second round of voting after discussion shows if alignment improved.

**AI potential:** **HEAVY** — AI mediates disagreements: "Alex rated this 2 because of material cost. Jordan rated it 5 because of user appeal. Can you find an approach that addresses cost while keeping the appeal?" AI detects if one person always disagrees (possible disengagement) or always agrees (possible disengagement in the other direction).

**Wow factor:** Convergence visualization — animated dots (one per student) that start scattered across a 1-5 spectrum and drift toward consensus over multiple voting rounds. The visual movement IS the learning.

---

### Warm-up Activity Library
**Best-in-class:** SessionLab (sessionlab.com) — library of 700+ facilitation activities, filterable by type (icebreaker, energizer, closer), group size, time, materials. Hyper Island Toolbox is similar. For student-facing: Kahoot! is the king of classroom warm-ups but quiz-only.

**Key UX insight:** Quick-pick interface. Teacher selects: time available (2/5/10 min) + energy level needed (calm/medium/high) + group size + equipment available (none/paper/digital). System recommends 3 activities with one-line descriptions. Tap to expand full instructions. "Do This One" button starts a guided timer with step-by-step instructions on projector view. Library of 50+ activities across categories: icebreakers, energizers, brain breaks, closers, team builders.

**AI potential:** **LIGHT** — AI learns which warm-ups a teacher uses most and suggests new ones in similar style. AI adapts warm-up difficulty to class energy (detected from prior session's pace feedback). AI generates novel warm-ups based on the upcoming lesson topic.

**Wow factor:** "Spin the Wheel" random activity picker with animated wheel spin — satisfying randomness that students love. Projector-ready display with large text and countdown timer.

---

### Conflict Navigation Guide
**Best-in-class:** No direct digital equivalent for education. Closest: Harvard Negotiation Project's framework adapted digitally in various mediation apps. The Thomas-Kilmann Conflict Mode Instrument (TKI) is the established framework.

**Key UX insight:** Structured 4-step flow: (1) What happened? (each person writes their perspective privately — not shared until step 3), (2) How do you feel? (emotion cards: frustrated, hurt, confused, angry, disappointed, ignored, overwhelmed — select 1-3), (3) Share perspectives (both sides revealed simultaneously — no back-and-forth arguing), (4) What do we need? (each person writes their needs, AI helps find overlap). The key insight: simultaneous reveal prevents argument escalation.

**AI potential:** **HEAVY** — AI identifies overlapping needs and suggests compromise language. AI ensures perspectives are stated as "I feel..." not "You always..." (rewrites if needed). AI detects escalating language and suggests de-escalation.

**Wow factor:** Venn diagram showing where both parties' needs overlap — the shared ground is highlighted and becomes the starting point for resolution.

---

### Energy Level Pulser
**Best-in-class:** Mentimeter (mentimeter.com) — live audience response with word clouds, scales, and quick polls. Poll Everywhere is similar. For classroom energy specifically: ClassDojo has a simpler "class energy" feature but it's teacher-reported, not student-reported.

**Key UX insight:** One-tap pulse. Student sees a 5-point energy scale (🔋→⚡) and taps their current level. Teacher sees real-time class distribution on a histogram that updates live. Takes <5 seconds per student. Can be used at start, middle, or end of lesson. Historical comparison: "Your energy is lower today than Tuesday — want to do an energizer?"

**AI potential:** **LIGHT** — AI suggests lesson pace adjustment based on aggregate energy: "60% of the class is below 3 — consider a 2-minute break or movement activity before the next section." Feeds into the timing model.

**Wow factor:** Live animated histogram on teacher/projector screen that bars grow and shift as students tap in. Class average displayed as a large glowing number. Fast, visual, satisfying.

---

## 4. STRATEGY (~10 tools)

Tools for project planning, communication, and strategic thinking.

### Sprint Board
**Best-in-class:** Linear (linear.dev) — the gold standard for project management UX. Clean, fast, keyboard-first. For education: Asana boards are popular in PBL schools. Trello is simpler but lacks structure.

**Key UX insight:** Design-cycle-native columns. Not generic Kanban (To Do/Doing/Done) but MYP Design Cycle phases: Backlog → Inquiring (A) → Developing (B) → Creating (C) → Evaluating (D). Cards have: title, assignee avatar, time estimate, priority color, due date chip. Drag between columns. Quick-add at top of any column. The existing DesignPlanBoard component is the starting point.

**AI potential:** **LIGHT** — AI suggests task breakdowns: "Your 'Build prototype' card seems large — consider splitting into 'Sketch design', 'Gather materials', 'Assemble prototype', 'Document process'." AI flags cards stuck in one column too long.

**Wow factor:** Progress ring per column showing completion percentage. Velocity graph over time showing how fast the team moves cards. Feels professional — students use a real project management tool, not a toy version.

---

### Timeline Builder
**Best-in-class:** TeamGantt (teamgantt.com) — visual timeline with drag-to-resize bars, dependency arrows, milestones. For education: Preceden (preceden.com) is simpler and cleaner for student timelines.

**Key UX insight:** Horizontal bar chart where each task is a colored bar (color = design phase). Drag ends to resize duration. Drag entire bar to move. Click between bars to create dependency arrow. Milestones (diamonds) for key dates. Today line (red vertical) shows where you are. Past bars are grayed, future bars are bright. Zooms: day/week/month. Integration with term dates from timetable system.

**AI potential:** **HEAVY** — "I have 6 weeks and need to build a lamp" → AI generates a suggested timeline with realistic durations per design phase based on project type. AI flags unrealistic timelines: "You've allocated 1 day for prototyping a furniture piece — most students need 3-4 sessions."

**Wow factor:** Animate the timeline playing forward from start to end — see the project unfold in fast-forward. Makes abstract planning feel concrete.

---

### Resource Planner
**Best-in-class:** No perfect education equivalent. Closest: workshop supply lists in MakerSpace tools (Inventables, Tinkercad's material calculator). For budgeting: Google Sheets templates with formulas.

**Key UX insight:** 3 resource types side by side: Materials (with quantity × unit cost), Tools/Machines (with time slots needed), and Skills (what I need to learn). Each resource has a status: Have / Need / Ordered. Total cost calculator at the bottom. Integration with teacher's workshop equipment list (auto-populate available tools). "Share with teacher" button sends the resource list for approval.

**AI potential:** **LIGHT** — AI suggests materials commonly used for the type of project. AI flags cost overruns: "Your budget is $20 but materials total $35 — what could you substitute?"

**Wow factor:** Visual budget thermometer showing how much of the budget is allocated vs remaining. Red zone when over budget.

---

### Task Decomposition
**Best-in-class:** WorkFlowy (workflowy.com) — infinite nested outliner. For structured decomposition: ClickUp's task breakdown feature with subtask nesting. For education: none that do this well.

**Key UX insight:** Start with one big task at the top. Click "Break it down" → task splits into 2-5 subtasks below (student types them). Each subtask can be broken down further (max 3 levels). Each leaf task gets a time estimate and assignment. Tree visualization shows the decomposition. Total time auto-calculated by summing leaves. Forces students to think about what "build a prototype" actually means in practice.

**AI potential:** **HEAVY** — AI suggests decompositions: "Build prototype" → AI proposes subtasks based on project type. AI challenges shallow decomposition: "Gather materials" could be broken into "Research material options", "Check workshop stock", "Order missing items", "Prepare workspace."

**Wow factor:** Animated tree that grows as tasks are decomposed — branches sprouting from the trunk. Collapsed view shows the tree shape; expanded shows all detail.

---

### Pitch Builder
**Best-in-class:** PitchBob (pitchbob.io) — AI-powered pitch deck generator. For oral pitches specifically: Orai (orai.com) — speech coaching with pace, filler word detection, and eye contact tracking. For education: no direct equivalent.

**Key UX insight:** Structured elevator pitch framework: Hook (attention-grabbing first line) → Problem (what's wrong) → Solution (your design) → Evidence (why it works) → Ask (what you need). Each section has a textarea with character limit (forces concision). Built-in 60/90/120-second timer for practice. Record yourself → playback → self-assess. Peer feedback option.

**AI potential:** **HEAVY** — AI coaches pitch delivery: "Your hook is a statement — try starting with a question instead." AI generates alternative hooks from the same content. Post-recording: AI provides feedback on structure and persuasion (did you address the problem before the solution? did you include evidence?).

**Wow factor:** Confidence meter that fills as you practice (number of rehearsals tracked). "Share pitch" generates a shareable card with the pitch text + supporting image.

---

### Presentation Planner
**Best-in-class:** Beautiful.ai — AI-powered slide layout that auto-designs as you type content. For planning specifically: SlideDog/Mentimeter for presentation flow. For education: Google Slides outline view is the closest.

**Key UX insight:** Slide outline mode, not slide design mode. Each slide is a card with: title, key point (one sentence), visual idea (sketch area or image upload), talking points (bullet notes), and timing (minutes). Drag to reorder slides. Total time calculator vs available time. Timing practice mode: present with timer per slide, yellow/red warnings when over time.

**AI potential:** **LIGHT** — AI suggests slide order for maximum impact. AI generates talking point suggestions from key points. AI flags too many text-heavy slides in a row.

**Wow factor:** "Presentation flow" visualization showing the narrative arc (attention curve) — helps students see where their presentation peaks and dips.

---

### Design Brief Writer
**Best-in-class:** Briefz (briefz.biz) — random design brief generator for practice. For structured brief creation: 99designs creative brief system is professional-grade. For education: no good digital equivalent.

**Key UX insight:** Guided brief builder with 7 sections: Context (background, who is this for?), Problem (what needs solving?), Constraints (budget, time, materials, size), Requirements (must-haves), Preferences (nice-to-haves), Success Criteria (how will you know it works?), Inspiration (links, images, references). Each section has a prompt and an example. "Quick Brief" mode fills in sensible defaults and lets students modify.

**AI potential:** **HEAVY** — AI generates a complete brief from a one-sentence description: "I want to design a better water bottle for hikers" → full brief with constraints, user needs, success criteria. AI challenges vague briefs: "Anyone" is not a user — who specifically?"

**Wow factor:** Professional brief export — renders as a clean PDF with consistent formatting. Looks like a real client brief. Students feel like professionals.

---

### Business Model Canvas
**Best-in-class:** Strategyzer (strategyzer.com) — the original BMC tool from Alexander Osterwalder. The definitive reference. Clean 9-block canvas with guided prompts per block.

**Key UX insight:** 9-block canvas with sticky-note metaphor. Each block: Key Partners, Key Activities, Key Resources, Value Propositions (center, highlighted), Customer Relationships, Channels, Customer Segments, Cost Structure, Revenue Streams. Click block → guided prompts appear ("Who are your most important partners?"). Sticky notes within blocks (add/edit/delete). Color-code notes by theme. Export as single-page visual.

**AI potential:** **HEAVY** — AI challenges assumptions: "You listed 'everyone' as your customer segment — which specific group has the most urgent need?" AI identifies gaps: "You have 5 revenue streams but no cost structure — where's the money going?" AI generates starter canvas from a project description.

**Wow factor:** Viability score that updates as blocks are filled — shows overall business model health. Empty blocks glow red, filled blocks glow green.

---

### Rollout Timeline
**Best-in-class:** ProductPlan (productplan.com) — visual product roadmap with swim lanes. For launch planning: Notion Launch templates with checklist phases.

**Key UX insight:** Phase-based launch plan: Preparation → Soft Launch → Feedback → Iterate → Full Launch. Each phase: checklist of tasks, timeline bar, success criteria, risks. Swim lanes for different work streams (technical, marketing, user testing, documentation). Dependencies between phases (can't full-launch until feedback phase complete). Status indicators per task (not started, in progress, done, blocked).

**AI potential:** **LIGHT** — AI suggests common launch tasks based on project type. AI flags missing phases: "You're going straight to full launch — consider a soft launch with 5 test users first."

**Wow factor:** Launch countdown timer with confetti animation when all preparation tasks are complete. Makes the launch feel like an event.

---

### Measurement Framework
**Best-in-class:** Board of Innovation's Experiment Canvas — structured hypothesis testing for innovation. For education: no direct equivalent. Google's HEART framework (Happiness, Engagement, Adoption, Retention, Task success) is the professional reference.

**Key UX insight:** Structured measurement plan: (1) What are you measuring? (success criteria from design brief), (2) How will you measure it? (method: survey, observation, testing, data analysis), (3) What counts as success? (threshold: "80% of users can complete the task in under 2 minutes"), (4) When will you measure? (timeline: before, during, after), (5) What will you do with results? (action plan for each possible outcome). Forces students to define success BEFORE testing.

**AI potential:** **HEAVY** — AI suggests measurement methods based on success criteria: "If you want to know if users find it intuitive, consider a task completion test rather than a satisfaction survey." AI challenges weak metrics: "Asking 'do you like it?' measures politeness, not usability."

**Wow factor:** Results dashboard that populates as students enter test data — live charts showing performance against success thresholds. Green/amber/red status per metric.

---

## 5. SYSTEMS (~6 tools)

Tools for systems thinking, scientific method, and experimental design.

### Causal Loop Diagram
**Best-in-class:** Kumu (kumu.io) — relationship mapping platform with causal loop support, stakeholder maps, and system dynamics. Force-directed graph layout. Used by systems thinkers globally. Creately also has strong causal loop templates.

**Key UX insight:** Node-and-arrow canvas. Students create variables (nodes), then draw arrows between them labeled with + (reinforcing) or - (balancing). Auto-detection of feedback loops (the system highlights when a chain of arrows forms a cycle). Color-code loops: reinforcing (grows forever) = red, balancing (stabilizes) = blue. Layout auto-adjusts as nodes are added. Guided mode walks through the process: "What happens when X increases? Does Y go up (+) or down (-)?"

**AI potential:** **HEAVY** — AI identifies hidden feedback loops: "You've shown that 'more marketing' → 'more customers' → 'more revenue' → 'more marketing budget' — this is a reinforcing loop. What might balance it?" AI challenges missing variables: "What environmental factor might limit this growth loop?"

**Wow factor:** Animated simulation mode — play the system forward in time and see which loops dominate. Variables grow/shrink in real-time. Shows students WHY systems behave unexpectedly.

---

### Futures Cone Builder
**Best-in-class:** Board of Innovation's Futures Toolkit — structured future scenario planning. For the cone metaphor specifically: Stuart Candy's futures cone visualization is the reference. No production digital tool does this well yet — opportunity for StudioLoom to own this.

**Key UX insight:** Visual cone expanding from "Now" (left point) to "Future" (right opening). Four nested layers: Probable (inner, dark) → Plausible (next layer, medium) → Possible (wider, lighter) → Preferable (student's choice, highlighted). Students place scenario cards in the appropriate layer. Each card: short description + evidence/reasoning for that placement. The debate is in the placement — why is "AI replaces all teachers" possible but not probable?

**AI potential:** **HEAVY** — AI challenges placements: "You put 'flying cars' in Probable — what evidence supports this timeline?" AI generates provocative scenario cards to place: "What if fresh water becomes more expensive than petrol?" AI helps students distinguish between probable (evidence-based) and preferable (values-based).

**Wow factor:** The cone itself animates — scenarios placed closer to "Now" glow brighter, distant ones fade. Zoom into any layer to see details. The visual metaphor IS the learning.

---

### Ripple Effect Mapper
**Best-in-class:** No direct digital equivalent — this is a novel tool. Closest: consequence mapping in strategic planning tools, impact assessment matrices in environmental studies. The "2nd and 3rd order effects" framework from systems thinking.

**Key UX insight:** Concentric ripple rings radiating from a central decision. Ring 1 = immediate/direct effects. Ring 2 = secondary effects (effects of the effects). Ring 3 = tertiary effects. Students place consequence cards on the appropriate ring. Lines connect causes to consequences across rings. Color-code: positive (green), negative (red), uncertain (amber). The tool forces students to think beyond first-order consequences.

**AI potential:** **HEAVY** — AI's killer feature here. After Ring 1 is filled, AI suggests Ring 2 consequences: "If more people cycle to work (Ring 1), what happens to car parking revenue for the city? (Ring 2)" AI challenges students to find 3rd order effects that loop back to the original decision. AI detects when students only see positive ripples: "You've listed 5 positive effects — can you find one unintended negative consequence?"

**Wow factor:** Animated ripple propagation — drop the decision in the center, watch ripple rings animate outward, cards appear on each ring with connecting lines drawing themselves. Visually stunning and conceptually clear.

---

### A/B Testing Matrix
**Best-in-class:** Google Optimize (now deprecated but the UX was the reference). For experiment design in education: Experiment.com for crowdfunded research, and Labster for virtual science labs. The scientific method template pattern is well-established.

**Key UX insight:** Structured experiment card: Hypothesis ("If I change X, then Y will happen because Z") → Variables (independent, dependent, controlled — drag to categorize) → Method (step-by-step procedure) → Sample size → Data collection plan → Results table (auto-generated columns from variables) → Conclusion (supported/not supported/inconclusive + evidence). Two columns side by side: Option A (control) vs Option B (test). Forces rigorous comparison.

**AI potential:** **HEAVY** — AI reviews experimental design: "Your hypothesis is testable but your sample size (2 people) is too small for meaningful results." AI suggests controlled variables the student missed. AI helps interpret results: "Your data shows a difference, but is it statistically significant?"

**Wow factor:** Real-time results visualization as data is entered — bar charts, before/after comparisons. Makes data collection feel like science, not homework.

---

### Assumption Buster Game
**Best-in-class:** Board of Innovation's Assumption Mapping tool — plots assumptions on a certainty/impact matrix. Innovation Games' "Speed Boat" is a gamified approach to identifying anchors/risks.

**Key UX insight:** Gamified 3-round challenge. Round 1: "List everything you believe is true about your project" (timer, quantity over quality). Round 2: For each assumption, rate: How critical is this? (if wrong, does the project fail?) + How certain are you? (evidence level). Plot on a 2×2 matrix: High Impact + Low Certainty = "TEST THIS FIRST" (red zone). Round 3: Pick top 3 critical uncertain assumptions → write a quick experiment to test each. The game framing makes assumption-challenging feel fun, not threatening.

**AI potential:** **HEAVY** — AI generates provocative counter-assumptions: "You assume users want a physical product — what if they'd prefer a service?" AI identifies hidden assumptions the student didn't list: "You haven't questioned whether your target user can afford this." AI rates assumption certainty: "You said you're 'pretty sure' teenagers prefer mobile — where's your evidence?"

**Wow factor:** "Assumption Graveyard" — assumptions that get busted are animated falling into a graveyard with a tombstone. Satisfying visual destruction of bad assumptions. Students WANT to bust assumptions to fill the graveyard.

---

### Sustainability Canvas
**Best-in-class:** Flourishing Business Canvas (flourishingbusiness.org) — extension of BMC for sustainable business design. For environmental specifically: Life Cycle Assessment tools (SimaPro is professional, but no good education version). For triple bottom line: B Corp Impact Assessment.

**Key UX insight:** Triple-lens assessment: Environmental (materials, energy, waste, transport, end-of-life) + Social (labor, accessibility, community impact, cultural sensitivity, equity) + Economic (cost, value, longevity, repair/reuse potential). Each lens has guided questions. Students score each dimension (1-5) with evidence. Radar chart shows balance across all three dimensions. Imbalance is highlighted: "Your design scores 5/5 on Economic but 1/5 on Environmental — how could you improve without sacrificing function?"

**AI potential:** **HEAVY** — AI suggests sustainability improvements: "Your design uses virgin plastic — have you considered recycled ocean plastic? It costs 15% more but scores 3 points higher on environmental impact." AI calculates approximate carbon footprint from materials listed. AI challenges greenwashing: "Saying it's 'eco-friendly' isn't specific — which environmental metrics actually improve?"

**Wow factor:** Planet health visualization — a small Earth graphic that gets greener/healthier as sustainability scores improve. Emotional hook — students see their design's impact on the planet.

---

## 6. DISCOVERY (~7 tools)

Psychometric and self-awareness tools adapted from the Discovery Engine.

### Archetype Finder
**Best-in-class:** 16Personalities (16personalities.com) — the gold standard for personality assessment UX. Beautiful illustrations per type, engaging animated flow, shareable results cards. Also: StrengthsFinder (Gallup) for strength-based profiling, and Character Strengths (VIA Institute) for values-based assessment.

**Key UX insight:** Binary pair selections (not Likert scales — teens hate rating 1-5). "Would you rather fix a broken radio or write a poem about it?" Fast (30-60 seconds per pair), 15-20 pairs total. Each pair reveals a tendency without the student knowing what's being measured. Results: 6 archetypes (Maker/Researcher/Leader/Communicator/Creative/Systems Thinker) shown as a radar chart with primary + secondary archetype highlighted. Description text is aspirational and specific ("You're a Maker — you think with your hands and trust the process of trying things").

**AI potential:** **LIGHT** — AI generates the binary pairs dynamically based on project context. Post-result: AI connects archetype to upcoming project: "As a Maker-Researcher, you might start by building a rough prototype, then researching to refine it."

**Wow factor:** Archetype reveal animation — card flip, particle effects, personal archetype illustration. Shareable card with student's archetype, radar chart, and top 3 strengths. Built from existing Discovery Engine S1 (Campfire) code.

---

### Strength Mapper
**Best-in-class:** CliftonStrengths (Gallup) for adults, but the UX is corporate. For teens: Character Lab's character strength surveys. For scenario-based: "What Would You Do?" frameworks from moral development psychology.

**Key UX insight:** Scenario-based discovery, not self-report. Present 8-10 scenarios ("Your best friend is panicking — big project due tomorrow, 2 hours left. What do you ACTUALLY do?"). Multiple response options per scenario, each mapping to different strengths. Students pick what they'd really do (not what they should do). No right answers. Results map to concrete strengths: "Problem decomposition", "Calm under pressure", "Creative improvisation", "Empathetic leadership", "Resourcefulness."

**AI potential:** **HEAVY** — AI interprets free-text responses to open-ended scenarios (not just multiple choice). AI generates follow-up questions based on initial answers: "You said you'd 'make a plan first' — interesting. What if there wasn't time for a plan?" AI detects when students are answering aspirationally vs honestly.

**Wow factor:** Strength constellation — strengths displayed as stars in a personal constellation pattern. Brighter stars = stronger strengths. Connected by lines forming a unique shape. "Your constellation" — beautiful, personal, shareable.

---

### Interest Sorter
**Best-in-class:** Pinterest interest onboarding — visual card grid, tap to select interests, AI refines recommendations. For education: Naviance interest profiler for career exploration. The card sort methodology is from UX research (OptimalSort by Optimal Workshop).

**Key UX insight:** Two-phase sort. Phase 1: "What annoys you?" — present 20 irritation cards (bad packaging, slow websites, uncomfortable chairs, confusing instructions, ugly buildings, wasteful processes, etc.). Tap to select 5-8 that genuinely bother the student. Phase 2: AI clusters the irritations into interest themes: "You're annoyed by bad packaging AND wasteful processes — you care about sustainable design." Irritation → interest conversion is more authentic than asking "what are you passionate about?"

**AI potential:** **HEAVY** — AI clusters irritations into interest themes using natural language understanding. AI generates follow-up irritation cards based on initial selections (adaptive card pool). AI writes the interest narrative: "Your irritations suggest you care deeply about how things FEEL in daily life — textures, ergonomics, and the invisible design decisions that most people don't notice."

**Wow factor:** Irritation-to-interest transformation animation — red irritation cards physically transform (flip, morph) into green interest cards. Visceral and satisfying. "Your frustrations are your superpowers."

---

### Values Card Sort
**Best-in-class:** Personal Values Card Sort (Miller, C'de Baca, Matthews & Wilbourne) — the established psychology protocol with 83 value cards. Digital versions: Life Values Inventory Online, Brené Brown's Dare to Lead values exercise (pick 2 from 100+). For teens: Character.org's values exploration.

**Key UX insight:** 3-pile card sort with visual drag. Show 20 value cards one at a time (Creativity, Fairness, Independence, Community, Adventure, Knowledge, Harmony, Achievement, Security, Compassion, etc.). Each card has the value word + a one-line definition. Student sorts into 3 piles: Very Important / Somewhat Important / Not Important. Then narrows "Very Important" to Top 5. Then ranks Top 5. The progressive narrowing IS the learning — it's easy to say everything matters, hard to choose what matters MOST.

**AI potential:** **LIGHT** — AI generates reflection questions based on final ranking: "You ranked Fairness #1 and Achievement #3 — what would you do if being fair meant not winning?" AI detects contradictions: "You put Independence in 'Very Important' but Community in Top 5 — how do you balance these?"

**Wow factor:** Value shield/crest visualization — Top 5 values arranged as a personal coat of arms. Each quadrant has the value word + an icon. Printable and shareable. "This is what I stand for."

---

### Fear Reframer
**Best-in-class:** No direct digital equivalent — this is novel. Closest: Cognitive Behavioral Therapy (CBT) thought challenging worksheets digitized (MoodKit, Woebot). For teens specifically: headspace and Calm have anxiety-related content but not reframing exercises.

**Key UX insight:** 3-step fear processing: (1) Name it — select from fear cards or write your own ("I'm afraid my project will be embarrassing", "I'm afraid I'll waste materials", "I'm afraid people will laugh at my idea"), (2) Examine it — guided questions: "What's the worst that could actually happen? How likely is that? What would you tell a friend who felt this way?", (3) Reframe it — AI generates a reframed perspective, student can accept/modify/reject. The key: normalize fear BEFORE reframing ("Every designer feels this — here's what professionals do about it").

**AI potential:** **HEAVY** — AI generates personalized reframes based on the specific fear. AI distinguishes productive fear (motivating caution) from paralyzing fear (blocking action). AI draws on real designer quotes and stories: "Jonathan Ive said his biggest fear with the original iPhone was that nobody would get it. Fear of being misunderstood = you're doing something genuinely new."

**Wow factor:** Fear-to-fuel transformation animation. The fear card physically catches fire (animated) and transforms into a fuel card: "Fear of failure → Permission to experiment." Dramatic, memorable, Instagram-worthy.

---

### Working Style Profiler
**Best-in-class:** DISC assessment for workplace styles. For education: learning style inventories (though debunked for instruction, useful for self-awareness). For collaboration: Belbin Team Roles. For teens: MindTools' self-assessment quizzes adapted.

**Key UX insight:** Scenario-based with nuanced options (not just solo/pair/group). 10 scenarios showing different working contexts: "You're stuck on a design problem. Do you: (A) go for a walk and think alone, (B) sketch it out with one partner, (C) get 4 people around a whiteboard, (D) look at how others have solved similar problems." Each answer maps to multiple working style dimensions: social preference (solo-pair-group), cognitive style (visual-verbal-kinesthetic), energy pattern (sprinter-marathoner), feedback preference (real-time-delayed-written), environment (quiet-buzzy-music).

**AI potential:** **LIGHT** — AI generates a working style narrative: "You work best in short, intense sprints with one partner, in a quiet space, with feedback at the end rather than during." AI suggests project structure based on style: "Given your style, consider working alone for ideation, then pairing up for critique."

**Wow factor:** "Studio Setup" card — a visual representation of your ideal working environment (desk arrangement, noise level indicator, companion preferences, time of day). Like setting up your RPG character's home base.

---

### Design DNA Profiler
**Best-in-class:** No direct equivalent — this is unique to StudioLoom. Closest concepts: the TeachingDNA visualization already built for teachers, the archetype system from Discovery Engine, and 16Personalities' type system adapted for design thinking.

**Key UX insight:** Composite profile built from multiple data points (not a single quiz). Pulls from: archetype (Discovery Engine), working style, values, strengths, toolkit usage patterns, reflection themes, project portfolio. Displayed as a DNA helix visualization with color-coded "genes": Curiosity strand, Craft strand, Critique strand, Collaboration strand, Courage strand, Compassion strand. Each strand has a level (1-5) based on accumulated evidence. The profile evolves over time — not a one-time quiz.

**AI potential:** **HEAVY** — AI synthesizes all available student data into a coherent design identity narrative. AI tracks changes over time: "Your Craft strand grew from 2 to 4 this semester — your prototyping skills have visibly improved." AI suggests growth areas: "Your Courage strand is your lowest — consider taking on a project outside your comfort zone."

**Wow factor:** Animated DNA helix that rotates slowly, with each strand glowing at its current level. Time-lapse mode shows the DNA evolving across the semester. The most personal and longitudinal tool in the entire toolkit. This is the capstone.

---

## Cross-Cutting UX Patterns

### Patterns that apply to ALL expansion tools:

1. **Constraint-as-feature**: Every tool constrains the student in some way (limited cards, forced structure, timed responses). The constraint IS the pedagogy — it prevents shallow engagement.

2. **Progressive reveal**: Don't show everything at once. Tools should unfold as the student engages. Empty states should invite, not overwhelm.

3. **AI as provocateur, not assistant**: AI in these tools should challenge, question, and push — not summarize or do the work. The AI makes the student think harder, not easier.

4. **Shareable outputs**: Every tool should produce a visual artifact worth sharing — a card, chart, diagram, or profile. Screenshot-worthy outputs drive organic adoption.

5. **Session persistence**: All tools use `useToolSession` hook for auto-save and resume. Students can leave and come back without losing work.

6. **Effort-gating before AI feedback**: Assess input quality client-side before choosing AI response strategy. Low effort = push harder. High effort = celebrate and deepen.

7. **No right answers**: Discovery, Growth, and Collaborate tools especially must never imply a "correct" result. Multiple valid outcomes for every tool.

8. **Teen-appropriate language**: Avoid corporate jargon. "Working style" not "productivity profile." "Fear reframer" not "cognitive behavioral intervention." Keep it real.

---

## AI Potential Summary

| Rating | Count | Tools |
|--------|-------|-------|
| **HEAVY** | 24 | Wireframe Builder, Mood Board, Storyboard, Cultural Landscape, Round Robin, Consensus Builder, Conflict Navigation, Timeline Builder, Pitch Builder, Design Brief Writer, BMC, Measurement Framework, Causal Loop, Futures Cone, Ripple Effect, A/B Testing, Assumption Buster, Sustainability Canvas, Strength Mapper, Interest Sorter, Fear Reframer, Design DNA Profiler, Task Decomposition, Energy Level Pulser (light) |
| **LIGHT** | 15 | Annotation, Comparison Sketch, Power Grid, Paper Prototype, Gallery Walk, Team Charter, Warm-up Library, Sprint Board, Resource Planner, Presentation Planner, Rollout Timeline, Archetype Finder, Values Card Sort, Working Style Profiler |
| **NONE** | 4 | Quick Sketch (already built), Dot Voting (already built), Energy Level Pulser, Stakeholder Power Grid |

**Key finding:** 24 of 43 expansion tools benefit significantly from AI integration. StudioLoom's per-step AI rules architecture (the key differentiator identified in competitive analysis) extends naturally to all these tools. The AI doesn't just help — it makes the tool fundamentally better than a static template.

---

## Build Complexity Estimates

| Category | Avg Complexity | Total Days | Notes |
|----------|---------------|-----------|-------|
| Discovery | Medium | 8-10 | Heaviest code reuse from Discovery Engine |
| Collaborate | Medium-High | 10-12 | Real-time features add complexity |
| Visual | High | 12-15 | Canvas/drawing tools are technically complex |
| Strategy | Medium | 10-12 | Mostly structured forms + visualization |
| Growth | Low-Medium | 5-7 | Simpler tools, less interactivity |
| Systems | High | 12-15 | Node-graph UIs are complex, simulation logic |

**Total estimate: ~57-71 days for all 43 expansion tools.** At Matt's pace (~3-5 tools per intense session), this is roughly 10-15 sessions over 2-3 months.
