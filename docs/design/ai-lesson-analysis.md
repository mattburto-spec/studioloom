# AI-Powered Lesson Intelligence System

## The Real Problem

The current upload pipeline treats lessons as documents to be searched. That's the wrong abstraction. A lesson isn't a document — it's a **teaching performance encoded in text**. The system needs to understand:

- Why a lesson works, not just what it contains
- How scaffolding builds and when supports get removed
- What experienced teachers do that beginners don't
- How a unit tells a story across weeks — tension, struggle, resolution
- Workshop realities: tool rotation, cleanup time, setup logistics, safety integration
- The difference between "covering" a criterion and genuinely developing the skill
- How pacing changes by age group, energy, and time of day
- That after a heavy making session, students need a calmer activity — not another intense build

The goal isn't a search engine for old lesson text. It's building a **pedagogical intelligence layer** that learns what great design teaching looks like and reproduces that thinking when building new units.

---

## Design Philosophy

### Multi-Pass Analysis (not single-prompt extraction)

A single prompt asking "extract the lesson structure" gives you a table of contents. To get real teaching intelligence, analysis needs multiple passes:

1. **Pass 1: Structure** — What's in this document? Sections, activities, timing, materials.
2. **Pass 2: Pedagogy** — Why is it structured this way? What teaching moves are embedded? Where are the check-for-understanding moments? How does scaffolding progress? What's the cognitive load curve?
3. **Pass 3: Design Teaching Specifics** — How does this relate to the design cycle? What criterion skills are genuinely being developed (not just mentioned)? What workshop management is implied? What tools are students actually using and how are they being taught to use them?

Each pass builds on the previous one. The AI sees its own prior analysis before going deeper.

### Pedagogical Reasoning (not just labelling)

Bad: `{ phase: "guided_practice", duration: 20 }`
Good:
```
This guided practice phase works because it limits variables — students test
only 3 pre-built bridge types before designing their own. This prevents the
common Year 9 mistake of jumping straight to building without understanding
structural principles. The teacher circulates with a checklist, not to grade,
but to identify misconceptions before independent work begins. Students who
grasp the concepts early get an extension challenge (cantilever bridge) while
struggling students get a simplified 2-bridge comparison.
```

The system needs to capture **why things work**, not just **what happens**.

### Workshop-Aware Intelligence

Design teaching happens in workshops, not lecture halls. The system must understand:

- **Tool rotation**: 30 students, 3 laser cutters = you need station rotation, not "everyone laser cuts now"
- **Setup and cleanup time**: A lesson with hot glue guns loses 5 min to setup, 5 min to cleanup. That's real.
- **Safety integration**: Good teachers weave safety into the activity ("before you switch on, check your neighbour's setup"), not as a separate lecture
- **Material constraints**: A lesson plan that needs 30 Arduino kits doesn't work if you have 10
- **Noise and energy management**: After a loud making session, a quiet reflection works. After a long research day, students need to move.
- **The "5 and 5" problem**: 5 students finish early, 5 need more time. How does the lesson handle this?

### Unit as Narrative Arc (not disconnected pages)

A great unit tells a story:
- **Act 1 (Criterion A)**: The inciting incident — students encounter a real problem that matters
- **Act 2 (Criterion B)**: Rising action — ideas proliferate, get tested, some fail
- **Act 3 (Criterion C)**: The struggle — building, iterating, problem-solving under constraint
- **Act 4 (Criterion D)**: Resolution — stepping back, evaluating honestly, understanding growth

The wizard needs to understand this arc and generate units that feel like coherent journeys, not checklists.

---

## The Lesson Intelligence Model

### LessonProfile (v2 — deep analysis)

