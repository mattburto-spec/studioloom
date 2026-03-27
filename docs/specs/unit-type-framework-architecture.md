# Unit Type & Framework Architecture — Master Reference
## The Guiding Light for StudioLoom's Multi-Unit Future
### Project Name: **Unit Generation Project**

**Date:** 27 March 2026
**Status:** Phase 0 COMPLETE (schema + types). Phase 1 next (gateway — wizard + converter).
**Author:** Matt Burton + Claude analysis session

**Related specs:**
- `docs/specs/wizard-lanes-spec.md` — "Choose Your Level of Control" 3-lane wizard UX (Express / Guided / Architect)
- `docs/specs/design-hardcoding-deep-audit.md` — 90 hardcoded Design instances with severity ratings

---

## Why This Document Exists

StudioLoom is 95% locked to MYP Design. Before importing any lessons, creating real units, or building the materials library, the foundation must support Design, Service Learning, Personal Project, PYP Exhibition, and future unit types — each potentially assessed under different programmes and curricula. This document captures the full analysis, competitive landscape, UX vision, and build plan. It is the single source of truth for all architecture decisions related to unit types and curriculum frameworks.

---

## Part 1: The 4-Dimension Model

Units in StudioLoom exist at the intersection of 4 independent dimensions. Getting this model right is the architectural foundation everything else builds on.

### Dimension 1: Unit Type (Pedagogical Shape)

The **what students do** — determines phases, timing model, AI corpus, activity types, and block palette.

| Unit Type | Cycle | Phases | Core Pedagogy |
|-----------|-------|--------|---------------|
| `design` | Design Cycle | Inquiring → Developing → Creating → Evaluating | Making things. Workshop Model. Studio culture. Prototyping. |
| `service` | IPARD Cycle | Investigate → Plan → Act → Reflect → Demonstrate | Community action. Reciprocity over charity. Sustained engagement. |
| `personal_project` | PP Process | Define → Plan → Create → Reflect → Report | Self-directed investigation. ATL skills. Extended timeline. |
| `inquiry` | Inquiry Cycle | Wonder → Explore → Create → Share | Guided exploration. Transdisciplinary. Exhibition-focused. |

**Key insight:** Unit type is inherent to the content. A "Design a Chair" unit is always a design unit. A "Clean Up the River" unit is always a service unit. This doesn't change based on which class uses it.

### Dimension 2: Programme (Assessment Framework)

The **how students are assessed** — determines criteria labels, grading scales, command verbs, and reporting structure.

| Programme | Criteria | Scale | Command Verbs |
|-----------|----------|-------|---------------|
| IB MYP | A/B/C/D (names vary by subject) | 1-8 per criterion | Explain, Justify, Evaluate, Create, Design |
| IGCSE DT | AO1-AO5 | 9-1 overall | Identify, Describe, Explain, Analyse, Evaluate |
| A-Level DT | AO1-AO5 (different weights) | A*-E | Demonstrate, Apply, Analyse, Evaluate |
| ACARA | Knowledge/Processes/Production | A-E | Describe, Explain, Apply, Create, Evaluate |
| IB DP CAS | 7 Learning Outcomes | Pass/Fail (portfolio) | No command verbs — reflective evidence |
| Custom School | Teacher-defined | Teacher-defined | Teacher-defined |

**Key insight:** Programme lives on the **class**, not the unit. The same Design unit template could be assessed under MYP (A/B/C/D, 1-8) in one class and GCSE (AO1-AO5, 9-1) in another.

### Dimension 3: Curriculum (Content Standards)

The **what students must learn** — the specific knowledge and skills mandated by a jurisdiction's curriculum documents.

| Curriculum | Programme Context | Example Standards |
|------------|-------------------|-------------------|
| BC ADST (British Columbia) | Used within MYP or standalone | "Students will evaluate the role of technology in society" |
| Victorian Curriculum | Used within ACARA framework | "Investigate how forces and the properties of materials affect the behaviour of designed solutions" |
| NSW Syllabus | Used within ACARA framework | "Analyses the work practices of designers" |
| Cambridge IGCSE 0445 | IS the programme (IGCSE DT) | "Understand the uses and working properties of metals" |
| Ontario Tech Studies | Used within MYP or standalone | "Demonstrate an understanding of manufacturing processes" |
| IB MYP Subject Guide | IS the programme (MYP Design) | ATL skills, Global Contexts, Key Concepts |

**Critical distinction:** For MYP, the programme IS a framework that schools fill with their chosen local curriculum. A MYP school in BC teaches BC ADST standards through MYP's A/B/C/D assessment framework. A MYP school in Victoria teaches Victorian Curriculum through the same MYP framework. The curriculum content is different; the assessment overlay is the same.

For IGCSE/A-Level, the programme IS the curriculum — Cambridge defines both what to teach and how to assess it. There's no separate curriculum layer.

For ACARA, the curriculum defines content but schools choose assessment approaches (often aligned to state reporting requirements).

### Dimension 4: Standards (Learning Outcomes)

The **granular checkpoints** — individual learning outcomes, content descriptors, or achievement standards that teachers tag to specific activities within lessons.

This is the layer that enables coverage tracking, curriculum mapping, and gap analysis.

| Level | Example |
|-------|---------|
| **Strand** | "Design and Technologies: Knowledge and Understanding" (ACARA) |
| **Sub-strand** | "Technologies and Society" |
| **Content Descriptor** | "Investigate how forces and the properties of materials affect the behaviour of designed solutions" (ACTDEK034) |
| **Elaboration** | "Examining the properties of materials used in a design solution" |

