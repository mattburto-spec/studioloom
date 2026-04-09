# Project 3D Elements — Visual & Gamification Layer for StudioLoom
**Created: 4 April 2026**
**Status: VISION PHASE — ideas captured from mobile brainstorm, needs structured planning**
**Source files: `questerra/3delements/` (24 files, ~800KB)**
**Overlaps with: Dimensions3 (activity block schema, generation pipeline), Discovery Engine, Class Gallery, Toolkit, Open Studio**

---

## 1. What This Is

A comprehensive 3D visual and gamification layer that wraps around StudioLoom's existing 2D platform. Students experience design education through an immersive, low-poly world ("Designville") where NPCs have real problems, quests map to Design Cycle phases, and every interaction produces pedagogically meaningful data.

The 3D layer is **progressive enhancement, not replacement**. The current lesson page, dashboard, toolkit, and all existing UX remain the primary interface. 3D enriches it — embedded scenes in lessons, floating badges on profiles, companion characters during work, cinematic cutscenes at key moments, and optional full-immersion quest worlds.

The exception to 3D: **real-world hand skills** (soldering, cutting, sewing, sketching with physical tools) still require high-definition realistic video. Everything else — tutorials, safety training, assembly instructions, narrative contexts — can be delivered through the 3D engine.

---

## 2. The Vision in One Paragraph

A student opens their unit. Instead of a text description, an embedded 3D scene shows Rosa's bakery — warm lighting, flour on the counter, a forge glowing in the corner. Rosa looks worried about her coffee cups. The student accepts the quest, and the Design Cycle becomes a journey through Designville: interview Rosa (AI-powered voice NPC), measure her cups with interactive 3D calipers (guided tutorial), identify workshop hazards (safety scene), brainstorm solutions with SCAMPER in 3D (the cup morphs as they apply each lens), build their prototype, then exhibit it in a multiplayer gallery where classmates and parents walk through and leave reactions. Throughout, their mentor character watches from a PiP companion window, reacting to their progress. Every interaction maps to existing StudioLoom data structures — progress, integrity, reflections, grades.

---

## 3. What Exists (the 24 Files)

The `3delements/` directory contains prototypes and specs created during a mobile brainstorm session. They represent raw vision — exciting but unstructured. Here's what's there:

### Architecture & Concept Docs (5 files)

| File | What it defines | Key insight |
|------|----------------|-------------|
| `lesson-architecture.md` | Complete data schema for activity blocks with `r3f_instruction` (3D scene config) and `sound_instruction` (audio config), asset library tables, content moderation architecture | The two JSONB fields (`r3f_instruction`, `sound_instruction`) on activity blocks are the entire integration point — 3D is opt-in per block |
| `asset-library-architecture.md` | Reusable component library: 9 categories (characters, environments, lighting, weather, props, effects, UI3D, audio), scale standards, performance budgets, LOD system, asset sources | ~50K triangle budget per scene for 2019 Chromebook target. 24-color curated palette. Flat-shaded angular art style. |
| `3d-rendering-modes-concept.md` | 5 UI container modes: Full-screen immersion, Embedded scene window, Floating 3D objects, Modal/overlay, Picture-in-Picture companion | 3D is not a separate "game mode" — it lives at 5 different intensity levels across the platform. Same assets render in all containers. See also `StudioLoom-3D-Render-Modes-Plan.docx` for the orthogonal render preset dimension (Showcase/Designville/Workshop/Tutorial/Print). |
| `tutorial-system-concept.md` | 3 tutorial modes: Guided Skill (step-by-step interactive), Safety Scene (hazard identification), Visual Step Diagram (static rendered instructions) | Eliminates need for most instructional media (annotated photos, safety worksheets, circuit diagrams) — 3D engine does triple duty |
| `blue-sky-applications.md` | 11 future features prioritized P1-P5: Voice NPCs (Claude+ElevenLabs), AI-generated worlds from briefs, 3D Design Toolkit, procedural problem generation, design replay, emotional AI adaptation, digital twin prototyping, cross-school worlds, WebXR, physical-digital bridge | The P1 trio (Voice NPCs + AI worlds + 3D toolkit) could be a defining differentiator. No competitor does any of these. |

### Interactive Prototypes (14 JSX files)

**Quest & Narrative (4 files):**
- `design-quest-rpg.jsx` — Top-down 2D RPG world with tile grid, NPCs, quest log, mobile controls
- `design-quest-narrative.jsx` — Deep narrative Rosa quest with phase-aware NPC dialogue evolution
- `designville-r3f-starter.jsx` — Full 3D village in Three.js (4 buildings, trees, NPCs, third-person camera)
- `cutscene-prototype.jsx` — 11-step cinematic cutscene with scripted camera, character emotions, Tone.js audio

**Gallery & Multiplayer (5 files):**
- `3d-class-gallery.jsx` — Third-person 3D gallery walkthrough with proximity detection
- `class-gallery-prototype.jsx` — Lightweight 2D grid-based gallery (emoji assets, touch controls)
- `multiplayer-gallery.jsx` — Full multiplayer with chat, emoji reactions, lobby, player presence
- `gallery-architecture.jsx` — System architecture diagram (Supabase Realtime channels, scaling)
- `useGalleryMultiplayer.ts` — React hook for Supabase Presence + Broadcast + DB channels

**Tutorials & Tools (3 files):**
- `measurement-tutorial.jsx` — Interactive caliper measurement with step-by-step camera, highlights
- `pir-microbit-guide.jsx` — PIR sensor wiring tutorial with 3D micro:bit model, wire paths
- `scene-composer.jsx` — Teacher scene builder (drop-in characters, props, lighting, weather)

**Character & Showcase (2 files):**
- `character-showcase.jsx` — Character viewer with lighting presets, customization, procedural textures
- `rosa-bakery-showcase.jsx` — Atmospheric night scene with custom shader sky, half-timbered building

**Data Layer (2 files):**
- `gallery-migration.sql` — Full Supabase schema: studios, displays, badges, gallery events, reactions, guestbooks, visits, chat, moderation
- `virtual-studio-prototype.jsx` — Student portfolio studio with themes, badge shelf, guestbook, share codes

---

## 4. The 7 Capability Layers

Looking across all 24 files, the vision breaks down into 7 distinct capability layers, each independently valuable:

### Layer 1: Scene Renderer
The foundation. A React Three Fiber engine that can render scenes from JSON configuration (`r3f_instruction`). Two orthogonal dimensions: 5 render presets (Showcase, Designville, Workshop, Tutorial, Print) controlling lighting/materials/camera, and 5 UI container modes (Full-Screen, Embedded, Floating, Modal, PiP) controlling screen placement. All presets share one .glb asset library — one pipeline, five render presets on top. Asset resolution from library. Fallback to primitives when .glb not available. Fallback to 2D when WebGL not available.