```typescript
interface LessonProfile {
  // ─── Identity ───
  title: string;
  subject_area: string;
  grade_level: string;
  estimated_duration_minutes: number;
  lesson_type: "single_lesson" | "multi_lesson_sequence" | "unit_overview" | "activity_template" | "assessment_task";

  // ─── Curriculum Alignment (with reasoning) ───
  criteria_analysis: Array<{
    criterion: "A" | "B" | "C" | "D";
    emphasis: "primary" | "secondary" | "touched";
    skill_development: string;    // WHAT skill is genuinely developed
    how_developed: string;        // HOW the lesson develops it (not just "students do X")
    evidence_from_text: string;   // quote showing this
    assessment_embedded: boolean; // is assessment woven into the activity or bolted on?
    assessment_approach?: string; // how is progress being captured?
  }>;

  // ─── Lesson Flow (with pedagogical reasoning) ───
  lesson_flow: Array<{
    phase: LessonPhase;
    title: string;
    description: string;
    estimated_minutes: number;
    activity_type: string;

    // The teaching intelligence
    pedagogical_purpose: string;      // WHY this phase exists at this point
    teacher_role: string;             // what is the teacher doing? (circulating, demonstrating, observing, facilitating)
    student_cognitive_level: "remember" | "understand" | "apply" | "analyse" | "evaluate" | "create"; // Bloom's
    scaffolding_present: string[];    // what supports are provided
    scaffolding_removed: string[];    // what supports from earlier are now withdrawn
    check_for_understanding?: string; // how does the teacher know students get it?
    differentiation?: {
      extension: string;              // for students who finish early / grasp quickly
      support: string;                // for students who struggle
      ell_modification?: string;      // for language learners
    };

    // Workshop specifics
    materials_needed?: string[];
    tools_required?: string[];
    tool_setup_time_minutes?: number;
    cleanup_time_minutes?: number;
    safety_considerations?: string[];
    station_rotation?: {              // if tools are shared
      stations: number;
      minutes_per_station: number;
      what_others_do: string;         // what do non-active students do while waiting?
    };

    // Transitions
    transition_from_previous?: string;  // how does this connect to what came before?
    transition_to_next?: string;        // how does this set up what comes next?
  }>;

  // ─── Pedagogical DNA ───
  pedagogical_approach: {
    primary: string;                    // "inquiry-based", "project-based", "direct instruction", "design thinking"
    secondary?: string;
    reasoning: string;                  // why this approach suits this content + age group
  };

  scaffolding_strategy: {
    model: string;                      // "gradual release", "I do / we do / you do", "discovery with guardrails"
    how_supports_are_introduced: string;
    how_supports_are_removed: string;
    reasoning: string;
  };

  cognitive_load_curve: {
    description: string;                // "Starts low (vocabulary), peaks mid-lesson (design challenge), settles (reflection)"
    peak_moment: string;                // when is the hardest cognitive demand?
    recovery_moment: string;            // when do students get a breather?
  };

  classroom_management_implications: {
    noise_level_curve: string;          // "quiet → moderate → loud (making) → quiet (reflection)"
    movement_required: boolean;         // do students need to move around?
    grouping: string;                   // "individual → pairs → groups of 4"
    the_5_and_5: string;               // how does this lesson handle fast finishers and stragglers?
  };

  // ─── Quality Analysis ───
  strengths: Array<{
    what: string;
    why_it_works: string;
  }>;
  gaps: Array<{
    what: string;
    suggestion: string;
  }>;
  complexity_level: "introductory" | "developing" | "proficient" | "advanced";

  // ─── Sequencing Intelligence ───
  prerequisites: Array<{
    skill_or_knowledge: string;
    why_needed: string;
  }>;
  skills_developed: Array<{
    skill: string;
    to_what_level: string;            // "introduced", "practiced", "consolidated", "mastered"
  }>;
  energy_and_mood: {
    starts_as: string;                // "calm focus", "high energy", "curious exploration"
    ends_as: string;                  // "reflective", "energised", "satisfied"
    ideal_follows: string;            // what kind of lesson should come next?
    avoid_after: string;              // what should NOT follow this lesson?
  };
  narrative_role?: string;            // if part of a unit, where does this sit in the story arc?

  // ─── Raw data (never throw away) ───
  analysis_version: string;           // prompt version, so we can re-analyse later
  raw_extracted_text: string;         // full original text
  analysis_model: string;             // which AI model was used
  analysis_timestamp: string;
}

type LessonPhase =
  | "warm_up"
  | "vocabulary"
  | "introduction"
  | "demonstration"
  | "guided_practice"
  | "independent_work"
  | "making"              // hands-on construction / fabrication
  | "collaboration"
  | "critique"            // peer or teacher feedback
  | "gallery_walk"
  | "presentation"
  | "testing"             // testing prototypes
  | "iteration"           // improving based on feedback/testing
  | "reflection"
  | "assessment"
  | "cleanup"
  | "extension"
  | "transition";
```

