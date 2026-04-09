# Loominary — Unit & Lesson Data Architecture
## Activity Blocks, R3F Instructions, Sound, and Asset Library Integration

**Date:** April 2026  
**Status:** Architecture Planning  
**Stack:** Next.js 15, React 19, Supabase, R3F  

---

## Core Principle

Every lesson is a sequence of **activity blocks**. Each block has a **type** that determines how it renders. Most blocks are traditional (text, video, upload, quiz). Some blocks carry **R3F scene instructions** and **sound references** that bring the 3D engine into the lesson. The actual 3D models and audio files live in a separate **asset library** — blocks only reference them by ID.

This separation is critical: content authors think in blocks, the asset library is managed independently, and the renderer resolves references at runtime.

---

## Data Hierarchy

```
Programme (PYP / MYP / DP)
  └── Subject (Design / Personal Project / Extended Essay)
        └── Unit
              ├── metadata (title, key concept, global context, SOI, ATL focus)
              ├── unit_r3f (optional: Designville quest definition)
              └── Lessons (ordered sequence)
                    └── Activity Blocks (ordered sequence within lesson)
                          ├── block type
                          ├── content (text, questions, etc.)
                          ├── r3f_instruction (optional: 3D scene config)
                          ├── sound_instruction (optional: audio config)
                          └── asset references (IDs into library)
```

---

## The Activity Block Schema

```typescript
interface ActivityBlock {
  // ── Identity ──
  id: string                    // UUID
  lesson_id: string             // FK to lesson
  position: number              // ordering within lesson
  
  // ── Core ──
  type: BlockType
  title?: string                // optional heading displayed above block
  
  // ── Content (varies by type) ──
  content: BlockContent         // type-specific payload
  
  // ── 3D Layer (optional) ──
  r3f_instruction?: R3FInstruction | null
  
  // ── Sound Layer (optional) ──
  sound_instruction?: SoundInstruction | null
  
  // ── Behaviour ──
  is_required: boolean          // must complete before advancing?
  completion_criteria?: CompletionCriteria
  estimated_minutes?: number
  
  // ── Meta ──
  created_at: string
  updated_at: string
}
```

---

## Block Types

```typescript
type BlockType =
  // ── Traditional ──
  | 'text'              // rich text / markdown content
  | 'video'             // embedded video (YouTube, Vimeo, uploaded)
  | 'image'             // image with optional caption/annotation
  | 'file'              // downloadable resource
  | 'quiz'              // multiple choice, matching, short answer
  | 'discussion'        // prompt with student response area
  | 'upload'            // student submits file/image/artifact
  | 'checklist'         // task list with checkboxes
  | 'rubric'            // assessment criteria display
  | 'timer'             // countdown for timed activities
  | 'embed'             // iframe embed (Padlet, Canva, etc.)
  
  // ── 3D / Interactive ──
  | 'scene'             // embedded 3D scene window (Mode 2)
  | 'discovery'         // NPC cutscene / narrative intro (Mode 4)
  | 'tutorial'          // guided step-by-step skill lesson
  | 'safety'            // hazard identification scene
  | 'diagram'           // visual step diagram (e.g., PIR wiring)
  | 'scamper'           // 3D SCAMPER ideation tool
  | 'comparison'        // 3D decision matrix / side-by-side
  | 'gallery_link'      // link to student's virtual studio / exhibition
  
  // ── AI-Powered ──
  | 'ai_chat'           // contextual AI assistant for this block
  | 'ai_npc'            // voice NPC conversation (Claude + TTS)
  | 'ai_feedback'       // AI reviews student upload and responds
```

---

## R3F Instruction Schema

This is the key field. It tells the 3D renderer what to display and how.

