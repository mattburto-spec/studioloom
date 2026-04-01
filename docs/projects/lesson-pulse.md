# Project: Lesson Pulse — Composite Quality Scoring
**Created: 1 April 2026**
**Last updated: 1 April 2026**
**Status: PHASE 1 COMPLETE + CONTEXT INJECTION + TEACHING MOVES LIBRARY COMPLETE — algorithm built (47/47 tests), generation wiring (4 routes), review screen UI (PulseGauges), context injection (3 wizard fields), Teaching Moves Library (~65 curated moves, wired into generation + repair). Validated against 3 real lesson plans (scores 4.4–4.8). Next: Voice/Personality Layer.**
**Spec: `docs/specs/lesson-layer-architecture.md` §13**
**Code: `src/lib/layers/lesson-pulse.ts` (algorithm), `src/components/teacher/wizard/PulseGauge.tsx` (UI)**
**Tests: `src/lib/layers/__tests__/lesson-pulse.test.ts` (47/47), `scripts/validate-lesson-pulse.mjs` (3 real plans)**
**Depends on: Dimensions Phase 0 (schema extensions) — SATISFIED**

---

## What This Is

A research-backed composite scoring system that collapses 13 pedagogical layer dimensions into **3 high-level scores + 1 overall**, giving teachers (and eventually the AI) a fast answer to: "Is this lesson good?"

The individual layers (bloom, grouping, UDL, scaffolding, etc.) are the diagnostic detail. The Lesson Pulse is the headline.

---

## The Three Dimensions

| Dimension | Maps to (Klieme) | What it measures | Input layers |
|-----------|-------------------|-----------------|--------------|
| **Cognitive Rigour** | Cognitive Activation | Is this intellectually demanding? | bloom_level (40%), thinking_routine depth (25%), inquiry_phase arc (20%), assessment_checkpoint (15%) |
| **Student Agency** | Supportive Climate | Do students have genuine choice and ownership? | agency_type (50%), collaboration_depth (30%), peer/self assessment (20%) |
| **Teacher Craft** | Classroom Management | Is this well-designed for diverse learners? | grouping_variety (20%), UDL coverage (25%), scaffolding completeness (20%), differentiation (20%), AI rules config (15%) |

**Overall** = average of 3 dimensions minus unevenness penalty (Bloomberg ESG pattern).

---

## Research Foundation

### Cross-Industry Precedents

**1. Healthcare — AHRQ PSI 90 Composite**
The Agency for Healthcare Research and Quality collapses 10 patient safety indicators into one composite. Weights = indicator frequency × harm severity. Key insight borrowed: **weights aren't equal — they reflect effect size (how much each indicator matters).**

Reference: AHRQ Patient Safety Indicators Technical Specifications v2024. CMS Hospital Compare methodology.

**2. Finance — Bloomberg ESG Unevenness Penalty**
ESG ratings (MSCI, S&P, Bloomberg) collapse 30-50 environmental/social/governance indicators into 3 pillars + 1 overall. Key insight borrowed: **unevenness penalty — scoring 9 on Environment but 2 on Governance drags the composite more than scoring 6/6/6.** This prevents gaming by being excellent on easy dimensions while ignoring hard ones.

Reference: Bloomberg ESG Data Methodology (2023). MSCI ESG Ratings Methodology.

**3. Education — Klieme's Three Basic Dimensions**
The most relevant precedent. Factor analysis across TIMSS data from 5+ countries (Germany, Norway, Belgium, Netherlands) consistently shows hundreds of teaching observation indicators collapse into exactly 3 dimensions:
- **Classroom Management** — structure, time-on-task, disruption prevention (stable, 1 observation enough)
- **Supportive Climate** — teacher-student relationships, caring, constructive feedback (stable, 1 observation enough)
- **Cognitive Activation** — higher-order thinking, productive struggle (HIGHLY variable, needs 9+ observations)

This is peer-reviewed and replicated independently by multiple research groups.

Reference: Klieme, E., Praetorius, A.-K., et al. (2006, 2009). "Teaching quality in mathematics: A cross-national comparison using TIMSS data." Various publications through ZDM Mathematics Education and Learning and Instruction journals.

**4. Gates MET Project ($335M study)**
Measures of Effective Teaching found the most reliable teaching quality composite = classroom observations (Danielson FFT) + student perception surveys (Tripod 7Cs) + student achievement gains. Three input types, combined via weighted average, validated via random assignment to classrooms.

Reference: Kane, T. J., & Staiger, D. O. (2012). "Gathering Feedback for Teaching: Combining High-Quality Observations with Student Surveys and Achievement Gains." Bill & Melinda Gates Foundation MET Project.