---

## Multi-Pass Analysis Pipeline

### Pass 1: Structure Extraction
**Prompt focus**: "What is in this document?"
- Identify all activities, their sequence, and timing
- Extract materials, tools, and resources mentioned
- Detect grade level, subject, and curriculum references
- Map sections to the original text (so chunks can be aligned)

**Model**: Claude Haiku (fast, cheap — this is pattern matching)

### Pass 2: Pedagogical Analysis
**Prompt focus**: "Why is this lesson designed this way? What makes it work (or not)?"
- Analyse scaffolding progression and when supports are removed
- Identify check-for-understanding moments and teacher moves
- Assess cognitive load curve across the lesson
- Evaluate differentiation strategy (or lack thereof)
- Judge whether criteria are genuinely developed or just mentioned
- Analyse how assessment is embedded (or bolted on)

**Input**: Original text + Pass 1 structured output
**Model**: Claude Sonnet (needs reasoning depth)

### Pass 3: Design Teaching & Workshop Intelligence
**Prompt focus**: "How does this work in a real workshop with real students?"
- Assess workshop logistics (tool rotation, setup/cleanup, safety)
- Identify classroom management implications (noise, movement, grouping)
- Evaluate the 5-and-5 problem (fast finishers + stragglers)
- Place this lesson in the design cycle narrative arc
- Determine sequencing implications (what should come before/after)
- Assess energy and mood flow

**Input**: Original text + Pass 1 + Pass 2 outputs
**Model**: Claude Sonnet

### Total cost per file: ~$0.05-0.15 (3 passes, ~8-12K tokens total)
### For 200 files: ~$10-30

---

## How This Feeds the Wizard

### Current wizard flow (weak)
```
Teacher: "Make a unit about sustainable packaging, Grade 9, 5 weeks"
  ↓
RAG retrieves: 5 text chunks vaguely about packaging
  ↓
AI generates: 16 pages with generic activities
  ↓
Result: technically correct, pedagogically flat
```

### New wizard flow (with lesson intelligence)

#### Stage 1: Pattern Retrieval
Before generating anything, the wizard queries lesson_profiles:
```sql
-- Find lessons similar to what we're generating
SELECT * FROM lesson_profiles
WHERE subject_area ILIKE '%product design%'
  AND grade_level ILIKE '%9%'
  AND profile_data->>'pedagogical_approach'->>'primary' = 'project-based'
ORDER BY times_referenced DESC, teacher_verified DESC
LIMIT 10;
```

This returns 10 structured lesson profiles — not text snippets, but **complete pedagogical blueprints**.

#### Stage 2: Pattern Synthesis
AI analyses the retrieved profiles to extract patterns:
```
From 10 similar lessons, I observe:
- Criterion A lessons for Grade 9 Product Design typically start with a
  real-world problem (news article, video) and use a structured research
  template with 4-6 guided questions
- Successful B criterion sequences use 3 ideation techniques in succession
  (brainstorm → SCAMPER → sketching), not just one
- C criterion making sessions are split across 2-3 lessons with testing
  between iterations
- Most effective lessons for this age group are 45-55 minutes with the
  peak cognitive demand at minute 20-30
- Scaffolding typically follows: modelled example → structured template →
  open-ended with checklist → fully independent
```

