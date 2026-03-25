# Quest Journey System — Vision & Architecture
*Research synthesis for StudioLoom's student project journey*
*25 March 2026*

---

## The Big Idea

Every MYP student doing a Service unit, Personal Project, or extended Design project follows the same emotional arc: **"I don't know what to do" → "I have a plan" → "I'm making it happen" → "Look what I did."** StudioLoom turns this arc into a visual, game-inspired journey with an AI mentor who adapts to each student's needs.

The experience draws from three design lineages:
- **Gris** — color as progression, watercolor aesthetics, emotional journey baked into visuals
- **Zelda BotW** — quest UI that feels like a tool (not a chore), minimal chrome, world-integrated interface
- **Celeste** — adjustable "Assist Mode" as a permission structure (not a difficulty setting)

The teacher controls the scaffolding level. The AI mentor walks alongside. The student owns the journey.

---

## Architecture: Four Phases, One Visual World

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  DISCOVERY    │───▶│   PLANNING    │───▶│   WORKING     │───▶│   SHARING     │
│  "Who am I?"  │    │ "What's the   │    │ "Making it    │    │ "What did I   │
│               │    │  plan?"       │    │  happen"      │    │  learn?"      │
│  Warm golds   │    │ Cool blues    │    │ Bright,       │    │ Soft, muted   │
│  Exploratory  │    │ Structured    │    │ energetic     │    │ Reflective    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
  ~1-2 sessions       ~1-2 sessions       Bulk of time        Final session(s)
