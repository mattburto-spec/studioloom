# Project: Toolkit — The Interactive Thinking Tools Platform

*Created: 29 March 2026*
*Last updated: 29 March 2026 (categories unified)*
*Status: Active — UX Polish Phase + Category Taxonomy Finalized*

## Vision

The toolkit is not just "design thinking tools." It's an **interactive thinking tools platform** — a growing library of beautiful, AI-powered tools that help students (and eventually anyone) think better. Design thinking tools are one category. The full scope spans 7 unified categories:

1. **Design** (ACTIVE) — 48 tools: SCAMPER, Empathy Map, Five Whys, Decision Matrix, PMI, SWOT, etc.
2. **Visual** — annotation, wireframing, mood boards, storyboards, comparison sketching
3. **Collaborate** — round robin, team charters, consensus building, facilitation tools
4. **Strategy** — sprint boards, timelines, pitch builders, business model canvas
5. **Systems** — causal loops, futures cones, A/B testing, assumption busting
6. **Discovery** — archetype finder, strength mapper, values card sort, fear reframer (from Discovery Engine)
7. **Growth** — learning logs, growth trackers, mistake journals, process documentation

Each tool should feel like a **standalone micro-app** — beautiful enough to screenshot and share, useful enough to come back to.

## Current State (Audit — 29 March 2026)

### Interactive Tools (27 built)

| # | Tool | Lines | AI | Animations | UX Rating | Notes |
|---|------|-------|----|-----------|-----------| ------|
| 1 | SCAMPER | 1,200 | Haiku 4.5 | Minimal | B | Reference impl. Has effort-gating, depth dots, micro-feedback. No Framer Motion. |
| 2 | Six Thinking Hats | 932 | Haiku 4.5 | Minimal | B | Per-hat AI rules (most sophisticated prompt routing). |
| 3 | PMI Chart | 744 | Haiku 4.5 | Minimal | B- | Column-specific AI tone. |
| 4 | Morphological Chart | 743 | Haiku 4.5 | None | C+ | Functional but plain. |
| 5 | Lotus Diagram | 759 | Haiku 4.5 | None | C+ | 64-idea expansion. |
| 6 | Affinity Diagram | 702 | Haiku 4.5 | None | C+ | Research synthesis. |
| 7 | Empathy Map | 668 | Haiku 4.5 | Minimal | B- | Quadrant-specific AI. Emotion contradiction rules. |
| 8 | Impact/Effort Matrix | 636 | Haiku 4.5 | None | C | Prioritization tool. |
| 9 | Five Whys | 630 | Haiku 4.5 | Minimal | B | Depth detection (sideways vs deeper). |
| 10 | Mind Map | 609 | Haiku 4.5 | None | C+ | |
| 11 | Biomimicry Cards | 588 | Haiku 4.5 | None | C | |
| 12 | Pairwise Comparison | 585 | Haiku 4.5 | None | C | |
| 13 | Journey Map | 572 | Haiku 4.5 | None | C | |
| 14 | Fishbone Diagram | 562 | Haiku 4.5 | None | C | |
| 15 | Reverse Brainstorm | 556 | Haiku 4.5 | None | C+ | Inversion thinking. |
| 16 | Brainstorm Web | 553 | Haiku 4.5 | None | C | |
| 17 | Systems Map | 536 | Haiku 4.5 | None | C | |
| 18 | User Persona | 505 | Haiku 4.5 | None | C | |
| 19 | Feedback Capture Grid | 475 | Haiku 4.5 | None | C | |
| 20 | POV Statement | 459 | Haiku 4.5 | None | C | |
| 21 | Design Specification | 456 | Haiku 4.5 | None | C | |
| 22 | SWOT Analysis | 804 | Haiku 4.5 | None | C+ | |
| 23 | Stakeholder Map | 839 | Haiku 4.5 | None | C+ | |
| 24 | Decision Matrix | 1,100 | Haiku 4.5 | None | C+ | Comparison Engine shape. |
| 25 | How Might We | 1,019 | Haiku 4.5 | None | C+ | Guided Composition shape. |
| 26 | Dot Voting | 550 | None | Framer Motion | B | Democratic prioritisation with limited dots. No AI needed. |
| 27 | Quick Sketch | 750 | None | None | B- | HTML5 Canvas with pen/eraser/undo, SVG timer. |

