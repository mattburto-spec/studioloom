# StudioLoom Data Architecture v2 — Full Entity Hierarchy
**Created: 29 March 2026**
**Purpose: Map every entity level, identify missing fields, and future-proof the schema before building more units.**

This document maps the complete data hierarchy from school down to individual lesson blocks, identifies what we have vs what we need, and recommends fields to add NOW (even if the UI comes later) so that units built today are fully compatible with future features like inclusivity, multilingual support, and student intelligence.

---

## The Full Hierarchy (8 Levels)

```
SCHOOL (future — not yet built)
└── TEACHER
    └── CLASS (carries: framework, subject, grade_level, term)
        └── CLASS_UNIT junction (carries: per-class overrides, scheduling, NM config)
            └── UNIT (carries: content template, unit_type, curriculum_context)
                └── PAGE / LESSON (carries: workshop phases, timing, learning goal)
                    └── ACTIVITY / BLOCK (carries: prompt, response type, scaffolding, AI rules)
                        └── STUDENT RESPONSE (carries: content, integrity metadata, timestamps)
```

Each level adds context. AI reads UP the chain to generate and mentor. Student data writes DOWN from responses into intelligence profiles.

---

## Level 0: SCHOOL (Future — Not Yet Built)

**What it is:** The organizational container. A school has teachers, a timetable structure, shared settings, and potentially shared curriculum resources.

**Current state:** Does NOT exist as an entity. Teacher profiles store `school_name` and `country` as flat text. No school-level shared configuration.

**What it should have (when built):**

| Field | Type | Purpose | Priority |
|-------|------|---------|----------|
| `id` | UUID | Primary key | Future |
| `name` | TEXT | School name | Future |
| `country` | TEXT | For localisation, regulatory compliance | Future |
| `timezone` | TEXT | For scheduling, deadlines | Future |
| `default_framework` | TEXT | School-wide default (IB_MYP, GCSE_DT, etc.) | Future |
| `supported_frameworks` | TEXT[] | Which frameworks this school uses | Future |
| `academic_year_pattern` | TEXT | "northern" (Sep-Jun) / "southern" (Feb-Dec) / "calendar" (Jan-Dec) | Future |
| `default_language` | TEXT | Primary instruction language (ISO 639-1) | Future |
| `supported_languages` | TEXT[] | Languages available for content | Future |
| `inclusivity_policy` | JSONB | School-wide accommodation defaults | Future |
| `branding` | JSONB | Logo, colors, custom terminology | Future |
| `subscription_tier` | TEXT | Free / School / Enterprise | Future |

**Decision:** Don't build this yet. When we do, add `school_id` FK to `teachers` table. For now, `teacher_profiles.school_context` JSONB handles the school-level data adequately for a single-teacher product.

---

## Level 1: TEACHER

**Current state:** `teachers` table (id, name, email) + `teacher_profiles` (school_context JSONB, teacher_preferences JSONB). Thin. The profile does more heavy lifting than the table.

**What exists:**
- Basic identity (name, email, Supabase auth)
- School context (school_name, country, curriculum_framework, period_minutes, workshop_space, equipment)
- Teaching preferences (learned passively from uploads/edits/generation requests)
- Style profile (confidence level, editing frequency, scaffold preference, critique intensity)

**What's missing — ADD NOW:**

| Field | Type | Where | Purpose | Migration |
|-------|------|-------|---------|-----------|
| `preferred_language` | TEXT | teacher_profiles | Teacher's UI language. ISO 639-1 code. Default 'en' | 057 |
| `content_languages` | TEXT[] | teacher_profiles | Languages teacher creates content in. Default ['en'] | 057 |

**Rationale:** Multilingual prep. When we add content translation later, we need to know what languages the teacher works in. Adding as JSONB fields inside `teacher_profiles.school_context` is fine — no migration needed, just expand the JSONB.

---

## Level 2: CLASS

**Current state:** `classes` table with name, code, framework, subject, grade_level, academic_year, is_archived, LMS external IDs.

**What exists:**
- Identity (name, code, teacher_id)
- Framework (IB_MYP, GCSE_DT, IGCSE_DT, A_LEVEL_DT, ACARA_DT, PLTW) — drives criteria + grading scale
- Subject, grade_level, academic_year
- Archive flag
- LMS integration (external_class_id, external_provider, last_synced_at)

**What's missing — ADD NOW:**

| Field | Type | Purpose | Priority |
|-------|------|---------|----------|
| `instruction_language` | TEXT | Primary language content is delivered in. ISO 639-1. Default 'en' | **NOW** |
| `additional_languages` | TEXT[] | Additional languages students may need support in | **NOW** |
| `inclusivity_defaults` | JSONB | Class-wide accessibility settings (font size, contrast, read-aloud). Inherited by all students unless overridden | PREP |
| `class_size` | INTEGER | Number of enrolled students. Auto-computed or manual. Used for resource planning, group formation | PREP |
| `programme` | TEXT | IB programme type: 'MYP' / 'DP' / 'PYP' / 'CP' / null. Separate from framework (framework = assessment system, programme = pedagogical approach) | PREP |

**Decision (29 Mar 2026): Keep framework and programme together.** The current `framework` field implicitly drives both grading and pedagogy, which is correct for 95%+ of real schools (MYP schools grade MYP-style AND teach MYP-style). The "teach MYP, grade GCSE" edge case exists but is too rare to justify the added complexity for a product with 0 users. If this becomes a real need later, add `programme` as an optional override column — zero breaking change. YAGNI.

`instruction_language` and `additional_languages` are the critical ones to add now. Even if we don't build the multilingual UI yet, recording the language means AI can adapt prompts (simpler vocab for EAL classes, bilingual sentence starters, etc.).

---

## Level 3: UNIT TYPE (Above Unit, Conceptual)

