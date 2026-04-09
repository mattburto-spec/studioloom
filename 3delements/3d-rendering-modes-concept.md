# Loominary — 3D Rendering Modes
## How 3D Lives Across the Platform

**Date:** April 2026  
**Status:** Concept / Architecture Planning  
**Engine:** React Three Fiber (R3F) + drei  

---

## Core Principle

The 3D world is not a separate "game mode" — it's woven through the entire platform. Students should feel like Designville is always present, and full immersion is just stepping deeper into a world that's already around them.

---

## The Five Rendering Modes

### 1. Full-Screen Immersion

**What:** The 3D scene takes over the entire viewport. React UI components (dialogue boxes, quest journal, chat, AI assistant) float as overlays on top of the canvas.

**When to use:**
- Quest World (Designville exploration)
- Gallery Exhibition (multiplayer walkthrough)
- Cutscenes (cinematic quest discovery)
- Open Studio mode (earned self-directed working space)

**Technical:** `<Canvas>` fills the viewport. UI rendered as absolutely positioned React components above the canvas. Letterbox bars for cinematic mode.

**Examples built:** Designville RPG, Multiplayer Gallery, Rosa Cutscene

---

### 2. Embedded Scene Window

**What:** A contained 3D scene rendered inside a normal page layout, like an image or video embed. The scene sits within the content flow — scroll past it, read around it.

