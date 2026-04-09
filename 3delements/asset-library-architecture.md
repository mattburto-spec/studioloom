# Loominary — 3D Asset Library Architecture
## Reusable Components for Consistent World-Building

**Date:** April 2026  
**Status:** Concept / Architecture Planning  
**Engine:** React Three Fiber (R3F) + drei  

---

## Core Principle

Every 3D element in Loominary — characters, buildings, props, lighting, weather, particle effects — lives in a shared library. Teachers compose scenes by selecting from the library. Students experience a visually consistent world because everything draws from the same pool.

---

## Library Structure

```
/lib/3d/
├── characters/
│   ├── Avatar.tsx          ← base character (customizable color, outfit, accessories)
│   ├── presets/
│   │   ├── baker.tsx       ← Rosa config (apron, chef hat, skin tone)
│   │   ├── teacher.tsx     ← Mr. Okafor config
│   │   ├── elder.tsx       ← Auntie Mei config
│   │   ├── child.tsx       ← Tomás config
│   │   └── custom.tsx      ← teacher-defined characters
│   ├── animations/
│   │   ├── idle.ts         ← breathing, subtle sway
│   │   ├── talk.ts         ← mouth movement, gestures
│   │   ├── wave.ts         ← greeting
│   │   ├── worried.ts      ← hands together, head down
│   │   ├── excited.ts      ← arms up, bouncing
│   │   └── point.ts        ← directing attention
│   └── accessories/
│       ├── hat-chef.tsx
│       ├── apron.tsx
│       ├── headband.tsx
│       ├── tool-belt.tsx
│       ├── notebook.tsx
│       └── glasses.tsx
│
├── environments/
│   ├── scenes/
│   │   ├── BakeryInterior.tsx
│   │   ├── SchoolLibrary.tsx
│   │   ├── Workshop.tsx
│   │   ├── Garden.tsx
│   │   ├── Marketplace.tsx
│   │   ├── Village.tsx         ← full Designville overworld
│   │   └── GalleryHall.tsx     ← exhibition space
│   ├── terrain/
│   │   ├── GrassFloor.tsx
│   │   ├── WoodFloor.tsx
│   │   ├── CobblestoneFloor.tsx
│   │   ├── TileFloor.tsx
│   │   └── SandFloor.tsx
│   └── walls/
│       ├── PlasterWall.tsx
│       ├── BrickWall.tsx
│       ├── WoodPanelWall.tsx
│       └── StoneWall.tsx
│
├── lighting/
│   ├── presets/
│   │   ├── morning.ts      ← warm golden, long shadows
│   │   ├── afternoon.ts    ← bright neutral, short shadows
│   │   ├── evening.ts      ← warm amber, orange tones
│   │   ├── night.ts        ← cool blue moonlight + point lights
│   │   ├── cozy.ts         ← warm interior, firelight
│   │   ├── dramatic.ts     ← strong key light, deep shadows
│   │   └── studio.ts       ← even, flattering (for gallery)
│   └── LightingPreset.tsx   ← component that applies any preset
│
├── weather/
│   ├── Rain.tsx             ← particle rain + puddle reflections
│   ├── Snow.tsx             ← falling snow particles
│   ├── Fog.tsx              ← volumetric fog density control
│   ├── Sunshine.tsx         ← god rays, lens flare
│   ├── Overcast.tsx         ← flat lighting, grey sky
│   ├── Fireflies.tsx        ← evening ambient particles
│   ├── DustMotes.tsx        ← indoor floating particles
│   ├── Leaves.tsx           ← autumn falling leaves
│   └── Smoke.tsx            ← chimney / cooking smoke
│
├── props/
│   ├── furniture/
│   │   ├── Table.tsx
│   │   ├── Chair.tsx
│   │   ├── Bench.tsx
│   │   ├── Counter.tsx
│   │   ├── Shelf.tsx
│   │   └── Stool.tsx
│   ├── objects/
│   │   ├── Cup.tsx
│   │   ├── Book.tsx
│   │   ├── Pencil.tsx
│   │   ├── Ruler.tsx
│   │   ├── Prototype.tsx    ← generic "student work" object
│   │   ├── Poster.tsx       ← flat display surface
│   │   └── Plant.tsx
│   ├── structures/
│   │   ├── Tree.tsx         ← configurable: pine, oak, palm
│   │   ├── Fence.tsx
│   │   ├── Lantern.tsx
│   │   ├── Fountain.tsx
│   │   ├── Well.tsx
│   │   ├── Bridge.tsx
│   │   └── Sign.tsx         ← text configurable
│   ├── tools/
│   │   ├── Anvil.tsx
│   │   ├── Forge.tsx
│   │   ├── Workbench.tsx
│   │   ├── SewingMachine.tsx
│   │   └── Easel.tsx
│   └── food/
│       ├── BreadLoaf.tsx
│       ├── CoffeeCup.tsx
│       ├── Cake.tsx
│       └── Vegetables.tsx
│
├── effects/
│   ├── QuestMarker.tsx      ← bouncing !, ?, → indicators
│   ├── Sparkle.tsx          ← achievement unlock burst
│   ├── Confetti.tsx         ← celebration
│   ├── GlowOrb.tsx          ← ambient floating light
│   └── TrailEffect.tsx      ← movement trail behind player
│
├── ui3d/
│   ├── NameTag.tsx          ← floating label above characters
│   ├── ChatBubble.tsx       ← speech bubble in 3D space
│   ├── HealthBar.tsx        ← or XP bar above character
│   ├── ArtworkFrame.tsx     ← gallery display with texture
│   └── Billboard.tsx        ← always-face-camera text/image
│
└── audio/
    ├── ambience/
    │   ├── village.ts       ← birds, wind, distant voices
    │   ├── bakery.ts        ← oven crackle, utensils, chatter
    │   ├── workshop.ts      ← hammering, fire, tools
    │   ├── garden.ts        ← birds, water, rustling
    │   └── night.ts         ← crickets, owl, silence
    ├── music/
    │   ├── exploration.ts   ← gentle loop
    │   ├── tension.ts       ← problem revealed
    │   ├── hopeful.ts       ← quest accepted
    │   └── triumph.ts       ← quest complete
    └── sfx/
        ├── dialogue-advance.ts
        ├── quest-accept.ts
        ├── task-complete.ts
        ├── footstep.ts
        └── door-open.ts
```