**Total interactive code: ~17,000 lines frontend + ~6,000 lines API = ~23,000 lines**

### Catalog-Only Tools (21 — no interactive version)

These appear in the `/toolkit` browser with tool descriptions but have no interactive page yet.

Crazy 8s, Round Robin, Trade-off Sliders, Mood Board, Storyboard, Annotation Template, Wireframe Template, Gantt Planner, Resource Planner, Design Journal, Before & After, Peer Review Protocol, Testing Protocol, Gallery Walk, Observation Sheet, User Persona Card (Template), Journey Map (Template), Impact/Effort Matrix (Template), Stakeholder Map (Template), Presentation Planner, Design Brief

### Browsing & Discovery Pages (29 Mar 2026)

Both browsing pages have been through a significant UX overhaul:

**Public page (`/toolkit`)** — aesthetic overhaul to match approved prototype v5:
- Strong aurora gradient background (purple/blue/teal)
- Large centered search bar with AI-powered intent matching (12 keyword rule sets)
- Phase pills with emoji icons, tool counts, and active checkmarks
- Category tabs (Design Thinking active + 4 "Soon" tabs) inside hero with neon gradient line
- Grid/List toggle stub (visual only)
- Structural SVG thumbnails per tool showing output shape
- INTERACTIVE badge on 27 tools with dedicated pages

**Teacher page (`/teacher/toolkit`)** — polished to match public page patterns:
- Larger title, removed subtitle clutter
- Standalone search bar (large, purple icon, shadow)
- Phase pills with emoji, counts, bold colors, checkmarks, "All" pill
- Fixed auto-scroll (targets sticky pill bar via requestAnimationFrame)
- Group dropdown removed (phase pills + AI search cover filtering)
- Category tabs with neon gradient underline

### Lesson Editor Integration (29 Mar 2026)

All 27 interactive tools are embeddable as inline activities in the Phase 0.5 lesson editor:
- `ToolkitResponseInput.tsx` maps all 27 tools via `dynamicTool` helper
- `ActivityBlock.tsx` shows purple tool picker panel (grouped by category) when `toolkit-tool` response type selected
- `ActivityBlockAdd.tsx` has "Toolkit Tool" template
- Data saves to student_progress as JSON, available for cross-unit reference

### Persistence (26 Mar 2026)

All 27 tools wired with `useToolSession` hook for auto-save, session resume, and state tracking. Public mode gracefully skips DB writes.

### Remaining Work

**Phase 1: Polish existing 27 tools (priority order)**
1. SCAMPER v2 — rebuild as reference implementation with Framer Motion springs, AI thinking indicator, typewriter effect, mobile-first layout, glassmorphism cards
2. Six Thinking Hats — upgrade animations + mobile, already B tier
3. Five Whys — depth detection deserves beautiful UI
4. Empathy Map — quadrant layout is visually interesting
5. PMI Chart — simple but should feel premium
6. Mind Map — most complex visual, may need canvas/SVG approach
7. Remaining 20 tools — apply SCAMPER v2 patterns

**Phase 2: Build catalog-only tools as interactive**
- Convert 21 catalog entries to interactive tools using established patterns (Step Sequence, Canvas, Comparison Engine, Guided Composition)
- Priority: Crazy 8s, Storyboard, Design Journal, Mood Board

**Phase 3: New tool categories (see Unified Category Taxonomy below)**
- Build tools for the 6 new categories: Visual, Collaborate, Strategy, Systems, Discovery, Growth
- Priority order: Discovery (leverages Discovery Engine code), Collaborate (Dot Voting done), Visual (Quick Sketch done)

## UX Assessment