```typescript
interface R3FInstruction {
  // ── Rendering Mode ──
  mode: 'embedded' | 'modal' | 'fullscreen' | 'floating' | 'pip'
  height?: number               // pixel height for embedded mode (default 240)
  
  // ── Scene Composition ──
  scene: {
    environment: string         // asset library ID: 'env_bakery', 'env_workshop'
    floor?: string              // asset library ID: 'floor_wood', 'floor_cobblestone'
    walls?: string              // asset library ID: 'wall_plaster', null for outdoor
    lighting: string            // preset ID: 'morning', 'evening', 'cozy', 'night'
    weather?: string[]          // preset IDs: ['fireflies', 'smoke']
    fog?: {
      type: 'exponential' | 'linear'
      density: number
      color: string
    }
    skybox?: string             // asset library ID or color hex
  }
  
  // ── Characters ──
  characters: Array<{
    asset_id: string            // asset library ID: 'char_rosa', 'char_player'
    position: [number, number, number]
    rotation?: number           // Y-axis rotation in radians
    animation?: string          // 'idle', 'talk', 'wave', 'worried'
    name_tag?: string           // display name above character
    
    // AI-powered NPC settings (optional)
    ai_config?: {
      system_prompt: string     // character personality for Claude
      voice_id?: string         // ElevenLabs voice ID
      phase_context?: string    // current Design Cycle phase for context
    }
  }>
  
  // ── Props ──
  props: Array<{
    asset_id: string            // asset library ID: 'prop_counter', 'prop_cup'
    position: [number, number, number]
    rotation?: [number, number, number]
    scale?: number | [number, number, number]
    interactive?: boolean       // can student click/tap this?
    highlight?: boolean         // pulse highlight ring?
    label?: string              // floating annotation text
    
    // For tutorial targets
    tutorial_step_id?: string   // which step does this prop relate to?
  }>
  
  // ── Camera ──
  camera: {
    initial_position: [number, number, number]
    initial_look_at: [number, number, number]
    controls: 'orbit' | 'follow' | 'fixed' | 'scripted'
    auto_rotate?: boolean
    min_distance?: number
    max_distance?: number
  }
  
  // ── Scripted Camera (for cutscenes/tutorials) ──
  camera_script?: Array<{
    step_id: string
    position: [number, number, number]
    look_at: [number, number, number]
    duration_ms?: number        // auto-advance after duration
    easing?: 'linear' | 'ease-in-out' | 'ease-out'
  }>
  
  // ── Effects ──
  effects?: {
    particles?: Array<{
      type: string              // asset library ID: 'fx_sparks', 'fx_confetti'
      origin: [number, number, number]
      count?: number
    }>
    highlights?: Array<{
      target_prop: string       // prop asset_id to highlight
      color?: string
      pulse?: boolean
    }>
  }
  
  // ── Interaction Layer ──
  interactions?: {
    // For tutorials
    steps?: Array<{
      id: string
      instruction: string
      subtext?: string
      action: 'click' | 'drag' | 'continue' | 'finish'
      target?: string           // prop asset_id
      validation?: string       // 'object_clicked', 'wire_connected', etc.
      result?: {                // measurement/output
        value: any
        label: string
        unit?: string
      }
      on_complete?: {
        sound?: string          // sound instruction ID
        npc_reaction?: string   // dialogue line
        world_change?: string   // 'show_sketches_on_wall'
      }
    }>
    
    // For safety scenes
    hazards?: Array<{
      id: string
      prop_id: string           // which prop is the hazard
      description: string
      severity: 'low' | 'medium' | 'high'
      fix: string
      category: string          // 'electrical', 'fire', 'ergonomic', etc.
    }>
    
    // For SCAMPER
    scamper_config?: {
      target_object: string     // prop asset_id being SCAMPERed
      material_options?: string[] // asset library material IDs
      allow_scale?: boolean
      allow_combine?: string[]  // other props that can merge
    }
  }
  
  // ── Overlay UI ──
  overlay?: {
    show_quest_marker?: boolean
    show_phase_indicator?: boolean
    show_npc_companion?: boolean // PiP mode
    custom_hud?: Array<{
      type: 'label' | 'meter' | 'counter'
      position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
      data_key: string          // what student data to display
    }>
  }
}
```

---

## Sound Instruction Schema

