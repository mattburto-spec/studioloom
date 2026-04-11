# Journey Engine — Architecture Specification
*Modular, embeddable, character-neutral interactive experiences powered by R3F.*

**Status:** Vision / Architecture Design
**Date:** 6 April 2026
**Depends on:** Dimensions3 (Activity Block schema), 3D Elements (R3F renderer, asset library), Discovery Engine (reference implementation)
**Companion docs:** `discovery-engine-build-plan.md` (current Discovery — becomes first Journey), `3delements.md` (R3F architecture), `dimensions3.md` (Activity Block pipeline)

> **⚠️ SUPERSEDED STORAGE MODEL (10 Apr 2026)** — This spec originally proposed a single `students.learning_profile` JSONB column (migration 048) as the merge target for all journey `profile_writes`. That storage model is **superseded by `docs/specs/student-learning-profile-schema.md`**. The new system uses five dedicated tables (`student_learning_profile`, `student_project_history`, `student_learning_events`, `profile_synthesis_jobs`) with writer-class gating, RLS, and COPPA controls.
>
> **What this means for Journey Engine implementation:**
> - The `students.learning_profile` column **must be dropped** in migration 065 (the student profile schema migration). It was never populated in production.
> - `profile_writes` accumulated during a journey session are **still** the right pattern — but on session completion, they flow through `ProfilingJourneyWriter` (a SECURITY DEFINER writer class) into `student_learning_profile.profile.identity` / `current_state`, not into a column on `students`.
> - Cross-journey conditional routing still reads from the persistent profile — but the read path is `getStudentProfile(studentId)` (in `src/lib/profile/read.ts`), not a direct JSONB column fetch.
> - References throughout this spec to `learning_profile` paths, `buildProfileContext()`, and namespaced writes should be mentally translated to "the relevant section of `student_learning_profile.profile`."
>
> See `docs/specs/student-learning-profile-schema.md` §4.3, §7, §10, §11 for the full migration path and writer-class contract.


---

## 1. What This Is

The Journey Engine is a system for composing, rendering, and embedding interactive guided experiences throughout StudioLoom. A Journey is an ordered (or branching) sequence of Journey Blocks — atomic interaction primitives that collect student input, produce profile data, and respond in real time through an animated character in an R3F scene.

The Discovery Engine proved the concept: 8 stations, ~8 interaction types, varied input mechanics (70% clicking/selecting/dragging, 30% writing), character-driven narrative, rich profile output. The Journey Engine extracts that proven grammar into a reusable system so that any part of StudioLoom can offer interactive guided experiences — from a 2-minute challenge introduction embedded in a lesson to a full 60-minute student profiling journey.

**The three separations that make this work:**

