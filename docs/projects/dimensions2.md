# Project Dimensions2 — Platform Architecture Reset
**Created: 2 April 2026**
**Status: SPEC PHASE — gap analysis complete, build plan drafted**
**Source doc: `docs/projects/Studioloom Platform Architecture.docx`**
**Predecessor: `docs/projects/dimensions.md` (Phases 0-4b COMPLETE)**

---

## What This Is

A ground-up rethink of StudioLoom's core data pipeline, informed by the 4-Pillar Platform Architecture doc. The architecture doc describes an enterprise-scale system (Kafka, Redis, sovereign pods, microservices). StudioLoom is a solo-developer Next.js app on Vercel/Supabase with 0 paying customers. Dimensions2 takes the **ideas that matter now** from that doc and adapts them to StudioLoom's actual stack and stage.

The user's words: "the unit generation isn't working that well. the upload needs to be redone."

Three problems to solve:
1. **Uploads produce analysis, not reusable building blocks.** The knowledge pipeline creates LessonProfiles and text chunks — useful for RAG context, but you can't drag an extracted activity into a new unit.
2. **Generation creates everything from scratch.** The wizard asks an LLM to invent every activity. It should be assembling proven activities from a library and only generating what's missing.
3. **No feedback loop closes the circle.** Tracking infrastructure exists (useActivityTracking, pace feedback, integrity monitoring) but nothing reads it back to improve future generation.

---

## Gap Analysis: Architecture Doc vs Current StudioLoom

### System 1: The Library (Ingestion)

| Architecture Doc | StudioLoom Today | Gap |
|-----------------|-----------------|-----|
| 8 resource types (Activity Block, Content Text, Movie/Video, Picture/Diagram, URL/Weblink, Interactive, Templates, Assessments) | 3 upload types (PDF, DOCX, PPTX) → all produce same output (LessonProfile + text chunks) | **Critical.** No concept of distinct resource types. Everything is a "chunk." |
| Activity Blocks as first-class composable entities with metadata (timeweight, bloom, social_mode, efficacy_score, UDL_cached_refs) | Activities exist only inside unit content_data JSONB — not independently addressable or reusable | **Critical.** This is the core architectural gap. |
| SHA-256 deduplication before processing | No dedup — re-uploading same PDF creates duplicate profiles and chunks | **Easy fix.** Add hash column to knowledge_uploads, check before processing. |
| Deterministic parsing (Unstructured.io) → tiered AI | 3-pass AI analysis on everything. Pass 0 classifies, but parsing is AI-heavy | **Medium.** Current pipeline works but is expensive. Deterministic pre-parsing would cut AI costs. |
| Decoupled media (S3 for raw, pgvector for metadata) | Supabase storage for files, pgvector for embeddings, all in same Supabase project | **Fine for now.** Supabase handles both. Decouple when scaling. |
| Batch API for bulk uploads (50% cost reduction) | Each upload processed individually in real-time | **Nice-to-have.** No bulk upload use case yet with 0 users. |

### System 2: The Engine (Generation)

| Architecture Doc | StudioLoom Today | Gap |
|-----------------|-----------------|-----|
| Vector search retrieves Activity Blocks by metadata (standard alignment, time, efficacy) | RAG retrieves text chunks + LessonProfiles for context injection into prompts | **Critical.** RAG provides *inspiration* not *building blocks*. AI still generates from scratch. |
| Master/Fork data model — lightweight JSON forks with pointers and text overrides | Copy-on-write forking on class_units — deep-copies entire content_data JSONB | **Exists but heavy.** Current fork copies everything. Doc's pointer+override model is more elegant. |
| 80/20 Explore/Exploit — 80% proven blocks, 20% new | No efficacy data, so no explore/exploit possible | **Depends on System 4.** Need efficacy scores first. |
| "Frankenstein" Polish Pass — unified voice across assembled blocks | No post-assembly polish. Everything generated as one coherent output. | **Not needed yet.** If generation shifts to assembly, this becomes important. |
| Backward Design wizard (approach → constraints → assessment → flow → blocks → build) | 3-lane wizard (Express/Guided/Architect) with conversational flow | **Good overlap.** Wizard structure is solid. The gap is what happens AFTER the wizard — blocks vs generation. |
| Semantic Cache — bypass LLM for similar curriculum requests (>95% cosine similarity) | No caching. Every generation hits the LLM fresh. | **Nice-to-have.** Low priority until API costs become a problem. |

### System 3: The Classroom (Delivery)

| Architecture Doc | StudioLoom Today | Gap |
|-----------------|-----------------|-----|
| Pre-generated UDL text variations (Level 1/2/3) at "Finalize Unit" time | 3-tier ELL scaffolding at prompt level (sentence starters, guided prompts, extension challenges) | **Different approach.** Doc's pre-generation is better for scale. Current works for 0-user prototype. |
| Redis caching for 9 AM login spikes | Supabase direct queries | **Not needed yet.** Vercel Edge Cache + Supabase connection pooling handle current (zero) load. |
| Profile-driven rendering (JWT → UDL_Level → swap text) | Student learning profile drives AI mentor tone hints (non-critical, try/catch) | **Partial.** Profile data collected but not used for content rendering. |
| Tier 2/3 vocab mouseover definitions | No runtime vocab support. Vocab in lesson warmup section only. | **Good idea.** Could be valuable for ELL students. Lower priority than core pipeline fixes. |

### System 4: The Loop (Telemetry)

