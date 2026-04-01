# Graphics — Another World-Style Discovery Engine Animations

**Status:** Planned
**Estimated effort:** ~10-12 days (DIY with Rive)
**Dependencies:** Discovery Engine (complete), Rive editor (free)
**Prototype:** `docs/prototypes/another-world-transitions.html`

## What this is

Cinematic animated transitions between Discovery Engine stations, inspired by Éric Chahi's *Another World* (1991). Flat polygon silhouettes, parallax layered scenes, dramatic lighting, slow camera pans, minimal color palettes. Kit walks through each environment as a silhouette character.

## Why it matters

The current `TransitionScreen` component is functional but static — text card with Kit's dialogue and a "Continue" button. The Discovery Engine is the most immersive part of StudioLoom (full-screen, no nav header, 45-minute journey). Cinematic transitions between stations would make it feel like a real adventure, not a survey with nice backgrounds.

## Visual style

- **Flat polygon silhouettes** — no gradients, no textures, just flat colored shapes (Another World aesthetic)
- **Limited palette per scene** — 4-5 colors max, matching station accent colors
- **Parallax depth** — 5-7 layers sliding at different speeds (sky, far mountains, mid hills, near ground, foreground, characters)
- **Letterbox bars** — widescreen cinematic ratio during transitions
- **CRT scanlines** — subtle retro vector-game feel
- **Particles** — embers (campfire), fireflies (teal/green scenes), dust motes (corridors)
- **Light shafts** — slow diagonal sweeps
- **Kit as silhouette** — flat polygon character with bones rig, walk cycle, 4-5 expression poses

## Tool choice: Rive

Rive chosen over After Effects/Lottie because:
- Purpose-built for interactive web animations
- State machine system handles branching (Kit reacts to archetype data) without code complexity
- React runtime (`@rive-app/react-canvas`) is free and lightweight
- The flat polygon style is one of the easiest to animate in Rive (no gradients, no complex textures)
- Community files available for walk cycles and parallax rigs

**Cost:** $0 out of pocket (Rive editor + runtime both free). Time investment only.

## The 7 transitions

Each transition is a unique scene matching the station-to-station journey:

| # | From → To | Scene | Key elements |
|---|-----------|-------|-------------|
| 0→1 | Identity Card → Campfire | Night mountains | Stars, distant glow on horizon, ember particles |
| 1→2 | Campfire → Workshop | Dawn approach | Workshop building silhouette, lit windows, chimney |
| 2→3 | Workshop → Collection Wall | Teal aurora | Wall structure with pinned items, fireflies |
| 3→4 | Collection Wall → Window | Moonlit city | Moon, distant skyline, large window frame with light |
| 4→5 | Window → Toolkit | Deep forest | Toolkit shelves with objects, fireflies |
| 5→6 | Toolkit → Crossroads | Violet corridor | Three glowing doorway arches, narrowing walls |
| 6→7 | Crossroads → Launchpad | Dawn breaking | Rocket silhouette on platform, ember particles, horizon glow |

## Reusable assets

- **Kit character rig** — 1 rig, reused across all 7 transitions + potential station backgrounds
- **Parallax layer system** — same structure (sky/far/mid/near/ground/characters/foreground), different content
- **Particle systems** — 3 types (embers, fireflies, dust), reusable
- **Light shaft effect** — same in all scenes, different color
- **State machine template** — `Enter → Pan → Arrive → Idle` shared across all transitions

## Phases

### Phase 1: Learn Rive (~1 day)
- Complete Rive "Learn Rive" crash course (~2 hours)
- Study community parallax and walk cycle files
- Build a throwaway test: rectangle with bones, basic walk
- **Done when:** Can create a rigged character with state machine in Rive

### Phase 2: Kit character rig (~1 day)
- Build Kit as flat polygon shapes in Rive editor
- Add skeleton: 6 bones (2 legs, 2 arms, torso, head)
- Create 3 animations: idle breathing, walk cycle (~8 frames), stop/look-up
- Export as `kit.riv`
- **Done when:** Kit walks and stops smoothly in Rive preview

### Phase 3: First scene — Campfire (~1 day)
- Build the 0→1 transition scene in Rive
- 5-7 parallax layers as groups
- Campfire glow as looping animation
- Ember particle system
- Wire Kit rig as nested artboard
- State machine: `Enter → FadeIn → Pan → Arrive → ShowDialogue → Idle`
- **Done when:** Full campfire transition plays in Rive preview with Kit walking, parallax, and particles

### Phase 4: React integration (~0.5 days)
- `npm install @rive-app/react-canvas`
- Replace `TransitionScreen` component with Rive player
- Pass state machine inputs: station index, accent color, Kit's dialogue text
- Wire `onStateChange` callback to trigger `onContinue` when animation reaches `Idle`
- Test with campfire transition in Discovery Engine
- **Done when:** Campfire transition plays in the live Discovery Engine, advances correctly