**Current state:** `unit_type` TEXT on `units` table: "design" | "service" | "personal_project" | "inquiry". Drives AI persona, criteria, wizard questions, extensions.

**What exists:**
- 4 types with per-type criteria definitions (`getCriteriaForType()`)
- Type-specific wizard turns (`buildTurns(unitType)`)
- Type-specific AI generation context (`buildTypeSpecificContext()`)
- Type-specific activity phase enums

**What's missing — CONSIDER:**

| Field | Type | Purpose | Priority |
|-------|------|---------|----------|
| `unit_type_metadata` | JSONB on units | Type-specific metadata that varies by type. Service: `{ community_context, sdg_connection, service_outcomes, partner_type }`. PP: `{ personal_interest, goal_type, presentation_format }`. Inquiry: `{ central_idea, transdisciplinary_theme, lines_of_inquiry }` | PREP |

**Decision:** This already partially exists in `content_data` via the wizard input fields. But it's buried inside JSONB and not queryable. Adding a top-level `unit_type_metadata` JSONB on `units` would make it searchable (e.g., "show me all Service units connected to SDG 13"). Low priority but architecturally clean.

---

## Level 4: UNIT (Content Template)

**Current state:** `units` table with content_data JSONB, unit_type, curriculum_context, versions, thumbnail, and standard metadata.

**What exists:**
- Content template (JSONB with 4 version formats, normalized via `normalizeContentData()`)
- Unit type + curriculum context
- Version history (unit_versions table)
- Publishing/repository fields (is_published, tags, grade_level, duration_weeks)
- MYP-specific (global_context, key_concept, topic)
- Forking (fork_count, forked_from)

**What's missing — ADD NOW:**

| Field | Type | Purpose | Priority |
|-------|------|---------|----------|
| `content_language` | TEXT | Language the content is written in. Default 'en'. Needed for future translation | **NOW** |
| `inclusivity_notes` | JSONB | Unit-level accessibility considerations. `{ physical_requirements: ["standing", "fine_motor"], sensory_notes: ["loud_workshop", "strong_smells"], alternative_activities: true }` | **NOW** |
| `materials_list` | JSONB | Materials needed for this unit. `[{ name, quantity_per_student, unit_cost, category: "consumable"|"tool"|"digital", alternatives: [] }]` | **NOW** |
| `prerequisite_knowledge` | TEXT[] | What students should know before starting. Human-readable strings | PREP |
| `learning_outcomes` | JSONB | Explicit outcomes beyond criteria. `[{ outcome: "Students can identify user needs", bloom_level: "analyze", measurable: true }]` | PREP |
| `estimated_total_hours` | FLOAT | Total student time including homework. Computed from lessons + extensions | PREP |
| `sdg_tags` | TEXT[] | UN Sustainable Development Goals (1-17). For Service/PP types especially | PREP |
| `cross_curricular_links` | TEXT[] | Subjects this unit connects to ("Mathematics", "Science", "English") | PREP |
| `differentiation_notes` | TEXT | Teacher notes on how to differentiate this unit | PREP |

**Rationale for NOW items:**
- `content_language`: Without this, we can't build translation features later. Every unit needs to know what language it's in.
- `inclusivity_notes`: If a unit requires standing at a workbench or involves loud machines, students with physical disabilities or sensory sensitivities need to know. This data drives automatic accommodation suggestions.
- `materials_list`: Already identified as needed (see CLAUDE.md "materials on content_data not separate table" decision). Structured JSONB enables purchasing aggregation, alternative suggestions, and per-class overrides via forking.

---

## Level 5: PAGE / LESSON

**Current state:** Pages are objects inside `content_data.pages[]` JSONB. Each page has id, type, criterion, strandIndex, title, and a content object with sections, workshopPhases, extensions, reflection, vocabWarmup, introduction.

**What exists:**
- Identity (id: nanoid(8), type, title)
- MYP criterion mapping (criterion tag, strandIndex)
- Workshop Model phases (opening, miniLesson, workTime, debrief with durations)
- Extensions (2-3 per lesson with designPhase)
- Vocabulary warm-up (terms with definitions + examples)
- Introduction text
- Reflection items
- Sections/activities array (see Level 6)
- Learning goal

**What's missing — ADD NOW (inside content_data page objects):**

| Field | Path in JSONB | Type | Purpose | Priority |
|-------|---------------|------|---------|----------|
| `inclusivity` | `page.content.inclusivity` | Object | Per-lesson accessibility. `{ physical_demands: "low"|"medium"|"high", noise_level: "quiet"|"moderate"|"loud", movement_required: boolean, fine_motor_required: boolean, alternative_provided: boolean, sensory_warnings: string[] }` | **NOW** |
| `language_supports` | `page.content.language_supports` | Object | `{ key_vocabulary_translated: { [lang]: { term: string, definition: string }[] }, simplified_instructions: string, visual_instructions_url: string }` | PREP |
| `teacher_notes` | `page.content.teacher_notes` | String | Private teacher notes (not shown to students). Teaching tips, common misconceptions, timing adjustments from experience | **NOW** |
| `success_criteria` | `page.content.success_criteria` | String[] | What "good" looks like for this lesson. Student-facing. "I can explain the problem from 2 user perspectives" | **NOW** |
| `grouping_strategy` | `page.content.grouping_strategy` | String | "individual" / "pairs" / "small_group" / "whole_class" / "mixed". Drives AI group formation suggestions | PREP |
| `resources` | `page.content.resources` | Array | `[{ type: "link"|"file"|"video"|"image", url, title, required: boolean }]`. Lesson-specific resources | PREP |
| `assessment_type` | `page.content.assessment_type` | String | "formative" / "summative" / "diagnostic" / "peer" / "self". Already partially exists in page_settings on class_units but should also be on the content template | PREP |
| `homework` | `page.content.homework` | Object | `{ description, estimated_minutes, due: "next_class"|"end_of_week"|"custom" }`. Homework/extension work for outside class | PREP |