**Integration:** Reads `r3f_instruction` JSONB from activity blocks (`render_preset` + `container_mode` fields). No 3D = normal block rendering. 3D = scene rendered with the specified preset in the specified container.

### Layer 2: Asset Library
Centralized repository of 3D models, textures, audio, animations. Categories: characters, environments, props, lighting presets, weather effects, UI elements, audio. Each asset has metadata, LOD variants, fallback primitive config.

**Integration:** Assets referenced by ID in `r3f_instruction` and `sound_instruction`. Teacher-facing browser for scene composition. AI-facing catalog for generation.

### Layer 3: Audio System
Ambience, music with mood transitions, spatial/positional audio, event SFX (pre-recorded + Tone.js synthesis), voice/TTS (ElevenLabs + browser fallback). All configured via `sound_instruction` JSONB.

**Integration:** Plays alongside 3D scenes or independently. Mood changes tied to block events (step completion, quest acceptance, hazard found).

### Layer 4: Tutorial Engine
3 modes: Guided Skill (step-by-step with validation), Safety Scene (hazard identification), Visual Diagram (static renders). Scripted camera, highlight system, annotation overlay, step manager with scoring.

**Integration:** Tutorial blocks are activity blocks with `type: 'tutorial'` and `r3f_instruction.interactions.steps[]`. Completion flows to `student_progress`. Safety tutorials feed into existing Safety Badge system.

### Layer 5: Narrative & Quest System
NPCs with personalities, dialogue trees, quest definitions mapped to Design Cycle phases. World state changes based on quest progress. AI-powered voice NPCs (Claude + ElevenLabs). Cutscene system for key moments.

**Integration:** Quest definitions stored at unit level (`unit_r3f` JSONB). NPCs are characters in `r3f_instruction` with `ai_config`. Quest progress maps to existing page/lesson progression.

### Layer 6: Gallery & Multiplayer
Virtual exhibition spaces. Students display work, visitors walk through. Emoji reactions, guestbooks, chat. Real-time multiplayer via Supabase Presence + Broadcast. Teacher-created gallery events with scheduling and access codes.

**Integration:** Extends existing Class Gallery system (migration 049). Gallery events wrap gallery rounds. Reactions and guestbook entries augment the peer review data model.

### Layer 7: Gamification & Student Identity
Virtual studio (customizable personal space), belt/level system, XP tracking, badge shelf, design replay (time-lapse journey visualization), avatar customization. Share codes for family/visitor access.

**Integration:** Extends existing mentor/theme system (migration 050). Belt levels feed from existing quality signals (criterion scores, toolkit depth, reflections). Virtual studio complements portfolio.

---

## 5. Dimensions3 Integration — The Critical Architecture Decisions

The 3D layer and Dimensions3 must be designed together. Here are the specific touchpoints:

### 5.1 Activity Block Schema Changes

The current Dimensions3 `activity_blocks` schema (Section 6.2) needs 3 new optional JSONB columns:

```sql
-- Add to activity_blocks table (Dimensions3 Phase A migration)
r3f_instruction JSONB,           -- 3D scene configuration (nullable, opt-in)
sound_instruction JSONB,         -- Audio configuration (nullable, opt-in)
scene_asset_ids TEXT[],          -- Precomputed list of asset IDs for preloading
```

**Why JSONB not relational:** The `R3FInstruction` interface has deeply nested, polymorphic structure (scene composition, character arrays with optional AI config, camera scripts, interaction layers with tutorials/hazards/SCAMPER). A relational decomposition would need 10+ tables with sparse columns. JSONB keeps it as one self-contained configuration blob per block — same pattern as `ai_rules`, `scaffolding`, and `assessment_config`.

**Why `scene_asset_ids` as denormalized array:** Preloading strategy needs to scan upcoming blocks for asset dependencies. Extracting IDs from nested JSONB on every page load is expensive. The array is computed on save and updated by a trigger.

### 5.2 Generation Pipeline Impact

Each Dimensions3 stage gains an optional 3D dimension:

| Stage | 3D Impact |
|-------|-----------|
| **Stage 0: Input** | `GenerationRequest.constraints` gets `has_3d: boolean` and `available_3d_assets: string[]` (teacher's asset library). Also `quest_context?: { npc_name, problem_description, setting }` for narrative generation. |
| **Stage 1: Retrieve** | Block retrieval includes `r3f_instruction IS NOT NULL` filter when teacher requests 3D blocks. Embedding search naturally finds relevant 3D tutorial blocks. |
| **Stage 2: Assemble** | Sequence assembly checks scene continuity (don't jump environments mid-lesson without transition). NPC presence consistency (Rosa should appear throughout a Rosa quest). |
| **Stage 3: Gap Fill** | Gap generation can produce `r3f_instruction` for new blocks when context warrants it (e.g., "this lesson needs a safety check — generate a hazard scene"). AI receives the asset library catalog to compose from. |
| **Stage 4: Polish** | Connective tissue includes scene transitions (camera moves, lighting shifts, NPC dialogue bridging). Sound continuity (ambience fades between environments). |
| **Stage 5: Timing** | 3D blocks get time estimates based on mode: tutorial steps × avg time per step, cutscene duration from camera script, embedded scenes add 0 time (visual context only). |
| **Stage 6: Quality** | Pulse scoring gains a "Engagement" sub-dimension for 3D variety (mix of modes, NPC interaction, spatial vs flat activities). |

### 5.3 Asset Library as Retrieval Source

The asset library becomes a retrieval source at Stage 1, alongside the block library. When the pipeline needs to compose a 3D scene, it queries:

1. **Block library** — find existing blocks with matching `r3f_instruction` (reuse proven scenes)
2. **Asset library** — find individual assets (characters, environments, props) for composing new scenes

This means the asset library needs the same embedding + metadata infrastructure as the block library (vector search, category filtering, efficacy scoring for reuse frequency).

### 5.4 FormatProfile Extensions

Each FormatProfile gains optional 3D configuration:

```typescript
interface FormatProfile {
  // ... existing fields ...

  sceneDefaults?: {
    defaultEnvironment: string;     // 'env_workshop' for Design, 'env_community' for Service
    defaultLighting: string;        // 'morning' for most, 'cozy' for Design
    typicalNPCCount: number;        // 1 for focused, 3-5 for community
    questStructure?: string;        // 'linear' | 'branching' | 'open-world'
  };

  sceneRelevance: {
    boost: string[];               // ['tutorial', 'safety'] for Design
    suppress: string[];            // ['multiplayer'] for PP (individual project)
  };
}
```

### 5.5 FrameworkAdapter and 3D

The FrameworkAdapter (neutral criterion keys → framework-specific display) extends to 3D contexts:

- NPC dialogue uses neutral language ("You need to investigate this problem") — never "Criterion A" or "AO1"
- Quest phase names use neutral IDs (`investigate`, `create`, `evaluate`) mapped per framework
- Assessment rubrics in 3D (grading a student's prototype in the gallery) use the same adapter

This is already the Dimensions3 design — 3D just needs to follow it.

---

## 6. The Asset Library — Data Architecture

Based on `asset-library-architecture.md` and `lesson-architecture.md`:

```sql
CREATE TABLE assets (
  id TEXT PRIMARY KEY,                    -- 'char_rosa', 'env_bakery', 'prop_cup'
  category TEXT NOT NULL,                 -- 'character' | 'environment' | 'prop' | 'lighting' |
                                          -- 'weather' | 'effect' | 'ui3d' | 'audio' | 'texture'
  name TEXT NOT NULL,
  description TEXT,

  -- File references
  model_url TEXT,                         -- Supabase Storage URL for .glb/.gltf
  thumbnail_url TEXT,                     -- Preview image

  -- Fallback when no .glb exists
  primitive_config JSONB,                 -- { geometry, material, dimensions, color }

  -- Materials & customization
  material_slots JSONB,                   -- Named slots for color/texture swapping

  -- LOD variants
  lod_variants JSONB,                     -- [{ distance, model_url, triangle_count }]

  -- Performance metadata
  triangle_count INT,
  texture_size_kb INT,

  -- Animations (characters)
  animations JSONB,                       -- { idle: url, talk: url, wave: url, ... }

  -- Audio (for audio category)
  audio_url TEXT,
  audio_duration_ms INT,

  -- Search & discovery
  tags TEXT[],
  embedding halfvec(1024),

  -- Ownership & visibility
  teacher_id UUID REFERENCES auth.users(id),  -- null = system asset
  visibility TEXT DEFAULT 'system',       -- 'system' | 'private' | 'school' | 'public'
  source TEXT,                            -- 'system' | 'kenney' | 'quaternius' | 'custom' | 'ai-generated'
  license TEXT DEFAULT 'cc0',             -- 'cc0' | 'cc-by' | 'proprietary'

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Junction: which assets does a block use?
CREATE TABLE block_assets (
  block_id UUID REFERENCES activity_blocks(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES assets(id),
  role TEXT,                              -- 'character' | 'environment' | 'prop' | 'audio'
  PRIMARY KEY (block_id, asset_id)
);

-- Performance budget tracking
CREATE INDEX idx_assets_category ON assets(category);
CREATE INDEX idx_assets_teacher ON assets(teacher_id);
CREATE INDEX idx_assets_visibility ON assets(visibility);
CREATE INDEX idx_assets_embedding ON assets USING ivfflat (embedding halfvec_cosine_ops);
```

### Performance Budget

Target: 2019 Chromebook @ 30fps minimum.

| Element | Triangles | Max per scene |
|---------|-----------|---------------|
| Character | 500–1,000 | 8 |
| Building interior | 2,000–4,000 | 1 |
| Small prop | 50–200 | 30 |
| Large prop | 500–1,000 | 5 |
| Trees | 300–600 | 15 |
| **Total budget** | **~50,000** | — |

Fallback chain: .glb model → primitive_config (box/sphere/cylinder with material) → 2D sprite → hidden (graceful degradation).

---

## 7. Rendering Architecture — Two Orthogonal Dimensions

The 3D engine has two independent dimensions that combine freely: **render presets** (how a scene is lit, shaded, and rendered) and **UI container modes** (where the scene appears on screen). Any preset can run in any container — a Workshop render preset in an Embedded container, a Tutorial preset in a Full-Screen container, etc. The critical architecture insight: **all five presets share one .glb asset library.** You are not building five engines — you are building one asset pipeline with five render presets on top. The preset just swaps the renderer, materials, and camera behaviour.

### 7A. The 5 Render Presets

*Based on `StudioLoom-3D-Render-Modes-Plan.docx` and `3d-rendering-modes-concept.md`.*

#### Preset 1: Showcase (path-traced, cinematic)
The "wow" mode. Used for marketing, gallery views, finished work display.
- **Use for:** finished prototype gallery, mentor designer hero shots, landing page, marketing screenshots
- **Stack:** R3F + @react-three/lgl path tracer + HDRI environment
- **Camera:** static or slow orbit only
- **Asset needs:** high — proper PBR textures (baseColor, roughness, metalness, normal), real-world scale, clean topology
- **Why:** students see their finished work rendered like a product photo

#### Preset 2: Designville (real-time explorable)
The quest world where students actually live.
- **Use for:** the quest world, walking around, NPC interactions
- **Stack:** R3F + Drei `<Environment>` + Rapier physics + Postprocessing (Bloom, SSAO, Vignette) + fog
- **Camera:** free / third-person, always moving
- **Asset needs:** medium — same .glb models work, but use lower LODs and baked lighting where possible
- **Why:** must hit 60fps on a Chromebook; looks great but not photoreal

#### Preset 3: Workshop (inspection / interaction)
Clean studio lighting around a single object.
- **Use for:** examining a micro:bit, picking up a tool, the AI Mentor pointing at a part
- **Stack:** R3F + HDRI + ContactShadows + GPU picking (Drei `<Select>`)
- **Camera:** orbit controls around a single object on a neutral backdrop
- **Asset needs:** the highest detail version of each .glb — this is where commissioned models earn their keep
- **Why:** the student needs to see the part clearly; clean studio lighting beats cinematic here

#### Preset 4: Tutorial (stylized / diagrammatic)
Photoreal hurts learning here. Diagrammatic styles make steps unambiguous.
- **Use for:** step-by-step guided skills, safety hazard ID, "this is how a soldering iron works"
- **Stack:** R3F + toon shader (Drei `<MeshToonMaterial>`) or flat shading + outline pass + annotation overlays
- **Camera:** scripted, locked to each step
- **Asset needs:** same .glb files, different material override
- **Why:** think exploded views in IKEA instructions — clarity over realism

#### Preset 5: Print (PDF reference cards)
One asset, two outputs: screen and paper.
- **Use for:** printable reference cards, worksheets, classroom posters
- **Stack:** offline render — path tracer running to completion and exporting PNG, or Blender renders from the same .glb sources
- **Camera:** fixed angles per asset (front / three-quarter / exploded)
- **Asset needs:** same source .glb, no real-time constraints
- **Why:** this is why commissioning proper .glb files is so much better value than primitives — every mode reuses them

**Render preset build order:**
1. Workshop first — simplest, immediate win, validates the asset pipeline
2. Designville — the bulk of student time
3. Tutorial — material override on existing assets, cheap to add
4. Showcase — path tracer, gated to "view finished work" so perf isn't critical
5. Print — last; basically a script that loads each .glb and saves PNGs

### 7B. The 5 UI Container Modes

*Based on `3d-rendering-modes-concept.md`. Where the 3D scene lives on screen.*

#### Container 1: Full-Screen Immersion
Entire viewport = 3D scene. React UI floats as overlay (quest journal, dialogue, HUD). Used for quest exploration, gallery exhibition, cutscenes, Open Studio environment.

#### Container 2: Embedded Scene Window
3D scene inside normal page layout (200–400px height). Like an image embed but interactive. Used for lesson landing pages, unit introductions, portfolio entries. Lightweight: 1 character, 1-2 props, ambient lighting.

#### Container 3: Floating 3D Objects
Individual meshes rendered inline via drei `<View>`. Used for badge shelf on profiles, quest markers, prototype previews, animated nav avatars. Under 500 triangles per object, no shadows.

#### Container 4: Modal/Overlay
3D scene in a modal with dimmed/blurred page behind. Used for cutscenes, quest acceptance, achievement unlocks, "meet your client" moments. Cinematic interruption — pause → event → return.

#### Container 5: PiP Companion
Small floating window (120–180px) anchored to screen corner. Shows NPC "watching" student work. Used during active work, AI assistant conversations, journal writing. Character reacts to student actions. Dismissible.

**Container build order:** Container 2 (Embedded) → Container 4 (Modal) → Container 1 (Full-screen) → Container 3 (Floating) → Container 5 (PiP)

### 7C. How Presets and Containers Combine

**Data model:** `r3f_instruction` gains two fields:
- `render_preset`: `'showcase' | 'designville' | 'workshop' | 'tutorial' | 'print'` — selects renderer, materials, and camera behaviour
- `container_mode`: `'fullscreen' | 'embedded' | 'floating' | 'modal' | 'pip'` — selects how the scene is placed on screen

Typical combinations:

| Context | Render Preset | Container |
|---------|---------------|-----------|
| Quest exploration | Designville | Full-Screen |
| Lesson intro scene | Designville | Embedded |
| Examining a tool | Workshop | Modal |
| Step-by-step tutorial | Tutorial | Full-Screen |
| Safety hazard ID | Tutorial | Full-Screen |
| Finished work gallery | Showcase | Full-Screen |
| Badge on profile | Workshop | Floating |
| NPC companion | Designville | PiP |
| Printable reference card | Print | N/A (offline) |
| Achievement unlock | Showcase | Modal |

---

## 8. The Tutorial Engine

Based on `tutorial-system-concept.md`. Three modes that collectively replace most traditional instructional media:

### Mode A: Guided Skill Tutorial
Step-by-step interactive lessons. Camera guides attention, instructions overlay, validation gates each step. Student performs actions in 3D (click targets, drag wires, take measurements).

**Already prototyped:** Caliper measurement (12 steps, 3 measurements, Rosa reacts). PIR sensor wiring (6 steps, 3 wire connections with glow highlights).

**Best for:** Measurement, tool identification, material selection, assembly/disassembly, circuit connections, digital fabrication setup.

### Mode B: Safety Scene (Hazard Identification)
3D workshop/lab with deliberately placed hazards. Students explore freely, click to identify each hazard, answer questions. Scoring, optional timer, NPC reactions.

**Best for:** Workshop safety, lab safety, kitchen hygiene, ergonomic assessment. Feeds directly into existing Safety Badge system.

### Mode C: Visual Step Diagram
3D engine renders annotated step-by-step sequence as static images — like a LEGO instruction manual. Consistent angle/lighting, programmatic annotations, regeneratable for different components.

**Best for:** Electronics connections, assembly instructions, tool setup, material preparation. Exportable as PNG/PDF. Convertible to Mode A by adding interaction.

### What This Replaces
- Annotated photos → Mode C diagrams
- Safety worksheets → Mode B hazard scenes
- How-to handouts → Mode A tutorials
- Circuit diagrams → Mode C 3D wiring
- Measurement exercises → Mode A tool tutorials
- Flowcharts → Mode A Design Cycle walkthrough

### What This Does NOT Replace
Real-world hand skills requiring video: soldering technique, bandsaw operation, sewing, hand sketching, material finishing.

---

## 9. Narrative & Quest System

Based on `design-quest-rpg.jsx`, `design-quest-narrative.jsx`, `cutscene-prototype.jsx`:

### Quest Structure
A quest is a unit-level narrative wrapper. It maps Design Cycle phases to a story:

```
Rosa's Hot Cup Problem
├── Phase 1: Inquire (interview Rosa, measure cups, research materials)
├── Phase 2: Develop (brainstorm solutions, sketch concepts, get feedback)
├── Phase 3: Create (build prototype, test with Rosa, iterate)
└── Phase 4: Evaluate (present to class, Rosa's reaction, reflection)
```

Each phase contains tasks that map 1:1 to existing activity blocks. Quest progress = page/lesson completion. No parallel tracking system.

### NPC System
Characters have:
- Visual appearance (asset library reference)
- Personality (system prompt for Claude)
- Dialogue that evolves based on quest phase (intro → mid → complete)
- Emotional reactions (animations: idle, worried, excited, determined)
- Optional AI-powered voice (ElevenLabs TTS)

The prototypes include 5 characters: Rosa (baker, the primary client NPC), Mr. Okafor (teacher), Auntie Mei (gardener), Tomás (student peer), Mayor Lin (community leader).

### Cutscene System
Scripted camera moves + character animation + dynamic audio for key narrative moments:
- Quest introduction (Rosa explains her problem)
- Phase transitions (world changes — sketches appear on walls, prototype appears on counter)
- Completion celebrations (Rosa thanks the student, town reacts)

Audio uses Tone.js synthesis for mood (ambient pads, emotional SFX, quest chimes) — no external audio files needed for v1.

### World State
The 3D world reflects quest progress:
- Signs appear after research phase
- Sketches pin to workshop walls after ideation
- Prototype appears on Rosa's counter after creation
- Other NPCs change dialogue based on progress

---

## 10. Gallery & Multiplayer

Based on 5 gallery prototypes and `gallery-migration.sql`:

### Virtual Exhibition
Teacher creates a gallery event (tied to class, scheduled, themed room). Students submit work displays (portfolio snapshots with captions). Visitors (classmates, parents, other teachers) walk through a 3D space, viewing work on walls.

### Multiplayer Architecture
- **Supabase Presence:** Who's online, avatar info
- **Supabase Broadcast:** Position updates at 10fps, emoji reactions (ephemeral)
- **Supabase Postgres Changes:** Chat messages, persistent reactions (stored in DB)
- **Rendering:** 60fps local with lerp interpolation of remote positions

Scaling: 1–20 players (single channel) → 50–100 (room sharding) → 100+ (dedicated server, future).

### Interaction Points
- Walk near artwork → detail panel (student name, grade, phase, process journal excerpt)
- Emoji reactions on artwork (floating particles, persistent count)
- Guestbook entries per studio
- Chat with role badges (teacher/student/parent)
- Lobby with avatar customization (name, color, role)

### Relationship to Existing Class Gallery
The current Class Gallery (migration 049, 7 components, effort-gated peer review) becomes the **data layer**. The 3D gallery is a **visual mode** for the same data. Teacher creates a gallery round → students can browse in 2D (existing GalleryBrowser) OR 3D (new multiplayer gallery). Same submissions, same reviews, same effort-gating. The 3D adds spatial exploration and real-time presence.

---

## 11. Gamification & Student Identity

Based on `virtual-studio-prototype.jsx` and `gallery-migration.sql`:

### Virtual Studio
Each student gets a customizable personal space:
- 3 themes (Maker Workshop, White Gallery, Green Studio)
- Badge shelf (3D rendered achievements)
- Project shelf (unit work with phase tags and grades)
- Stats dashboard (projects, belt level, journal entries, XP)
- Guestbook (visitors leave messages)
- Share code for family access

### Belt/Level System
Quality-weighted progression (already specced in CLAUDE.md):
- Criterion scores (primary signal)
- Toolkit depth + safety badges + reflection quality
- Open Studio productivity + NM ratings + portfolio richness
- No public leaderboard (ages 11–16, social comparison anxiety)

### Design Replay
Records student journey as time-lapse walkthrough through the 3D world. Every task timestamped with position. End result: avatar walks through the story of their design process. Perfect for MYP assessment evidence.

---

## 12. Content Moderation Architecture

Based on `lesson-architecture.md` Section 8. Critical for any student-facing 3D system:

### Input Surfaces
Text (chat, guestbook, dialogue), images (uploads, canvas), audio (voice), 3D models (custom uploads), avatar configuration, multiplayer interactions.

### Three-Tier Text Moderation
1. Client-side blocklist (instant)
2. Claude API check (500ms, catches context-dependent content)
3. Pattern detection (regex for personal info, URLs, phone numbers)

### Visual Moderation
- Uploaded images: vision API check before display
- 3D models: multi-angle render → vision API
- Canvas/drawing: periodic screenshot → vision API

### Escalation Flow
Low severity → auto-filter + log → teacher review queue
Medium severity → content hidden + student warned
High severity → content removed + teacher notified immediately
Critical → account restricted + admin alert

---

## 13. Blue-Sky Features (P1–P5)

Organized by priority from `blue-sky-applications.md`:

### P1 — Ship with Core (defines the product)
1. **Voice NPCs** — Claude API responds to student questions in character. ElevenLabs TTS. Character animations sync with audio. Transforms NPCs into AI-powered interview subjects. Latency: 2–4s (stream + partial playback).
2. **AI-Generated Worlds from Student Briefs** — Student types "water bottle for hikers in hot weather" → Claude generates a mountain trail scene with sweating hiker NPC, broken bottle, undrinkable stream. Every student gets a unique world.
3. **3D Design Toolkit** — SCAMPER in 3D (cup morphs as each lens is applied), Six Thinking Hats (environment shifts per hat color), Decision Matrix (pedestals rise/lower with scores), Mind Mapping as 3D constellation, Biomimicry Explorer.
4. **Live Audience Testing** — Exhibition night visitors tap prototypes → contextual feedback form. Responses feed Evaluate phase.

### P2 — After Core Quests
5. **Procedural Problem Generation** — Constraint matrix (user type × context × object × constraint) generates unique briefs with justified NPC backstories. Every student gets a different problem.
6. **Design Replay** — Time-lapse walkthrough of entire student journey. Visual process journal.

### P3 — After User Testing
7. **Emotional AI Adaptation** — World responds to engagement signals (movement speed, dialogue skipping, idle time). Disengaged → NPC runs up. Rushing → slow-down nudge. Stuck → alternative path suggestion.
8. **Digital Twin Prototyping** — Student photographs physical prototype → AI reconstruction → .glb appears in 3D world. Rosa holds the actual student prototype.
9. **Cross-School Shared Worlds** — Schools connected via bridge. Students visit each other's galleries.

### P4 — Investor Demo
10. **WebXR** — Same scenes in VR headset via browser. R3F has first-class WebXR support.

### P5 — R&D
11. **Physical-Digital Craft Bridge** — Computer vision identifies tool pickups, cuts, measurements. Quest journal auto-checks tasks.

---

## 14. Technology Stack Decisions

### React Three Fiber (R3F) + drei
- Declarative 3D in React — components, hooks, state management all familiar
- drei provides utility components (OrbitControls, View, Detailed for LOD, Html for overlays)
- R3F has first-class WebXR support (future P4)
- Same dev tooling as rest of StudioLoom (TypeScript, Next.js, Vercel)

### Three.js (underlying)
- Mature, battle-tested, huge community
- Handles all rendering modes (Canvas, WebGL, WebGPU future)
- Performance profiling tools available

### Tone.js (audio synthesis)
- Procedural sound effects (chimes, confirms, fanfares) without audio files
- Mood-based ambient pads (chord changes per emotional state)
- Spatial audio support
- Browser-compatible, no plugins

### Supabase Realtime (multiplayer)
- Already in stack (no new infrastructure)
- Presence channels for player tracking
- Broadcast for ephemeral position updates (no DB overhead)
- Postgres Changes for persistent data (chat, reactions)

### ElevenLabs (voice, P1 feature)
- High-quality TTS for NPC voices
- Multiple voice presets per character
- Streaming for low-latency playback
- Cost: ~$0.30 per 1K characters

### Asset Sources (phased)
1. **Phase 1:** Custom primitives (free, built in R3F)
2. **Phase 1:** Kenney.nl + Quaternius packs (free, CC0)
3. **Phase 2:** Sketchfab (free–$20 per model)
4. **Phase 3:** Custom Blender via Fiverr ($50–200 per model)
5. **Phase 3:** AI-generated via Meshy/Tripo3D ($10–30/month)
6. **Phase 4:** Student uploads via reconstruction APIs

---

## 15. Build Phases

### Phase 0: Foundation (~3 days)
**Goal:** R3F rendering works in StudioLoom, one block renders a 3D scene.

- Install react-three-fiber, drei, three.js
- `SceneRenderer.tsx` — reads `r3f_instruction` JSONB, resolves `render_preset` + `container_mode`, renders scene
- Workshop render preset first (simplest — HDRI + ContactShadows + orbit camera), validates the shared asset pipeline
- Container 2 (Embedded) only for Phase 0
- 3 primitive assets (box character, flat floor, point light)
- Mount on one test lesson page — if `r3f_instruction` exists on block, render scene
- Verify Chromebook performance (target: 30fps with simple scene)

**Dimensions3 overlap:** Add `r3f_instruction JSONB`, `sound_instruction JSONB`, `scene_asset_ids TEXT[]` to `activity_blocks` schema in Phase A migration.

### Phase 1: Asset Library + Scene Composition (~5 days)
**Goal:** Teachers can compose 3D scenes for their lessons.

- `assets` table + migration + CRUD API
- Seed library: 5 character presets (Rosa, Mr. Okafor, Auntie Mei, Tomás, custom), 3 environments (bakery, workshop, school), basic props (counter, cups, chairs, tools), 5 lighting presets
- `AssetBrowser.tsx` — teacher-facing asset picker (grid view, category filter, search)
- `SceneComposer.tsx` — visual scene builder (select environment, place characters, add props, choose lighting)
- Scene output = `r3f_instruction` JSONB saved to activity block
- Lesson editor integration: "3D Scene" as a new activity type in `ActivityBlockAdd.tsx`

### Phase 2: Audio + Tutorial Engine (~5 days)
**Goal:** Interactive tutorials work, sound enriches all scenes.

- Tone.js integration for synthesized SFX (chimes, confirms, ambient pads)
- `SoundManager.tsx` — reads `sound_instruction`, manages audio lifecycle
- `TutorialEngine.tsx` — step manager, camera director, highlight system, validation
- Mode A (Guided Skill) with caliper measurement as first tutorial
- Mode B (Safety Scene) with workshop hazard identification
- Safety Badge integration — tutorial completion can satisfy badge requirements
- `sound_instruction` on `activity_blocks` schema

### Phase 3: Narrative Layer (~5 days)
**Goal:** NPCs tell stories, quests wrap units.

- NPC dialogue system (dialogue trees, phase-aware evolution)
- Cutscene system (scripted camera + character animation + Tone.js mood)
- Mode 4 (Modal) for cutscenes and quest acceptance
- Quest definition schema on units (`unit_r3f` JSONB)
- World state changes tied to page/lesson completion
- Rosa's Hot Cup Problem as reference implementation (full 4-phase quest)

### Phase 4: Gallery & Multiplayer (~5 days)
**Goal:** Students exhibit work in 3D, visitors walk through.

- 3D gallery renderer (Mode 1, Full-screen)
- Supabase Realtime integration (Presence + Broadcast + Changes)
- `useGalleryMultiplayer` hook
- Lobby with avatar customization
- Artwork display from existing gallery submissions
- Emoji reactions + chat
- Gallery event creation for teachers
- Mobile controls (d-pad + action button)

### Phase 5: Gamification + Polish (~4 days)
**Goal:** Student identity layer, PiP companion, floating badges.

- Virtual studio (customizable space, badge shelf, project display)
- Mode 3 (Floating) for badge shelf + profile avatars
- Mode 5 (PiP) for companion character during work
- Belt/level computation from existing quality signals
- Share codes for family access
- Guestbook system
- Design replay (time-lapse journey visualization)

### Phase 6: AI Features (~5 days, P1 blue-sky)
**Goal:** Voice NPCs, AI-generated worlds, 3D toolkit.

- Claude API integration for NPC dialogue (system prompt per character)
- ElevenLabs TTS for voice output
- AI world generation from student brief text
- SCAMPER in 3D (object morphing per lens)
- Procedural problem generation (constraint matrix → unique NPC + scene)

**Total estimate: ~32 days across 7 phases** (can be parallelized — Phases 2+3 are independent, Phases 4+5 are independent)

---

## 16. Content Authoring Pipeline

Three paths for creating 3D content:

### Teacher-Authored (Phase 1)
Scene Composer UI: select environment → place characters → add props → set lighting → write dialogue → define tutorial steps. Output: `r3f_instruction` JSONB.

### AI-Generated (Phase 6)
Teacher provides brief ("Teach measurement using digital calipers in Rosa's workshop") → Claude generates `r3f_instruction` with scene config, character placement, tutorial steps, camera angles, annotations → teacher reviews/publishes.

For this to work, the AI needs the asset library catalog as context (available characters, environments, props). This is a retrieval problem — same pattern as block retrieval in Dimensions3 Stage 1.

### Community-Shared (Future)
Teachers publish scenes/tutorials to shared library. Others fork/modify. Ratings surface best content. Same pattern as activity block sharing in Dimensions3.

---

## 17. Open Questions

1. **R3F bundle size.** Three.js + R3F + drei adds ~200-300KB gzipped. Is this acceptable for all pages, or should 3D be code-split (lazy-loaded only when a block has `r3f_instruction`)? **Recommendation:** Code-split. Load R3F only when needed.

2. **Asset storage.** Supabase Storage for .glb files works for small scale. At scale (100+ models), consider a CDN with aggressive caching. Supabase Storage has CDN built in — test if sufficient.

3. **Mobile performance.** The prototypes target 2019 Chromebook. Mobile phones (especially older Android) may struggle with WebGL. Need a device detection + quality tier system (high/medium/low/2D-fallback).

4. **WebGL availability.** Some school networks block WebGL or have outdated GPU drivers. The fallback to 2D must be seamless — not an error screen, but a designed alternative experience.

5. **Audio autoplay.** Browsers block audio autoplay without user interaction. All audio must start from a user gesture (click, tap). The cutscene prototype handles this with a "Best with sound on" hint + explicit play button.

6. **Voice NPC cost.** ElevenLabs at $0.30/1K characters. A 5-minute NPC conversation ≈ 500 characters ≈ $0.15. At scale (30 students × 4 NPC interactions per unit), that's ~$18/unit. Acceptable? Budget per student?

7. **Multiplayer moderation at scale.** The gallery chat needs real-time moderation. The three-tier system (blocklist → Claude → pattern) adds latency to every message. Can the blocklist handle 90% of cases with Claude as async flagging?

8. **Art direction ownership.** The prototypes establish a flat-shaded, low-poly, warm-colored art style. Is this the final direction? Should there be a formal art direction document (color palette, character proportions, lighting rules)?

9. **Relationship to Discovery Engine.** The existing Discovery Engine (8 stations, Kit mentor, comic panels) was built pre-3D. Does it get rebuilt as a 3D experience, or does it keep its current 2D comic-strip style?

10. **Relationship to Student Onboarding.** The existing Studio Setup (mentor + theme selection) was built pre-3D. Does the mentor selection become a 3D character picker? Does the theme selection become a virtual studio theme?

---

## 18. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Performance on low-spec devices | High | Chromebook testing from Phase 0. Quality tiers. 2D fallback. Code-splitting. |
| Scope creep (7 layers × 6 phases) | High | Phase 0 proves feasibility before investing in full vision. Each phase delivers independently. |
| Art asset production bottleneck | Medium | Start with primitives. Use CC0 packs (Kenney, Quaternius). AI generation tools improving monthly. |
| Bundle size bloating entire app | Medium | Code-split R3F. Lazy load per block. Tree-shake drei. |
| Multiplayer reliability at scale | Medium | Start single-player gallery. Add multiplayer as enhancement. Supabase Realtime is proven. |
| Teacher adoption ("I just want a normal lesson") | Medium | 3D is always opt-in. No block requires r3f_instruction. The platform works identically without it. |
| ElevenLabs/AI API costs | Low-Medium | Voice NPCs are P1 blue-sky, not foundation. Can launch entire 3D layer without voice. |

---

## 19. What This Doc Does NOT Cover

- Detailed React component architecture (deferred to build phase)
- Shader implementations (covered in prototypes, needs formalization)
- Networking protocol details for multiplayer (covered in `gallery-architecture.jsx`)
- NPC personality prompt engineering (deferred to Phase 3)
- Accessibility for screen readers in 3D contexts (needs research)
- WebXR implementation details (P4, deferred)
- Physical-digital bridge CV pipeline (P5, deferred)

---

## 20. Files Reference

### Source Prototypes (in `questerra/3delements/`)

| File | Lines | Category | Status |
|------|-------|----------|--------|
| `lesson-architecture.md` | ~650 | Architecture | **Key reference — R3F + Sound schemas** |
| `asset-library-architecture.md` | ~350 | Architecture | **Key reference — asset categories + budget** |
| `3d-rendering-modes-concept.md` | ~280 | Architecture | **Key reference — 5 UI container modes** |
| `StudioLoom-3D-Render-Modes-Plan.docx` | — | Architecture | **Key reference — 5 render presets (Showcase/Designville/Workshop/Tutorial/Print), shared .glb pipeline, build order** |
| `tutorial-system-concept.md` | ~300 | Architecture | Key reference — 3 tutorial modes |
| `blue-sky-applications.md` | ~550 | Vision | Feature catalog with priority |
| `design-quest-rpg.jsx` | ~705 | Prototype | 2D RPG world — validates quest mechanics |
| `design-quest-narrative.jsx` | ~823 | Prototype | Deep narrative — validates NPC dialogue evolution |
| `designville-r3f-starter.jsx` | ~815 | Prototype | **Reference 3D implementation** — village, buildings, NPCs |
| `cutscene-prototype.jsx` | ~767 | Prototype | Cinematic system — camera, emotion, Tone.js |
| `discovery-builder.jsx` | ~557 | Prototype | Teacher scene creation wizard |
| `virtual-studio-prototype.jsx` | ~322 | Prototype | Student portfolio studio |
| `lesson-page-3d.jsx` | ~780 | Prototype | Multi-mode block renderer |
| `3d-class-gallery.jsx` | ~670 | Prototype | Third-person gallery walkthrough |
| `class-gallery-prototype.jsx` | ~580 | Prototype | 2D grid gallery (lightweight fallback) |
| `multiplayer-gallery.jsx` | ~900 | Prototype | Full multiplayer with chat + reactions |
| `gallery-architecture.jsx` | ~470 | Architecture | System diagram + scaling notes |
| `rosa-bakery-showcase.jsx` | ~830 | Prototype | Atmospheric scene with custom shaders |
| `character-showcase.jsx` | ~750 | Prototype | Character viewer + lighting presets |
| `measurement-tutorial.jsx` | ~800 | Prototype | Interactive caliper tutorial |
| `pir-microbit-guide.jsx` | ~650 | Prototype | PIR sensor wiring tutorial |
| `scene-composer.jsx` | ~700 | Prototype | Teacher scene builder |
| `gallery-migration.sql` | ~410 | Data layer | Full schema for studios + galleries |
| `useGalleryMultiplayer.ts` | ~280 | Hook | Supabase Realtime multiplayer |
| `files.zip` | — | Archive | Compressed bundle of all files |
| `discovery-3d-journey.jsx` | ~1450 | Prototype | **Full 8-station Discovery in 3D** — procedural low-poly environments, 3D Kit character, all interactions |
| `discovery-3d-journey.html` | ~760 | Prototype | **Standalone browser version** — open directly, no build step |

---

## 21. Asset Production Playbook — From Prototype to Real Models

*Added 7 April 2026 after building the Discovery 3D prototype with procedural geometry. These are the concrete steps to replace box/sphere primitives with real 3D models.*

### Step 1: Lock the Art Direction

Before modelling anything, nail down visual rules that every asset must follow.

- **Polygon budget per scene:** ~50K triangles total (2019 Chromebook @ 30fps). Kit ≈ 1,000 tris. Props ≈ 50–200. Environment ≈ 2,000–4,000.
- **Art style:** Flat-shaded, low-poly, angular. No smooth shading. 24-color curated palette (see `asset-library-architecture.md`). Think Monument Valley / Firewatch / Poly Pizza.
- **Scale standard:** 1 unit = 1 metre. Kit is ~1.6m tall. A chair is 0.45m seat height. Doors are 2m.
- **Lighting:** All models authored with white/neutral albedo — colour comes from scene lighting + material tint, not baked textures. This lets the same model work in warm foyer light and cool workshop light.
- **Decision needed:** Write a formal art direction doc (palette hex values, character proportions, shading rules) before starting production. Pin 3–5 reference images.

### Step 2: Model Kit (the character) in Blender

Kit is the centrepiece — every station features Kit reacting to student choices. Kit needs rigging and expressions, so **GLB is required** (STL won't work for characters).

1. **Model the mesh** — Low-poly humanoid, ~800–1,200 tris. Purple hoodie, dark hair, warm skin tone. Keep the charm of the primitive version but add actual hands, a proper face, and clothing folds.
2. **Rig with armature** — Bones: root → spine → chest → neck → head, plus shoulder → upper arm → forearm → hand (both sides), plus hip → thigh → shin → foot (both sides). IK constraints on arms for pointing gestures.
3. **Add shape keys (morph targets)** for facial expressions:
   - `smile` (default happy)
   - `neutral` (resting)
   - `surprised` (raised brows, open mouth)
   - `thinking` (one brow up, slight frown)
   - `excited` (big smile, wide eyes)
   - `concerned` (brows together, slight frown)
4. **Create 5–6 animations** (NLA strips or separate actions):
   - `idle` — gentle breathing bob + occasional blink (loop, ~2s)
   - `wave` — right arm raises and waves (~1.5s, play once)
   - `celebrate` — both arms up, small jump (~1.5s)
   - `think` — hand to chin, head tilt (~1s)
   - `point` — right arm extends forward (~0.8s)
   - `talk` — subtle hand gestures + head movement (loop, ~3s)
5. **Export as `.glb`** — Include mesh, armature, shape keys, animations. Use Draco compression. Target: < 200KB.
6. **Test in Three.js** — Load with `GLTFLoader`. Call `mixer.clipAction('wave').play()`. Confirm shape keys work via `mesh.morphTargetInfluences[index]`.

### Step 3: Model Static Props (STL is fine here)

Props have no animations or rigs — just geometry. STL works, but GLB is preferred because it carries materials.

**Priority props for Discovery stations:**

| Station | Props Needed | Complexity |
|---------|-------------|------------|
| 0 Foyer | Welcome desk, shelf unit, potted plant, hanging pendant lights, welcome mat | Simple |
| 1 Campfire | Fire pit (stone ring), logs, cushions/stumps, trees, campfire flames | Simple–Medium |
| 2 Workshop | Workbench, vice, pegboard with tools (hammer, saw, ruler), metal shelving, boxes | Medium |
| 3 Gallery | Picture frames (4), display pedestals, bench, spotlight tracks | Simple |
| 4 Window | Window frame with mullions, window seat, bookshelf, community buildings (school, market, clinic, park, houses) | Medium |
| 5 Shelves | 4-tier shelf unit, desk, leather chair, brass lamp, assorted boxes/books | Medium |
| 6 Corridor | 3 doors (distinctive!), stone floor tiles, torch sconces, arch frames | Simple |
| 7 Rooftop | Parapet walls, skyline buildings, water tower, café table, string lights | Medium |

**Workflow for STL props:**
1. Model in Blender / TinkerCAD / Fusion 360.
2. Export as STL.
3. Load in Three.js with `STLLoader` — it returns a `BufferGeometry`.
4. Apply a `MeshStandardMaterial` with flatShading, matching the scene palette.
5. Position + scale in the scene config.

**Workflow for GLB props (preferred):**
1. Model in Blender.
2. Apply simple materials (solid colours, no textures needed for low-poly).
3. Export as GLB with Draco compression.
4. Load with `GLTFLoader` — materials come included.

### Step 4: Build the Asset Loader Utility

Before you have many models, build the code that loads them:

1. **`useAssetLoader` hook** — Takes an asset ID, returns the loaded Three.js object (or null while loading). Caches loaded assets so they're only fetched once. Shows primitive fallback while loading.
2. **`AssetResolver` component** — Given an `r3f_instruction` block, resolves all asset IDs, preloads them, renders the scene when ready.
3. **Convention:** Assets live in `public/assets/3d/` or Supabase Storage. Named by ID: `kit.glb`, `prop_workbench.glb`, `env_campfire_ground.glb`.
4. **Fallback chain:** GLB model → STL model → primitive config (box/sphere/cylinder) → 2D sprite → hidden.

### Step 5: Replace Primitives Incrementally

Don't try to replace everything at once. Start with what has the most visual impact:

1. **Kit first** — the character appears in every station. Biggest bang for effort.
2. **One hero prop per station** — the campfire, the workbench, the three doors. These define each environment's identity.
3. **Environment meshes last** — floors, walls, and ceilings are fine as boxes. They're background.

Each replacement follows the same pattern:
- Swap `new THREE.Mesh(new THREE.BoxGeometry(...), mat('#color'))` for `assetLoader.get('prop_workbench')`.
- Keep the position/rotation/scale from the procedural version.
- Tweak as needed.

### Step 6: Free Asset Packs (Quick Wins)

Before custom modelling, grab CC0 packs that match the low-poly style:

- **Kenney.nl** — `Nature Kit`, `Furniture Kit`, `City Kit`, `Food Kit`. All CC0. Low-poly, clean, consistent style. ~50–300 tris per model. Perfect match.
- **Quaternius** — `Ultimate Nature Pack`, `Animated Characters`. CC0. Slightly higher poly but great quality.
- **Poly Pizza** — curated CC0 models, searchable. Good for one-off props.
- **Sketchfab** — filter by "low poly" + "CC0" or "CC-BY". Mixed quality but huge library.

**Import workflow:** Download GLB → drop in `public/assets/3d/` → reference by filename → adjust material to match palette if needed (override albedo colour).

### Step 7: AI-Generated Models (Experimental)

Tools are improving fast — check current quality before committing:

- **Meshy.ai** — text-to-3D and image-to-3D. Hit or miss for low-poly style. Good for organic shapes.
- **Tripo3D** — better topology than Meshy. Export GLB. May need retopology in Blender.
- **Genie (Luma AI)** — text-to-3D. Higher poly, needs decimation. Good starting point for characters.
- **Rodin (Hyper AI)** — high quality, needs simplification for web.

**Workflow:** Generate → Decimate in Blender (target tri count) → Apply flat shading → Re-colour to palette → Export GLB.

### Step 8: Character Pipeline (for multiple characters beyond Kit)

The Journey Engine spec defines character-neutral journeys. When you need Rosa, Sage, Spark, or designer mentors:

1. Start from Kit's rig as a template (same bone structure, same animation set).
2. Modify the mesh (different hair, clothing, proportions, skin tone).
3. Add character-specific shape keys if they need unique expressions.
4. Export as separate GLBs that share the same animation clip names (`idle`, `wave`, `celebrate`, etc.).
5. The Journey Engine swaps characters by loading a different GLB — same animations, different look.

### Step 9: Performance Testing Checkpoints

After each batch of new assets, verify:

- [ ] Scene renders at 30fps on a 2019 Chromebook (or equivalent: Intel HD 600, 4GB RAM)
- [ ] Total triangle count per scene < 50K
- [ ] Asset file sizes: characters < 200KB, props < 50KB, environments < 500KB (all Draco-compressed GLB)
- [ ] First meaningful paint < 3s on school WiFi (lazy load assets after UI renders)
- [ ] WebGL fallback works gracefully (shows 2D alternative, not error)

### Quick Reference: File Formats

| Format | Use For | Carries | Loader |
|--------|---------|---------|--------|
| **GLB** (preferred) | Everything | Geometry + materials + rig + animations + morph targets | `GLTFLoader` |
| **STL** | Static props only | Geometry only (no materials, no rig) | `STLLoader` + manual material |
| **OBJ** | Legacy import | Geometry + basic materials (via .mtl) | `OBJLoader` — convert to GLB instead |
| **FBX** | Blender workflow | Everything, but larger files | Convert to GLB on export |

**Bottom line:** Use GLB for everything if you can. STL is fine for quick prop imports but you'll apply materials manually every time. For Kit and any character, GLB is non-negotiable.