**5. Additional frameworks that validate the 3-dimension structure:**
- **Danielson Framework for Teaching (FFT)** — 4 domains, 22 components. Factor analysis by researchers consistently finds 3 dominant factors matching Klieme.
- **CLASS (Pianta et al.)** — Classroom Assessment Scoring System. 3 domains: Emotional Support, Classroom Organization, Instructional Support. Direct match to Klieme.
- **ISTOF** — International System for Teacher Observation and Feedback. Cross-national validation of similar factor structure.

### Effect Size Foundation (Hattie Synthesis)

| Our Dimension | Hattie Factor | Effect Size (d) | Source |
|--------------|---------------|-----------------|--------|
| Cognitive Rigour | Cognitive activation | 0.39-0.61 | Klieme TIMSS studies |
| Cognitive Rigour | Higher-order thinking | 0.62 | Hattie (2009) |
| Student Agency | Self-regulation strategies | 0.52 | Hattie (2009), Zimmerman (2000) |
| Student Agency | Cooperative learning | 0.40 | Hattie (2009), Johnson & Johnson (2009) |
| Teacher Craft | Classroom management | 0.52 | Klieme (2006), Marzano (2003) |
| Teacher Craft | Differentiated instruction | 0.46 | Hattie (2009), Tomlinson (2001) |

Weights within each dimension are derived from these effect sizes — higher d = higher weight.

---

## Algorithm Design

### Core Mechanics

1. **Weighted sub-scores** — Each dimension combines its input layers using weights derived from effect sizes. Bloom (d=0.62, high impact) gets 40% of Cognitive Rigour; UDL coverage gets 25% of Teacher Craft.

2. **Reliability adjustment (AHRQ pattern)** — When less than 50% of a dimension's input layers have data, the score shrinks toward 5.0 (neutral midpoint). Prevents a single "Create" bloom_level from inflating Cognitive Rigour to 10 when 7 other activities are untagged.

3. **Unevenness penalty (Bloomberg pattern)** — Overall = mean(3 dimensions) - stdDev × 0.5 (capped at -1.5 points). A lesson scoring 9/9/3 gets penalised more than 7/7/7. Encourages balanced lesson design.

4. **Actionable insights** — 1-3 specific suggestions generated from score patterns. "Most activities sit at Remember/Understand — try replacing one with Analyze/Evaluate." Never just "score is low."

### Scale Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Scale | **0-10** (not percentage) | Teachers understand "7 out of 10" better than "72%". Avoids false precision. |
| Neutral default | **5** (not 0) | Unmeasured lessons aren't "failing" — they're "unmeasured." Data moves score up/down from midpoint. |
| Insights | **Actionable** (not evaluative) | "Replace one activity with Analyze/Evaluate" beats "Cognitive Rigour is low." Teachers can DO something. |
| Reliability | **Shrink to neutral** (not omit) | Show the score always, but make it honest about confidence. Prevents gaming. |
| Unevenness | **Penalize imbalance** | A 7/7/7 lesson > 9/3/9 lesson. Balanced teaching is better teaching (Klieme). |

---

## Display Plan (Priority Order — Generation First)

**Key decision (1 April 2026): Generation pipeline is the PRIMARY use case, not the editor.** Generation is highest impact because every unit gets better with zero teacher effort. The editor is the secondary feedback loop.