---

## How Components Are Called

Every library component is a standard React component with typed props:

```tsx
// Characters are configured via props, not separate files
<Avatar
  preset="baker"
  name="Rosa"
  skinTone="#e8a87c"
  outfit="apron"
  accessories={["chef-hat"]}
  animation="idle"
  position={[-3, 0, -2]}
/>

// Scenes compose from library pieces
<BakeryInterior>
  <Counter position={[-2, 0, -1]} />
  <CoffeeCup position={[-2.5, 0.9, -1]} />
  <CoffeeCup position={[-2, 0.9, -1.2]} />
  <Forge position={[-4, 0, -2]} intensity={0.8} />
  <Lantern position={[0, 3, 0]} flicker={true} />
</BakeryInterior>

// Lighting and weather are one-line additions
<LightingPreset preset="evening" />
<Fireflies count={20} area={[10, 10]} />
<Smoke origin={[-4, 3, -2]} density={0.3} />

// Audio matches the scene
<AmbienceLayer preset="bakery" volume={0.3} />
<MusicLayer track="exploration" volume={0.2} />
```

---

## Scene Composition (Teacher View)

The Discovery Builder composes a scene from library selections:

```json
{
  "scene": {
    "environment": "bakery-interior",
    "floor": "wood",
    "walls": "plaster",
    "lighting": "evening",
    "weather": ["fireflies", "smoke"],
    "ambience": "bakery",
    "music": "exploration"
  },
  "character": {
    "preset": "baker",
    "name": "Rosa",
    "skinTone": "#e8a87c",
    "accessories": ["chef-hat", "apron"],
    "position": [-3, 0, -2]
  },
  "props": [
    { "type": "counter", "position": [-2, 0, -1] },
    { "type": "coffee-cup", "position": [-2.5, 0.9, -1], "count": 4 },
    { "type": "forge", "position": [-4, 0, -2] },
    { "type": "lantern", "position": [0, 3, 0] },
    { "type": "sign", "position": [-3, 2.5, -2.5], "text": "Rosa's Bakery" }
  ]
}
```