```

Each phase has a **distinct visual identity** (Journey/Gris-inspired):
- **Discovery:** Warm golds and creams, hand-drawn feel, wide open spaces
- **Planning:** Cool blues and grays, structured grids, maps and timelines
- **Working:** Saturated brights, energetic, workshop feel, tools everywhere
- **Sharing:** Soft pastels, calm, communal, gallery/exhibition space

**Color-as-progression (Gris mechanic):** The student's world starts muted/grayscale and gains color as they complete phases. Completing Discovery "unlocks" the warm palette. Planning unlocks cool tones. Working adds saturation. Sharing brings the full spectrum. This is achievable with CSS `filter: saturate()` transitions + phase-specific gradient backgrounds.

---

## The Campfire: Mentor Selection + Discovery

### Choose Your Mentor

Before Discovery begins, the student picks one of 5 mentor archetypes. The choice itself is data — it reveals how the student wants to be spoken to.

| Mentor | Personality | Teaching Style | Visual | Who picks them |
|--------|-------------|---------------|--------|----------------|
| **Kit** | Warm maker, tinkerer | "Let's try it and see" | Workshop apron, tool belt | Hands-on makers |
| **Sage** | Intellectual questioner | "What if we think about it this way?" | Books, glasses, calm | Researchers, thinkers |
| **River** | Storyteller, connector | "That reminds me of..." | Scarf, travel patches | Social students, empaths |
| **Spark** | Provocateur, challenger | "But what if you're wrong?" | Spiky hair, bold colors | Competitive, confident kids |
| **Haven** | Quiet builder, patient | "Take your time. I'll be here." | Soft colors, plants | Anxious, perfectionist students |

**Selection UX:** 5 illustrated cards on a "campfire" screen. Each card shows the mentor's illustration + a 1-line personality teaser. Hover/tap reveals a short audio intro (pre-recorded, ~10 seconds). Student picks one. The mentor "joins" them with a spring animation entrance.

**Why this matters:** The mentor choice feeds the AI system prompt for ALL subsequent interactions. Kit gives hands-on suggestions. Sage asks philosophical questions. Spark challenges assumptions. Same educational content, different delivery — like having 5 different teachers.

### Discovery Flow (The Campfire Game)

The mentor leads the student through 5 discovery steps using **provocation, not interrogation**:

1. **Strengths** — "Your best friend is panicking. Big project due tomorrow, 2 hours left. What do you actually do?" (reveals maker/researcher/leader/connector archetype without asking "what are your strengths?")

2. **Interests** — "What annoys you? Like really bugs you about how something works or how people are treated?" (irritation surfaces authentic interests better than "what's your passion?")

3. **Needs Scan** — "Look around your school, your neighborhood, your family. What's broken? What would you fix if you had a magic wand and one weekend?" (shifts from self → outward)

4. **Narrowing** — Student's top 3 ideas get a lightweight feasibility check: time available, resources needed, people to talk to, excitement level

5. **Commitment** — Student writes a one-paragraph project statement: what, who for, why it matters to them

**Visual approach:** Comic strip panels (already built in ComicPanel.tsx) with phase-specific SVG scene illustrations. Each step reveals new panels with spring-physics animation. Speech bubbles for mentor dialog, text input areas for student responses. ProfileReveal cards appear inline showing discovered strengths/interests as the conversation progresses.

**Key educational principle:** The mentor tells stories FIRST (campfire effect), then asks students to respond to scenarios. "What do you actually do when..." reveals more than "Tell me about yourself." Based on adolescent psychology research: direct questioning is the #1 trust killer with teens.

---

## Planning Phase: Backward from Done

### The Student Contract

Inspired by High Tech High's approach. After Discovery, the student writes their own contract:

- What I'm making / doing / building
- Who it's for
- What "done" looks like (specific, observable)
- My milestones and dates
- What help I'll need (resources, people, materials)
- How I'll know if I'm on track

The AI helps the student THINK through each section but never writes it for them. Effort-gating applies: the contract fields require meaningful input (word count + specificity markers) before the AI will provide feedback.

### Backward Planning Timeline

**Critical first step: Time awareness.** The AI knows:
- Unit end date / term end date (from teacher settings + timetable engine)
- How many sessions remain (computed by cycle engine)
- School events, holidays (from excluded_dates)

Then it works backward:
- **Final milestone:** Presentation-ready (1 session before end)
- **Pre-final:** Testing/feedback/polish (2 sessions before)
- **Mid-point:** Core work complete, rough but functional
- **Early:** Research/prototyping/first attempts done
- **Now:** First concrete step identified

**Visual:** A horizontal timeline component (not a list) showing milestones as nodes on a path. Current date highlighted. Past milestones show completion status. Future milestones show countdown. The path curves and branches — it's a journey, not a Gantt chart.

### SMART Goals per Milestone

Each milestone gets broken into 1-3 SMART goals. The AI scaffolds this:
- **Specific:** "What exactly will you produce?"
- **Measurable:** "How will you know it's done?"
- **Achievable:** "Can you do this in [N] sessions?"
- **Relevant:** "How does this connect to your project statement?"
- **Time-bound:** "When will you check this off?"

For younger students (MYP 1-2, ages 11-12), the AI uses simpler language and more examples. For older students (MYP 4-5, ages 14-16), the AI expects more sophisticated planning.

---

## Working Phase: Make It Happen

### Multi-Channel Evidence Collection

Students shouldn't have to write a report every session. Multiple low-friction channels:

| Channel | Friction | Implementation |
|---------|----------|---------------|
| **Photo drop** | Very low | Camera button → compress → attach to current milestone |
| **Voice memo** | Low | Record button → transcribe (Whisper API) → store |
| **Quick text** | Low | 2-3 sentence update, prompted by AI check-in |
| **Milestone check-off** | Very low | Tap to mark complete in timeline |
| **Work submission** | Medium | Upload file/link tied to milestone |
| **Reflection journal** | Medium-High | Longer written reflection with effort-gating |
| **AI conversation** | Varies | Student-initiated help, feedback, or crit |

**Quick Capture Bar:** Persistent floating bar at bottom of screen during Working phase. Three buttons: 📷 (photo), 🎤 (voice), ✏️ (text). One tap to capture, auto-linked to current milestone and phase.

### AI Health Score Model

The AI maintains a rolling assessment per student:

| Dimension | Signals | Display |
|-----------|---------|---------|
| **Momentum** | Milestone check-offs, submissions, photo drops | 🟢🟡🔴 |
| **Engagement** | Evidence frequency, AI interactions initiated | 🟢🟡🔴 |
| **Quality** | Work complexity over time (AI assessment) | 🟢🟡🔴 |
| **Self-awareness** | Accuracy of self-check-ins vs actual progress | 🟢🟡🔴 |

**Adaptive check-in frequency:**
- All green → every 20-30 min (light touch)
- Some amber → every 10-15 min (supportive)
- Any red → every 5-10 min (direct)
- Multiple red → continuous + teacher flag

### Teacher Help Intensity Slider (Celeste's Assist Mode)

Per-student slider with 3 levels + auto mode:

| Level | What changes | When to use |
|-------|-------------|-------------|
| **Explorer** (low) | AI asks open questions, rarely examples, waits for initiative | Independent, confident students |
| **Guided** (medium) | AI probes + suggests directions, 1 example, responds to requests | Most students, default |
| **Supported** (high) | AI structures steps, multiple examples, proactive suggestions | Struggling, anxious, or ELL students |
| **Auto** | AI adapts based on health score + response patterns | Set and forget |

Frame it as "adjustable support levels" not "difficulty settings." This maps directly to StudioLoom's existing 3-tier ELL scaffolding and the Workshop Model's gradual release of responsibility.

**Per-phase variation:** Default to higher support during Discovery/Planning (reduce cognitive load), lower during Working (increase creative autonomy). Teacher can override per-student.

### Teacher Resource Directory

Teachers manage a "people & resources" section:

- **Equipment:** 3D printers, laser cutters, sewing machines (many already in Workshop & Equipment settings)
- **Materials:** Fabric, wood, electronics, budget per student
- **People:** Other teachers (expertise areas), parents (skills/professions), local businesses, community contacts
- **Digital:** Software licenses, online resources, tutorial links

When a student gets stuck, the AI can suggest: "For your accessibility project, you might want to talk to someone who uses assistive technology daily. Your teacher has listed [Ms. Chen, Design Technology] and [Parent Volunteer: David, occupational therapist] as contacts who could help."

The AI draws on this directory contextually — it never cold-suggests random contacts, only when the student's current challenge matches a resource's expertise.

---

## Sharing Phase: Exhibition + Reflection

### Presentation Scaffolding

The AI helps students prepare to present:
- Story structure: Problem → Process → Solution → Impact → Learning
- Audience awareness: "Who's in the room? What do they care about?"
- Practice prompts: "Explain your project in 30 seconds. Now in 2 minutes. Now in 5."
- Anticipate questions: "What's the hardest question someone could ask you?"

### Peer Review (Class Gallery)

Structured feedback using toolkit tools (PMI, Two Stars & a Wish, or any evaluation tool). Effort-gated: must complete minimum reviews before seeing own feedback. Teacher controls anonymous vs. named.

### Final Reflection

Structured self-evaluation comparing:
- Original project statement vs. actual outcome
- Planned milestones vs. actual timeline
- Strengths discovered vs. strengths demonstrated
- What they'd do differently

This feeds into the student's Designer Level / competency progression.

---

## The Visual World: Achievable Game-Like UX

### Recommended Tech Stack

Based on extensive research, here's what's achievable for a solo developer in a Next.js app:

| Layer | Tool | Why |
|-------|------|-----|
| **Primary animation** | Framer Motion (already in codebase) | Spring physics, drag/gesture, layout animations, AnimatePresence |
| **World/map navigation** | React Flow | Node-based progression map (Mario World-style overworld) |
| **Scene illustrations** | SVG (hand-drawn style) | Already proven in ComicPanel.tsx |
| **Watercolor effects** | CSS blend modes + gradients | `mix-blend-mode: multiply`, radial gradients, paper texture overlay |
| **Character animations** | Lottie (LottieFiles.com) | Pre-made celebration/entrance animations |
| **Complex sequences** | GSAP (GreenSock) | Timeline-based choreography for phase transitions |
| **Dialog system** | Custom React components | Speech bubbles (already built), branching choices |

### What NOT to Use

- **Phaser.js** — Excellent game engine but overkill for this. We don't need physics, collision detection, or a game loop. The "game" is really a guided journey with animated transitions, not a real-time interactive world.
- **Three.js / React Three Fiber** — 3D is unnecessary and hurts iPad performance
- **Full RPG framework** — We're building an interactive story, not a game with combat/inventory

### The Overworld Map (Mario World-Inspired)

A React Flow-based progression map replaces the current JourneyMap pills:

```
    🏕️ ──── 📋 ──── 🔨 ──── 🎤
  Campfire   Plan    Workshop  Stage
  (Discovery) (Planning) (Working) (Sharing)