```typescript
interface SoundInstruction {
  // ── Background ──
  ambience?: {
    asset_id: string            // asset library ID: 'amb_bakery', 'amb_workshop'
    volume: number              // 0-1
    fade_in_ms?: number
  }
  
  music?: {
    asset_id: string            // asset library ID: 'mus_exploration', 'mus_tension'
    volume: number
    loop: boolean
    fade_in_ms?: number
    
    // Mood transitions tied to block events
    mood_changes?: Array<{
      trigger: string           // 'step_3', 'hazard_found', 'quest_accepted'
      asset_id: string          // switch to this track
      crossfade_ms?: number
    }>
  }
  
  // ── Spatial Audio (positional in 3D) ──
  spatial?: Array<{
    asset_id: string            // 'sfx_fire_crackle', 'sfx_water_flow'
    attach_to: string           // prop asset_id — sound follows this object
    volume: number
    distance: number            // falloff distance in world units
    loop: boolean
  }>
  
  // ── Event SFX ──
  events?: Array<{
    trigger: string             // 'block_enter', 'task_complete', 'npc_speak', etc.
    asset_id?: string           // pre-recorded sound from library
    synth?: {                   // OR synthesized sound (Tone.js)
      type: 'chime' | 'confirm' | 'alert' | 'fanfare' | 'click' | 'whoosh'
      notes?: string[]          // e.g. ['C5', 'E5', 'G5']
      duration?: string         // Tone.js duration: '8n', '4n', etc.
    }
  }>
  
  // ── Voice / TTS ──
  voice?: {
    engine: 'elevenlabs' | 'browser' | 'none'
    voice_id?: string           // ElevenLabs voice ID
    // Actual text comes from dialogue lines in r3f_instruction
  }
}
```

---

## Asset Library Schema

Assets are stored separately and referenced by ID. This ensures consistency, reusability, and independent versioning.

```typescript
interface Asset {
  id: string                    // 'char_rosa', 'prop_cup', 'env_bakery'
  type: AssetType
  name: string                  // human-readable: 'Rosa the Baker'
  category: string              // 'character', 'prop', 'environment', etc.
  tags: string[]                // ['bakery', 'npc', 'quest-giver']
  
  // ── File References ──
  model_url?: string            // Supabase Storage path to .glb file
  thumbnail_url?: string        // preview image
  
  // ── Fallback (if no .glb model exists) ──
  primitive_config?: object     // JSON config to build from primitives
                                // (what we've been using in prototypes)
  
  // ── For sound assets ──
  audio_url?: string            // Supabase Storage path to .mp3/.ogg
  audio_duration_ms?: number
  audio_loop_point_ms?: number  // where to loop from
  
  // ── Metadata ──
  triangle_count?: number       // for performance budgeting
  file_size_kb?: number
  license: string               // 'cc0', 'custom', 'proprietary'
  attribution?: string
  
  // ── Variants ──
  lod_variants?: {              // Level of Detail
    high: string                // full model URL
    medium?: string             // simplified model URL
    low?: string                // very simplified for floating/pip mode
  }
  
  // ── Material Overrides ──
  material_slots?: Array<{
    slot_name: string           // 'body', 'skin', 'outfit'
    default_color: string
    swappable: boolean          // can teachers change this color?
  }>
  
  created_at: string
  updated_at: string
  created_by?: string           // teacher ID if user-created
  is_global: boolean            // available to all schools or just creator's
}

type AssetType =
  | 'model_character'
  | 'model_prop'
  | 'model_environment'
  | 'model_tool'
  | 'material'
  | 'texture'
  | 'lighting_preset'
  | 'weather_preset'
  | 'audio_ambience'
  | 'audio_music'
  | 'audio_sfx'
  | 'audio_voice'
  | 'animation_clip'
```

---

## Supabase Table Structure

```sql
-- Asset library (global, shared across all schools)
create table public.assets (
  id text primary key,                    -- 'char_rosa', 'prop_cup'
  type text not null,                     -- 'model_character', 'audio_sfx', etc.
  name text not null,
  category text not null,
  tags text[] default '{}',
  model_url text,                         -- storage path to .glb
  thumbnail_url text,
  primitive_config jsonb,                 -- fallback primitive builder
  audio_url text,                         -- storage path to .mp3
  audio_duration_ms int,
  triangle_count int,
  file_size_kb int,
  license text default 'proprietary',
  material_slots jsonb,
  lod_variants jsonb,
  is_global boolean default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Units
create table public.units (
  id uuid primary key default gen_random_uuid(),
  programme text not null,                -- 'MYP', 'PYP', 'DP'
  subject text not null,
  title text not null,
  key_concept text,
  global_context text,
  statement_of_inquiry text,
  atl_focus text[],
  unit_r3f jsonb,                         -- Designville quest definition (optional)
  created_by uuid references profiles(id),
  school_id uuid references schools(id),
  position int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Lessons within a unit
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  title text not null,
  description text,
  position int not null default 0,
  estimated_minutes int,
  design_cycle_phase text,                -- 'Inquire', 'Develop', 'Create', 'Evaluate'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Activity blocks within a lesson
create table public.activity_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  position int not null default 0,
  type text not null,                     -- block type from BlockType enum
  title text,
  content jsonb not null default '{}',    -- type-specific content payload
  r3f_instruction jsonb,                  -- 3D scene config (nullable)
  sound_instruction jsonb,                -- audio config (nullable)
  is_required boolean default false,
  completion_criteria jsonb,
  estimated_minutes int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Junction: which assets does a block reference?
-- (Enables asset dependency tracking, preloading, and usage analytics)
create table public.block_assets (
  block_id uuid references activity_blocks(id) on delete cascade,
  asset_id text references assets(id) on delete cascade,
  role text not null,                     -- 'character', 'prop', 'ambience', etc.
  primary key (block_id, asset_id, role)
);

-- Student progress per block
create table public.block_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  block_id uuid not null references activity_blocks(id) on delete cascade,
  status text default 'not_started',      -- 'not_started', 'in_progress', 'completed'
  result jsonb,                           -- measurements, answers, scores, etc.
  started_at timestamptz,
  completed_at timestamptz,
  time_spent_seconds int,
  constraint block_progress_unique unique (student_id, block_id)
);
```