**Scale of the problem:** Atlas (the market leader for curriculum mapping) indexes 1.5 million standards across 607 standard sets. StudioLoom has zero. A minimum viable standards database needs BC ADST + IGCSE 0445 + MYP Design subject guide + Victorian Curriculum Design = approximately 500-1000 individual standards.

### How the 4 Dimensions Interact

```
Unit Type (design)          → determines lesson structure, AI prompts, phases, blocks
  × Programme (MYP)         → determines criteria (A/B/C/D), grading scale (1-8)
    × Curriculum (BC ADST)  → determines content to cover
      × Standards (ACTDEK034) → tags individual activities to specific outcomes
```

**The resolution chain for AI generation:**
1. Unit Type selects the system prompt corpus and phase model
2. Programme selects command verbs and assessment language
3. Curriculum provides content context (what topics to cover)
4. Standards are tagged post-generation (or during, if the teacher has them selected)

**The resolution chain for teacher reporting:**
1. Standards tagged to activities → coverage heatmap per unit
2. Coverage across units in a term → curriculum gap analysis
3. Gap analysis across the year → year planner recommendations

---

## Part 2: MYP Community Project — The Service Equivalent

A critical discovery: MYP has a **formally assessed** Service Learning equivalent.

### MYP Community Project (Year 3-4, ages 13-14)

The Community Project is to Service what the Personal Project is to Design — a capstone that uses IB's 1-8 criterion scoring.

| Criterion | Name | Description | Scale |
|-----------|------|-------------|-------|
| A | Investigating | Identify a community need, research context, develop a proposal | 1-8 |
| B | Planning | Create a detailed plan with timeline, resources, success criteria | 1-8 |
| C | Taking Action | Implement the project, demonstrate service learning, apply skills | 1-8 |
| D | Reflecting | Evaluate impact, reflect on learning, consider further action | 1-8 |

This means Service Learning under MYP is NOT "ungraded portfolio reflection" — it has the same rigorous A/B/C/D structure as Design. The criteria names are different (Investigating vs Inquiring & Analysing), but the assessment mechanics are identical. This is a huge finding because it means the existing grading infrastructure (1-8 per criterion) works for MYP Service with just different criterion labels.

### IB CAS (Diploma Programme, ages 16-18)

Completely different model — no criteria scores.

| Element | Details |
|---------|---------|
| Hours | 150+ across 18 months |
| Outcomes | 7 learning outcomes (identify strengths, undertake challenges, plan/initiate, work collaboratively, show perseverance, engage globally, recognise ethics) |
| Assessment | Portfolio-based, supervisor sign-off, pass/fail |
| Evidence | Reflections, activity logs, supervisor forms |

CAS is relevant for the IB continuum (MYP → DP) but architecturally very different. It's more like a long-running journal than a unit with lessons. StudioLoom should support it eventually, but it's a different beast.

---

## Part 3: Service Learning Frameworks Research

### The Universal Framework: IPARD (National Youth Leadership Council)

The most widely adopted service learning cycle worldwide:

1. **Investigation** — Identify community needs through research, interviews, asset mapping
2. **Planning** — Design the service project with community partners, set goals, assign roles
3. **Action** — Implement the service, document process, adapt as needed
4. **Reflection** — Structured reflection before, during, and after (not just at the end)
5. **Demonstration** — Share learning and impact with authentic audiences

IPARD is used by NYLC (US), Learn to Serve (US), Service Learning Network (AU), and many IB schools as their service methodology. It maps cleanly to MYP Community Project criteria: Investigation→A, Planning→B, Action→C, Reflection→D. The 5th phase (Demonstration) is the exhibition/presentation component.

### Key Pedagogical Principles for Service Learning

These form the basis of a future Service Learning Teaching Corpus (parallel to the existing Design Teaching Corpus):

1. **The cycle is not linear** — Students move between investigating, planning, acting, and reflecting throughout. Don't front-load all research before any action.
2. **Community partnership is central** — Every lesson connects to a real community need. The community partner is a co-educator, not a client.
3. **Reflection is the learning mechanism** — Without structured reflection, service becomes volunteering (doing) without learning. Reflection happens before, during, and after action.
4. **Reciprocity over charity** — Service is WITH the community, not FOR them. Students understand what they receive as well as what they give.
5. **Voice and choice** — Students have agency in selecting their service focus. Imposed service reduces intrinsic motivation.
6. **Duration and intensity matter** — One-off events have lower impact than sustained engagement. Minimum 4-week sustained involvement.
7. **Documentation is evidence** — Service journals, photos, impact metrics, and community feedback serve as both learning evidence and accountability.
8. **Authentic audience** — Students present to the community they served, not just the teacher.
9. **Risk and safeguarding** — Community service involves real people. Risk assessments, consent, supervision ratios, and debriefing are mandatory.
10. **Celebration and gratitude** — Genuine acknowledgment of all parties — students, partners, recipients. Not just grades.

### How Service Differs from Design in AI Generation