#### Stage 3: Unit Narrative Planning
Before generating individual pages, the wizard plans the unit arc:
```
Unit: "Sustainable Packaging Redesign" (Grade 9, 5 weeks, 15 lessons)

Week 1 — The Inciting Incident (Criterion A)
  Mood: Curiosity → concern → motivation
  Arc: Students discover the packaging waste problem through data,
       develop empathy for stakeholders, define their design brief

Week 2 — Ideas Proliferate (Criterion B)
  Mood: Creative energy → productive frustration → clarity
  Arc: Multiple ideation rounds, peer feedback narrows options,
       students commit to a direction with evidence-based reasoning

Week 3-4 — The Struggle (Criterion C)
  Mood: Determination → problem-solving → iteration → pride
  Arc: First prototype fails (this is designed in), students test
       and iterate, workshop rotation manages tool access

Week 5 — Resolution (Criterion D)
  Mood: Reflective → honest → forward-looking
  Arc: Honest evaluation against original brief, celebration of
       process not just product, portfolio curation
```

#### Stage 4: Page Generation (with full context)
Each page is generated with:
- The unit narrative arc (where does this page sit in the story?)
- The previous page's energy/mood ending (what state are students in?)
- Lesson patterns from similar uploaded lessons
- Workshop logistics awareness (is this a making day? plan for setup/cleanup)
- Specific scaffolding appropriate to this point in the progression
- Realistic timing from analysed patterns (not aspirational)
- Differentiation built in (not an afterthought)

The prompt for generating a page looks like:
```
You are generating page B2 of a 5-week unit on Sustainable Packaging (Grade 9).

## Unit Narrative Context
This is Week 2, Day 2. Yesterday (B1), students completed individual
brainstorming and have 8-12 raw ideas each. Today they need to develop
their top 3 ideas into more detailed concepts. By end of B3 tomorrow,
they'll have selected one direction with evidence.

Students are arriving with creative energy from yesterday. This lesson
should channel that energy productively — they need to go deeper, not wider.

## Patterns from Similar Lessons
[3 structured lesson profiles showing how other Grade 9 Product Design
units handle the B2 "develop ideas" phase, including timing, activities,
scaffolding, and what works/doesn't work]

## Workshop Context
This is a studio/classroom day (no major tools needed). Students work
at tables in groups of 4 for peer feedback, then individually for
development. Materials: A3 paper, markers, design templates.

## Requirements
- 50-minute lesson
- Must include peer feedback component (students see each other's ideas)
- Scaffolding: provide a "develop your idea" template with prompts for
  materials, user, constraints, form — but let advanced students skip it
- Check for understanding: by minute 25, circulate to verify every student
  has at least 2 developed concepts (not just labels)
- Fast finishers: start annotating with material choices and dimensions
- Stragglers: reduce to top 2 ideas, use simplified template

## Criterion B Skill Development
At this point, students should be moving from "generating many ideas" to
"developing selected ideas in detail." The assessment evidence from this
page should show: range of ideas considered, use of design techniques,
and evidence-based selection rationale. Assessment should feel invisible
— the development template IS the evidence, not a separate task.
```

That's a fundamentally different prompt from what the current system sends.

---

## Lesson Profile Storage