### Phase 5: Remaining 6 scenes (~3 days)
- Build 6 more `.riv` files following the campfire template
- Same state machine, same Kit rig, different environment art + particles
- ~0.5 days per scene (draw in Figma → import SVGs → animate in Rive)
- **Done when:** All 7 transitions play in Discovery Engine

### Phase 6: Station background animations (~2 days)
- Ambient animated backgrounds for each station (not just transitions)
- Campfire flickering, workshop tools moving, collection wall items shifting
- Replace current `StationBackground` CSS gradients with Rive canvases
- **Done when:** Every station has subtle animated background

### Phase 7: Interactive branching (~1-2 days)
- Kit's body language changes based on archetype scores from DiscoveryProfile
- Maker archetype → Kit gestures at tools
- Researcher archetype → Kit looks thoughtful
- Pass archetype data as Rive state machine inputs
- **Done when:** Kit reacts differently based on student profile

## Technical integration

### File structure
```
public/discovery/rive/
  kit.riv                    # Character rig (nested in all scenes)
  transition-campfire.riv    # 0→1
  transition-workshop.riv    # 1→2
  transition-collection.riv  # 2→3
  transition-window.riv      # 3→4
  transition-toolkit.riv     # 4→5
  transition-crossroads.riv  # 5→6
  transition-launchpad.riv   # 6→7
  bg-campfire.riv           # Station 1 ambient (Phase 6)
  bg-workshop.riv           # Station 2 ambient (Phase 6)
  ...
```

### React component
```tsx
// CinematicTransition.tsx — replaces TransitionScreen
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';

const TRANSITION_FILES: Record<string, string> = {
  '0_1': '/discovery/rive/transition-campfire.riv',
  '1_2': '/discovery/rive/transition-workshop.riv',
  // ...
};

export function CinematicTransition({ fromStation, toStation, kitLine, onContinue }) {
  const transitionKey = `${fromStation}_${toStation}`;
  const { rive, RiveComponent } = useRive({
    src: TRANSITION_FILES[transitionKey],
    stateMachines: 'main',
    autoplay: true,
    onStateChange: (event) => {
      if (event.data?.includes('idle')) {
        // Animation finished — show continue prompt
      }
    },
  });

  return (
    <div className="fixed inset-0">
      <RiveComponent className="w-full h-full" />
      {/* Kit's dialogue overlaid */}
      {/* Continue prompt */}
    </div>
  );
}
```

### State machine inputs (per .riv file)
- `stationIndex` (number) — for color theming
- `archetypeId` (number) — for Kit's reactive poses (Phase 7)
- `trigger_start` (trigger) — begins the pan sequence

## Design tips (from prototype)

The HTML prototype at `docs/prototypes/another-world-transitions.html` is the storyboard. Use it as reference for:
- Scene composition (which layers, what shapes, where Kit starts/ends)
- Color palettes per transition (gradient stops, accent colors)
- Timing (fade 1.2s, pan 6s, dialogue appears at 3s, continue at 5.5s)
- Particle density and behavior per scene type

**Key Another World principle:** restraint. Limited palette, slow pacing, negative space, environmental storytelling. The scenes should feel empty and vast, not busy.

## Decision: draw in Figma, animate in Rive
Don't draw in Rive's editor — it's functional but slow. Draw flat polygon shapes in Figma (or trace from sketches), export as SVG, import into Rive. Rive is for animating, not illustrating.

---

## Image Generation (Static Assets)

Full prompt spec: `docs/specs/discovery-engine-image-prompts.md`

### Style anchor (prepend to every prompt)

> **Style: Another World / Out of This World by Éric Chahi. Flat color polygons, no outlines, no gradients within shapes — each surface is a single bold color block. Dramatic cinematic lighting with sharp contrast between lit and shadow sides. Minimal detail — forms are built from clean geometric color shapes. Warm palette: ambers, browns, burnt orange, teal accents. Sharp angular light rays cutting across the scene. Rotoscope-inspired proportions — realistic but simplified. The beauty is in bold composition and color choices, not in detail. NOT: watercolor, painterly, photorealistic, cartoon, pixel art, soft edges, smooth gradients, anime.**

### Consistency protocol
1. Generate Kit FIRST — he's the style anchor (already done: `images/a_mentor_character_image.jpeg`)
2. Start every AI session with "Match the exact style of this image" + attach Kit
3. Stay in ONE conversation thread for the whole batch
4. Save successful prompts — reuse exact wording for variants
5. When results drift too detailed or smooth, say "more geometric, flatter color blocks, fewer details"
6. Export as WebP or PNG, max 1920px wide, target <200KB each

### Generation status

**DONE — 32 images in `public/discovery/`:**