### What's working
- 3-screen flow (intro → working → summary) is consistent across all 23 tools
- AI integration is genuinely useful — per-step/per-quadrant AI rules are the key differentiator
- Effort-gating exists on SCAMPER and a few others
- Session persistence via useToolSession is wired on all tools

### What's not working
- **No Framer Motion anywhere** — all transitions are CSS-only or instant. Feels static.
- **No micro-feedback** beyond basic toasts on SCAMPER — idea submission feels silent
- **Inline styles everywhere** — dark theme applied via inline styles, not a design system
- **No mobile optimization** — tools work on mobile but aren't designed for it
- **Inconsistent quality** — SCAMPER (B) and Six Hats (B) feel significantly better than the C-tier tools
- **No personality** — tools feel functional but not beautiful. Missing the "I want to use this" factor.
- **AI nudges appear instantly** — no "thinking" animation, no typing effect, feels robotic

### UX Target: A+

The target is Brilliant.org-level quality: clean, purposeful, premium-but-not-corporate. Every interaction choreographed with Framer Motion springs. AI responses feel human-paced (thinking indicator → typing effect). Dark theme as default with considered color per tool category. Mobile-first layout.

## Unified Category Taxonomy (29 March 2026)

7 categories unified across public page, teacher page, and Coming Soon section. Defined in `tools-data.ts` as `TOOLKIT_TABS` (single source of truth).

### 1. Design Thinking (ACTIVE — 48 tools)

All current tools live here. Universal design process tools that work across any framework (IB MYP, GCSE, ACARA, PLTW, d.school, IDEO, Double Diamond).

**Interactive (27):**
SCAMPER, Six Thinking Hats, PMI Chart, Morphological Chart, Lotus Diagram, Affinity Diagram, Empathy Map, Impact/Effort Matrix, Five Whys, Mind Map, Biomimicry Cards, Pairwise Comparison, Journey Map, Fishbone Diagram, Reverse Brainstorm, Brainstorm Web, Systems Map, User Persona, Feedback Capture Grid, POV Statement, Design Specification, SWOT Analysis, Stakeholder Map, Decision Matrix, How Might We, Dot Voting, Quick Sketch

**Catalog-only (21):**
Crazy 8s, Round Robin, Trade-off Sliders, Mood Board, Storyboard, Annotation Template, Wireframe Template, Gantt Planner, Resource Planner, Design Journal, Before & After, Peer Review Protocol, Testing Protocol, Gallery Walk, Observation Sheet, User Persona Card (Template), Journey Map (Template), Impact/Effort Matrix (Template), Stakeholder Map (Template), Presentation Planner, Design Brief

### 2. Visual (~8 tools — Coming Soon)

Tools for spatial thinking, sketching, visual composition, and annotation.

- **Annotation Tool** — upload image → annotate with callouts, arrows, notes
- **Wireframe Builder** — drag-and-drop UI component layout
- **Mood Board Creator** — image + text + color palette composition
- **Comparison Sketch** — side-by-side before/after or option A/B sketching
- **Storyboard Creator** — panel-by-panel narrative with sketch areas
- **Cultural Landscape Map** — visual map of cultural context and influences
- **Stakeholder Power Grid** — 2×2 power/interest matrix with visual plotting
- **Paper Prototyping Cards** — drag-and-drop paper prototype building

*Note: Quick Sketch (built, in Design) could be cross-listed here.*

### 3. Collaborate (~7 tools — Coming Soon)

Tools for teamwork, facilitation, and group decision-making.

- **Round Robin** — timed rotating brainstorm with AI facilitation
- **Gallery Walk** — structured peer critique protocol (extract from Class Gallery)
- **Team Charter Builder** — roles, norms, communication preferences
- **Consensus Builder** — structured disagreement resolution
- **Warm-up Activity Library** — icebreaker/energiser activities for workshops
- **Conflict Navigation Guide** — structured conflict resolution framework
- **Energy Level Pulser** — quick group energy check-in with response

*Note: Dot Voting (built, in Design) could be cross-listed here.*

### 4. Strategy (~10 tools — Coming Soon)

Tools for project planning, communication, and strategic thinking.