| # | Surface | Visualisation | Phase |
|---|---------|--------------|-------|
| 1 | **Generation pipeline** | Post-generation scoring + surgical repair (targeted Haiku call on weak dimensions) + cross-lesson balancing (running Pulse average injected into next lesson's prompt) + skeleton quality targets | **Phase 1** (build with registry) |
| 2 | **Generation review screen** | 3 gauge arcs per lesson on review cards. "✨ Enhanced" badge on repaired lessons. Insights as tips. Teacher can revert repairs. | **Phase 1** |
| 3 | **DimensionsSummaryBar** (lesson editor) | 3 small gauge arcs (CR/SA/TC) + overall number. Click expands per-layer breakdown. Live update on edit. | **Phase 2** |
| 4 | **Unit detail page** | Per-lesson Pulse dots (green ≥7, amber 4-6, red <4) in lesson list | **Phase 2** |
| 5 | **Teacher dashboard** | Overall Pulse average per unit on unit cards | **Phase 3** |
| 6 | **Teaching Mode (flagged students only)** | Contextual hint when teacher clicks a "Needs Help" student: shows current activity's weakest dimension + actionable suggestion. Only when any dimension < 4.0. Never on the main grid. | **Phase 3** |
| 7 | **Upload analysis** | Estimate Pulse from extracted layer data on knowledge items | **Phase 4** |

**Not displayed:** Teaching Mode main grid, projector view, student pages, grading page. Pulse measures lesson design quality, not teaching quality or student performance.

### Generation Co-Pilot Details (see spec §13a-c for full code)

**Surgical repair:** After generation, any lesson scoring overall < 5.0 or any dimension < 4.0 triggers a single Haiku call (~500 tokens) targeting the weakest dimension. Repairs Work Time activities only (cheapest fix, highest impact). Teacher sees "✨ Enhanced" badge with before/after scores and can revert.

**Cross-lesson balancing:** After lesson N, compute running Pulse average across lessons 1..N. If any dimension averages < 5.5, inject targeted guidance into lesson N+1's prompt (~80-120 tokens). Self-limiting — guidance disappears once the unit is balanced. Express mode benefits most (zero teacher input → Pulse is the only quality signal).

**Skeleton targets:** Outline prompt includes "Aim for 6+ on all three dimensions" with specific structural guidance (vary Bloom levels, include choice moments, vary grouping).

### Teaching Mode: Flagged-Student Hints (see spec §13d)

When teacher clicks a flagged student (Needs Help, stuck 3+ min), a contextual card shows:
- Current activity name
- Weakest Pulse dimension + score (only if < 4.0)
- One actionable suggestion from `generateInsights()` scoped to that single activity
- Dismiss + Open Studio buttons

Zero additional API calls — scores pre-computed on lesson content. Only appears on click, never on the main grid.

---

## Relationship to Other Projects

| Project | Relationship |
|---------|-------------|
| **Dimensions (Phases 0-4)** | PREREQUISITE — Lesson Pulse consumes the layer data that Dimensions infrastructure captures |
| **Layer Architecture** | PARENT SPEC — Lesson Pulse is §13 of the layer architecture spec |
| **Intelligence Profiles** | FEEDS INTO — per-lesson Pulse scores become one input to the Teacher Intelligence Profile |
| **MYPflex** | INDEPENDENT — Pulse works across all frameworks (weights are pedagogy-based, not framework-based) |
| **Toolkit Tools** | READS FROM — toolkit sessions in lesson activities contribute to Student Agency dimension |

---

## Open Questions

1. **Should Lesson Pulse be visible to students?** Current: teacher-only. Research on learning analytics dashboards is mixed (some show improved self-regulation, others show anxiety). Default: hidden. Revisit after teacher feedback.

2. **Should low Pulse auto-trigger regeneration?** Current: highlight only, no auto-regeneration. Burns tokens and teachers might disagree with scoring.

3. **Should weights be teacher-adjustable?** Current: fixed research-based weights. ESG analogy: some investors weight E over G. Custom weights deferred to Phase 4+.

4. **Per-lesson or per-unit?** Both. Per-lesson in editor (diagnostic). Per-unit on dashboard (strategic). Unit-level = average of lesson-level, potentially weighted by lesson duration.

---

## Generation Quality Gap Analysis (1 April 2026)

### Current State: What the Wizard Already Does Well

An audit of all ~50 data fields and ~10 intelligence layers in the generation system reveals substantial coverage:

**Structural intelligence (strong):** Workshop Model enforced (4-phase), 1+age instruction cap, timing validation with auto-repair, bloom_level per activity, grouping variety, UDL checkpoints (CAST 3×3), scaffolding tiers (ELL 3-tier), extensions for early finishers, phase-appropriate response types, ai_rules per activity block, timeWeight model.

**Content intelligence (strong):** Design Teaching Corpus (Layer 1 — 10 sections of pedagogy), framework-specific vocabulary, RAG retrieval from teacher knowledge base (uploaded lesson plans, rubrics, exemplars), teacher style profile (timing + pedagogical preferences, learned over time), per-type criteria definitions (Design/Service/PP/Inquiry), dynamic schema builders per unit type.

**Quality control (strong):** Pulse post-generation scoring (3 dimensions + overall), surgical repair targeting weakest dimension, cross-lesson balancing (running average injected into next prompt), skeleton quality targets, content normalization across 4 versions, timing presets.

**Estimated baseline quality:** With all current layers fully operational, wizard-generated units would be **structurally in the top 10%** of lessons posted online — better Workshop Model adherence, more varied bloom levels, more explicit scaffolding, clearer timing than most shared lesson plans. Structure is the easiest thing for AI to get right because it's rule-based.

### The Gap: Where Expert Humans Still Win

In a hypothetical blind test (10 wizard units mixed with 10 expert-written units, judged by experienced teachers), the wizard would likely be picked as "best" for **2-3 out of 10** units. The gap isn't structural — it's in 5 specific areas where human expertise creates lessons that feel alive rather than competent.

### Five Quality-Gap Features

These are the features that would close the gap between "structurally excellent" and "a lesson I'd actually want to teach." Ordered by estimated impact on blind-test performance.

#### 1. Teaching Moves Library (HIGHEST IMPACT)

**The problem:** The AI generates activities from principles ("include a divergent thinking activity") but expert teachers draw from a mental library of specific, proven activity patterns — moves that reliably produce engagement, learning, and surprise. "Blind swap", "constraint removal", "failure museum", "60-second pitch", "silent critique", "role reversal", "gallery walk with Post-its", "materials roulette" — these are the building blocks expert teachers recombine.

**The solution:** A curated, tagged, searchable library of teaching moves extracted from real lessons. Each move has: name, description, phase(s), bloom level(s), grouping, energy level, prep requirements, variations, and one concrete example. The AI draws from this library during generation instead of inventing generic activities.

**Data sourcing:**
- Phase A: Manual curation of ~50-80 high-impact moves from design teaching practice (Matt's experience + published resources)
- Phase B: Knowledge base analysis pipeline extracts moves from uploaded lesson plans automatically (patterns like "students swap work and critique without names" → tagged as "blind swap" move)
- Phase C: Community contribution — teachers share moves, best ones get curated into the library

**Integration points:**
- Generation prompts: "For this Work Time activity, consider using one of these moves: [filtered by phase + bloom + grouping match]"
- Lesson editor: "Suggested moves" panel when editing an activity block
- Pulse repair: when Student Agency is low, repair prompt draws specific high-agency moves from library

**Estimated impact:** This is the single highest-impact addition. Expert teachers' "secret sauce" is almost always a clever activity structure, not better content knowledge. A library of 80 well-tagged moves would make wizard lessons feel like they were written by someone who's taught before.

**Build estimate:** ~3 days (data model + seed data + generation integration + editor UI)

#### 2. Context Injection

**The problem:** The Guided wizard asks about MYP framework, duration, criteria — but not about the actual classroom. "We're redesigning the school cafeteria queue system" or "Half the class has never used a scroll saw" or "Students just finished a unit on sustainability and are burned out on research." The AI generates for an abstract class, not THIS class.

**The solution:** 2-3 optional free-text context fields in the wizard: "What's the real-world connection?" / "What did students just finish?" / "Anything I should know about this group?" These get injected into generation prompts as grounding context. The AI weaves them into opening hooks, activity scenarios, and reflection prompts.

**Why it matters:** A single specific detail ("we're redesigning the cafeteria queue") transforms a generic "design a product" lesson into something students recognise as real. Expert teachers always ground lessons in context the students care about.

**Build estimate:** ~0.5 days (wizard fields + prompt injection)

#### 3. Voice/Personality Layer

**The problem:** The teacher style profile captures timing preferences and pedagogical leanings but NOT writing voice. Does this teacher use humour? Short punchy instructions or detailed step-by-step? First person ("I want you to...") or direct ("Brainstorm 5 ideas")? The Design Teaching Corpus is written in one voice. Expert lessons have personality — you can tell who wrote them.

**The solution:** Extend the teacher style profile with voice markers: formality level (casual/professional), humour frequency (never/occasional/frequent), instruction style (directive/invitational/challenging), favourite phrases (captured passively from edits). When teacher edits generated content, the system learns their voice over time (same exponential moving average pattern as timing learning). Eventually, lessons "sound like" the teacher.

**Why it matters:** Teachers reject generated content that doesn't sound like them, even if it's pedagogically better. Voice is the difference between "AI wrote this" and "this is MY lesson that AI helped me write."

**Build estimate:** ~2 days (profile extension + passive signal capture + prompt injection + learning loop)

#### 4. Exemplar Contrast

**The problem:** The Design Teaching Corpus teaches principles ("use gradual release of responsibility"). RAG retrieves relevant chunks from uploaded materials. But neither provides what an apprentice teacher gets from a master: the experience of reading a genuinely excellent lesson and understanding WHY it's excellent. "THIS opening hook works because it creates cognitive dissonance." "THIS constraint forces lateral thinking because students can't default to their first idea."

**The solution:** 3-5 annotated exemplar lessons per unit type (Design, Service, PP, Inquiry) stored as a special knowledge base category. Each has inline annotations explaining what makes specific sections excellent. These aren't RAG chunks — they're full lessons with commentary, similar to annotated chess games. Generation prompts reference them: "Aim for the quality of the annotated exemplar — notice how the hook creates a specific tension."

**Why it matters:** Principles tell you what to do. Exemplars show you what great looks like. The gap between knowing "vary your bloom levels" and seeing a lesson that does it brilliantly is the gap between competent and excellent.

**Build estimate:** ~2 days (exemplar annotation format + special retrieval + prompt integration). Content curation is ongoing — start with 2-3 exemplars per type.

#### 5. Sequencing Intuition (Energy Curve Model)

**The problem:** The AI sequences activities by topic logic (introduce → explore → apply → reflect) and Workshop Model phases. But expert teachers also sequence by energy and attention. After 15 minutes of individual research, students need to MOVE and TALK. After a high-energy group activity, 2 minutes of silent individual sketching resets focus. The body matters as much as the brain.

**The solution:** An energy curve model that tags activities with energy profile (static/active, solo/social, focused/divergent) and enforces variety. Never three static activities in a row. After every 15 min of solo focused work, insert a movement or social beat. The model learns from teacher edits — when a teacher moves an activity from position 3 to position 5, that's a sequencing signal.

**Why it matters:** Students don't disengage because content is boring — they disengage because their body hasn't moved in 20 minutes or they haven't spoken to anyone in 25 minutes. Expert teachers feel this instinctively. The AI needs an explicit model.

**Build estimate:** ~1.5 days (energy tagging + sequencing rules + learning from edit patterns)

### Projected Impact

With all 5 features operational, estimated blind-test performance rises from 2-3/10 to **5-6/10** — wizard units would be competitive with expert-written lessons in roughly half of cases. The remaining gap would be in deep domain expertise (knowing exactly which material fails interestingly for THIS project) and years of relationship knowledge with specific students.

The Teaching Moves Library alone would likely account for half the improvement — it's the biggest single lever.

---

## Build Estimate (Generation-First Priority)

| Phase | Work | Estimate |
|-------|------|----------|
| **Phase 1a: Algorithm** | `computeLessonPulse()` + `reliabilityAdjust()` + `generateInsights()` + `buildPulseRepairPrompt()` + `buildPulseContext()` | 0.5 day |
| **Phase 1b: Unit tests** | Score computation, edge cases, reliability shrinkage, unevenness penalty, repair prompt generation | 0.5 day |
| **Phase 1c: Generation wiring** | Post-generation scoring in `generate-unit/route.ts` + `generate-journey/route.ts`. Surgical repair calls. Cross-lesson balancing in `buildRAGPerLessonPrompt()`. Skeleton targets. | 1 day |
| **Phase 1d: Review screen UI** | 3 gauge arcs on JourneyLessonCard / review cards. "✨ Enhanced" badge. Insights as tips. Revert button. | 0.5 day |
| **Phase 2a: Editor UI** | 3 gauge arcs in DimensionsSummaryBar, click-to-expand breakdown, live update on edit | 1 day |
| **Phase 2b: Unit detail** | Per-lesson Pulse dots | 0.5 day |
| **Phase 3a: Dashboard** | Overall Pulse average per unit on unit cards | 0.5 day |
| **Phase 3b: Teaching Mode hints** | Flagged-student contextual card with activity Pulse breakdown | 0.5 day |
| **Total** | | **~5 days** |

**Blocked by:** Layer Registry (Phase 1 of lesson-layer-architecture). Pulse reads layer fields from activity sections — those fields must exist in the generation schema before Pulse can score them. The existing Dimensions fields (bloom_level, grouping, timeWeight, ai_rules, udl_checkpoints, scaffolding) give partial coverage. Full coverage requires new layer fields (thinking_routine, assessment_type, collaboration_depth, agency_type, differentiation) from Layer Architecture Phase 3.

**Partial coverage is still valuable:** With only existing Dimensions fields, Pulse can meaningfully score Cognitive Rigour (bloom is the 40% primary input) and Teacher Craft (grouping + UDL + scaffolding cover 65% of that dimension). Student Agency will be weak until new layer fields exist — but the generation pipeline can still target it via prompt guidance even without structured fields ("include a student choice moment").

---

## File Manifest

| File | Purpose | Status |
|------|---------|--------|
| `docs/specs/lesson-layer-architecture.md` §13 | Full algorithm + research + display plan + generation co-pilot | WRITTEN |
| `docs/projects/lesson-pulse.md` | This project doc | WRITTEN |
| `src/lib/layers/lesson-pulse.ts` | Core algorithm: `computeLessonPulse()`, helpers, repair prompt builders, context builders | ✅ BUILT |
| `src/lib/layers/__tests__/lesson-pulse.test.ts` | 47 test cases: scoring, edge cases, reliability, unevenness, insights, repair | ✅ BUILT (47/47 pass) |
| `src/components/teacher/wizard/PulseGauge.tsx` | SVG semicircle arc gauges (compact + expanded variants) | ✅ BUILT |
| `src/hooks/useWizardState.ts` | pulseScores state field + MERGE_PULSE_SCORES action | ✅ MODIFIED |
| `src/app/teacher/units/create/page.tsx` | 4 dispatch sites wiring generation response → wizard state | ✅ MODIFIED |
| `src/components/teacher/wizard/JourneyLessonCard.tsx` | PulseGauges in collapsed + expanded views | ✅ MODIFIED |
| `src/components/teacher/wizard/JourneyBuilder.tsx` | passes pulseScore prop from state to card | ✅ MODIFIED |
| `src/app/api/teacher/generate-unit/route.ts` | Post-generation Pulse scoring (try/catch) | ✅ MODIFIED |
| `src/app/api/teacher/generate-journey/route.ts` | Post-generation Pulse scoring (try/catch) | ✅ MODIFIED |
| `src/app/api/teacher/regenerate-page/route.ts` | Post-generation Pulse scoring (try/catch) | ✅ MODIFIED |
| `src/app/api/admin/ai-model/test-lesson/route.ts` | Post-generation Pulse scoring (try/catch) | ✅ MODIFIED |
| `src/lib/ai/prompts.ts` | `buildContextInjection()` + context injection in all generation prompts | ✅ MODIFIED |
| Wizard UI (GoalInput, ArchitectForm, GuidedConversation, SummaryRail) | 3 context fields (realWorldContext, studentContext, classroomConstraints) | ✅ MODIFIED |
| `scripts/validate-lesson-pulse.mjs` | Validation script scoring 3 real lesson plans | ✅ BUILT |
| `docs/projects/lesson-pulse-validation-report.md` | Full validation report with results | ✅ WRITTEN |
| DimensionsSummaryBar enhancement | 3 gauge arcs (live update in editor) | NOT YET BUILT |
| Teaching Mode flagged-student card | Contextual Pulse hint on "Needs Help" click | NOT YET BUILT |
| `src/lib/ai/teaching-moves.ts` | Teaching Moves Library: ~65 curated moves, scored retrieval, prompt formatting, repair moves | ✅ BUILT |
| `src/lib/ai/__tests__/teaching-moves.test.ts` | Teaching Moves tests: retrieval, formatting, repair, seed data validation | ✅ BUILT |

---

## Build Progress (1-2 April 2026)

### Completed
- ✅ **Phase 1a: Algorithm** — `computeLessonPulse()` with full Klieme 3-dimension scoring, Bloomberg unevenness penalty, AHRQ reliability adjustment, actionable insight generation, repair prompt builder, cross-lesson context builder, skeleton target builder. ~550 lines.
- ✅ **Phase 1b: Tests** — 47/47 passing. Covers: dimension scoring, edge cases (empty activities, all-same bloom), reliability shrinkage (<4 activities), unevenness penalty, insight generation, repair prompts, context builder, skeleton targets.
- ✅ **Context Injection** — 3 optional free-text fields (`realWorldContext`, `studentContext`, `classroomConstraints`) in GoalInput (Express/Guided), ArchitectForm (Architect lane), GuidedConversation turns. `buildContextInjection()` in prompts.ts returns formatted context or empty string. Injected into all generation prompts (generate-unit, generate-journey, generate-timeline, regenerate-page, criterion pages).
- ✅ **Phase 1c: Generation wiring** — Post-generation Pulse scoring in 4 routes (generate-unit, generate-journey, regenerate-page, test-lesson). All use try/catch "enhancement not requirement" pattern. Returns `pulseScores` (per-page map) or `pulseScore` (single lesson) in response JSON. Timeline route intentionally excluded (different data shape, same as timing validation).
- ✅ **Phase 1d: Review screen UI** — `PulseGauges` component with SVG semicircle arcs, color-coded (green ≥7, amber ≥5, red <5), compact + expanded variants. Wired into JourneyLessonCard (both collapsed and expanded views). `pulseScores` flows through wizard state via `MERGE_PULSE_SCORES` action dispatched from 4 sites in create/page.tsx.
- ✅ **Real lesson plan validation** — 3 plans scored (Biomimicry 4.4, Packaging 4.7, Under Pressure 4.8). Algorithm correctly differentiates: Student Agency showed 1.5-point range, Cognitive Rigour correctly highest for inquiry-based Under Pressure. Scores calibrated (4.4–4.8 for lessons lacking explicit scaffolding/UDL/AI config).

### Completed: Teaching Moves Library (1 April 2026)
- ✅ **Data model + seed data** — `TeachingMove` interface with id, name, description, example, phases, bloomLevels, grouping, energy, category, durationRange, boosts (Pulse dimensions), variations, prep, unitTypes. ~65 curated moves across 10+ categories (ideation, critique, research, making, reflection, warmup, collaboration, presentation, service-specific, inquiry-specific, digital).
- ✅ **Scored retrieval** — `getTeachingMoves(filter)` with soft-match scoring (phase=3pts, bloom=2pts, category=2pts, boosts=3pts, grouping=1pt, energy=1pt) + hard filter on unitType. Returns top N moves sorted by relevance.
- ✅ **Generation wiring** — `buildRAGPerLessonPrompt()` retrieves 4 phase-matched moves via `mapPhaseLabelToMovePhase()` helper, formats via `formatMovesForPrompt()`, injects as "Suggested Teaching Moves" section alongside Activity Cards. Enhancement-only (try/catch).
- ✅ **Pulse repair wiring** — `buildPulseRepairPrompt()` retrieves dimension-targeted repair moves via `getRepairMoves()`, formats via `formatRepairMoves()`, injects as "PROVEN TEACHING MOVES TO CONSIDER" in repair prompt. `buildPulseContext()` cross-lesson balancing also names 2 specific moves per weak dimension.
- ✅ **Tests** — Retrieval, formatting, repair, seed data integrity (unique IDs, all categories covered, all phases covered, all dimensions boosted, 40+ moves minimum).

### Next: Voice/Personality Layer + Sequencing Intuition
Remaining quality-gap features from the Generation Quality Gap Analysis.

### Validation Results (3 Real Lesson Plans)

| Lesson | CR | SA | TC | Overall |
|--------|----|----|-----|---------|
| Under Pressure (TeachEngineering) | 7.2 | 5.0 | 4.1 | **4.8** |
| Packaging Redesign (Matt Burton) | 7.2 | 3.8 | 5.1 | **4.7** |
| Biomimicry Pouch (Product Design) | 6.8 | 3.5 | 5.1 | **4.4** |

Key finding: Algorithm incentivizes holistic design via unevenness penalty — all 3 real lessons have dimension gaps that would trigger surgical repair in the generation pipeline.

---

## Test Checklist (Manual QA — 1 April 2026)

### P0 — Core Algorithm (run `npm test` or `node scripts/validate-lesson-pulse.mjs`)
- [ ] All 47 unit tests pass (`npm test -- --testPathPattern lesson-pulse`)
- [ ] Validation script runs and produces scores for 3 lesson plans
- [ ] Scores match expected ranges (CR 6.5-7.5, SA 3.0-5.5, TC 4.0-5.5, Overall 4.0-5.0)

### P0 — Generation Route Integration (requires live AI generation)
- [ ] **Express mode:** Generate a unit via Express lane → check API response includes `pulseScores` object with per-page entries
- [ ] **Guided mode:** Generate a unit via Guided wizard → check response includes `pulseScores`
- [ ] **Architect mode:** Generate via Architect form → check response includes `pulseScores`
- [ ] **Regenerate page:** Regenerate a single lesson → check response includes `pulseScore` (singular)
- [ ] **Test sandbox:** Generate test lesson in admin sandbox → check response includes `pulseScore`
- [ ] **Graceful failure:** If Pulse scoring throws (e.g., no sections in generated content), generation still succeeds (try/catch works)
- [ ] **Timeline mode:** Generate via timeline path → confirm response does NOT include pulseScores (intentionally excluded)

### P0 — Review Screen UI (requires completing a generation)
- [ ] **Collapsed lesson card:** PulseGauges visible (3 small arcs + overall pill) between learning goal and chevron
- [ ] **Expanded lesson card:** PulseGauges visible (larger arcs with labels) between learning goal and Workshop Phase Timeline Bar
- [ ] **Color coding:** Scores ≥7 green, ≥5 amber, <5 red
- [ ] **Missing scores:** Cards without pulseScore don't crash (graceful null handling)
- [ ] **Score labels:** "Strong" ≥8, "Good" ≥6, "OK" ≥5, "Weak" ≥3, "Low" <3

### P1 — Context Injection (requires wizard interaction)
- [ ] **Express lane:** realWorldContext, studentContext, classroomConstraints fields visible on GoalInput
- [ ] **Guided lane:** Context fields asked during conversation turns
- [ ] **Architect lane:** Context fields visible in ArchitectForm
- [ ] **Summary rail:** Context fields shown when populated
- [ ] **Prompt injection:** Generated lessons reference context (e.g., "cafeteria" appears in activities if realWorldContext mentions cafeteria)
- [ ] **Empty fields:** When all 3 context fields blank, generation works normally (no "undefined" or empty blocks in prompts)
- [ ] **Lane switching:** Context field values preserved when switching between Express/Guided/Architect

### P1 — Wizard State Flow
- [ ] **pulseScores in state:** After generation completes, `state.pulseScores` is populated (inspect via React DevTools or console)
- [ ] **Scores survive navigation:** Scores persist when scrolling through review cards
- [ ] **Fresh generation:** Starting a new unit clears previous pulseScores
- [ ] **Criterion + journey paths:** Both generation paths dispatch MERGE_PULSE_SCORES correctly

### P2 — Edge Cases
- [ ] **Very short lesson (1-2 activities):** Pulse still computes, reliability adjustment shrinks toward 5.0
- [ ] **Very long lesson (15+ activities):** Pulse still computes, no timeout
- [ ] **All same bloom level:** CR should be lower (penalizes lack of variety in inquiry arc)
- [ ] **All individual grouping:** TC should be lower (penalizes lack of grouping variety)
- [ ] **No scaffolding fields:** SA dimension partially degrades, score reflects uncertainty

**Step 5: Review Screen UI (Phase 1d) — 0.5 day**
3 gauge arcs on review cards. "✨ Enhanced" badge. Insights as tips. Revert button. Teacher sees Pulse scores for the first time.

**Step 6: Voice/Personality Layer — 2 days**
Extend teacher style profile with voice markers. Passive signal capture from edits. Prompt injection. This improves over time — each edit teaches the system more about how the teacher writes.

**Step 7: Sequencing Intuition — 1.5 days**
Energy curve model. Activity energy tagging. Sequencing rules (never 3 static in a row, movement beat every 15 min). Learning from teacher edit patterns (reordering = sequencing signal).

**Step 8: Exemplar Contrast — 2 days (content-dependent)**
Annotated exemplar lessons. This requires Matt to identify and annotate 2-3 excellent lessons per unit type. The system work (annotation format, retrieval, prompt integration) is ~1 day; content curation is ongoing.

**Steps 9+: Editor UI, Unit Detail, Dashboard, Teaching Mode (Phases 2-3) — 2.5 days**
Standard UI work. Can proceed in parallel with quality-gap features once Phase 1 is stable.

### Critical Path

Steps 1-3-5 form the **Pulse core path** (~2.5 days): algorithm → generation wiring → UI. This delivers the headline feature: every generated unit gets scored, weak ones get repaired, cross-lesson balance improves over time.

Steps 2+4 form the **generation quality path** (~3.5 days): context injection + teaching moves library. This delivers the biggest quality jump for the least effort.

**Recommended first sprint:** Steps 1+2+3 in parallel where possible (~2 days), then Step 4 (3 days) = **5 days for Pulse core + the two highest-impact quality features.**

### Validation Plan

After Steps 1-5 are built:
1. Generate 5 units across different types (Design, Service, PP) with Pulse active
2. Score each with Pulse — verify surgical repair triggers on weak dimensions
3. Compare pre-repair vs post-repair lesson quality (teacher review)
4. Run the TeachEngineering test lesson through Pulse converter — verify it scores close to the manual test run (CR ~6.9, SA ~3.3, TC ~5.9)
5. Matt teaches one wizard-generated unit and gives qualitative feedback on where it felt generic vs alive

### Deferred

- **technical_load as Pulse modifier** — added to Dimensions v2 spec (Phase 5). Implement after Pulse Phase 1 ships. Integration points documented in `lesson-layer-architecture.md` open question #5.
- **Teacher-adjustable weights** — Phase 4+. ESG analogy: some investors weight E over G. Deferred until teacher feedback shows specific weight disagreements.
- **Lesson Plan Converter** — uses Pulse scoring + teaching moves extraction to convert any uploaded lesson into StudioLoom format. Depends on Pulse core (Step 1) + knowledge base extraction (Step 4 Day 3). Spec at `docs/specs/lesson-plan-converter.md`.
- **Per-unit Pulse trends** — track how Pulse scores change as teacher edits accumulate. Shows whether editing is improving or degrading lesson quality. Depends on editor Pulse integration (Phase 2).
