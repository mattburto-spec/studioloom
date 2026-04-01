# Project: Lesson Pulse — Composite Quality Scoring
**Created: 1 April 2026**
**Last updated: 1 April 2026**
**Status: SPEC COMPLETE — research done, algorithm designed, integrated into layer architecture spec. Not yet built.**
**Spec: `docs/specs/lesson-layer-architecture.md` §13**
**Depends on: Layer Registry (Phase 1 of lesson-layer-architecture)**

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
| `src/lib/layers/lesson-pulse.ts` | Core algorithm: `computeLessonPulse()`, `reliabilityAdjust()`, `generateInsights()` | NOT YET BUILT |
| `src/lib/layers/pulse-repair.ts` | Generation repair: `buildPulseRepairPrompt()`, `buildPulseContext()`, `mergeSections()` | NOT YET BUILT |
| `src/lib/layers/__tests__/lesson-pulse.test.ts` | Unit tests for scoring + repair + balancing | NOT YET BUILT |
| `generate-unit/route.ts` modifications | Post-generation Pulse scoring + surgical repair loop | NOT YET BUILT |
| `generate-journey/route.ts` modifications | Cross-lesson Pulse balancing via `buildPulseContext()` | NOT YET BUILT |
| JourneyLessonCard / review card enhancements | 3 gauge arcs + "✨ Enhanced" badge + revert | NOT YET BUILT |
| DimensionsSummaryBar enhancement | 3 gauge arcs (live update in editor) | NOT YET BUILT |
| Teaching Mode flagged-student card | Contextual Pulse hint on "Needs Help" click | NOT YET BUILT |