---

## How the Renderer Resolves a Block

```
1. Student opens lesson → lesson page loads activity blocks in order

2. For each block:
   a. Check block.type → select React component to render
   b. If r3f_instruction exists:
      - Parse scene config
      - Resolve all asset_ids → fetch from asset cache or Supabase Storage
      - If .glb model exists → useGLTF(model_url)
      - If no model → use primitive_config as fallback
      - Compose scene: environment + characters + props + lighting + weather
      - Apply camera config
      - Load interaction layer (tutorial steps, hazards, SCAMPER config)
   c. If sound_instruction exists:
      - Resolve audio asset_ids → fetch from cache or Storage
      - Initialize Howler/Tone.js instances
      - Attach spatial audio to props
      - Queue event-triggered sounds
   d. Render the block component with 3D canvas + React overlays

3. Student interacts → block_progress updated in Supabase

4. On completion → advance to next block or unlock next lesson
```

---

## Asset Preloading Strategy

3D models and audio files are heavy. Preloading prevents jarring load times.

```typescript
// When a lesson page loads:
// 1. Scan ALL blocks in the lesson for asset references
// 2. Deduplicate — same asset used in multiple blocks loads once
// 3. Prioritize: load current block's assets first, then prefetch next 2 blocks
// 4. Show skeleton/shimmer UI while loading
// 5. Cache loaded assets in memory for the session

interface AssetCache {
  models: Map<string, THREE.Group>        // loaded .glb scenes
  textures: Map<string, THREE.Texture>    // loaded textures
  audio: Map<string, Howl | AudioBuffer>  // loaded sounds
  primitives: Map<string, THREE.Group>    // built-from-config fallbacks
}

// drei's useGLTF.preload() handles model preloading
// Howler's preload flag handles audio
// Supabase Storage CDN handles caching at the network level
```

---

## Block Composition Examples

### Example 1: Simple embedded scene (no interaction)

```json
{
  "type": "scene",
  "title": "Rosa's Bakery",
  "content": {
    "caption": "This is where you'll be working. Rosa needs your help."
  },
  "r3f_instruction": {
    "mode": "embedded",
    "height": 240,
    "scene": {
      "environment": "env_bakery_interior",
      "lighting": "cozy",
      "weather": ["smoke"]
    },
    "characters": [
      { "asset_id": "char_rosa", "position": [-2, 0, -1], "animation": "idle" }
    ],
    "props": [
      { "asset_id": "prop_counter", "position": [-3, 0, -1] },
      { "asset_id": "prop_cups", "position": [-3, 0.9, -1] }
    ],
    "camera": {
      "initial_position": [2, 2, 3],
      "initial_look_at": [-1, 1, -1],
      "controls": "orbit",
      "auto_rotate": true
    }
  },
  "sound_instruction": {
    "ambience": { "asset_id": "amb_bakery", "volume": 0.2 }
  }
}
```

### Example 2: Tutorial block (caliper measurement)