**Critical insight about inclusivity at page level:** This is where Matt's "project inclusive" vision lives. Every lesson should declare its physical/sensory demands so the system can:
1. Auto-flag lessons that need adaptation for specific students (from their learning_profile)
2. Suggest alternative activities when a student can't do the original
3. Alert the teacher: "Lesson 3 requires fine motor skills — Anika has noted motor difficulties in her profile"

This doesn't require building the full inclusivity UI now. Just adding the JSONB fields to the content_data structure means AI can start generating these fields, and they'll be there when we build the student-facing accommodations.

---

## Level 6: ACTIVITY / BLOCK (The Atomic Unit)

**Current state:** Activities are objects inside `page.content.sections[]`. Each has prompt, responseType, criterionTags, durationMinutes, scaffolding, exampleResponse, portfolioCapture, activityId, media, links, contentStyle, toolId, toolChallenge.

**What exists:**
- Identity (activityId: stable nanoid)
- Prompt text
- Response type (15+ types: text, upload, voice, canvas, decision-matrix, pmi, toolkit-tool, etc.)
- Duration estimate
- Criterion tags
- 3-tier ELL scaffolding (ell1/ell2/ell3 with sentence starters, hints, extension prompts)
- Example response
- Portfolio capture flag
- Media attachments (image, video)
- Links
- Content style (info, warning, tip, context, activity, speaking, practical)
- Toolkit tool integration (toolId, toolChallenge)

**What's missing — ADD NOW (inside section objects):**

| Field | Type | Purpose | Priority |
|-------|------|---------|----------|
| `timeWeight` | String | "quick" / "moderate" / "extended" / "flexible". Replaces rigid `durationMinutes` as primary time signal. Phase time distributed proportionally by weight. See "Time Model" section below | **NOW** |
| `bloom_level` | String | "remember" / "understand" / "apply" / "analyze" / "evaluate" / "create". Drives AI scaffolding depth and complexity of prompts | **NOW** |
| `inclusivity` | Object | `{ alternative_response_types: ["voice", "upload", "canvas"], requires_fine_motor: boolean, requires_reading: boolean, requires_writing: boolean, visual_support_available: boolean, audio_support_available: boolean }` | **NOW** |
| `grouping` | String | "individual" / "pair" / "small_group" / "whole_class". Who does this activity | **NOW** |
| `ai_rules` | Object | `{ phase: "divergent"|"convergent"|"neutral", tone: string, rules: string[], forbidden_words: string[] }`. Currently hardcoded per-tool in API routes. Making this data means ANY activity can have custom AI rules, not just toolkit tools | **CRITICAL** |
| `success_look_fors` | String[] | Observable behaviors the teacher watches for. "Student sketches at least 3 options" / "Student interviews 2+ people" | PREP |
| `differentiation` | Object | `{ extension: string, support: string, challenge: string }`. Three-level differentiation beyond ELL. Extension for advanced, support for struggling, challenge for engaged | PREP |
| `tags` | String[] | Searchable tags for the activity block library. "interview", "research", "hands-on", "reflection" | PREP |
| `reusable` | Boolean | Whether this block should appear in the activity block library for drag-and-drop into other lessons | PREP |
| `estimated_word_count` | Integer | Expected response length. Drives effort-gating thresholds dynamically instead of hardcoded 12 words | PREP |

**The `ai_rules` field is the most important addition.** Right now, per-step AI rules are hardcoded in API routes for each toolkit tool (SCAMPER has 7 rule sets, Six Hats has 6, PMI has 3, etc.). But the lesson editor can't create activities with custom AI rules — only toolkit tools have them. If `ai_rules` is part of the activity schema, then:
1. Teachers can customise AI behavior per activity in the lesson editor
2. AI generation can set appropriate rules per activity (divergent during brainstorm, convergent during evaluation)
3. The Design Assistant reads `ai_rules` from the current activity and adapts its mentoring
4. Activity blocks become truly portable — their AI personality travels with them

---

## Level 7: STUDENT RESPONSE

**Current state:** Responses stored in `student_progress.responses` JSONB, keyed by `activity_<activityId>`. Each response has type, content, submittedAt. Integrity metadata optionally stored alongside.

**What exists:**
- Response content (text, file URL, structured data for decision-matrix/PMI/etc.)
- Submission timestamp
- Integrity metadata (paste events, keystroke patterns, focus loss, typing speed)
- Time spent (at page level, not activity level)

**What's missing — ADD NOW (inside response objects):**

| Field | Type | Purpose | Priority |
|-------|------|---------|----------|
| `time_spent_seconds` | Integer | Per-ACTIVITY time, not just per-page. Critical for identifying where students struggle | **NOW** |
| `attempt_number` | Integer | Which attempt this is (1 = first try, 2 = revision). Tracks iteration | **NOW** |
| `revision_history` | Array | `[{ content, timestamp, word_count }]`. Track how the response evolved. Max 10 snapshots | PREP |
| `ai_interactions` | Integer | How many AI nudges the student received on this activity | PREP |
| `effort_signals` | Object | `{ meaningful_word_count, reasoning_markers, specificity_score, revision_count }`. Computed client-side, stored for analytics | PREP |
| `self_assessment` | Object | `{ confidence: 1-5, difficulty: 1-5, satisfaction: 1-5 }`. Quick student self-report per activity (optional, not every activity) | FUTURE |
| `peer_feedback_received` | Array | `[{ reviewer_id, feedback, timestamp }]`. From Gallery reviews linked back to specific activities | FUTURE |