| Aspect | Design Unit | Service Unit |
|--------|-------------|--------------|
| **Opening phase** | Design brief, client scenario, material exploration | Community need identification, empathy interviews, asset mapping |
| **Core activity** | Making, prototyping, iterating on physical/digital artifacts | Planning community action, stakeholder engagement, implementing service |
| **Work Time focus** | Workshop/studio (hands-on making) | Fieldwork, community contact, collaborative planning |
| **Reflection** | Evaluating against design criteria (functionality, aesthetics) | Evaluating community impact, personal growth, ethical dimensions |
| **Extensions** | Alternative materials, additional features, user testing | Deeper community research, sustainability planning, advocacy |
| **Materials** | Physical supplies (wood, acrylic, fabric, electronics) | Community contacts, transport, permissions, documentation tools |
| **Assessment evidence** | Portfolio of design process + final product | Service journal, impact evidence, community feedback, presentation |
| **Timing** | 45%+ work time (making is the learning) | 30-40% action time (planning and reflection take more time) |

---

## Part 4: Competitive Landscape

### Atlas (Faria Education Group) — The Standards Giant

Atlas is the market leader for curriculum mapping, used by 3,000+ schools worldwide including many IB schools.

**What they have that StudioLoom doesn't:**
- 1.5 million indexed standards across 607 standard sets
- Drag-and-drop standards tagging to unit plans
- Coverage heatmap: standards on Y-axis, units on X-axis (green=assessed, amber=touched, gray=gap)
- Cross-grade vertical alignment view
- IB Programme of Inquiry integration
- Curriculum coordinator dashboards

**What they lack:**
- AI-powered lesson generation
- Interactive student-facing tools
- Real-time teaching cockpit
- Per-class content forking

**Strategic implication:** StudioLoom doesn't need to build Atlas. But it needs ENOUGH standards infrastructure to show curriculum coverage — otherwise curriculum coordinators (the people who approve software purchases at IB schools) won't consider it.

### Toddle — The AI-First IB Platform

Toddle is StudioLoom's closest competitor, focused on IB schools with an AI-first approach.

**What they have:**
- AI unit plan generation from standards
- Multi-programme support (PYP, MYP, DP)
- Student portfolio with reflection tools
- Parent communication
- Report card generation