| Batch | Images | Status |
|-------|--------|--------|
| Kit expressions (4) | encouraging.png, excited.png, gentle.png, thinking.png | ✅ Done |
| Station backgrounds (8×2) | s0-foyer through s7-launchpad (PNG + WebP) | ✅ Done |
| Tool icons (12) | hammer, ruler, paintbrush, laptop, camera, microscope, pencil, microphone, lightning, puzzle, chart, seedling | ✅ Done |

**TODO — 20 images remaining:**

| Batch | Count | Images needed |
|-------|-------|---------------|
| Desk items (Batch 4) | 12 | potted plant, headphones, books, sticky notes, scale model, monitor, sketchbook, coffee mug, toolkit roll, trophy, clock, pet rock |
| Community scene (Batch 5) | 1 | Bird's-eye school/neighbourhood for S4 |
| Fear cards (Batch 6) | 5 | "I'll pick the wrong thing", "I'm not creative enough", "What if nobody cares?", "It's too big for me", "I'll start and not finish" |
| Grand Reveal (Batch 7) | 1 | Rooftop completion scene |
| Studio door entry (Batch 7) | 1 | Welcome/loading screen |

### All prompts (for quick reference)

#### Batch 4: Desk Items (1:1 square, warm amber background)

**D1. Potted plant**
> [STYLE ANCHOR] A monstera plant in a ceramic pot. 1:1 square. Flat color polygon style — pot as geometric shape in cream/white, large monstera leaves as bold green angular shapes with characteristic holes rendered as darker green polygons. One sharp shadow. Warm amber background.

**D2. Headphones**
> [STYLE ANCHOR] Over-ear headphones. 1:1 square. Flat color polygon style — headband as a curved geometric shape, ear cups as bold circles/ovals in warm brown and cream. One sharp shadow. Warm amber background.

**D3. Stack of books**
> [STYLE ANCHOR] A stack of 3-4 books. 1:1 square. Flat color polygon style — each book is a simple rectangle with a distinct bold color spine (teal, burgundy, amber, indigo). One book slightly angled. One sharp shadow. Warm amber background.

**D4. Sticky note wall**
> [STYLE ANCHOR] A small corkboard with sticky notes. 1:1 square. Flat color polygon style — board as a brown rectangle, 6-8 small square shapes in yellow, pink, blue, green stuck to it at slight angles. One sharp shadow. Warm amber background.

**D5. Scale model**
> [STYLE ANCHOR] A small architectural model. 1:1 square. Flat color polygon style — a miniature building or chair built from tiny geometric shapes in cream, brown, and gray. Sits on a small base. One sharp shadow. Warm amber background.

**D6. Monitor/tablet**
> [STYLE ANCHOR] A small tablet or monitor screen. 1:1 square. Flat color polygon style — screen rectangle with thin dark bezels, displaying colorful geometric shapes (design work). Small stand shape. Screen glows softly. One sharp shadow. Warm amber background.

**D7. Sketchbook**
> [STYLE ANCHOR] An open sketchbook. 1:1 square. Flat color polygon style — two page rectangles in cream/white, with loose sketch-like shapes on the pages (small geometric doodles suggesting product designs). A pencil shape lying across. One sharp shadow. Warm amber background.

**D8. Coffee mug**
> [STYLE ANCHOR] A coffee mug with steam. 1:1 square. Flat color polygon style — mug as a geometric shape in warm cream/brown, small angular steam wisps rising. One sharp shadow. Warm amber background.

**D9. Toolkit roll**
> [STYLE ANCHOR] A fabric tool roll, partially open. 1:1 square. Flat color polygon style — canvas-colored rectangle shape with a few tool shapes (screwdriver, pliers) poking out in steel gray and warm brown. One sharp shadow. Warm amber background.

**D10. Trophy**
> [STYLE ANCHOR] A modern design award trophy. 1:1 square. Flat color polygon style — geometric abstract trophy shape (angular, not a traditional cup) in gold and dark wood. Clean, modern. One sharp shadow. Warm amber background.

**D11. Clock**
> [STYLE ANCHOR] An analog desk clock. 1:1 square. Flat color polygon style — circular clock face in cream with bold geometric hour markers, brass/copper case rendered as angular shapes. One sharp shadow. Warm amber background.

**D12. Pet rock**
> [STYLE ANCHOR] A smooth stone with a painted face. 1:1 square. Flat color polygon style — oval stone shape in warm gray, two dot eyes and a small smile in dark color. Maybe a tiny geometric hat shape on top. Charming. One sharp shadow. Warm amber background.

#### Batch 5: Community Scene (4:3 landscape)

