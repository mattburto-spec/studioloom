# Project: Toolkit — The Interactive Thinking Tools Platform

*Created: 29 March 2026*
*Last updated: 29 March 2026*
*Status: Active — UX Polish Phase*

## Vision

The toolkit is not just "design thinking tools." It's an **interactive thinking tools platform** — a growing library of beautiful, AI-powered tools that help students (and eventually anyone) think better. Design thinking tools are one category. The full scope includes:

- **Visual Thinking** — Mind Map, Systems Map, Journey Map, Fishbone, Lotus Diagram
- **Design Thinking** — SCAMPER, Empathy Map, How Might We, POV Statement, Design Spec
- **Evaluation & Decision** — PMI, SWOT, Decision Matrix, Pairwise Comparison, Impact/Effort
- **Research & Analysis** — Five Whys, Affinity Diagram, Stakeholder Map, User Persona
- **Collaboration & Teamwork** — Dot Voting, Round Robin, Gallery Walk protocols, Peer Review
- **Psychometric & Self-Discovery** — adapted from Discovery Engine (archetype finder, strength mapper, interest sorter, values card sort, fear reframing)
- **Drawing & Sketching** — quick sketch canvas, annotation tools, wireframe builder, mood board creator
- **Planning & Project** — Gantt, timeline builder, resource planner, sprint board
- **Reflection & Metacognition** — design journal, before & after, learning log, growth tracker
- **Communication** — storyboard, presentation planner, pitch builder, elevator pitch timer

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

**Phase 3: New tool categories**
- Psychometric & Self-Discovery (adapted from Discovery Engine)
- Collaboration & Teamwork (Dot Voting done, Round Robin, Team Charter, Consensus Builder)
- Drawing & Visual (Quick Sketch done, Annotation, Wireframe, Mood Board)
- Planning & Project (Sprint Board, Timeline, Resource Planner)
- Communication (Pitch Builder, Storyboard, Presentation Planner)
- Reflection & Metacognition (Learning Log, Growth Tracker, Mistake Journal)

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

## Expansion Categories

### Category 1: Psychometric & Self-Discovery (from Discovery Engine)
Tools adapted from the Discovery Engine's 8 stations:
- **Archetype Finder** — binary pair selections → weighted scoring → archetype reveal (Maker/Researcher/Leader/Communicator/Creative/Systems Thinker)
- **Strength Mapper** — scenario-based strength discovery (campfire pattern from S1)
- **Interest Sorter** — irritation/passion card sort → interest clustering
- **Values Card Sort** — 20 value cards, rank/sort/reflect
- **Fear Reframer** — identify fears → AI reframing (from S6 Crossroads)
- **Working Style Profiler** — solo/pair/group preferences with nuanced context

### Category 2: Collaboration & Teamwork
- **Dot Voting** — real-time collaborative voting on ideas/options
- **Round Robin** — timed rotating brainstorm with AI facilitation
- **Gallery Walk** — structured peer critique protocol (already built in Class Gallery, extract as standalone tool)
- **Team Charter Builder** — roles, norms, communication preferences
- **Consensus Builder** — structured disagreement resolution

### Category 3: Drawing & Visual
- **Quick Sketch Canvas** — timed sketching with prompts (30s/60s/2min modes)
- **Annotation Tool** — upload image → annotate with callouts, arrows, notes
- **Wireframe Builder** — drag-and-drop UI component layout
- **Mood Board Creator** — image + text + color palette composition
- **Comparison Sketch** — side-by-side before/after or option A/B sketching

### Category 4: Planning & Project
- **Sprint Board** — kanban with design cycle columns
- **Timeline Builder** — visual project timeline with milestones
- **Resource Planner** — materials, tools, time budget
- **Task Decomposition** — break big tasks into subtasks with estimates

### Category 5: Communication & Presentation
- **Pitch Builder** — structured elevator pitch with timer + AI coaching
- **Storyboard Creator** — panel-by-panel narrative with sketch areas
- **Presentation Planner** — slide outline with talking points
- **Design Brief Writer** — AI-assisted brief generation from constraints

### Category 6: Reflection & Metacognition
- **Learning Log** — structured daily/weekly reflection
- **Growth Tracker** — self-assessment over time with visualized progress
- **Mistake Journal** — document failures + what was learned
- **Process Documentation** — step-by-step capture of what you did and why

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

## Success Metrics

- **Tool completion rate** — % of students who finish intro → working → summary
- **Ideas per session** — average ideas generated per tool use
- **Return rate** — % of students who use a tool more than once
- **Depth score distribution** — are students producing quality thinking?
- **AI nudge engagement** — do students read/act on AI feedback?
- **Teacher adoption** — how many teachers assign toolkit tools to units?
- **Session duration** — time spent per tool (too short = not engaging, too long = stuck)