```json
{
  "type": "tutorial",
  "title": "Measuring Rosa's Cup",
  "content": {
    "skill_name": "Precision Measurement",
    "estimated_time": "3 min",
    "learning_objectives": ["Use digital calipers", "Record specifications"]
  },
  "r3f_instruction": {
    "mode": "embedded",
    "height": 300,
    "scene": {
      "environment": "env_workshop",
      "lighting": "cozy"
    },
    "characters": [
      { "asset_id": "char_rosa", "position": [-1, 0, 0.5], "animation": "idle" }
    ],
    "props": [
      { "asset_id": "prop_workbench", "position": [1, 0, -1] },
      { "asset_id": "prop_caliper", "position": [1.3, 0.94, -1], "interactive": true, "highlight": true },
      { "asset_id": "prop_cup", "position": [-1.8, 0.9, -0.5], "interactive": true }
    ],
    "camera": {
      "initial_position": [2, 2.2, 4],
      "initial_look_at": [0, 0.9, -0.5],
      "controls": "scripted"
    },
    "interactions": {
      "steps": [
        {
          "id": "find_caliper",
          "instruction": "Find the calipers on the workbench",
          "action": "click",
          "target": "prop_caliper",
          "on_complete": { "sound": "sfx_pickup" }
        },
        {
          "id": "measure_diameter",
          "instruction": "Measure the cup's outer diameter",
          "action": "click",
          "target": "prop_cup",
          "result": { "value": 82.4, "label": "Cup diameter", "unit": "mm" },
          "on_complete": {
            "sound": "sfx_measurement",
            "npc_reaction": "82.4mm! Nobody's ever measured my cups before."
          }
        }
      ]
    }
  },
  "sound_instruction": {
    "ambience": { "asset_id": "amb_workshop", "volume": 0.15 },
    "events": [
      { "trigger": "step_complete", "synth": { "type": "confirm" } },
      { "trigger": "tutorial_complete", "synth": { "type": "fanfare", "notes": ["C5","E5","G5","C6"] } }
    ]
  },
  "is_required": true,
  "completion_criteria": { "type": "all_steps_completed" }
}
```

### Example 3: Safety block (hazard scene)

```json
{
  "type": "safety",
  "title": "Workshop Safety Check",
  "content": {
    "instructions": "Find all 6 hazards in the workshop. Tap each one to identify it.",
    "time_limit_seconds": 120,
    "pass_score": 5
  },
  "r3f_instruction": {
    "mode": "embedded",
    "height": 350,
    "scene": {
      "environment": "env_workshop",
      "lighting": "afternoon"
    },
    "props": [
      { "asset_id": "prop_workbench", "position": [2, 0, -1] },
      { "asset_id": "prop_frayed_cable", "position": [2.5, 0.9, -1], "interactive": true },
      { "asset_id": "prop_soldering_iron_on", "position": [1, 0.9, -1.5], "interactive": true },
      { "asset_id": "prop_goggles_on_table", "position": [0, 0.9, -0.5], "interactive": true },
      { "asset_id": "prop_wood_shavings", "position": [-2, 0, -1.5], "interactive": true },
      { "asset_id": "prop_blocked_extinguisher", "position": [-3, 0, 1], "interactive": true },
      { "asset_id": "prop_open_adhesive", "position": [1.5, 0.9, 0], "interactive": true }
    ],
    "camera": {
      "initial_position": [0, 3, 5],
      "initial_look_at": [0, 0.5, -1],
      "controls": "orbit"
    },
    "interactions": {
      "hazards": [
        {
          "id": "h1", "prop_id": "prop_frayed_cable",
          "description": "Frayed power cable — risk of electric shock",
          "severity": "high", "category": "electrical",
          "fix": "Replace immediately and unplug the tool"
        },
        {
          "id": "h2", "prop_id": "prop_soldering_iron_on",
          "description": "Soldering iron left on without holder — burn and fire risk",
          "severity": "high", "category": "fire",
          "fix": "Turn off when not in use, always use a holder"
        }
      ]
    }
  },
  "sound_instruction": {
    "events": [
      { "trigger": "hazard_found", "synth": { "type": "confirm" } },
      { "trigger": "hazard_missed", "synth": { "type": "alert" } }
    ]
  },
  "is_required": true,
  "completion_criteria": { "type": "min_score", "value": 5 }
}
```

### Example 4: Discovery cutscene block