**Per-activity `time_spent_seconds` is critical.** Right now we only know total page time. If a page has 4 activities and a student spends 45 minutes, we don't know if they spent 40 minutes on activity 1 (struggling) and 5 minutes on the rest (rushing), or evenly distributed. Per-activity timing drives:
- Struggle detection ("Anika spent 3x average on the research activity")
- Timing model improvement (actual vs estimated duration per activity type)
- Teacher alerts ("5 students are stuck on Activity 2 for >15 minutes")

---

## Level 8: STUDENT PROFILE (Cross-Cutting)

**Current state:** Distributed across multiple sources: `students` table (learning_profile JSONB, mentor_id, theme_id, ell_level), `discovery_sessions` (archetype, interests, fears), `student_tool_sessions` (tool usage patterns), `student_progress` (response patterns), `competency_assessments` (NM ratings).

**What exists:**
- Learning profile intake (languages, confidence, working style, learning differences)
- Discovery profile (archetype, strengths, interests, needs, fears, project statement)
- Studio preferences (mentor, theme)
- ELL level (1-3)
- Graduation year

**What's missing — ADD NOW:**

| Field | Where | Type | Purpose | Priority |
|-------|-------|------|---------|----------|
| `accommodations` | students.learning_profile JSONB | Object | UDL-aligned barriers + supports. `{ engagement: [], representation: [], action_expression: [], specific_needs: [] }`. Teacher-entered, framed as "what support does this student need" not "what disability do they have" | **NOW** |
| `communication_preferences` | students.learning_profile JSONB | Object | `{ preferred_feedback: "written"|"verbal"|"visual", response_preference: "typing"|"speaking"|"drawing", needs_processing_time: boolean }` | **NOW** |
| `home_languages` | students.learning_profile JSONB | String[] | Already partially exists as `languages_at_home`. Standardise to ISO 639-1 codes for future translation matching | **NOW** |
| `intelligence_profile` | students (new column) | JSONB | Unified profile synthesised from all sources. Updated incrementally via exponential moving average. AI reads this for mentoring | PHASE 3.5 |
| `risk_level` | students (new column) | TEXT | "low" / "medium" / "high". Auto-computed from engagement signals. Drives teacher alerts | PHASE 4 |

**The inclusivity data model is the heart of "project inclusive."** It follows the UDL (Universal Design for Learning) framework — a 3-principle × 3-layer grid from CAST (udlguidelines.cast.org):

**3 UDL Principles:**
- **Engagement** (the WHY — green) — how we motivate and sustain effort
- **Representation** (the WHAT — purple) — how we present information
- **Action & Expression** (the HOW — blue) — how students demonstrate learning

**3 Layers per principle (9 guidelines total, each with numbered checkpoints):**
- **Access** (top layer): Welcoming Interests (7), Perception (1), Interaction (4)
- **Support** (middle): Effort & Persistence (8), Language & Symbols (2), Expression & Communication (5)
- **Executive Function** (bottom): Emotional Capacity (9), Building Knowledge (3), Strategy Development (6)

**Why UDL over IEP-style 4-category accommodations:** UDL is about proactively DESIGNING learning experiences that work for everyone from the start. IEP accommodations (Presentation/Response/Environment/Timing) are reactive — they adapt after the fact for individual students with documented needs. StudioLoom should do both: UDL at the design level (AI generates inclusive lessons) + individual accommodations for students who need specific support.

**How it maps to StudioLoom's existing features:**
- Multiple response types (text/upload/voice/canvas/toolkit) = Action & Expression checkpoint 5.1, 5.2
- Effort-gating + sentence starters = Sustaining Effort checkpoint 8.2, 8.5
- 3-tier ELL scaffolding = Language & Symbols checkpoint 2.1
- Discovery Engine profiling = Welcoming Interests checkpoint 7.1
- Workshop Model with varied phases = Perception checkpoint 1.2
- Toolkit tools with different interaction shapes = Expression checkpoint 5.2
- Open Studio self-direction = Strategy Development checkpoint 6.1

**Data model — two layers:**

1. **UDL coverage (on activities + pages):** `udl_checkpoints: ["5.1", "8.2", "2.1"]` — which UDL checkpoints this activity addresses. AI auto-tags during generation. Teachers see coverage gaps ("this lesson has no Engagement → Executive Function activities").

2. **Individual accommodations (on students):** Still useful for specific student needs (extra time, alternative response types, sensory sensitivities). Stored in `learning_profile.accommodations` JSONB. Structured as UDL barriers rather than disability labels: "this student needs extra support on Representation → Language & Symbols" rather than "this student has dyslexia."

When a student has `accommodations` that flag a need, and an activity's `udl_checkpoints` + `inclusivity` metadata show a gap, the system can automatically suggest alternatives or alert the teacher.

---

## The UDL Inclusivity Pipeline (How It All Connects)

```
TEACHER sets:
  → Student-level UDL barriers + supports (student.learning_profile.accommodations)
  → Class-wide inclusivity context (class.inclusivity_defaults — optional)

AI GENERATES (during unit/lesson creation):
  → Per-lesson inclusivity metadata (page.content.inclusivity — physical/sensory demands)
  → Per-lesson UDL coverage map (page.content.udl_coverage — which principles are hit)
  → Per-activity UDL checkpoint tags (section.udl_checkpoints — auto-tagged)
  → Per-activity alternative paths (section.inclusivity — alt response types)
  → UDL gap warnings when a lesson misses an entire principle

AI ADAPTS (during student interaction):
  → Design Assistant reads student's udl_barriers and adjusts scaffolding
  → Effort-gating thresholds adapt based on student accommodations
  → Language complexity adjusts based on representation barriers

TEACHER SEES:
  → UDL coverage indicator per lesson (3-dot or 3-bar showing Engagement/Representation/Action coverage)
  → Gap alerts: "Lesson 3 has no Engagement checkpoints — consider adding choice or collaboration"
  → Student match warnings: "Anika needs Representation support (2.1) — this lesson's activities all require reading"

TRACKING (over time):
  → Which UDL checkpoints appear most/least across a unit
  → Which accommodations were activated per student
  → Whether students with barriers showed improved engagement when UDL-rich lessons were delivered
  → Accommodation usage patterns for reporting to parents/learning support
```