1. **Interaction pattern** (what the student does) — separated from content
2. **Content** (what's on the cards, what the prompts say, what dimensions are scored) — separated from presentation
3. **Presentation** (which character delivers it, what scene it's in, what animations play) — applied at journey level, infinitely swappable

A Journey Block defines #1 and #2. Character and scene assignment (#3) happens when blocks are composed into a Journey. This means the same "card sort" block could be delivered by Kit in a campfire scene, by Rosa in her bakery, or by a student's chosen K-pop idol on a rooftop — zero content changes.

---

## 2. Core Concepts

### 2.1 Journey Block

The atomic unit. A single interactive experience with one interaction mechanic, one data output, and one set of character reaction points.

**Properties:**
- **Interaction type** — which mechanic the student uses (binary choice, card sort, slider, etc.)
- **Content config** — the prompts, options, labels, scoring weights, effort thresholds (type-specific)
- **Data contract** — which `learning_profile` paths this block writes to, and what shape the data takes
- **Character hooks** — entry line, reaction templates per outcome, exit line (all character-neutral — `{character}` placeholder tokens)
- **Estimated duration** — seconds, used for journey length budgeting
- **Conditions readable** — which profile paths this block can read from (for adaptive content)

Journey Blocks are **character-neutral and scene-neutral**. They contain no reference to Kit, Sage, or any specific character. They contain no reference to any specific environment. All presentation is injected at the Journey level.

### 2.2 Journey

A composed sequence of Journey Blocks with a goal, a character, and a scene sequence.

**Properties:**
- **Name and description** — human-readable, appears in the lesson editor library
- **Goal type** — `profiling` | `challenge-introduction` | `reflection` | `skill-check` | `project-scoping` | `onboarding` | `check-in` | `custom`
- **Block sequence** — ordered list of Journey Block references, with conditional routing between them (see §5)
- **Data contract (journey-level)** — the union of all block-level data contracts; what this journey guarantees to produce when completed
- **Character assignment** — which character delivers the journey (ID reference to character definition)
- **Scene sequence** — which R3F environments the blocks render in, with transition definitions between scenes
- **Length budget** — estimated total minutes (sum of block durations + transitions)
- **Entry mode** — `fullscreen` | `embedded` | `window` | `modal` (default rendering mode, overridable at embed point)
- **Tags** — for library search and filtering
- **Version** — journeys are versioned; students who started on v2 complete on v2 even if v3 is published

### 2.3 Character Definition

A presentation layer that gives personality to any journey. Completely decoupled from journey content.

**Properties:**
- **ID, name, description** — `kit`, `sage`, `spark`, `rosa`, or any custom character
- **Visual assets** — R3F model reference (`.glb`), expression map (idle, happy, thinking, surprised, concerned, celebrating), animation set (walk, gesture, point, wave)
- **Voice** — TTS voice ID (ElevenLabs or browser), speaking rate, pitch
- **Personality** — tone descriptors, vocabulary level, humor style, encouragement style
- **AI prompt modifier** — injected into any AI calls during the journey (same pattern as current `aiPromptModifier` on mentors)
- **Reaction templates** — keyed by reaction type (`encourage`, `challenge`, `celebrate`, `empathize`, `redirect`), each a template string with `{student_name}`, `{choice}`, `{profile.archetype}` tokens
- **Fallback** — 2D avatar image + CSS color scheme for non-WebGL environments

Future characters could be anything: real designers (the mentor system spec), fictional NPCs (Rosa the baker), licensed personalities, student-selected idols. The journey doesn't care — it calls `{character}.react('encourage', context)` and gets back a line of dialogue plus an expression/animation trigger.

### 2.4 Scene Definition

An R3F environment configuration that journeys render inside.

**Properties:**
- **ID, name** — `campfire`, `workshop`, `bakery`, `rooftop`, `community_park`
- **Environment asset** — `.glb` model or procedural scene config
- **Lighting preset** — time of day, mood, color temperature
- **Ambient audio** — looping background sound ID
- **Camera waypoints** — named positions the journey can transition between (e.g., `campfire_wide`, `campfire_close`, `collection_wall`)
- **Hotspot zones** — for `scene_explore` interaction type, defines clickable regions with metadata
- **Weather/effects** — optional particles, fog, time-of-day cycle
- **Performance tier** — triangle budget, LOD config, fallback (CSS gradient + 2D parallax for low-end devices)

Scenes are shared across journeys. The campfire scene used in Discovery can also host a mid-unit reflection journey. The bakery scene built for Rosa's design quest can host any challenge-introduction journey set in that context.

---

## 3. Journey Block Types

Extracted from the 8 proven Discovery Engine interaction types, plus new types for expanded use cases.

### 3.1 Proven Types (from Discovery)

| Type | Mechanic | Example in Discovery | Data Output |
|------|----------|---------------------|-------------|
| `binary_choice` | Two options, pick one. Sequence of N pairs. | Station 1 Campfire: 12 quick-fire pairs | Array of selections with dimension weights |
| `card_sort` | Pool of cards, drag into buckets or rank order | Station 3 values card sort (12 cards → ranked) | Ordered list with category assignments |
| `visual_select` | Grid of images/icons, pick N | Station 0 tool belt (12 icons, pick 3) | Selected IDs with archetype weights |
| `slider_scale` | One or more labeled sliders with anchored endpoints | Station 5 self-efficacy (7 sliders) | Numeric values per dimension |
| `scene_explore` | Click hotspots in a visual scene | Station 4 community window (CSS hotspots) | Selected hotspot IDs with emphasis weights |
| `text_prompt` | Free-text input with effort-gating + AI reflection | Station 2 panic scenario, Station 4 problem prompt | Raw text + AI-extracted structured data |
| `drag_sort` | Drag items into a specific order | Station 5 resource card sort | Ordered list with priority scores |
| `reveal` | Computed visualization from profile data | Station mini-reveals + Grand Reveal | Read-only (displays, doesn't collect) |

### 3.2 New Types (for expanded use cases)

| Type | Mechanic | Use Case | Data Output |
|------|----------|----------|-------------|
| `scene_interact` | Interact with 3D objects (rotate, measure, assemble) | Tutorial blocks, prototype inspection | Completion state + accuracy metrics |
| `dialogue_choice` | NPC says something, student picks from 2-4 response options (conversation tree) | Challenge introductions, NPC quests | Dialogue path taken + personality signals |
| `media_capture` | Student takes a photo, records audio, or sketches | Mid-project check-ins, evidence collection | Media asset reference + AI analysis |
| `timed_challenge` | Complete a task within a time limit | Skill assessments, quick design sprints | Completion + time + quality score |
| `group_assign` | Categorize items into teacher-defined groups | Sorting materials, classifying design movements | Category assignments + accuracy |
| `annotation` | Mark up an image or 3D model with pins/labels | Design critique, hazard identification | Pin locations + labels + reasoning |

Each type has a TypeScript interface defining its content config shape. New types can be added by implementing the interface + a React renderer component.

---

## 4. Data Model

### 4.1 Database Schema

```sql
-- ============================================================
-- Journey Blocks — atomic interaction primitives
-- ============================================================
CREATE TABLE journey_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,                          -- 'Working Style Binary Pairs'
  description TEXT,                            -- 'Quick-fire binary choices to map working style dimensions'
  interaction_type TEXT NOT NULL,              -- 'binary_choice' | 'card_sort' | 'slider_scale' | etc.

  -- Content (character-neutral, scene-neutral)
  content_config JSONB NOT NULL,              -- Type-specific: options, prompts, scoring weights
  data_contract JSONB NOT NULL,               -- { writes: { 'strengths.working_style': 'object' }, reads: [] }
  character_hooks JSONB,                      -- { entry: '{character} leans forward...', reactions: {...} }
  effort_config JSONB,                        -- { min_words: 12, filler_filter: true } (for text_prompt types)

  -- AI integration (for types that call AI)
  ai_config JSONB,                            -- { model: 'haiku', system_prompt_template: '...', extract: [...] }

  -- Metadata
  estimated_seconds INT NOT NULL DEFAULT 30,  -- Duration estimate for length budgeting
  tags TEXT[],                                -- ['profiling', 'strengths', 'quick']
  age_bands TEXT[],                           -- ['junior', 'senior', 'extended'] or null for all

  -- Ownership
  created_by TEXT NOT NULL DEFAULT 'system',  -- 'system' | teacher_id (future)
  visibility TEXT NOT NULL DEFAULT 'system',  -- 'system' | 'private' | 'shared'

  -- Search
  embedding halfvec(1024),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Journeys — composed sequences of blocks
-- ============================================================
CREATE TABLE journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,                          -- 'Student Discovery'
  description TEXT,                            -- '45-minute profiling journey for new students'
  goal_type TEXT NOT NULL,                     -- 'profiling' | 'challenge-introduction' | 'reflection' | etc.

  -- Composition
  block_sequence JSONB NOT NULL,              -- See §4.2 — ordered nodes with conditional routing
  data_contract JSONB NOT NULL,               -- Union of all block contracts — journey-level guarantee

  -- Presentation (applied to all blocks)
  default_character_id TEXT,                  -- null = no character (pure UI), or 'kit', 'rosa', etc.
  scene_sequence JSONB,                       -- [{ scene_id, camera_waypoint, blocks: ['block-uuid'...] }]
  default_entry_mode TEXT DEFAULT 'fullscreen', -- 'fullscreen' | 'embedded' | 'window' | 'modal'

  -- Metadata
  estimated_minutes INT NOT NULL,             -- Total length budget
  version INT NOT NULL DEFAULT 1,             -- Incremented on publish
  tags TEXT[],
  thumbnail_url TEXT,                         -- Preview image for lesson editor library

  -- Ownership
  created_by TEXT NOT NULL DEFAULT 'system',
  visibility TEXT NOT NULL DEFAULT 'system',

  -- Search
  embedding halfvec(1024),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Character Definitions — presentation skins
-- ============================================================
CREATE TABLE journey_characters (
  id TEXT PRIMARY KEY,                         -- 'kit', 'sage', 'spark', 'rosa'
  name TEXT NOT NULL,                          -- 'Kit'
  description TEXT,                            -- 'Warm workshop buddy, purple accent'

  -- Visuals
  model_asset_id TEXT REFERENCES assets(id),   -- R3F .glb model
  expression_map JSONB,                        -- { idle: 'anim_idle', happy: 'anim_happy', ... }
  fallback_avatar_url TEXT,                    -- 2D image for non-WebGL
  accent_color TEXT,                           -- '#8B5CF6'

  -- Voice
  tts_voice_id TEXT,                           -- ElevenLabs voice ID
  tts_config JSONB,                            -- { rate: 1.0, pitch: 0, stability: 0.7 }

  -- Personality
  personality JSONB NOT NULL,                  -- { tone, vocabulary_level, humor_style, encouragement_style }
  ai_prompt_modifier TEXT,                     -- Injected into AI calls during journey
  reaction_templates JSONB NOT NULL,           -- { encourage: '...', challenge: '...', celebrate: '...', ... }

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Journey Sessions — student progress through a journey
-- ============================================================
CREATE TABLE journey_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  journey_id UUID NOT NULL REFERENCES journeys(id),
  journey_version INT NOT NULL,                -- Locked to version at start

  -- State
  status TEXT NOT NULL DEFAULT 'in_progress',  -- 'in_progress' | 'completed' | 'abandoned'
  current_block_id UUID,                       -- Which block the student is on
  path_taken JSONB DEFAULT '[]',               -- Ordered array of block IDs visited (records branching path)
  block_responses JSONB DEFAULT '{}',          -- { [block_id]: { response_data, timestamp, duration_seconds } }

  -- Profile data produced
  profile_writes JSONB DEFAULT '{}',           -- Accumulated data to write to learning_profile on completion

  -- Context
  source_type TEXT,                            -- 'lesson' | 'standalone' | 'companion' | 'auto'
  source_id TEXT,                              -- lesson page_id or unit_id if embedded

  -- Rendering
  entry_mode TEXT,                             -- How this session was opened
  character_id TEXT REFERENCES journey_characters(id),  -- May override journey default

  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_journey_blocks_type ON journey_blocks(interaction_type);
CREATE INDEX idx_journey_blocks_tags ON journey_blocks USING gin(tags);
CREATE INDEX idx_journeys_goal ON journeys(goal_type);
CREATE INDEX idx_journeys_tags ON journeys USING gin(tags);
CREATE INDEX idx_journey_sessions_student ON journey_sessions(student_id);
CREATE INDEX idx_journey_sessions_journey ON journey_sessions(journey_id);
CREATE INDEX idx_journey_sessions_source ON journey_sessions(source_type, source_id);
```

### 4.2 Block Sequence Format (with Branching)

The `block_sequence` JSONB on journeys defines an ordered graph of blocks with conditional routing.

```typescript
interface BlockSequence {
  nodes: BlockNode[];
  entry_node_id: string;  // Which node starts the journey
}

interface BlockNode {
  node_id: string;                    // Unique within this journey
  block_id: string;                   // References journey_blocks.id
  scene_override?: string;            // Override journey-level scene for this block
  camera_waypoint?: string;           // Which camera position in the current scene
  character_state?: string;           // Character expression/animation on entry

  // Routing to next block
  next: NextRoute;
}

// Linear: always go to the same next block
interface LinearRoute {
  type: 'linear';
  target_node_id: string | null;      // null = journey complete
}

// Conditional: evaluate conditions against profile/response data
interface ConditionalRoute {
  type: 'conditional';
  conditions: RouteCondition[];
  fallback_node_id: string;           // If no condition matches
}

interface RouteCondition {
  // What to check
  source: 'profile' | 'block_response' | 'session';
  path: string;                       // e.g., 'strengths.archetype' or '{prev_block}.selected'

  // How to check
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'exists' | 'not_exists';
  value: any;

  // Where to go
  target_node_id: string;
}
```

**Example: branching after an archetype reveal**

```json
{
  "nodes": [
    {
      "node_id": "n1",
      "block_id": "blk_binary_working_style",
      "next": { "type": "linear", "target_node_id": "n2" }
    },
    {
      "node_id": "n2",
      "block_id": "blk_archetype_scenarios",
      "next": {
        "type": "conditional",
        "conditions": [
          {
            "source": "profile",
            "path": "strengths.archetype",
            "operator": "equals",
            "value": "maker",
            "target_node_id": "n3a"
          },
          {
            "source": "profile",
            "path": "strengths.archetype",
            "operator": "equals",
            "value": "researcher",
            "target_node_id": "n3b"
          }
        ],
        "fallback_node_id": "n3c"
      }
    },
    {
      "node_id": "n3a",
      "block_id": "blk_maker_deep_dive",
      "next": { "type": "linear", "target_node_id": "n4" }
    },
    {
      "node_id": "n3b",
      "block_id": "blk_researcher_deep_dive",
      "next": { "type": "linear", "target_node_id": "n4" }
    },
    {
      "node_id": "n3c",
      "block_id": "blk_general_deep_dive",
      "next": { "type": "linear", "target_node_id": "n4" }
    },
    {
      "node_id": "n4",
      "block_id": "blk_convergence_reveal",
      "next": { "type": "linear", "target_node_id": null }
    }
  ],
  "entry_node_id": "n1"
}
```

This is a diamond pattern: n1 → n2 → (n3a | n3b | n3c) → n4. All paths converge at n4. The admin editor validates that every terminal path produces the full data contract.

---

## 5. Conditional Branching System

### 5.1 Design Principles

Branching must be powerful enough to create genuinely adaptive journeys but simple enough for an admin UI (and eventually a teacher UI) to author without writing code.

**The condition language is intentionally constrained:**
- Conditions evaluate against three sources: the student's `learning_profile` (persisted), the current journey session's `block_responses` (in-flight), and session metadata (time elapsed, blocks completed)
- Operators are the standard comparison set — no regex, no boolean algebra, no nested logic
- Multiple conditions on one route are AND'd (all must be true)
- Conditions are evaluated in order; first match wins
- A fallback target is mandatory (no dead ends)

### 5.2 Adaptive Content Within Blocks

Beyond routing between blocks, individual blocks can adapt their content based on profile data. The `content_config` can include conditional content:

```typescript
interface ConditionalContent {
  default: string;                           // Default prompt text
  overrides: ContentOverride[];
}

interface ContentOverride {
  condition: RouteCondition;                 // Same condition format as routing
  content: string;                           // Replacement prompt text
}
```

Example: a text prompt block might ask "Describe a problem you've noticed in your community" by default, but if `profile.strengths.archetype === 'maker'`, it asks "Describe something physical that's broken or poorly designed in your daily life." Same block, same data contract, adapted framing.

### 5.3 Path Validation

The admin editor must enforce:

1. **Every path reaches a terminal node** — no infinite loops (cycle detection on the graph)
2. **Every path satisfies the journey's data contract** — walk every possible path and verify all required profile writes are produced
3. **No unreachable nodes** — every node must be reachable from the entry node
4. **Fallback completeness** — every conditional route has a fallback
5. **Condition coherence** — warn if conditions reference profile paths that no prior block in any path to that node would have written

---

## 6. Student Profile as Data Hub

### 6.1 Architecture

The `learning_profile` JSONB column on the `students` table (migration 048) is the single data store. Every journey block writes to a namespaced path within this document. Every AI system reads relevant slices.

```typescript
interface LearningProfile {
  // Domain 1: WHO AM I
  strengths: {
    archetype?: string;                    // 'maker' | 'researcher' | 'leader' | ...
    archetype_weights?: Record<string, number>;
    working_style?: {
      solo_collaborative: number;          // -1 to 1
      structured_flexible: number;
      fast_start_planner: number;
    };
    decision_pattern?: string;
    energy_pattern?: string;
    people_come_for?: string[];
  };

  // Domain 2: WHAT DO I CARE ABOUT
  interests: {
    clusters?: string[];
    irritations?: string[];
    values_ranked?: string[];
    curiosity_patterns?: string[];
    youtube_topics?: string[];
  };

  // Domain 3: WHAT DO I NOTICE
  empathy: {
    observed_needs?: string[];
    empathy_targets?: string[];
    scale_of_concern?: string;             // 'personal' | 'school' | 'community' | 'global'
    problem_framing_ability?: number;       // 0-1
  };

  // Domain 4: WHAT CAN I ACTUALLY DO
  resources: {
    hours_per_week?: number;
    physical_resources?: string[];
    skills_inventory?: Record<string, number>;  // skill_name → confidence 0-1
    technology_access?: string[];
  };

  // Domain 5: HOW READY AM I
  readiness: {
    self_efficacy?: Record<string, number>;  // domain → 0-1
    past_project_count?: number;
    setback_response?: string;
    help_seeking?: string;
    ambiguity_comfort?: number;             // 0-1
  };

  // Domain 6: PROJECT DIRECTION (per-unit, keyed by unit_id)
  projects?: Record<string, {
    direction?: string;
    goal_statement?: string;
    success_criteria?: string[];
    excitement_level?: number;
    biggest_risk?: string;
    challenge_framing?: object;
  }>;

  // Accumulative signals (written by many journey types over time)
  signals: {
    fear_themes?: string[];
    motivation_patterns?: string[];
    collaboration_preference?: string;
    feedback_receptivity?: number;          // 0-1
    reflection_depth?: number;              // 0-1, from effort-gating signals
  };

  // Metadata
  _meta: {
    last_updated: string;                   // ISO timestamp
    journey_sources: Record<string, string>; // profile_path → journey_session_id that wrote it
    version: number;
  };
}
```

### 6.2 Write Semantics

When a journey session completes, `profile_writes` (accumulated during the journey) are merged into `learning_profile` using these rules:

- **Overwrite** (default): new value replaces old. Used for computed scores, archetype assignments.
- **Append**: new values are added to existing arrays (deduped). Used for interests, irritations, fears.
- **Merge**: new object keys are merged with existing object keys. Used for `self_efficacy`, `skills_inventory`.
- **Max**: new value replaces only if higher. Used for `reflection_depth`, `ambiguity_comfort` (students improve over time).

The merge strategy is declared in the block's `data_contract`:

```typescript
interface DataContract {
  writes: Record<string, {
    type: 'string' | 'number' | 'object' | 'array' | 'boolean';
    merge_strategy: 'overwrite' | 'append' | 'merge' | 'max';
    required: boolean;  // Must this block produce this value for the journey contract to be satisfied?
  }>;
  reads: string[];  // Profile paths this block needs as input
}
```

### 6.3 AI Integration — Reading the Profile

Any AI system that generates responses for a student calls `buildProfileContext(studentId)` which:

1. Loads `learning_profile` from the students table
2. Selects the relevant slices based on the calling context (mentor conversation reads strengths + interests + readiness; generation pipeline reads resources + readiness; toolkit nudge reads strengths + signals)
3. Renders a natural language summary (200-300 tokens) that gets injected into the system prompt

Example output for a Design Assistant call:

```
Student Profile Context:
- Archetype: Maker (strong hands-on preference, builds before planning)
- Working style: prefers solo work, structured approach, fast starter
- Key interests: sustainable packaging, skateboard culture, 3D printing
- Known irritation: poorly designed school furniture (wrote about this passionately)
- Self-efficacy: high in making (0.85), moderate in research (0.55), low in presentation (0.3)
- Setback response: persists but gets frustrated — responds well to concrete next steps
- Current project: redesigning the school recycling station for Year 7 area
- Excitement: 9/10
```

This is how the mentor can say "I know you're a maker who'd rather just start building — but this recycling station project needs some user research first. What if you spent 10 minutes watching how Year 7s actually use the current bins?" The AI knows the student, knows the project, and adapts the push accordingly.

---

## 7. Rendering Modes

### 7.1 Four Modes

| Mode | Trigger | Viewport | Use Case |
|------|---------|----------|----------|
| **Fullscreen** | Student taps "Start Journey" on standalone page or expands from embedded | 100vw × 100vh with minimize button | Discovery, long profiling, project scoping |
| **Embedded** | Journey block placed in lesson editor, renders inline | Activity-block sized (~100% width, 400-600px height) | Challenge introductions, mid-lesson reflections, skill checks |
| **Window** | Companion check-in triggered by timer or event | 320×400px floating panel, draggable, resizable | Periodic check-ins during Open Studio or making time |
| **Modal** | System-triggered overlay (idle detection, submission prompt) | Centered overlay 600×500px with backdrop blur | Post-submission reflection, drift detection, quick pulse |

### 7.2 Mode Transitions

A journey can transition between modes during play:

- **Embedded → Fullscreen**: student taps "expand" on an embedded journey with 4+ remaining blocks. The R3F scene scales up with a smooth animation. Lesson page scrolls out of view.
- **Fullscreen → Embedded**: student taps "minimize" or journey completes. Scene shrinks back to inline size. Lesson page scrolls the journey block back into view.
- **Window → Fullscreen**: student taps "expand" on the floating panel for a journey that needs more space (e.g., a scene_explore block).
- **Any → Completed**: journey shows a completion card (summary of what was learned/decided) at the mode's size, then collapses to a compact "completed" badge if embedded.

### 7.3 R3F Scene Continuity

The R3F canvas stays mounted across blocks within a journey — no scene reload between blocks. Between blocks:

- Camera transitions (lerp to new waypoint, 0.8s ease)
- Character walks/teleports to new position with animation
- Lighting shifts (colour temperature, intensity, direction)
- Props appear/disappear (fade in/out, 0.3s)
- Ambient audio crossfades (1s)

This makes the journey feel like moving through a space, not flipping between screens. The scene definition on the journey specifies which blocks share a scene and where transition points are.

### 7.4 Fallback Rendering

When WebGL is unavailable or performance is below threshold:

- **Level 1** (low GPU): Reduce to flat-shaded, no shadows, static lighting
- **Level 2** (no WebGL): 2D parallax scene with layered images + CSS animations. Character as animated sprite sheet.
- **Level 3** (minimal): Solid color gradient background + character avatar image + interaction UI only

The interaction mechanics (binary choice, card sort, sliders, etc.) work identically at all levels. Only the visual presentation degrades. A card sort is still a card sort whether it's rendered in a 3D workshop or on a flat purple gradient.

---

## 8. Lesson Editor Integration

### 8.1 What Appears in the Editor Sidebar

The lesson editor right-hand palette has two main categories:

**Activity Blocks** — the existing content blocks (discussion, hands-on, research, reflection, etc.)

**Journeys** — saved, named journeys that the teacher drops into a lesson as a single unit

Teachers see journeys, not individual journey blocks. The block-level composition is an admin concern. In the lesson editor, a journey appears as a single card showing: name, description, goal type icon, estimated duration, block count, a thumbnail preview of the opening scene, and tags.

**Filtering:** by goal type (profiling, challenge-intro, reflection, skill-check), by duration (quick 1-3 min, medium 5-15 min, long 15+ min), and by tags.

**Search:** embedding-based, same as activity block search. "Something to introduce a sustainability challenge" finds journeys tagged with challenge-introduction and sustainability.

### 8.2 Journey Block in Lesson Content

When placed in a lesson, the journey occupies an `ActivitySection` (existing Dimensions3 concept) with `type: 'journey'`:

```typescript
interface JourneyActivitySection extends ActivitySection {
  type: 'journey';
  journey_id: string;
  entry_mode: 'embedded' | 'fullscreen';    // Teacher choice: inline or click-to-expand
  character_override?: string;               // Optional: use a different character than journey default
  scene_override?: string;                   // Optional: use a different scene
  allow_skip?: boolean;                      // Can the student skip this journey? (default: false)
  context_data?: Record<string, any>;        // Injected into the journey (e.g., { unit_title, challenge_brief })
}
```

### 8.3 Student Experience

1. Student scrolls through lesson, encounters the journey block
2. **If `entry_mode: 'embedded'`**: the block renders the first scene at activity-block size with the character and a "Begin" button. Student taps Begin, the journey runs inline (or expands to fullscreen for longer journeys).
3. **If `entry_mode: 'fullscreen'`**: the block shows a preview card (scene thumbnail + character + description + estimated time). Student taps "Start Journey" and goes fullscreen.
4. During the journey, standard interaction mechanics play out — the student's responses are collected into the journey session.
5. On completion, profile writes are merged into `learning_profile`. The journey block in the lesson shows a "Completed" state with an optional summary. Progress is recorded to `student_progress` as a completed activity.
6. Student can revisit completed journeys to see their responses but cannot change them (the profile data is already written). A teacher can enable "redo" which creates a new session — newer data overwrites older via merge strategy.

---

## 9. Admin Journey Editor

### 9.1 Phase 1: Admin-Only Visual Editor

A node graph editor for composing journeys from journey blocks.

**Canvas (center):**
- Blocks appear as nodes on a 2D canvas
- Connections between nodes show flow direction (arrows)
- Conditional routes shown as colored branches with condition labels
- Diamond-shaped decision nodes for conditional routing
- Entry node highlighted with green border
- Terminal nodes (next = null) highlighted with red border

**Block Palette (left):**
- Searchable list of all journey blocks, filterable by interaction type and tags
- Drag a block from palette onto canvas to add it as a node
- Preview panel shows block details on hover

**Inspector (right):**
- Click a node to inspect/configure it
- Override content for this journey instance (e.g., change prompt text for a generic binary_choice block)
- Configure conditional routing (dropdown condition builder)
- Set scene/camera overrides per node
- Set character state (expression, animation)

**Toolbar (top):**
- Journey metadata: name, description, goal type, tags
- Character assignment (dropdown of all characters)
- Scene sequence editor (timeline of scenes with block assignments)
- Data contract viewer (auto-computed from blocks, highlights gaps)
- Length budget indicator (sum of block durations vs target)

**Validation panel (bottom):**
- Path analysis: lists all possible paths through the journey
- Data contract checker: green/red per path for each required output
- Cycle detector: warns if any path can loop
- Unreachable node detector
- Duration estimate per path (min/max/average)

### 9.2 Walk-Through Mode

Admin can "play" the journey as a student would:

- Steps through block by block
- Can input test responses or use quick-fill presets (e.g., "maker archetype student", "low-confidence researcher")
- Shows real-time profile state building up
- Shows which condition triggers at each branch point
- Shows character reactions with the assigned character
- Renders the actual R3F scene (or 2D fallback)

This is critical for quality assurance before publishing a journey.

### 9.3 Phase 2: Teacher Journey Editor (Future)

A simplified version of the admin editor:

- Pre-built journey templates that teachers can customize (change prompts, reorder blocks, add/remove blocks)
- No conditional routing editor (too complex) — teachers pick from branching templates
- Character and scene pickers with visual previews
- "Fork journey" pattern (same as unit forking — copy-on-write from a system journey)

---

## 10. R3F Integration

### 10.1 Architecture

The Journey Engine's R3F layer builds on the 3D Elements architecture (see `3delements.md` §§3-6):

```
Journey Engine
  └── JourneyRenderer (React component)
        ├── R3FSceneHost (Canvas + scene management)
        │     ├── EnvironmentLoader (loads scene .glb + lighting + ambient audio)
        │     ├── CharacterController (loads character .glb + animations + expressions)
        │     ├── CameraRig (waypoint transitions, orbit controls where enabled)
        │     ├── HotspotManager (for scene_explore type)
        │     └── InteractionOverlay (HTML overlay for UI elements: buttons, cards, sliders)
        ├── JourneyStateMachine (block sequencing, routing, auto-save)
        ├── InteractionRenderer (renders the current block's UI mechanics)
        │     ├── BinaryChoiceUI
        │     ├── CardSortUI
        │     ├── SliderScaleUI
        │     ├── TextPromptUI (with effort-gating)
        │     ├── ... (one per interaction type)
        │     └── RevealUI
        └── CharacterDialogue (speech bubble / subtitle system)
```

### 10.2 Asset Pipeline

1. **Author in Blender** — consistent art style (low-poly, flat-shaded, atmospheric lighting), standardized scale (1 Blender unit = 1 meter), named bones for animation retargeting
2. **Export as .glb** — compressed, single-file, includes textures and animations
3. **Upload to asset library** — Supabase Storage, metadata in `assets` table, embedding generated for search
4. **Reference in scene definitions** — scene JSON references asset IDs, renderer resolves to URLs at load time
5. **Fallback** — every asset has a `primitive_config` (procedural Three.js geometry + material) for instant rendering before .glb loads, and a 2D `thumbnail_url` for non-WebGL fallback

### 10.3 Performance Budget

Target: smooth 30fps on 2019 Chromebook (the worst device in Matt's classroom).

- **Scene triangle budget:** 50K triangles total (environment + character + props)
- **Texture budget:** 2MB total per scene (compressed, power-of-two)
- **Draw calls:** max 50 per frame
- **Load time:** <3s on 10Mbps connection (lazy-load non-critical assets after initial render)
- **Memory:** <200MB GPU memory

The embedded mode (activity-block size) renders at lower resolution (720p canvas scaled to container) to save GPU. Fullscreen renders at native resolution up to 1080p.

### 10.4 "Another World" Art Direction

The visual style reference is Another World / Out of This World (Éric Chahi, 1991) — atmospheric, silhouette-driven, strong mood through colour and light rather than detail.

Characteristics:
- **Flat colour palettes** with limited hues per scene (4-6 dominant colours)
- **Strong rim lighting** separates characters from backgrounds
- **Atmospheric depth** via fog, particle effects, light shafts
- **Geometric simplicity** in models compensated by rich lighting and post-processing
- **Emotional tone through environment** — the campfire is warm amber, the workshop is cool steel blue, the community window is sunset golden

This style is achievable with small Blender models and looks intentional at low poly counts. It also means AI-composed scenes (arranging existing assets in new configurations) feel cohesive because the art style is unified.

---

## 11. Discovery Engine Migration

The existing Discovery Engine (8 stations, ~9,500 lines of code) becomes the first Journey built on this system.

### 11.1 Decomposition Map

| Discovery Station | Journey Blocks Produced | Interaction Types |
|---|---|---|
| Station 0: Design Identity Card | 3 blocks (palette picker, tool belt visual_select, workspace visual_select) | `visual_select` ×3 |
| Station 1: Campfire | 2 blocks (Kit intro reveal, 12-pair binary_choice) | `reveal`, `binary_choice` |
| Station 2: Workshop | 3 blocks (panic text_prompt, archetype scenarios dialogue_choice, "people come to you" visual_select) | `text_prompt`, `dialogue_choice`, `visual_select` |
| Station 3: Collection Wall | 4 blocks (interest icon visual_select, irritation dialogue_choice, YouTube topics card_sort, values card_sort) | `visual_select`, `dialogue_choice`, `card_sort` ×2 |
| Station 4: Window | 3 blocks (community scene_explore, narrowing slider_scale, problem text_prompt) | `scene_explore`, `slider_scale`, `text_prompt` |
| Station 5: Toolkit | 4 blocks (time slider_scale, resource card_sort, people visual_select, self-efficacy slider_scale) | `slider_scale` ×2, `card_sort`, `visual_select` |
| Station 6: Crossroads | 3 blocks (3 AI doors reveal, explore & choose dialogue_choice, fear cards card_sort) | `reveal`, `dialogue_choice`, `card_sort` |
| Station 7: Launchpad | 3 blocks (project statement text_prompt, success criteria text_prompt, Grand Reveal reveal) | `text_prompt` ×2, `reveal` |

**Total: ~25 journey blocks composing 1 journey ("Student Discovery").**

### 11.2 Migration Strategy

1. Extract interaction components from Discovery into generic journey block renderers
2. Extract content from TypeScript content pools into `journey_blocks.content_config` JSONB
3. Extract Kit's personality into a `journey_characters` row
4. Extract scene definitions into `scene_sequence` on the journey
5. Build the journey as a `block_sequence` with the existing linear flow
6. Add conditional branches where Discovery would benefit (skip stations if profile data already exists from prior journeys)
7. Current `discovery_sessions` table becomes a `journey_sessions` row — migration backfills existing sessions

The migration is backward-compatible: students mid-Discovery complete on the old system; new Discoveries start on the Journey Engine. Feature flag controls the cutover.

---

## 12. Example Journeys

### 12.1 Student Discovery (45-60 min, fullscreen, profiling)
The existing Discovery Engine — 25 blocks, 8 scene transitions, Kit character, full 6-domain profile output. The reference journey that proves the system works.

### 12.2 Meet Your Challenge (3 min, embedded, challenge-introduction)
3 blocks: scene reveal (R3F bakery with Rosa looking worried) → binary choice ("What catches your eye — the broken display shelf or the confusing menu layout?") → text prompt ("What's your first instinct for how to help?"). Writes to `projects.{unit_id}.challenge_framing`. The mentor in the next lesson can reference the student's instinct.

### 12.3 Mid-Unit Pulse (2 min, window, check-in)
2 blocks: slider scale ("Where's your energy at?" + "How clear is your next step?") → dialogue choice (character offers 3 options: "push through", "take a different angle", "talk to someone"). Writes to `signals.motivation_patterns`. Triggers drift detection if energy is low + clarity is low.

### 12.4 Service Project Finder (30 min, fullscreen, project-scoping)
Mode 2 equivalent of Discovery — focused on community needs, empathy, stakeholder analysis. 15 blocks with branching: students who identify a local need go through a stakeholder mapping path; students who have a global concern go through a "think local, act local" narrowing path. Both converge on a project statement. Writes to `empathy` + `projects.{unit_id}`.

### 12.5 Safety Checkpoint (5 min, modal, skill-check)
4 blocks: scene_explore (identify hazards in a 3D workshop scene) → group_assign (categorise hazards by severity) → text_prompt ("What would you do first if someone got hurt?") → reveal (safety badge progress). Writes to `resources.skills_inventory.safety`. Integrates with existing Safety Badge system.

### 12.6 Reflection Journey (3 min, embedded, reflection)
Replaces static "write a reflection" textareas. 3 blocks: slider_scale (confidence + satisfaction) → binary_choice ("Did you follow your plan?" / "Did you improvise?") → text_prompt (effort-gated, sentence starters contextualised from profile — "You said you were nervous about presenting — how did it go?"). Writes to `signals.reflection_depth` + `readiness.self_efficacy`.

---

## 13. Build Phases

### Phase A: Foundations (~3-4 days)
- Journey Block type system and TypeScript interfaces
- Journey state machine (block sequencing, conditional routing, auto-save)
- `JourneyRenderer` component with mode switching (fullscreen/embedded/window/modal)
- Interaction renderers for 4 core types: `binary_choice`, `visual_select`, `slider_scale`, `text_prompt`
- Student profile read/write utilities (`writeToProfile`, `readFromProfile`, `buildProfileContext`)
- Database migration (journey_blocks, journeys, journey_characters, journey_sessions tables)
- Basic admin page: create journey block, create journey (JSON editor, not visual yet)

**Exit criteria:** Can create a simple 3-block linear journey via admin, play it through in embedded mode, see profile data written to `learning_profile`.

### Phase B: Interaction Types + R3F (~4-5 days)
- Remaining interaction renderers: `card_sort`, `drag_sort`, `scene_explore`, `dialogue_choice`, `reveal`
- R3F scene host with environment loading, character controller, camera rig
- Character definition system with expression map + reaction templates
- Scene transitions (camera lerp, lighting crossfade, character movement)
- Performance fallback system (3 levels)
- Kit character definition (extracted from Discovery)

**Exit criteria:** Can play a journey with all interaction types in an R3F scene with Kit reacting to choices. Fallback renders on non-WebGL device.

### Phase C: Admin Journey Editor (~4-5 days)
- Node graph canvas (blocks as nodes, connections as arrows)
- Block palette with search and drag-to-add
- Inspector panel for block configuration and routing
- Conditional routing builder (dropdown condition editor)
- Data contract validator (path analysis, gap detection)
- Walk-through mode (play journey as student with test presets)
- Scene sequence editor (timeline of scenes)

**Exit criteria:** Can compose a branching journey visually, validate all paths, walk through it, and publish.

### Phase D: Discovery Migration (~3-4 days)
- Extract Discovery interaction components into journey block renderers
- Extract content pools into journey_blocks rows
- Build "Student Discovery" as a composed journey with Kit + 8 scenes
- Add conditional branches (skip stations when profile data exists)
- Migration script for existing discovery_sessions → journey_sessions
- Feature flag for cutover
- Verify end-to-end: new student completes Discovery via Journey Engine, profile data matches old system

**Exit criteria:** Discovery Engine runs on Journey Engine with identical student experience and data output.

### Phase E: Lesson Editor Integration + New Journeys (~3-4 days)
- Journey category in lesson editor sidebar
- Journey search and filtering (goal type, duration, tags)
- JourneyActivitySection type in content_data
- Embedded mode rendering in student lesson page
- Window mode for companion check-ins
- Build 3-4 example journeys (Meet Your Challenge, Mid-Unit Pulse, Reflection Journey, Safety Checkpoint)
- Wire `buildProfileContext()` into Design Assistant prompt

**Exit criteria:** Teacher can drop a journey into a lesson, student plays it inline, profile data flows to AI mentor context.

### Phase F: Polish + Blender Pipeline (~ongoing)
- Blender model authoring pipeline (style guide, export checklist, asset library upload)
- Scene compositions for all system journeys
- Character models beyond Kit (Rosa, Sage, Spark)
- Audio integration (ambient, SFX, TTS)
- Shareable journey completion cards (PNG export)
- Mobile responsive pass
- Analytics (journey completion rates, average duration, branching distribution)
- Phase 2 teacher editor (simplified fork-and-customize)

**Total estimate: ~17-22 days for Phases A-E, Phase F ongoing.**

---

## 14. Relationship to Other Systems

| System | Relationship |
|---|---|
| **Dimensions3** | Journey Blocks are siblings of Activity Blocks, not children. Both live in the lesson editor palette. A `JourneyActivitySection` is an activity section type that delegates to the Journey Engine. Journey Blocks do NOT go through the 6-stage generation pipeline — they are authored, not generated. |
| **3D Elements** | The Journey Engine is the first consumer of the R3F renderer, asset library, and character system. The `r3f_instruction` pattern from 3D Elements becomes the scene definition format for journeys. |
| **Discovery Engine** | Becomes the reference journey. All Discovery-specific code migrates into generic Journey Engine code + content configuration. |
| **Design Assistant** | Reads `learning_profile` via `buildProfileContext()`. The mentor's personality adapts based on journey-produced data. |
| **Open Studio** | Check-in journeys (window mode) replace the current timer-based text check-ins. Drift detection journeys replace the 3-level escalation text prompts. |
| **Safety Badges** | Safety checkpoint journeys produce skill data that feeds badge progress. The `scene_explore` hazard identification is a natural fit. |
| **Toolkit** | Toolkit tools remain separate (they have their own per-step AI rules and interaction patterns). However, a journey could include a block that launches a toolkit tool (e.g., "Complete a SCAMPER on your problem" as a journey step). |
| **Class Gallery** | Gallery review journeys could structure the peer review experience with guided observation prompts. |

---

## 15. Open Questions

1. **Journey versioning and in-progress students** — When a journey is updated (new blocks added, routing changed), students mid-journey are locked to their starting version. But what about the profile paths? If v2 writes to a new path that v1 didn't, the profile schema must handle sparse data gracefully. **Proposed:** All profile reads use optional chaining and never assume a path exists. Profile-dependent UI shows "not yet discovered" states.

2. **Journey block reuse tracking** — Should we track which journeys use which blocks (like block_assets for 3D)? Useful for impact analysis ("if I change this block, which journeys are affected?"). **Proposed:** Yes — `journey_block_usage` junction table, or denormalized `used_in_journeys[]` on the block.

3. **AI-generated journey blocks** — Can the generation pipeline create journey blocks, not just activity blocks? E.g., "generate a challenge-introduction journey for a unit about sustainable packaging." **Proposed:** Phase F / future. The interaction types are well-defined enough that an AI could compose content_config for a `binary_choice` or `text_prompt` block given a topic. The routing and scene composition are harder to generate.

4. **Cross-journey state** — Can one journey's conditional routing reference data written by a completely different journey session? **Proposed:** Yes — conditions against `profile` source read the persistent `learning_profile`, which accumulates data from all journeys. This is how the adaptive shortening works (second Discovery journey skips stations whose data already exists).

5. **Multiplayer journeys** — Can two students go through a journey together, seeing each other's choices? E.g., a collaborative project-scoping journey where both partners answer and the system finds common ground. **Proposed:** Future. The session model is currently single-student. Multiplayer adds Supabase Realtime complexity. Park for now.

6. **Journey analytics dashboard** — What metrics matter? Completion rate, average duration, branching distribution (which paths are most common), drop-off points (which blocks lose students), profile data quality (are written values meaningful or low-effort). **Proposed:** Build into admin dashboard alongside Dimensions3 pipeline health.