| Architecture Doc | StudioLoom Today | Gap |
|-----------------|-----------------|-----|
| Teacher explicit: inline flagging, post-lesson timing survey | Pace feedback (🐢👌🏃), teacher post-lesson feedback (designed, not fully wired) | **Partial.** Collection exists. No aggregation into efficacy scores. |
| Teacher implicit: tracks deletions, rewrites (lowers score) | No tracking of teacher edits to generated content | **Critical.** Teacher edits are the highest-signal feedback for generation quality. |
| Student explicit: emoji reactions per block | No per-activity student reactions | **Easy add.** Similar to existing pace feedback. |
| Student implicit: time-on-task per activity | useActivityTracking collects time_spent_seconds, attempt_number, effort_signals per activity | **Built.** Infrastructure exists. Not aggregated or fed back. |
| Efficacy Score (0-100) per Master Activity Block | No efficacy concept. No reusable blocks to score. | **Depends on Activity Block library existing.** |
| Nightly batch processing → Pub/Sub event → System 2 updates rankings | No batch processing. No event system. | **Overkill for current stage.** A daily cron computing scores from accumulated data would work. |
| Self-healing metadata (auto-correct timeWeight when actual consistently differs) | No self-healing | **Good idea.** Realistic for a Supabase cron function. |

### Cross-System: Infrastructure

