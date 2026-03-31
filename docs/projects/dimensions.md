# Project Dimensions — Data Architecture Future-Proofing
**Created: 29 March 2026**
**Last updated: 30 March 2026**
**Status: Phases 0-3 COMPLETE — schemas, prompts, RAG pipeline, cognitive load + per-section difficulty + client-side activity tracking all live. Phase 3 browser-tested 30 Mar — tracking data saves correctly. attempt_number debounce fix committed 30 Mar.**
**Spec: `docs/specs/data-architecture-v2.md`**

---

## What This Is

A one-time data architecture pass to add fields at every level of the entity hierarchy BEFORE building more units, so that content created today is compatible with features built later. Named "Dimensions" because it adds new data dimensions to every entity level.

Five focus areas:
1. **UDL Inclusivity** — Universal Design for Learning as a data layer (not just a PDF policy)
2. **Multilingual prep** — language fields at teacher/class/unit/student levels for future translation
3. **Student tracking signals** — per-activity timing + effort signals for intelligence profiles
4. **Time model** — replace rigid `durationMinutes` with contextual `timeWeight` + velocity learning loop
5. **Research alignment** — ensure data layer captures all 10 high-impact student influence factors (Hattie synthesis in `docs/research/student-influence-factors.md`)

---

## Why Now

Units built without these fields will be missing data that future features need. Adding the fields now (even without full UI) means:
- AI generation starts populating `udl_checkpoints`, `bloom_level`, `ai_rules` on new content
- Existing units get default/null values (no data loss, graceful degradation)
- When we build the inclusivity UI or translation pipeline later, the data layer is already there

---

## Key Decisions (29 March 2026)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework vs Programme | **Keep together** | 95%+ of schools use matched framework+programme. YAGNI for 0-user product. Add `programme` override later if needed. |
| Inclusivity model | **UDL 3×3 grid** (not IEP 4-category) | UDL is proactive design, not reactive accommodation. CAST framework: Engagement/Representation/Action & Expression × Access/Support/Executive Function. 9 guidelines, 31 checkpoints. |
| `ai_rules` on activities | **Yes, prioritize** | Makes ANY activity customizable for AI behavior. Currently only 27 toolkit tools have per-step AI rules via hardcoded routes. This unlocks it for all lesson activities. |
| Student accommodations | **UDL-aligned barriers** (not disability labels) | "Needs extra support on Language & Symbols (2.1)" not "Has dyslexia." Matches to activity `udl_checkpoints` for automatic gap detection. |
| Per-activity time tracking | **Yes, add now** | Page-level `time_spent` is too coarse. Per-activity timing drives struggle detection, timing model improvement, and teacher alerts. |
| Activity time model | **`timeWeight` not `durationMinutes`** | Rigid "12 minutes" doesn't reflect reality (same activity = 8 min with Year 10, 20 min with Year 7). Use `quick/moderate/extended/flexible` weight. Keep `durationMinutes` as optional soft suggestion. Workshop Model phase is the time container — activities share the phase budget proportionally by weight. Actual student `time_spent_seconds` feeds velocity loop. |
| Velocity learning loop | **Yes, design now, build Phase 5** | First unit uses cold-start timing defaults. By 3rd unit, system has enough per-class data to predict accurately. By mid-year, highly tuned. Pattern: generate with weights → measure actuals → compute class velocity per activity type → feed back into next generation. |
| Time confidence indicator | **Yes, design now, build with Year Planner** | Show teachers "~12 lessons (high confidence)" vs "~8 lessons (low confidence — using defaults)". No other LMS does this. Depends on velocity data existing. |
| RAG analysis pipeline | **Yes, add to Phase 2** | Knowledge base uploader (3-pass analysis) should extract bloom levels, UDL coverage, grouping patterns, and timeWeight from uploaded content. Enriches RAG retrieval quality. |
| Unit Plan Converter | **Note for future** | Not yet built. When built, must output v2 schema fields (bloom_level, ai_rules, udl_checkpoints, timeWeight). No work now — just ensure spec documents the requirement. |
| Engagement score computation | **Phase 5** | Research doc has concrete formula (Part 10). Dimensions collects raw signals; composite score computation is Phase 5. |
| Active work threshold (66%) | **Phase 5** | Research: achievement gaps close when >66% of class time is active learning. bloom_level data enables passive vs active ratio check. Add validation rule in Phase 5. |
| Stereotype threat framing | **Covered by ai_rules** | ai_rules.phase already supports `"learning"` framing. Add `framing: "learning" | "diagnostic"` as optional field in Phase 2 generation. |