---

## The Multilingual Pipeline (How It All Connects)

```
TEACHER sets:
  → Class instruction language (class.instruction_language)
  → Student home languages (student.learning_profile.home_languages)
  → Unit content language (unit.content_language)

AI GENERATES:
  → Scaffolding in student's language when ELL level warrants it
  → Bilingual vocabulary (page.content.language_supports.key_vocabulary_translated)
  → Simplified instructions for EAL students

AT RUNTIME:
  → UI language = student preference (from onboarding theme/settings)
  → Content language = unit's content_language
  → Scaffolding language = adaptive (AI detects when student needs L1 support)
  → Vocabulary tooltips show L1 translation on hover

FUTURE:
  → Full content translation (unit template exists in English, AI generates Mandarin version)
  → Translation stored per class fork (class in China gets Mandarin content_data)
  → Teacher reviews and approves AI translations before publishing
```

---

## The Time Model (How Time Works Across Levels)

**Core principle: estimate complexity, measure actuals, compute velocity.**

Rigid `durationMinutes: 12` on activities is the wrong abstraction. The same activity takes 8 minutes with Year 10 and 20 minutes with Year 7. Teachers don't plan by the minute — they plan by "this is a quick thing" vs "this is the meaty part." Time is contextual, not fixed.

**What other systems do (and why they're wrong):**
- Canvas/Google Classroom: just due dates, no within-lesson time → teachers get no help
- ManageBac/Toddle: unit date ranges on a planner, nothing below lesson level → no activity awareness
- Khan Academy: "estimated time" labels per exercise → a number that's always wrong
- Agile/Scrum: story points (deliberate abstraction away from hours) + velocity → **this is the right pattern**

### Time at each level:

| Level | What to store | How it works | Stored where |
|-------|--------------|--------------|-------------|
| **Year** | Nothing — computed | Total available lessons = term dates + timetable + cycle engine | Derived from `school_calendar_terms` + `class_meetings` |
| **Unit** | `planned_lesson_count` (soft) | Teacher's intent for how many lessons this unit gets. Cycle engine maps to dates. | `class_units.planned_lesson_count` (future year planner) |
| **Lesson** | Workshop phase budgets (hard) | Period length - transitions = usable time. 4 phases divide usable time. Teacher drags PhaseTimelineBar. | `page.content.workshopPhases` (existing) |
| **Activity** | `timeWeight` (primary) + `durationMinutes` (optional soft hint) | Weight drives proportional allocation within the Workshop phase. quick=1x, moderate=2x, extended=4x, flexible=fills remaining. | `section.timeWeight` + `section.durationMinutes` (inside content_data) |
| **Response** | `time_spent_seconds` (actual measurement) | IntersectionObserver starts timer when activity visible, stops on next activity or page submit. Cap at 3600s. | `student_progress.responses[activityId].time_spent_seconds` |

### timeWeight explained:

```
quick     = ~5 min equivalent (warm-up, check-in, vocab review, transition)
moderate  = ~10-15 min equivalent (a focused task, short research, peer discussion)
extended  = ~20+ min equivalent (the main hands-on work, deep making, studio time)
flexible  = fills available time (open-ended making, project work — expands to fit)
```

These are NOT hard durations. They are **relative weights** for proportional time allocation within a Workshop Model phase. The PhaseTimelineBar uses them to suggest how time distributes across activities in Work Time:

```
Example: Work Time phase = 30 minutes, 3 activities:
  Activity A (moderate, weight 2) → suggested 10 min
  Activity B (extended, weight 4) → suggested 20 min

Example: Work Time phase = 30 minutes, 2 activities:
  Activity A (quick, weight 1) → suggested 6 min
  Activity B (flexible, fills rest) → suggested 24 min
```

`durationMinutes` is KEPT as an optional field — the AI can still output a number ("this should take about 12 minutes") and the PhaseTimelineBar can display it. But it's a suggestion, not a constraint. Teachers who want exact minutes can set them; teachers who don't can rely on weights.

### The velocity learning loop:

```
COLD START (first unit with a new class):
  → AI uses default timing from docs/timing-reference.md
  → timeWeight "moderate" = ~10 min (global default)
  → Teacher sees "~8 lessons (low confidence — using defaults)" on year planner

AFTER 1-2 UNITS:
  → System has per-activity time_spent_seconds from student responses
  → Aggregates: "this class averages 14 min on research activities, 8 min on reflection"
  → Class velocity profile stored as JSONB (on classes or class_units table)

AFTER 3+ UNITS:
  → AI generation reads class velocity profile
  → "moderate research activity" = ~14 min for THIS class (not default 10)
  → Unit lesson count predictions become accurate
  → Teacher sees "~12 lessons (high confidence — based on 3 similar units)"

CONTINUOUS:
  → Every completed lesson updates the class velocity profile
  → Exponential moving average (α=0.3) — recent data weighted more
  → Teacher pace feedback (🐢👌🏃) acts as manual correction signal
  → Velocity profile is per activity TYPE per class (not global)
```

### What this replaces:

**Before (rigid):** AI generates "Activity: Research user needs (12 min)" → teacher ignores the number → no feedback loop

**After (contextual):** AI generates "Activity: Research user needs (moderate, ~12 min suggested)" → student actually spends 18 min → system learns "research activities with this class take ~18 min" → next unit adjusts → teacher sees prediction improving over time

### Backward compatibility:

- Old activities with `durationMinutes` but no `timeWeight` → PhaseTimelineBar renders as before (fixed minutes)
- Old activities with neither → default to `timeWeight: "moderate"`
- New activities with `timeWeight` but no `durationMinutes` → PhaseTimelineBar computes suggested minutes from weight × phase budget
- No migration needed — both fields are optional inside content_data JSONB

---

## Technical Load — The Hidden Cognitive Layer

**Added: 1 April 2026. Origin: Matt's observation that students struggle in design because they simultaneously manage time, resources, new tech/software, AND being a student.**

In design education, students aren't just learning design thinking — they're often learning to use unfamiliar tools at the same time. An Arduino lesson requires understanding Young's Modulus (content), wiring a circuit (hardware skill), reading a serial plotter (software skill), calibrating an FSR (technique), AND applying the engineering design process (design thinking). That's 5 layers of novelty in one activity. The cognitive overhead of managing unfamiliar tools and materials is invisible in the current data model.

**This is NOT a Pulse dimension** — Pulse measures lesson design quality (did the teacher structure it well?). Technical load is a **lesson context variable** that modifies how Pulse interprets scores and how the timing engine allocates time.

### What `technical_load` captures:

| Field | Type | Example |
|-------|------|---------|
| `new_tools` | String[] | Tools/tech introduced for the FIRST TIME: `["Arduino Uno", "Serial Plotter"]` |
| `assumed_skills` | String[] | Prerequisites students must already have: `["basic circuit wiring", "reading graphs"]` |
| `novelty` | Enum | `none` / `low` (familiar tool, new context) / `medium` (new tool, guided) / `high` (new tool AND new technique) |
| `scaffolding_provided` | Enum | `none` / `demo` (teacher shows once) / `guide` (FAQ/cheat sheet) / `tutorial` (step-by-step with checkpoints) |

### How it connects to existing systems:

**1. Timing engine modifier:**
Activities with high technical novelty need significantly more Work Time than the same activity with familiar tools. The velocity learning loop should track `technical_load.novelty` as a covariate: "research activities take 14 min average, but research activities with `novelty: high` take 22 min." This means the first time a class uses a 3D printer, the system allocates more time than the fifth time.

**2. Teacher Craft scaffolding sub-score (Pulse):**
If an activity has `novelty: high` but `scaffolding_provided: none`, that's a Teacher Craft gap — the teacher introduced complex technology without support. Pulse should flag: "Activity 3 introduces Arduino with no technical scaffolding." Conversely, `novelty: high` + `scaffolding_provided: tutorial` is good teaching — Pulse should not penalise.

**3. Cross-lesson balancing:**
The generation pipeline should track cumulative technical novelty across a unit. Don't introduce Arduino AND 3D printing AND laser cutting in the same week. If lesson N has `novelty: high`, lesson N+1 should default to familiar tools unless the teacher overrides. Prompt injection: "The previous lesson introduced [new_tools]. This lesson should use familiar tools to let students focus on the design thinking."

**4. Materials list connection:**
`materials_list` on units already captures WHAT students use. `technical_load.new_tools` captures which of those materials require NEW LEARNING. The difference matters: scissors are in the materials list but have zero technical novelty for Year 9 students. A CNC router is in the materials list AND has high technical novelty.

**5. Student struggle detection:**
When `useActivityTracking` reports `time_spent_seconds` 3x above class average on an activity with `novelty: high`, the system can distinguish "student is struggling with the TOOL" (technical barrier) from "student is struggling with the THINKING" (cognitive barrier). Different interventions: technical struggle → show demo video or FAQ. Thinking struggle → Socratic AI nudge.

### Where `assumed_skills` data comes from:

Phase 1 (now): AI generation infers from materials list + activity description. "Uses Arduino Uno" → `assumed_skills: ["basic circuit wiring", "can read serial plotter"]`.

Phase 2 (future): Teacher edits in lesson editor — the `technical_load` section appears alongside UDL and AI Rules on the activity block. Teachers know what their students can and can't do.

Phase 3 (future): Cross-unit tracking. If Unit 1 introduced Arduino and students demonstrated competency, Unit 3 can mark Arduino as `novelty: none` (assumed skill). The system builds a class-level "tool competency map" that grows over the year.

### Implementation priority:

- `technical_load` field on ActivitySection: **Phase 5** (add to interface + generation schemas)
- AI generation populates it: **Phase 5** (prompt instruction: "For each activity, assess what tools/tech are new to students")
- Timing engine reads it: **Phase 5** (velocity loop covariate)
- Lesson editor UI for it: **Phase 5** (alongside UDL tab on ActivityBlock)
- Cross-unit tool competency tracking: **FUTURE** (requires class-level tool_competencies JSONB)
- Pulse scaffolding modifier: **FUTURE** (after Pulse Phase 1 ships)

---

## Student Tracking Signals (What to Capture)

### Passive Signals (Captured Automatically — No Student Action Required)

| Signal | Where Captured | Current State | Impact |
|--------|---------------|---------------|--------|
| Time on page | student_progress.time_spent | ✅ Exists (page level) | Struggle detection |
| Time on activity | response.time_spent_seconds | ❌ **ADD NOW** | Per-activity struggle detection |
| Submission velocity | student_progress.updated_at vs page_due_dates | ✅ Computable | Procrastination detection |
| Revision count | response.attempt_number | ❌ **ADD NOW** | Iteration tracking |
| Writing behavior | integrity_metadata | ✅ Exists | Academic integrity |
| AI interaction count | response.ai_interactions | ❌ ADD LATER | Help-seeking pattern |
| Tool session versions | student_tool_sessions.version | ✅ Exists | Iteration tracking |
| Discovery archetype | discovery_sessions.profile_data | ✅ Exists | Learning style |
| Pace feedback | lesson_feedback.feedback_data.pace | ✅ Exists | Timing model |
| Open Studio drift | open_studio_sessions.drift_flags | ✅ Exists | Self-direction capacity |
| Open Studio productivity | open_studio_sessions.productivity_score | ✅ Exists | Work quality |
| Gallery review quality | gallery_reviews.review_data | ✅ Exists | Critique skill |
| NM self-assessment | competency_assessments (student_self) | ✅ Exists | Metacognition |
| Login frequency | student_sessions.created_at | ✅ Computable | Engagement |

### Teacher Alert Triggers (Derived from Passive Signals)

| Alert | Trigger | Priority |
|-------|---------|----------|
| "Struggling on activity" | time_spent > 2× class average on same activity | **NOW** (Teaching Mode already has "Needs Help" at 3min) |
| "Rushing through work" | time_spent < 0.3× estimated duration AND low word count | **NOW** |
| "Possible integrity concern" | human_confidence_score < 40 | ✅ Exists |
| "Declining engagement" | 3+ consecutive sessions with decreasing time_spent | PREP |
| "Hasn't started" | 0 responses 2+ days after class | PREP |
| "Stuck in one phase" | All recent work in same design criterion, no progression | PREP |
| "High effort, low score" | Strong effort signals but criterion scores declining | PREP |
| "Peer review needed" | Completed own work but 0 gallery reviews submitted | ✅ Exists (gallery) |

---

## Migration Plan

### Migration 057 — Data Architecture Future-Proofing

**Fields to add NOW (before more units are built):**

```sql
-- On units table
ALTER TABLE units ADD COLUMN IF NOT EXISTS content_language TEXT DEFAULT 'en';
ALTER TABLE units ADD COLUMN IF NOT EXISTS inclusivity_notes JSONB DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS materials_list JSONB DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS learning_outcomes JSONB DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS sdg_tags TEXT[] DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS cross_curricular_links TEXT[] DEFAULT NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS prerequisite_knowledge TEXT[] DEFAULT NULL;

-- On classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS instruction_language TEXT DEFAULT 'en';
ALTER TABLE classes ADD COLUMN IF NOT EXISTS additional_languages TEXT[] DEFAULT NULL;
-- NOTE: programme column DEFERRED (29 Mar 2026 decision: keep framework/programme together for now)
```

**Fields to add inside content_data JSONB (no migration needed — just expand the schema):**

These are added to TypeScript interfaces and AI generation prompts. Existing content_data without these fields is fine — they default to null/undefined.

```typescript
// Add to PageContent interface
interface PageContent {
  // ... existing fields ...
  inclusivity?: {
    physical_demands: 'low' | 'medium' | 'high';
    noise_level: 'quiet' | 'moderate' | 'loud';
    movement_required: boolean;
    fine_motor_required: boolean;
    alternative_provided: boolean;
    sensory_warnings: string[];
  };
  udl_coverage?: {
    engagement: string[];       // UDL checkpoints hit (e.g., ["7.1", "8.2"])
    representation: string[];   // e.g., ["1.2", "2.1"]
    action_expression: string[]; // e.g., ["5.1", "5.2"]
    gaps: string[];             // Principles with 0 checkpoints — teacher can see what's missing
  };
  teacher_notes?: string;
  success_criteria?: string[];
  grouping_strategy?: 'individual' | 'pairs' | 'small_group' | 'whole_class' | 'mixed';
  language_supports?: {
    key_vocabulary_translated?: Record<string, { term: string; definition: string }[]>;
    simplified_instructions?: string;
  };
  assessment_type?: 'formative' | 'summative' | 'diagnostic' | 'peer' | 'self';
  resources?: { type: string; url: string; title: string; required: boolean }[];
  homework?: { description: string; estimated_minutes: number; due: string };
}

// Add to ActivitySection interface
interface ActivitySection {
  // ... existing fields ...
  durationMinutes?: number;  // NOW OPTIONAL — soft suggestion only, not authoritative
  timeWeight?: 'quick' | 'moderate' | 'extended' | 'flexible';  // PRIMARY time signal
  bloom_level?: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
  inclusivity?: {
    alternative_response_types: ResponseType[];
    requires_fine_motor: boolean;
    requires_reading: boolean;
    requires_writing: boolean;
    visual_support_available: boolean;
    audio_support_available: boolean;
  };
  grouping?: 'individual' | 'pair' | 'small_group' | 'whole_class';
  ai_rules?: {
    phase: 'divergent' | 'convergent' | 'neutral';
    tone: string;
    rules: string[];
    forbidden_words?: string[];
  };
  udl_checkpoints?: string[];  // UDL guideline checkpoints this activity addresses (e.g., ["5.1", "8.2", "2.1"])
  success_look_fors?: string[];
  differentiation?: {
    extension: string;
    support: string;
    challenge: string;
  };
  tags?: string[];
  reusable?: boolean;
  estimated_word_count?: number;
  technical_load?: {
    new_tools: string[];              // Tools/tech introduced for the FIRST TIME in this activity (e.g., "Arduino Uno", "Fusion 360")
    assumed_skills: string[];         // Skills students must already have (e.g., "basic soldering", "can use a scroll saw")
    novelty: 'none' | 'low' | 'medium' | 'high';  // How much new technical learning is happening ON TOP of the design thinking
    scaffolding_provided: 'none' | 'demo' | 'guide' | 'tutorial';  // What support exists for the technical learning
  };
}

// Add to student response structure
interface ActivityResponse {
  // ... existing fields ...
  time_spent_seconds?: number;
  attempt_number?: number;
  effort_signals?: {
    meaningful_word_count: number;
    reasoning_markers: number;
    specificity_score: number;
    revision_count: number;
  };
}
```

**Expand learning_profile JSONB on students table (no migration — just expand the schema):**

```typescript
interface LearningProfile {
  // ... existing fields ...
  accommodations?: {
    // UDL-aligned support needs (framed as barriers, not diagnoses)
    engagement: AccommodationItem[];       // Motivation, self-regulation, persistence
    representation: AccommodationItem[];   // Perception, language, comprehension
    action_expression: AccommodationItem[]; // Physical, communication, executive function
    specific_needs: AccommodationItem[];   // Catch-all for IEP/504 items that don't map to UDL
  };
  udl_strengths?: string[];  // UDL checkpoints this student is STRONG at (e.g., "5.1", "7.3")
  udl_barriers?: string[];   // UDL checkpoints this student needs extra support on (e.g., "2.1", "8.2")
  communication_preferences?: {
    preferred_feedback: 'written' | 'verbal' | 'visual';
    response_preference: 'typing' | 'speaking' | 'drawing';
    needs_processing_time: boolean;
  };
  home_languages?: string[]; // ISO 639-1 codes
}

interface AccommodationItem {
  type: string;        // e.g., "extra_time", "text_to_speech", "movement_breaks"
  details: string;     // Human-readable description
  enabled: boolean;
  udl_checkpoint?: string; // Which UDL checkpoint this relates to (e.g., "2.1")
}
```

---

## What No LMS Does (StudioLoom's Unique Advantages)

Based on research across Canvas, ManageBac, Toddle, Moodle, Google Classroom, and Schoology:

1. **No platform treats accommodations as structured data** — they're all PDF documents attached to a student record. StudioLoom can match accommodations to activity requirements automatically.

2. **No platform has per-activity AI rules** — only StudioLoom adapts AI personality based on the specific step a student is on (divergent in ideation, convergent in evaluation).

3. **No platform tracks effort signals** — word count, reasoning markers, specificity are StudioLoom-only. This drives effort-gating, which is the core pedagogical differentiator.

4. **No platform enforces pedagogical structure** — Workshop Model is StudioLoom-only. Others trust teachers to structure lessons; StudioLoom validates and auto-repairs.

5. **No platform has keystroke-level integrity monitoring** — MonitoredTextarea is unique. Others rely on Turnitin (plagiarism detection), which is reactive not proactive.

6. **No platform synthesises passive signals into intelligence profiles** — all other platforms report raw data. StudioLoom aims to compute actionable student profiles from combined signals.

7. **No platform has discovery-based student profiling** — archetype scoring from behavioral scenarios is novel. Other platforms use self-report surveys.

8. **No platform tracks technical cognitive load** — when a student is slow on a task, no other platform can distinguish "struggling with the tool" from "struggling with the thinking." StudioLoom's `technical_load` field on activities, combined with per-activity `time_spent_seconds`, enables this distinction. Different root causes → different interventions.

---

## Decision Summary

### Add NOW (Migration 057 + TypeScript interface updates):
1. `content_language` on units — for future translation
2. `instruction_language` + `additional_languages` on classes — for multilingual AI
3. `inclusivity_notes` on units — for physical/sensory requirements
4. `materials_list` on units — for resource planning
5. Per-page `inclusivity`, `teacher_notes`, `success_criteria` in content_data
6. Per-activity `bloom_level`, `inclusivity`, `grouping`, `ai_rules` in content_data
7. Per-response `time_spent_seconds`, `attempt_number` in response JSONB
8. `accommodations` + `communication_preferences` in student learning_profile JSONB

### Add LATER (when building the feature):
- School entity (when multi-teacher)
- `programme` on classes (IF teaching approach ever needs to diverge from framework — decision: keep together for now)
- `intelligence_profile` on students (Phase 3.5)
- `risk_level` on students (Phase 4)
- `technical_load` on activities — per-activity tool/tech novelty tracking + scaffolding adequacy (Phase 5). See "Technical Load" section. Feeds timing engine, Pulse scaffolding modifier, cross-lesson balancing, struggle detection.
- Class-level `tool_competencies` JSONB — grows as students demonstrate competency with tools across units (FUTURE, after technical_load ships)
- xAPI statement export (enterprise feature)
- Full content translation pipeline
- Activity block library with `tags` and `reusable` flag
- Full UDL coverage UI (teacher-facing dashboard showing 3-principle coverage per unit)

### Don't Build Yet:
- School-level entity hierarchy (premature for single-teacher product)
- Full accommodation UI (add data layer now, build UI when we have students with IEPs)
- Multi-language content authoring (add fields now, build translation when we have non-English schools)
- Cross-unit competency synthesis (need more data first)

---

## UDL Guidelines Reference (CAST)

The full UDL framework for reference when tagging activities:

### Engagement (WHY — green)
- **Access:** 7.1 Choice & autonomy, 7.2 Relevance & authenticity, 7.3 Joy & play, 7.4 Address biases & threats
- **Support:** 8.1 Meaning & purpose of goals, 8.2 Challenge & support, 8.3 Collaboration, 8.4 Belonging & community, 8.5 Action-oriented feedback
- **Executive Function:** 9.1 Expectations & beliefs, 9.2 Self-awareness, 9.3 Reflection, 9.4 Empathy & restorative practices

### Representation (WHAT — purple)
- **Access:** 1.1 Customize display, 1.2 Multiple perception modes, 1.3 Diverse perspectives & identities
- **Support:** 2.1 Vocabulary & language structures, 2.2 Decoding text/symbols, 2.3 Languages & dialects, 2.4 Address language biases, 2.5 Multiple media
- **Executive Function:** 3.1 Prior knowledge, 3.2 Patterns & relationships, 3.3 Multiple ways of knowing, 3.4 Transfer & generalization

### Action & Expression (HOW — blue)
- **Access:** 4.1 Response methods, 4.2 Accessible tools & materials
- **Support:** 5.1 Multiple media for communication, 5.2 Multiple tools for construction, 5.3 Graduated fluency support, 5.4 Address expression biases
- **Executive Function:** 6.1 Set meaningful goals, 6.2 Anticipate & plan, 6.3 Organize information, 6.4 Monitor progress, 6.5 Challenge exclusionary practices