```sql
CREATE TABLE lesson_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES knowledge_uploads(id) ON DELETE CASCADE,

  -- AI-extracted identity
  title TEXT NOT NULL,
  subject_area TEXT,
  grade_level TEXT,
  estimated_duration_minutes INT,
  lesson_type TEXT DEFAULT 'single_lesson',

  -- Searchable pedagogical fields
  pedagogical_approach TEXT,          -- primary approach
  scaffolding_model TEXT,             -- scaffolding strategy name
  complexity_level TEXT,
  criteria_covered TEXT[],            -- e.g. {'A','B'}

  -- Full structured analysis (all 3 passes)
  profile_data JSONB NOT NULL,        -- complete LessonProfile

  -- Raw data (never discard)
  raw_extracted_text TEXT NOT NULL,    -- original extracted text
  analysis_version TEXT NOT NULL,     -- prompt version for re-analysis
  analysis_model TEXT NOT NULL,       -- e.g. "claude-sonnet-4-20250514"

  -- For hybrid search
  embedding halfvec(1024),
  fts tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(subject_area, '') || ' ' ||
      coalesce(pedagogical_approach, '') || ' ' ||
      coalesce(scaffolding_model, '')
    )
  ) STORED,

  -- Quality & trust
  teacher_verified BOOLEAN DEFAULT false,
  teacher_corrections JSONB,          -- what the teacher changed
  times_referenced INT DEFAULT 0,     -- how often used in generation
  teacher_quality_rating SMALLINT,    -- 1-5 stars (teacher rates their own lesson)

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX lesson_profiles_embedding_idx ON lesson_profiles USING hnsw (embedding halfvec_cosine_ops);
CREATE INDEX lesson_profiles_fts_idx ON lesson_profiles USING gin (fts);
CREATE INDEX lesson_profiles_teacher_idx ON lesson_profiles (teacher_id);
CREATE INDEX lesson_profiles_subject_idx ON lesson_profiles (subject_area);
CREATE INDEX lesson_profiles_grade_idx ON lesson_profiles (grade_level);
CREATE INDEX lesson_profiles_approach_idx ON lesson_profiles (pedagogical_approach);
CREATE INDEX lesson_profiles_criteria_idx ON lesson_profiles USING gin (criteria_covered);
CREATE INDEX lesson_profiles_verified_idx ON lesson_profiles (teacher_verified) WHERE teacher_verified = true;

-- Hybrid search RPC
CREATE OR REPLACE FUNCTION match_lesson_profiles(
  query_embedding halfvec(1024),
  query_text TEXT DEFAULT '',
  match_count INT DEFAULT 10,
  filter_subject TEXT DEFAULT NULL,
  filter_grade TEXT DEFAULT NULL,
  filter_criteria TEXT[] DEFAULT NULL,
  filter_approach TEXT DEFAULT NULL,
  filter_teacher_id UUID DEFAULT NULL,
  only_verified BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  subject_area TEXT,
  grade_level TEXT,
  pedagogical_approach TEXT,
  profile_data JSONB,
  similarity FLOAT,
  final_score FLOAT
)
LANGUAGE sql STABLE
AS $$
  WITH scored AS (
    SELECT
      lp.id, lp.title, lp.subject_area, lp.grade_level,
      lp.pedagogical_approach, lp.profile_data,
      1 - (lp.embedding <=> query_embedding) AS similarity,
      lp.teacher_verified,
      lp.times_referenced,
      lp.teacher_quality_rating,
      CASE WHEN query_text != '' THEN
        ts_rank_cd(lp.fts, plainto_tsquery('english', query_text))
      ELSE 0 END AS text_rank
    FROM lesson_profiles lp
    WHERE
      (filter_subject IS NULL OR lp.subject_area ILIKE '%' || filter_subject || '%')
      AND (filter_grade IS NULL OR lp.grade_level ILIKE '%' || filter_grade || '%')
      AND (filter_criteria IS NULL OR lp.criteria_covered && filter_criteria)
      AND (filter_approach IS NULL OR lp.pedagogical_approach ILIKE '%' || filter_approach || '%')
      AND (filter_teacher_id IS NULL OR lp.teacher_id = filter_teacher_id)
      AND (NOT only_verified OR lp.teacher_verified = true)
      AND lp.embedding IS NOT NULL
  )
  SELECT
    s.id, s.title, s.subject_area, s.grade_level,
    s.pedagogical_approach, s.profile_data,
    s.similarity,
    -- Weighted score: similarity + text relevance + quality signals
    (0.5 * s.similarity)
    + (0.1 * LEAST(s.text_rank, 1.0))
    + (0.15 * CASE WHEN s.teacher_verified THEN 1.0 ELSE 0.3 END)
    + (0.15 * LEAST(s.times_referenced::float / 20.0, 1.0))
    + (0.1 * COALESCE(s.teacher_quality_rating::float / 5.0, 0.5))
    AS final_score
  FROM scored s
  WHERE s.similarity > 0.25
  ORDER BY final_score DESC
  LIMIT match_count;
$$;
```