**CS1. Community scene**
> [STYLE ANCHOR] A bird's-eye-view of a school and neighborhood. 4:3 landscape (wider than tall). Flat color polygon style — buildings as geometric rectangles in varied warm colors, trees as green triangles/circles, roads as gray strips, a playground, a park with paths, small shops, houses, a bus stop rectangle. Tiny geometric people shapes (5-6 color blocks each). Some subtle "problems" — a gap in a fence, an empty park bench shape, a queue at the bus stop. Late afternoon golden light casting long geometric shadows from buildings. Large enough to identify and click different areas.

#### Batch 6: Fear Cards (3:4 portrait)

**FC1. "I'll pick the wrong thing"**
> [STYLE ANCHOR] A lone figure silhouette standing where a path forks into two directions. 3:4 portrait. Flat color polygon style. Both paths are rendered in warm, inviting colors — neither looks wrong. The figure is small, centered at the fork. Sharp angular light from above. The tension is in the symmetry — two equally good options. Warm amber and teal color blocks. Not dark or scary.

**FC2. "I'm not creative enough"**
> [STYLE ANCHOR] A blank canvas on an easel in a studio. 3:4 portrait. Flat color polygon style. The canvas is a large white rectangle — the brightest element. An empty chair pulled back (someone just left). Art supplies as small geometric shapes on a table. Sharp angular warm light streaming in from a window. The emptiness of the canvas is the story. Warm amber, cream, brown tones.

**FC3. "What if nobody cares?"**
> [STYLE ANCHOR] A small geometric object (a handmade model or prototype) sitting alone on a large empty table. 3:4 portrait. Flat color polygon style. A single sharp spotlight cone illuminating just the object. The vast dark space around it creates the emotional weight. The object itself is beautiful — warm colors, careful shapes. Contemplative, not depressing. Deep purple-brown shadows, warm amber spotlight.

**FC4. "It's too big for me"**
> [STYLE ANCHOR] A small figure silhouette at the base of an enormous staircase that spirals upward. 3:4 portrait. Flat color polygon style. Each step is a different color block (amber, teal, burgundy, cream). The staircase fills most of the frame, disappearing into warm golden light at the top. The figure is tiny at the bottom. The staircase is inviting (warm colors, golden light above) but vast. Not intimidating — awe-inspiring.

**FC5. "I'll start and not finish"**
> [STYLE ANCHOR] A shelf with several half-finished projects. 3:4 portrait. Flat color polygon style. On the shelf: a partially carved geometric sculpture shape, a half-painted canvas (half color, half blank), a half-built model. Each is clearly beautiful work — good colors, intentional shapes. Warm golden afternoon light from the side. The mood is bittersweet, not hopeless. Warm amber, brown, touches of teal and burgundy.

#### Batch 7: Grand Reveal + Studio Entry

**GR1. Grand Reveal (16:9 landscape)**
> [STYLE ANCHOR] A rooftop at the moment after sunset. 16:9 landscape. Flat color polygon style. Sky as bold horizontal color bands — deep pink, warm gold, purple, transitioning to deep blue at the top. City skyline as dark geometric building silhouettes with a few small glowing window rectangles. String lights as small warm circles. A large easel/board on the terrace displaying an abstract geometric design that glows with warm inner light (the brightest element). Everything says "you did something meaningful." The most beautiful image in the set. Celebratory but warm — NOT confetti. Golden warmth, accomplishment.

**SE1. Studio door entry (16:9 landscape)**
> [STYLE ANCHOR] The exterior of a design studio door. 16:9 landscape. Flat color polygon style. A large wooden door rectangle in warm brown, slightly ajar — warm golden light pouring out through the gap as sharp angular rays. A small sign shape that says "Design Studio." Geometric potted plants flanking the entrance. The exterior is in cooler tones (blue-gray, teal) while the light from inside is warm amber-gold. The contrast between cool outside and warm inside creates the invitation. The feeling of being about to enter somewhere special.

### File naming convention

Save generated images to `public/discovery/` using these names:
- Desk items: `desk-plant.png`, `desk-headphones.png`, `desk-books.png`, `desk-stickies.png`, `desk-model.png`, `desk-monitor.png`, `desk-sketchbook.png`, `desk-mug.png`, `desk-toolkit.png`, `desk-trophy.png`, `desk-clock.png`, `desk-petrock.png`
- Community: `community-scene.png`
- Fear cards: `fear-wrong-choice.png`, `fear-not-creative.png`, `fear-nobody-cares.png`, `fear-too-big.png`, `fear-wont-finish.png`
- Grand reveal: `grand-reveal.png`
- Studio entry: `studio-entry.png`

### Recommended generation order
1. Fear cards (FC1-FC5) — most emotionally important, need quality time
2. Desk items (D1-D12) — straightforward, batch quickly
3. Community scene (CS1) — complex composition, do when warmed up
4. Grand Reveal (GR1) — save the best for last
5. Studio entry (SE1) — last