- **Sprint Board** — kanban with design cycle columns (Backlog → A → B → C → D)
- **Timeline Builder** — visual project timeline with milestones and dependencies
- **Resource Planner** — materials, tools, time budget calculator
- **Task Decomposition** — break big tasks into subtasks with time estimates
- **Pitch Builder** — structured elevator pitch with timer + AI coaching
- **Presentation Planner** — slide outline with talking points and timing
- **Design Brief Writer** — AI-assisted brief generation from constraints
- **Business Model Canvas** — 9-block canvas for value proposition and delivery
- **Rollout Timeline** — implementation/launch planning with phases
- **Measurement Framework** — define success metrics and evaluation criteria

### 5. Systems (~6 tools — Coming Soon)

Tools for systems thinking, scientific method, and experimental design.

- **Causal Loop Diagram** — map cause-effect feedback loops in complex systems
- **Futures Cone Builder** — probable/plausible/possible/preferable futures mapping
- **Ripple Effect Mapper** — trace 2nd and 3rd order consequences of decisions
- **A/B Testing Matrix** — structure experiments with hypothesis, variables, controls
- **Assumption Buster Game** — identify and challenge hidden assumptions systematically
- **Sustainability Canvas** — environmental/social/economic impact assessment

### 6. Discovery (~7 tools — Coming Soon)

Psychometric and self-awareness tools adapted from the Discovery Engine.

- **Archetype Finder** — binary pair selections → weighted scoring → archetype reveal (Maker/Researcher/Leader/Communicator/Creative/Systems Thinker)
- **Strength Mapper** — scenario-based strength discovery (campfire pattern from Discovery S1)
- **Interest Sorter** — irritation/passion card sort → interest clustering
- **Values Card Sort** — 20 value cards, rank/sort/reflect on what matters
- **Fear Reframer** — identify fears → AI reframing (adapted from Discovery S6 Crossroads)
- **Working Style Profiler** — solo/pair/group preferences with nuanced context scenarios
- **Design DNA Profiler** — discover your design personality and thinking strengths

*Build priority: HIGH — leverages existing Discovery Engine code and scoring algorithms.*

### 7. Growth (~5 tools — Coming Soon)

Metacognitive tools for learning from experience and tracking development.

- **Learning Log** — structured daily/weekly reflection with prompts
- **Growth Tracker** — self-assessment over time with visualized progress curves
- **Mistake Journal** — document failures + what was learned + how to apply next time
- **Process Documentation** — step-by-step capture of what you did and why
- **Design DNA Profiler** — also fits here (cross-listed with Discovery)

### Category Build Priority

| Priority | Category | Reason | Est. Tools |
|----------|----------|--------|-----------|
| 1 | Discovery | Leverages Discovery Engine code, unique differentiator | 7 |
| 2 | Collaborate | Dot Voting done, Round Robin/Gallery Walk have existing patterns | 7 |
| 3 | Visual | Quick Sketch done, annotation/wireframe are high-value | 8 |
| 4 | Strategy | Sprint Board reuses DesignPlanBoard component | 10 |
| 5 | Growth | Simpler tools, less AI needed | 5 |
| 6 | Systems | Most complex, needs research on interaction patterns | 6 |

**Grand total across all 7 categories: ~91 tools**

## SCAMPER v2 — The Reference Implementation

SCAMPER becomes the gold standard. Every other tool gets rebuilt to match its quality.

### Current SCAMPER (v1) — What's Good
- 3-screen flow works well
- 7 SCAMPER steps with per-step AI rules
- "Deal Me a Card" progressive prompt reveal
- 10-second thinking timer (SVG circular progress)
- Effort-gated Socratic feedback
- Depth dots (1-3) per idea
- Soft gating (prompts hidden until first idea written)

### SCAMPER v2 — What Changes

**Animation & Motion (Framer Motion)**
- Card deal entrance: spring physics, slight rotation mid-flight
- Cascading idea appearance: staggered delay per idea (0.05s each)
- Step transitions: cross-fade with layout animation (not page reload)
- Summary reveal: accordion expand, each step reveals in sequence
- Depth meter pulse on quality threshold unlock
- AI "thinking" indicator with animated dots → typewriter text reveal