---

## Scope

### Phase 0: Schema Foundation (COMPLETE — 30 March 2026)

**Migration 057** APPLIED — adds page/activity-level Dimensions fields to content_data JSONB schema:
- Page level: `udl_coverage`, `grouping_strategy`, `bloom_distribution`
- Activity level: `bloom_level`, `grouping`, `ai_rules`, `udl_checkpoints`, `timeWeight`

**Migration 058** APPLIED — enriches `knowledge_chunks` table:
- `bloom_level TEXT`, `grouping TEXT`, `udl_checkpoints TEXT[]` columns added
- Enables filtered RAG retrieval ("find me all group activities at Evaluate level")

### Phase 1: Migration + TypeScript Interfaces (COMPLETE — 30 March 2026)

**Migration 057** — add columns to existing tables:

```
units: content_language, inclusivity_notes, materials_list, learning_outcomes, sdg_tags, cross_curricular_links, prerequisite_knowledge
classes: instruction_language, additional_languages
```

**TypeScript interface expansions** (inside content_data JSONB — no migration needed):

Page level: `inclusivity`, `udl_coverage`, `teacher_notes`, `success_criteria`, `grouping_strategy`
Activity level: `bloom_level`, `inclusivity`, `grouping`, `ai_rules`, `udl_checkpoints`, `success_look_fors`, `differentiation`, `tags`, `timeWeight`
Response level: `time_spent_seconds`, `attempt_number`, `effort_signals`
Student profile: `accommodations` (UDL-aligned), `udl_strengths`, `udl_barriers`, `communication_preferences`

**Time model change:** `ActivitySection.durationMinutes` (existing, number) becomes optional soft suggestion. New primary field: `ActivitySection.timeWeight: 'quick' | 'moderate' | 'extended' | 'flexible'`. Workshop Model phases distribute time proportionally across activities by weight, not by fixed minutes.

### Phase 2: AI Generation + Knowledge Pipeline Updates (COMPLETE — 30 March 2026)