**What they lack:**
- Interactive design thinking toolkit (StudioLoom's 42 tools are unique)
- Per-step AI rules in student tools
- Workshop Model enforcement in lesson generation
- Design-specific pedagogy (studio culture, critique protocols)

**Strategic implication:** Toddle is the generalist IB platform. StudioLoom is the specialist for Design/Technology + Service Learning. The toolkit is the moat.

### Planboard (Chalk.com) — Free Lesson Planning

Simple, free lesson planner used by individual teachers.

**What they have:**
- Standards search and tagging (free!)
- Clean calendar-based planning view
- Ontario, US Common Core, NGSS standards pre-loaded

**What they lack:**
- AI generation
- Student-facing tools
- Assessment tracking
- Everything else

**Strategic implication:** Planboard proves teachers will use standards tagging if it's easy and free. The UX pattern (search standards → drag to lesson) is validated.

### ManageBac — The IB Default

The most widely used IB school management platform.

**What they have:**
- Programme of Inquiry management
- Unit planner with ATL skills
- CAS tracking for DP
- Service as Action tracking
- Report cards and transcripts

**What they lack:**
- AI anything
- Interactive student tools
- Design-specific features

**Strategic implication:** ManageBac is the admin system. StudioLoom is the teaching system. They should integrate (LTI), not compete. But ManageBac's Service as Action tracking shows what schools expect.

### Honest Gap Analysis

| Capability | Atlas | Toddle | ManageBac | StudioLoom |
|-----------|-------|--------|-----------|------------|
| Standards database | 1.5M | IB only | IB only | **0** |
| Coverage heatmap | Yes | Partial | No | **No** |
| AI lesson generation | No | Yes | No | **Yes (Design only)** |
| Interactive student tools | No | Basic | No | **42 tools, AI-powered** |
| Service Learning support | Standards only | Unit planning | CAS tracking | **Framework exists, no content** |
| Multi-programme | Via standards | PYP/MYP/DP | PYP/MYP/DP | **MYP Design only** |
| Teaching cockpit | No | No | No | **Yes** |
| Curriculum coordinator view | Yes | Partial | Yes | **No** |

**The honest truth:** StudioLoom has the best teaching tools (toolkit, teaching mode, design assistant) but the worst curriculum infrastructure. For IB schools to adopt it, it needs at minimum: (a) multi-unit-type support, (b) basic standards tagging, (c) some form of coverage visibility.

---

## Part 5: What's Hardcoded to Design (Full Codebase Scan)

### 5.1 Unit Creation Wizard

**Files:** `src/app/teacher/units/create/page.tsx`, `src/types/index.ts`, `src/hooks/useWizardState.ts`

**Problems:**
- No "What kind of unit?" question — wizard goes straight to MYP Design fields
- `UnitWizardInput` type collects: `globalContext` (MYP), `keyConcept` (MYP), `relatedConcepts` (MYP Design), `selectedCriteria` (A/B/C/D only), `specificSkills` (CAD, 3D Printing, etc.)
- `CriterionKey` type is `"A" | "B" | "C" | "D"` — cannot represent GCSE AO1-AO5 or Service criteria
- `WizardState` uses `criteriaEmphasis` mapped to A/B/C/D
- `ConversationTurn` system (adaptive questioning) is well-designed and reusable for any unit type

### 5.2 AI Generation Prompts

**Files:** `src/lib/ai/prompts.ts`, `src/lib/ai/schemas.ts`

**Problems:**
- `UNIT_SYSTEM_PROMPT` hardcodes "expert MYP Design teacher"
- `buildDesignTeachingContext()` injects 12 Design-specific pedagogy principles into ALL generation
- `buildTimingBlock()` hardcodes 45% work time floor (correct for making; too high for service planning)
- `OUTLINE_SYSTEM_PROMPT` hardcodes "MYP Design curriculum designer"
- `designPhase` enum in schemas: only `["investigation", "ideation", "prototyping", "evaluation"]`
- `workshopPhases` schema hardcodes 4 phases — Workshop Model is universal but phase descriptions are Design-centric

### 5.3 Lesson Editor

**Files:** `src/components/teacher/lesson-editor/` (12 components)

**Problems:**
- `PhaseSection.tsx`: `PHASE_CONFIG` hardcodes 4 phases with Design descriptions ("students begin making")
- `ExtensionBlock.tsx`: `DESIGN_PHASES` array hardcoded
- `ActivityBlock.tsx`: same `DESIGN_PHASES` for activity tagging
- `BlockPalette.tsx`: 24 blocks, all Design-centric. Has extensibility (`customBlocks` prop, `mergeBlocks()`, `source` field) — good foundation
- AI field suggestions API: system prompt says "design & technology teachers"

### 5.4 Assessment & Grading

**Files:** `src/lib/constants.ts`, grading page

**Problems:**
- `CRITERIA` constant: `{ A: "Inquiring & Analysing", B: "Developing Ideas", C: "Creating the Solution", D: "Evaluating" }`
- `DEFAULT_MYP_PAGES`: 16 pages structured as A1-A4, B1-B4, C1-C4, D1-D4
- `VALID_CRITERIA` in generate-unit: `["A", "B", "C", "D"]` only
- Grading page hardcodes `GRADING_SCALES.IB_MYP` (1-8)
- `CriterionKey` type: `"A" | "B" | "C" | "D"` — 4 criteria maximum

### 5.5 Knowledge Base & Converter

**Files:** `src/lib/converter/`, `src/lib/knowledge/`

**Problems:**
- Framework detection: 6 Design curricula fingerprints only, no Service Learning keywords
- Lesson structure extraction: `inferLessonType()` maps to Design phases only
- Skeleton builder: phase labels hardcoded (Investigation, Development, Creation, Evaluation)
- Analysis prompts (Pass 2/3): "design and technology teachers" context
- Import page: subject area dropdown lists only Design subjects
- Activity type "practical" assumes physical making — community outreach forced into wrong category

### 5.6 Design Assistant

**Files:** `src/lib/ai/design-assistant-prompt.ts`

**Problems:**
- `BLOOM_LEVELS` examples: "materials", "prototype", "design brief" (Design vocabulary)
- `TOOLKIT_TOOLS_BY_PHASE` maps design phases to tools
- `CRITERION_TO_PHASE` maps A→discover, B→ideate, C→prototype, D→test
- System prompt defaults to "MYP Design" — vocabulary substitutions change words but not pedagogical approach

### 5.7 Discovery Engine

**Files:** `src/lib/discovery/`

**Problems:**
- 6 archetypes (Maker, Researcher, Leader, Communicator, Creative, Systems Thinker) — Design-biased
- Template doors in both Mode 1 and Mode 2 assume design-style projects
- Scoring weights favor "materials" and "making" signals

---

## Part 6: What's Universal (Don't Touch)

These systems are genuinely unit-type-agnostic and should stay as-is:

- **Workshop Model 4-phase structure** — Opening/Mini-Lesson/Work Time/Debrief applies to all lesson types. Only timing percentages and phase descriptions vary per unit type.
- **Toolkit tools** — All 42 are framework-agnostic. Phase-to-tool mapping already exists per framework.
- **Response types** — text, upload, voice, canvas, decision-matrix, PMI, pairwise comparison, trade-off sliders — all universal.
- **useToolSession hook** — Persistence works for any unit type.
- **Content forking** — Copy-on-write is content-shape-agnostic.
- **Safety badges** — Workshop safety applies across unit types (even Service has physical safety needs).
- **NM/Melbourne Metrics** — Competency assessment, orthogonal to unit type.
- **Timetable & scheduling** — Time is time.
- **Student auth** — Token sessions have no unit type dependency.
- **Gallery & peer review** — Critique formats work for any content type.
- **Auto-save, undo/redo** — Infrastructure-level, no content awareness.
- **Landing page** — Marketing, no content generation.

---

## Part 7: UX Vision

### 7.1 Lesson Editor — "Vertical Video Editor"

The current lesson editor has the right bones (split-pane, drag-and-drop, auto-save) but needs to evolve into a more powerful editing environment. The metaphor is a vertical video editor:

**Timeline at top:** A horizontal bar showing Workshop Model phases (Opening | Mini-Lesson | Work Time | Debrief) with draggable phase boundaries. Drag the boundary between Mini-Lesson and Work Time to give more time to either. Total must equal usable time. This already partially exists in PhaseTimelineBar but needs full Framer Motion drag support.

**Standards toggle layer:** A switchable overlay that, when enabled, shows which standards/learning outcomes are tagged to each activity. Like a video editor's audio track — you can show or hide it. When visible, each activity block shows small pills with standard codes (e.g., "ACTDEK034"). Teachers can drag standards from a sidebar search panel onto activities. When hidden, the view is clean and uncluttered.

**Activities within phases:** Activities sit inside their phase section. Drag an activity from Work Time into Mini-Lesson and it moves. If the total duration exceeds the phase allocation, the timeline bar shows an amber overflow warning. Activities can overflow into the next lesson — the editor shows a "continues in Lesson 3" marker (like the existing "continues next class" override).

**Block palette (left sidebar):** Filtered by unit type. Design shows hands-on making blocks. Service shows community engagement blocks. Both show universal blocks (discussion, research, reflection). The palette already has a `customBlocks` prop and `mergeBlocks()` function — this architecture supports unit-type-specific blocks.

**Phase descriptions change per unit type:** "Work Time" for Design says "Students are making, prototyping, iterating." For Service it says "Students are planning community action, engaging with partners, or implementing their project." Same phase, different context.

### 7.2 Year Planner — "Horizontal Gantt with Coverage Heatmap"

The year planner spec (`docs/specs/year-planner-spec.md`) is already designed framework-agnostic. Here's how it extends with the 4-dimension model:

**Base view:** Horizontal Gantt chart. X-axis = weeks, grouped by terms. Swimlanes = classes. Unit blocks sit on the swimlanes showing duration. Drag to move, drag edges to resize (adjusts lesson count). The cycle engine computes actual dates from lesson count + timetable.

**Coverage heatmap toggle:** When enabled, an overlay shows curriculum standards coverage. Standards on Y-axis (grouped by strand), units on X-axis. Color coding: green = assessed (activity explicitly tagged to this standard), amber = touched (related but not assessed), gray = gap (not covered anywhere). This is what Atlas provides for curriculum coordinators.

**Gap analysis:** Red highlights on the heatmap show mandatory standards with zero coverage. The teacher can see immediately: "I haven't covered ACTDEK034 in any unit this year." Clicking the gap suggests which existing unit could address it, or offers to generate a new mini-unit.

**Multi-programme view:** If a teacher has both MYP and IGCSE classes, the year planner shows both swimlane groups. Coverage heatmaps are per-programme (you can't meaningfully compare MYP criteria against IGCSE assessment objectives, but you can see each programme's coverage independently).

**This requires a standards database.** Without standards data, the year planner is just a calendar. The hybrid approach (Phase 1: free-text curriculum field for immediate use; Phase 4: seeded standards database for coverage tracking) means the year planner can ship without standards and gain power later.

### 7.3 Wizard — Unit Type as First Question

The creation wizard gets a new Step 0:

**"What kind of unit are you creating?"**

Four cards with illustrations:
- **Design** — "Students design, make, and evaluate products or solutions" (hammer + lightbulb icon)
- **Service** — "Students investigate community needs and take action" (hands + heart icon)
- **Personal Project** — "Students pursue a self-directed investigation" (compass icon)
- **Inquiry** — "Students explore a transdisciplinary question" (magnifying glass icon)

Selection determines which fields appear in subsequent steps:
- Design → Global Context, Key Concept, Related Concepts, Design Skills, Criteria A/B/C/D
- Service → Community Context, SDGs, Service Outcomes, Criteria A/B/C/D (MYP Community Project) or custom
- Personal Project → Personal Interest, ATL Skills Focus, Criteria (Define/Plan/Apply/Reflect)
- Inquiry → Central Idea, Lines of Inquiry, Transdisciplinary Theme

The **converter** gets the same Step 0 but with auto-detection: the AI reads the uploaded document and suggests a unit type, which the teacher can override.

---

## Part 8: Recommended Hybrid Approach for Curriculum

### The Problem

Full standards database (Atlas-style, 1.5M standards) is a multi-month project. But teachers need SOME curriculum awareness now.

### The Solution: Two Approaches, Phased In

**Approach A (immediate): Free-text curriculum field**
- Add `curriculum_context` (TEXT) to units table
- Teacher types: "BC ADST Grade 8" or "Cambridge IGCSE 0445 Section 3" or "Victorian Curriculum Level 8 Design"
- AI reads this during generation and adapts content accordingly
- No structured data, no coverage tracking — but generation quality improves immediately
- Zero infrastructure cost

**Approach B (Phase 4+): Seeded standards database**
- `curriculum_frameworks` table (id, name, jurisdiction, programme, version)
- `curriculum_standards` table (id, framework_id, code, description, strand, sub_strand, level)
- `unit_curriculum_tags` table (unit_id, standard_id, activity_id, coverage_level)
- Seed with minimum viable set: BC ADST + IGCSE 0445 + MYP Design Guide + Victorian Curriculum (~500-1000 standards)
- Standards search UI in lesson editor sidebar
- Coverage heatmap on year planner

**Why both:** Approach A ships in Phase 1 (the gateway). Approach B ships in Phase 4+ (the coverage layer). Teachers get smarter AI generation immediately, and structured tracking when the database is ready. The free-text field becomes a secondary input alongside structured standards — it never needs to be removed.

### Retrospective Curriculum Audit Tool

A high-value future feature: teachers who have already created units can run an AI-powered audit that:
1. Reads all unit content across a term/year
2. Compares against their selected curriculum framework
3. Produces a coverage report: what's covered, what's missing, what's over-assessed
4. Suggests where to add activities or mini-units to fill gaps
5. Flags any mandatory content with time requirements that aren't met

This is particularly valuable for IB schools during programme evaluation visits, WASC/CIS accreditation, or end-of-year curriculum review.

---

## Part 9: Build Sequence (6 Phases, ~20-27 Days)

### Phase 0: Schema + Types (1-2 days) ✅ COMPLETE (27 March 2026)
**Unblocks everything else.**

1. ✅ Migration 051: `unit_type TEXT NOT NULL DEFAULT 'design'` + `curriculum_context TEXT` on `units` table
2. ✅ `UnitType` union type + full type definitions in `src/lib/ai/unit-types.ts` (509 lines — phases, criteria, AI persona, teaching principles, timing notes, detection keywords per type)
3. ✅ `getCriteriaForType()`, `getCriterionKeys()`, `getCriterion()` helpers in `src/lib/constants.ts`; `getPhaseLabels()`, `getPhaseIds()`, `buildUnitTypeSystemPrompt()` in `src/lib/ai/unit-types.ts`
4. ✅ `CriterionKey` extended to `string` (was literal union "A"|"B"|"C"|"D"); per-type criteria: `SERVICE_CRITERIA` (I/P/A/R/D), `PP_CRITERIA` (A/B/C), `INQUIRY_CRITERIA` (A/B/C/D different names)
5. ✅ `curriculum_context TEXT` on `units` table (Approach A — free-text)
6. ✅ Unit type selector in wizard GoalInput (4 cards with icons + descriptions)
7. ✅ Wizard state cascading: unitType change resets selectedCriteria, criteriaFocus, criteriaEmphasis, journeyInput.assessmentCriteria
8. ✅ Dynamic criteria validation in generate-unit route (`getCriterionKeys(unitType)` replaces hardcoded `["A","B","C","D"]`)
9. ✅ All `CRITERIA[criterion].name` references in prompts.ts replaced with `getCriterion(criterion, unitType)`
10. ✅ TypeScript compilation clean (0 errors in modified files)

### Phase 1: Gateway — Wizard + Converter (3-4 days)
**The entry points. Everything else flows from the unit type selected here.**

6. Unit type selector as Step 0 in creation wizard (4 illustrated cards)
7. Conditional wizard fields based on unit type (different concepts, criteria, skills per type)
8. Service Learning wizard fields (community context, SDGs, service outcomes)
9. Unit type auto-detection + override in lesson plan converter
10. Curriculum context free-text field in both wizard and converter

### Phase 2: AI Brain — Generation Prompts (4-5 days)
**The intelligence. This is where unit type actually changes what gets generated.**

11. `buildUnitTypeSystemPrompt(unitType)` — 4 distinct system prompts
12. Service Learning Teaching Corpus (parallel to Design Teaching Corpus, ~10 principles)
13. Personal Project Teaching Corpus (self-directed learning principles)
14. Inquiry Teaching Corpus (transdisciplinary inquiry principles)
15. Parameterize `buildTimingBlock(unitType)` — different work time floors, phase descriptions
16. Parameterize `validateLessonTiming(unitType)` — different timing rules per type
17. Make `designPhase` → `activityPhase` with type-specific enum in schemas
18. Wire unit type through all 4 generation routes

### Phase 3: Editor + Assessment (3-4 days)
**Making the editing and grading experience unit-type-aware.**

19. `PhaseSection` reads unit type for phase descriptions
20. `ExtensionBlock` + `ActivityBlock` use `getPhases(unitType)` instead of hardcoded array
21. `BlockPalette` offers unit-type-specific blocks (Service blocks, PP blocks)
22. AI field suggestions API reads unit type
23. `CRITERIA_BY_TYPE` map for grading page
24. Grading page reads `unit_type` + `class.framework` to show correct criteria and scale
25. Student lesson pages show correct criteria labels

### Phase 4: Knowledge Base + Standards Foundation (3-4 days)
**Making imports and analysis unit-type-aware. First standards infrastructure.**

26. Service Learning fingerprints in converter framework detection
27. Unit-type-aware lesson structure extraction
28. Unit-type-aware skeleton building (correct phase labels per type)
29. Parameterized analysis prompts (Pass 2/3)
30. Standards database schema (`curriculum_frameworks`, `curriculum_standards`, `unit_curriculum_tags`)
31. Seed minimum viable standards: BC ADST + IGCSE 0445 + MYP Design Guide

### Phase 5: Design Assistant + Discovery (3-4 days)
**Making the student-facing AI and onboarding unit-type-aware.**

32. Design Assistant: unit-type-aware BLOOM_LEVELS, TOOLKIT_TOOLS_BY_PHASE, CRITERION_TO_PHASE
33. Design Assistant system prompt reads unit type (not just vocabulary substitution — actual pedagogy shift)
34. Discovery Engine: Service-appropriate archetypes (Advocate, Organizer alongside Maker, Researcher)
35. Discovery template doors per unit type
36. Discovery scoring weights per unit type

### Phase 6: Coverage + Year Planner (4-6 days, can defer)
**The payoff. Curriculum coverage tracking and year-level planning.**

37. Standards search UI in lesson editor sidebar
38. Standards tagging on activities (drag standard pill onto activity block)
39. Coverage heatmap component (standards × units, green/amber/gray)
40. Year planner coverage overlay toggle
41. Gap analysis highlighting (mandatory standards with zero coverage)
42. Retrospective curriculum audit tool (AI-powered)

**Total: ~20-27 days across 6 phases. Phases 0-3 are mandatory before creating content. Phase 4-5 are high value. Phase 6 is the differentiator for curriculum coordinators.**

---

## Part 10: Key Decision Points

### Decision 1: Unit Type on `units` table vs `class_units` junction?

**Recommended: `units` table.** Unit type is inherent to the content. A design unit is always a design unit. The programme/assessment framework is on the class (already exists as `classes.framework`). The curriculum is a new field on either units or class_units.

### Decision 2: How many unit types to build in Phase 0-1?

**Recommended: All 4 types in the type system, but full AI corpus for Design + Service first.** The type definitions (phases, criteria, skills) are small config. The expensive part is the teaching corpus (Phase 2). Write Design + Service corpuses first. PP and Inquiry can use a thinner corpus initially and be enriched later.

### Decision 3: Service Learning criteria — predefined or flexible?

**Recommended: Predefined per programme, with custom option.** MYP Community Project has A/B/C/D. IB CAS has 7 learning outcomes. Schools without IB often have their own rubrics. Start with predefined (MYP Community Project + generic IPARD), add "Custom criteria" option in Phase 3.

### Decision 4: Standards database — build or buy?

**Recommended: Build minimal, buy later if needed.** Seed 500-1000 standards manually (BC ADST, IGCSE 0445, MYP Design Guide, Victorian Curriculum). If the feature gets traction, explore Atlas API integration or OpenSalt (open-source standards framework). Don't build a standards management UI — just import CSVs and provide search.

### Decision 5: When to build this?

**Now. Before any content import or unit creation.** Matt has explicitly said he's holding off on creating content until this foundation is in place. This is the right call — importing Design lessons into a Design-only system and then retrofitting them for multi-type support creates rework.

### Decision 6: Curriculum context — free-text field or structured selection?

**Recommended: Both, phased.** Free-text (`curriculum_context` on units) ships in Phase 1, costs nothing, immediately improves AI generation. Structured standards database ships in Phase 4. The free-text field remains useful even after structured standards exist (teachers can add context that doesn't map to formal standards).

---

## Part 11: Data Model Summary

### New/Modified Tables

```sql
-- Migration 051: Unit Type + Curriculum Context
ALTER TABLE units ADD COLUMN unit_type TEXT NOT NULL DEFAULT 'design';
ALTER TABLE units ADD COLUMN curriculum_context TEXT;

-- Phase 4: Standards Database
CREATE TABLE curriculum_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,          -- "BC ADST", "IGCSE 0445", "MYP Design Guide"
  jurisdiction TEXT,           -- "British Columbia", "Cambridge", "IB"
  programme TEXT,              -- "MYP", "IGCSE", "ACARA"
  version TEXT,                -- "2018", "2025"
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE curriculum_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID REFERENCES curriculum_frameworks(id),
  code TEXT,                   -- "ACTDEK034", "AO1.2"
  description TEXT NOT NULL,
  strand TEXT,                 -- "Knowledge and Understanding"
  sub_strand TEXT,             -- "Technologies and Society"
  grade_level TEXT,            -- "Year 8", "Grade 9-10"
  mandatory BOOLEAN DEFAULT false,
  time_allocation_hours NUMERIC, -- some standards specify required hours
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE unit_curriculum_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES units(id),
  standard_id UUID REFERENCES curriculum_standards(id),
  activity_id TEXT,            -- links to specific activity within a lesson
  page_id TEXT,                -- links to specific page/lesson
  coverage_level TEXT DEFAULT 'touched', -- 'assessed', 'touched', 'mentioned'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_id, standard_id, activity_id)
);
```

### Type System

```typescript
type UnitType = 'design' | 'service' | 'personal_project' | 'inquiry';

interface UnitTypeConfig {
  id: UnitType;
  label: string;
  description: string;
  icon: string;
  phases: { id: string; label: string; description: string; color: string }[];
  defaultCriteria: { key: string; name: string; description: string }[];
  teachingCorpusKey: string;  // key to select the right AI corpus
  timingDefaults: {
    workTimeFloor: number;     // 0.45 for design, 0.30 for service
    instructionCapFormula: 'one_plus_age' | 'fixed';
    extensionStyle: 'deepening' | 'broadening';
  };
  wizardFields: string[];      // which wizard fields to show
  blockPaletteFilter: string;  // filter key for BlockPalette
}

// Criteria become dynamic — no longer just A/B/C/D
type CriterionKey = string;  // "A", "B", "C", "D", "AO1", "Investigate", etc.

interface CriteriaConfig {
  key: CriterionKey;
  name: string;
  description: string;
  maxScore: number;  // 8 for MYP, varies for GCSE, etc.
}
```

---

## Part 12: File Impact Map (Complete)

### Must Change (~30 files)

**Schema & Types (3 files):**
- `supabase/migrations/051_unit_type.sql` — NEW
- `src/types/index.ts` — extend CriterionKey, add UnitType, add unitType to Unit
- `src/lib/constants.ts` — add UNIT_TYPE_CONFIG, make CRITERIA a function of unit type

**Unit Creation (3 files):**
- `src/app/teacher/units/create/page.tsx` — Step 0 unit type selector
- `src/app/teacher/units/import/page.tsx` — Step 0 unit type selector + auto-detect
- `src/hooks/useWizardState.ts` — extend for variable criteria/fields

**AI Generation (7 files):**
- `src/lib/ai/prompts.ts` — parameterize system prompts, teaching context, timing by unit type
- `src/lib/ai/schemas.ts` — make designPhase dynamic
- `src/lib/ai/timing-validation.ts` — parameterize timing rules per unit type
- `src/app/api/teacher/generate-unit/route.ts` — read unitType
- `src/app/api/teacher/generate-journey/route.ts` — read unitType
- `src/app/api/teacher/regenerate-page/route.ts` — read unitType
- `src/app/api/teacher/lesson-editor/ai-field/route.ts` — read unitType

**Lesson Editor (4 files):**
- `src/components/teacher/lesson-editor/PhaseSection.tsx` — getPhaseConfig(unitType)
- `src/components/teacher/lesson-editor/ExtensionBlock.tsx` — getPhases(unitType)
- `src/components/teacher/lesson-editor/ActivityBlock.tsx` — getPhases(unitType)
- `src/components/teacher/lesson-editor/BlockPalette.tsx` — unit-type-specific blocks

**Knowledge Base & Converter (5 files):**
- `src/lib/converter/detect-framework.ts` — Service Learning fingerprints
- `src/lib/converter/extract-lesson-structure.ts` — unit-type-aware
- `src/lib/converter/build-skeleton.ts` — unit-type-aware phase labels
- `src/lib/knowledge/analysis-prompts.ts` — parameterize per unit type
- `src/app/api/teacher/convert-lesson/route.ts` — read unitType

**Assessment & Grading (3 files):**
- Grading page — read unit_type + framework for criteria/scale
- Student lesson pages — correct criteria labels
- Dashboard unit cards — unit type badge

**Design Assistant (1 file):**
- `src/lib/ai/design-assistant-prompt.ts` — unit-type-aware examples, phases, criteria mapping

**Discovery Engine (3 files, can defer):**
- `src/lib/discovery/types.ts` — Service archetypes
- `src/lib/discovery/content/` — unit-type-specific content
- `src/lib/discovery/scoring.ts` — unit-type-aware weights

### Stay As-Is (~215 files)
Everything else: toolkit tools, response types, persistence hooks, auth, scheduling, forking, safety badges, NM, gallery, Open Studio infrastructure, landing page, admin panel.

---

## Part 13: Service Learning Block Palette (Draft)

When `unitType === 'service'`, the BlockPalette should offer these additional templates alongside universal blocks:

| Block | Category | Description |
|-------|----------|-------------|
| Community Needs Assessment | Research | Students map community assets and needs through surveys, interviews, observation |
| Stakeholder Interview | Research | Structured interview protocol for community partners, beneficiaries |
| SDG Connection | Research | Link service project to UN Sustainable Development Goals |
| Service Project Proposal | Planning | Formal proposal with goals, timeline, resources, success criteria |
| Risk Assessment | Planning | Identify risks, safeguarding requirements, mitigation strategies |
| Partner Communication | Planning | Draft email/letter/pitch to community partner |
| Community Action | Action | Structured fieldwork or service activity with documentation prompts |
| Impact Measurement | Action | Quantitative + qualitative evidence collection plan |
| Service Journal Entry | Reflection | Structured reflection (what happened, what I learned, what I'll do differently) |
| Before/During/After Reflection | Reflection | Three-stage reflection framework |
| Reciprocity Check | Reflection | What did we give? What did we receive? Was it equitable? |
| Community Presentation | Demonstration | Plan and deliver findings/impact to authentic audience |
| Gratitude & Celebration | Demonstration | Acknowledge all parties — students, partners, community |

These sit alongside universal blocks (discussion, group work, individual research, peer feedback) that work for any unit type.

---

## Appendix A: Teaching Corpus Stubs

### Service Learning Teaching Corpus (to be expanded)

The 10 principles from Part 3 form the skeleton. Needs expansion to match the depth of Design Teaching Corpus (which has 10 sections with multiple paragraphs each, code-level detail, and explicit DO/DON'T guidance).

### Personal Project Teaching Corpus (stub)

Key principles for self-directed investigation:
1. Student agency is paramount — the topic must come from genuine interest
2. ATL skills (thinking, communication, social, self-management, research) are the learning focus
3. The process journal IS the assessment evidence — not just the product
4. Supervisor role is facilitator, not director — ask questions, don't give answers
5. Goal setting must be SMART and student-authored
6. Regular check-ins prevent drift without removing autonomy
7. The final report demonstrates metacognition — what did you learn about learning?

### Inquiry Teaching Corpus (stub)

Key principles for transdisciplinary inquiry:
1. Central idea should be broad enough for multiple lines of inquiry
2. Students construct understanding through guided exploration, not instruction
3. The inquiry cycle spirals — students return to earlier phases with deeper understanding
4. Provocation over explanation — start with a stimulus that creates disequilibrium
5. Documentation of thinking (visible thinking routines) is as important as outcomes
6. Exhibition is authentic sharing, not performance — audience engagement matters

---

## Appendix B: Cross-Reference to Existing Docs

| Document | Relationship to this spec |
|----------|---------------------------|
| `docs/ai-intelligence-architecture.md` | Master AI architecture — unit type parameterizes the 4-layer knowledge system |
| `docs/design-teaching-corpus.md` | Layer 1 for Design — equivalent needed for Service, PP, Inquiry |
| `docs/education-ai-patterns.md` | 5 patterns are unit-type-agnostic (effort-gating works for any content) |
| `docs/timing-reference.md` | Timing model needs unit-type-specific defaults |
| `docs/specs/year-planner-spec.md` | Year planner spec is already framework-agnostic; standards layer adds coverage |
| `docs/specs/lesson-editor-phase-0.5.md` | Lesson editor architecture supports unit-type extension via props |
| `docs/specs/lesson-plan-converter.md` | Converter needs unit type detection + parameterized extraction |
| `docs/design-guidelines.md` | Design guidelines are mostly universal; add unit-type-specific entries |
| `docs/research/student-influence-factors.md` | Student profiling is unit-type-agnostic |
| `src/lib/frameworks/index.ts` | Existing framework definitions — partially overlaps, needs alignment |

---

*This document should be read before any work on unit types, curriculum frameworks, lesson generation, the lesson editor, year planner, or standards infrastructure. It is the single source of truth for how StudioLoom supports multiple unit types.*