**Visual Design**
- Dark background with tool-specific accent color (SCAMPER = purple/indigo gradient)
- Glassmorphism card containers (blur, subtle border, depth shadow)
- Typography: Inter for body, bold weights for step headers
- Whitespace-heavy — breathing room between elements
- Step progress: 7 numbered circles with glow on current, filled on complete

**Interaction Design**
- Swipe left/right for step navigation on mobile
- Tap step header to jump directly (non-linear navigation)
- Long-press idea card → expanded view with depth, AI reflection, timestamp
- Textarea auto-grows (no scrolling within the input area)
- Keyboard shortcut: Tab to submit idea + move to next input

**AI Experience**
- "Kit is thinking..." (2-3s animated delay) before nudge appears
- Typewriter effect on nudge text (30ms per character)
- Nudge slides in from bottom with spring animation
- AI tone adapts more dramatically: low effort = challenging push, high effort = celebratory + deeper question
- After 5+ ideas per step: AI switches from encouraging to provocative ("You've got quantity. Now surprise me.")

**Summary Screen**
- All 7 steps visible as collapsible cards
- Per-step idea count + average depth score
- AI synthesis: "Patterns I noticed across your thinking" (Haiku analysis of all ideas)
- Export: copy all, download as markdown, share link
- "Start Over" vs "Continue Adding" option

**Accessibility**
- Full keyboard navigation
- Screen reader labels on all interactive elements
- Reduced motion mode (respects `prefers-reduced-motion`)
- High contrast mode option
- Touch targets ≥44px

### Build Estimate
- SCAMPER v2 redesign: ~3-4 days (rewrite component + new animations + mobile)
- Extract as reference pattern: ~1 day (shared components, animation library, AI interaction patterns)
- Apply pattern to next 5 tools: ~1 day each

### After SCAMPER v2
Once the reference implementation is solid, rebuild the top-used tools in priority order:
1. Six Thinking Hats (already B tier, upgrade to A)
2. Five Whys (depth detection is unique, deserves beautiful UI)
3. Empathy Map (quadrant layout is visually interesting)
4. PMI Chart (simple but should feel premium)
5. Mind Map (most complex visual — may need canvas/SVG approach)

## Loominary.org Rebrand (Someday)

Domain purchased. Better name than StudioLoom. Rebrand involves:
- Logo + visual identity
- Update all references (code, docs, landing page, Vercel)
- New landing page design
- "Powered by Loominary" on toolkit tools
- Not urgent — do after student testing validates the product

## Research Reference

Comprehensive per-tool research covering best-in-class examples, UX patterns, AI potential, and wow factors:

- **Design Thinking (27 interactive + 21 catalog):** `docs/research/design-thinking-tools-research.md`
- **Visual, Collaborate, Strategy, Systems, Discovery, Growth (43 expansion tools):** `docs/research/toolkit-expansion-research.md`

Key findings from research:
- 24 of 43 expansion tools benefit significantly from AI (rated HEAVY)
- StudioLoom's per-step AI rules architecture extends naturally to all expansion categories
- Discovery category has highest code reuse from existing Discovery Engine (~8-10 days)
- Systems category is most technically complex (node-graph UIs, simulation logic, ~12-15 days)
- Total build estimate for all 43 expansion tools: ~57-71 days
- Cross-cutting patterns: constraint-as-feature, progressive reveal, AI as provocateur, shareable outputs

## Success Metrics

- **Tool completion rate** — % of students who finish intro → working → summary
- **Ideas per session** — average ideas generated per tool use
- **Return rate** — % of students who use a tool more than once
- **Depth score distribution** — are students producing quality thinking?
- **AI nudge engagement** — do students read/act on AI feedback?
- **Teacher adoption** — how many teachers assign toolkit tools to units?
- **Session duration** — time spent per tool (too short = not engaging, too long = stuck)