**DONE — RAG analysis pipeline:**
- `src/lib/knowledge/analyse.ts` — Pass 2 analysis prompts now request `udl_coverage`, `bloom_distribution`, `grouping_analysis` fields. Schema reordered so Dimensions fields come before verbose arrays (prevents AI truncation). Version 2.2.0.
- **Pass 2b fallback (30 March 2026):** Dedicated lightweight Haiku call (`extractDimensionsFields()`) fires when Pass 2 omits any of the 3 Dimensions fields. Tiny focused schema (3 fields, 2048→3072 max_tokens) — guaranteed to fit. Merges via `Object.assign`. Non-critical try/catch. This is the fix for AI silently dropping fields due to JSON truncation at `max_tokens` boundary (Lesson Learned #26).
- `src/lib/knowledge/analysis-prompts.ts` — Added `buildDimensionsPrompt()` for Pass 2b with `cognitive_load_curve` and `section_dimensions` extraction. Main Pass 2 prompt updated with "REQUIRED" instruction + schema reorder.
- Migration 058 enriches `knowledge_chunks` with `bloom_level`, `grouping`, `udl_checkpoints` columns for filtered RAG retrieval.
- **Knowledge card UI enhanced (30 March 2026):** `KnowledgeItemCard.tsx` expanded (~215→~400 lines) with analysis badges, Bloom's mini-bar, complexity pills, criteria dots. Items API returns `profileMap` from `lesson_profiles` (Lesson Learned #19 pattern).
- **AnalysisDetailPanel wired (30 March 2026):** Rich analysis viewer mounted on knowledge page above edit form. Shows cognitive load curve, lesson flow timeline with bloom_level pills + time_weight badges, criteria coverage, pedagogical approach.
- **Cognitive load + per-section difficulty (30 March 2026):** Fixed empty cognitive load for non-lesson documents. `extractDimensionsFields()` now extracts `cognitive_load_curve` and `section_dimensions` array. `applySectionDimensions()` maps bloom_level + time_weight onto each lesson_flow phase. Works for ALL document types (not just lesson plans).

**DONE — AI generation schemas + prompts (30 March 2026):**
- `src/lib/ai/schemas.ts` — `dimensionsActivityProperties` (bloom_level, timeWeight, grouping, ai_rules, udl_checkpoints, success_look_fors) already spread into ALL three schema builders: `buildPageContentSchema()`, `buildJourneyActivitySectionSchema()`, and `timelineActivitySchema`. `dimensionsPageProperties` (grouping_strategy, success_criteria) spread into page-level schema. All 10 generation routes inherit these fields via the tool schemas.
- `src/lib/ai/prompts.ts` — `buildDesignTeachingContext()` principle #13 contains full DIMENSIONS METADATA instruction (bloom_level, timeWeight, grouping, ai_rules, udl_checkpoints, success_look_fors, grouping_strategy, success_criteria). `DIMENSIONS_METADATA_INSTRUCTION` constant appended to all non-design types (service, personal_project, inquiry). All unit types receive Dimensions guidance.
- `src/lib/ai/anthropic.ts` — `generateCriterionPages()` calls `buildPageGenerationTool(criterion, pageCount, unitType)` → `buildPageContentSchema(unitType)` with Dimensions fields. Journey and timeline generation use equivalent schema builders.

**REMAINING (lower priority):**
- Timing validation: add `udl_coverage` gap check (warn if a lesson misses an entire UDL principle)
- Student-facing prompts: read `learning_profile.accommodations` and adapt scaffolding
- RAG retrieval (`retrieveContext`, `retrieveLessonProfiles`) — support optional filters: `bloom_level`, `udl_principle`, `grouping`

**Note for Lesson Plan Converter (not yet built):** When built, the converter must output v2 schema with all Dimensions fields (bloom_level, ai_rules, udl_checkpoints, timeWeight, grouping). Spec this requirement in the converter's future spec doc. No work now.

### Phase 3: Client-Side Tracking (COMPLETE — 30 March 2026)

**`src/hooks/useActivityTracking.ts`** — NEW (~350 lines). Dedicated hook for per-activity engagement metrics:
- IntersectionObserver-based visibility tracking (30% threshold = "in view")
- `time_spent_seconds`: accumulated visible time, capped at 3600s (handles tab-left-open)
- `attempt_number`: 2-second debounce commit pattern — queues pending value, only increments when committed value differs after a typing pause. First complete response = attempt 1, revision after pause = attempt 2. (Fixed 30 Mar: was incrementing on every keystroke, recorded 121 for a single text field.)
- `effort_signals`: word_count, editing_sessions (gaps >10s = new session), has_revisions, focus_ratio (interaction time / visible time)
- `first_interaction_at` / `last_interaction_at` timestamps
- Periodic flush every 15s + flush-on-save via `getTrackingPayload()`
- Data stored as `_tracking_<activityKey>` entries in `student_progress.responses` JSONB (alongside response values)

**`src/hooks/usePageResponses.ts`** — Modified to accept optional `getTrackingPayload` callback. On save (both manual and auto-save), merges tracking data into responses payload. Non-critical try/catch — tracking failure never blocks save.

**`src/app/(student)/unit/[unitId]/[pageId]/page.tsx`** — Wired: `useActivityTracking` initialized per page, each activity section wrapped with observer ref div, `recordInteraction` + `recordResponseChange` called on response changes.

### Phase 4: Lesson Editor Integration (~1 day)

- Show `bloom_level` selector on ActivityBlock in lesson editor (6 Bloom's levels as pills)
- Show `grouping` selector (individual/pair/small group/whole class)
- Show `ai_rules` editor panel (phase: divergent/convergent/neutral + custom rules textarea)
- Show `udl_checkpoints` auto-tags with ability to add/remove
- Show per-lesson `udl_coverage` summary (3-dot indicator: green if principle covered, amber if gaps)

### Phase 5: Teacher Dashboard / Reports (LATER)

- UDL coverage dashboard per unit (which principles are well-covered, which have gaps)
- Student accommodation matching report (which students have unmet needs in which lessons)
- Activity-level timing analytics (where students spend the most/least time)
- Teacher alerts based on passive signals

---

## File Manifest

| File | Type | Purpose |
|------|------|---------|
| `docs/specs/data-architecture-v2.md` | Spec | Full 8-level hierarchy mapping with all fields, UDL reference, migration SQL, TypeScript interfaces |
| `docs/projects/dimensions.md` | Project plan | This file — status, phases, decisions, checklist |
| `supabase/migrations/057_data_dimensions.sql` | Migration | To be created — units + classes columns |
| `src/types/index.ts` | Code | TypeScript interface updates (PageContent, ActivitySection, ActivityResponse) |
| `src/lib/ai/prompts.ts` | Code | AI generation prompt updates for UDL + bloom + ai_rules |
| `src/lib/ai/schemas.ts` | Code | Tool schema updates for new activity fields |
| `src/hooks/useActivityTracking.ts` | Code | Per-activity engagement tracking hook (IntersectionObserver, effort signals) |
| `src/hooks/usePageResponses.ts` | Code | Modified — accepts tracking payload callback, merges into save |
| `src/lib/knowledge/analyse.ts` | Code | RAG analysis pipeline — Pass 2b `extractDimensionsFields()` fallback (v2.2.0) |
| `src/lib/knowledge/analysis-prompts.ts` | Code | Analysis prompt updates (v2.2.0) + `buildDimensionsPrompt()` for Pass 2b |
| `src/lib/knowledge/chunks.ts` | Code | Chunk metadata enrichment |
| `src/components/teacher/knowledge/KnowledgeItemCard.tsx` | Code | Enhanced card UI with analysis badges, Bloom's bar, complexity, criteria dots |
| `src/app/api/teacher/knowledge/items/route.ts` | Code | Extended GET to return `profileMap` from lesson_profiles |
| `src/app/teacher/knowledge/page.tsx` | Code | Wires profileMap into KnowledgeItemCard props |
| `supabase/migrations/057_data_dimensions.sql` | Migration | Page/activity-level Dimensions fields (APPLIED) |
| `supabase/migrations/058_knowledge_chunks_enrichment.sql` | Migration | bloom_level, grouping, udl_checkpoints on knowledge_chunks (APPLIED) |
| `docs/research/student-influence-factors.md` | Reference | 24-factor Hattie-style research synthesis — Phase 5 composite score formulas |

---

## Implementation Checklist

### Phase 0: Schema Foundation
- [x] Create migration 057 (page/activity-level Dimensions fields)
- [x] Apply migration 057 to Supabase (APPLIED 30 March 2026)
- [x] Create migration 058 (knowledge_chunks enrichment — bloom_level, grouping, udl_checkpoints)
- [x] Apply migration 058 to Supabase (APPLIED 30 March 2026)

### Phase 1: Data Layer
- [x] Create migration 057 from spec SQL
- [x] Apply migration 057 to Supabase
- [ ] Update `PageContent` interface with `inclusivity`, `udl_coverage`, `teacher_notes`, `success_criteria`, `grouping_strategy`
- [ ] Update `ActivitySection` interface with `bloom_level`, `inclusivity`, `grouping`, `ai_rules`, `udl_checkpoints`, `success_look_fors`, `differentiation`, `tags`, `timeWeight`
- [ ] Make `ActivitySection.durationMinutes` optional (was implicitly required in some generation schemas)
- [ ] Update `ActivityResponse` type with `time_spent_seconds`, `attempt_number`, `effort_signals`
- [ ] Update `LearningProfile` type with UDL-aligned `accommodations`, `udl_strengths`, `udl_barriers`, `communication_preferences`
- [ ] Verify existing content loads fine with null/undefined new fields (graceful degradation)

### Phase 2: AI Generation + Knowledge Pipeline
- [x] Add UDL awareness to `buildDesignTeachingContext()` in prompts.ts — principle #13 with full Dimensions instructions
- [x] Add `bloom_level`, `grouping`, `ai_rules`, `udl_checkpoints`, `timeWeight` to tool schemas — `dimensionsActivityProperties` spread into all 3 schema builders
- [x] Update generation prompts: AI outputs `timeWeight` (quick/moderate/extended/flexible) alongside `durationMinutes`
- [x] Keep `durationMinutes` as optional AI suggestion (soft hint for PhaseTimelineBar display) — both fields in schema
- [ ] Update timing validation: distribute phase time across activities proportionally by weight, not by fixed minutes
- [ ] Test: generate a unit and verify new fields appear in content_data
- [ ] Add `udl_coverage` gap check to timing validation (warn if principle missing)
- [ ] Wire `learning_profile.accommodations` into Design Assistant system prompt
- [x] **RAG analysis pipeline:** Pass 2 updated to request Dimensions fields + Pass 2b fallback added (`extractDimensionsFields()` in analyse.ts)
- [x] **RAG analysis prompts:** `analysis-prompts.ts` updated to v2.2.0 with Dimensions extraction + `buildDimensionsPrompt()` for Pass 2b
- [x] **RAG chunk enrichment:** Migration 058 adds bloom_level, grouping, udl_checkpoints columns to `knowledge_chunks` table
- [ ] **RAG retrieval filters:** Add optional bloom_level, udl_principle, grouping filters to `retrieveContext()` and `retrieveLessonProfiles()`
- [ ] **Test:** Upload a lesson plan → verify analysis extracts bloom levels and UDL tags → verify enriched chunks appear in retrieval
- [x] **Knowledge card UI:** `KnowledgeItemCard.tsx` enhanced with analysis badges, Bloom's mini-bar, complexity pills, criteria dots, pedagogical approach
- [x] **Knowledge items API:** Extended to return `profileMap` from `lesson_profiles` (separate query, Lesson Learned #19 pattern)

### Phase 3: Client Tracking
- [x] Add per-activity time tracking via useActivityTracking.ts (IntersectionObserver, 30% threshold, 3600s cap)
- [x] Add attempt_number tracking on revision (increment on non-empty value change)
- [x] Add effort_signals computation client-side (word_count, editing_sessions, has_revisions, focus_ratio)
- [x] Wire into student lesson page (observer refs, interaction recording, response change tracking)
- [x] Merge tracking data into save payload via getTrackingPayload() callback
- [x] Verify data saves correctly to student_progress responses JSONB — CONFIRMED 30 Mar via Supabase inspection (`_tracking_activity_L04-a4` with time_spent_seconds, effort_signals, focus_ratio)
- [x] Fix attempt_number overcounting bug (was 121 for single field — added 2-second debounce commit pattern, committed `ff8c3ad`)

### Phase 4: Lesson Editor + Teacher UI
- [x] Bloom's level selector on ActivityBlock (6-level colour-coded pills with toggle behavior) — 31 Mar 2026
- [x] Grouping selector on ActivityBlock (individual/pair/small_group/whole_class/mixed with emoji + label) — 31 Mar 2026
- [x] timeWeight selector on ActivityBlock (quick ⚡ / moderate 📐 / extended 🔬 / flexible 🔄) with weight description — 31 Mar 2026
- [x] ai_rules editor panel on ActivityBlock (phase selector + tone input + custom rules textarea + forbidden words) as "AI Rules" expandable section — 31 Mar 2026
- [x] Success Look-Fors textarea on ActivityBlock (one per line, observable behaviours) — 31 Mar 2026
- [x] Activity Tags input (comma-separated, for future block library search) — 31 Mar 2026
- [x] Dimensions quick-bar on ActivityBlock: inline pill summary (Bloom colour, timeWeight icon, grouping icon, AI phase badge, UDL count) with edit pencil button — 31 Mar 2026
- [x] DimensionsSummaryBar component: per-lesson Bloom's distribution mini-bar + UDL 3-dot coverage indicator + grouping variety count + AI rules count — 31 Mar 2026
- [x] Cognitive load curve sparkline in DimensionsSummaryBar: SVG area chart plotting Bloom level per activity left-to-right, color-coded green→amber→red, average load label (Low/Medium/High/Very High). Requires 2+ activities with bloom_level. Sticks with timeline bar. — 31 Mar 2026
- [x] DimensionsSummaryBar moved into sticky timeline container (sticks below Workshop Model timeline while scrolling) — 31 Mar 2026
- [x] "Add Timing" fallback prompt on lessons without workshopPhases data — 31 Mar 2026
- [x] Activity block sections redesigned: 5 stacked ExpandableSection accordions replaced with compact horizontal tab bar (Design, AI Rules, Scaffolding, Example, Media). Dot indicators for populated tabs. AnimatePresence transitions. ~810→~586 lines. — 31 Mar 2026
- [x] Update ActivityBlockAdd 7 templates with bloom_level + grouping + timeWeight + ai_rules defaults (Written Response=apply/moderate/individual, Creative Upload=create/extended/divergent, etc.) — 31 Mar 2026
- [x] TimeWeight distribution summary in Work Time phase activity total row — 31 Mar 2026
- [x] Backward compatibility verified: legacy activities (no Dimensions fields) render correctly — quick-bar shows "Learning Design" add button, DimensionsSummaryBar hides, no errors — 31 Mar 2026
- [ ] UDL checkpoint tags on ActivityBlock (auto-tagged, editable) — DEFERRED: needs UDL checkpoint reference data + tag picker UI
- [ ] Unit detail page: display materials_list, learning_outcomes, sdg_tags, prerequisite_knowledge, cross_curricular_links — DEFERRED to Phase 4b
- [ ] Teacher settings page: instruction_language dropdown + additional_languages checkboxes on class creation/edit — DEFERRED to Phase 4b

### Phase 5: Reports + Velocity Loop + Research Metrics (LATER — not in current sprint)
- [ ] UDL coverage dashboard per unit
- [ ] Student accommodation matching report
- [ ] Activity-level timing analytics (actual vs estimated per activity type)
- [ ] Teacher alert triggers from passive signals
- [ ] **Velocity computation**: aggregate `time_spent_seconds` per activity type per class → compute class velocity profile (e.g., "this class averages 14 min on research, 8 min on reflection")
- [ ] **Velocity-informed generation**: feed class velocity into AI generation prompts so "moderate" means ~14 min for THIS class, not the default ~10 min
- [ ] **Time confidence indicator** on year planner: "~12 lessons (high confidence — based on 2 similar units)" vs "~8 lessons (low confidence — using defaults)"
- [ ] **Timing accuracy dashboard**: show teachers predicted vs actual time per lesson over a semester — "your timing predictions improved from ±40% to ±12%"
- [ ] **Engagement score composite**: compute from raw signals (time_spent, attempt_number, effort_signals, response complexity) using formula from `docs/research/student-influence-factors.md` Part 10
- [ ] **Active work ratio validation**: flag units where <66% of activities are bloom_level ≥ Apply (research threshold for achievement gap closure)
- [ ] **Growth mindset indicators**: compute revision sophistication score from attempt_number + quality delta between attempts
- [ ] **Language readiness proxy**: compute vocabulary complexity (type-token ratio) + technical vocab usage from student responses
- [ ] **Peer collaboration quality**: aggregate Class Gallery review depth + shared toolkit engagement into per-student peer effectiveness score
- [ ] **Enhanced Cognitive Load Model for Teaching Mode**: Upgrade the editor's Bloom-only sparkline into a multi-factor cognitive load model for real-time classroom use. Factors: (1) **Age adjustment** — 1+age cognitive ceiling applied to load scores (Year 7 age 12 has lower ceiling than Year 10 age 15; a "Create" task fine for 15yo may overload 12yo). (2) **Language load multiplier** — ELL students processing in L2 spend cognitive resources on language; "Remember" in L2 ≈ "Apply" in L1; use ELL tier from student learning profiles. (3) **Learning difference adjustments** — ADHD: sustained high-load activities need flagging for break insertion; Anxiety: evaluation activities spike load disproportionately; Dyslexia: text-heavy activities carry hidden reading load. Use `learning_profile` flags. (4) **Grouping transition cost** — switching individual→group has cognitive overhead (social negotiation); multiple transitions compound. (5) **Time pressure multiplier** — `timeWeight: quick` + `bloom_level: create` = higher effective load than `extended` + `create`. (6) **Workshop Model shape validation** — verify peak cognitive load falls in work time section (not opening or debrief). Display: Teaching Mode projector shows class-adjusted cognitive load curve ("this activity is rated High for 3 students based on their profiles"), teacher can make real-time pacing/scaffolding decisions. Data sources already collected: bloom_level (Phase 4), timeWeight (Phase 4), grouping (Phase 4), student ages (grade profiles), learning profiles (migration 048), ELL tiers (learning profile), ai_rules.phase (Phase 4). The editor sparkline component (`CognitiveLoadCurve` in `DimensionsSummaryBar.tsx`) becomes the rendering foundation — same SVG component, richer input data.
- [ ] **Workshop Model shape validation in cognitive load curve** — check whether peak load position follows good pedagogical shape (ramp up in work time, ease off for debrief). Currently identified in `CognitiveLoadCurve` but removed from display as the heuristic is too simplistic for the current Bloom-only model. Revisit when the enhanced multi-factor model (above) provides enough data for a meaningful pedagogical shape assessment.

---

## Estimated Effort

| Phase | Days | Dependencies | Status |
|-------|------|-------------|--------|
| Phase 0: Schema foundation | 0.5 | None | **COMPLETE** (30 Mar) |
| Phase 1: Data layer (TypeScript) | 0.5 | Phase 0 | **COMPLETE** (30 Mar) |
| Phase 2: AI generation + RAG pipeline | 2.5 | Phase 1 | **COMPLETE** (30 Mar) — schemas, prompts, RAG pipeline, cognitive load, per-section difficulty |
| Phase 3: Client tracking | 0.5 | Phase 1 | **COMPLETE** (30 Mar) |
| Phase 4: Lesson editor UI | 1 | Phase 1 | **COMPLETE** (31 Mar) — core selectors + summary bar + templates. Phase 4b deferred (UDL tags, unit detail, language settings) |
| Phase 5: Reports + research metrics | 4-6 | Phases 1-4 + real student data | Deferred |
| **Remaining (Phase 4b)** | **~0.5 day** | UDL tag picker, unit detail page fields, language settings |

---

## UDL Quick Reference

The full 3×3 UDL grid (CAST udlguidelines.cast.org):

**Engagement** (WHY): 7.1-7.4 (Access), 8.1-8.5 (Support), 9.1-9.4 (Executive Function)
**Representation** (WHAT): 1.1-1.3 (Access), 2.1-2.5 (Support), 3.1-3.4 (Executive Function)
**Action & Expression** (HOW): 4.1-4.2 (Access), 5.1-5.4 (Support), 6.1-6.5 (Executive Function)

StudioLoom's existing UDL coverage: Response types (5.1/5.2), effort-gating (8.2/8.5), ELL scaffolding (2.1), Discovery profiling (7.1), Workshop Model phases (1.2), toolkit interaction shapes (5.2). Gaps: Limited Engagement → Executive Function (9.x), limited Building Knowledge (3.x).

---

## Research Alignment: Student Influence Factors Gap Analysis

Cross-reference with `docs/research/student-influence-factors.md` (24 factors, Hattie-style effect sizes). The top 10 actionable factors and how Dimensions covers them:

| # | Factor | Effect Size | Dimensions Coverage | Status |
|---|--------|-------------|-------------------|--------|
| 1 | Teacher-Student Relationship | d=0.57 | `ai_rules` enables warmer AI tone per activity; Design Assistant reads `learning_profile` | **Partial** — no new teacher relationship measurement signals |
| 2 | Peer Belonging | d=0.30-0.64 | `grouping` field enables intentional pairing data | **Partial** — Class Gallery already built separately. No peer matching algorithm in scope |
| 3 | Active Engagement Time | d=0.52 | `time_spent_seconds`, `timeWeight`, velocity loop, `bloom_level` (active vs passive ratio) | **STRONG** — core of Dimensions |
| 4 | Prior Knowledge | d=0.10-0.40 | `prerequisite_knowledge` field on units | **Partial** — field exists but no diagnostic quiz or adaptive path yet |
| 5 | Emotion Regulation + Self-Efficacy | d=0.20-0.53 | `effort_signals`, `attempt_number` (revision resilience) | **Good** — signals collected, composite score in Phase 5 |
| 6 | Growth Mindset | d=0.15-0.20 | `attempt_number` + quality delta between revisions | **Partial** — data yes, mindset messaging system no |
| 7 | Language Proficiency | moderate | `instruction_language`, `additional_languages` on classes, `home_languages` on profile | **Good** — fields ready for scaffolding adaptation |
| 8 | Home Learning Environment | d=0.32 | Not in scope | **Not covered** — low priority (hard to measure from platform, ethically sensitive) |
| 9 | Peer Influence | d=0.40 | `grouping` field, Class Gallery review quality data | **Partial** — structure yes, ability-matching algorithm no |
| 10 | Digital Literacy | d=0.35-0.55 | Not in scope | **Not covered** — onboarding/feature discovery tracking is a separate project |

**Gaps not requiring new work (already covered by existing features):**
- Peer belonging → Class Gallery (built), Discovery Engine peer scenarios (built)
- Growth mindset messaging → effort-gating pattern (built in all toolkit tools + reflections)
- Stereotype threat → all tasks framed as learning (existing design principle D1 in design-guidelines.md)

**Gaps requiring future work (noted, not in Dimensions scope):**
- Peer ability matching algorithm (use grouping + bloom data to suggest optimal pairs) — **Year 2 feature**
- Digital literacy onboarding + feature discovery tracking — **Separate project**
- Home learning environment survey — **Ethically complex; consider carefully before building**
- Diagnostic prior knowledge quiz per unit — **Could be added to unit generation wizard later**

**Key insight:** Dimensions doesn't need to solve all 10 factors. Its job is to **collect the data** so future features can act on it. The raw signals (time_spent, attempt_number, effort_signals, bloom_level, grouping) are the measurement infrastructure that enables Phase 5 composite scores matching the research formulas.

---

## Pipeline Coverage: What Gets Updated

| System | In Dimensions Scope? | What Changes |
|--------|---------------------|-------------|
| **AI Unit Builder (wizard + generation)** | **YES — Phase 2** | All 10 generate-* routes populate bloom_level, grouping, ai_rules, udl_checkpoints, timeWeight on generated activities |
| **Knowledge RAG Uploader (3-pass analysis)** | **YES — Phase 2** | Analysis pipeline extracts bloom levels, UDL coverage, grouping patterns from uploads. Chunks enriched with metadata for filtered retrieval |
| **Unit Plan Converter** | **NOT YET BUILT** | When built, must output v2 schema fields. Requirement documented in spec. No work now |
| **Design Assistant (student AI mentor)** | **YES — Phase 2** | Reads learning_profile.accommodations + udl_barriers to adapt scaffolding and tone |
| **Lesson Editor (Phase 0.5)** | **YES — Phase 4** | New selectors: bloom_level, grouping, ai_rules, timeWeight, UDL coverage indicator |
| **Toolkit Tools (27 interactive)** | **Inherits** | Already have ai_rules via hardcoded routes. Future: read ai_rules from content_data instead (dedup ~2,890 lines). Not in Dimensions scope but enabled by it |
| **Student Lesson Page** | **YES — Phase 3** | Per-activity time tracking, attempt counting, effort signal collection |
| **Grading Page** | **Phase 5** | Display effort_signals, engagement score, revision resilience alongside grades |
| **Year Planner** | **Phase 5** | Time confidence indicator using velocity data |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AI ignores new fields in generation | Medium | Low | Validate in test sandbox; add to timing validation checks |
| Per-activity timing inaccurate (tab switches, multitasking) | High | Low | Use intersection observer for visibility; cap at reasonable max (3600s) |
| Teachers don't understand UDL checkpoints | Medium | Medium | Auto-tag only; teachers see friendly names not numbers. "This activity builds collaboration and persistence" not "8.3, 8.4" |
| Over-engineering for 0 users | High | Medium | Phase 5 deferred. Phases 1-4 are data-layer + generation only. No new UI pages. |
| New DB columns break old code paths | Medium | High | All new fields optional. Migration-gap retry pattern (Lesson Learned #17) on every write. Test with pre-Dimensions units. |
| Missing learning_profile crashes AI prompt | Medium | High | Wrap profile fetch in try/catch; use empty defaults. Non-critical hint, never blocks response. |
| Schema mismatch between AI output and TypeScript types | Medium | Medium | Update schemas.ts AND types/index.ts in lockstep. Run `tsc --noEmit` after changes. |
| ActivityBlock onUpdate() doesn't pass all new fields | Low | Medium | Code review: every new `<input>` must have onChange → onUpdate(). Test: edit → save → reload → verify field persists. |

---

## Impact Audit (29 March 2026)

Full codebase audit identified **96 files across 9 categories** impacted by Project Dimensions.

### Critical files (MUST update — will break or produce wrong results):
- `src/types/index.ts` — all new interfaces
- `src/lib/ai/schemas.ts` — tool schemas for generation
- `src/lib/ai/prompts.ts` — UDL + bloom + ai_rules injection
- 10 generate-* API routes — schema updates + migration-gap retry
- `src/components/teacher/lesson-editor/ActivityBlock.tsx` — new UI sections
- `src/lib/design-assistant/conversation.ts` — learning_profile → AI prompt injection
- `src/lib/knowledge/analyse.ts` — add bloom/UDL/grouping extraction to analysis pipelines
- `src/lib/knowledge/analysis-prompts.ts` — update prompts to v2.1.0 with extraction instructions
- `src/lib/knowledge/chunks.ts` — enrich chunk metadata with bloom/UDL/grouping tags

### High-priority files (should update — miss opportunities without changes):
- `src/app/teacher/units/[unitId]/page.tsx` — display materials, learning_outcomes, sdg_tags
- `src/app/teacher/settings/page.tsx` — instruction_language input form
- `src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx` — effort_signals display
- `src/app/api/student/learning-profile/route.ts` — accept UDL accommodations fields
- `src/app/api/teacher/dashboard/route.ts` — include new unit metadata in summary

### Safe files (handle unknown fields gracefully):
- `src/lib/unit-adapter.ts` — normalizeContentData() already generic
- `src/hooks/usePageData.ts` — optional chaining throughout
- All portfolio, safety badge, LMS, timetable, gallery routes — independent of new fields
- Student lesson page — renders responses, not activity metadata

### Things to be careful of:
1. **ActivityBlockAdd templates** — 6 templates (discussion, hands-on, etc.) should pre-populate bloom_level + grouping defaults
2. **`udl_coverage` is derived data** — compute client-side from activities' udl_checkpoints, don't store redundantly in DB
3. **Per-activity time tracking** — use IntersectionObserver (start timer on visibility, stop on next activity or submit). Cap at 3600s max to handle tab-left-open.
4. **Bloom level auto-classification** — define keyword heuristic: "list/identify/name" → Remember, "explain/describe" → Understand, "apply/use/demonstrate" → Apply, "analyze/compare/contrast" → Analyze, "evaluate/justify/critique" → Evaluate, "design/create/build" → Create
5. **Pre-Dimensions backward compatibility** — explicit test: load a unit created before migration 057 in the lesson editor. All new fields should be undefined/null with no errors.
6. **10 generation routes** need the same migration-gap retry pattern — consider extracting a shared helper: `resilientInsert(supabase, table, payload, optionalColumns[])`