```json
{
  "type": "discovery",
  "title": "Meet Rosa",
  "content": {
    "quest_id": "quest_hot_cup",
    "skippable": true
  },
  "r3f_instruction": {
    "mode": "modal",
    "scene": {
      "environment": "env_bakery_interior",
      "lighting": "cozy",
      "weather": ["smoke", "dust"]
    },
    "characters": [
      {
        "asset_id": "char_rosa",
        "position": [-1.2, 0, -0.5],
        "animation": "idle",
        "ai_config": null
      },
      {
        "asset_id": "char_player",
        "position": [0.8, 0, 1.5]
      }
    ],
    "props": [
      { "asset_id": "prop_counter", "position": [-2.5, 0, -0.5] },
      { "asset_id": "prop_cups", "position": [-2.5, 0.9, -0.5] },
      { "asset_id": "prop_forge", "position": [-3.5, 0, -2] }
    ],
    "camera": {
      "initial_position": [3, 2.5, 5],
      "initial_look_at": [-1, 1, -1],
      "controls": "scripted"
    },
    "camera_script": [
      { "step_id": "wide", "position": [3, 2.5, 5], "look_at": [-1, 1, -1], "duration_ms": 2500 },
      { "step_id": "rosa_close", "position": [0.8, 1.7, 2.2], "look_at": [-1.2, 1.4, -0.5] },
      { "step_id": "cups_pan", "position": [-2.5, 1.2, 0.5], "look_at": [-2.5, 0.9, -0.5], "duration_ms": 2000 },
      { "step_id": "two_shot", "position": [1.5, 1.6, 2.5], "look_at": [-0.3, 1.3, 0] }
    ],
    "interactions": {
      "steps": [
        { "id": "d1", "instruction": "", "action": "continue",
          "on_complete": { "npc_reaction": "Oh! A new face in Designville!" } },
        { "id": "d2", "instruction": "", "action": "continue",
          "on_complete": { "npc_reaction": "My customers keep burning their hands on these cups." } },
        { "id": "d3", "instruction": "", "action": "continue",
          "on_complete": { "npc_reaction": "Could you design a better cup sleeve?" } }
      ]
    }
  },
  "sound_instruction": {
    "ambience": { "asset_id": "amb_bakery", "volume": 0.2, "fade_in_ms": 2000 },
    "music": {
      "asset_id": "mus_exploration", "volume": 0.15, "loop": true,
      "mood_changes": [
        { "trigger": "step_d2", "asset_id": "mus_tension", "crossfade_ms": 1500 },
        { "trigger": "step_d3", "asset_id": "mus_hopeful", "crossfade_ms": 1000 }
      ]
    },
    "events": [
      { "trigger": "quest_offered", "synth": { "type": "chime", "notes": ["C5","E5","G5","C6"] } }
    ],
    "voice": { "engine": "elevenlabs", "voice_id": "rosa_voice_001" }
  }
}
```

---

## Key Design Decisions

### 1. Why jsonb for r3f_instruction, not separate tables?

Each block's 3D config is self-contained and varies wildly by block type. A tutorial has steps, a safety scene has hazards, a SCAMPER block has material options. Normalising this into relational tables would create dozens of sparse tables with complex joins. JSONB keeps the config as a single document that the renderer consumes directly. Supabase's jsonb operators still allow querying within the config if needed.

### 2. Why a separate block_assets junction table?

