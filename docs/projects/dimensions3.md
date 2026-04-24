# Project Dimensions3 — Generation Pipeline Rebuild
**Created: 3 April 2026**
**Status: DESIGN PHASE — spec in progress, not yet building** *(v1.4 — 5 April 2026)*
**Source doc: `docs/projects/Studioloom Platform Architecture.docx` (Matt's 4-Pillar Platform Architecture)**
**Predecessors: `docs/projects/dimensions.md` (Phases 0-4b COMPLETE), `docs/projects/dimensions2.md` (SUPERSEDED)**

---

## ⚠️ READ FIRST — Strategic Shift (19 April 2026)

**Auto-generation of full units is being replaced by an interactive unit planner.** When you come back to this project, the first job is reconciling this doc with the new direction before writing any more generator code.

**What changed:**
Matt's existing ingestion + unit generation runs didn't produce units good enough to trust — because every teacher has their own style, and a generator that aims for "done" always lands in the uncanny valley for the teacher who actually has to use the unit. Disappointment is baked in when the system promises a finished unit.

**The new model:**
1. **Unit planner drives the flow, not the generator.** Matt has built a new planner with a better theoretical framework: starts with **concepts**, works down to **strategies**, then **skills**, then wraps in the **framework** (MYP in Matt's case, pluggable for others). Teacher walks through this sequentially. The planner replaces the generator.
2. **Saved units become "unit kernels" (recipe cards), not finished lessons.** The library is browsable colourful cards — each one a seed: *artefact + concept + provocation*. Teachers can't grab-and-go; clicking a kernel opens the planner pre-seeded, and the teacher still walks through skills + framework + constraints (lesson count, equipment, etc.) before anything is generated. Forced customisation removes "this isn't my style" disappointment, because the teacher IS the author.
3. **Kernel library has three organisational axes as filters over one pool, not three libraries:** by final artefact, by concept lens, by context/provocation.
4. **The generator's remaining job is gap-fill, not unit creation.** Once the teacher has set concepts/strategies/skills/framework/constraints, the AI assembles blocks + fills connective tissue. Not "write me a unit" — "fit these teacher-chosen blocks into lessons that meet the teacher-set constraints."
5. **Ingestion's role is now block surfacing, not unit input** — see the note on `systems/Ingestion/ingestion-pipeline-summary.md`. Ingested content becomes tagged activity blocks surfaced inside the planner at the moment the teacher has set enough context (concepts + skills) for suggestions to be useful. Return 5 ranked blocks with a reason each, not 30.

**What this means for Dimensions3's existing phases:**
- The "6-stage compartmentalised pipeline" survives but its entry point changes: teacher-set planner output, not AI-drafted-unit-output.
- Activity Block Library (Phase A) is MORE important under the new model — it's the payload the planner surfaces and the planner assembles.
- Block tagging (concept / strategy / skill / artefact / age band) is now on the critical path. The surfacing quality of the whole product depends on tag quality.
- Full end-to-end generation from a source doc is DEPRIORITISED. Don't build it as the primary flow.
- Sandbox / dryRun / feedback-loop scaffolding still applies — just anchored to the new planner-driven flow.

**Open question still unanswered:** is the first audience Matt's own class (hand-authored kernels are fine) or a wider teacher beta (kernel library + ingestion-fed blocks are on the critical path)? Answer this before scoping the next phase.

---

## 1. What This Is

A ground-up rebuild of StudioLoom's generation and ingestion pipelines, replacing both quarantined systems (knowledge pipeline + unit generation pipeline, 42 entry points sealed 3 Apr 2026).

This is NOT an iteration on Dimensions2. It is a rethink from first principles, guided by the 4-Pillar Platform Architecture doc but adapted to StudioLoom's reality (solo developer, Next.js on Vercel/Supabase, 0 paying customers).

---

## 2. Core Philosophy

**The system is a learning machine, not a template engine.**

### Principle 1: No Hardcoded Sequences
The previous pipeline hardwired the Workshop Model (4-phase: Opening → Mini-Lesson → Work Time → Debrief), 6 fixed pedagogical skeletons (Waterfall/Agile/Bootcamp/Human-Centered/Reverse Engineering/Open Inquiry), and rigid timing rules (1+age instruction cap, 45% work time floor).

Dimensions3 has NO hardwired sequences, timing rules, or phase structures. Instead:
- Day 1 ships with sensible defaults clearly marked as "starter patterns"
- The system observes what sequences real teachers use (from uploads, from edits, from teaching patterns)
- Learned patterns gradually replace starter defaults
- Any teacher can override any pattern — the system learns from overrides too

### Principle 2: Blocks Are the Product, Not Prompts
Generation should be primarily **assembly + gap-fill**, not "ask the AI to write everything." The AI's job shifts from "create a lesson from scratch" to "find the best blocks, arrange them, and generate connecting tissue for the gaps."

### Principle 3: Every Generation Gets Cheaper Over Time
- First unit for a topic = expensive (lots of AI generation to fill gaps)
- Second similar unit = cheaper (blocks already exist from the first, just rearrange)
- Tenth similar unit = near-zero AI cost (pure assembly from proven blocks)
- The cost trajectory is measurable in the sandbox per generation

### Principle 4: Measure Everything, Hardcode Nothing
Time weights, bloom levels, grouping patterns, phase structures — these start as AI estimates but get corrected by actual classroom data. The self-healing feedback loop is a core system, not a Phase 4 afterthought.

### Principle 5: Compartmentalized Pipeline
Every stage of the pipeline is an independent, testable module with typed input/output contracts. When something goes wrong in the final output, you open the sandbox, step through stage by stage, and find exactly where the problem originated. Upstream of the problem = correct. Problem stage = fix it. Downstream = automatically fixed.

### Principle 6: No Silent Data Mutation
The feedback loop proposes changes — it does not silently modify data. All autonomous adjustments go through an approval queue with guardrails, audit log, and manual override capability. Nothing is assumed to be working fine.

---

## 3. The 6-Stage Generation Pipeline

Each stage takes a defined input, produces a defined output, and can be run in isolation.

```
Stage 0 ──→ Stage 1 ──→ Stage 2 ──→ Stage 3 ──→ Stage 4 ──→ Stage 5 ──→ Stage 6
Input       Retrieve     Assemble     Fill Gaps    Polish       Time         Score
Collection  Blocks       Sequence                  & Connect    & Structure  & Report
```

### Stage 0: Input Collection (Wizard)
- **Input:** Teacher interaction (Express/Guided/Architect lane)
- **Output:** `GenerationRequest` — structured JSON with topic, unit type, constraints, lesson count, context, preferences
- **AI cost:** Zero (no AI calls)
- **Testable:** Schema validation — all required fields present and typed correctly
- **Sandbox view:** The request JSON, editable for testing. Can be saved and replayed.

```typescript
interface GenerationRequest {
  topic: string;
  unitType: string;                    // 'design' | 'service' | 'pp' | 'inquiry' | custom format IDs
  lessonCount: number;
  gradeLevel: string;                  // 'year-7' through 'year-13'
  framework: string;                   // 'IB_MYP' | 'GCSE_DT' | etc.
  constraints: {
    availableResources: string[];      // ['ipads', 'cardboard', '3d-printer']
    periodMinutes: number;
    workshopAccess: boolean;
    softwareAvailable: string[];
  };
  context?: {
    realWorldContext?: string;          // "Students are redesigning packaging for a local business"
    studentContext?: string;            // "Mixed ability, 3 ELL students"
    classroomConstraints?: string;     // "No access to workshop on Tuesdays"
  };
  preferences?: {
    suggestedSequencePattern?: string; // Teacher can suggest a pattern or leave blank for AI
    emphasisAreas?: string[];          // ['collaboration', 'user-research', 'iteration']
    criteriaEmphasis?: Record<string, number>; // Per-criterion weighting
  };
  curriculumContext?: string;          // 'MYP Community Project', 'GCSE D&T', etc.
  curriculumOutcomes?: string[];       // 🔵 [ADDED 4 Apr] Optional: teacher-selected specific curriculum outcomes. If empty, system does best-fit matching at Stage 5.
}
```

### Stage 1: Block Retrieval
- **Input:** `GenerationRequest`
- **Output:** `BlockRetrievalResult` — ranked candidate blocks with relevance scores and metadata
- **AI cost:** Near-zero (database queries + embedding similarity)
- **Testable:** "For this request, what blocks did the system find? Are they relevant?"
- **Sandbox view:** Table of retrieved blocks with scores, expandable to see full content. Visual indicators for relevance strength.

```typescript
interface BlockRetrievalResult {
  request: GenerationRequest;
  candidates: RetrievedBlock[];
  retrievalMetrics: {
    totalBlocksSearched: number;
    candidatesReturned: number;
    avgRelevanceScore: number;
    retrievalTimeMs: number;
    retrievalCost: CostBreakdown;      // Near-zero for DB queries, non-zero if embedding generation needed
  };
}

interface RetrievedBlock {
  block: ActivityBlock;
  relevanceScore: number;             // 0-1 composite
  scoreBreakdown: {
    vectorSimilarity: number;         // 0-1
    efficacyNormalized: number;       // 0-1
    textMatch: number;                // 0-1
    usageSignal: number;              // 0-1
    metadataFit: number;              // 0-1 (bloom, phase, grouping, activity_category match + FormatProfile boost/suppress)
  };
  suggestedPosition?: number;         // Where in the unit this block fits best
  suggestedAdaptations?: string[];    // "Reduce scaffolding", "Shorten for Year 10"
}
```

**Retrieval ranking formula:**
```
score = 0.35 * vectorSimilarity
      + 0.20 * efficacyNormalized
      + 0.20 * metadataFit
      + 0.15 * textMatch
      + 0.10 * usageSignal
```

Where `usageSignal = log(times_used + 1) / log(max_times_used + 1)` — logarithmic so popular blocks don't dominate.

**When library is empty:** Stage 1 returns an empty candidate list. Stage 2 marks all positions as gaps. Stage 3 generates everything. The system works at both extremes.

### Stage 2: Sequence Assembly
- **Input:** `GenerationRequest` + `BlockRetrievalResult`
- **Output:** `AssembledSequence` — ordered slot plan showing which blocks go where, which gaps need generation, prerequisite validation
- **AI cost:** One medium-model call to determine optimal sequence given the blocks and constraints
- **Testable:** "Given these blocks, what sequence was proposed? Are prerequisites satisfied? Are gaps reasonable?"
- **Sandbox view:** Visual sequence with block cards in position. Gaps highlighted in amber. Prerequisite violations flagged in red. Interaction lines between dependent blocks.

```typescript
interface AssembledSequence {
  request: GenerationRequest;
  lessons: LessonSlot[];
  sequenceMetrics: {
    totalSlots: number;
    filledFromLibrary: number;
    gapsToGenerate: number;
    fillRate: number;                  // filledFromLibrary / totalSlots (0-1)
    prerequisiteViolations: PrerequisiteViolation[];
    sequenceTimeMs: number;
    sequenceCost: CostBreakdown;
  };
}

interface LessonSlot {
  position: number;                    // 1-indexed lesson number
  label: string;                       // AI-generated lesson title
  description: string;                 // What happens in this lesson
  activities: ActivitySlot[];          // Ordered activities within this lesson
}

interface ActivitySlot {
  slotIndex: number;
  source: 'library' | 'gap';
  block?: RetrievedBlock;              // If source = 'library'
  gapDescription?: string;            // If source = 'gap' — what needs generating
  gapContext?: {
    precedingBlock?: string;           // What comes before this gap
    followingBlock?: string;           // What comes after
    requiredOutputs?: string[];        // What artifacts this activity must produce
    suggestedBloom?: string;
    suggestedGrouping?: string;
    suggestedTimeWeight?: string;
    suggestedCategory?: string;        // One of 14 activity categories (Section 6.3) — inferred from surrounding blocks
    suggestedPhase?: string;           // FormatProfile phase ID for this gap position
    suggestedLessonRole?: string;      // opening/instruction/core/reflection/warmup/wrapup
  };
  adaptations?: ActivityAdaptation[];  // Modifications for this context
}

interface ActivityAdaptation {
  type: 'familiarity_reduction' | 'scaffolding_adjust' | 'time_adjust' | 'context_inject';
  description: string;
  before?: string;
  after?: string;
}

interface PrerequisiteViolation {
  blockId: string;
  blockTitle: string;
  position: number;
  requiresTag: string;                 // e.g., 'physical_prototype'
  missingFrom: string;                 // "No upstream block produces this output"
  severity: 'hard' | 'soft';
}
```

### Stage 3: Gap Generation
- **Input:** `AssembledSequence` (specifically the gaps)
- **Output:** `FilledSequence` — complete sequence with all gaps filled by AI-generated activities
- **AI cost:** HIGH — this is where most tokens are spent. One call per gap (parallelizable). Cost proportional to number of gaps.
- **Testable:** "For this specific gap, what did the AI generate? Does it match the gap context?"
- **Sandbox view:** Each generated activity shown individually with the gap context that produced it. Token count and cost per gap. Quality indicators per generated activity.

```typescript
interface FilledSequence {
  request: GenerationRequest;
  lessons: FilledLesson[];
  generationMetrics: {
    gapsFilled: number;
    totalTokensUsed: number;
    totalCost: CostBreakdown;
    generationTimeMs: number;
    perGapMetrics: GapMetric[];
  };
}

interface FilledLesson {
  position: number;
  label: string;
  description: string;
  learningGoal: string;
  activities: FilledActivity[];
}

interface FilledActivity {
  source: 'library' | 'generated';
  sourceBlockId?: string;              // If from library
  title: string;
  prompt: string;                      // Student-facing instruction
  bloom_level: string;
  time_weight: string;
  grouping: string;
  phase: string;                       // Format-neutral: uses FormatProfile phase IDs (was 'design_phase')
  activity_category: string;           // One of 14 categories (see Section 6.3): ideation/research/analysis/making/critique/reflection/planning/presentation/warmup/collaboration/skill-building/documentation/assessment/journey
  lesson_structure_role: string;       // opening/instruction/core/reflection/warmup/wrapup — where in the lesson this sits
  response_type: string;
  materials_needed: string[];
  scaffolding?: object;
  ai_rules?: object;
  udl_checkpoints?: string[];
  success_look_fors?: string[];
  output_type?: string;                // What artifact this produces
  prerequisite_tags?: string[];        // What artifacts this requires
  adaptations?: ActivityAdaptation[];  // Context-specific modifications applied
}

interface GapMetric {
  gapIndex: number;
  lessonPosition: number;
  tokensUsed: number;
  cost: CostBreakdown;
  timeMs: number;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
}
```

**Generated activity → library promotion:**
When a teacher saves a generated unit and keeps a gap-filled activity (doesn't delete or substantially rewrite it), that activity is a candidate for the block library. Trigger: on unit save, compare `generation_runs.stage_results.stage3` (original gap-fill output) with final `content_data`. Activities with <20% text diff from the gap-fill original get auto-queued to the review queue with `source_type: 'generated'`, `efficacy_score: 50`. Activities with 20-60% diff get queued with `efficacy_score: 45` (teacher needed to edit). Activities with >60% diff are treated as teacher-authored (not library candidates from generation). Teacher can always manually "Save to Library" from the lesson editor regardless of diff %.

### Stage 4: Connective Tissue & Polish
- **Input:** `FilledSequence`
- **Output:** `PolishedSequence` — same sequence with transitions, cross-references, familiarity adjustments, and scaffolding progression
- **AI cost:** MEDIUM — one call over the full sequence (or per-lesson calls for long units)
- **Testable:** "What did Stage 4 change? Are the transitions coherent? Are cross-references accurate?"
- **Sandbox view:** Side-by-side diff: raw sequence vs polished sequence. Changes highlighted. Cross-reference annotations. Familiarity adaptation labels.

```typescript
interface PolishedSequence {
  request: GenerationRequest;
  lessons: PolishedLesson[];
  polishMetrics: {
    transitionsAdded: number;
    crossReferencesAdded: number;
    familiarityAdaptations: number;
    scaffoldingProgressions: number;
    totalTokensUsed: number;
    totalCost: CostBreakdown;
    polishTimeMs: number;
  };
  interactionMap: BlockInteraction[];
}

interface PolishedLesson extends FilledLesson {
  activities: PolishedActivity[];
}

interface PolishedActivity extends FilledActivity {
  transitionIn?: string;               // How this connects from previous activity
  transitionOut?: string;              // How this connects to next activity
  crossReferences?: CrossReference[];  // References to other activities in the unit
}

interface CrossReference {
  targetLessonPosition: number;
  targetActivityIndex: number;
  referenceText: string;               // "Remember the personas you created in Lesson 2"
  referenceType: 'builds_on' | 'revisits' | 'contrasts' | 'extends';
}

interface BlockInteraction {
  type: 'prerequisite' | 'familiarity' | 'artifact_flow' | 'cross_reference';
  fromLesson: number;
  fromActivity: number;
  toLesson: number;
  toActivity: number;
  description: string;
  confidence: 'verified' | 'inferred';
}
```

### Stage 5: Timing & Structure
- **Input:** `PolishedSequence` + class context (period length, student age, term dates)
- **Output:** `TimedUnit` — lessons with time allocations based on learned patterns (not hardcoded rules)
- **AI cost:** LOW — primarily computation, small AI call for edge cases
- **Testable:** "Given a 55-minute period with Year 9 students, how did it allocate time? Does it fit?"
- **Sandbox view:** Phase timeline bars per lesson. Total time vs available time. Overflow warnings.

```typescript
interface TimedUnit {
  request: GenerationRequest;
  lessons: TimedLesson[];
  timingMetrics: {
    totalMinutesAllocated: number;
    totalMinutesAvailable: number;
    overflowLessons: number[];         // Lesson positions that exceed period
    timingSource: 'learned_pattern' | 'starter_default' | 'teacher_override';
    timingTimeMs: number;
    timingCost: CostBreakdown;
  };
}

interface TimedLesson extends PolishedLesson {
  phases: TimedPhase[];
  totalMinutes: number;
  extensions?: LessonExtension[];
}

interface TimedPhase {
  label: string;                       // From FormatProfile.phases[n].label (e.g., 'Investigate', 'Create', 'Opening'). NOT hardcoded to Workshop Model names. Stage 5 maps activities into phases by their `phase` field, then uses the FormatProfile phase definitions for labels and ordering.
  phaseId: string;                     // FormatProfile phase ID (e.g., 'investigate', 'create')
  activities: PolishedActivity[];
  durationMinutes: number;
  isFlexible: boolean;                 // Can this phase be shortened/extended?
}
```

**How timing works without hardcoded rules:**
- Starter defaults provide initial time allocations based on `time_weight` (quick=5-8min, moderate=10-18min, extended=20-35min, flexible=remaining)
- As the system collects actual `time_spent_seconds` from student tracking, it builds per-context timing models: "Year 9 students in Design units typically spend 14 minutes on moderate brainstorming activities"
- Teacher post-lesson pace feedback ("too fast" / "just right" / "too slow") adjusts the model
- Teacher edits to timing in the lesson editor are the strongest signal
- Phase structure emerges from patterns — if 80% of teachers using the system put a short warm-up at the start, the system learns that pattern. But it doesn't enforce Workshop Model.

🔵 [ADDED 4 Apr — Curriculum Outcome Matching sub-step]
**Stage 5b: Curriculum Outcome Matching** (runs after timing, before quality scoring)
- If `GenerationRequest.curriculumContext` is set AND chunked curriculum data exists for that context:
  - Each lesson/activity is matched against curriculum outcome chunks using embedding similarity
  - Output: `curriculumCoverage` map — per-lesson list of matched outcomes with confidence scores
  - Coverage report: which outcomes are covered, which are missing, which are partially addressed
  - If `GenerationRequest.curriculumOutcomes` was specified (teacher picked specific outcomes at Stage 0), the report flags any requested outcomes that weren't covered
- **Curriculum documents as chunked knowledge:** Curriculum docs (syllabi, schemes of work, standards documents) are ingested via the standard ingestion pipeline but tagged as `document_type: 'curriculum'`. Chunks are tagged with outcome IDs and content descriptors. This means the AI never reads the whole curriculum — it retrieves relevant chunks via embedding search, same as any other knowledge retrieval.
- **Ingestion Pass C (curriculum-specific):** An optional third ingestion pass for documents tagged as curriculum. Extracts: outcome IDs, content descriptors, time allocations, prerequisite chains between outcomes. Runs only on curriculum-tagged uploads — not on lesson plans or general resources.
- **Testable:** "Does this unit cover the required GCSE outcomes? Which ones are missing?"
- **Sandbox view:** Coverage heatmap — outcomes on rows, lessons on columns, colour-coded by confidence.

### Stage 6: Quality Scoring
- **Input:** `TimedUnit`
- **Output:** `QualityReport` — diagnostic scores, coverage analysis, recommendations
- **AI cost:** LOW — mostly computation, optional small AI call for natural-language recommendations
- **Testable:** Always runs. Never blocks output. Purely diagnostic.
- **Sandbox view:** Gauges, scores, per-dimension breakdowns, specific improvement recommendations.

```typescript
interface QualityReport {
  overallScore: number;                // 0-10
  dimensions: {
    cognitiveRigour: DimensionScore;   // Bloom's progression, thinking depth
    studentAgency: DimensionScore;     // Choice, collaboration, peer work
    teacherCraft: DimensionScore;      // Scaffolding, differentiation, UDL
    variety: DimensionScore;           // Grouping mix, activity type mix, energy rhythm
    coherence: DimensionScore;         // Cross-references, prerequisite satisfaction, flow
  };
  coverage: {
    bloomDistribution: Record<string, number>;
    groupingDistribution: Record<string, number>;
    udlCheckpointsCovered: string[];
    udlCheckpointsMissing: string[];
    phasesCovered: string[];            // Format-neutral phase IDs from FormatProfile (was 'designPhasesCovered')
    categoriesCovered: string[];         // Activity categories (Section 6.3) present in the unit
  };
  libraryMetrics: {
    blockReuseRate: number;            // % activities from library vs generated
    avgBlockEfficacy: number;          // Average efficacy of used blocks
    newBlocksGenerated: number;
  };
  costSummary: {
    totalCost: CostBreakdown;
    perLessonCost: CostBreakdown[];
    perStageCost: Record<string, CostBreakdown>;
    comparisonToAverage?: number;      // % cheaper/more expensive than historical average
  };
  recommendations: string[];          // Specific improvement suggestions
}

interface DimensionScore {
  score: number;                       // 0-10
  confidence: number;                  // 0-1 (higher with more data)
  subScores: Record<string, number>;
  flags: string[];                     // Specific issues found
}

interface CostBreakdown {
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  estimatedCostUSD: number;
  timeMs: number;
}
```

---

## 4. The Ingestion Pipeline (Upload → Blocks)

The ingestion pipeline takes uploaded documents and extracts Activity Blocks for the library.

### Design Principle: Start with 2 Passes, Expand When Justified

The previous spec had 9 compartmentalized stages. Per Pre-Build Checklist lesson #8 (don't over-engineer the AI layer), v1 ships with **2 AI passes** that do the essential work. The sandbox architecture makes it trivial to add new passes later — each pass is a function with typed input/output, slotted into the pipeline via a registry. Adding a new pass = write the function + register it. No pipeline refactoring needed.

**Why 2 passes, not 9:** Each AI pass costs tokens, adds latency, and adds a failure point. The old StudioLoom pipeline had 4 passes (0, 1, 2, 2b) and Pass 2b was added only when Pass 2 truncated UDL/Bloom fields (Lesson Learned #26). Same principle: add passes when evidence shows the current passes aren't capturing something important.

### v1 Ingestion Stages

```
Upload ──→ Dedup ──→ Parse ──→ Pass A ──→ Pass B ──→ Extract ──→ Review
           Hash      Non-AI    Classify    Analyse    Blocks     Queue
                               + Tag       + Enrich
```

**Stage I-0: Dedup Check** (no AI)
- SHA-256 hash of uploaded file
- Check against `knowledge_uploads.file_hash`
- If match found: skip all processing, link to existing assets
- **Sandbox view:** Hash result, match/no-match

**Stage I-1: Deterministic Parsing** (no AI)
- Non-AI extraction: heading structure, paragraph breaks, page boundaries, images
- Output: structured document sections with positional metadata
- **Sandbox view:** Parsed document tree showing detected headings, sections, content blocks

**Stage I-2: Pass A — Classify + Tag** (cheap model, ~500-1000 tokens)
- Single AI call that does what old Passes 0+1 did together: document type classification, confidence score, structural outline, section boundaries, detected subject/topic
- Output: `IngestionClassification` — document type, confidence, section map, topic
- **Sandbox view:** Classification result with confidence bar, structural outline with section headers

```typescript
interface IngestionClassification {
  documentType: 'lesson_plan' | 'scheme_of_work' | 'rubric' | 'resource' | 'textbook_extract' | 'worksheet' | 'unknown';
  confidence: number;                    // 0-1
  topic: string;
  sections: IngestionSection[];
  detectedSubject?: string;
  cost: CostBreakdown;
}

interface IngestionSection {
  index: number;
  heading: string;
  content: string;
  sectionType: 'activity' | 'instruction' | 'assessment' | 'metadata' | 'unknown';
  estimatedDuration?: string;            // 'quick' | 'moderate' | 'extended' if detectable
}
```

**Stage I-3: Pass B — Analyse + Enrich** (medium model, ~2000-4000 tokens)
- Single AI call that does what old Passes 2+2b did together: per-section bloom levels, time weights, grouping, materials, scaffolding, activity category, phase mapping, UDL hints
- Takes the classified sections from Pass A as input, enriches each with pedagogical metadata
- Output: `IngestionAnalysis` — enriched sections ready for block extraction
- **Sandbox view:** Phase-by-phase breakdown with metadata pills (bloom, timing, materials, UDL)

```typescript
interface IngestionAnalysis {
  classification: IngestionClassification;
  enrichedSections: EnrichedSection[];
  cost: CostBreakdown;
}

interface EnrichedSection extends IngestionSection {
  bloom_level: string;
  time_weight: string;
  grouping: string;
  phase: string;                         // Format-neutral phase ID
  activity_category: string;             // One of 14 categories
  materials: string[];
  scaffolding_notes?: string;
  udl_hints?: string[];                  // Approximate UDL checkpoint IDs
  teaching_approach?: string;
}
```

**Stage I-4: Block Extraction** (no AI)
- Each enriched section with `sectionType: 'activity'` becomes a candidate Activity Block
- Metadata populated from Pass B enrichment
- PII scan (regex + cheap Haiku call if regex flags potential PII)
- Copyright flag based on upload source marking
- **Sandbox view:** Extracted block cards with all metadata, PII flags, copyright flags

**Stage I-5: Review Queue** (no AI)
- Extracted blocks enter a teacher review queue
- Teacher approves, edits, or rejects each block before it enters the library
- **Sandbox view:** Block review interface with approve/edit/reject per block

### Expandable Pass Architecture

The ingestion pipeline uses a **pass registry** pattern. Each pass is a function conforming to a typed interface:

```typescript
interface IngestionPass<TInput, TOutput> {
  id: string;                            // e.g., 'pass-a-classify', 'pass-b-analyse'
  label: string;                         // Human-readable name for sandbox
  model: string;                         // Default model ID
  run: (input: TInput, config: PassConfig) => Promise<TOutput & { cost: CostBreakdown }>;
}

// Registry
const ingestionPasses: IngestionPass<any, any>[] = [passA, passB];
```

**To add a new pass later:**
1. Write the function conforming to `IngestionPass<InputType, OutputType>`
2. Push it into the registry at the desired position
3. The sandbox automatically shows it as a new step with its own panel
4. The pipeline runner iterates the registry — no conditional logic to update

**Example future passes (add when evidence justifies):**
- **Pass C — Deep UDL Analysis:** If UDL hints from Pass B prove too shallow after testing with real uploads. Focused call on CAST 3×3 framework with 31 checkpoint validation.
- **Pass D — Cognitive Load Curve:** If teachers need cognitive load visualisation for imported content. Computes peak/recovery patterns across sections.
- **Pass E — Cross-Curricular Detection:** If multi-subject schools want to detect links between uploads from different departments. Embedding similarity across teacher libraries.

Each costs ~$0.02-0.05 per document. Only add when the data shows Pass B's output is insufficient for that dimension.

### Unit Import Flow (Existing Unit → Assembled Unit)

When a teacher uploads an existing unit plan (not just a single resource), the system runs the full ingestion pipeline PLUS a reconstruction stage:

**Reconstruction Stage** (medium model call)
- Takes the extracted blocks from Stage I-4
- Detects: lesson boundaries, sequence order, learning progression, assessment points
- Assembles into a unit structure matching the original document as closely as possible
- **Output:** Reconstructed unit + Match Report (side-by-side comparison, per-lesson match %, colour-coded diff)
- **Sandbox view:** Split view with original (left) and reconstruction (right)

---

## 5. The Feedback System

### 5.1 Data Collection (Passive — Always Running)

**Teacher signals (highest value):**
- Edit tracking: what teachers change after generation (deleted, rewritten, reordered, scaffolding changed, kept as-is)
- Timing edits: teacher adjusts phase durations in lesson editor
- Block selection: teacher drags a library block into a unit (explicit approval of that block)
- Block removal: teacher removes a library block from a generated unit (explicit rejection)

**Student signals:**
- `time_spent_seconds` per activity (from useActivityTracking)
- `attempt_number` per activity (revision count)
- `effort_signals` (word count, editing sessions, focus ratio)
- Pace feedback (too slow / just right / too fast)
- Completion rate (started vs completed each activity)

**System signals:**
- Prompt token counts and costs per generation
- Error rates per pipeline stage
- Retrieval hit rates (how often blocks match requests)

### 5.2 Feedback Processing

**Efficacy Score Computation:**

```
For each activity_block:
  teacher_signals = query generation_feedback WHERE source_block_id = block.id
  student_signals = query student_progress tracking data

  kept_rate       = count(kept) / count(all teacher interactions)
  deletion_rate   = count(deleted) / count(all)
  edit_rate       = count(rewritten or scaffolding_changed) / count(all)
  completion_rate = count(students completed) / count(students started)
  time_accuracy   = 1 - abs(avg_actual_time - expected_time) / expected_time
  pace_score      = weighted average of pace feedback (0=too_slow, 0.5=just_right, 1=too_fast → inverted)

  efficacy_score = (
    0.30 * kept_rate +
    0.25 * completion_rate +
    0.20 * time_accuracy +
    0.10 * (1 - deletion_rate) +
    0.10 * pace_score +
    0.05 * (1 - edit_rate)
  ) * 100
```

### 5.3 Approval Queue & Guardrails

**The feedback system PROPOSES changes. It does not silently apply them.**

**Approval queue:**
- Each computed efficacy adjustment appears in a queue on the admin panel
- Shows: block title, current score, proposed score, evidence (how many uses, what signals)
- Teacher approves, rejects, or modifies each adjustment
- Batch-approve available for high-confidence changes (evidence count > N, change < M points)

**Auto-approve threshold (configurable):**
- OFF by default — all changes require manual approval
- Can be enabled with configurable thresholds: min evidence count, max score change per cycle
- Even when auto-approve is ON, all changes logged in audit trail

**Hard guardrails (cannot be overridden without code change):**
- Efficacy cannot drop below 10 or above 95 in a single computation cycle
- `time_weight` cannot change more than one step per cycle (quick→moderate, never quick→extended)
- `bloom_level` changes ALWAYS require manual approval
- `phase` changes ALWAYS require manual approval
- `activity_category` changes ALWAYS require manual approval
- No more than 20% of a block's metadata can change in a single cycle

**Self-healing proposals:**
- When `avg_time_spent` consistently differs from `time_weight` by >50% across 8+ uses
- Proposed change shown with full evidence: "Block #412 tagged `quick` but students average 19 min across 12 uses. Proposed: change to `moderate`."
- Teacher approves or rejects

**Audit log:**
- Every change: what changed, why, evidence, when, who approved (or auto-approved)
- Searchable, filterable, exportable
- Retention: indefinite (small data volume)

### 5.4 Feedback Monitor (Admin Panel)

**Dashboard widgets:**
- **Incoming Signals Feed:** Live log of feedback events with source, block, before/after values
- **Pending Adjustments Queue:** Table of proposed changes awaiting approval
- **Self-Healing Proposals:** Separate queue for metadata corrections
- **Library Health:** Total blocks, added this month, flagged, duplicates, broken links, low-quality queue
- **Efficacy Distribution:** Histogram of block efficacy scores across the library
- **Signal Volume:** How much feedback data is flowing in (teacher edits, student tracking, pace feedback)

---

## 6. Activity Block Architecture

### 6.1 Block Granularity

**Blocks are activity-level** — a single activity lasting 5-80 minutes. One block = one thing students do. A lesson contains multiple blocks arranged in phases. A unit contains multiple lessons. 🔵 [ADDED 4 Apr — changed from 5-35 min. Schools with 80-min periods need longer single-activity blocks e.g. extended prototyping sessions.]

### 6.2 Block Schema

```sql
CREATE TABLE activity_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id),

  -- Identity
  title TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,                 -- Student-facing instruction

  -- Source tracking
  source_type TEXT NOT NULL,            -- 'extracted' | 'generated' | 'manual' | 'community'
  source_upload_id UUID,               -- Which upload this was extracted from
  source_unit_id UUID,                 -- Which unit generation created this
  source_page_id TEXT,
  source_activity_index INT,

  -- Dimensions metadata
  bloom_level TEXT,                     -- remember/understand/apply/analyze/evaluate/create
  time_weight TEXT DEFAULT 'moderate',  -- quick/moderate/extended/flexible
  grouping TEXT DEFAULT 'individual',   -- individual/pair/small_group/whole_class/flexible
  phase TEXT,                            -- Format-neutral: uses FormatProfile phase IDs (e.g., 'investigate', 'create', 'reflect'). NOT design-specific phases. Was 'design_phase' — renamed for multi-format support.
  activity_category TEXT,               -- Pedagogical purpose of the activity. See Section 6.3 for full taxonomy.
                                        -- ideation/research/analysis/making/critique/reflection/planning/
                                        -- presentation/warmup/collaboration/skill-building/documentation/assessment/journey
                                        -- Format-neutral: every format uses these categories, FormatProfile.blockRelevance boosts/suppresses per format.
                                        -- This is the "what kind of thing is this activity" axis — distinct from bloom (cognitive demand),
                                        -- phase (where in cycle), and lesson_structure_role (where in lesson).
  ai_rules JSONB,                      -- { phase, tone, rules[], forbidden_words[] }
  udl_checkpoints TEXT[],              -- ['1.1', '5.2', '7.1']
  success_look_fors TEXT[],            -- Observable success indicators

  -- Interaction metadata
  output_type TEXT,                     -- What artifact this activity produces
  prerequisite_tags TEXT[],            -- What artifacts are required upstream (NOT block IDs)
  lesson_structure_role TEXT,           -- opening/instruction/core/reflection/warmup/wrapup
  response_type TEXT,                   -- short-text/long-text/canvas/toolkit-tool/upload/etc.
  toolkit_tool_id TEXT,                -- If response_type = 'toolkit-tool'

  -- Resources
  materials_needed TEXT[],
  tech_requirements TEXT[],            -- 'none' | 'chromebooks' | '3d-printer' | etc.
  scaffolding JSONB,                   -- Base scaffolding hints (NOT full 3-tier ELL)
  example_response TEXT,

  -- Quality signals (System 4 feeds these)
  efficacy_score FLOAT DEFAULT 50,     -- 0-100, starts neutral
  times_used INT DEFAULT 0,
  times_skipped INT DEFAULT 0,         -- Teacher generated but removed it
  times_edited INT DEFAULT 0,          -- Teacher modified after generation
  avg_time_spent FLOAT,                -- Actual student time (seconds, from tracking)
  avg_completion_rate FLOAT,           -- 0-1

  -- Format context (blocks are format-neutral by design — framework applied at render time)
  -- A block can be used by ANY format. The `phase` field uses neutral phase IDs that FormatProfiles map to their own phases.
  -- Blocks do NOT store a `format_id` — that would couple them to one format. Instead, FormatProfile.blockRelevance
  -- boosts/suppresses at retrieval time based on activity_category and phase. A 'making' block is naturally
  -- less relevant for Service (suppressed) but still available if the teacher searches for it.
  source_format_hint TEXT,             -- Optional: which format context this block was extracted/generated in. NOT a filter — purely for provenance tracking and admin visibility.

  -- Search & discovery
  embedding halfvec(1024),             -- Voyage AI vector
  fts tsvector,                        -- Full-text search
  tags TEXT[],                         -- Freeform tags

  -- 🔵 [ADDED 4 Apr — Assessment, interactive content, and visual AI fields]
  is_assessable BOOLEAN DEFAULT false,  -- Can this block be graded? Any block can be toggled assessable.
  assessment_config JSONB,             -- When is_assessable=true: { rubric_criteria: string[], assessment_type: 'formative'|'summative'|'diagnostic', scoring_method: 'criterion-referenced'|'holistic'|'self'|'peer', rubric_descriptors?: Record<string, string[]> }
  interactive_config JSONB,            -- For toolkit tools / rich interactive blocks: { component_id: string, tool_config: Record<string,any>, ai_endpoint?: string, state_schema?: string, requires_challenge: boolean }
  supports_visual_assessment BOOLEAN DEFAULT false, -- Can AI assess images/photos/sketches submitted to this block?

  -- Data integrity
  pii_scanned BOOLEAN DEFAULT false,
  pii_flags JSONB,                     -- Results of PII scan
  copyright_flag TEXT DEFAULT 'own',   -- 'own' | 'copyrighted' | 'creative_commons' | 'unknown'
  teacher_verified BOOLEAN DEFAULT false,

  -- Loominary OS migration seams (Section 19)
  module TEXT DEFAULT 'studioloom',    -- Which Loominary app owns this block. Enables cross-app retrieval later.
  media_asset_ids UUID[],              -- References to content_assets extracted from source document (images, diagrams)

  -- Lifecycle
  is_public BOOLEAN DEFAULT false,     -- Only true after PII scan + teacher approval
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_blocks_teacher ON activity_blocks(teacher_id);
CREATE INDEX idx_blocks_bloom ON activity_blocks(bloom_level);
CREATE INDEX idx_blocks_phase ON activity_blocks(phase);
CREATE INDEX idx_blocks_category ON activity_blocks(activity_category);
CREATE INDEX idx_blocks_time ON activity_blocks(time_weight);
CREATE INDEX idx_blocks_efficacy ON activity_blocks(efficacy_score);
CREATE INDEX idx_blocks_source ON activity_blocks(source_type);
CREATE INDEX idx_blocks_module ON activity_blocks(module);
CREATE INDEX idx_blocks_embedding ON activity_blocks USING ivfflat (embedding halfvec_cosine_ops);
CREATE INDEX idx_blocks_fts ON activity_blocks USING gin (fts);
```

### 6.3 Activity Category Taxonomy

The `activity_category` field captures the **pedagogical purpose** of an activity — what kind of thing it IS, not where it sits in the cycle (phase), what cognitive level it demands (bloom), or where it goes in a lesson (lesson_structure_role).

**14 categories (format-neutral):**

| Category | What it means | Example activities |
|----------|--------------|-------------------|
| `ideation` | Generating ideas, brainstorming, divergent thinking | Blind swap, constraint removal, SCAMPER, brainstorm web, concept mashup |
| `research` | Gathering information, investigating, user research | Expert interview, product autopsy, user shadowing, surveys, site visits |
| `analysis` | Breaking down, examining, comparing, sense-making | Five whys, stakeholder mapping, SWOT, systems map, affinity diagramming |
| `making` | Prototyping, building, hands-on construction, testing | Parallel prototypes, material testing, skill station rotation, workshop tasks |
| `critique` | Peer review, feedback, evaluation of work product | Silent gallery walk, warm/cool feedback, two-stars-a-wish, role-reversal critique |
| `reflection` | Metacognition, journaling, self-assessment, process documentation | Exit ticket, one-word whip, process timeline, if-I-started-again |
| `planning` | Project management, timelines, task breakdown, goal setting | Action plan backwards, Gantt chart, sprint planning, resource allocation |
| `presentation` | Communicating, exhibiting, pitching, sharing | Pecha kucha, museum exhibit, elevator pitch, portfolio review |
| `warmup` | Icebreakers, activators, skill priming, hooks | Design challenge 30-sec, odd-one-out, what-if machine, vocab charades |
| `collaboration` | Structured group work, negotiation, team dynamics | Think-pair-share, jigsaw expert groups, world cafe, design sprint |
| `skill-building` | Direct instruction, technique practice, demos, guided practice | Tool demo, technique walkthrough, worked example, scaffolded challenge |
| `documentation` | Recording process, evidence collection, portfolio building | Time-lapse process, annotated sketch, design journal entry, photo evidence |
| `assessment` | Knowledge checks, quizzes, retrieval practice, scenario-based testing | Self-check quiz, flashcard drill, decision scenario, case study response, budgeting simulation | 🔵 [ADDED 5 Apr — 14th category. Required for MiniSkills in non-design subjects (psychology, finance, time management) where testing understanding is a core activity type. Distinct from `reflection` (metacognition about process) and `critique` (evaluating others' work) — assessment is about checking the learner's own knowledge/skills against criteria.] |
| `journey` | Multi-step guided experiences, discovery flows, client meetings, onboarding | Discovery Engine, Real Client meetings, Open Studio setup, skill-building journeys | 🔵 [ADDED 4 Apr — 13th category. Journey blocks are multi-activity containers that can be dragged into lessons. The Discovery Engine is the reference implementation. Journeys can span single sessions (Discovery) or multiple sessions (Real Client meetings across a unit).]

**How FormatProfile uses these:**

The `blockRelevance.boost` and `blockRelevance.suppress` arrays reference these category IDs:
- **Design:** boosts `ideation`, `making`, `critique`; suppresses nothing
- **Service:** boosts `research`, `collaboration`, `reflection`, `planning`; suppresses `making`, `skill-building`
- **PP:** boosts `reflection`, `planning`, `documentation`, `presentation`; suppresses `making`, `skill-building`
- **Inquiry:** boosts `research`, `analysis`, `collaboration`; suppresses `making`

**Relationship to tags:**
`activity_category` is a single controlled value per block (exactly 1 of 14). `tags[]` is freeform and can carry any number of cross-cutting labels (e.g., `sustainability`, `digital-tools`, `outdoor`, `MYP-specific`). A block can be `category: 'research'` AND `tags: ['sustainability', 'fieldwork', 'community']`.

**Relationship to Teaching Moves categories:**
The old Teaching Moves library had categories that map directly: ideation→ideation, critique→critique, research→research, making→making, reflection→reflection, warmup→warmup, collaboration→collaboration, service/PP→planning+reflection, presentation→presentation, differentiation→skill-building, inquiry→research+analysis, digital→documentation. When Teaching Moves are converted to seed blocks (Appendix A), each move gets assigned one of these 14 categories.

### 6.4 Block Interaction Model

**Layer A: Static Prerequisites (checked in Stage 2)**
- Stored as `prerequisite_tags` on blocks (tag-based, not block-ID-based)
- A block requiring a prototype checks: "is there an upstream block with `output_type` containing 'prototype'?"
- Hard prerequisites (safety before shop tools) are non-negotiable constraints
- Soft prerequisites (critique after prototype) are strong recommendations

**Layer B: Familiarity Adaptation (applied in Stage 4)**
- When the same block type appears twice in a sequence, the second instance gets:
  - Reduced scaffolding (students already know the format)
  - Potentially shorter time weight
  - Variation instruction ("This time, test with a different material")
- The AI in Stage 4 handles this — it sees the full sequence and adjusts
- **Format-aware:** Familiarity adaptation consults `FormatProfile.connectiveTissue.reflectionStyle` to decide how repeated blocks are handled. For `continuous` reflection formats (Service), repeated reflection blocks are expected — reduce scaffolding but don't shorten. For `end-only` formats (Design), repeated reflections are unusual — flag for review. The `repeatablePhases` array in `FormatProfile.sequenceHints` tells the system which phases legitimately repeat.
- System learns familiarity patterns from teacher edits: if teachers consistently shorten repeated activities, the system internalizes that

**Layer C: Cross-Block State (generated in Stage 4)**
- Activity A produces output that Activity B references
- AI generates cross-references: "Use the personas you created in Lesson 2 to evaluate..."
- NOT stored as rigid metadata — generated at assembly time based on the specific sequence
- Confidence markers: 'verified' (prerequisite chain guarantees the connection) vs 'inferred' (AI's best guess)

### 6.5 Block Library Seeding

**The library starts empty.** Matt curates what goes in.

**Seeding sources (all require manual approval):**
1. **Teacher uploads** — documents processed through ingestion pipeline, blocks extracted, teacher reviews each block
2. **Teaching Moves Library** — ~65 expert-curated moves. Full list included in Appendix A of this spec for Matt to review before any are converted. Each approved move becomes a block with `source_type: 'community'`, `efficacy_score: 65` (above neutral since expert-curated)
3. **Manual creation** — teachers create blocks from scratch via CRUD UI
4. **Generated blocks** — when Stage 3 generates a new activity that a teacher keeps (doesn't edit or delete), it's saved as a new block with `source_type: 'generated'`, `efficacy_score: 50`

**Starting efficacy by source type:**
- `extracted` (from uploads): `efficacy_score: 50` (neutral — no usage data yet, teacher approved but unproven)
- `generated` (from gap-fill): `efficacy_score: 50` (neutral — teacher kept it, but one data point)
- `manual` (teacher-created): `efficacy_score: 55` (slight boost — teacher deliberately crafted it)
- `community` (seed blocks from Teaching Moves): `efficacy_score: 65` (expert-curated, above neutral)

**NO automatic seeding from existing units.** Legacy units are not quality-controlled to the standard required.

---

## 7. The Sandbox System

### 7.1 Design Philosophy

The sandbox is the **command center** for the entire pipeline. It is built FIRST, before any pipeline stages. Each stage is plugged in as it's developed.

**Metaphor: Step-through debugger**, not "click and wait."

### 7.2 Generation Sandbox

**Controls:**
- **Run All:** Executes full pipeline, shows results per stage with timing
- **Step:** Runs one stage at a time. Inspect output, optionally edit, then Step again.
- **Compare Mode:** Run same input through two configs side by side, stage-by-stage comparison

**Per-stage model selection:**
Each pipeline stage has a model dropdown (Haiku / Sonnet / Opus / Groq / Gemini). Swap models per stage and see cost/time/quality differences in real time.

| Stage | Default Model | Notes |
|-------|--------------|-------|
| Stage 1: Retrieval | N/A (database) | No AI cost |
| Stage 2: Assembly | Sonnet | Needs pattern understanding |
| Stage 3: Gap Fill | Sonnet | Creative generation, highest cost |
| Stage 4: Polish | Haiku | Editing, not creating |
| Stage 5: Timing | Haiku | Mostly computation |
| Stage 6: Scoring | N/A (computation) | No AI cost |

**Per-stage visual diagnostics:**

Each stage panel shows:
- **Status indicator:** Green (passed) / Amber (warnings) / Red (failed)
- **Prompt length bar:** Tokens used vs model context window. Green <50%, Amber 50-80%, Red >80%
- **Output conformance grid:** Expected fields vs actual fields, with status dots per field
- **Cost bar:** Proportional to total cost — visually dominant if this stage is expensive
- **Time bar:** Proportional to total time — visually dominant if this is the bottleneck
- **Quality flags:** Stage-specific heuristic checks (e.g., "Retrieved 0 blocks" = red in Stage 1)

**Batch testing:**
- Define test cases: topic + unit type + constraints (save as JSON)
- Run all test cases through pipeline with selected config
- Results table: per-case cost, time, quality scores, block reuse %, fill rate
- Compare runs: before/after prompt change, before/after model swap

**Timer:**
- Per-stage wall-clock time
- Total pipeline time
- Historical comparison: "This generation took 45s. Average for similar requests: 38s."

### 7.3 Ingestion Sandbox

Same step-through pattern for the ingestion pipeline:
- Upload a document, step through each pass (v1: Pass A classify + Pass B analyse)
- See per-pass input/output/time/cost/model — each pass has its own sandbox panel
- New passes added via the pass registry automatically appear as new sandbox panels (zero UI work to add a pass)
- Block extraction results with approve/edit/reject per block
- "Add Pass" button in sandbox for testing experimental passes before promoting to production
- Unit reconstruction with match report for unit imports

### 7.4 Feedback Sandbox

Dedicated section for monitoring the feedback/learning system:

- **Incoming Signals Feed:** Live log of feedback events
- **Pending Adjustments Queue:** Proposed efficacy/metadata changes awaiting approval
- **Self-Healing Proposals:** Proposed metadata corrections with evidence
- **Library Health Dashboard:** Total blocks, flagged, duplicates, broken links, quality floor
- **Audit Log:** Full history of all feedback system actions
- **Guardrail Config:** View and adjust auto-approve thresholds and hard limits

### 7.5 FrameworkAdapter Testing Panel

The sandbox includes a dedicated FrameworkAdapter testing panel accessible from the admin section (under Sandbox tab → "Adapter Tests").

**Why this needs a test panel:** The FrameworkAdapter maps 8 neutral keys × 8+ frameworks = 64+ mappings, plus non-design unit types. Bugs will be in edge cases: missing mappings showing `null` labels, merged keys (MYP A = researching + analysing) rendering wrong, new frameworks having incomplete coverage.

**Testing capabilities:**

1. **Mapping Matrix View:** 8×8 grid showing every neutral key → framework mapping. Each cell shows the resolved label, key, and color. Empty cells (no mapping) shown in red. Click any cell to see the full `mapCriterion()` output.

2. **Unit Preview Mode:** Select a unit (or use sample data) + pick a framework → renders the full student lesson page with the adapter applied. Switch framework in a dropdown and see the same unit re-rendered instantly. Side-by-side comparison: pick 2 frameworks, see the same unit rendered for both.

3. **Batch Validation:** One-click test that calls `mapCriterion()` and `getAllCriteria()` for every combination of neutral key × framework × unit type. Outputs a report: green = valid mapping, amber = maps to null (expected for some keys), red = throws error. Exportable.

4. **Round-Trip Test:** For each framework, takes a framework-specific key (e.g., "Criterion B" for MYP), runs `reverseMap()` to get neutral keys, then runs `mapCriterion()` on each neutral key to verify it maps back. Flags any round-trip that doesn't produce the original key.

5. **Grading UI Test:** Simulates the grading page with a selected framework. Verifies that `getAllCriteria()` returns the correct number and order of criteria, that colors match the framework's convention, and that scores can be assigned to each.

**Automated regression:** These tests also run as Vitest unit tests (`src/lib/framework/__tests__/adapter.test.ts`) — the sandbox panel is the visual version for manual exploration and debugging. The Vitest suite runs on every deploy.

🔵 [ADDED 4 Apr — Matt Q14] **Testability confirmation:** Yes, the FrameworkAdapter output is fully visible and testable. The sandbox test panel (described above) lets you see exactly what the adapter produces for any neutral key × framework combination. The Unit Preview Mode renders a complete student lesson page with the adapter applied — you can switch frameworks in a dropdown and see the same unit re-rendered instantly. This is not hidden plumbing — it's a visual, inspectable system. Additionally, the Vitest unit tests catch regressions automatically on every deploy, so a broken mapping never ships silently.

### 7.6 Pipeline Simulator (Pre-Build Validation)

**Purpose:** Before the real pipeline is built, a lightweight simulator tests the architecture with mock data. Finds interface mismatches, type errors, and flow issues at design time — not after 3 days of coding.

**How it works:**
- Each of the 6 pipeline stages gets a `SimulatedStage` that implements the same `StageInput → StageOutput` typed contract as the real stage
- Simulated stages use hardcoded data or simple heuristics instead of real AI calls
- The simulator runs the full pipeline flow: Stage 0 → 1 → 2 → 3 → 4 → 5 → 6, passing typed outputs between stages
- Any type mismatch between stages is caught at compile time (TypeScript) or runtime (assertion checks)

**Simulated stage behaviour:**

| Stage | Simulated Behaviour | Cost |
|-------|---------------------|------|
| Stage 0 (Input) | Returns sample `GenerationRequest` from JSON fixtures | Zero |
| Stage 1 (Retrieve) | Returns 5-10 hardcoded blocks from fixtures matching topic keywords | Zero |
| Stage 2 (Assemble) | Arranges blocks by phase, inserts gaps | Zero |
| Stage 3 (Gap-Fill) | Returns templated activities with `[GENERATED]` markers | Zero |
| Stage 4 (Polish) | Returns input unchanged with `[POLISHED]` markers | Zero |
| Stage 5 (Timing) | Applies simple arithmetic (equal time per activity) | Zero |
| Stage 6 (Score) | Returns deterministic scores based on block metadata | Zero |

**What it validates:**
- TypeScript interfaces compile correctly (all `StageInput`/`StageOutput` types chain)
- FormatProfile injection works at every stage (run simulator with Design vs Service profile, verify different blocks/patterns/timing)
- FrameworkAdapter renders correctly for simulated output
- Edge cases: empty block library (all gaps), 1-lesson unit, 20-lesson unit, mixed unit types
- The sandbox UI renders all stages correctly with simulated data

**Build cost:** ~1 day. TypeScript types + JSON fixtures + simple heuristic functions. No AI calls, no database. Can run entirely in Vitest or in the sandbox UI.

**When to build:** Phase A, immediately after defining TypeScript interfaces (A1). The simulator validates the interfaces before any real implementation begins. It becomes the first batch test in the sandbox — real stages replace simulated ones as they're built.

### 7.7 Block Interaction Visualization

When viewing an assembled sequence (Stage 2 output or later), the sandbox shows:

- **Prerequisite chains:** Connecting lines between dependent blocks. Green = satisfied, Red = violated.
- **Familiarity links:** Dotted lines between repeated block types with adaptation labels ("2nd use: scaffolding reduced, time -30%")
- **Artifact flow diagram:** What outputs each block produces, what inputs each block expects. Green lines = connected, Red = broken, Amber = inferred.
- **Cross-reference annotations:** Stage 4 additions highlighted as overlays on the sequence
- **Interaction summary panel:** "3 prerequisite chains, 2 familiarity adaptations, 5 artifact flows, 4 cross-references." Click any category to highlight only those relationships.

🔵 [ADDED 4 Apr — Block Interaction Testing Tab]
### 7.7b Block Interaction Sandbox Tab

The visualization in 7.7 shows interactions within a full pipeline run. But when debugging interaction issues, you need to **isolate block interactions from other pipeline variables.** The Block Interaction tab provides this:

- **Manual block selection:** Pick 2-8 blocks from the library manually (search or browse)
- **Layer-by-layer testing:**
  - Layer A (Prerequisites): shows prerequisite chain analysis — which blocks require what, what's missing, what's satisfied
  - Layer B (Familiarity): simulates repeated exposure — shows how scaffolding, timing, and content adapt on 2nd/3rd use of similar blocks
  - Layer C (Cross-block state): shows what state transfers between blocks — what artifacts are produced/consumed, what context carries forward
- **Independent from pipeline:** No Stage 0 input needed. You're just testing "if these blocks are placed in this order, what happens to their interactions?"
- **Export to pipeline:** Once a block sequence passes interaction testing, export it as a fixture that can be injected into the main pipeline sandbox at Stage 2 (Assembly) — lets you test how your tested interactions behave in a full generation
- **Diff view:** Change the block order and see how interactions change side-by-side

This separation means when a generated unit has interaction issues, you can export just the problematic blocks to this tab and debug without re-running the full pipeline.

### 7.8 Generation Log

Every generation writes a timestamped entry to a `generation_runs` table:

```sql
CREATE TABLE generation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Input
  generation_request JSONB NOT NULL,
  format_id TEXT,                       -- Which format this generation used (e.g., 'design', 'service', 'pyp-exhibition'). Scopes generation to per-format sandbox tabs.

  -- Per-stage snapshots
  stage_results JSONB NOT NULL,        -- { stage0: {...}, stage1: {...}, ... }

  -- Summary metrics
  total_cost_usd FLOAT,
  total_time_ms INT,
  total_tokens INT,
  quality_score FLOAT,
  block_reuse_rate FLOAT,

  -- Config used
  model_config JSONB,                  -- { stage1: 'haiku', stage3: 'sonnet', ... }

  -- Outcome
  unit_id UUID,                        -- If saved as a unit
  status TEXT                          -- 'completed' | 'failed' | 'sandbox_only'
);
```

Viewable on admin settings page. Filterable by date, model config, cost range, quality score.

**Supporting tables for per-format sandbox:**

```sql
-- Test case fixtures, scoped to format
CREATE TABLE sandbox_test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format_id TEXT NOT NULL,              -- 'design', 'service', custom format IDs
  label TEXT NOT NULL,                  -- Human-readable test case name
  generation_request JSONB NOT NULL,    -- Full GenerationRequest fixture
  expected_outcomes JSONB,              -- Optional: expected fill rate, quality floor, etc.
  created_by UUID REFERENCES teachers(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sandbox_tests_format ON sandbox_test_cases(format_id);

-- Per-format model overrides and config
CREATE TABLE sandbox_format_config (
  format_id TEXT PRIMARY KEY,           -- Matches format_profiles.id or built-in format IDs
  model_overrides JSONB,               -- Per-stage model selection: { stage1: 'haiku', stage3: 'sonnet', ... }
  influence_sliders JSONB,             -- Per-stage influence 0-100%: { stage1: 100, stage3: 80, ... }
  notes TEXT,                           -- Admin notes about this format's sandbox state
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 7.9 Per-Format Sandbox Tabs

**Problem:** When testing the pipeline for Design units, you don't want Service or PP config polluting the results — and vice versa. Each format has its own FormatProfile, block relevance rules, sequence patterns, timing modifiers, and Pulse weights. Testing them together creates confusion about which format caused which behaviour.

**Solution: Each format gets its own sandbox tab.** Completely isolated. Independent test cases, independent model config, independent generation history.

**Tab structure:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Sandbox                                                          │
├──────────┬──────────┬──────┬──────────┬──────────┬──────────────┤
│  Design  │  Service │  PP  │  Inquiry │  Art (?)  │  + Custom   │
│  ✓ Live  │  Draft   │ Draft│  Draft   │  Draft    │              │
└──────────┴──────────┴──────┴──────────┴──────────┴──────────────┘
```

**Tab states:**
- **Live** (green dot): Format is production-ready, pipeline generates units with this FormatProfile
- **Draft** (amber dot): Format exists in sandbox for testing, not available to teachers yet
- **New** (gray dot): Blank FormatProfile template, not yet configured

**What's on each tab (identical layout, different data):**
1. **FormatProfile Inspector** — read-only view of the active FormatProfile for this format. Every field visible. Click any field to see where it's used in the pipeline.
2. **Generation Sandbox** — same step-through debugger as 7.2, but hardcoded to this format's FormatProfile. Test cases are per-format (Design test cases stay in Design tab). Run All / Step / Compare.
3. **Block Library View** — filtered to blocks relevant to this format (blocks where `phase` matches this format's phase IDs, or `activity_category` is in the format's boosted categories). Shows block count, coverage gaps, efficacy distribution.
4. **Sequence Pattern Inspector** — which sequence patterns this format uses, with weights. Visual timeline of a generated unit using this format's default pattern.
5. **Pulse Calibration** — run Pulse scoring with this format's weights. Compare: "How would the same unit score under Design weights vs Service weights?"
6. **Test Results History** — per-format generation log. Filter: model, date, cost, quality. Compare runs within this format only.

**Isolation guarantees:**
- Each tab has its own `generation_runs` entries tagged with `format_id`
- Test cases are scoped to the tab — Design test cases don't appear in Service tab
- Model config overrides are per-format (you can test Haiku for Design Stage 3 while keeping Sonnet for Service Stage 3)
- FormatProfile edits in Draft mode don't affect the Live profile until explicitly promoted

**Build order: Design first, then port.**
1. Build the Design tab fully functional with the real pipeline
2. Once Design works end-to-end, duplicate the tab for Service — common infrastructure (step-through, diagnostics, block viewer) is shared React components. Only the FormatProfile and test fixtures change.
3. Port PP, Inquiry in the same way — ~30 min per format to set up fixtures + FormatProfile
4. Art and any future formats use the "+ Custom" flow (see Section 14.9.1)

**Shared components (render in every tab):**
- `SandboxStepThrough` — the 6-stage step-through debugger with stage panels
- `SandboxDiagnostics` — status indicators, prompt length bars, conformance grids
- `SandboxBatchRunner` — batch test execution and comparison
- `SandboxBlockViewer` — block library browser with filters
- `SandboxPulseCalibration` — Pulse gauge comparison

**Per-tab config (stored per format):**
- `FormatProfile` object (read from code for built-in formats, from DB for custom)
- Test case fixtures (JSON, stored in `sandbox_test_cases` table with `format_id` FK)
- Model overrides per stage (JSONB on `sandbox_format_config` table)
- Generation history (filtered view of `generation_runs` by `format_id`)

---

## 8. Data Integrity & Security

### 8.1 Database Integrity

**Activity blocks in proper table, not JSONB.**
The single biggest integrity improvement. SQL foreign keys, proper indexes, atomic row-level operations. No more JSONB blob corruption risk for core entities.

**Write-ahead versioning on content_data.**
Before any PATCH to `units.content_data` or `class_units.content_data`, snapshot the current value into `unit_versions`. If a write corrupts, roll back. Already partially built (unit_versions table exists from migration 040) but underused.

**Referential integrity checks (scheduled job).**
Weekly cron that scans for:
- Orphaned student_progress records (references page_id that no longer exists in any content_data)
- Broken block references (content_data references a block_id that doesn't exist in activity_blocks)
- Empty forks (class_units.content_data = {} — the Lesson Learned #27 bug)
- Duplicate blocks (>92% embedding similarity)
- Stale feedback references (generation_feedback referencing deleted blocks)
Reports to admin dashboard. Does not auto-fix — flags for review.

**Supabase Point-in-Time Recovery.**
Verify enabled on Pro plan. 7-day PITR means any corruption can be rolled back to the minute.

### 8.2 Security

**RLS policy audit.**
Every new table gets an RLS audit before deployment. Pattern: write policies first, test with different user roles, then add data. Lesson Learned #29 — RLS failures are silent.

**Student token session security.**
Current: nanoid(48) tokens, 7-day TTL. Acceptable for current stage. Future consideration: IP binding, device fingerprinting, shorter TTL with refresh.

**API key protection.**
BYOK keys AES-256-GCM encrypted. Service role key in env vars. Sentry scrubbing rules for sensitive fields.

**AI prompt injection defense.**
Student text goes into AI prompts (Design Assistant, toolkit tools). Current mitigation: Haiku model, 300-token cap, response structure validation. Dimensions3 addition: input sanitization layer before any student text is injected into a generation prompt.

### 8.3 PII & Copyright Protection

**PII scanning on blocks:**
- Automated scan (regex + small AI call) before any block can be `is_public`
- Flags: school names, teacher names, student names, specific locations, email addresses, dates
- Teacher review gate: resolve all flags before block goes public
- Sandbox test button to verify scanner on known examples

**Copyright protection:**
- `copyright_flag` field on blocks: 'own' | 'copyrighted' | 'creative_commons' | 'unknown'
- Upload-time question: "Is this your own material or published content?"
- Copyrighted blocks permanently teacher-scoped (`is_public = false`, cannot be changed)
- Substantial reproduction detection: flag blocks with >50 consecutive words from a known source
- Metadata is always shareable (bloom level, structure pattern, timing) — just not copyrighted text

### 8.4 Student Data Removal

**Cascade delete function:** One API endpoint that takes a student_id and removes all associated data.

**Hard delete (PII data):**
- `students` row (name, login credentials, learning_profile, mentor_id, theme_id)
- `student_sessions` (auth tokens)
- `class_students` junction entries
- `student_progress` (all lesson responses, integrity_metadata, tracking data)
- `student_badges` / `safety_results` / `safety_sessions`
- `competency_assessments` (NM data)
- `gallery_submissions`
- `discovery_sessions`
- `student_tool_sessions`
- `open_studio_status` / `open_studio_sessions`

**Anonymize (data serves others):**
- `gallery_reviews` written BY this student: set `reviewer_id = NULL`, `reviewer_name = 'Anonymous'`. Review content stays (it's about the other student's work).
- `ai_usage_log` entries: strip student_id, keep aggregate data for cost tracking.

**Verification:**
- After deletion, run a check query: "SELECT count(*) FROM [each table] WHERE student_id = [deleted_id]"
- All must return 0 (except anonymized tables which return 0 for the student_id column)
- Sandbox includes a "Test Student Deletion" function that creates a test student, populates sample data across all tables, runs the deletion, and verifies the cascade

---

## 9. Library Health & Freshness

### 9.1 Scheduled Hygiene Cycles

**Weekly automated checks:**

| Check | Action | Severity |
|-------|--------|----------|
| Broken link detection | Test all external URLs in blocks. Flag broken. | Amber |
| Duplicate detection | Embedding similarity >92% between blocks. Flag pairs. | Amber |
| Quality floor sweep | Blocks with efficacy <20 after 10+ uses. Flag for review. | Red |
| Garbled content detection | Blocks with >30% non-ASCII, <10 words, no sentences, repeated phrases. | Red |
| Stale metadata | Blocks where time_weight corrected 2+ times (oscillating). | Amber |
| Orphan detection | Blocks with source_upload_id pointing to deleted uploads. | Blue (info) |

**Monthly automated checks:**

| Check | Action | Severity |
|-------|--------|----------|
| Usage cold spots | Blocks never used in 6+ months. Flag for archive consideration. | Blue (info) |
| Efficacy plateau | Blocks stuck at exactly 50 (no feedback data at all). | Blue (info) |
| Category balance | Library heavily skewed to one bloom_level, activity_category, or phase. Suggest gaps. | Blue (info) |

### 9.2 Library Health Dashboard

Admin panel widget showing:
- Total blocks (by source_type)
- Blocks added this month
- Flagged blocks (by category, clickable to review queue)
- Duplicate candidates
- Broken links count
- Low-quality queue size
- Overall health indicator (green/amber/red)
- Efficacy distribution histogram
- Coverage gaps (e.g., "No blocks for bloom_level: evaluate in phase: test" or "No 'critique' category blocks for the 'investigate' phase")

---

### 9.3 Operational Automation (Solo Dev Load Reduction)

Seven systems that keep a solo developer sane by detecting problems automatically and surfacing them for human decision:

**1. Pipeline Health Monitor (always-on)**
Single status page: last 24h generation success/failure rate, average generation time (with trend), cost-per-generation trend, ingestion queue depth, API error rate by route. One traffic light per pipeline (green/amber/red). Check once a day, 30 seconds.

**2. Cost Alert System**
Automated checks: daily AI spend exceeds threshold (e.g. $5), single generation exceeds 3x rolling average cost, monthly spend trending over budget. Notification via scheduled task checking `ai_usage_log` aggregates.

**3. Quality Drift Detector**
Weekly automated check: average Lesson Pulse score for units generated this week vs last 4 weeks (drop >1 point = flag). Block reuse rate trend (should go UP over time). Fill rate trend (% gap-fill vs library — should go DOWN). Three numbers that tell you if the learning machine is actually learning.

**4. Teacher Edit Tracker Dashboard**
Shows: most-edited blocks (need improvement), most-deleted blocks (bad), patterns teachers add that system didn't suggest (gaps). Weekly digest: "12 edits, 3 deletions, 2 new patterns. Top edited: [X]. Action: review [X]'s prompt." Product feedback loop without talking to anyone.

**5. Stale Data Watchdog**
Weekly sweep for: teacher profiles not updated 6+ months (stale style learning), blocks with `pii_scanned = false` older than 7 days (scanning stuck), `generation_runs` with `status = 'failed'` spiking, empty discovery sessions (UX problem), orphaned junction entries. Results on admin dashboard.

**6. Automated Smoke Tests**
5-10 minimal generation requests run after every deploy (or daily): pipeline produces valid output, each stage returns expected fields, block library is queryable, feedback system accepts events, student deletion cascade works. Notification on failure before teachers hit it.

**7. Usage Analytics Dashboard**
Product usage (not cost): active teachers this week, units generated, blocks in library (growth curve), student sessions, toolkit tool usage, discovery completions, gallery rounds. Answers "is anyone using this?" and "what do they use most?" Critical for prioritisation.

**Pattern:** All 7 systems follow the same model — automated detection, notification to human, human decision. Nothing auto-fixes. You stay in control but you're not manually checking 50 things.

---

## 10. Decisions (Resolved 3 April 2026)

1. **Blocks are activity-level.** One block = one activity (5-80 min). Lessons contain multiple blocks. 🔵 [ADDED 4 Apr — widened from 5-35]
2. **Library starts empty.** Matt curates all seeding. No automatic import from legacy units.
3. **Teaching Moves → Seed Blocks.** 55 Teaching Moves converted to seed Activity Blocks, then Teaching Moves Library deleted. All MYP-specific language stripped — blocks must be framework-neutral. Framework vocabulary applied at generation Stage 4 (Connective Tissue), not stored on blocks.
4. **Wizard front-end stays.** Express/Guided/Architect lanes. Backend becomes 6-stage pipeline.
5. **Sandbox built first.** Pipeline stages plugged in incrementally.
6. **Intermediate results stored.** `generation_runs` table with per-stage JSONB snapshots.
7. **Errors produce warnings, not failures.** Always generate output. Be transparent about quality.
8. **No hardcoded sequences or timing rules.** Starter defaults → learned patterns.
9. **Feedback loop has approval queue.** No silent data mutation.
10. **Ingestion simplified to 2 AI passes for v1.** Pass A (classify + tag, cheap model) + Pass B (analyse + enrich, medium model) replace old 4-pass system. Pass registry pattern makes adding new passes trivial — write function, register, sandbox auto-shows new panel. Add passes only when real uploads prove the current passes miss critical data. Block extraction + review queue at exit.
11. **PII scanning before sharing.** Automated scan + teacher review gate.
12. **Copyright flagging at upload.** Copyrighted content permanently teacher-scoped.
13. **Student data removal built from day 1.** Cascade delete + anonymization + verification.
14. **Library health maintenance automated.** Weekly/monthly hygiene cycles with admin dashboard.
15. **Unit Import flow.** Upload existing unit → reconstruct → match report.
16. **Block search uses composite ranking.** Relevance (30%) + Efficacy (25%) + Context match (20%) + Teacher affinity (15%) + Freshness (10%). Overuse penalty demotes blocks already in the current unit. Top 5-8 results + "Something different?" section with 2-3 high-efficacy blocks the teacher hasn't used. Diversity injection within a unit — similar blocks to ones already placed are demoted.
17. **Per-stage impact rating.** Each pipeline stage reports influence metrics in sandbox: library vs generated %, learned pattern match score, gap count, voice match strength, pace data availability, Pulse scores. Visible in sandbox diagnostic panel. Each stage has an influence slider (0-100%) in admin settings — dial back any stage's contribution.
18. **5 named Sequence Patterns as soft suggestions.** Workshop Classic, Investigation First, Iterative Sprint, Critique & Refine, Skill Build. Teachers can create and save their own named patterns. All patterns sandboxable — test any pattern against a unit brief, side-by-side comparison. Patterns are learned and evolve — starters are provisional.
19. **Work time allocation sandboxable.** Default 15/70/15 split (opening/core/reflection) with draggable sliders in sandbox. Changes reflected in generated output immediately.
20. **API provider abstraction for easy switching.** Admin settings panel to pick model per pipeline tier (Tier 1 ingestion, Tier 2 analysis, Tier 3 generation). "Test with this model" button for side-by-side output comparison. Keep Anthropic as primary (reliable VPN from China), but architecture supports DeepSeek, Qwen, Moonshot as drop-in alternatives for cost optimization.
21. **Proper Admin Section with superuser.** Dashboard landing page with health overview (pipeline status, cost, quality drift, library health, wiring, active alerts in red). Separate tabs: Pipeline Health, Block Library, Sandbox, Cost & Usage, Quality, Wiring, Settings. Superuser auth via `is_admin` flag on teacher profile. All 7 operational automation systems feed into this dashboard.
22. **Framework-neutral units, framework at render time (CRITICAL CHANGE).** Units generated with neutral language. FrameworkAdapter maps neutral criterion keys → framework-specific display at render time. Same unit works across all frameworks without conversion. Stage 4 generates neutral text. Neutral criterion taxonomy (~6-8 categories) maps bidirectionally to all supported frameworks.
23. **Homogeneity prevention via 3 mechanisms.** (a) Diversity injection at retrieval — ranking demotes blocks similar to ones already in the current unit. (b) "Something different?" section in search results with high-efficacy unused blocks. (c) Pattern rotation alerts when system detects repeated sequences.
24. **ai_rules auto-generated, not teacher-set.** `bloom_level × phase → ai_rules` deterministic lookup. Design Assistant reads current activity's rules at runtime. Zero teacher involvement. Sandboxable.
25. **UDL: Option B soft hints, JIT.** Client-side icons on activities with UDL tags. No API call. Student chooses alternative response format.
26. **Scaffolding: effort-gated + profile override.** V1 simple. Data pipes wired for future smart scaffolding (lazy vs struggling, scaffolding feedback loop). Upgradable.
27. **Block feedback: teacher > student.** No explicit student feedback. Intrinsic signals from tracking. Teacher "How did this go?" post-teaching. New block badge.
28. **Bug reporting system.** Floating button, quick-choice + screenshot, admin workflow, reporter notification.
29. **Admin section: 12 tabs.** Full operational hub. Pipeline, Library, Sandbox, Cost, Quality, Wiring, Teachers, Students, Schools, Bugs, Audit, Settings.
30. **Per-teacher profitability tracking.** Cost & Usage tab breaks down each teacher's AI spend into 4 categories (ingestion, generation, student API, teacher API). Per-teacher cost-per-unit, cost-per-student, trend arrows. Revenue attribution when pricing is set.
31. **Bug reporting per-class toggle.** Bug reporting button default OFF. Teacher enables per class via Class Hub settings. Stored on `classes` table.
32. **Multi-format extensibility via FormatProfile.** Format is a dimension, not a fork. Each unit type (Design, Service, PP, Inquiry, future) provides a FormatProfile that injects format-specific behaviour at each pipeline stage. Adding a new format = writing a new FormatProfile (~80 lines) + extending mapping tables. Zero pipeline code changes. See Section 14.9.
33. **Block phase column is format-neutral.** `activity_blocks.phase` uses FormatProfile phase IDs (e.g., `investigate`, `create`, `reflect`), NOT design-specific phases. A block tagged `investigate` can match Design's "Inquiring & Analysing" AND Service's "Investigate" via the neutral taxonomy. Renamed from `design_phase`.
34. **Pipeline Simulator built before real pipeline.** Lightweight mock stages (~1 day) validate typed contracts, FormatProfile injection, FrameworkAdapter rendering, and edge cases BEFORE any real AI code is written. See Section 7.6. Built in Phase A.
35. **FrameworkAdapter has dedicated test panel in sandbox.** Mapping matrix, unit preview mode (switch framework in dropdown), batch validation, round-trip test, grading UI test. Also runs as Vitest unit tests. See Section 7.5.
36. **FrameworkAdapter handles labels only (v1), not tone.** Connective text stays neutral. Adapter maps criterion keys to display labels. Tone/phrasing adaptation is a future upgrade if teacher feedback demands it.
37. **14 activity categories as a first-class block dimension.** `activity_category` field on `activity_blocks` captures pedagogical purpose: ideation, research, analysis, making, critique, reflection, planning, presentation, warmup, collaboration, skill-building, documentation, assessment, journey. Format-neutral — every format uses these, FormatProfile boosts/suppresses per format. Distinct from bloom (cognitive demand), phase (where in cycle), and lesson_structure_role (where in lesson). See Section 6.3.
38. **Per-format sandbox tabs with full isolation.** Each format (Design, Service, PP, Inquiry, Art, custom) gets its own sandbox tab with independent test cases, model config, generation history, and FormatProfile inspector. Design built first, others ported. Shared React components, per-tab data. See Section 7.9.
39. **Custom formats created from admin UI, not code.** FormatProfile stored as JSONB in `format_profiles` table for custom formats (built-in formats remain TypeScript constants). 10-step Format Builder wizard in sandbox. Creates Draft tab for testing, promotes to Live when ready. Enables new formats without code deploys. See Section 14.9.1.
40. **Pre-build checklist added (3 April 2026).** 5 actions before any code: manual prototype (validate block assembly thesis), pipeline simulator (test typed contracts with fixtures), cost tracking in contracts (CostBreakdown on every stage return), first-unit milestone (Stages 4+6 as stubs, get a unit out fast), tests from day one (co-located test files per stage). Based on Stripe/Shopify/Netflix engineering practices research.
41. **Ingestion simplified from 9 stages to 2 AI passes for v1.** Pass A (classify + tag) + Pass B (analyse + enrich) replace old Passes 0/1/2/2b. Pass registry pattern: `IngestionPass<TInput, TOutput>` interface, array-based registry, sandbox auto-generates panels from registry. Adding a new pass = write function + push to array. No pipeline code changes. Add passes only when real uploads prove current output is missing critical data. Cost drops from ~$0.10-0.30 to ~$0.05-0.15 per upload.
42. **Pipeline starts as one file, not six modules.** Per lesson #3 (start monolith, extract when justified): Phase A produces a single `pipeline.ts` with 6 exported functions. One file, one import, fully testable. Extract to separate files only when any single function exceeds ~300 lines.
43. **15-20% of each build phase allocated to integration cleanup.** Per industry consensus on tech debt: each phase includes a half-day for cleaning up integration seams (lesson editor ↔ pipeline ↔ content_data wiring). Don't accumulate debt during the build.

---

## 11. Pre-Build Checklist (Added 3 April 2026)

Before writing any pipeline code, complete these 5 actions. Based on lessons from Stripe (ship tiny increments), Shopify (prototype before build), Netflix (CI on everything), and hard-won industry data (93% of architecture-implementation misalignments cause negative business outcomes).

### PB-1: Manual Prototype (~2 hours, Matt)

**Validate the core thesis before building the system.**

Take one of your existing lesson plans from `docs/lesson plans/`. Manually decompose it into activity blocks (a spreadsheet or JSON file — title, bloom, time_weight, grouping, phase, materials). Then pick a DIFFERENT topic and manually assemble a new unit by: (a) selecting blocks that could transfer, (b) identifying gaps where no block fits, (c) writing gap-fill descriptions by hand. Then use Claude to generate the gap-fill activities only.

**Question to answer:** Does the assembled-from-blocks result feel better, worse, or about the same as a fully AI-generated unit? If it doesn't feel better, the entire Dimensions3 thesis needs rethinking.

**Output:** A short verdict (keep/rethink/adjust) and notes on what surprised you.

### PB-2: Pipeline Simulator (Phase A, Day 1)

**Test typed contracts with zero AI cost.**

Build the Pipeline Simulator (Section 7.6) FIRST. One `pipeline.ts` file with 6 exported functions, each taking the previous stage's typed output and returning the next. All functions use hardcoded fixture data — no AI calls, no database.

Run the simulator. If the types don't chain, fix the interfaces before writing real code.

**Output:** `npm run test` passes for the full pipeline flow with fixture data.

### PB-3: Cost Tracking in Contracts

**Every stage function returns cost alongside output.**

Add `CostBreakdown` to every stage's return type from day one (see updated contracts in Section 3). When the simulator runs, costs are all zeros. When real AI is wired in, costs are automatically visible in the sandbox per stage. No separate "add cost tracking later" task.

### PB-4: First Unit Milestone

**Define what "done enough to test" looks like.**

The absolute minimum pipeline that produces a teachable unit:
- Stage 0: Hardcoded test request (skip wizard)
- Stage 1: Retrieve from fixture blocks (or empty library → all gaps)
- Stage 2: Simple phase-order arrangement
- Stage 3: AI gap-fill (the only real AI call)
- Stage 4: STUB — pass through unchanged
- Stage 5: Simple arithmetic timing (equal time per activity)
- Stage 6: STUB — return placeholder scores

This should produce a real unit JSON that the lesson editor can open. Stages 4 and 6 get filled in later. The goal is topic → unit with real content as fast as possible, then iterate.

**Output:** Generate 3 units for subjects Matt actually teaches. Grade them honestly. That's user test #1.

### PB-5: Tests from Day One

**Every stage gets a co-located test file the same day it's written.**

The Pipeline Simulator (PB-2) becomes the first integration test. Each real stage implementation gets unit tests alongside it. Target: `npm run test` includes pipeline tests from the first commit. No separate "add tests later" phase.

Pattern: `src/lib/pipeline/stage-1-retrieve.ts` → `src/lib/pipeline/__tests__/stage-1-retrieve.test.ts`.

---

## 12. Open Questions — ALL RESOLVED (3 April 2026)

### Q1: Per-stage learning mechanism

Each stage learns differently because each stage does a different job:

- **Stage 1 (Retrieval):** Observes which retrieved blocks teachers keep vs delete. After teacher saves a unit, compare retrieved blocks (from `generation_runs.stage_results.stage1`) with blocks in the final unit. Kept = positive signal on the topic-block pair. Removed = negative signal. Stored as `block_topic_affinity` score.
- **Stage 2 (Assembly):** Learns sequencing preferences. When a teacher reorders activities, the system records: "For [unit type + topic], teacher moved [block type] from position 3 to position 1." Stored as `sequence_preferences` on teacher profile (per unit type). Diffs assembly output vs final saved order.
- **Stage 3 (Gap Fill):** Learns what's missing. Manually-added activities that don't match any existing block (embedding similarity <60%) are flagged as "novel additions" — signals where the library has gaps. Optionally promoted to library blocks.
- **Stage 4 (Polish):** Learns teacher voice. Edit diffs on connective tissue (transitions, cross-references, scaffolding wording) stored on teacher profile. After 10+ edits, polish prompt includes style examples from their edits.
- **Stage 5 (Timing):** Pace feedback + actual `time_spent_seconds` from tracking. Cold-start uses time_weight defaults; after 3+ units, uses actual velocity data per class.
- **Stage 6 (Scoring):** Lesson Pulse is deterministic — doesn't learn per se, but inputs (block metadata) get more accurate as the feedback loop corrects bloom levels, time weights, and grouping patterns.

### Q2: Build order and phasing

**Phase A — Foundation (~4 days):**
- A1: `activity_blocks` table + migration + TypeScript types + basic CRUD API
- A2: `FormatProfile` interface + 4 existing profiles (Design, Service, PP, Inquiry) + `FrameworkAdapter` implementation + Vitest adapter tests
- A3: Pipeline Simulator — mock stages with typed contracts + JSON fixtures + simulator runner (validates all interfaces chain correctly, FormatProfile injection works at every stage). See Section 7.6.
- A4: Sandbox shell UI (empty panels, step-through controls, stage slots, model selector, FrameworkAdapter test panel)
- A5: `generation_runs` table + logging infrastructure
- A6: 🔵 [ADDED 4 Apr] Delete all quarantined code (42 entry points, ~37 files). Clean codebase before building new pipeline.
- A7: 🔵 [ADDED 4 Apr] Add `tier TEXT DEFAULT 'free'` to `teacher_profiles` migration + `checkTierAccess()` stub function (returns `{allowed:true}` for everyone during beta). Makes all new routes tier-aware from day one.
- **✅ DONE (3 April 2026):** Appendix A reviewed — 52 approved, 3 rejected (5 Whys, Gallery Vote, Silent Brainstorm — duplicates of toolkit tools).

**Phase B — Ingestion (~3 days):**
- B1: Ingestion pass registry + Pass A (classify + tag) + Pass B (analyse + enrich) — 2 passes replace old 4-pass system. Sandbox panels auto-generated from registry.
- B2: Block extraction (enriched sections → candidate ActivityBlocks) + PII scan + copyright flag
- B3: Review queue UI (approve/edit/reject extracted blocks)
- B4: Test with 3-5 real uploads. If Pass B output is missing critical data, add a focused Pass C. Otherwise ship.

**Phase C — Generation (~5 days):**
- C1: Stage 1 Retrieval (embedding search + scoring)
- C2: Stage 2 Assembly (skeleton selection + block placement)
- C3: Stage 3 Gap Fill (AI generation for empty slots)
- C4: Stage 4 Polish (connective tissue + familiarity adaptation)
- C5: Stage 5 Timing (time allocation using time_weights)
- C6: Stage 6 Scoring (Lesson Pulse, reused from existing code)

**Phase D — Feedback (~3 days):**
- D1: Teacher edit tracker (diff detection on unit saves)
- D2: Efficacy computation (from tracked signals)
- D3: Approval queue UI + guardrails
- D4: Self-healing proposals

**Phase E — Polish + Admin (~3 days):**
- E1: Unit Import flow (upload → reconstruct → match report)
- E2: Admin Dashboard landing page (health overview, pipeline status, cost, quality, wiring, red alerts)
- E3: Admin tabs (Pipeline Health, Block Library browse, Cost & Usage, Quality, Wiring, Settings)
- E4: Automated smoke tests (6 end-to-end flow tests, run daily + on-demand)
- E5: 7 operational automation systems wired into admin dashboard

**Total: ~17 days** (was 18 — ingestion simplified from 4→3 days). Sandbox ready from day 3, stages plugged in incrementally. Admin dashboard is the last build — needs all other systems feeding it. Each phase includes half-day integration cleanup (Decision 43).

### Q3: Migration strategy

🔵 [CHANGED 4 Apr — was staged removal with feature flag. Now immediate deletion since there are 0 users.]

**Immediate deletion during Phase A.** No users on the platform means no transition risk. During Phase A (Foundation):
1. Delete all quarantined route files (42 entry points, ~37 files). Clean codebase.
2. Delete old wizard generation code, old knowledge pipeline code, old analysis routes.
3. Keep: manual unit creation, lesson editor, Design Assistant, student experience, Teaching Mode — these are NOT quarantined and still work.
4. New pipeline built fresh — no feature flag needed, no coexistence.
5. Express/Guided/Architect wizard lanes remain — they just need new backend endpoints.

**Key: cleaner codebase from day 1 of the build.** No dead code confusion, no flag management, no "which pipeline is running?" questions.

### Q4: Lesson editor integration with block library

Yes — teachers can pull blocks from the library into the editor.

- Existing "+" button in `ActivityBlockAdd.tsx` gets "Import from Library" option (alongside 6 templates + Toolkit Tool).
- Opens search panel in editor sidebar: text search + filters (bloom, phase, time_weight, grouping).
- Results show block cards with preview (title, description, time_weight badge, bloom pill, efficacy score).
- Click block → inserted at cursor position in current lesson.
- Inserted activity references `block_id` — edits are local (teacher's fork), but block reference maintained for feedback tracking.
- "Detach from library" option: converts library-linked activity into standalone (breaks reference, no feedback).

### Q5: Teaching Moves → Seed Blocks

**RESOLVED (3 April 2026):** Convert all 55 Teaching Moves to seed Activity Blocks, then delete the Teaching Moves Library (`src/lib/ai/teaching-moves.ts`) as a separate system. All MYP-specific language must be stripped — blocks are framework-neutral. Framework vocabulary applied at Stage 4 (Connective Tissue) during generation. Appendix A review still needed to verify each move is framework-clean before conversion.

### Q6: Starter defaults + Sequence Patterns

Day-1 defaults (all clearly marked as provisional, get replaced by learned data):

- **Timing:** `quick` = ~5-10 min, `moderate` = ~15-25 min, `extended` = ~30-45 min, `flexible` = fills remaining time. Real classroom data replaces within 3 units.
- **5 Sequence Patterns (soft suggestions, not templates):**
  1. **Workshop Classic** — Hook → Demo → Extended making → Gallery critique → Reflection (studio lesson)
  2. **Investigation First** — Research provocation → Guided inquiry → Analysis → Discussion → Synthesis (research-heavy)
  3. **Iterative Sprint** — Brief → Rapid prototype → Test → Iterate → Share (fast cycles)
  4. **Critique & Refine** — Review previous work → Peer feedback → Revision time → Second feedback → Polish (improvement-focused)
  5. **Skill Build** — Warm-up exercise → Skill demo → Guided practice → Independent practice → Application (technique lessons)
- **Teachers can create and save custom patterns** from the sandbox. Named patterns stored on teacher profile per unit type.
- **Phase structures:** No default phase layout enforced. Assembly stage arranges activities by `phase` tag as sensible default ordering. Teachers reorder freely. Default ordering must be controllable to prevent imprinting — sandbox shows ordering influence.
- **Work time allocation:** Default split 15% opening/instruction, 70% core activities, 15% reflection/wrap-up. **Sandboxable** — draggable sliders show impact on output in real time. Adjusts based on teacher feedback.
- **All patterns and defaults evolve.** Starters are provisional. System learns from teacher uploads, edits, and teaching patterns. Starters get diluted by real data over time.

### Q7: Community sharing model

**Not for v1.** Block sharing between teachers requires: multi-tenancy (school accounts), trust model, moderation, discovery UX. "When you have revenue" problem.

For now: each teacher's library is private. `is_public = false` is default and only option. PII/copyright infrastructure built from day 1 so data is already clean when sharing is enabled later.

### Q8: Block versioning

Teacher edits to library-linked activities do NOT modify the library block. The edit is stored on the `content_data` activity (the fork). The feedback system observes the edit and proposes a metadata adjustment to the library block (through the approval queue).

If a teacher explicitly wants to update the library block: "Save to Library" action creates a new version. Old version preserved (soft archive). Version history on block card: v1 (original), v2 (teacher edited 15 Apr), v3 (feedback proposed + approved 22 Apr).

Matches existing fork model: `class_units.content_data` forks from master, teacher edits are local, "Save as Version" promotes to master.

### Q9: Cost targets + API provider strategy

- **Per unit generation:** Target $0.50-2.00 (depending on library fill rate). Day 1 with empty library: ~$1.50-3.00 (mostly gap-fill). After 50+ blocks: ~$0.20-0.80 (mostly assembly).
- **Per ingestion (document upload):** Target $0.05-0.15 with 2-pass v1 (was $0.10-0.30 with 9 passes). Each additional pass adds ~$0.02-0.05.
- **Monthly budget for active teacher:** $10-20/month (assuming 2-4 units generated, 5-10 uploads, daily Design Assistant usage).
- **Cost trajectory:** Sandbox cost bar per stage makes this visible. After each build phase, review actual vs targets, adjust model selection per stage.
- **Model pricing context:** Haiku ~$0.25/MTok input, $1.25/MTok output. Sonnet ~$3/MTok input, $15/MTok output. Haiku for Stages 4-5 (editing/timing), Sonnet only for Stage 3 (creative generation).
- **Chinese AI options (future cost optimization):** DeepSeek V3 (~$0.07/MTok), Qwen 2.5-72B (~$0.16/MTok), Moonshot/Kimi (~$0.12/MTok) — all accessible from mainland China without VPN. Could cut ingestion costs 60-70% by routing lightweight passes (classification, metadata, chunking) to Tier 1 Chinese models. Quality-critical passes stay on Claude.
- **API switching architecture:** Admin settings panel to pick model per pipeline tier. "Test with this model" button runs same input through different model for side-by-side comparison. Provider abstraction makes switching a config change, not code change. Primary: Anthropic (Matt has reliable VPN). Future: easy swap to Chinese models for ingestion tiers.

---

## 13. Relationship to Existing Projects

| Project | Relationship |
|---------|-------------|
| **Dimensions v1** (COMPLETE) | Schema fields carry forward. Tracking infrastructure reused. Lesson editor UI reused. |
| **Dimensions2** (SUPERSEDED) | Ideas absorbed into dimensions3 but architecture fundamentally rethought. |
| **Lesson Pulse** (Phase 1 COMPLETE) | Quality scoring algorithm reused in Stage 6. Teaching Moves Library pending review for block seeding. |
| **Pipeline Quarantine** (ACTIVE) | Dimensions3 replaces both quarantined pipelines. Quarantine lifts when dimensions3 stages are ready. |
| **Unified Upload Architecture** (spec written) | Absorbed into dimensions3 ingestion pipeline (Section 4). |
| **Lesson Plan Converter** (spec written) | Absorbed into Unit Import flow (Section 4, Reconstruction Stage). |
| **MYPflex** (Phase 1 COMPLETE) | Framework-aware criteria handled via block metadata. |

---

## 14. Student Interface Integration — RESOLVED (3 April 2026)

### 14.1 Framework-Neutral Units with Render-Time Adaptation

**CRITICAL ARCHITECTURE CHANGE:** Units are generated framework-neutral. Framework vocabulary is applied at render time via a Framework Adapter, not baked into content_data during generation.

**How it works:**
- Activity blocks store neutral criterion alignment: `"designing"`, `"evaluating"`, `"researching"` — not framework-specific labels like "Criterion B" or "AO2"
- Stage 4 (Connective Tissue) generates neutral connective text — no criteria letters, no framework terms
- A `FrameworkAdapter` utility maps neutral keys → framework-specific display strings at render time
- Student lesson page calls `adapter.mapCriterion("designing", classFramework)` when displaying criterion references
- Same unit works across MYP, GCSE, NSW/ACARA, PLTW, A-Level simultaneously without conversion

**Neutral Criterion Taxonomy — 8 canonical categories:**

| Neutral Key | Description | MYP Design | GCSE DT | ACARA | A-Level | IGCSE | PLTW | NESA NSW | Victorian |
|-------------|-------------|------------|---------|-------|---------|-------|------|----------|-----------|
| `researching` | Investigating needs, context, existing solutions | A (Inquiring & Analysing) | AO1 (Identify & Investigate) | KU (Knowledge) | C1 (Technical Principles) | AO1 (Knowledge) | — | DP (Design Process) | TS (Technologies & Society) |
| `analysing` | Breaking down findings, identifying patterns, drawing conclusions | A (Inquiring & Analysing) | AO3 (Analyse & Evaluate) | KU (Knowledge) | C1 (Technical Principles) | AO3 (Analysis) | — | DP (Design Process) | TS (Technologies & Society) |
| `designing` | Generating ideas, developing specifications, selecting solutions | B (Developing Ideas) | AO2 (Design & Make) | PPS (Processes) | C2 (Designing & Making) | AO2 (Application) | Design | DP (Design Process) | CDS (Creating Design Solutions) |
| `creating` | Making, building, prototyping, producing the solution | C (Creating the Solution) | AO2 (Design & Make) | PPS (Processes) | C3 (NEA Project) | AO2 (Application) | Build | Pr (Producing) | CDS (Creating Design Solutions) |
| `evaluating` | Testing, assessing quality, measuring against criteria | D (Evaluating) | AO3 (Analyse & Evaluate) | — | C2 (Designing & Making) | AO3 (Analysis) | Test | Ev (Evaluating) | — |
| `reflecting` | Personal growth, process awareness, metacognition | D (Evaluating) | — | — | — | — | — | Ev (Evaluating) | — |
| `communicating` | Presenting, documenting, sharing with audience | — | AO4 (Knowledge) | — | C3 (NEA Project) | AO1 (Knowledge) | Present | — | TC (Contexts) |
| `planning` | Organising resources, time management, strategic thinking | C (Creating the Solution) | AO1 (Identify & Investigate) | PPS (Processes) | C2 (Designing & Making) | AO2 (Application) | Design | DP (Design Process) | CDS (Creating Design Solutions) |

**Non-design unit type mappings (same 8 neutral keys):**

| Neutral Key | Service (IPARD) | Personal Project | Inquiry | PYP Exhibition (future) |
|-------------|-----------------|------------------|---------|------------------------|
| `researching` | I (Investigate) | A (Planning) | A (Inquiring) | Exploration |
| `analysing` | I (Investigate) | A (Planning) | B (Exploring) | Synthesis |
| `designing` | P (Plan) | A (Planning) | — | Taking Action |
| `creating` | A (Act) | B (Applying Skills) | C (Creating) | Taking Action |
| `evaluating` | R (Reflect) | C (Reflecting) | — | Reflection |
| `reflecting` | R (Reflect) | C (Reflecting) | D (Sharing) | Reflection |
| `communicating` | D (Demonstrate) | — | D (Sharing) | Exhibition |
| `planning` | P (Plan) | A (Planning) | — | Taking Action |

**Key design decisions:**
- 8 categories is the minimum needed to cover all frameworks without lossy mapping
- `researching` and `analysing` are separate because some frameworks combine them (MYP criterion A) while others split them (GCSE AO1 vs AO3). The adapter handles the merge: when mapping to MYP, both `researching` and `analysing` resolve to "Criterion A"
- `reflecting` is distinct from `evaluating` because Service and PP treat reflection as a first-class concern, while Design subsumes it into evaluation
- `—` means that framework has no direct equivalent. The adapter omits the criterion label but the activity still renders (it just doesn't show a criterion badge)
- An activity can have multiple neutral keys (e.g., "research and analyse existing products" → `["researching", "analysing"]`)

**FrameworkAdapter interface:**

```typescript
interface FrameworkAdapter {
  // Map neutral key(s) to framework-specific display
  mapCriterion(neutralKey: string, framework: string): { label: string; key: string; color: string } | null;

  // Get all criteria for a framework (for grading UI)
  getAllCriteria(framework: string): { neutralKeys: string[]; label: string; key: string; color: string }[];

  // Reverse map: framework key → neutral keys (for imports/conversion)
  reverseMap(frameworkKey: string, framework: string): string[];
}
```

**What this enables:**
- Any teacher from any framework grabs any unit → assigns to their class → it reads like it was written for their framework
- No conversion step needed — content IS neutral, display IS adapted
- Units are marketplace-portable when community sharing launches
- Blocks, units, and generated content all speak the same neutral language
- New frameworks added by extending the mapping table — no code changes to blocks, units, or pipeline

**Extensibility for unknown future formats:**
- New unit types (e.g., PYP Exhibition, DP Extended Essay, STEM Challenge) add rows to the non-design mapping table
- New frameworks (e.g., Finnish curriculum, Singapore D&T) add columns to the design mapping table
- The 8 neutral keys are stable — they describe universal cognitive activities, not curriculum-specific labels
- If a future format needs a 9th category, it's an additive change (new column + new adapter mapping, no existing data affected)

**Format-Specific Systems (Section 14.9):**
See Section 14.9 for how the platform handles multi-format extensibility beyond just criteria mapping.

### 14.2 Per-Activity AI Personality (ai_rules) — RESOLVED: Automated

**Decision:** ai_rules are auto-generated from block metadata. Teachers never set them manually.

**Mapping:** `bloom_level × phase → ai_rules` is a deterministic lookup table:
- `bloom: "create"` + `phase: "ideate"` → `{ phase: "divergent", tone: "encouraging", rules: ["push for wilder ideas", "never evaluate during ideation", "celebrate quantity"] }`
- `bloom: "evaluate"` + `phase: "test"` → `{ phase: "convergent", tone: "analytical", rules: ["ask about trade-offs", "push for evidence", "challenge assumptions"] }`

**At runtime:** Design Assistant reads current activity's ai_rules from content_data → injects into system prompt for this response. Student's active activity identified from tracking data. Zero teacher involvement.

**Sandbox:** Panel shows auto-generated ai_rules per activity. Override for testing. Simulated Design Assistant chat with ai_rules active.

### 14.3 UDL Checkpoints — RESOLVED: Option B (Soft Hints), JIT

**Decision:** Small icons on activities indicating available alternatives. Student chooses.

**Implementation (JIT, zero system load):**
- UDL tags already exist on blocks (migration 057). Loaded once with page content at mount.
- When an activity has `udl_checkpoints`, render small icons next to response input:
  - 🎤 = voice response available (checkpoint 1.2)
  - 🖼️ = image/drawing response available (checkpoint 2.5)
  - 📝 = simplified instructions available (checkpoint 3.3)
- Icons switch response input type (text → voice, text → canvas). Response types already built.
- Pure client-side rendering — no API call, no DB query beyond what's already loaded.
- Teacher side: lesson editor UDL picker (already built, Dimensions v1 Phase 4b) lets teachers see tags. Auto-suggested during generation.

**Confirmed JIT:** No additional fetch. No background processing. If `udl_checkpoints` is empty, nothing renders.

### 14.4 Scaffolding Visibility — RESOLVED: Effort-Gated + Profile Override (Upgradable)

**V1 Decision:** Effort-gated by default. Override for low-confidence or learning-difference students.

**Implementation:**
- Effort-gating pattern (already proven in toolkit + reflections): student starts typing → after meaningful engagement → scaffolding slides in
- Profile override: `showScaffoldingEarly = student.learning_profile.confidence < 3 || student.learning_profile.learning_differences.length > 0`
- Binary switch, no AI involved

**Future Smart Scaffolding Wiring (data collection now, intelligence later):**
1. **Track scaffolding interactions:** timestamp of appearance, whether student uses it (clicks starter, reads example), response quality after. Stored in `useActivityTracking` as `scaffolding_events` (within `student_progress.responses` JSONB, keyed as `_tracking_<activityId>.scaffolding_events`).
2. **Student scaffolding profile:** running model per student — `scaffolding_usage_rate`, `scaffolding_dependence_trend` (increasing = concerning), `effort_before_scaffolding`. Updated via exponential moving average. **Storage:** JSONB field within `students.learning_profile` under a `scaffolding` key (e.g., `learning_profile.scaffolding.usage_rate`). Computed on write from tracking events — NOT a separate table. Same pattern as other student intelligence data.
3. **Lazy vs struggling signal (future):** composite of `time_spent × attempt_number × scaffolding_usage × historical_capability`. High time + high attempts + scaffolding used = struggling. Low time + low attempts + scaffolding ignored + strong history = lazy. Response TBD (motivational nudge, proactive scaffolding, teacher notification).
4. **Scaffolding feedback loop:** measures whether scaffolding helped (response quality improvement after appearance). Feeds back into which scaffolding types work for this student.

**Design principle:** Simple binary now. Data pipes wired. Smart adaptation enabled later with semester of real signal. Easily upgradable without architecture change.

### 14.5 Block Feedback — RESOLVED: Teacher-Prioritized, Intrinsic Student Signals

**Decision:** No explicit student feedback on blocks. Teacher feedback prioritized. Intrinsic student signals automatic.

**Intrinsic student signals (automatic, zero UI, already collected by useActivityTracking):**
- `time_spent_seconds` vs `time_weight` expectation
- `attempt_number` (high = challenging/struggling)
- Completion rate (% who finish vs skip/abandon)
- `effort_signals.word_count` relative to prompt length
- Response quality proxy (word count + editing sessions + has_revisions)

**Teacher feedback (explicit, lightweight):**
- "How did this go?" on each activity block in lesson editor AFTER it's been taught (checking Teaching Mode session data). 3 options: 👍 Worked / 👎 Needs improvement / 🔄 Replaced. Optional note.
- Only appears post-teaching. Not during creation.
- Weighted heavily in efficacy scoring (teacher judgment > student metrics).

**New block indicator:**
- Blocks new to library (<30 days) or new to this teacher (never used) get subtle "New" badge in editor.
- After first use, "How did this go?" prompt slightly more prominent.

### 14.6 Teacher Dashboard & Presentation Wiring

**Teaching Mode:** Block metadata enriches student grid (bloom level pills on activities, grouping info for live seating suggestions, time_weight for phase timer accuracy).
**Projector View:** Block metadata drives richer phase-aware display (activity-specific prompts, checkpoint questions, extension activities auto-displayed when timer runs out).
**Smart Insights:** New insight type — "Block efficacy alert" when a block used in an active unit has poor completion rates.

### 14.7 Admin Section — Full Design

**Admin Dashboard Landing Page:**
- Health strip (green/amber/red traffic lights: Pipeline, Library, Cost, Quality, Wiring)
- Active alerts (red badges, click to expand)
- Quick stats row: active teachers, active students, units generated, blocks in library, open bug reports
- Trend sparklines (7-day) for each stat

**12 Tabs:**

| Tab | Content |
|-----|---------|
| Pipeline Health | Per-stage diagnostics, recent runs, error log, success/failure rates, avg generation time |
| Block Library | Browse/search blocks, efficacy scores, metadata quality, coverage gaps, stale blocks, bulk actions |
| Sandbox | Test generation/ingestion, model comparison, sequence patterns, work time sliders, ai_rules testing |
| Cost & Usage | Per-model spend (daily/weekly/monthly), **per-teacher profitability** (see below), cost-per-generation trend, budget alerts |
| Quality | Pulse scores, drift detection, before/after comparisons, block efficacy trends |
| Wiring | 6 E2E flow tests, last run results, flow diagrams, broken connection alerts |
| Teachers | All teachers, profile status, usage stats, last active, style completeness, units created |
| Students | All students (anonymized), enrollment status, progress overview, learning profile completion |
| Schools | School/class overview, framework distribution, calendar status |
| Bug Reports | Incoming reports with screenshots, status workflow (New → Investigating → Fixed → Closed), response system |
| Audit Log | Admin actions, approval queue decisions, data changes, login history |
| Settings | Model selection per tier, influence sliders, feature flags, system config |

**Per-Teacher Profitability Tracking:**
The Cost & Usage tab includes a per-teacher breakdown with 4 cost categories:
- **Ingestion costs** — AI calls for uploading/analysing documents into the block library
- **Generation costs** — AI calls for generating units (Stage 1-6 pipeline)
- **Student API costs** — Design Assistant, NM, Discovery, check-ins, scaffolding (attributable via student → class → teacher)
- **Teacher API costs** — lesson editor AI field, admin sandbox runs, style profiling

Each teacher row shows: total spend (7d/30d/all-time), cost per unit generated, cost per active student, trend arrow (up/down/flat). Colour-coded: green (healthy), amber (above average), red (outlier). Drill-down to individual API calls with model, tokens, cost. Export to CSV.

Revenue attribution future-ready: when pricing is set, each teacher gets a profitability score (revenue - cost). For now, shows cost only.

**Bug Reporting System:**
- Floating button (bottom-right). **Per-class toggle:** teacher enables/disables bug reporting per class via Class Hub settings (stored as `bug_reporting_enabled BOOLEAN DEFAULT false` on `class_units` or `classes`). Admin can also enable/disable globally.
- Default: OFF for all users. Teacher turns it on for specific classes when ready for student testing.
- Quick-choice menu: Something's broken / This doesn't look right / I'm confused / Feature request
- Mini-form: one-line description + optional screenshot (browser screen capture API or clipboard paste)
- Auto-captures: URL, browser info, user role, class context, timestamp, last 5 console errors (with consent)
- `bug_reports` table (reporter_id, reporter_role, class_id, category, description, screenshot_url, page_url, console_errors JSONB, status, admin_notes, response, created_at, updated_at)
- Workflow: New → Investigating → Fixed → Closed. Reporter sees status update on next login.
- Admin Bug Reports tab: filter by class, teacher, status, category. Batch actions (close duplicates, merge similar). Response sends in-app notification to reporter.
- ~1.5 days to build.

### 14.8 Wiring Health Checks

End-to-end flow tests (automated, daily + on-demand):
1. Ingestion → Library: upload test doc → verify blocks created with metadata
2. Library → Generation: generate test unit → verify blocks retrieved
3. Generation → Delivery: open generated unit in student view → verify content renders
4. Delivery → Tracking: student interaction → verify tracking data saved
5. Tracking → Feedback: edit a block in editor → verify efficacy score updated
6. Feedback → Library: check block with edits → verify efficacy reflects changes

Red status = broken since last check. Visible on admin dashboard landing page + Wiring tab.

### 14.9 Multi-Format Extensibility Architecture

**Problem:** Everything designed so far is grounded in Design classes. But StudioLoom already supports 4 unit types (Design, Service, PP, Inquiry) and will expand to unknown future formats (PYP Exhibition, DP Extended Essay, STEM Challenge, etc.). How does the Dimensions3 pipeline handle format-specific behaviour without hardcoding design assumptions everywhere?

**Core Principle: Format is a dimension, not a fork.**

The pipeline does NOT branch into 4 separate code paths. Instead, format-specific behaviour is injected at well-defined extension points via a `FormatProfile` object. Adding a new format = writing a new FormatProfile + extending mapping tables. Zero changes to pipeline code.

**FormatProfile interface:**

```typescript
interface FormatProfile {
  id: string;                         // 'design' | 'service' | 'pp' | 'inquiry' | future
  label: string;                      // Display name
  cycleName: string;                  // 'Design Cycle' | 'IPARD Cycle' | etc.
  phases: { id: string; label: string; description: string; color: string }[];

  // --- Pipeline Extension Points ---

  /** Stage 1: Block retrieval filter — which activity categories and phases are relevant? See Section 6.3 for the 14 categories. */
  blockRelevance: {
    boost: string[];                  // activity_category values to score higher (e.g., service boosts 'research', 'collaboration', 'reflection')
    suppress: string[];               // activity_category values to score lower (e.g., service suppresses 'making', 'skill-building')
    phaseIds: string[];               // Valid phase IDs for this format — blocks with matching `phase` get a relevance bonus
  };

  /** Stage 2: Sequence assembly — how should lessons be ordered? */
  sequenceHints: {
    defaultPattern: string;           // Which sequence pattern to default to
    phaseWeights: Record<string, number>; // Relative emphasis per phase (e.g., service: reflect=0.25, act=0.35)
    requiredPhases: string[];         // Phases that MUST appear (e.g., PP always needs 'reflect' + 'report')
    repeatablePhases: string[];       // Phases that can appear multiple times (e.g., service: 'reflect' in every lesson)
  };

  /** Stage 3: Gap generation — what kind of activities to generate for unfilled slots? */
  gapGenerationRules: {
    aiPersona: string;                // System prompt persona for this format
    teachingPrinciples: string;       // Injected into generation prompt
    typicalActivities: string[];      // Examples for the AI to reference
    forbiddenPatterns: string[];      // Things that don't fit (e.g., PP: 'teacher-directed workshop demo')
  };

  /** Stage 4: Connective tissue — how to connect activities narratively? */
  connectiveTissue: {
    transitionVocabulary: string[];   // Phase transition language ('Now that you've investigated...' vs 'Having reflected on...')
    reflectionStyle: 'end-only' | 'continuous' | 'milestone'; // Design=end-only, Service=continuous, PP=milestone
    audienceLanguage: string;         // Who the student addresses ('your client' vs 'the community' vs 'your supervisor')
  };

  /** Stage 5: Timing adjustments */
  timingModifiers: {
    defaultWorkTimeFloor: number;     // 0.45 for design, 0.30 for service (fieldwork takes more transition)
    setupBuffer: number;              // Extra minutes for format-specific setup (workshop=8, fieldwork=5, presentation=3)
    reflectionMinimum: number;        // Min minutes for reflection per lesson (design=5, service=10, PP=15)
  };

  /** Stage 6: Quality scoring weights — which Pulse dimensions matter most? */
  pulseWeights: {
    cognitiveRigour: number;          // Design=0.40, Service=0.25, PP=0.30
    studentAgency: number;            // Design=0.30, Service=0.40, PP=0.45
    teacherCraft: number;             // Design=0.30, Service=0.35, PP=0.25
  };

  /** Criterion mapping — which neutral keys are relevant for this FORMAT (not framework).
   *  This is about which neutral keys a format USES, not how they display.
   *  FrameworkAdapter handles display (neutral key → "Criterion B" for MYP, "AO2" for GCSE).
   *  FormatProfile.criterionMapping handles relevance (Service uses 'researching' + 'reflecting' but not 'creating' as heavily).
   *  The groupings here define how the format clusters keys for ASSESSMENT purposes
   *  (e.g., Service IPARD groups 'researching'+'analysing' under "Investigate").
   *  FrameworkAdapter groupings are FRAMEWORK-level (MYP A = researching+analysing).
   *  These can overlap — when they do, the framework grouping takes precedence at display time. */
  criterionMapping: {
    primaryKeys: string[];            // The main neutral criterion keys for this format (e.g., Service: ['researching','planning','creating','reflecting','communicating'])
    groupings: Record<string, string[]>; // Format-level assessment clusters (e.g., Service: { 'investigate': ['researching','analysing'], 'reflect': ['reflecting','evaluating'] })
  };

  /** Student experience — how the format affects the student interface */
  studentExperience: {
    mentorPersonality: string;        // How the Design Assistant behaves ('workshop buddy' vs 'community guide' vs 'project supervisor')
    progressVisualization: string;    // 'linear-phases' | 'cyclical' | 'milestone-timeline'
    portfolioStructure: string;       // 'project-pages' | 'process-journal' | 'evidence-collection'
    discoveryMode: 1 | 2;            // Mode 1 (Design: post-lessons) | Mode 2 (Service/PP/Inquiry: unit start)
  };

  /** Detection — how to identify this format from text/context */
  detectionKeywords: string[];
  timingNotes: string;
}
```

**How each pipeline stage uses FormatProfile:**

| Stage | What changes by format | FormatProfile field |
|-------|----------------------|---------------------|
| Stage 0 (Input) | Wizard question flow adapts per unit type (already built — `buildTurns(unitType)`) | N/A (handled by wizard) |
| Stage 1 (Retrieve) | Block search boosts/suppresses categories | `blockRelevance` |
| Stage 2 (Assemble) | Default sequence pattern, phase emphasis, repeatable phases | `sequenceHints` |
| Stage 3 (Gap-Fill) | AI persona, teaching principles, forbidden patterns | `gapGenerationRules` |
| Stage 4 (Polish) | Transition language, reflection style, audience framing | `connectiveTissue` |
| Stage 5 (Timing) | Work time floor, setup buffers, reflection minimums | `timingModifiers` |
| Stage 6 (Score) | Pulse dimension weights | `pulseWeights` |
| Student UI | Mentor personality, progress viz, portfolio, discovery mode | `studentExperience` |
| Grading | Which neutral keys map to assessed criteria | `criterionMapping` |

**The 4 existing FormatProfiles (summary of key differences):**

| Aspect | Design | Service | Personal Project | Inquiry |
|--------|--------|---------|-----------------|---------|
| Cycle | 4-phase (I→D→C→E) | 5-phase (IPARD) | 5-phase (D→P→A→R→R) | 4-phase (W→E→C→S) |
| Reflection | End-only (in evaluation) | Continuous (every lesson) | Milestone (at key checkpoints) | End-only (in sharing) |
| Block boost | `ideation`, `making`, `critique` | `research`, `collaboration`, `reflection`, `planning` | `reflection`, `planning`, `documentation`, `presentation` | `research`, `analysis`, `collaboration` |
| Block suppress | — | `making`, `skill-building` | `making`, `skill-building` | `making` |
| Default pattern | Workshop Classic | Investigation First | Skill Build (ATL-focused) | Investigation First |
| Pulse emphasis | CR 40% / SA 30% / TC 30% | CR 25% / SA 40% / TC 35% | CR 30% / SA 45% / TC 25% | CR 35% / SA 35% / TC 30% |
| Work time floor | 45% | 30% (fieldwork transitions) | 60% (student-directed) | 40% |
| Mentor style | Workshop buddy | Community guide | Project supervisor | Inquiry facilitator |
| Discovery mode | Mode 1 (post-lessons) | Mode 2 (unit start) | Mode 2 (unit start) | Mode 2 (unit start) |

**Adding a new format (e.g., PYP Exhibition):**

1. Write a `PYP_EXHIBITION_PROFILE: FormatProfile` object (~80 lines)
2. Add rows to the non-design criterion mapping table (Section 14.1)
3. Add the new type to the `UnitType` union + `UNIT_TYPES` registry
4. Add wizard turns in `buildTurns()` for the new type-specific questions
5. Done. The pipeline, student UI, grading, and admin all pick up the new format automatically.

No pipeline code changes. No new API routes. No new components. The pipeline reads the FormatProfile at each stage and adapts.

**Adding an unknown future format (e.g., a format that doesn't exist yet):**

The FormatProfile interface covers the full extension surface. As long as the future format involves students doing activities across phases toward criteria, it fits. The only case that would require pipeline changes is if a format needs a fundamentally different structure (e.g., non-linear lesson ordering, or lessons that split and merge). This is unlikely for educational formats, but the compartmentalized pipeline design means changes would be contained to 1-2 stages.

### 14.9.1 Custom Format Creation System

**Problem:** The system must support formats that don't exist yet — "things we don't think about now." Hardcoding 4-5 formats in TypeScript and requiring a code deploy for each new one doesn't scale. Matt wants to be able to build, test, and launch a new format entirely from the admin UI.

**Solution: FormatProfile as data, not just code.**

Built-in formats (Design, Service, PP, Inquiry) ship as TypeScript constants — fast, type-safe, versioned in git. But the system ALSO supports **custom FormatProfiles** stored as JSONB in a `format_profiles` table, editable via the admin UI.

```sql
CREATE TABLE format_profiles (
  id TEXT PRIMARY KEY,                    -- kebab-case: 'pyp-exhibition', 'art', 'stem-challenge'
  label TEXT NOT NULL,                    -- Display name: 'PYP Exhibition'
  profile_data JSONB NOT NULL,           -- Full FormatProfile object (same shape as TypeScript interface)
  version INTEGER DEFAULT 1,             -- Increments on each edit to a Live profile. Previous versions stored in version_history.
  version_history JSONB DEFAULT '[]',    -- Array of { version, profile_data, updated_at, updated_by } snapshots. Append-only.
  status TEXT DEFAULT 'draft',           -- 'draft' | 'live' | 'archived'
  created_by UUID REFERENCES teachers(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Resolution chain:** `getFormatProfile(formatId)` checks built-in constants first, then DB. Built-in formats can never be overridden from DB (safety).

**The "+ Custom" sandbox tab:**

Clicking "+ Custom" in the sandbox tab bar opens a **Format Builder** wizard:

1. **Identity** — id (kebab-case), label, cycle name, detection keywords
2. **Phases** — define 3-8 phases with id, label, description, color. Drag to reorder. Phase IDs become the values for `activity_blocks.phase` for this format.
3. **Block Relevance** — pick which of the 14 activity categories to boost and which to suppress for this format
4. **Sequence Hints** — default pattern (pick from existing or name a new one), phase weights (sliders summing to 1.0), required phases, repeatable phases
5. **Gap Generation Rules** — AI persona (text), teaching principles (text), typical activities (list), forbidden patterns (list)
6. **Connective Tissue** — transition vocabulary, reflection style (end-only/continuous/milestone), audience language
7. **Timing** — work time floor (slider 0.20–0.70), setup buffer (0–15 min), reflection minimum (0–20 min)
8. **Pulse Weights** — 3 sliders (CR/SA/TC) summing to 1.0
9. **Criterion Mapping** — pick which of the 8 neutral keys apply, define groupings
10. **Student Experience** — mentor personality, progress visualization, portfolio structure, discovery mode

Each step has a **preview panel** showing how a sample unit would look with the current settings. The preview updates live as you adjust sliders and pick options.

**Saving creates a Draft sandbox tab** — the format appears in the sandbox tab bar with an amber "Draft" dot. Full pipeline testing available. When ready, promote to "Live" (adds to teacher wizard's format picker, students can see units of this type).

**Format versioning:** Edits to a Live custom format create a new version. Previous versions kept for audit. Teachers can't be surprised by format changes mid-semester.

**What this enables:**
- Matt creates an "Art" format without a code deploy — defines phases (Explore/Experiment/Create/Present), boosts ideation+making+critique, sets high student agency Pulse weight
- A school wants a "STEM Challenge" format — Matt creates it in 15 min from the admin UI
- If Matt's projects expand (Seedlings, CALLED, Makloom), each project can have custom formats without forking the codebase
- Any format StudioLoom doesn't anticipate today can be created by anyone with admin access

**Constraints:**
- Custom formats cannot modify the pipeline code — only inject via FormatProfile extension points
- The 14 activity categories and 8 neutral criterion keys are fixed (extending these requires a code deploy, since they have structural implications)
- Maximum 20 custom formats (UI sanity limit on sandbox tabs)
- Custom format IDs must be unique across built-in + custom (validation on save)

**What stays universal across ALL formats:**
- Activity blocks (neutral, framework-agnostic, format-tagged but format-optional)
- The 6-stage generation pipeline flow
- The 8 neutral criterion keys
- The FrameworkAdapter render-time mapping
- Student tracking (useActivityTracking — measures time, attempts, effort regardless of format)
- Grading infrastructure (criterion scores, just different criteria per format)
- The feedback loop (teacher edits → efficacy → library improvement)
- Admin dashboard + sandbox + cost tracking

**What varies by format (via FormatProfile):**
- Phase names, sequence, and emphasis
- Block relevance scoring (boost/suppress)
- AI personality and teaching principles
- Reflection frequency and style
- Timing parameters
- Quality scoring weights
- Student mentor behaviour
- Discovery mode

**Implementation note:** The current `UnitTypeDefinition` interface in `src/lib/ai/unit-types.ts` already captures ~60% of FormatProfile (phases, aiPersona, teachingPrinciples, typicalActivities, timingNotes, detectionKeywords, extensionCategories). During Phase A build, we extend it into the full FormatProfile by adding the pipeline-specific fields (blockRelevance, sequenceHints, connectiveTissue, timingModifiers, pulseWeights, criterionMapping, studentExperience). This is an additive change — existing code continues to work, new pipeline stages read the new fields.

---

## Appendix A: Teaching Moves Library — Full Review List

**STATUS: REVIEWED 3 April 2026.** 52 approved, 3 rejected. Rejected moves are direct duplicates of existing interactive toolkit tools (already embeddable as lesson blocks via `ToolkitResponseInput`). Approved moves will be converted to Activity Blocks with `source_type: 'community'`, `efficacy_score: 65` (above neutral since expert-curated). Physical critique protocols (Two Stars & a Wish, Warm/Cool Feedback) coexist alongside digital toolkit equivalents.

### Ideation (6 moves)

**1. Blind Swap** (blind-swap)
- *Description:* Students work on an idea for 5 min, then swap papers with someone they can't see (face away, random). They must improve the other person's idea without changing the core concept.
- *Example:* After initial sketching, students fold their paper in half, pass it to the person behind them, and have 4 minutes to add improvements to the stranger's chair design.
- *Phases:* ideate | *Bloom:* evaluate, create | *Grouping:* pair
- *Time:* 8-12 min | *Energy:* medium | *Boosts:* student agency, cognitive rigour
- *Variations:* Triple swap — idea passes through 3 people; Constraint swap — each person adds a constraint, not a solution
- **DECISION: [x] APPROVE**

**2. Constraint Removal** (constraint-removal)
- *Description:* Remove one major constraint from the design brief and brainstorm freely. Then reintroduce the constraint and see which wild ide be adapted.
- *Example:* What if cost didn't matter? What if it could be any size? Students brainstorm without the weight limit, then circle ide could work if made lighter.
- *Phases:* ideate | *Bloom:* create, evaluate | *Grouping:* individual, pair
- *Time:* 8-15 min | *Energy:* medium | *Boosts:* cognitive rigour, student agency
- **DECISION: [x] APPROVE**

**3. Worst Idea First** (worst-idea-first)
- *Description:* Deliberately brainstorm the WORST possible solutions. Then flip each bad idea to find the kernel of a good one. Removes fear of failure and unlocks creative thinking.
- *Example:* Design the worst possible school bag — too heavy, no pockets, uncomfortable straps. Then flip: what if 'too heavy' means it h? What if 'uncomfortable' leads to an exoskeleton frame?
- *Phases:* ideate | *Bloom:* create, analyze | *Grouping:* small_group, pair
- *Time:* 10-15 min | *Energy:* high | *Boosts:* student agency, cognitive rigour
- *Variations:* Individual then share; Competition format — worst idea wins a prize
- **DECISION: [x] APPROVE**

**4. Concept Mashup** (concept-mashup)
- *Description:* Combine two unrelated concepts to generate novel ideas. Draw one card from a 'thing' pile and one from a 'quality' pile, then design at the intersection.
- *Example:* Draw 'umbrella' + 'playful'. Now design a playful umbrella. Draw 'backpack' + 'invisible'. Now reimagine a backpack that's invisible.
- *Phases:* ideate | *Bloom:* create | *Grouping:* individual, pair
- *Time:* 10-15 min | *Energy:* medium | *Boosts:* cognitive rigour, student agency
- *Prep:* Prepare concept cards (can reuse across units)
- **DECISION: [x] APPROVE**

**5. Silent Brainstorm (Brainwriting)** (silent-brainstorm)
- *Description:* Everyone writes ide sticky notes in silence for 5 min. No talking. Then cluster on a wall. Prevents dominant voices from controlling ideation.
- *Example:* 5 minutes of silent sticky note writing — one idea per note. Post on the board. Then 5 minutes of silent reading and grouping into clusters.
- *Phases:* ideate, define | *Bloom:* create, analyze | *Grouping:* individual
- *Time:* 8-15 min | *Energy:* low | *Boosts:* student agency, teacher craft
- **DECISION: [x] REJECT** — Direct duplicate of Brainstorm Web interactive toolkit tool (`/toolkit/brainstorm-web`), already embeddable as lesson block.

**6. Gallery Vote (Dot Democracy)** (gallery-vote)
- *Description:* Post all ide the wall. Each student gets 3 dot stickers to vote. Can spread votes or stack them. Quick democratic prioritisation with movement.
- *Example:* Pin all 12 design concepts on the board. Everyone gets 3 green dots. Place them on the ide think we should develop further. Most dots = next steps.
- *Phases:* ideate, define | *Bloom:* evaluate | *Grouping:* whole_class
- *Time:* 5-10 min | *Energy:* high | *Boosts:* student agency
- *Prep:* Dot stickers or markers
- **DECISION: [x] REJECT** — Direct duplicate of Dot Voting interactive toolkit tool (`/toolkit/dot-voting`), already embeddable as lesson block.

### Critique & Feedback (4 moves)

**1. Silent Gallery Walk** (silent-gallery-walk)
- *Description:* Work is displayed around the room. Students walk silently with sticky notes, leaving written feedback on each piece. No talking until the debrief.
- *Example:* Pin up all prototypes. 8 min silent walk — leave green stickies for strengths, pink for questions. Then 5 min whole-class debrief: 'What patterns did you notice?'
- *Phases:* test, prototype | *Bloom:* evaluate, analyze | *Grouping:* individual
- *Time:* 12-18 min | *Energy:* medium | *Boosts:* cognitive rigour, teacher craft
- *Variations:* Two Glows & a Grow (2 positives, 1 improvement); TAG feedback (Tell, Ask, Give)
- **DECISION: [x] APPROVE**

**2. Warm/Cool Feedback** (warm-cool-feedback)
- *Description:* Structured peer critique: 'warm' feedback (what's working and why) followed by 'cool' feedback (questions and suggestions). Ron Berger protocol.
- *Example:* In pairs: 2 min warm ('I notice the hinge mechanism is strong because...'), 2 min cool ('I wonder what happens if the user is left-handed?'), 1 min response.
- *Phases:* test, prototype, ideate | *Bloom:* evaluate, analyze | *Grouping:* pair, small_group
- *Time:* 8-15 min | *Energy:* medium | *Boosts:* cognitive rigour, student agency
- **DECISION: [x] APPROVE**

**3. Role Reversal Critique** (role-reversal-critique)
- *Description:* Student presents their design AS IF they are the end user, not the designer. Forces empathy and exposes usability issues they'd otherwise miss.
- *Example:* 'Pretend you're a Year 3 student using this pencil case for the first time. Walk us through your morning — where do the pens go? Can you find the eraser quickly?'
- *Phases:* test, define | *Bloom:* evaluate, analyze | *Grouping:* pair, small_group
- *Time:* 8-12 min | *Energy:* medium | *Boosts:* cognitive rigour, student agency
- **DECISION: [x] APPROVE**

**4. Two Stars & a Wish** (two-stars-wish)
- *Description:* Reviewer gives exactly 2 specific strengths ('stars') and 1 improvement suggestion ('wish'). Scaffolded critique that ensures balance.
- *Example:* Star 1: 'Your joint technique is strong — the finger joints will hold weight.' Star 2: 'The colour scheme matches the brief.' Wish: 'I wish the handle w for small hands.'
- *Phases:* test, prototype | *Bloom:* evaluate | *Grouping:* pair
- *Time:* 5-10 min | *Energy:* low | *Boosts:* cognitive rigour, teacher craft
- **DECISION: [x] APPROVE**

### Research & Investigation (9 moves)

**1. Expert Interview Simulation** (expert-interview-sim)
- *Description:* Half the class researches a topic and becomes 'experts'. The other half interviews them with prepared questions. Then swap roles with a different topic.
- *Example:* Group A researches ergonomic seating for 10 min. Group B prepares interview questions. Then B interviews A for 8 min. Swap with 'sustainable materials'.
- *Phases:* discover | *Bloom:* analyze, evaluate | *Grouping:* pair
- *Time:* 15-25 min | *Energy:* medium | *Boosts:* cognitive rigour, student agency
- *Variations:* Hot seat — one expert, whole class asks; Panel format with 3 experts
- **DECISION: [x] APPROVE**

**2. Product Autopsy** (product-autopsy)
- *Description:* Physically disassemble an existing product to understand how it works. Sketch the internal structure. Identify materials, joining techniques, and design decisions.
- *Example:* Each pair gets a broken toaster/phone case/toy. Carefully take it apart. Sketch and label every component. Answer: 'Why did the designer choose THIS material for THIS part?'
- *Phases:* discover, define | *Bloom:* analyze, evaluate | *Grouping:* pair, small_group
- *Time:* 15-25 min | *Energy:* high | *Boosts:* cognitive rigour
- *Prep:* Collect broken/cheap products for disassembly
- *Best for:* design units
- **DECISION: [x] APPROVE**

**3. User Shadowing (10-Minute Version)** (user-shadowing)
- *Description:* Students observe a real user performing a task for 10 min, noting pain points and workarounds. No talking — just watching and noting.
- *Example:* Observe a Year 3 student organising their desk for 10 min. Note: What takes the longest? What falls? What do they search for? What do they ignore?
- *Phases:* discover | *Bloom:* analyze | *Grouping:* individual, pair
- *Time:* 10-15 min | *Energy:* low | *Boosts:* cognitive rigour, student agency
- **DECISION: [x] APPROVE**

**4. 5 Whys Root Cause** (5-whys)
- *Description:* Ask 'Why?' five times in succession to move from surface observations to root causes. Forces depth over breadth in problem analysis.
- *Example:* 'The cafeteria queue is slow.' Why? 'People can't decide.' Why? 'The menu is confusing.' Why? 'It h options.' Why? 'They've never removed old items.' Root cause: menu curation system needed.
- *Phases:* define | *Bloom:* analyze | *Grouping:* pair, small_group
- *Time:* 8-12 min | *Energy:* low | *Boosts:* cognitive rigour
- **DECISION: [x] REJECT** — Direct duplicate of Five Whys interactive toolkit tool (`/toolkit/five-whys`), already embeddable as lesson block.

**5. Stakeholder Speed Dating** (stakeholder-speed-dating)
- *Description:* Students role-play different stakeholders (user, manufacturer, shop owner, environmentalist). 3 min per 'date' — ask questions from your stakeholder's perspective.
- *Example:* Assign roles: parent, child, teacher, janitor. Each h min to ask questions about the proposed playground redesign from their perspective. Rotate 4 times.
- *Phases:* discover, define | *Bloom:* analyze, evaluate | *Grouping:* pair
- *Time:* 12-20 min | *Energy:* high | *Boosts:* student agency, cognitive rigour
- **DECISION: [x] APPROVE**

**6. Community Mapping** (community-mapping)
- *Description:* Students create a visual map of their community, identifying needs, assets, and connections. Can be physical (walking tour) or digital.
- *Example:* Walk around the school campus for 15 min. Map: What's broken? What's missing? What works well? Who uses each space? Mark with red (need), green (asset), yellow (opportunity).
- *Phases:* discover | *Bloom:* analyze | *Grouping:* small_group
- *Time:* 15-30 min | *Energy:* high | *Boosts:* student agency, cognitive rigour
- *Best for:* service, pp units
- **DECISION: [x] APPROVE**

**7. Empathy Immersion** (empathy-immersion)
- *Description:* Simulate the user's experience. Wear gloves to experience arthritis. Use a wheelchair for 10 min. Block one ear to simulate hearing loss. Direct experience > reading about it.
- *Example:* Wear thick gardening gloves and try to: open a jar, type a message, button a shirt. How does this change your understanding of product design for elderly users?
- *Phases:* discover, define | *Bloom:* analyze, evaluate | *Grouping:* individual, pair
- *Time:* 10-20 min | *Energy:* medium | *Boosts:* cognitive rigour, student agency
- *Prep:* Prepare simulation materials (gloves, blindfolds, etc.)
- **DECISION: [x] APPROVE**

**8. Provocation** (provocation)
- *Description:* Show an image, object, or statement designed to provoke questions and wonder. Students generate  questions  without answering them first.
- *Example:* Show a photo of a landfill next to a luxury shopping mall. 3 minutes: write  questions  image raises. No answers yet — just questions. Sort into 'researchable' and 'philosophical'.
- *Phases:* discover | *Bloom:* analyze | *Grouping:* individual, pair
- *Time:* 5-10 min | *Energy:* low | *Boosts:* cognitive rigour, student agency
- *Best for:* inquiry, service units
- **DECISION: [x] APPROVE**

**9. See-Think-Wonder** (visible-thinking-see-think-wonder)
- *Description:* Harvard Project Zero routine. Students observe: What do I SEE? (facts) What do I THINK is going on? (interpretation) What does it make me WONDER? (questions)
- *Example:* Look at this bridge that collapsed. See: steel beams, broken supports, cars on top. Think: the supports weren't strong enough for the weight. Wonder: how do engineers calculate load limits?
- *Phases:* discover, define | *Bloom:* analyze, evaluate | *Grouping:* individual, pair
- *Time:* 8-12 min | *Energy:* low | *Boosts:* cognitive rigour
- *Best for:* inquiry, design units
- **DECISION: [x] APPROVE**

### Making & Prototyping (10 moves)

**1. Materials Roulette** (materials-roulette)
- *Description:* Each group draws 3 random materials from a bag. They must incorporate all 3 into their design solution. Forces lateral thinking beyond default material choices.
- *Example:* Group draws 'corrugated cardboard, rubber bands, aluminium foil'. They must use all three in their phone stand prototype.
- *Phases:* ideate, prototype | *Bloom:* create, apply | *Grouping:* small_group
- *Time:* 15-25 min | *Energy:* high | *Boosts:* student agency, cognitive rigour
- *Prep:* Prepare bags with diverse material combinations
- **DECISION: [x] APPROVE**

**2. Rapid Prototype Sprint** (rapid-prototype-sprint)
- *Description:* Build a rough prototype in exactly 10 minutes using only paper, tape, and scissors. Speed prevents overthinking and perfectionism.
- *Example:* You have 10 minutes and these materials: A3 paper, masking tape, scissors, markers. Build a model of your design that you can hold up and explain.
- *Phases:* prototype | *Bloom:* create, apply | *Grouping:* individual, pair
- *Time:* 10-15 min | *Energy:* high | *Boosts:* student agency, cognitive rigour
- *Prep:* Set up material stations
- **DECISION: [x] APPROVE**

**3. Progressive Constraints** (progressive-constraints)
- *Description:* Start with total freedom, then add one constraint every 5 minutes. Each constraint forces adaptation and creative problem-solving.
- *Example:* Build anything from cardboard. (5 min) Now: it must be taller than 30cm. (5 min) Now: it must hold a tennis ball. (5 min) Now: it must use only 2 joins.
- *Phases:* prototype | *Bloom:* create, apply | *Grouping:* individual, pair
- *Time:* 15-25 min | *Energy:* high | *Boosts:* student agency, cognitive rigour
- **DECISION: [x] APPROVE**

**4. Parallel Prototypes** (parallel-prototypes)
- *Description:* Build 3 different prototypes of the same idea simultaneously (different materials, scales, or approaches). Compare at the end. Prevents premature commitment.
- *Example:* Make your phone stand in 3 versions: one from cardboard, one from wire, one from clay. You have 15 min. Then test all three — which works best and why?
- *Phases:* prototype | *Bloom:* create, evaluate | *Grouping:* individual
- *Time:* 15-25 min | *Energy:* high | *Boosts:* cognitive rigour, student agency
- **DECISION: [x] APPROVE**

**5. Skill Station Rotation** (skill-station-rotation)
- *Description:* Set up 4-5 skill stations around the room. Students rotate every 8-10 minutes, practicing one technique per station. Build competence before the main project.
- *Example:* Station 1: Measuring and marking. Station 2: Joining techniques. Station 3: Finishing/sanding. Station 4: Safety quiz. Station 5: Material testing. Rotate every 8 min.
- *Phases:* prototype | *Bloom:* apply, understand | *Grouping:* small_group
- *Time:* 25-40 min | *Energy:* high | *Boosts:* teacher craft
- *Prep:* Set up 4-5 physical stations with materials
- *Best for:* design units
- **DECISION: [x] APPROVE**

**6. Testing Olympics** (testing-olympics)
- *Description:* Multiple standardized tests for prototypes: drop test, weight test, user test, aesthetics vote. Score card for each. Makes testing systematic and fun.
- *Example:* Bridge Testing Olympics: Event 1 — how much weight before collapse? Event 2 — aesthetics vote (class poll). Event 3 — span test. Event 4 — material efficiency (weight:strength ratio).
- *Phases:* test | *Bloom:* evaluate, analyze | *Grouping:* whole_class, small_group
- *Time:* 15-25 min | *Energy:* high | *Boosts:* cognitive rigour, student agency
- *Best for:* design units
- **DECISION: [x] APPROVE**

**7. Reverse Engineering Challenge** (reverse-engineering)
- *Description:* Give students a finished product and ask them to figure out how to make it. They must document the manufacturing process without instructions.
- *Example:* Here's a finished wooden box with dovetail joints. Your task: figure out the order of operations. What w first? What w first? Draw the process  flowchart.
- *Phases:* discover, prototype | *Bloom:* analyze, evaluate | *Grouping:* pair, small_group
- *Time:* 15-20 min | *Energy:* medium | *Boosts:* cognitive rigour
- *Best for:* design units
- **DECISION: [x] APPROVE**

**8. Choice Board** (choice-board)
- *Description:* 3×3 grid of activities at different levels/modalities. Students choose their path. Tic-tac-toe rule: must complete a line of 3 (ensures variety).
- *Example:* Row 1: Sketch, Write, Photograph. Row 2: Build, Present, Discuss. Row 3: Research, Annotate, Film. Do any 3 in a line — horizontal, vertical, or diagonal.
- *Phases:* any | *Bloom:* apply, create, analyze | *Grouping:* individual
- *Time:* 20-35 min | *Energy:* medium | *Boosts:* student agency, teacher craft
- **DECISION: [x] APPROVE**

**9. Scaffolded Challenge (Must/Should/Could)** (scaffolded-challenge)
- *Description:* Three-tier task: Must (everyone completes), Should (most will reach), Could (extension for fast finishers). All tiers visible — students self-select upward.
- *Example:* Must: build a bridge that spans 20cm. Should: bridge holds a 200g weight. Could: bridge uses the least material possible (weight:strength ratio). Track which tier you reached.
- *Phases:* prototype, test | *Bloom:* apply, evaluate, create | *Grouping:* individual
- *Time:* 15-30 min | *Energy:* medium | *Boosts:* teacher craft, student agency
- **DECISION: [x] APPROVE**

**10. Annotated Sketch Explosion** (annotated-sketch)
- *Description:* Sketch your design with annotation lines pointing to every feature. Each annotation must answer: What is it? What material? Why this choice?
- *Example:* Draw your phone stand. Add at least 8 annotation arrows. Each one: 'Base — MDF — chosen because it's heavy enough to prevent tipping' / 'Groove — 6mm wide — fits most phone cases'.
- *Phases:* prototype, define | *Bloom:* analyze, apply | *Grouping:* individual
- *Time:* 10-15 min | *Energy:* low | *Boosts:* cognitive rigour
- **DECISION: [x] APPROVE**

### Reflection (8 moves)

**1. Failure Museum** (failure-museum)
- *Description:* Students display their FAILED prototypes/attempts alongside labels explaining what they learned from each failure. Celebrates iteration over perfection.
- *Example:* Set up a 'museum' table. Each student places their worst prototype with a card: 'This failed because... I learned that...' Class tours the museum.
- *Phases:* test, prototype | *Bloom:* evaluate, analyze | *Grouping:* whole_class
- *Time:* 10-15 min | *Energy:* medium | *Boosts:* student agency, teacher craft
- *Variations:* Digital failure museum (photos + captions); Failure awards ceremony
- **DECISION: [x] APPROVE**

**2. One-Word Whip-Around** (one-word-whip)
- *Description:* Every student says ONE word that captures their feeling about today's work. No explanations. Fast, inclusive, gives teacher instant pulse check.
- *Example:* Before you pack up: one word — how did today go? Go around the room. 'Frustrated.' 'Proud.' 'Confused.' 'Excited.' 'Stuck.'
- *Phases:* any | *Bloom:* evaluate | *Grouping:* whole_class
- *Time:* 2-5 min | *Energy:* low | *Boosts:* student agency, teacher craft
- **DECISION: [x] APPROVE**

**3. Exit Ticket: 3-2-1** (exit-ticket-3-2-1)
- *Description:* 3 things you learned, 2 things you found interesting, 1 question you still have. Classic structured reflection that surfaces gaps.
- *Example:* On a sticky note: 3 things you learned about sustainable materials, 2 things that surprised you, 1 question for next lesson. Hand to teacher on the way out.
- *Phases:* any | *Bloom:* evaluate, analyze | *Grouping:* individual
- *Time:* 3-5 min | *Energy:* low | *Boosts:* cognitive rigour, teacher craft
- **DECISION: [x] APPROVE**

**4. Process Timeline** (process-timeline)
- *Description:* Students draw a timeline of their design process so far, marking decision points, pivots, and 'aha' moments. Visual metacognition.
- *Example:* Draw your design journey  path. Mark: where you started, where you got stuck, where you changed direction, and where you are now. Add a note at each turn: why did you pivot?
- *Phases:* test, prototype | *Bloom:* evaluate, analyze | *Grouping:* individual
- *Time:* 8-12 min | *Energy:* low | *Boosts:* student agency, cognitive rigour
- **DECISION: [x] APPROVE**

**5. If I Started Again** (if-i-started-again)
- *Description:* Students write or present what they would do differently if they started the project from scratch. Powerful reflection that demonstrates growth.
- *Example:* 'If I started this project again, I would: (1) spend more time on research because I didn't understand the user well enough, (2) test earlier because my first prototype w finished to change.'
- *Phases:* test | *Bloom:* evaluate | *Grouping:* individual, pair
- *Time:* 5-10 min | *Energy:* low | *Boosts:* cognitive rigour, student agency
- **DECISION: [x] APPROVE**

**6. Peer Teach-Back** (peer-teach-back)
- *Description:* Students teach a concept or technique they just learned to a partner who missed it (or pretends to be new). Teaching = deepest learning.
- *Example:* You just learned how to use the scroll saw safely. Now teach your partner — they have to be able to pass the safety quiz based ONLY on what you taught them.
- *Phases:* any | *Bloom:* evaluate, create | *Grouping:* pair
- *Time:* 5-10 min | *Energy:* medium | *Boosts:* cognitive rigour, student agency
- **DECISION: [x] APPROVE**

**7. Impact Mapping** (impact-mapping)
- *Description:* For service/PP projects: map the ripple effects of your action. Primary impact → Secondary impact → Systemic change. Forces students to think beyond immediate results.
- *Example:* Your project: cleaning up the river. Primary: cleaner water. Secondary: more fish, safer swimming. Systemic: community pride, local council attention, ongoing maintenance culture.
- *Phases:* define, test | *Bloom:* evaluate, analyze | *Grouping:* pair, small_group
- *Time:* 10-15 min | *Energy:* low | *Boosts:* cognitive rigour
- *Best for:* service, pp units
- **DECISION: [x] APPROVE**

**8. Time-Lapse Process Doc** (time-lapse-process)
- *Description:* Set up a phone to take photos every 30 seconds during making. Review the time-lapse at the end — students annotate key moments for their portfolio.
- *Example:* Prop your phone against your pencil case, set timer to 30-second intervals. Make your prototype. At the end, pick 5 key frames and write what w in each.
- *Phases:* prototype | *Bloom:* evaluate | *Grouping:* individual
- *Time:* 3-5 min | *Energy:* low | *Boosts:* student agency
- **DECISION: [x] APPROVE**

### Warmup & Energiser (7 moves)

**1. 30-Second Design Challenge** (design-challenge-30sec)
- *Description:* Sketch a solution to a silly design problem in 30 seconds. Repeat 3 times with different problems. Warms up creative muscles and lowers perfectionism.
- *Example:* Round 1: Design a hat for a giraffe. (30 sec) Round 2: Design a door for a submarine. (30 sec) Round 3: Design a chair for a ghost. (30 sec). Share your favourite with a partner.
- *Phases:* ideate | *Bloom:* create | *Grouping:* individual
- *Time:* 3-5 min | *Energy:* medium | *Boosts:* student agency, teacher craft
- **DECISION: [x] APPROVE**

**2. Odd One Out** (odd-one-out)
- *Description:* Show 4 images/objects. Students identify which is the 'odd one out' and explain their reasoning. Works for materials, products, techniques — any domain.
- *Example:* Show 4 chairs: stacking chair, beanbag, office chair, stool. Which is the odd one out? There's no right answer — the reasoning is the point.
- *Phases:* discover, define | *Bloom:* analyze | *Grouping:* pair, whole_class
- *Time:* 3-5 min | *Energy:* low | *Boosts:* cognitive rigour, teacher craft
- *Prep:* Prepare 4 images/objects
- **DECISION: [x] APPROVE**

**3. What If Machine** (what-if-machine)
- *Description:* Teacher poses a 'What if?' question related to the topic. Students have 2 min to discuss in pairs, then share the most interesting idea.
- *Example:* 'What if chairs couldn't have legs?' Discuss for 2 min. Best ideas: hanging from ceiling, magnetic levitation, built into the floor.
- *Phases:* ideate, discover | *Bloom:* create, analyze | *Grouping:* pair
- *Time:* 3-5 min | *Energy:* medium | *Boosts:* cognitive rigour, student agency
- **DECISION: [x] APPROVE**

**4. Vocab Charades** (vocab-charades)
- *Description:* Students act out technical vocabulary terms without speaking. Class guesses. Makes abstract terms concrete and memorable.
- *Example:* Act out: 'ergonomic', 'biodegradable', 'prototype', 'iteration'. No words, no pointing at objects. Other students guess and explain the term.
- *Phases:* any | *Bloom:* remember, understand | *Grouping:* whole_class
- *Time:* 5-8 min | *Energy:* high | *Boosts:* teacher craft
- **DECISION: [x] APPROVE**

**5. Mystery Material** (mystery-material)
- *Description:* Pass around an unknown material. Students must identify its properties by touch, weight, flexibility, and appearance. Then guess what it's used for.
- *Example:* Pass around a piece of kevlar fabric without naming it. Feel, stretch, try to tear, weigh. Properties: strong, lightweight, flexible, woven. What could this be used for? (Body armour, sails, tyres)
- *Phases:* discover | *Bloom:* analyze, understand | *Grouping:* whole_class, small_group
- *Time:* 5-8 min | *Energy:* medium | *Boosts:* cognitive rigour, teacher craft
- *Prep:* Source an interesting material sample
- *Best for:* design units
- **DECISION: [x] APPROVE**

**6. Material Scavenger Hunt** (material-scavenger-hunt)
- *Description:* Give teams a list of material properties (flexible, transparent, waterproof, rigid). They have 5 min to find examples around the room/school. First team with all properties wins.
- *Example:* Find something: flexible + strong, rigid + lightweight, transparent + waterproof, natural + decorative. Take a photo of each. 5 minutes. Go!
- *Phases:* discover | *Bloom:* understand, apply | *Grouping:* small_group
- *Time:* 5-10 min | *Energy:* high | *Boosts:* teacher craft
- *Best for:* design units
- **DECISION: [x] APPROVE**

**7. Sentence Starters Wall** (sentence-starters-wall)
- *Description:* Display sentence starters relevant to the current phase on the classroom wall. Students can reference them during discussions and written work. Swap them each phase.
- *Example:* Ideation starters: 'What if we...' / 'Building on that...' / 'A completely different approach...' Evaluation starters: 'The strength of this is...' / 'This might fail because...' / 'Compared to option B...'
- *Phases:* any | *Bloom:* understand, apply | *Grouping:* individual
- *Time:* 2-3 min | *Energy:* low | *Boosts:* teacher craft
- *Prep:* Print or write phase-specific sentence starter cards
- **DECISION: [x] APPROVE**

### Collaboration Structures (8 moves)

**1. Think-Pair-Share** (think-pair-share)
- *Description:* Individual thinking (1 min) → pair discussion (2 min) → share with class (2 min). Classic but effective. Ensures every student processes the question before hearing others.
- *Example:* 'How could you make this design more sustainable?' Think alone for 1 min. Discuss with your partner for 2 min. Share your best idea with the class.
- *Phases:* any | *Bloom:* analyze, evaluate | *Grouping:* pair
- *Time:* 5-8 min | *Energy:* low | *Boosts:* student agency, teacher craft
- **DECISION: [x] APPROVE**

**2. Jigsaw Expert Groups** (jigsaw-expert-groups)
- *Description:* Divide content into 4 chunks. Each group becomes expert in 1 chunk, then reforms into mixed groups where each expert teaches their piece.
- *Example:* 4 joining techniques: Group A learns butt joints, Group B mitre joints, Group C dovetails, Group D pocket screws. Then regroup: each new team h expert per technique.
- *Phases:* discover | *Bloom:* understand, evaluate | *Grouping:* small_group
- *Time:* 20-30 min | *Energy:* medium | *Boosts:* teacher craft, student agency
- **DECISION: [x] APPROVE**

**3. Mini Design Sprint** (design-sprint)
- *Description:* Compressed version of Google Ventures' design sprint: Understand (5 min) → Sketch (5 min) → Decide (3 min) → Prototype (10 min) → Test (5 min).
- *Example:* In 30 minutes, your team will: understand the brief, sketch 3 solutions each, vote on the best, build a paper prototype, test with another team.
- *Phases:* ideate, prototype | *Bloom:* create, evaluate | *Grouping:* small_group
- *Time:* 25-35 min | *Energy:* high | *Boosts:* student agency, cognitive rigour
- **DECISION: [x] APPROVE**

**4. World Café** (world-cafe)
- *Description:* 3-4 discussion tables with different questions. Groups rotate every 8 min. A 'table host' stays to brief incoming groups on previous insights.
- *Example:* Table 1: 'Who is our user?' Table 2: 'What are the constraints?' Table 3: 'What exists already?' Table 4: 'What's the real problem?' Rotate every 8 min. Hosts summarise.
- *Phases:* discover, define | *Bloom:* analyze, evaluate | *Grouping:* small_group
- *Time:* 20-35 min | *Energy:* medium | *Boosts:* student agency, cognitive rigour
- *Prep:* Set up 3-4 tables with flipchart paper and question prompts
- **DECISION: [x] APPROVE**

**5. Pair Design (Driver/Navigator)** (pair-programming-design)
- *Description:* One student draws/builds (driver), the other gives verbal instructions only (navigator). Swap roles every 5 min. Prevents one person dominating.
- *Example:* Navigator: 'Draw a circle for the base, about 5cm diameter. Now add a vertical line up from center...' Driver sketches only what's described. Swap after 5 min.
- *Phases:* prototype, ideate | *Bloom:* create, apply | *Grouping:* pair
- *Time:* 10-15 min | *Energy:* medium | *Boosts:* student agency, teacher craft
- **DECISION: [x] APPROVE**

**6. Backwards Action Plan** (action-plan-backwards)
- *Description:* Start with the end goal (presentation day, community event, final product) and work backwards to today. What needs to happen the week before? The month before? This week?
- *Example:* Presentation is June 1. Work backwards: May 25 = rehearsal. May 18 = final edits. May 11 = first draft. May 4 = research complete. Today (April 1) = choose topic and find 3 sources.
- *Phases:* define | *Bloom:* apply, analyze | *Grouping:* individual, pair
- *Time:* 10-15 min | *Energy:* low | *Boosts:* student agency
- *Best for:* service, pp units
- **DECISION: [x] APPROVE**

**7. Speed Networking** (speed-networking)
- *Description:* Students form two circles (inner and outer). Inner rotates every 2 min. Each pair shares one thing about their project. Fast, social, energising.
- *Example:* Inner circle describes their design problem. Outer circle suggests one material. Rotate. Now inner describes their user. Outer suggests one constraint to consider. Rotate.
- *Phases:* ideate, discover | *Bloom:* understand, apply | *Grouping:* pair
- *Time:* 8-12 min | *Energy:* high | *Boosts:* student agency, teacher craft
- **DECISION: [x] APPROVE**

**8. Anchor Chart Co-Creation** (anchor-chart)
- *Description:* Teacher and students build a reference chart together on the board. Students contribute examples, the teacher organises. Chart stays visible all unit.
- *Example:* Create an anchor chart for 'Properties of Materials'. Left column: property name. Middle: definition (students suggest). Right: example from our project (students contribute). Stays on the wall.
- *Phases:* discover | *Bloom:* understand, remember | *Grouping:* whole_class
- *Time:* 8-12 min | *Energy:* low | *Boosts:* teacher craft
- **DECISION: [x] APPROVE**

### Presentation & Sharing (3 moves)

**1. 60-Second Pitch** (60-second-pitch)
- *Description:* Students have exactly 60 seconds to pitch their idea to a partner. Partner asks ONE question. Rotate 3 times. Forces clarity and identifies weak spots fast.
- *Example:* After 20 min of ideation, each student stands and pitches their best idea in 60 seconds. Partner asks: 'Who is this for?' or 'How does it actually work?'
- *Phases:* ideate, define | *Bloom:* evaluate, analyze | *Grouping:* pair
- *Time:* 8-12 min | *Energy:* high | *Boosts:* student agency, cognitive rigour
- *Variations:* Elevator pitch (30 seconds); Shark Tank format with panel
- **DECISION: [x] APPROVE**

**2. Pecha Kucha (20×20)** (pecha-kucha)
- *Description:* Present using exactly 20 slides, each shown for exactly 20 seconds. Auto-advancing slides force concise storytelling. Adapted: 6 slides × 30 seconds for younger students.
- *Example:* 6 slides, 30 seconds each. Slide 1: The problem. Slide 2: My user. Slide 3: My idea. Slide 4: How I made it. Slide 5: How I tested it. Slide 6: What I'd change.
- *Phases:* test | *Bloom:* evaluate, create | *Grouping:* individual
- *Time:* 5-8 min | *Energy:* medium | *Boosts:* student agency, cognitive rigour
- **DECISION: [x] APPROVE**

**3. Museum Exhibit** (museum-exhibit)
- *Description:* Students set up their work  museum exhibit with a label card, process photos, and interactive element. Visitors walk through and leave feedback.
- *Example:* Set up your exhibit: product on display, label card (title, designer, materials, inspiration), process photos, one question for visitors to answer on a sticky note.
- *Phases:* test | *Bloom:* evaluate, create | *Grouping:* individual
- *Time:* 15-25 min | *Energy:* medium | *Boosts:* student agency, teacher craft
- **DECISION: [x] APPROVE**

---

**Summary:** 55 moves reviewed 3 April 2026. **52 APPROVED, 3 REJECTED** (direct duplicates of interactive toolkit tools that are already embeddable as lesson blocks). Rejected: 5 Whys (→ Five Whys tool), Gallery Vote (→ Dot Voting tool), Silent Brainstorm (→ Brainstorm Web tool). Physical critique protocols (Two Stars & a Wish, Warm/Cool Feedback) kept alongside their digital toolkit counterparts — teachers may want the physical version in one lesson and the digital version in another.


---

## Appendix B: Dimensions v1 Fields Carried Forward

The following fields from Dimensions v1 (migrations 057-058) are reused in the block schema:
- `bloom_level` (activity level)
- `time_weight` (activity level)
- `grouping` (activity level)
- `ai_rules` (activity level)
- `udl_checkpoints` (activity level)
- `phase` (mapped from lesson_flow phases)

The following Dimensions v1 infrastructure is reused:
- `useActivityTracking` hook (client-side tracking → feedback system input)
- Lesson editor dimension selectors (bloom, grouping, time_weight, UDL picker)
- Pace feedback system (student → teacher → feedback loop)

---

## Section 15: Teaching Panel — Architecture Considerations

> **STATUS:** Design deferred. These are architectural decisions made NOW to ensure Dimensions3 doesn't close the door on a rich teaching cockpit later. The current teaching panel (`/teacher/teach/[unitId]`) polls student status every 30s and shows a name grid with traffic lights. Once Dimensions3 data is flowing, it becomes significantly more powerful. Nothing here needs building during Dimensions3 — but the data model and API contracts must support it.

### 15.1 Activity-Level Progress (Not Just Page-Level)

**Current state:** `student_progress` tracks responses per page. The live-status API (`/api/teacher/teach/live-status`) only reads page-level data.

**What the teaching panel needs:** Which *activity* a student is on, not just which page. "Student X has been on Activity 4 for 12 minutes (expected: 8)" is actionable. "Student X is on Page 2" is not.

**Architecture requirement:** `useActivityTracking` already collects `time_spent_seconds` per activity as `_tracking_<activityKey>` in `student_progress.responses`. Dimensions3 gives every activity a first-class ID (block ID or generated-activity ID). The live-status API just needs to read deeper into the JSONB — no schema change needed.

**Action during Dimensions3:** None. The data grain is already correct. When the teaching panel is designed, the API reads `_tracking_*` keys from `student_progress.responses` to compute per-activity status.

### 15.2 StudentSignalSnapshot — Unified Signal Projection

**Current state:** Signals are scattered across tables:
- Integrity metadata → `student_progress.integrity_metadata` (JSONB)
- Pace feedback → `lesson_feedback.feedback_data.pace`
- Activity tracking → `student_progress.responses._tracking_*` keys
- Toolkit state → `student_progress.responses` (JSON blobs)
- Discovery profile → `discovery_sessions.profile_data`
- Learning profile → `students.learning_profile`
- NM self-assessment → `competency_assessments`
- Open Studio drift → `open_studio_sessions.drift_flags`

**What the teaching panel needs:** A single "what's happening with this student right now?" view. Not 8 separate queries.

**Architecture requirement:** Define a `StudentSignalSnapshot` read-only type — a projection that aggregates across tables into one object per student. Not a new table (signals change too frequently for materialized storage). A typed query/view that the teaching panel API can call.

**Action during Dimensions3 Phase A:** Define the `StudentSignalSnapshot` TypeScript interface alongside other typed contracts. Even if nothing reads it yet, the shape is locked in:

```typescript
interface StudentSignalSnapshot {
  studentId: string;
  currentPageId: string | null;
  currentActivityId: string | null;
  activityTimeSeconds: number;
  expectedTimeSeconds: number; // from block's time_weight
  integrityScore: number | null; // 0-100
  integrityFlags: string[]; // active flag names
  paceSignal: 'too_slow' | 'just_right' | 'too_fast' | null;
  driftLevel: 'none' | 'gentle' | 'direct' | 'silent' | null;
  needsHelp: boolean; // derived: inactive 3+ min OR drift=direct+
  scaffoldingUsed: boolean; // did they open/use scaffold on current activity
  bloomLevel: string | null; // current activity's bloom level
  lastActiveAt: string; // ISO timestamp
}
```

### 15.3 Teaching Panel as Feedback Signal Source

**Current state:** Dimensions3 Pillar 4 computes efficacy from teacher edit tracking (highest signal) + student completion + time accuracy.

**What the teaching panel adds:** Real-time teacher observations during a live lesson. "Activity X is taking 3× longer than expected" or "80% of students skipped the scaffold on Activity Y" are things the teacher SEES in class. These are high-value signals that should feed into efficacy scoring.

**Architecture requirement:** The feedback system should accept `source: 'teaching_panel'` alongside `source: 'edit_tracking'`. Two interaction patterns:

1. **Implicit signals:** The teaching panel already knows which activities take longer than expected (it has `time_spent_seconds` vs `expectedTimeSeconds`). These can feed into efficacy automatically — no teacher action needed.

2. **Explicit signals:** Teacher taps a button on an activity ("this isn't working" / "students loved this" / "too hard" / "too easy"). Quick, one-tap, mid-class. These are the richest feedback because they combine data observation with pedagogical judgment.

**Action during Dimensions3:** Ensure the efficacy update function accepts a `source` parameter (not hardcoded to edit tracking). Add `'teaching_panel'` to the source enum. The actual POST endpoint and UI are built later.

```typescript
type EfficacySignalSource = 'edit_tracking' | 'teaching_panel' | 'student_completion' | 'time_accuracy';

interface EfficacySignal {
  blockId: string;
  source: EfficacySignalSource;
  direction: 'positive' | 'negative' | 'neutral';
  magnitude: number; // 0-1, how strong the signal is
  context?: Record<string, unknown>; // source-specific metadata
}
```

### 15.4 Transport: Don't Bake In Polling

**Current state:** 30-second polling to `/api/teacher/teach/live-status`. Fine for "is the student online?" but too slow for "which activity are they on?" during a live lesson.

**Architecture requirement:** Keep the live-status API stateless and thin (it's a read, not a subscription). When we upgrade to Supabase Realtime or SSE later, the data shape stays the same — only the transport changes. The `StudentSignalSnapshot` type is transport-agnostic.

**Action during Dimensions3:** None. Just don't add any polling-specific logic to the data layer. The API returns snapshots; whether those snapshots are polled or pushed is a transport decision made later.

### 15.5 Class-Level Aggregates

**What the teaching panel needs:** "3 students stuck on Activity 4, average time 12 min vs expected 8 min, 2 integrity flags active." Computing this from raw `student_progress` rows on every poll is expensive with 30 students.

**Architecture requirement:** A `ClassActivityAggregate` computation that summarizes per-activity stats across the class. Not a new table — a cache layer in the API route (compute once, cache 10-15 seconds, invalidate on next poll).

**Action during Dimensions3:** None. When the teaching panel API is built, add a simple in-memory cache keyed by `classId:pageId` with 15-second TTL. The aggregate computation reads the same `StudentSignalSnapshot` data.

### 15.6 Summary of Phase A Actions

Only one concrete action during Dimensions3 build:

1. **Define `StudentSignalSnapshot` interface** in the shared types file alongside other typed contracts (Phase A, Day 1, ~15 min)
2. **Define `EfficacySignalSource` enum** with `'teaching_panel'` included (Phase A, when writing efficacy types, ~5 min)
3. **Ensure efficacy update function accepts `source` parameter** (Phase D, when building feedback loop, ~10 min)

Everything else is a design note for the future teaching panel build. The data model, signal infrastructure, and feedback pipeline from Dimensions3 naturally support all of this — no architecture changes needed, just awareness of what's coming.

---

## 16. Future: Student-Designed Units

**Status: FUTURE FEATURE — not part of the Dimensions3 build, but the architecture must not close the door.**

### 16.1 The Vision

Students fork a teacher's master unit and design their own version around a personal hobby or interest. The teacher's master defines the constraints (required criteria, minimum bloom coverage, mandatory phases, locked activities like safety briefings or final presentations). Students fill in the rest — choosing their own topic, selecting activity blocks from the library, and customising context.

This turns StudioLoom from "teacher designs, student follows" into "teacher sets the rules of the game, student designs their own path through it."

### 16.2 Why the Architecture Already Supports This

- **Fork model:** `units.content_data` → `class_units.content_data` proves copy-on-write inheritance with fallback to parent. A student fork is a third tier in the same chain.
- **Activity Block Library:** Students search and assemble blocks the same way the generation pipeline does. The retrieval API isn't teacher-specific — it queries blocks by embedding similarity, bloom level, phase, and category.
- **FrameworkAdapter:** Student-designed units stay framework-neutral. The adapter renders the right criterion labels at display time based on the class's framework. Students never need to know what "Criterion B" means.
- **FormatProfile:** Already defines per-format constraints (required phases, minimum bloom variety, work time floors). This IS the constraint skeleton.
- **ai_rules:** Per-activity AI mentoring rules travel with blocks. When a student places a brainstorming block, the mentor automatically follows divergent-phase rules.
- **Generation pipeline (gap-fill):** If a student's assembled unit is missing a required phase or activity type, the pipeline can generate suggestions to fill the gaps — the same Stage 3 gap-fill logic teachers use.
- **Discovery Engine:** Already captures student interests, archetypes, and working styles. This data could seed the block retrieval query ("show me research activities related to skateboarding" using the student's Discovery profile).

### 16.3 The Constraint Layer (Not Built Now)

The one new concept is a `unit_constraints` object on the master unit defining what's locked vs student-editable:

```typescript
interface UnitConstraints {
  required_phases: string[];           // e.g., ["investigate", "create"] — must appear
  required_bloom_coverage: string[];   // e.g., ["analyse", "evaluate"] — at least one activity at each
  required_criteria: string[];         // neutral keys — e.g., ["designing", "evaluating"]
  min_activities_per_phase?: Record<string, number>; // e.g., { "create": 2 }
  required_categories?: string[];      // e.g., ["critique", "reflection"]
  locked_activities?: string[];        // block IDs pinned by teacher — cannot be removed
  locked_sequence_positions?: Record<string, 'first' | 'last'>; // e.g., safety briefing must be first
  max_total_activities?: number;       // prevents bloat
  student_editable: {
    topic: boolean;                    // almost always true
    context: boolean;                  // almost always true
    activity_selection: boolean;       // the core student agency lever
    activity_sequencing: boolean;      // can they reorder within phases?
    materials: boolean;
    extensions: boolean;
    ai_rules_tone: boolean;            // can students customise AI mentor tone?
  };
}
```

Validation: a `validateAgainstConstraints(studentContent, constraints)` function checks the student's fork satisfies all requirements. Returns pass/fail with specific gaps ("missing an Evaluate-level activity", "no critique activity found"). The UI shows these as a checklist the student works toward.

### 16.4 Architectural Guardrails During Dimensions3 Build

These are not features to build — they're "don't accidentally prevent this" notes:

1. **Block retrieval must not hardcode teacher auth.** The search/retrieval function should accept a generic user context, not `requireTeacherAuth`. The auth policy ("can students browse?") is a separate gate applied later. *(Phase B, when building retrieval API.)*

2. **`ai_rules` schema should note dual consumers.** Document that ai_rules are consumed by both the generation pipeline AND the student Design Assistant. Rules should work as live mentoring guidance, not just generation instructions. *(Phase A, when defining ActivityBlock schema.)*

3. **`ai_rules` should support an `editable` concept.** Not building the flag now, but the schema documentation should note that individual rules may eventually be teacher-locked vs student-editable. A teacher locks `phase: "divergent"` but lets students customise `tone`. *(Phase A, schema documentation note.)*

4. **FormatProfile should anticipate a `constraints` field.** The interface doesn't need the field yet, but a `// Future: UnitConstraints` comment keeps the door open. *(Phase A, when defining FormatProfile.)*

5. **Block efficacy scoring must be user-agnostic.** Efficacy is about the block's quality, not who placed it. A student-assembled unit should contribute the same efficacy signals as a teacher-assembled one. *(Phase D, when building feedback loop.)*

### 16.5 Build Estimate (Future, Not Now)

Once Dimensions3 is complete, student-designed units would take approximately:
- Constraint layer (schema + validation): ~2 days
- Student fork UI (block search, assembly, constraint checklist): ~3-4 days
- Student fork storage (third tier in resolution chain): ~1 day
- Gap-fill integration (suggest blocks for missing requirements): ~1 day
- Discovery profile → block retrieval seeding: ~1 day

**~8-10 days total, built entirely on Dimensions3 infrastructure.**

---

## 17. Content Safety & Moderation 🔵 [ADDED 4 Apr — Matt Q2, Q16]

**Status: ARCHITECTURAL REQUIREMENT — must be designed during Dimensions3, enforced from day 1.**

Schools are legally liable for content shown to minors. StudioLoom processes user-generated content from students (text responses, image uploads, voice recordings, AI chat, gallery posts) and teacher-generated content (unit content, knowledge base uploads, block library entries). Both streams need monitoring.

### 17.1 Content Streams Requiring Moderation

| Stream | Source | Risk Level | Volume |
|--------|--------|------------|--------|
| Student text responses | Lesson activities, reflections, toolkit tools | HIGH — minors generating free text | Every student, every lesson |
| Student image/video uploads | Portfolio, gallery submissions, canvas drawings | HIGH — visual content from minors | Per activity requiring upload |
| Student AI chat | Design Assistant, Open Studio check-ins | MEDIUM — AI responses are controllable, student inputs are not | Every AI interaction |
| Gallery posts & peer reviews | Class Gallery peer review system | HIGH — student-to-student content | Every gallery round |
| Teacher uploads (knowledge base) | PDF, DOCX, PPTX, images | LOW — teacher is a trusted adult | Per upload |
| Block Library content | Teacher-created blocks, community blocks (future) | MEDIUM — grows with community sharing | Per block creation |
| Unit Import content | External lesson plans, schemes of work | MEDIUM — unknown provenance | Per import |

### 17.2 Moderation Architecture

**Two-layer approach:**

**Layer 1: Real-Time Client-Side Filtering**
- Keyword blocklist (profanity, slurs, self-harm terms) checked on every text submission before API call
- Image upload pre-screening via browser-side NSFW classifier (lightweight model, ~200KB)
- Blocked content shows gentle student-facing message ("This content can't be submitted. If you think this is a mistake, talk to your teacher.")
- Zero-tolerance: blocked content never reaches the server

**Layer 2: Server-Side AI Moderation**
- All student text submissions passed through a lightweight moderation classifier (Haiku) before storage
- Flags: `inappropriate_language`, `bullying`, `self_harm_risk`, `sexual_content`, `violence`, `personal_information_exposure`
- Flag severity: `info` (logged only) | `warning` (saved, teacher notified) | `critical` (blocked, teacher + admin notified)
- Image/video moderation via vision model (Haiku multimodal) — checks for NSFW, violence, personal information in photos
- AI chat moderation: Design Assistant already has guardrails in system prompt; add output scanning for hallucinated inappropriate content

### 17.3 Teacher Dashboard — Safety Alerts

New section in Smart Insights panel (or dedicated Safety tab in admin):
- Per-class safety incident log (timestamp, student, content type, flag, severity, content snippet)
- Aggregate stats: flags per week, trending concerns, repeat offenders
- One-click actions: dismiss false positive, contact student, escalate to admin
- Critical alerts surface as red badges on teacher dashboard (cannot be dismissed without acknowledgment)

### 17.4 Student-Facing Guardrails

- **Gallery posts:** Content scanned before submission becomes visible to peers. Flagged content held in moderation queue (teacher must approve before peers see it).
- **AI chat:** If student input is flagged, AI responds with de-escalation ("I noticed something in your message that I want to flag. Let's focus on your design work.") and logs the interaction for teacher review.
- **Peer reviews:** Reviewed for bullying/inappropriate language before delivery to recipient. Flagged reviews held for teacher approval.
- **Portfolio:** Student portfolio content visible to teacher only unless explicitly shared via Gallery.

### 17.5 Data Retention & Reporting

- Flagged content retained for 90 days (configurable by school policy) for audit trail
- Incident reports exportable as CSV/PDF for school administration
- Critical incidents (self-harm risk) trigger immediate notification to teacher email (not just dashboard)
- COPPA/GDPR compliance: flagged content containing PII is redacted in logs after teacher review

### 17.6 For Dimensions3 Build

**Phase A (Foundation):**
- Add `moderation_status` field to `student_progress` responses: `'clean' | 'flagged' | 'blocked'`
- Add `moderation_flags` JSONB field for flag details
- Add `content_moderation_log` table (incident tracking)
- Design the moderation API contract: `moderateContent(text: string, context: ModerationContext) → ModerationResult`

**Phase B-C (Pipeline):**
- Ingestion pipeline (Pass A) includes basic content safety scan on uploaded materials
- Block Library entries scanned on creation/import

**Phase D (Feedback Loop):**
- Gallery moderation queue integrated with approval workflow
- Teacher safety alert feed integrated with Smart Insights

**Phase E (Post-launch):**
- Self-harm detection with mandatory teacher notification
- Image/video moderation pipeline
- School-level safety policy configuration (strictness levels, custom blocklists)

### 17.7 Industry Standards Reference

- **COPPA** (Children's Online Privacy Protection Act) — applies to users under 13
- **KCSIE** (Keeping Children Safe in Education, UK) — requires schools to have filtering and monitoring
- **E-Safety frameworks** (Australian eSafety Commissioner) — mandatory reporting of certain content
- **FERPA** (Family Educational Rights and Privacy Act) — student data protection in US schools

The moderation system must be configurable per school/region to meet local requirements. Default: strictest settings, teacher can relax for their context.

---

## 18. Same-School Architecture 🔵 [ADDED 4 Apr — Matt Q5]

**Status: FUTURE CONSIDERATION — not part of Dimensions3 build, but implications noted.**

### 18.1 The Question

When multiple teachers at the same school use StudioLoom, what are the implications? Students may appear in different teachers' classes. Teachers may want to share units, blocks, or templates. School admins may want a unified view.

### 18.2 Current Architecture

StudioLoom is currently single-teacher: each teacher is an island. `author_teacher_id` on students, units, and blocks means ownership is per-teacher. The `class_students` junction table allows multi-class enrollment but only within one teacher's classes.

### 18.3 What Dimensions3 Must NOT Do

1. **Do not hardcode single-teacher ownership on blocks.** The `activity_blocks.author_teacher_id` field is fine, but retrieval queries should accept a `visibility` filter (`'private' | 'school' | 'public'`) even if only `'private'` is implemented now. *(Phase B, retrieval API.)*

2. **Do not assume student uniqueness is per-teacher.** A student named "Alex" in Teacher A's class and Teacher B's class might be the same person. The `students` table currently has no school-level identity. Adding a `school_id` FK later should not require restructuring the junction tables. *(No action needed — current schema is additive-friendly.)*

3. **Block Library visibility field.** Add `visibility: 'private'` as default on `activity_blocks`. This is a one-column addition that enables future school-wide and community sharing without schema changes. *(Phase A, block schema.)*

### 18.4 When This Becomes a Real Project

Same-school architecture is part of the **Enterprise tier** (see `docs/projects/monetisation.md`). It requires:
- School entity (`schools` table with admin users)
- Teacher-school membership
- Student deduplication (same student across teachers)
- Shared block libraries (school-wide)
- School-wide admin dashboard
- SSO integration (Azure AD, Google Workspace)

**Estimated effort:** ~2-3 weeks. Not on critical path. Current single-teacher model works for early adopters (solo teachers trying StudioLoom independently). School-wide features are a selling point for the Enterprise tier.

---

## 19. Loominary OS Migration Seams 🔵 [ADDED 5 Apr]

**Status: DESIGN DECISIONS — low-cost changes to make during Dimensions3 build that prevent rework when migrating to the Loominary OS shared ingestion architecture.**

**Source docs:** `systems/Ingestion/ingestion-pipeline-summary.md`, `systems/Ingestion/ingestion-companion-systems.md`

### 19.1 Context

The Loominary OS architecture defines a shared ingestion layer across all 10 education apps (StudioLoom, Jkids, PYP, PP, DP, etc.). It has two pipelines:
- **Pipeline 1 (Teacher Content)** — structured curriculum materials → RAG indexing + block extraction. This is what Dimensions3 builds for StudioLoom.
- **Pipeline 2 (Student Work)** — messy real-world submissions (photos, sketches, audio) → processing + enrichment + versioning + contextual feedback. This is a separate project (`docs/projects/studentwork.md`).

Seven companion systems sit alongside: Storage & Media, Job Queue, Knowledge Layer, Feedback Engine, Moderation, Notifications, Portfolio Renderer.

Dimensions3 builds Pipeline 1 for StudioLoom. These migration seams ensure it lifts cleanly into the OS layer later without rewriting.

### 19.2 Migration-Aware Changes (apply during Dimensions3 build)

**Seam 1: Stateless ingestion pass functions**

Each ingestion pass (Pass A, Pass B, future passes) must be a pure function: `(input: PassInput, config: PassConfig) => Promise<PassOutput>`. No dependency on the HTTP request object, no reading from `req.headers`, no direct Supabase client construction inside the function. The API route creates the client and passes dependencies in via `config`.

This means v1 calls passes synchronously inside Next.js API routes, but the same functions can be wrapped in OS job queue workers later with zero refactoring.

**Implementation:** Already mostly satisfied by the `IngestionPass<TInput, TOutput>` interface (Section 4). Enforce that `run()` receives a `supabaseClient` via `PassConfig` rather than constructing one internally.

**Seam 2: `module` column on activity_blocks**

Add to the block schema (Section 6.2):

```sql
  -- OS migration seam
  module TEXT DEFAULT 'studioloom',       -- Which Loominary app this block belongs to
                                          -- Enables cross-app block retrieval when other apps come online
```

Add index: `CREATE INDEX idx_blocks_module ON activity_blocks(module);`

Zero cost now. Enables cross-app block retrieval queries (`WHERE module IN ('studioloom', 'jkids')`) when Makloom or other apps launch.

**Seam 3: Generic upload entity name**

The upload tracking table (currently implicit — `source_upload_id` on blocks references... what?) should be explicitly created as `content_items` — matching the OS schema name. This IS the OS's `content_items` table, just StudioLoom-scoped for now.

```sql
CREATE TABLE content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id),
  school_id UUID,                         -- Nullable until school entity exists (Section 18)
  module TEXT DEFAULT 'studioloom',        -- OS seam

  -- Identity
  title TEXT,
  content_type TEXT NOT NULL,             -- 'lesson_plan' | 'scheme_of_work' | 'rubric' | 'resource' | 'textbook_extract' | 'worksheet'
  subject TEXT,
  strand TEXT,                            -- Curriculum strand/topic area
  level TEXT,                             -- Grade/year level

  -- Ingestion state
  file_hash TEXT,                         -- SHA-256 for dedup (Stage I-0)
  storage_path TEXT,                      -- Supabase Storage path to original file
  mime_type TEXT,
  file_size_bytes BIGINT,
  processing_status TEXT DEFAULT 'pending', -- pending/processing/completed/failed
  pass_results JSONB,                     -- Per-pass output stored for sandbox replay

  -- Extracted content
  raw_extracted_text TEXT,
  parsed_sections JSONB,                  -- Stage I-1 output
  classification JSONB,                   -- Stage I-2 (Pass A) output
  enrichment JSONB,                       -- Stage I-3 (Pass B) output

  -- Metadata
  blocks_extracted INT DEFAULT 0,         -- Count of activity_blocks created from this item
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

`activity_blocks.source_upload_id` becomes `REFERENCES content_items(id)`.

**Seam 4: Media extraction during parsing**

Stage I-1 (Deterministic Parsing) should extract and store images/diagrams from uploaded documents, not discard them. Even teacher content uploads contain reference images, exemplar photos, and diagrams that are valuable for:
- Block-level media (showing students what the expected output looks like)
- Future visual RAG (retrieving relevant images alongside text chunks)
- OS Portfolio Renderer (displaying source materials)

Store as `content_assets` (matching OS schema):

```sql
CREATE TABLE content_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,               -- 'image' | 'diagram' | 'table' | 'chart'
  storage_path TEXT NOT NULL,             -- Supabase Storage path
  thumbnail_path TEXT,                    -- Auto-generated thumbnail
  mime_type TEXT,
  file_size_bytes BIGINT,
  extracted_text TEXT,                    -- OCR text if applicable
  page_number INT,                       -- Source page in document
  section_index INT,                     -- Which parsed section this belongs to
  ai_description TEXT,                   -- Optional: Pass B can describe what the image shows
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Add `media_asset_ids UUID[]` to `activity_blocks` schema — links blocks to their associated visual assets from the source document.

### 19.3 What NOT to Build (separate projects)

| System | OS Component | Why Not Now |
|--------|-------------|-------------|
| Student Work Pipeline | Pipeline 2 | Different problem space entirely — image enhancement, OCR, handwriting recognition. Separate project: `docs/projects/studentwork.md` |
| Job Queue | `job-queue` | Dimensions3 volume is low (teacher uploads, not student submissions). Synchronous processing is fine. Stateless pass functions (Seam 1) are the migration bridge. |
| Notification Service | `notifications` | OS-level concern. No ingestion-triggered notifications needed for v1. |
| Portfolio Renderer | `portfolio` | Depends on student work pipeline + cross-module data. Existing portfolio auto-pipeline is sufficient. |
| Full Moderation | `moderation` | PII scanning + copyright flags (already in spec) cover teacher content. Full moderation (image safety, plagiarism, AI detection) is Pipeline 2 territory. |

### 19.4 Schema Alignment Summary

| OS Schema | Dimensions3 Equivalent | Status |
|-----------|----------------------|--------|
| `content_items` | `content_items` (Seam 3) | **NEW — add to Phase A migration** |
| `content_assets` | `content_assets` (Seam 4) | **NEW — add to Phase A migration** |
| `content_chunks` (knowledge layer) | Existing `knowledge_chunks` table | Already exists — rename later if needed |
| `work_items` | N/A (Pipeline 2) | Separate project |
| `work_versions` | N/A (Pipeline 2) | Separate project |
| `work_assets` | N/A (Pipeline 2) | Separate project |
| `jobs` | N/A (job queue) | Not needed for v1 volume |
| `feedback_items` | N/A (feedback engine) | Partial overlap with existing `lesson_feedback` |
| `moderation_results` | `pii_flags` JSONB on blocks | Lightweight version sufficient for Pipeline 1 |

---

*End of spec. Version 1.4 — 5 April 2026. Changes from 1.3: Section 19 (Loominary OS Migration Seams — 4 low-cost design decisions for OS compatibility: stateless passes, module column, content_items table, media extraction). All additions marked with 🔵.*