```

- Each phase is a large node with custom SVG illustration
- Within each phase, milestones appear as smaller connected nodes
- Completed nodes glow with phase color, incomplete nodes are muted
- Current position has a pulsing indicator (the student's avatar)
- Paths between nodes animate as the student progresses (Gris-inspired color fill)
- The map is always accessible (sticky header in compact mode, full screen on tap)

**Implementation:** React Flow with custom node components + Framer Motion for transitions. Nodes rendered as SVG illustrations with CSS blend modes for the watercolor feel. Path animations via SVG stroke-dasharray + CSS animation.

### Phase Transitions (Journey-Inspired)

When a student completes a phase and moves to the next:

1. Current phase illustration fades with a watercolor "wash" effect (CSS filter transition)
2. A cinematic panel slides in showing the path between phases (already built in StepTransition)
3. New phase palette takes over (background gradient shift, 800ms spring transition)
4. Mentor appears with a phase-appropriate greeting
5. New phase tools/UI elements animate in with staggered spring entrance

**Duration:** 2-3 seconds total. Long enough to feel ceremonial, short enough not to annoy.

### Gris-Inspired Color Progression

```css
/* Phase 0: Pre-discovery — nearly monochrome */
.phase-undiscovered { filter: saturate(0.15) brightness(1.1); }