Even though asset references are embedded in the jsonb, the junction table enables: preload scanning (query all assets for a lesson in one call), usage analytics (which assets are most used), dependency tracking (don't delete an asset still in use), and search (find all blocks using a specific character).

### 3. Why primitive_config as fallback?

Not every asset will have a .glb model immediately. The system should render something even without production models. The primitive configs from our prototypes serve as fallbacks — they're the "placeholder" art that still looks intentional because of the angular flat-shaded style. Over time, primitives get replaced by proper models without changing any block config.

### 4. Why separate sound_instruction from r3f_instruction?

Some blocks have sound but no 3D (a text block with background music). Some have 3D but no sound (a silent diagram). Separating them avoids forcing the renderer to parse sound config from the 3D instruction, and allows a dedicated audio manager that operates independently of the 3D engine.

### 5. How do blocks know when to advance?

The completion_criteria field handles this:
- `{ "type": "all_steps_completed" }` — tutorial must finish
- `{ "type": "min_score", "value": 5 }` — safety needs 5/6 hazards
- `{ "type": "time_spent", "min_seconds": 30 }` — must engage for at least 30s
- `{ "type": "upload_submitted" }` — student must submit a file
- `{ "type": "manual" }` — teacher marks complete
- `null` — no requirement, auto-complete on view

---

## Migration Path

1. **Now:** Build the activity_blocks table with type and content. Leave r3f_instruction and sound_instruction as nullable jsonb columns. Traditional blocks (text, video, quiz) work immediately.

2. **When 3D ships:** Populate r3f_instruction for scene, tutorial, and discovery block types. The renderer checks: if r3f_instruction exists, render 3D; otherwise, render traditional.

3. **When audio ships:** Populate sound_instruction. Same pattern — audio manager checks for the field and initialises if present.

4. **When asset library grows:** Replace primitive_config references with model_url references. The renderer's fallback logic handles the transition automatically.

This means you can build the lesson/unit system today with traditional blocks, and the 3D and audio layers slot in later without schema changes.

---

## Content Safety & Moderation Layer

**CRITICAL:** This platform is used by minors in schools. Every input surface — text, voice, uploaded files, 3D models, AI responses, guestbook entries, chat messages, avatar customisation — must pass through a moderation pipeline. This is not optional. Build it as foundational infrastructure, not a feature added later.

### Input Surfaces to Moderate

| Surface | Type | Risk | When |
|---------|------|------|------|
| Student text input | Text | Profanity, bullying, self-harm, inappropriate content | Process journal, chat, guestbook, discussion blocks, project titles, NPC conversations |
| AI assistant responses | Text | Hallucination, inappropriate content, off-topic, harmful advice | Every Claude API response before it reaches the student |
| Voice files / TTS | Audio | Inappropriate speech, prompt injection via voice | Student voice uploads, AI NPC voice output |
| Uploaded images/files | Image/File | Explicit imagery, violence, non-educational content | Portfolio uploads, process journal attachments, avatar photos |
| 3D model uploads | Model (.glb) | Inappropriate shapes, offensive objects, weapons | Student-uploaded prototypes, custom assets, Digital Twin reconstructions |
| Avatar customisation | Config | Offensive names, inappropriate color/accessory combinations, slurs in name fields | Student profiles, gallery avatars |
| Multiplayer chat | Text | Real-time bullying, doxxing, inappropriate language | Gallery exhibition chat, in-world messages |
| Guestbook entries | Text | Inappropriate visitor messages to students | Virtual studio guestbook |

### Architecture: Central Moderation Service

```typescript
// Every input surface calls this before persisting or displaying

interface ModerationRequest {
  content_type: 'text' | 'image' | 'audio' | 'model' | 'config'
  content: string | Blob | ArrayBuffer  // the content to check
  context: {
    user_id: string
    user_role: 'student' | 'teacher' | 'parent' | 'visitor'
    surface: string              // 'process_journal', 'gallery_chat', 'ai_response', etc.
    school_id: string
    age_group?: string           // 'pyp' (5-11), 'myp' (11-16), 'dp' (16-19)
  }
}

interface ModerationResult {
  allowed: boolean
  flags: ModerationFlag[]
  filtered_content?: string      // sanitised version if salvageable
  action: 'allow' | 'filter' | 'block' | 'escalate'
  reason?: string
}

interface ModerationFlag {
  category: string               // 'profanity', 'sexual', 'violence', 'bullying',
                                 //  'self_harm', 'pii', 'spam', 'off_topic'
  severity: 'low' | 'medium' | 'high' | 'critical'
  detail: string
}
```

### Moderation Strategies by Content Type

**Text (student input, chat, guestbook):**
- Tier 1: Word/phrase blocklist (fast, catches obvious profanity, slurs). Run client-side for instant feedback.
- Tier 2: Claude API with a moderation-specific system prompt — catches context-dependent issues, bullying patterns, coded language that blocklists miss. Run server-side before persisting.
- Tier 3: Pattern detection — repeated targeting of the same student, escalating language over time, self-harm indicators. Run as background analysis on conversation history.

**Text (AI responses):**
- Claude's own safety layer handles most issues, but add a post-generation check: scan the response for hallucinated URLs, inappropriate content that slipped through, or off-topic drift. Log all AI responses for audit.
- Implement a response wrapper that strips any content flagged before it reaches the student.

**Images/Files:**
- On upload: run through a vision moderation API (Google Cloud Vision SafeSearch, AWS Rekognition, or Claude Vision with a moderation prompt).
- Check for: explicit content, violence, text in images (screenshots of inappropriate content), non-educational material.
- Store all uploads in a quarantine bucket. Only move to the public bucket after moderation passes. Display a placeholder until cleared.

**Audio/Voice:**
- Transcribe via Whisper API or browser SpeechRecognition → run transcript through text moderation.
- For uploaded audio files: transcribe first, moderate transcript, then allow playback.
- For AI TTS output: the text is already moderated before TTS conversion, but log the audio for audit.

**3D Models (.glb uploads):**
- This is the hardest surface. Approaches:
  - Render the model from 4-6 camera angles automatically → run rendered images through vision moderation (same pipeline as image uploads).
  - Silhouette analysis: extract the model's silhouette from multiple angles and check against known inappropriate shape classifiers.
  - Teacher approval gate: all student-uploaded models require teacher approval before they appear in shared spaces (gallery, exhibitions). Allow immediate use in the student's own private workspace.
  - Bounding box heuristics: flag models with unusual proportions that don't match expected project parameters.
- For Digital Twin reconstructions: the input photos are moderated before reconstruction, and the output model gets the multi-angle render check.

**Avatar/Profile Configuration:**
- Name validation: blocklist + Claude API check for hidden slurs, coded language, and inappropriate references.
- Color combination check: flag known problematic symbol color combinations.
- Display name character limit and allowed character set (prevent unicode abuse).

### Escalation Flow

```
Content flagged
  ↓
  Severity: LOW → auto-filter (replace with ***), log, continue
  Severity: MEDIUM → block content, notify student ("This can't be posted"),
                      log for teacher review
  Severity: HIGH → block content, notify teacher immediately,
                    flag student account for review
  Severity: CRITICAL → block content, notify teacher AND school admin,
                        temporarily restrict student's upload/chat permissions,
                        log with full context for safeguarding review
```

### Database Tables

```sql
-- Moderation log (every check, pass or fail)
create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  school_id uuid references schools(id),
  content_type text not null,          -- 'text', 'image', 'audio', 'model', 'config'
  surface text not null,               -- 'process_journal', 'gallery_chat', etc.
  content_hash text,                   -- hash of content for dedup (don't store raw content for privacy)
  result text not null,                -- 'allow', 'filter', 'block', 'escalate'
  flags jsonb default '[]',            -- array of ModerationFlag objects
  reviewed_by uuid,                    -- teacher who reviewed (if escalated)
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- Active restrictions
create table public.moderation_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  restriction_type text not null,       -- 'chat_disabled', 'upload_disabled', 'gallery_restricted'
  reason text,
  imposed_by uuid references profiles(id),  -- teacher/admin who imposed
  expires_at timestamptz,               -- null = indefinite until lifted
  lifted_at timestamptz,
  created_at timestamptz default now()
);

-- Teacher review queue
create table public.moderation_queue (
  id uuid primary key default gen_random_uuid(),
  moderation_log_id uuid references moderation_log(id),
  school_id uuid not null references schools(id),
  status text default 'pending',        -- 'pending', 'approved', 'rejected', 'escalated'
  assigned_to uuid references profiles(id),
  notes text,
  resolved_at timestamptz,
  created_at timestamptz default now()
);
```

### Implementation Priority

1. **Now (before any student-facing launch):** Text moderation on all input fields. Blocklist + Claude API check. This covers process journals, chat, names, guestbook.
2. **With uploads:** Image moderation via vision API. Quarantine-then-approve pipeline.
3. **With gallery/multiplayer:** Real-time chat moderation with rate limiting. Guestbook moderation.
4. **With 3D models:** Multi-angle render + vision check. Teacher approval gate for shared spaces.
5. **With voice:** Transcription + text moderation pipeline.
6. **Ongoing:** Pattern detection for longitudinal bullying, self-harm indicators, and safeguarding concerns. Regular audit of moderation logs.

### Key Principles

- **Default deny for shared spaces:** Content in private student workspace can be more permissive. Content visible to other students or visitors must pass moderation.
- **Age-appropriate thresholds:** PYP (5–11) gets strictest filtering. DP (16–19) gets more latitude. Configurable per school.
- **Teacher override:** Teachers can approve content that was auto-blocked if they judge it appropriate in context (e.g., a student researching weapon design for a historical project).
- **Transparency:** Students see clear feedback when content is blocked ("This message wasn't sent because it may contain inappropriate language"). Never silent blocking.
- **Privacy:** Don't store raw flagged content beyond what's needed for review. Hash for dedup. Delete reviewed content after resolution period.
- **Audit trail:** Every moderation decision is logged. Schools can generate reports for safeguarding compliance.
- **Never trust client-side only:** Client-side blocklists are for instant UX feedback. All real moderation happens server-side before persistence.