This JSON is stored in Supabase. The renderer reads it and composes the scene at runtime.

---

## Consistency Guarantees

All library components share:

- **Material system:** One shared set of material presets (wood, metal, stone, fabric, skin, glass). Flat-shaded by default for the angular art style. Swappable to smooth for a different aesthetic.
- **Scale standard:** 1 unit = 1 meter. All characters are ~1.5 units tall. Doors are 2 units. Counters are 0.9 units.
- **Color palette:** A curated set of 24 base colors that all work together. Characters, buildings, and props pull from this palette. Custom colors are allowed but the palette is the default.
- **Shadow behavior:** All meshes have castShadow/receiveShadow flags set appropriately. Shadow quality scales with rendering mode (high in immersive, off in floating).
- **LOD (Level of Detail):** Each component has a triangle budget. If the rendering mode is "floating" (Mode 3), components auto-simplify. drei's `<Detailed>` component handles this.

---

## Asset Sources (Build vs Buy)

| Source | Use For | Cost |
|--------|---------|------|
| Custom primitives | Characters, UI elements, quest markers | Free (built by us) |
| Kenney.nl asset packs | Props, furniture, environmental objects | Free (CC0) |
| Quaternius packs | Trees, rocks, nature objects | Free (CC0) |
| Sketchfab | Specific complex props | Free–$20 per model |
| Custom Blender models | Hero assets, unique buildings | $50–200 per asset (Fiverr) |
| AI-generated (Meshy, Tripo3D) | Rapid prototyping, placeholder assets | $10–30/month |

For launch, the majority of the library can be built from primitives (like the prototypes we've been building) plus free CC0 packs. Custom models come later as polish.

---

## Performance Budget per Scene

| Element | Triangle Budget | Max Count |
|---------|----------------|-----------|
| Character | 500–1000 | 8 per scene |
| Building (interior) | 2000–4000 | 1 (the room) |
| Prop (small) | 50–200 | 30 per scene |
| Prop (large) | 500–1000 | 5 per scene |
| Tree | 300–600 | 15 per scene |
| Particle system | 200 particles | 3 per scene |
| Lights | — | 6 per scene |
| **Total scene budget** | **~50,000 triangles** | — |

This budget runs at 30fps+ on a 2019 Chromebook.

---

## Implementation Phases

**Phase 1 — Core Library (ship with MVP)**
- Avatar component with 5 presets
- 3 scene environments (bakery, school, workshop)
- 2 floor types, 2 wall types
- 4 lighting presets (morning, evening, night, cozy)
- 10 essential props (counter, table, chair, cup, book, lantern, tree, fence, sign, workbench)
- 2 weather effects (fireflies, dust motes)
- Quest marker, name tag, sparkle effect

**Phase 2 — Expanded Library (month 2–3)**
- 3 more environments (garden, market, gallery)
- 5 more character presets
- Animation system (idle, talk, wave, worried, excited)
- 3 more weather effects (rain, fog, leaves)
- Audio system (3 ambience presets, 4 music tracks, 8 SFX)
- 15 more props

**Phase 3 — Custom Content (month 4+)**
- GLB model import for custom assets
- Teacher prop placement tool (drag-and-drop in 3D)
- Student avatar customization
- Community asset sharing
- AI-generated scene suggestions