/* Phase 1: Discovery — warm golds emerge */
.phase-discovery { filter: saturate(0.5) sepia(0.2); }

/* Phase 2: Planning — cool tones added */
.phase-planning { filter: saturate(0.7); }

/* Phase 3: Working — full saturation */
.phase-working { filter: saturate(1.0); }

/* Phase 4: Sharing — full + subtle glow */
.phase-sharing { filter: saturate(1.0) brightness(1.05); }
```

Apply to the page wrapper with CSS transitions. Each phase "unlocks" more visual richness. Students literally see their world become more colorful as they progress.

---

## Framework-Specific Unit Types

The AI Unit Wizard needs three distinct paths:

### Design Units (MYP 1-5)
- **Guided by:** 4-stage Design Cycle (Inquiring & Analysing → Developing Ideas → Creating the Solution → Evaluating)
- **Assessment:** Criteria A-D, 1-8 scale
- **AI focus:** Iterative prototyping, testing, documentation
- **Existing:** This is what StudioLoom already does well

### Service as Action (MYP 1-5)
- **Guided by:** 5-stage SaA framework (Investigate → Plan → Take Action → Evidence → Reflect)
- **Assessment:** 7 learning outcomes (developmental, not scored 1-8)
- **Key differences:** Community needs analysis in Discovery, impact measurement in Sharing, ongoing reflection throughout
- **AI focus:** Connecting student strengths to community needs, ensuring authentic (not token) service
- **IB requirement:** Must show impact on both student AND community

### Personal Project (MYP 5 only)
- **Guided by:** 3 criteria (Planning, Applying Skills, Reflecting)
- **Assessment:** 1-8 scale, externally moderated
- **Duration:** Minimum 25 hours tracked
- **Key differences:** 3+ documented supervisor meetings, ATL skills explicitly assessed, reflective report required
- **AI focus:** Self-management scaffolding, meeting preparation, process journal prompts
- **IB requirement:** Counts toward MYP certificate eligibility

### Wizard Adaptations

When a teacher selects framework type in the wizard:

| Wizard Step | Design | Service | Personal Project |
|-------------|--------|---------|-----------------|
| **Goal input** | "What design challenge?" | "What community need?" | "What personal interest?" |
| **Criteria** | A-D (Design Cycle) | 7 SaA outcomes | A-C (Plan/Apply/Reflect) |
| **Discovery prompts** | Skills + interests | Skills + community connection | Passion + feasibility |
| **Planning scaffold** | Design brief + specifications | Action plan + stakeholder map | Project proposal + timeline |
| **Milestone defaults** | Prototype iterations | Service hours + impact evidence | 25-hour tracked phases |
| **Sharing format** | Exhibition/portfolio | Community presentation + reflection | Process journal + product + report |

The AI fills the framework-specific gaps (criteria, milestone templates, reflection prompts) but the student co-creates the actual content. The Discovery → Planning → Working → Sharing arc is universal across all three.

---

## Open Source Game Projects Worth Knowing

Research identified these, ranked by relevance:

### Top Pick: Pixi'VN (Visual Novel Engine)
- **What:** PixiJS-based engine with native React template, built-in dialog/branching
- **Why relevant:** Dialog-first, exactly what Discovery flow needs
- **Verdict:** Worth studying the dialog system architecture, but we don't need the full engine. Our React + Framer Motion + SVG approach is lighter and more integrated.

### Phaser 3 + React Template
- **What:** Official 2024 Phaser + React + TypeScript template
- **Why relevant:** Best documented game-in-React integration
- **Verdict:** Overkill for our use case. Phaser is for real-time games with physics. We're building an interactive guided journey, not a game loop.

### React Flow
- **What:** Node-based UI library (MIT license)
- **Why relevant:** Perfect for the overworld map / progression visualization
- **Verdict:** USE THIS. It's exactly the right level of abstraction for milestone nodes connected by paths.

### LottieFiles
- **What:** Pre-made animations (celebration, success, loading)
- **Why relevant:** Free celebration animations for milestone completion
- **Verdict:** USE for specific moments (milestone complete, phase transition, final sharing). Don't overdo it.

**Bottom line:** We don't need a game engine. We need React + Framer Motion + React Flow + SVG illustrations + CSS blend modes. Everything else is scope creep.

---

## Demo Plan for Principal (Next Week)

### What to Show (Priority Order)

1. **The Campfire** — Mentor selection screen with 5 illustrated cards. Pick a mentor, watch them animate in. "This is how students start their Service journey."

2. **Discovery Flow** — 2-3 comic strip panels showing the provocation-based strength discovery. Show how the AI responds differently based on mentor choice. "The AI never tells students what to do. It helps them discover it themselves."

3. **The Overworld Map** — Visual progression from Discovery → Planning → Working → Sharing. Show the color-as-progression mechanic. "Students literally see their world become more colorful as they grow."

4. **Planning: The Student Contract** — Show backward planning from a real end date. SMART goals scaffolded by the AI. "Students plan their own projects with AI guidance. Teachers see everything."

5. **Teacher Dashboard** — Health scores, milestone tracking, help intensity slider. "You can see every student's progress at a glance. The AI flags who needs help before they ask."

### What You Can Build in ~5 Days

| Day | Deliverable |
|-----|------------|
| **1** | Mentor selection screen (5 SVG character cards + selection animation) |
| **2** | Discovery flow with 2 steps + AI integration (reuse ComicPanel.tsx) |
| **3** | Overworld map with React Flow (4 phase nodes + color progression) |
| **4** | Planning phase: contract form + backward timeline component |
| **5** | Teacher dashboard mockup: student grid with health indicators |

This gives you a clickable prototype that tells the story. The Working and Sharing phases can be described verbally — the principal needs to see the Discovery + Planning experience and the teacher dashboard.

---

## Relationship to Existing Code

### What Already Exists (Reuse)
- **ComicPanel.tsx** — Scene illustrations, speech bubbles, step transitions
- **DiscoveryFlow.tsx** — 5-step discovery conversation (needs mentor differentiation)
- **JourneyMap.tsx** — Phase progress display (replace with React Flow overworld)
- **useOpenStudio.ts** — Session management, check-in timer, drift detection
- **open-studio-prompt.ts** — 5 AI interaction modes (extend with mentor personalities)
- **DesignPlanBoard.tsx** — MYP Design Cycle kanban (adapt for milestone tracking)
- **QuickToolFAB.tsx** — Floating tool launcher (adapt for Quick Capture)
- **All 12 toolkit tools** — Available as scaffolding during any phase
- **Timetable cycle engine** — Computes available sessions for backward planning
- **Workshop Model + timing validation** — Phase time structure

### What Needs Building
- **MentorSelector.tsx** — 5-card selection with character SVGs + audio
- **OverworldMap.tsx** — React Flow-based progression visualization
- **StudentContract.tsx** — Guided contract form with effort-gating
- **BackwardTimeline.tsx** — Visual timeline with milestone nodes
- **QuickCaptureBar.tsx** — Floating photo/voice/text capture
- **HealthScore system** — Rolling assessment model + teacher display
- **HelpIntensitySlider.tsx** — Per-student scaffolding control
- **ResourceDirectory** — Teacher-managed people/equipment/materials
- **Framework wizard paths** — Service + Personal Project templates in unit wizard
- **Phase transition animations** — Watercolor wash + color unlock sequences
- **5 mentor personality prompts** — Distinct system prompts per mentor

### Database Changes Needed
- `open_studio_status` — Add `mentor_choice`, `help_intensity` columns
- `open_studio_sessions` — Add `milestones JSONB`, `contract JSONB`, `evidence JSONB[]`, `health_score JSONB`
- New table or JSONB on teacher profile: `resource_directory` (people, equipment, materials)
- Unit wizard: `framework_type` field (design/service/personal_project) on units table

---

## Key Design Decisions to Make

1. **React Flow vs custom SVG for the overworld map?** React Flow is faster to build but less artistic. Custom SVG is more Gris-like but more work. Recommendation: React Flow with custom SVG node renderers — best of both.

2. **Voice memos: transcription or just storage?** Whisper API adds cost + complexity. Start with storage-only, add transcription later if needed.

3. **How much game vs how much tool?** The principal demo should lean toward the visual/game aspects. The daily use should lean toward the tool aspects. Design for both: impressive first impression, efficient daily use.

4. **Mentor illustrations: AI-generated or commissioned?** For the demo, AI-generated (ChatGPT gpt-image-1, consistent with Seedlings approach). For production, consider commissioning a consistent style. The Gris watercolor aesthetic is achievable with AI generation if you're specific about style prompts.

5. **Should the overworld map replace JourneyMap entirely?** Yes — the current JourneyMap pills are functional but not inspiring. The React Flow overworld is the same data, better presentation.