---

## Teacher Review UI

After upload + AI analysis, the teacher sees a rich review:

```
┌───────────────────────────────────────────────────────────────┐
│ ✨ Lesson Analysis: "Bridge Engineering Challenge"            │
│                                                               │
│ Subject: Systems Design    Grade: MYP 4    Duration: ~50 min  │
│ Complexity: Developing     Approach: Inquiry-based            │
│ Scaffolding: Gradual release (I do → We do → You do)         │
│                                                               │
│ ── Criteria Genuinely Developed ──                            │
│ B — Developing Ideas (primary)                                │
│   "Students move from testing existing bridges to designing   │
│    their own — the testing phase builds understanding that    │
│    informs original design decisions"                         │
│ C — Creating the Solution (secondary)                         │
│   "Bridge construction with balsa wood requires material      │
│    selection and joining technique decisions"                  │
│                                                               │
│ ── Lesson Flow ──                                             │
│ ┌─────┬─────────────────┬────────┬──────────────────────────┐ │
│ │ 5m  │ Vocabulary       │ Calm   │ Key terms: load, span,  │ │
│ │     │                  │        │ compression, tension     │ │
│ ├─────┼─────────────────┼────────┼──────────────────────────┤ │
│ │ 10m │ Real-world       │ Curious│ Show 3 bridge types,     │ │
│ │     │ examples         │        │ students predict which   │ │
│ │     │                  │        │ is strongest             │ │
│ ├─────┼─────────────────┼────────┼──────────────────────────┤ │
│ │ 20m │ Guided testing   │ Active │ Test 3 pre-built bridges │ │
│ │     │ (peak demand)    │        │ with weights. Data table.│ │
│ │     │                  │        │ Teacher circulates w/    │ │
│ │     │                  │        │ checklist.               │ │
│ │     │                  │        │ Fast: cantilever bridge  │ │
│ │     │                  │        │ Slow: 2-bridge compare   │ │
│ ├─────┼─────────────────┼────────┼──────────────────────────┤ │
│ │ 10m │ Sketch own       │ Focused│ Use data to inform       │ │
│ │     │ design           │        │ design. Template provided│ │
│ ├─────┼─────────────────┼────────┼──────────────────────────┤ │
│ │ 5m  │ Reflection       │ Calm   │ "What surprised you      │ │
│ │     │                  │        │ about the testing?"      │ │
│ └─────┴─────────────────┴────────┴──────────────────────────┘ │
│                                                               │
│ ── Strengths ──                                               │
│ • Limits variables before open-ended design (prevents Year 9  │
│   "just build something" impulse)                             │
│ • Data collection gives Criterion A evidence naturally        │
│ • Differentiation is built into the activity, not bolted on   │
│                                                               │
│ ── Gaps ──                                                    │
│ • No explicit peer feedback moment (could add 3-min          │
│   pair-share after sketching)                                 │
│ • Cleanup time for testing materials not accounted for        │
│                                                               │
│ ── Sequencing ──                                              │
│ Requires: Basic understanding of forces (taught prior)        │
│ Develops: Data-informed design decisions (to practicing)      │
│ Best followed by: Detailed design drawing or CAD modelling    │
│ Avoid after: Another testing-heavy lesson (fatigue)           │
│                                                               │
│ ⭐ Rate this lesson: ○ ○ ○ ○ ○                               │
│                                                               │
│ [Edit Analysis]     [Looks Good ✓]     [Re-analyse]          │
└───────────────────────────────────────────────────────────────┘
```