**When to use:**
- Lesson landing pages (show the NPC and their problem)
- Unit introduction (the workshop/setting where this project takes place)
- Assignment context (see what you're designing for)
- Student portfolio entries (interactive 3D view of their work)

**Technical:** `<Canvas>` with fixed height (200–400px) inside a normal React layout. Camera can be static, slowly orbiting, or user-controllable (drag to rotate). Scene is lightweight — one character, one prop, ambient lighting.

**Key detail:** The embedded scene should feel like a window into the quest world, not a separate thing. Same visual style, same characters, same lighting.

---

### 3. Floating 3D Objects

**What:** Individual 3D meshes rendered inline within HTML content using drei's `<View>` component. No full scene — just a single object floating on the page.

**When to use:**
- Badge shelf on student profile (3D trophies/icons)
- Quest marker next to incomplete assignments
- Spinning prototype preview on portfolio cards
- XP/level indicator as a 3D element
- Animated character avatar in the nav bar or sidebar

**Technical:** drei's `<View>` creates a portal that renders a subset of the 3D scene into any DOM element. Multiple Views can share one Canvas for performance. Each View is like a mini-viewport.

```jsx
<View style={{ width: 60, height: 60 }}>
  <Badge type="artisan-belt" spinning />
</View>
```

**Performance note:** Keep these extremely simple — one or two meshes, no shadows, no post-processing. They should feel like enhanced icons, not scenes.

---

### 4. Modal / Overlay

**What:** A 3D scene that opens as a modal layer on top of the current page. The page behind is dimmed/blurred. Used for moments of narrative or celebration.

**When to use:**
- Discovery cutscene when starting a new unit
- Quest acceptance moment
- Phase completion celebration
- Achievement unlocked animation
- "Meet your client" introduction before a project begins

**Technical:** A React modal component containing a `<Canvas>`. The modal handles enter/exit animation (fade, slide up). The 3D scene inside handles its own camera movement and character animation.

**UX detail:** Should feel like a cinematic interruption — the student's normal workflow pauses, something meaningful happens, then they return to their work with new context.

---

### 5. Picture-in-Picture Companion

**What:** A small floating 3D window (120–180px) anchored to a corner of the screen. Shows the NPC "watching" while the student works. Reacts to student actions.

**When to use:**
- During active quest work (Rosa watches as you design her sleeve)
- AI assistant visual companion (the character responds alongside Claude)
- Process journal writing (NPC encouraging reflection)

**Technical:** Fixed-position `<Canvas>` with a small viewport. Character mesh with idle animation. Event-driven reactions: student completes a task → character does a thumbs up animation. Student opens AI chat → character leans in curiously.

**Key design decision:** This should be dismissible and never block content. Think of it as an ambient companion, not a permanent fixture. Some students will love it; others will close it immediately. Both are fine.

---

## Shared Component Library

All five modes draw from the same component pool:

| Component | Description | Used In |
|-----------|-------------|---------|
| `<Avatar>` | Player/NPC character mesh with animation states | All modes |
| `<NameTag>` | Floating text label above characters | Immersive, Embedded |
| `<QuestMarker>` | Bouncing indicator (!, ?, →) | Immersive, Floating |
| `<DialogueBox>` | React overlay for NPC speech | Immersive, Modal, PiP |
| `<Building>` | Modular building with variants | Immersive, Embedded |
| `<ArtworkFrame>` | Gallery display with texture loading | Immersive (Gallery) |
| `<ChatBubble>` | Floating speech bubble in 3D | Immersive (Multiplayer) |
| `<Badge3D>` | Rotating achievement badge | Floating, Embedded |
| `<ParticleSystem>` | Sparks, fireflies, confetti, etc. | Immersive, Modal |

---

## Performance Strategy

**School Chromebooks are the constraint.** Every rendering mode must work on a 2019 Chromebook with integrated graphics.

- **Immersive:** Cap at ~50k triangles, 4–6 lights max, no post-processing, shadow maps at 1024. Target 30fps minimum.
- **Embedded:** Under 10k triangles. 2 lights. No shadows. Target 60fps.
- **Floating:** Under 500 triangles per object. No lights (use MeshBasicMaterial or emissive). Practically free.
- **Modal:** Same budget as Embedded, plus particle effects budget of ~200 particles.
- **PiP:** Under 2k triangles. 1 light. No shadows. Must not impact main page performance.

**Fallback:** If WebGL is unavailable or performance is too low, fall back to 2D illustrations/sprites. The quest system, dialogue, and game mechanics work identically without 3D — only the visual layer changes.

---

## Data Flow

```
Supabase (discoveries table)
    ↓
Teacher creates discovery via Discovery Builder
    ↓
JSON stored: { setting, character, dialogue[], quest{ phases{} } }
    ↓
Student opens unit → Lesson page loads
    ↓
Embedded scene shows NPC + setting (Mode 2)
    ↓
Student clicks "Begin Discovery" → Modal cutscene plays (Mode 4)
    ↓
Quest accepted → Full quest world available (Mode 1)
    ↓
During work → PiP companion optional (Mode 5)
    ↓
Badges earned → Floating 3D on profile (Mode 3)
    ↓
Exhibition Night → Full gallery (Mode 1, multiplayer)
```

---

## Integration with Existing StudioLoom

The 3D layer wraps around — it never replaces — the existing platform functionality:

- **Kanban/Gantt planner** stays as-is. Quest tasks map 1:1 to planner cards.
- **AI assistant** stays as-is. The NPC companion is a visual layer on top of the existing AI chat.
- **Portfolio** gains 3D badge shelf and optional Virtual Studio.
- **Report Writer / Marking Comment Creator** (free tools) are unaffected.
- **Teacher Dashboard** gains the Discovery Builder as a new tool.

The 3D world is opt-in for teachers. A teacher who doesn't want to create discoveries can still assign projects the traditional way. The system degrades gracefully — no 3D, the platform still works perfectly.

---

## Implementation Priority

1. **Embedded Scene Window** — lowest risk, highest everyday value. Every lesson page gets a visual anchor.
2. **Modal Cutscene** — the discovery engine. This is the differentiator.
3. **Full-Screen Quest World** — the flagship experience. Requires the most content (maps, NPCs, dialogue).
4. **Floating 3D Objects** — polish layer. Badges, markers, avatars throughout the UI.
5. **PiP Companion** — experimental. Build after validating that students engage with the NPC relationship.

---

## Open Questions

- Should students be able to customize their avatar, or is it assigned?
- Do we support multiple NPCs per discovery, or start with one?
- How do we handle the transition between embedded and full-screen gracefully?
- What's the minimum viable tileset/asset pack for launch?
- Do we build a map editor for teachers, or curate preset environments?