| Architecture Doc | StudioLoom Today | Gap |
|-----------------|-----------------|-----|
| Central Taxonomy API (microservice) | Constants in TypeScript files (Bloom's levels, UDL checkpoints, criteria per framework) | **Fine for now.** A constants file IS the taxonomy for a single-app architecture. Microservice when multi-app. |
| Event-Driven Architecture (Kafka/EventBridge) | Request/response. No events. | **Overkill.** Supabase database triggers + Edge Functions can handle async workflows when needed. |
| Sovereign Pod Architecture (PIPL/GDPR) | Single Supabase project on AWS | **Not needed until China customers.** Noted for future. Matt lives in China — this matters eventually. |
| Zero-PII Telemetry Gateway | Student auth uses anonymous tokens (nanoid). No real names in telemetry. | **Already partially addressed.** Current design is privacy-conscious. |
| Vector Space Pruning | No pruning. Knowledge base is small. | **Not needed yet.** Revisit at 10K+ chunks. |

---

## What Dimensions v1 Already Built

Before proposing new work, here's what's already live from the first Dimensions project:

**Schema (migrations 057-058 APPLIED):**
- Page level: udl_coverage, grouping_strategy, bloom_distribution
- Activity level: bloom_level, grouping, ai_rules, udl_checkpoints, timeWeight
- Knowledge chunks: bloom_level, grouping, udl_checkpoints columns
- Units: materials_list, learning_outcomes, sdg_tags, cross_curricular_links
- Classes: instruction_language, additional_languages

**Generation (all 10 routes):**
- AI outputs bloom_level, timeWeight, grouping, ai_rules, udl_checkpoints on every generated activity
- Dimensions metadata instruction in all prompt types (design + service + PP + inquiry)

**Analysis pipeline:**
- Pass 2b fallback extracts Dimensions fields from uploads (bloom, UDL, grouping, cognitive load)
- Knowledge chunks enriched with bloom_level, grouping, udl_checkpoints

**Client tracking:**
- useActivityTracking hook: time_spent_seconds, attempt_number, effort_signals per activity
- Data saves to student_progress.responses JSONB

**Lesson editor:**
- Bloom's selector, grouping selector, timeWeight selector, AI rules editor, UDL checkpoint picker
- DimensionsSummaryBar with cognitive load curve sparkline

**What's NOT built from Dimensions v1:**
- Phase 5: velocity loop (reading tracking data back into generation)
- RAG retrieval filters (bloom, UDL, grouping on retrieveContext/retrieveLessonProfiles)
- Student accommodation → AI prompt injection
- UDL coverage gap warnings
- Timing confidence indicator

---

## Pillar 0: Pedagogical Skeletons (Unit-Level Sequencing)

**From the Platform Architecture doc, Step 1 of the wizard:**
> "Teacher selects a pedagogical skeleton (e.g., Agile, Waterfall, Bootcamp, Human-Centered, Reverse Engineering, Open Inquiry)."

This is the missing layer. Currently StudioLoom has per-lesson structures (8 types in `lesson-structures.ts` — Workshop, Research, Ideation, Skills-Demo, Making, Testing, Critique, Presentation, Assessment). These control the phase layout *within* a single lesson. But nothing controls how lessons are *sequenced across a unit*.

A pedagogical skeleton answers: "Given 8 lessons, what's the learning journey shape?" The answer is fundamentally different for an Agile unit (short build-test-reflect sprints) vs a Waterfall unit (linear phase-gate progression) vs a Bootcamp unit (front-load all skills, then extended making).

### The 6 Skeleton Patterns

Each skeleton defines:
- **Lesson sequence template** — what lesson types go where (maps to existing `lesson-structures.ts` types)
- **Pacing model** — where the energy peaks, where the reflection sits, where skills front-load vs just-in-time
- **Block selection bias** — what kind of Activity Blocks the AI should prefer at each position
- **Iteration pattern** — how many build-test cycles, when they happen
- **Checkpoint placement** — where formative assessment naturally fits

#### 1. WATERFALL (Linear Phase-Gate)

**Shape:** Research → Define → Ideate → Plan → Build → Test → Present
**Best for:** Traditional design briefs, clear deliverables, teacher-directed classes, first-time design students

```
Lesson 1:  Research        [research]        — Discover context, user needs
Lesson 2:  Research        [research]        — Analyse findings, define problem
Lesson 3:  Ideation        [ideation]        — Generate ideas
Lesson 4:  Planning        [workshop]        — Select idea, plan prototype
Lesson 5:  Making          [making]          — Build prototype
Lesson 6:  Making          [making]          — Continue building
Lesson 7:  Testing         [testing]         — Test with users, gather feedback
Lesson 8:  Presentation    [presentation]    — Present + reflect on process
```

**Pacing:** Slow ramp. Each phase completes before next begins. Teacher checkpoint between each gate.
**Block bias:** Structured blocks with high scaffolding. Prefer blocks with `bloom_level: remember/understand/apply`.
**Iteration:** Single pass. No deliberate loops. If time allows, one test→refine cycle at the end.
**When to suggest:** Default for "design" unit type when teacher hasn't specified an approach. Safest for new teachers.

#### 2. AGILE (Sprint Cycles)

**Shape:** Mini-sprints of Build → Test → Reflect, with increasing fidelity
**Best for:** Experienced classes, iterative product design, software/digital design, Year 9+

```
Lesson 1:  Brief & Research   [research]     — Understand problem + constraints
Lesson 2:  Sprint 1 Build     [making]       — Quick rough prototype
Lesson 3:  Sprint 1 Test      [testing]      — Test + retrospective
Lesson 4:  Sprint 2 Build     [making]       — Improved prototype using feedback
Lesson 5:  Sprint 2 Test      [testing]      — Test + retrospective
Lesson 6:  Sprint 3 Build     [making]       — Refined prototype
Lesson 7:  Sprint 3 Polish    [making]       — Final touches + documentation
Lesson 8:  Showcase           [presentation] — Demo day + retrospective
```

**Pacing:** Rhythmic. Energy oscillates between making (high) and testing (analytical). Each sprint is faster than the last.
**Block bias:** Prefer blocks with `time_weight: quick` for sprint activities. Favour `grouping: pair` (pair programming pattern).
**Iteration:** 3 deliberate build-test cycles. Each sprint narrows scope. Retrospective after each test.
**When to suggest:** When unit has >6 lessons, teacher selects "iterative" or topic involves digital/product design.

#### 3. BOOTCAMP (Front-Loaded Skills)

**Shape:** Intensive skill instruction first, then extended independent making
**Best for:** Technical skills (woodwork, textiles, CAD, electronics), workshop safety requirements, Year 7-8

```
Lesson 1:  Safety & Tools     [skills-demo]  — Safety certification + tool intro
Lesson 2:  Skill Demo 1       [skills-demo]  — Core technique (I Do / We Do / You Do)
Lesson 3:  Skill Demo 2       [skills-demo]  — Second technique
Lesson 4:  Mini-Project       [making]       — Short guided exercise applying both skills
Lesson 5:  Design Brief       [workshop]     — Introduce project, plan approach
Lesson 6:  Extended Making    [making]       — Build
Lesson 7:  Extended Making    [making]       — Build (continued)
Lesson 8:  Testing + Present  [testing]      — Test, evaluate, present
```

**Pacing:** High instruction density upfront (Lessons 1-3 allow relaxed instruction cap). Energy shifts from absorbing → applying after the pivot at Lesson 4-5.
**Block bias:** Lessons 1-3: prefer blocks with `lesson_structure_role: instruction`, safety blocks, `bloom_level: understand/apply`. Lessons 5-8: prefer blocks with `lesson_structure_role: core`, `time_weight: extended`.
**Iteration:** Minimal. One mini-project as a "practice run," then the main project. Testing happens at the end.
**When to suggest:** When unit requires safety badges, involves physical tools/machines, or teacher selects "skills-focused."

#### 4. HUMAN-CENTERED (Empathy-Driven)

**Shape:** Deep empathy research → narrow define → creative ideation → prototype for users → user testing
**Best for:** Service design, UX, social innovation, units with real users/stakeholders, PYP Exhibition

```
Lesson 1:  Empathy            [research]     — User interviews, observation, immersion
Lesson 2:  Empathy Synthesis  [workshop]     — Affinity diagram, empathy map, personas
Lesson 3:  Define             [workshop]     — How Might We, problem framing, POV statement
Lesson 4:  Ideation           [ideation]     — Divergent then convergent thinking
Lesson 5:  Low-Fi Prototype   [making]       — Paper/cardboard prototypes
Lesson 6:  User Testing       [testing]      — Test with actual users, structured feedback
Lesson 7:  Iterate            [making]       — Redesign based on user feedback
Lesson 8:  Storytelling       [presentation] — Present the journey, not just the product
```

**Pacing:** Front-loaded with empathy (2 full lessons, unusual). The "define" lesson is the creative bottleneck — students resist narrowing. Energy peaks at ideation, dips at define, peaks again at testing.
**Block bias:** Prefer blocks that reference real users/stakeholders. Favour toolkit tools: empathy-map, stakeholder-map, how-might-we, five-whys. `grouping: pair` or `small_group` for empathy phases.
**Iteration:** One deliberate prototype→test→iterate cycle (Lessons 5-7).
**When to suggest:** Service unit type, or when teacher mentions "users," "stakeholders," "community," "empathy."

#### 5. REVERSE ENGINEERING

**Shape:** Start with existing product → deconstruct → understand → reconstruct/improve
**Best for:** Product analysis, manufacturing, how-things-work units, GCSE/A-Level analysis tasks

```
Lesson 1:  Product Autopsy    [research]     — Disassemble, document, photograph
Lesson 2:  Analysis           [research]     — Materials, manufacturing, function analysis
Lesson 3:  Benchmark          [workshop]     — Compare multiple existing solutions
Lesson 4:  Identify Weakness  [workshop]     — What fails? What could improve?
Lesson 5:  Redesign           [ideation]     — Generate improvement ideas
Lesson 6:  Prototype          [making]       — Build improved version
Lesson 7:  Test & Compare     [testing]      — Test against original, measure improvement
Lesson 8:  Technical Report   [presentation] — Engineering-style documentation
```

**Pacing:** Analytical first half (Lessons 1-4), creative second half (Lessons 5-8). Unique structure: students don't design from scratch — they *improve* something that exists.
**Block bias:** Prefer blocks with `bloom_level: analyze/evaluate`. Favour toolkit tools: decision-matrix, pmi-chart, fishbone. Structured recording templates.
**Iteration:** One cycle: deconstruct → redesign → build → compare against original.
**When to suggest:** When topic involves existing products, manufacturing analysis, or teacher selects "analysis."

#### 6. OPEN INQUIRY

**Shape:** Student-driven question → investigate → create → share → reflect
**Best for:** PYP UoI, PP/Personal Projects, student-led research, transdisciplinary units, gifted/advanced

```
Lesson 1:  Provocation        [workshop]     — Stimulus that raises questions, not answers
Lesson 2:  Question Building  [ideation]     — Students generate and refine inquiry questions
Lesson 3:  Investigation 1    [research]     — Self-directed research (teacher as facilitator)
Lesson 4:  Investigation 2    [research]     — Continue investigation, deepen understanding
Lesson 5:  Create / Make      [making]       — Students create response to their question
Lesson 6:  Create / Make      [making]       — Continue creating
Lesson 7:  Peer Feedback      [critique]     — Structured peer review + revision
Lesson 8:  Exhibition         [presentation] — Share learning publicly
```

**Pacing:** Teacher presence fades over time (heavy facilitation Lessons 1-2, light touch Lessons 3-6, curator Lessons 7-8). Student agency increases lesson by lesson.
**Block bias:** Prefer blocks with `ai_rules.phase: divergent`, low scaffolding. Avoid blocks with rigid `response_type` — open inquiry needs flexible output formats. `grouping: individual` or `pair` (student choice).
**Iteration:** Not structured. Students decide when to circle back based on their findings. Teacher uses check-ins to guide, not direct.
**When to suggest:** Inquiry unit type, PP unit type, or when teacher selects "student-led." Requires high trust in students.

---

### Skeleton Data Model

```typescript
interface PedagogicalSkeleton {
  id: string;                         // 'waterfall' | 'agile' | 'bootcamp' | 'human-centered' | 'reverse-engineering' | 'open-inquiry'
  name: string;                       // Display name
  description: string;                // One-line teacher-facing description
  bestFor: string[];                  // Tags: ['traditional', 'first-time', 'clear-deliverable']
  unitTypes: string[];                // Which unit types this skeleton suits: ['design', 'service', 'pp', 'inquiry']

  // The core sequencing template
  lessonSlots: LessonSlot[];          // Ordered array, one per lesson position

  // Pacing & AI generation guidance
  pacingModel: string;                // Prompt text describing the energy/pacing shape
  blockSelectionBias: string;         // Prompt text guiding which blocks to prefer at different positions
  iterationPattern: string;           // Prompt text describing build-test cycles

  // Scaling rules
  minLessons: number;                 // Minimum lessons this skeleton makes sense for
  maxLessons: number;                 // Maximum before it gets repetitive
  stretchStrategy: string;            // How to fill extra lessons: 'extend-making' | 'add-sprint' | 'deepen-research' | 'add-iteration'
  compressStrategy: string;           // How to cut lessons: 'merge-research' | 'skip-iteration' | 'combine-test-present'
}

interface LessonSlot {
  position: number;                   // 1-indexed lesson number
  label: string;                      // Human-readable label: "Sprint 1 Build", "Safety & Tools"
  lessonType: DesignLessonType;       // Maps to lesson-structures.ts: 'workshop' | 'research' | 'ideation' | 'making' | 'testing' | 'critique' | 'presentation' | 'skills-demo' | 'assessment'
  description: string;                // What happens in this lesson
  blockBias?: {                       // Override block selection for this position
    preferBloomLevels?: string[];
    preferGrouping?: string[];
    preferTimeWeight?: string[];
    preferToolkitTools?: string[];     // Specific toolkit tools to surface
    preferStructureRole?: string[];    // 'opening' | 'instruction' | 'core' | 'reflection'
  };
  isStretchable?: boolean;            // Can this slot expand to fill extra lessons?
  isCompressible?: boolean;           // Can this slot be merged with adjacent?
}
```

### How Skeletons Integrate with the Wizard

**Architecture doc Step 1:** "Teacher selects a pedagogical skeleton."

In the 3-lane wizard:
- **Express:** Auto-detect skeleton from topic + unit type. "Sustainable packaging redesign" + DESIGN → Waterfall. "Arduino robot" + DESIGN → Bootcamp. "Community garden" + SERVICE → Human-Centered. Teacher can override.
- **Guided:** Explicit skeleton selection card after unit type. 6 cards with name, one-line description, "Best for:" tags. AI suggests top 2 based on unit type + topic.
- **Architect:** Dropdown in the "Unit Identity" section. All 6 available.

The skeleton selection feeds into generation at two points:

1. **Skeleton generation (outline step):** Instead of asking the AI "generate 8 lesson titles," the skeleton provides the lesson slot template. The AI fills in details (titles, descriptions, learning goals) but the *sequence* is pre-determined by the skeleton. This eliminates the "every unit looks the same" problem.

2. **Per-lesson generation:** Each lesson slot carries its `lessonType`, which maps to `getLessonStructure()` in `lesson-structures.ts`. The per-lesson structure handles the internal phase layout. The block selection bias from the skeleton guides which Activity Blocks the AI prefers for that position.

### How Skeletons Interact with Activity Blocks

The skeleton's `blockSelectionBias` feeds into the Activity Block retrieval function (Phase 2A):

```
Teacher picks skeleton: "Agile"
AI generates outline using Agile lesson slots
For Lesson 3 (Sprint 1 Test):
  → lessonType = 'testing' → getLessonStructure('testing') → internal phases
  → blockBias = { preferBloomLevels: ['evaluate'], preferToolkitTools: ['decision-matrix', 'pmi-chart'] }
  → retrieveActivityBlocks({ bloomLevel: 'evaluate', designPhase: 'test', ... })
  → AI assembles lesson from proven test blocks + generates gap-fill activities
```

The skeleton doesn't override block metadata — it *biases selection*. A block tagged `time_weight: extended` in a Bootcamp Lesson 2 (skills demo) is fine; the lesson structure will allocate the right proportion of time. The skeleton just makes sure the AI is looking for skills-demo blocks, not ideation blocks, at that position.

### Scaling: Stretch & Compress

Units aren't always 8 lessons. Skeletons need to flex.

**Stretch (more lessons):** Each skeleton has a `stretchStrategy`:
- Waterfall: extends Making phase (Lessons 5-6 become 5-6-7)
- Agile: adds another sprint cycle
- Bootcamp: adds another skill demo or extends making
- Human-Centered: adds a second prototype→test cycle
- Reverse Engineering: deepens analysis phase
- Open Inquiry: extends investigation and creation

**Compress (fewer lessons):** Each skeleton has a `compressStrategy`:
- Waterfall: merge research into one lesson, combine test+present
- Agile: reduce to 2 sprints instead of 3
- Bootcamp: combine skill demos, reduce making to 1 lesson
- Human-Centered: merge empathy lessons, skip second iteration
- Reverse Engineering: combine analysis + benchmark
- Open Inquiry: merge investigation lessons, skip peer feedback

The AI applies stretch/compress based on the teacher's lesson count input. Rules: never compress below `minLessons`, never stretch above `maxLessons`.

### Build Estimate

| Phase | Days | Priority |
|-------|------|----------|
| 0A: Skeleton type definitions + constants file | 0.5 | **P0** |
| 0B: Skeleton selection in wizard (all 3 lanes) | 1 | **P0** |
| 0C: Skeleton → outline generation prompt injection | 1 | **P0** |
| 0D: Skeleton → per-lesson block bias in retrieval | 0.5 | **P0** (after Pillar 1 Phase 2A) |
| 0E: Auto-detection from topic + unit type | 0.5 | **P1** |
| **Total** | **3.5 days** | |

**Dependencies:** 0A is standalone. 0B depends on 0A. 0C depends on 0A. 0D depends on Pillar 1 Phase 2A (block retrieval must exist). 0E depends on 0B.

---

## Dimensions2: The Realistic Build Plan

Given StudioLoom's stage (solo dev, 0 customers, Vercel/Supabase), here's what to actually build. Organized by the 4 pillars but adapted to reality.

### Pillar 1: Activity Block Library

**The single most impactful change.** Currently, uploads produce analysis. They should produce *reusable building blocks*.

#### Phase 1A: Activity Block Entity (~2 days)

Create `activity_blocks` as a first-class database table (not just chunks or content_data sections).

```sql
CREATE TABLE activity_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id),

  -- Identity
  title TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,              -- Student-facing instruction

  -- Source tracking
  source_type TEXT NOT NULL,          -- 'extracted' | 'generated' | 'manual' | 'community'
  source_upload_id UUID,              -- Which upload this was extracted from
  source_unit_id UUID,                -- Which unit generation created this
  source_page_id TEXT,                -- Which lesson page
  source_activity_index INT,          -- Position in original

  -- Dimensions metadata (all from Dimensions v1)
  bloom_level TEXT,                   -- remember/understand/apply/analyze/evaluate/create
  time_weight TEXT DEFAULT 'moderate', -- quick/moderate/extended/flexible
  grouping TEXT DEFAULT 'individual',  -- individual/pair/small_group/whole_class/flexible
  ai_rules JSONB,                     -- { phase, tone, rules[], forbidden_words[] }
  udl_checkpoints TEXT[],             -- ['1.1', '5.2', '7.1']
  success_look_fors TEXT[],           -- Observable indicators

  -- Pedagogical metadata
  design_phase TEXT,                   -- discover/define/ideate/prototype/test
  lesson_structure_role TEXT,          -- opening/instruction/core/reflection
  response_type TEXT,                  -- short-text/long-text/canvas/toolkit-tool/etc.
  toolkit_tool_id TEXT,               -- If response_type = toolkit-tool

  -- Resources
  materials_needed TEXT[],            -- ['cardboard', 'scissors', 'glue']
  scaffolding JSONB,                  -- ELL scaffolding tiers
  example_response TEXT,              -- Model answer

  -- Quality signals (System 4 feeds these)
  efficacy_score FLOAT DEFAULT 50,    -- 0-100, starts neutral
  times_used INT DEFAULT 0,           -- How many units include this block
  times_skipped INT DEFAULT 0,        -- Teacher generated but removed it
  times_edited INT DEFAULT 0,         -- Teacher modified after generation
  avg_time_spent FLOAT,               -- Actual student time (from tracking)
  avg_completion_rate FLOAT,          -- % students who completed

  -- Search
  embedding halfvec(1024),            -- Voyage AI vector
  fts tsvector,                       -- Full-text search
  tags TEXT[],                        -- Freeform tags

  -- Lifecycle
  is_public BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Key design decisions:**
- Activity Blocks live in their own table, not inside content_data JSONB. They're independently addressable, searchable, and scorable.
- `source_type` tracks provenance: extracted from upload, generated by AI, manually created, or community-shared.
- `efficacy_score` starts at 50 (neutral), not 0. Avoids cold-start penalty. Moves up/down based on System 4 signals.
- Blocks are teacher-scoped by default (`is_public = false`). Community sharing is opt-in.

#### Phase 1B: Extract Blocks from Uploads (~2 days)

Modify the knowledge ingestion pipeline to produce Activity Blocks alongside LessonProfiles and chunks.

**Current flow:**
```
Upload → Extract text → Pass 0 (classify) → Pass 1 (structure) → Pass 2 (pedagogy) → Pass 2b (dimensions) → Chunk → Embed → Store
```

**New flow (additions in bold):**
```
Upload → Hash check (dedup) → Extract text → Pass 0 (classify) → Pass 1 (structure) → Pass 2 (pedagogy) → Pass 2b (dimensions) → Chunk → Embed → Store chunks
                                                                                                                                              ↓
                                                                                                                                    **Extract Activity Blocks**
                                                                                                                                    (from lesson_flow phases)
                                                                                                                                              ↓
                                                                                                                                    **Embed blocks → Store**
```

The lesson_flow from Pass 2 analysis already contains structured phases with:
- title, description, teacher_role, student_cognitive_level, timing, materials, scaffolding, safety

Each phase becomes an Activity Block. The LLM already did the hard work — we just need to store the output differently.

**SHA-256 dedup** — add `file_hash TEXT` column to `knowledge_uploads`. Check before processing. Zero-cost duplicate prevention.

#### Phase 1C: Extract Blocks from Existing Units (~1 day)

When a teacher saves a unit, extract its activities as blocks. This populates the library from generated content, not just uploads.

Modify `ingest-unit.ts`: for each ActivitySection in each page, create an `activity_blocks` row with `source_type = 'generated'`, linking back to the source unit/page.

#### Phase 1D: Manual Block Creation (~0.5 days)

Simple CRUD API for teachers to create blocks from scratch. Minimal UI — a form in the knowledge library page.

---

### Pillar 2: Block-Aware Generation

**The generation pipeline should retrieve and assemble blocks, not generate from scratch.**

#### Phase 2A: Block Retrieval Function (~1 day)

New function: `retrieveActivityBlocks(params)` — hybrid search over activity_blocks table.

```typescript
interface BlockRetrievalParams {
  query: string;           // Semantic search text
  teacherId: string;
  bloomLevel?: string;
  designPhase?: string;
  timeWeight?: string;
  grouping?: string;
  responseType?: string;
  maxBlocks?: number;      // Default 10
  minEfficacy?: number;    // Default 0 (include all)
}
```

Ranking formula: `0.5 * vector_similarity + 0.2 * efficacy_normalized + 0.15 * text_match + 0.15 * usage_signal`

Where `usage_signal = log(times_used + 1) / log(max_times_used + 1)` (logarithmic so popular blocks don't dominate).

#### Phase 2B: Block Injection into Generation Prompts (~2 days)

Modify `buildRAGCriterionPrompt`, `buildRAGPerLessonPrompt`, `buildRAGTimelinePrompt` to retrieve and inject Activity Blocks alongside existing chunk/profile context.

New prompt section:
```
## Proven Activity Blocks from Your Library
The following activities have been used successfully in similar contexts.
PREFER adapting these over inventing new ones. You may modify titles,
prompts, and scaffolding to fit this specific lesson, but preserve the
core pedagogical approach.

### Block: "Material Exploration Station" (efficacy: 78, used 12 times)
- Bloom: Apply | Grouping: Small Group | Time: Extended
- Prompt: "In groups of 3, explore the material samples at your station..."
- Success Look-Fors: Students testing at least 3 properties, recording observations
- AI Rules: { phase: "divergent", tone: "encouraging exploration" }

### Block: "Design Criteria Brainstorm" (efficacy: 85, used 8 times)
...

When generating activities for this lesson, USE these blocks where they fit.
For gaps not covered by existing blocks, generate new activities following
the same quality patterns.
```

**80/20 rule (simplified for current stage):** Don't enforce a strict ratio. Instead, tell the AI "prefer existing blocks, generate new only for gaps." The ratio emerges naturally from library size — early on it'll be mostly generated (small library), later mostly assembled (rich library).

#### Phase 2C: Track Block Usage in Generated Units (~0.5 days)

When the AI uses a block (matched by semantic similarity to a library block), record it:
- Increment `times_used` on the activity_block
- Store `source_block_id` on the generated ActivitySection in content_data

This creates the link between generated content and library blocks, enabling efficacy tracking.

---

### Pillar 3: Delivery Improvements (Lower Priority)

These are valuable but less urgent than fixing the core pipeline.

#### Phase 3A: Vocab Highlighting (~1 day, LATER)

During Pass 2 analysis, extract Tier 2 (academic) and Tier 3 (domain-specific) vocabulary per chunk. Store in chunk metadata. At render time, highlight these words with tooltip definitions. No LLM at read time — all pre-computed during ingestion.

#### Phase 3B: UDL Text Variations (~2 days, LATER)

At "Finalize Unit" time, generate Level 2 and Level 3 text variations for all student-facing prompts. Store as JSONB alongside the original. Student profile drives which level renders.

Not needed until real students are using the platform with diverse learning needs.

---

### Pillar 4: Feedback Loop (Closing the Circle)

**This is where Dimensions v1's tracking infrastructure finally pays off.**

#### Phase 4A: Teacher Edit Tracking (~1 day)

The highest-signal feedback: what teachers change after AI generates.

In the lesson editor's auto-save flow, compare the saved content against the original generated content. For each modified activity:
- Record what changed (title? prompt? scaffolding? deleted entirely? reordered?)
- Store diff in a new `generation_feedback` table
- If the activity came from a library block (`source_block_id`), queue a signal for efficacy adjustment

```sql
CREATE TABLE generation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  unit_id UUID NOT NULL,
  page_id TEXT NOT NULL,
  activity_index INT,
  source_block_id UUID,           -- If activity came from library

  feedback_type TEXT NOT NULL,     -- 'deleted' | 'rewritten' | 'reordered' | 'kept' | 'scaffolding_changed'
  original_content JSONB,          -- Snapshot of AI output
  modified_content JSONB,          -- What teacher changed it to

  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Phase 4B: Efficacy Score Computation (~1 day)

A Supabase Edge Function (or cron-triggered API route) that runs daily/weekly:

```
For each activity_block:
  teacher_signals = query generation_feedback WHERE source_block_id = block.id
  student_signals = query student_progress tracking data for units containing this block

  kept_rate = count(feedback_type = 'kept') / count(all)
  deletion_rate = count(feedback_type = 'deleted') / count(all)
  avg_student_time = avg(time_spent_seconds) across all instances
  expected_time = timeWeight_to_minutes(block.time_weight)
  time_accuracy = 1 - abs(avg_student_time - expected_time) / expected_time
  completion_rate = count(students who completed) / count(students who started)

  efficacy_score = (
    0.35 * kept_rate +          -- Teacher kept it (strong positive)
    0.25 * completion_rate +     -- Students finished it
    0.20 * time_accuracy +       -- Time estimate was accurate
    0.10 * (1 - deletion_rate) + -- Not frequently deleted
    0.10 * pace_feedback_score   -- Student pace reactions
  ) * 100

  UPDATE activity_blocks SET efficacy_score = new_score,
    avg_time_spent = ..., avg_completion_rate = ...
```

#### Phase 4C: Self-Healing Metadata (~0.5 days)

If `avg_time_spent` consistently differs from `timeWeight` by >50%, auto-correct the block's `timeWeight`:
- Block tagged `quick` but students average 18 min → auto-correct to `moderate`
- Block tagged `extended` but students average 5 min → auto-correct to `quick`

Log the correction. Non-destructive (original value preserved in `generation_feedback`).

#### Phase 4D: Feed Efficacy Back into Generation (~0.5 days)

Already wired in Phase 2B (retrieval ranking includes efficacy_score). This phase just ensures the daily computation from 4B actually updates the ranking. Verify end-to-end: upload → extract block → use in unit → teacher edits → efficacy updates → next generation prefers/avoids that block.

---

## What We're NOT Building (and Why)

| Architecture Doc Feature | Why Skip |
|-------------------------|----------|
| Event-Driven Architecture (Kafka/EventBridge) | Overkill for single-app. Supabase triggers + Edge Functions when needed. |
| Central Taxonomy API (microservice) | TypeScript constants file IS the taxonomy. Microservice when multi-app. |
| Redis caching layer | Vercel Edge Cache + Supabase connection pooling handle current (zero) load. |
| Sovereign Pod Architecture | No customers in China yet. Matt lives there but students are in his classroom. Revisit with revenue. |
| Federated Analytics | Single database. No cross-border data flow. |
| Edge Computing for UDL | No concurrent user load to optimize for. |
| Vector Space Pruning | Knowledge base is tiny. Revisit at 10K+ blocks. |
| Semantic Cache for generation | API costs are not a problem at current volume (0 users). |
| Batch API for bulk uploads | No bulk upload use case. Individual teacher uploads are fine. |
| Content filtering for China AI regulations | Using Anthropic Claude only. China-specific AI routing is a revenue-stage concern. |

---

## Build Order and Dependencies

```
Phase 0A: Skeleton type definitions + constants file     ←── standalone
Phase 0B: Skeleton selection in wizard (all 3 lanes)     ←── depends on 0A
Phase 0C: Skeleton → outline generation prompt injection  ←── depends on 0A
    ↓
Phase 1A: Activity Block table + types + CRUD API         ←── can start parallel with 0B/0C
    ↓
Phase 1B: Extract blocks from uploads ←── depends on 1A
Phase 1C: Extract blocks from units   ←── depends on 1A
    ↓
Phase 0D: Skeleton → per-lesson block bias in retrieval   ←── depends on 0A + 2A (block retrieval must exist)
Phase 2A: Block retrieval function     ←── depends on 1A (table must exist)
    ↓
Phase 2B: Block injection into prompts ←── depends on 2A
Phase 0E: Auto-detection from topic + unit type           ←── depends on 0B
Phase 2C: Track block usage            ←── depends on 2B
    ↓
Phase 4A: Teacher edit tracking        ←── depends on 2C (need source_block_id)
    ↓
Phase 4B: Efficacy computation         ←── depends on 4A + Phase 3 tracking (Dimensions v1)
Phase 4C: Self-healing metadata        ←── depends on 4B
Phase 4D: Close the loop               ←── depends on 4B + 2A (ranking uses efficacy)
    ↓
Phase 1D: Manual block creation        ←── can happen anytime after 1A
Phase 3A: Vocab highlighting           ←── independent, lower priority
Phase 3B: UDL text variations          ←── independent, lower priority
```

**Critical path:** 0A → 0B/0C (parallel) → 1A → 1B → 2A → 0D + 2B (parallel) → 2C → 4A → 4B → 4D

**Recommended build order for a fresh session:**
1. Start with 0A (skeleton constants — standalone, defines the vocabulary)
2. Parallel: 0B (wizard integration) + 0C (outline prompt injection) + 1A (activity_blocks table)
3. 1B + 1C (block extraction from uploads and units)
4. 2A (block retrieval) + 0D (skeleton block bias feeds into retrieval)
5. 2B (block injection into generation) + 0E (auto-detection)
6. 2C → 4A → 4B → 4D (feedback loop)

---

## Estimated Effort

| Phase | Days | Priority |
|-------|------|----------|
| **Pillar 0: Pedagogical Skeletons** | | |
| 0A: Skeleton type definitions + constants | 0.5 | **P0** |
| 0B: Skeleton selection in wizard (3 lanes) | 1 | **P0** |
| 0C: Skeleton → outline generation prompts | 1 | **P0** |
| 0D: Skeleton → per-lesson block bias | 0.5 | **P0** (after 2A) |
| 0E: Auto-detection from topic + unit type | 0.5 | **P1** |
| **Pillar 1: Activity Block Library** | | |
| 1A: Activity Block entity | 2 | **P0** |
| 1B: Extract from uploads | 2 | **P0** |
| 1C: Extract from units | 1 | **P0** |
| **Pillar 2: Block-Aware Generation** | | |
| 2A: Block retrieval | 1 | **P0** |
| 2B: Block injection into generation | 2 | **P0** |
| 2C: Track block usage | 0.5 | **P0** |
| **Pillar 4: Feedback Loop** | | |
| 4A: Teacher edit tracking | 1 | **P1** |
| 4B: Efficacy computation | 1 | **P1** |
| 4C: Self-healing metadata | 0.5 | **P1** |
| 4D: Close the loop | 0.5 | **P1** |
| **Other** | | |
| 1D: Manual block creation | 0.5 | **P2** |
| 3A: Vocab highlighting | 1 | **P2** |
| 3B: UDL text variations | 2 | **P3** |
| **Total P0 (Pillars 0+1+2)** | **11.5 days** | |
| **Total P0+P1** | **14.5 days** | |
| **Total all** | **18 days** | |

---

## Relationship to Existing Projects

| Project | Relationship |
|---------|-------------|
| **Dimensions v1** (COMPLETE) | Dimensions2 builds on v1's schema, tracking, and editor UI. All v1 fields carry forward. |
| **Lesson Pulse** (Phase 1 COMPLETE) | Pulse scores could become an input to efficacy scoring — a high-Pulse block gets a boost. |
| **Teaching Moves Library** (~65 moves) | Teaching Moves could seed the Activity Block library as `source_type = 'community'` blocks. |
| **Unified Upload Architecture** (spec written) | Dimensions2 Phase 1B IS the upload redo. The "Convert to Unit" button becomes "Extract Blocks + Convert to Unit." |
| **Lesson Plan Converter** (spec written) | Converter's output should create Activity Blocks, not just content_data pages. |
| **MYPflex** (Phase 1 COMPLETE) | Blocks need framework-aware criteria tags. Already handled by `criterionTags` field. |

---

## Decisions (Resolved 2 April 2026)

1. **Scaffolding storage:** Store base prompt + scaffolding hints on blocks. Full 3-tier ELL generation happens at unit finalization (Phase 3B, later).

2. **Block quality handling:** Start efficacy at 50 (neutral). Teacher verification (`teacher_verified` flag) bumps to 65. Actual usage data moves it from there. No manual quality gate on extraction.

3. **Library UI:** NOT in P0. Generation uses blocks behind the scenes first. Teacher-facing browsable library is Phase 2+ work — knowledge library page gains a "Blocks" tab when ready.

4. **Toolkit tool integration:** Toolkit tools are a valid Activity Block. `response_type: 'toolkit-tool'` + `toolkit_tool_id: 'scamper'` makes the block a configuration for that tool (challenge text, ai_rules, duration). The 27 interactive tools work as block types.

5. **Resource types roadmap:** Activity Block is the only first-class entity for now. Other resource types from the architecture doc are tracked below for future phases:

| Resource Type | Current Coverage | Future Phase |
|--------------|-----------------|--------------|
| Activity Block | **Dimensions2 P0** | — |
| Content Text | Existing knowledge chunks | Refine in Phase 3+ (vocab highlighting, UDL variations) |
| Movie/Video | Not supported | Phase 5+: media library, video embed blocks, timestamp tagging |
| Picture/Diagram | Supabase storage for uploads only | Phase 5+: image block type, annotation support, gallery integration |
| URL/Weblink | Not supported as entity | Phase 5+: bookmarkable resource links with preview metadata |
| Interactive/Embeds | 27 toolkit tools (hardcoded routes) | Phase 4+: generic embed block type, external tool integration |
| Templates/Printables | Not supported | Phase 5+: PDF template blocks, worksheet generator, print layout |
| Assessments/Rubric Nodes | Existing criteria system (per-framework) | Phase 4+: rubric blocks as composable assessment units, peer rubrics |

---

## Success Criteria

**Dimensions2 is successful when:**

1. A teacher uploads a lesson plan → Activity Blocks are extracted and visible in the knowledge library
2. A teacher generates a new unit → the AI uses blocks from their library where they fit
3. A teacher edits a generated unit → the edit is tracked and feeds back into block efficacy
4. After 5+ units generated and taught, efficacy scores are non-trivial (blocks range from 30-90, not all stuck at 50)
5. The 6th unit generated is measurably better than the 1st (more proven blocks, better time estimates, fewer teacher edits needed)

This is the **velocity learning loop** from Dimensions v1 Phase 5, made concrete through Activity Blocks.