Teacher corrections are stored and fed back as few-shot examples in future analysis prompts — the system gets smarter over time.

---

## Upload Flow (revised)

```
Teacher uploads file(s)
  ↓
1. EXTRACT text (existing — mammoth/pdf-parse/officeparser)
  ↓
2. ANALYSE — Pass 1: Structure (Claude Haiku, ~$0.01)
   → Activities, timing, materials, tools, sections
  ↓
3. ANALYSE — Pass 2: Pedagogy (Claude Sonnet, ~$0.03)
   → Scaffolding, cognitive load, teacher moves, differentiation
   → Input includes Pass 1 output
  ↓
4. ANALYSE — Pass 3: Design Teaching (Claude Sonnet, ~$0.03)
   → Workshop logistics, design cycle placement, sequencing, narrative
   → Input includes Pass 1 + Pass 2 outputs
  ↓
5. TEACHER REVIEW
   → Rich review screen (see above)
   → Teacher verifies, corrects, rates
   → Corrections stored for future prompt improvement
  ↓
6. ANALYSIS-INFORMED CHUNKING
   → Chunk boundaries align to lesson phases
   → Rich metadata from AI analysis on every chunk
   → Overview chunk = full lesson profile as structured text
  ↓
7. EMBED (Voyage AI)
   → Lesson profile embedding (for profile-level search)
   → Chunk embeddings (for detail-level RAG)
  ↓
8. STORE
   → lesson_profiles table (structured, searchable)
   → knowledge_chunks table (for detail RAG, with rich preambles)
   → knowledge_uploads table (tracking)
```

---

## Batch Upload

For the "200 lessons in folders" use case:

1. **Multi-file upload UI** — drag folder or select multiple files (PDF/DOCX/PPTX)
2. **Background processing queue** — files process sequentially to manage API rate limits
3. **Progress dashboard**: per-file status (Extracting → Analysing → Ready for Review)
4. **Batch review screen** — card grid of all analysed lessons
   - Quick-scan mode: see title, subject, grade, approach, strengths/gaps at a glance
   - Click to expand full review
   - "Accept All" button for trusted batches
   - "Flag for review" on any that look wrong
5. **Re-analysis**: if prompts improve later, teacher can re-analyse all uploads with the new version (raw text is always preserved)

---

## OneNote Path

1. **MVP**: Export from OneNote as DOCX/PDF → batch upload. Works today with zero integration.
2. **Later**: Microsoft Graph API OAuth → pull pages → extract → same analysis pipeline. Gives a "Connect OneNote → Import" button.

---

## Future-Proofing

- **Raw text always preserved** — if better models arrive, re-analyse everything
- **Analysis version tracked** — know which prompt version produced each profile
- **Teacher corrections stored** — training data for prompt improvement
- **Schema is JSONB** — profile structure can evolve without migrations
- **Multi-model ready** — different passes can use different models as quality/cost changes
- **CurriculumProfile compatible** — criterion analysis uses generic structure, not hardcoded MYP

---

## Implementation Priority

1. **LessonProfile type** — TypeScript types for the full model
2. **3-pass analysis functions** — the AI prompts (this is where the quality lives)
3. **lesson_profiles migration** — database table + RPC
4. **Upload route enhancement** — wire analysis into existing upload flow
5. **Teacher review UI** — the review screen
6. **Analysis-informed chunking** — replace heuristic chunker
7. **Wizard RAG enhancement** — lesson-level retrieval + pattern synthesis + narrative planning
8. **Batch upload UI** — multi-file with progress tracking
9. **Re-analysis tooling** — re-run analysis when prompts improve
