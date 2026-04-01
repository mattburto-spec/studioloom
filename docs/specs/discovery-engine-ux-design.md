# Discovery Engine — UX & Visual Design Specification
*Every screen, every transition, every pixel decision — made before writing a line of code.*

**Status:** Design decisions locked. Review before build.
**Companion docs:** `discovery-engine-spec.md` (data model), `discovery-engine-v2.md` (frameworks), `discovery-engine-v3-intelligence.md` (AI layer), `discovery-engine-build-plan.md` (timeline)
**Date:** 26 March 2026 (v2 — visual direction locked)

---

## Decisions Locked (26 March 2026)

| Question | Decision |
|----------|----------|
| MVP mentor count | **1 mentor (Kit)** — other 4 built later using same rig |
| Sound design | **Later** — build audio architecture (hooks, interfaces, timing markers) now so sound plugs in cleanly |
| Age branching | **From day one** — interaction types, language complexity, and scenario content branch by age band |
| Sharing mechanism | **Both** — in-app profile display + exportable PNG image for sharing |
| Mentor animation | **Rive** — state machines for expressions, bones for subtle movement |
| Illustration approach | **ChatGPT image generation** — all backgrounds, scenes, characters, icons are pre-rendered images, NOT SVG |
| Celebration style | **Warm light effects** — golden glow blooms, light particle drift, screen warmth. NO confetti. |
| Adaptive station routing | **Fixed order for MVP.** Data model supports variable (`station_order` array). Adaptive in v2. |
| Community scene variants | **Defer — prototype first.** 1 shared scene for MVP. Age-band variants in v2. |
| AI blocking reveals | **No — staggered.** Deterministic data first, AI narrative layers on top. |
| Irritation text analysis | **Yes — Haiku call if 10+ words typed.** |
| Discovery without Open Studio | **Two modes:** Design units (Discovery after lessons) vs Open Studio-default units (Discovery IS the beginning). See AI integration spec. |

---

## Design Philosophy

**The Discovery Engine is not a form. It's not a quiz. It's a place you walk through.**

The student should feel like they're inside a world — moving through rooms, meeting a character, touching things, making choices — and that the world is responding to them. When it's over, they should want to screenshot their profile and show someone.

Three benchmarks define the quality bar:
- **16Personalities** — the emotional arc (intrigue → engagement → surprise → recognition → sharing)
- **Spotify Wrapped** — the reveal moments (one stunning data visualization per screen, animation IS the content)
- **Duolingo** — the character relationship (a mentor who reacts, celebrates, and feels alive)

What we're NOT building: a chatbot, a survey, a personality test, a text adventure, or a Google Form with animations.

---

## Part 1: Visual Identity — "The Design Studio"

### 1.1 Art Direction

The visual world is a **warm, atmospheric design studio** — the kind of creative workspace students aspire to work in. Think late-afternoon golden light streaming through industrial windows, creative materials everywhere, warm wood and copper accents, plants, sketchbooks, interesting objects.

**Art style:** Painterly digital illustration with visible texture — not flat vector, not photorealistic. Warm lighting, rich shadows, atmospheric depth. The closest references:

- **Headspace meditation worlds** — soft, atmospheric, layered environments
- **Firewatch game art** — bold color palettes with layered landscape depth
- **Studio Ghibli background art** — warm, lived-in spaces full of detail
- **Procreate splash screens** — rich illustrated environments that feel handcrafted

**What this is NOT:**
- Not flat vector / Material Design (too corporate)
- Not pixel art or retro (ironically childish for design students)
- Not dark UI with neon accents (overused, feels like a coding app)
- Not hyper-realistic renders (screams "AI-generated" to design students who know better)
- Not emoji, not icon fonts, not SVG line art

**Why this matters for design students:** These are 11-18 year olds studying design. They notice quality. They notice when something is a template vs. intentional. The art itself needs to demonstrate good design — composition, color theory, lighting, atmosphere. If the interface feels cheap, they won't trust the content.

### 1.2 Color System

**Base palette:** Warm studio lighting — amber, golden hour tones, rich shadows

**Per-station color shifts** (like moving through different rooms of a studio):
| Station | Environment | Dominant Colors | Mood |
|---------|-------------|-----------------|------|
| 0. Identity Card | Welcome foyer | Warm amber + cream | Inviting, open |
| 1. Campfire | Cozy corner with warm light | Deep orange + burgundy + gold | Intimate, safe |
| 2. Workshop | Maker space with tools | Teal + copper + warm wood | Energetic, hands-on |
| 3. Collection Wall | Gallery/pinboard room | Indigo + cream + warm highlights | Curious, expansive |
| 4. Window | Window seat looking out | Soft blue + golden light + green | Reflective, empathetic |
| 5. Toolkit | Well-organized studio shelves | Emerald + brass + leather | Capable, prepared |
| 6. Crossroads | A corridor with doors | Rich purple + amber light | Decisive, exciting |
| 7. Launchpad | Rooftop at golden hour | Sky blue + golden + warm pink | Triumphant, forward |

**Student palette choices** (chosen at Identity Card step) tint their UI elements throughout:
- **Warm** — amber/coral/honey (default, matches the studio world)
- **Cool** — slate blue/teal/silver
- **Bold** — crimson/electric orange/deep gold
- **Earth** — olive/terracotta/warm brown
- **Neon** — magenta/cyan/electric lime

The student's palette colors their: activity card borders, selected item highlights, progress indicators, reveal visualization accents, profile card, and exported image.

### 1.3 Typography

Two typefaces only:
- **Display:** A warm, slightly imperfect serif or slab-serif (like Fraunces, Recoleta, or Lora) — for station names, reveal headlines, the mentor's name
- **Body:** A clean humanist sans (like Plus Jakarta Sans, DM Sans, or Inter) — for activity text, options, UI

**Rules:**
- Station names: display font, 32-40px, warm color
- Activity questions: body font, 20-24px, high contrast on card
- Mentor speech: body font, 16-18px, slightly warm-tinted text
- UI labels: body font, 13-14px, muted
- No all-caps anywhere except the journey bar station labels (and even those are small)

### 1.4 The "No Programmer Art" Checklist

Before shipping any screen, check:
- [ ] Every illustration is a generated image (not an emoji, icon font, or placeholder SVG)
- [ ] Colors are from the station palette (not default Tailwind blue/gray)
- [ ] Text has proper hierarchy (display + body, not all the same weight)
- [ ] There is intentional negative space (not everything crammed together)
- [ ] Interactive elements have visible state changes (not just cursor:pointer)
- [ ] Backgrounds have depth (layered images, not flat CSS gradients)
- [ ] The screen would look good as a screenshot (the "would I share this?" test)

---

## Part 2: The World — Screen Architecture

### 2.1 Overall Layout Structure

The Discovery Engine uses a **vertical scroll with station scenes** — not side-scrolling (which has Safari issues, accessibility problems, and breaks mobile gesture navigation).

```
┌──────────────────────────────────────────────────┐
│  JOURNEY BAR (sticky top, always visible)         │
│  [●][●][○][○][○][○][○]  Station 3 of 7          │
├──────────────────────────────────────────────────┤
│                                                    │
│            STATION SCENE                           │
│    ┌──────────────────────────────┐               │
│    │   Background image           │               │
│    │   (ChatGPT-generated,        │               │
│    │    layered for parallax)     │               │
│    │                               │               │
│    │   ┌─────────────────────┐    │               │
│    │   │  ACTIVITY CARD      │    │               │
│    │   │  (the interaction)  │    │               │
│    │   │                     │    │               │
│    │   └─────────────────────┘    │               │
│    │                               │               │
│    │   [MENTOR PANEL]              │               │
│    │   speech bubble + character   │               │
│    └──────────────────────────────┘               │
│                                                    │
├──────────────────────────────────────────────────┤
│  PROGRESS FOOTER (station-specific)               │
│  Activity 3 of 6  ●●●○○○        [Next →]         │
└──────────────────────────────────────────────────┘
```

**Why vertical, not horizontal scroll:**
- Horizontal scroll breaks native browser back/forward gestures on mobile
- Safari has persistent bugs with horizontal scroll containers
- Screen readers and keyboard navigation expect vertical flow
- The "scroll to explore" pattern is natural for Gen Z (Instagram/TikTok trained)
- Each station fills the viewport — feels like a room, not a timeline

**Responsive behavior:**
- Desktop (>1024px): Station scene is centered, max-width 900px, generous padding, mentor appears to the side
- Tablet (768-1024px): Full-width station, mentor slides up from bottom
- Mobile (<768px): Full-screen station, mentor is a collapsible bottom sheet

### 2.2 The Journey Bar (Sticky Navigation)

Always visible at the top. Shows where you are without breaking immersion.

```
┌─────────────────────────────────────────────────────────┐
│ [img] ● ─── [img] ● ─── [img] ◉ ─── [img] ○ ─── ...  │
│ Campfire  Workshop  Collection  Window   Toolkit        │
│                     Wall                                 │
│            ↑ you are here                                │
└─────────────────────────────────────────────────────────┘
```

**Design details:**
- Compact height: 48px (doesn't steal viewport)
- Frosted glass background (backdrop-filter blur 12px, 85% opacity) — world shows through
- Station icons are **small illustrated thumbnails** (20×20px, cropped from station backgrounds), not emoji
- Completed stations: filled dot + full color icon
- Current station: pulsing ring animation (subtle, 2s cycle)
- Locked stations: gray dot, desaturated icon, no interaction
- Connecting lines are dashed (incomplete) ahead, solid (complete) behind
- On mobile: collapses to just dots (no labels), tap to expand

**The character indicator:** A tiny version of the student's Design Identity Card (simplified — just their color + silhouette) sits ON the connecting line at the current position. When transitioning between stations, it slides along the path with a spring animation (0.6s, damping: 20).

```tsx
<motion.div
  className="character-dot"
  animate={{ x: stationPositions[currentStation] }}
  transition={{ type: "spring", damping: 20, stiffness: 200 }}
/>
```

### 2.3 Station Scene Layout

Each station is a full-viewport scene with layered elements:

```
Layer 0: Base gradient (CSS, instant load — matches station palette)
Layer 1: Far background (ChatGPT image, parallax 0.3x)
Layer 2: Mid background detail (ChatGPT image, parallax 0.6x)
Layer 3: Activity card (centered, frosted glass, no parallax)
Layer 4: Mentor character (Rive, positioned left or right)
Layer 5: UI overlay (progress dots, navigation)
```

**Parallax is scroll-linked within the station**, not between stations. As the student scrolls through activities within a station, the background layers shift slightly — creating depth without disorientation. Uses Framer Motion `useScroll` with `useTransform`:

```tsx
const { scrollYProgress } = useScroll({ target: stationRef });
const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "-8%"]);
const midY = useTransform(scrollYProgress, [0, 1], ["0%", "-15%"]);
```

**Image loading strategy:**
- Layer 0 (CSS gradient) loads instantly — student never sees a blank screen
- Layer 1 (far bg) loads with priority — visible within 500ms
- Layer 2 (mid bg) lazy-loads — fades in as it arrives
- Images are pre-optimized: WebP, max 1920px wide, <200KB each
- Next station's images prefetch when student is 80% through current station

### 2.4 Station Transitions

When the student completes a station and moves to the next, the transition should feel like **walking through a door into a new room**.

**The transition sequence (1.2s total):**
1. Activity card slides down and fades (0.3s)
2. Background dims slightly via warm overlay (0.2s, overlapping)
3. New station's background fades in through a warm light bloom from center (0.4s)
4. New activity card slides up into view (0.3s)
5. Mentor appears with a greeting (0.2s delay after card)

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={currentStation}
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -40 }}
    transition={{ duration: 0.4, ease: "easeInOut" }}
  >
    <StationScene station={currentStation} />
  </motion.div>
</AnimatePresence>
```

**Between-station reveal (the Spotify Wrapped moment):**
Before the new station loads, a 5-8 second reveal screen appears showing what was learned. One beautiful data visualization, full screen, with the student's data animated in. (See Part 6 for all 7 reveal designs.)

---

## Part 3: The Character — Avatar Design

### 3.1 What the Avatar Is (and Isn't)

**It's NOT a full Gacha Club/Zepeto character creator.** That's a 4-6 week build that would become the project itself. The avatar is a **3-minute identity anchor** — quick enough to not derail the journey, meaningful enough to create ownership.

**It IS a "Design Identity Card"** — a visual representation of how the student sees themselves as a designer. A stylized card with their choices displayed.

### 3.2 The Avatar Builder Flow (Station 0 — Before the Journey)

Positioned between "Choose Your Mentor" and Station 1. Takes 3 minutes.

**Screen 1: Color Palette (30 seconds)**

```
┌─────────────────────────────────────┐
│                                      │
│   Choose your vibe                   │
│                                      │
│   ┌──────────────────────────┐      │
│   │                           │      │
│   │  [illustrated silhouette] │      │
│   │  (tints with selection)   │      │
│   │                           │      │
│   └──────────────────────────┘      │
│                                      │
│   ◉ Warm      ○ Cool      ○ Bold    │
│   (amber/     (blue/      (crimson/ │
│    coral)      teal)       orange)  │
│                                      │
│   ○ Earth     ○ Neon                 │
│   (olive/     (magenta/             │
│    terracotta) cyan)                │
│                                      │
└─────────────────────────────────────┘
```

**Visual implementation:** 5 palette swatches rendered as illustrated color chips (painted texture, not flat rectangles). Each is a `<motion.button>` with scale animation on tap. Selected palette applies immediately to the silhouette figure and the background warmth. The silhouette is a **generated illustration** — a gender-neutral figure rendered in the student's chosen palette, not a CSS shape.

**Data captured:** Color palette preference → maps to temperament/energy style. Sets visual theme for entire profile.

**Screen 2: Tool Belt (60 seconds)**

```
┌─────────────────────────────────────┐
│                                      │
│   Pick 3 tools for your belt         │
│                                      │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │
│   │[img]│ │[img]│ │[img]│ │[img]│ │
│   │Hammer│ │Rule │ │Brush │ │Code │ │
│   └─────┘ └─────┘ └─────┘ └─────┘ │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │
│   │[img]│ │[img]│ │[img]│ │[img]│ │
│   │Camera│ │Micro│ │Pencil│ │ Mic │ │
│   └─────┘ └─────┘ └─────┘ └─────┘ │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │
│   │[img]│ │[img]│ │[img]│ │[img]│ │
│   │Spark │ │Puzzle│ │Chart │ │Seed │ │
│   └─────┘ └─────┘ └─────┘ └─────┘ │
│                                      │
│   Selected: [🔨] [🎨] [___]        │
│                                      │
└─────────────────────────────────────┘
```

12 tool icons. Student picks 3. This is the highest-signal avatar interaction.

**CRITICAL: Tool icons are illustrated images, not emoji.** Each tool is a small (80×80px) painterly illustration in the studio art style — warm lighting, visible texture, sitting on a wooden surface. Generated as a consistent set so they feel like they belong together.

**Tool → Archetype mapping (stealth):**
| Tool | Primary Archetype | Secondary |
|------|------------------|-----------|
| Hammer | Maker | — |
| Ruler | Systems Thinker | Maker |
| Paintbrush | Creative | Communicator |
| Code | Systems Thinker | Researcher |
| Camera | Communicator | Creative |
| Microscope | Researcher | — |
| Pencil | Creative | Maker |
| Microphone | Communicator | Leader |
| Lightning | Leader | Creative |
| Puzzle | Systems Thinker | Researcher |
| Chart | Researcher | Systems Thinker |
| Seedling | Leader | Researcher |

**Implementation:** Illustrated icon cards. Tap to select (selected cards glow in the student's palette color + gentle lift animation). Max 3 enforced. Drag to the "belt" area at bottom, or tap to toggle. Changing a selection is easy (tap to remove).

**Behavioral data captured silently:**
- Which tool was selected first (strongest affinity)
- Selection order (priority)
- Time to first selection (decisiveness)
- Any changes/swaps (reconsideration)
- Time spent on this screen (engagement)

**Screen 3: Workspace Decoration (60 seconds)**

```
┌─────────────────────────────────────┐
│                                      │
│   Set up your workspace              │
│                                      │
│   ┌──────────────────────────┐      │
│   │                           │      │
│   │   [illustrated desk scene]│      │
│   │   with 4 empty spots      │      │
│   │   (warm wood, good light) │      │
│   │                           │      │
│   └──────────────────────────┘      │
│                                      │
│   Drag items to your desk:           │
│   [img] [img] [img] [img]           │
│   [img] [img] [img] [img]           │
│   [img] [img] [img] [img]           │
│                                      │
└─────────────────────────────────────┘
```

4 spots on the desk. 12 items to choose from. The desk scene and every item is a **generated illustration** in the same studio art style.

**Desk items (illustrated, ~60×60px each):**
| Item | Data Signal |
|------|-------------|
| Potted plant | People-oriented / nurturing |
| Headphones | Solo worker / immersive focus |
| Stack of books | Structured / researcher |
| Sticky note wall | Visual / creative thinker |
| Scale model | Goal-oriented / maker |
| Second monitor | Technical / builder |
| Sketchbook | Creative / visual processor |
| Coffee mug | Solo worker energy |
| Tool kit | Hands-on / maker |
| Trophy/award | Goal-oriented / competitive |
| Clock | Structured / time-aware |
| Pet rock | Playful / unconventional |

**Implementation:** HTML5 drag-and-drop (same pattern as lesson editor DnD). Items snap to desk spots with a satisfying settle animation. The desk illustration updates live as items land. On mobile: tap item → tap spot (drag is unreliable on mobile). Each placed item gets a tiny glow in the student's palette color.

### 3.3 The Resulting Design Identity Card

After these 3 screens (~3 minutes), the student has a card:

```
╭──────────────────────────────╮
│  [student's color palette     │
│   as a gradient wash]         │
│                               │
│     [illustrated silhouette   │
│      in their palette]        │
│                               │
│  [tool 1] [tool 2] [tool 3]  │
│  ← illustrated tool icons     │
│                               │
│  [mini desk scene with their  │
│   4 chosen items arranged]    │
│                               │
│  — Student Name —             │
│  Design Explorer              │
│  (archetype revealed later)   │
╰──────────────────────────────╯
```

This card appears in the corner of every station (small), expands when tapped, and evolves throughout the journey as new data is added. By the Grand Reveal, it's complete with archetype title + Ikigai.

### 3.4 What We're NOT Doing (And Why)

**Not doing: Full body avatar customization (hair, face, clothes)**
- Research shows avatar clothing choices correlate with aspirational identity, not actual personality — the signal is weak
- Hair/face customization takes 10-15 minutes (eats journey time)
- Body type options create body image risks for 12-16 year olds
- A full avatar builder becomes the product instead of a feature

**Not doing: AI-generated avatar from selfie**
- Privacy concerns (facial data for minors)
- Uncanny valley effect
- Technical complexity

**Not doing: Clothing drag-and-drop on a figure**
- Gender presentation concerns
- Doesn't map to design archetypes meaningfully
- Fashion choices reflect trends, not personality

**Instead: Abstract identity through tools, workspace, and color** — these map directly to design thinking and have no body image risk.

---

## Part 4: The Mentor — How Kit Appears

### 4.1 Kit's Visual Design

Kit is the Maker mentor — warm, encouraging, mid-30s creative professional. **Kit is a Rive-animated character built from ChatGPT-generated base artwork.**

**Production pipeline:**
1. Generate Kit's base illustration with ChatGPT (5 expression states as separate images)
2. Import into Rive editor
3. Set up bones, meshes, state machine
4. Export as .riv file (<50KB target)

**Kit's appearance:** Warm brown skin, rolled sleeves, paint-stained canvas work apron, short tousled hair, genuine half-smile. Amber palette. Feels like the cool design teacher everyone wishes they had.

**5 expression states:**
| State | When | Visual | Rive State |
|-------|------|--------|------------|
| **Neutral/Listening** | Student is working on an activity | Slight smile, attentive eyes, leaning forward slightly | `idle` |
| **Encouraging** | Student submits a response | Bigger smile, slight head tilt, warm eyes | `encourage` |
| **Thinking** | Processing / loading | Hand on chin, looking slightly up, one eye squinted | `think` |
| **Excited** | Student makes a key discovery | Wide eyes, both hands up, gentle bounce | `excited` |
| **Gentle** | Student seems hesitant (long pause) | Soft smile, head tilted, open palm gesture | `gentle` |

**Subtle animations (bones/meshes in Rive):**
- Breathing (chest rise/fall, 4s cycle)
- Eye blinks (random interval, 3-7s)
- Slight weight shift (body sways gently when idle)
- Head tracks toward the activity card (eyes follow content)

### 4.2 Kit's Positioning on Screen

Kit does NOT float around or follow the cursor. Fixed home position that changes by context:

**During activities (most of the time):**
```
Desktop:                          Mobile:
┌────────────────────────────┐   ┌──────────────┐
│                    │ [Kit]  │   │              │
│   [Activity Card]  │ panel  │   │ [Activity]   │
│                    │        │   │              │
│                    │ speech │   ├──────────────┤
│                    │ bubble │   │ [Kit bar]    │
│                    │        │   │ collapsed    │
└────────────────────┴────────┘   └──────────────┘
```

**Desktop:** Kit is in a right-side panel (280px wide). Rive character at top (200×280px frame), speech bubble below. Panel has a subtle frosted glass background so the station scene shows through. Panel is always visible but the speech bubble only appears when Kit has something to say.

**Mobile:** Kit collapses to a thin bar at the bottom (56px) showing just Kit's face + a speech indicator dot. Tap to expand the speech bubble upward as a bottom sheet (up to 60% viewport height).

### 4.3 When Kit Speaks

Kit is NOT a chatbot. They don't respond to every action. They speak at specific trigger points:

| Trigger | What Kit says | Expression |
|---------|--------------|------------|
| **Enter station** | Welcome + brief context for this station | Encouraging |
| **First activity complete** | Acknowledge + light nudge | Encouraging |
| **Hesitation (15s no input)** | Gentle prompt (never "are you stuck?") | Gentle |
| **Strong choice pattern** | "Interesting — you keep choosing X" | Thinking → Excited |
| **Station complete** | "Ready to see what we found?" | Excited |
| **After reveal** | Reflection on what was discovered | Thinking → Encouraging |

**Speech bubble design:**
```
  ╭────────────────────────────────╮
  │ "You picked the microscope     │
  │  first — your instinct is to   │
  │  investigate before building." │
  ╰──────────────┬─────────────────╯
                 ╱
           [Kit face]
```

- Warm cream/white background, 16px rounded corners, subtle shadow
- Dark text, 15px on desktop, 14px on mobile
- Max 2-3 sentences (never a wall of text)
- Tail pointing to Kit
- Entrance: slide up + fade (0.3s, spring)
- Exit: fade out (0.2s) after student advances
- Speech bubbles do NOT auto-dismiss. Student must tap "Next" or start the next activity.

### 4.4 Rive Implementation

```tsx
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';

function KitMentor({ expression, isSpeaking }) {
  const { RiveComponent, rive } = useRive({
    src: '/mentors/kit.riv',
    stateMachines: 'KitStateMachine',
    autoplay: true,
  });

  const expressionInput = useStateMachineInput(rive, 'KitStateMachine', 'expression');
  const speakingInput = useStateMachineInput(rive, 'KitStateMachine', 'isSpeaking');

  useEffect(() => {
    if (expressionInput) expressionInput.value = EXPRESSION_MAP[expression];
    if (speakingInput) speakingInput.value = isSpeaking;
  }, [expression, isSpeaking]);

  return <RiveComponent style={{ width: 200, height: 280 }} />;
}

const EXPRESSION_MAP = {
  neutral: 0,
  encouraging: 1,
  thinking: 2,
  excited: 3,
  gentle: 4,
};
```

### 4.5 Audio Architecture (Build Now, Implement Later)

The audio system is designed but NOT shipped in MVP. The architecture ensures sound plugs in cleanly when ready.

```tsx
// Audio hook interface — build this now, implement later
interface AudioConfig {
  enabled: boolean;
  volume: number; // 0-1
  ambient: boolean; // station background sounds
  mentor: boolean; // Kit's voice
  effects: boolean; // UI interaction sounds
}

interface AudioCue {
  type: 'ambient' | 'mentor' | 'effect';
  src: string; // path to audio file
  trigger: 'station_enter' | 'activity_complete' | 'reveal_start' | 'celebration' | 'speech';
  fadeIn?: number; // ms
  fadeOut?: number; // ms
  loop?: boolean;
}

// Every station defines audio timing markers
interface StationAudioMarkers {
  stationId: string;
  ambient: string; // ambient loop file path
  mentorCues: { triggerId: string; audioSrc: string }[];
  effectCues: { triggerId: string; audioSrc: string }[];
}

// Hook stub — returns no-ops until audio is implemented
function useDiscoveryAudio(config: AudioConfig) {
  return {
    playAmbient: (stationId: string) => {},
    playCue: (cue: AudioCue) => {},
    stopAll: () => {},
    setVolume: (v: number) => {},
  };
}
```

**When audio ships later:**
- Station ambient: gentle workshop sounds (Campfire = crackling fire, Workshop = tools, Collection Wall = page turning, etc.)
- Kit's voice: ElevenLabs pre-recorded clips (~30 key lines), real-time generation for AI-response moments
- Effects: subtle interaction sounds (card select = soft tap, drag complete = wooden clunk, reveal = warm chime)
- Always muted by default. Student opts in. `prefers-reduced-motion` also disables audio.

---

## Part 5: Age Branching (Built From Day One)

### 5.1 Age Band Definitions

| Band | Ages | MYP Years | Key Differences |
|------|------|-----------|-----------------|
| **Junior** | 11-13 | Y1-Y3 | Simpler language, more visual activities, scenarios about friendship/school, shorter stations |
| **Senior** | 14-16 | Y4-Y5 | Fuller language, more text activities, scenarios about real-world design challenges, longer stations |
| **Extended** | 17-18 | DP/beyond | Most complex language, reflection-heavy, career-adjacent scenarios, full stations |

### 5.2 What Branches

| Element | Junior (11-13) | Senior (14-16) | Extended (17-18) |
|---------|---------------|----------------|-------------------|
| **Activity count per station** | 3-4 | 5-6 | 6-7 |
| **Text prompt type** | Multiple choice only | MC + 1 short text | MC + 2 text prompts |
| **Scenario complexity** | "Your friend needs help" | "A community needs a solution" | "A client brief with constraints" |
| **Vocabulary** | Plain English, no jargon | Some design terms introduced | Full design vocabulary |
| **Card sort count** | 6 items → pick 2 | 8 items → pick 3 | 10 items → pick 3 |
| **Slider count** | 3 sliders | 5 sliders | 6 sliders |
| **Text prompt min words** | 10 | 15 | 25 |
| **Reveal complexity** | Simple bar charts | Radar + constellation | Full Ikigai + detailed analysis |
| **Kit's language** | Casual, encouraging | Conversational, insightful | Peer-level, challenging |
| **Total journey time** | ~12 minutes | ~18 minutes | ~22 minutes |

### 5.3 Implementation

Age is determined from the student's class metadata (already available in `class_students` junction — each class has `grade_level`). No need to ask the student.

```tsx
function getAgeBand(gradeLevel: number): 'junior' | 'senior' | 'extended' {
  if (gradeLevel <= 8) return 'junior';   // MYP Y1-3 (ages 11-13)
  if (gradeLevel <= 10) return 'senior';  // MYP Y4-5 (ages 14-16)
  return 'extended';                       // DP+ (ages 17-18)
}

// Station config selects activities based on band
const stationConfig = STATIONS.map(station => ({
  ...station,
  activities: station.activities.filter(a =>
    a.ageBands.includes(ageBand)
  ),
  mentorDialogue: station.mentorDialogue[ageBand],
}));
```

Each activity in the data model has an `ageBands: ('junior' | 'senior' | 'extended')[]` array. Some activities are universal (all bands), others are band-specific. This is content authoring, not code branching — adding a new age-appropriate activity is just adding to the data.

---

## Part 6: Interaction Components — The Activity Cards

### 6.1 Activity Card Container

Every activity lives inside an **Activity Card** — a frosted glass card (24px radius, backdrop-filter blur) centered in the station scene. The card is the focus; the background is atmosphere.

**Card styling:**
- Background: white at 92% opacity (light mode) or dark at 85% opacity (dark mode)
- Backdrop filter: blur(16px) + saturate(1.2)
- Border: 1px solid white at 15% opacity
- Shadow: 0 8px 32px rgba(0,0,0,0.12)
- Max-width: 560px on desktop, full-width with 16px padding on mobile
- Border accent in student's palette color (1px left border or subtle top gradient)

### 6.2 The 8 Interaction Types

#### Type 1: Binary Forced Choice
Two large tap targets (min 160×100px). Selection: selected card scales to 1.03, fills with palette accent, unselected fades to 50%. Auto-advance after 0.8s. Each option card has a small illustrated icon (generated, not emoji) matching the choice.

#### Type 2: Scenario Response
Small **illustrated scene** at top (generated image, ~full-width, 200px tall, station-themed). Scenario text below. 4 response options as full-width radio cards. Selection fills with color + checkmark, others dim. Auto-advance after 1s.

**Scene illustrations are station-specific and generated.** Example: Campfire station scenario shows two friends around a table with scattered materials. Workshop scenario shows a messy workbench. These are ~560×200px atmospheric illustrations.

#### Type 3: Card Sort / Drag Ranking
Cards in a flexible grid. Drag to 3 ranked slots below (Framer Motion `Reorder` or HTML5 DnD). On mobile: tap card then tap slot. Cards have illustrated icons + label. Dropped cards snap with spring animation. "Continue" appears after 3 placed.

#### Type 4: Visual Scene Selection
4 **illustrated scenes** in a 2×2 grid (~260×180px each). Rich, atmospheric illustrations — not stock photos, not flat icons. Workshop interior, library corner, rooftop garden, stage with spotlight. Hover: subtle lift + brightness. Selection: colored border, others desaturate.

#### Type 5: Slider Scales
5-point semantic scale ("not yet" → "very confident"). Track is student's palette color. Thumb is a painted-texture circle. All sliders visible at once.

#### Type 6: Image/Icon Selection (Multi-select)
12-16 illustrated icons in a responsive grid. Each is a small painted-style illustration (~64×64px). Tap to toggle. Selected: palette-colored ring + checkmark overlay. Min 3, max 6.

#### Type 7: This-or-That Quick-Fire
Rapid binary choices. 8-10 pairs in ~60 seconds. Two large buttons with illustrated icons. Selection triggers immediate slide transition (0.4s). Progress dots advance. No going back.

#### Type 8: Focused Text Prompt (Only 2 in entire journey)
Illustrated scene above the prompt (full-width, atmospheric). Large textarea, auto-expanding. Word counter as a growing progress bar in palette color. Continue disabled until minimum. Kit reacts at word count milestones.

### 6.3 Activity Card Transitions (Within a Station)

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={activityIndex}
    initial={{ opacity: 0, x: 60 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -60 }}
    transition={{ type: "spring", damping: 25, stiffness: 200 }}
  />
</AnimatePresence>
```

- Cards slide left-to-right (feels like moving forward)
- Spring physics (springs feel alive, ease-in-out feels mechanical)
- 0.4s total transition
- Background doesn't change (stability within station)

---

## Part 7: Celebration & Reveal System

### 7.1 Micro-Celebrations (During Activities) — NO CONFETTI

Every 3rd completed activity triggers a warm micro-celebration:

- **Golden light bloom** — a radial gradient of warm amber light expands from the center of the completed card, fades after 1.5s. CSS radial-gradient animation.
- **Floating light motes** — 8-12 small warm dots drift upward like dust in studio light. CSS keyframe animation, 2s duration. Subtle, not flashy.
- **Kit expression** — switches to "excited" state for 2s
- **Journey bar warm pulse** — the current station dot glows once in amber

```tsx
// Warm glow celebration — no confetti library needed
function WarmGlow({ active, palette }) {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={active ? { opacity: [0, 0.4, 0], scale: [0.5, 1.2, 1.5] } : {}}
      transition={{ duration: 1.5, ease: "easeOut" }}
      style={{
        background: `radial-gradient(circle, ${palette.warm}40 0%, transparent 70%)`,
      }}
    />
  );
}

// Light motes — floating particles
function LightMotes({ count = 10, palette }) {
  return Array.from({ length: count }).map((_, i) => (
    <motion.div
      key={i}
      className="absolute w-1.5 h-1.5 rounded-full"
      style={{ backgroundColor: palette.accent, left: `${20 + Math.random() * 60}%` }}
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: [0, 0.6, 0], y: -80 - Math.random() * 40 }}
      transition={{ duration: 1.5 + Math.random(), delay: Math.random() * 0.3 }}
    />
  ));
}
```

### 7.2 Station Reveals (Between Stations)

Full-screen data visualization. One per station. The student's data animated in real-time. Each reveal has a **generated atmospheric background image** specific to the visualization theme.

| Station | Reveal Type | Background Image | Animation |
|---------|-------------|-----------------|-----------|
| **Campfire** | Working Style Spectrum — horizontal bars for 3 dimensions | Warm firelit room, amber glow | Bars grow from center, labels fade |
| **Workshop** | Design Archetype Hexagon — 6-point radar | Workshop bench with tools, overhead light | Hexagon draws vertex by vertex, fills |
| **Collection Wall** | Interest Constellation — stars in night sky | Window view of night sky from studio | Stars fade in, connecting lines draw |
| **Window** | Empathy Map — 4 quadrants | Rain on window, warm interior light | Quadrants fade in clockwise |
| **Toolkit** | Readiness Radar — spider chart | Organized tool wall, warm spotlight | Radar outline draws, fill sweeps |
| **Crossroads** | Three Doors — 3 project paths | Atmospheric corridor with 3 lit doorways | Doors slide in, peek-through windows illuminate |
| **Launchpad** | Grand Reveal — Ikigai diagram | Golden hour rooftop panorama | Full choreographed sequence (see 7.3) |

**Reveal visualizations use SVG + Framer Motion** (not a charting library). Custom-drawn SVG paths animated with `motion.path` for full control over timing and style. Each visualization is rendered over a full-screen generated background image.

**Animation timing per reveal:**
1. Background image fades in with warm overlay (0.3s)
2. Visualization container appears (0.3s)
3. Data elements animate in (1.5-3s depending on complexity)
4. Label text fades in (0.3s)
5. Kit's comment appears (0.3s delay)
6. Continue button appears (0.5s delay)
7. **Total: 5-8 seconds of animation, then student controls pace**

### 7.3 The Grand Reveal (Station 7 — Launchpad)

This is the Spotify Wrapped moment. Full screen. Dramatic.

**Background:** Golden hour rooftop panorama — generated illustration of a city view from a creative studio rooftop, warm pink/gold/blue sky. The most beautiful image in the entire experience.

**Sequence (12-15 seconds of choreographed animation):**

1. **Warm fade** (0.5s) — screen fills with student's palette as a soft wash
2. **Background blooms** — rooftop panorama fades in through the color wash (0.8s)
3. **Identity Card rises** from bottom — their avatar with tools, desk, and palette (1s)
4. **Archetype title animates** in display font: "You're a Creative Maker" (0.5s)
5. **4 Ikigai circles drift in** from the corners:
   - Top-left: "What you love" (interests from Collection Wall)
   - Top-right: "What you're good at" (strengths from Workshop + Toolkit)
   - Bottom-left: "What the world needs" (empathy from Window)
   - Bottom-right: "What's realistic" (resources from Toolkit)
   - Circles overlap with blur blend (1.5s)
6. **The intersection glows** with warm golden light — project direction text appears in center (1s)
7. **3 project suggestions** fade in below the Ikigai (1s)
8. **Kit appears** with final message (0.5s)
9. **"Save & Share" button** pulses gently with warm glow (0.3s)

**The save generates:**
- A PNG image of the full profile (for sharing — Instagram-story sized 1080×1920 + square 1080×1080)
- A PDF one-pager (for printing / portfolio)
- The DiscoveryProfile JSON (for the AI system)

---

## Part 8: Animation Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Page transitions** | Framer Motion `AnimatePresence` | Proven in StudioLoom codebase |
| **Activity card transitions** | Framer Motion spring animations | Consistent feel |
| **Parallax backgrounds** | Framer Motion `useScroll` + `useTransform` | GPU-accelerated, scroll-linked |
| **Kit (mentor character)** | **Rive** state machines + bones | Alive feeling, <50KB, interactive expressions |
| **Data reveal visualizations** | SVG + Framer Motion `motion.path` | Draw-on animations, full style control |
| **Warm celebrations** | CSS radial-gradient animation + Framer Motion | No external library needed |
| **Drag and drop** | Framer Motion `Reorder` + HTML5 DnD | Already proven in lesson editor |
| **Journey bar character** | Framer Motion position animation | Spring physics along path |
| **Grand Reveal Ikigai** | Custom SVG + Framer Motion orchestration | Choreographed sequence |

**What we're NOT using:**
- **Three.js / WebGL** — overkill for 2D, battery drain
- **Pixi.js** — no need for 50+ animated sprites
- **GSAP** — duplicates Framer Motion, adds bundle weight
- **Lottie** — 5-10× larger files than Rive
- **canvas-confetti** — no confetti in the design

**Performance targets:**
- First station load: <2s on 4G
- Station transitions: <400ms
- Activity transitions: <300ms
- Scroll frame rate: 60fps (16ms frame time)
- Total JS bundle for Discovery Engine: <150KB gzipped
- Kit .riv file: <50KB
- Generated images: WebP, <200KB each, lazy-loaded with gradient placeholder

**Progressive enhancement:**
```tsx
const prefersReducedMotion = useReducedMotion();

const transition = prefersReducedMotion
  ? { duration: 0 }
  : { type: "spring", damping: 20 };
```

- `prefers-reduced-motion: reduce` → all animations instant, no parallax
- Low-power mode → reduce particles, skip parallax
- Rive unavailable → static illustrated image of Kit with CSS opacity transitions between expressions
- Slow connection → CSS gradient backgrounds load instantly, images lazy-load with blur-up

---

## Part 9: Mobile-First Design

### 9.1 Touch Targets
Every interactive element: minimum 48×48px (WCAG AA). Cards and buttons: minimum 56px height.

### 9.2 The Bottom Sheet Pattern
On mobile, Kit and supplementary UI use bottom sheets:

```
┌──────────────────┐
│                    │
│  [Activity Card]   │
│  (full width)      │
│                    │
├────────────────────┤
│ ═══ drag handle ═══│
│                    │
│ [Kit speech]       │
│ [or reveal viz]    │
└────────────────────┘
```

- Drag handle at top (gray pill, 40×4px)
- Swipe up to expand, swipe down to collapse
- Collapsed: 56px showing Kit's face + speech indicator
- Expanded: up to 60% viewport height
- Framer Motion `useDragControls` with snap points

### 9.3 No Horizontal Scroll Anywhere
The entire Discovery Engine works in portrait. No landscape requirement. No horizontal card carousels (wrap to vertical grid). Non-negotiable for mobile reliability.

---

## Part 10: Complete Image Asset List

All images generated via ChatGPT image generation (gpt-image-1). Consistent art style across all images.

### 10.1 Master Art Style Prompt

Every image generation uses this base prompt prefix to ensure visual consistency:

> "Warm painterly digital illustration of a creative design studio. Late afternoon golden light, rich shadows, atmospheric depth. Style: between Studio Ghibli backgrounds and Firewatch game art. Visible brush texture, not photorealistic. Color palette: warm ambers, deep shadows, [station-specific colors]. No text, no UI elements, no speech bubbles."

### 10.2 Station Backgrounds (14 images — 2 layers each)

| # | Image | Size | Description |
|---|-------|------|-------------|
| 1 | `bg-foyer-far.webp` | 1920×1080 | Warm studio entrance, welcome foyer, soft light through door |
| 2 | `bg-foyer-mid.webp` | 1920×1080 | Foyer details: coat hooks, pinned notes, welcome mat |
| 3 | `bg-campfire-far.webp` | 1920×1080 | Cozy studio corner with warm fireplace/heater, deep orange tones |
| 4 | `bg-campfire-mid.webp` | 1920×1080 | Close details: cushions, sketchbooks on floor, warm cups |
| 5 | `bg-workshop-far.webp` | 1920×1080 | Maker space with tools on wall, workbenches, teal/copper |
| 6 | `bg-workshop-mid.webp` | 1920×1080 | Close: wood shavings, clamps, half-built projects |
| 7 | `bg-collection-far.webp` | 1920×1080 | Gallery room with pinboard walls, indigo/cream |
| 8 | `bg-collection-mid.webp` | 1920×1080 | Close: photos, fabric swatches, magazine clippings |
| 9 | `bg-window-far.webp` | 1920×1080 | Large window overlooking garden/community, soft blue/gold |
| 10 | `bg-window-mid.webp` | 1920×1080 | Window seat details: cushion, plants, notebook |
| 11 | `bg-toolkit-far.webp` | 1920×1080 | Organized studio shelves, emerald/brass/leather |
| 12 | `bg-toolkit-mid.webp` | 1920×1080 | Close: labeled boxes, tools in holders, reference books |
| 13 | `bg-crossroads-far.webp` | 1920×1080 | Corridor with 3 distinct doors, warm purple/amber |
| 14 | `bg-crossroads-mid.webp` | 1920×1080 | Door details: different handles, light under doors |

### 10.3 Rooftop / Grand Reveal (2 images)

| # | Image | Size | Description |
|---|-------|------|-------------|
| 15 | `bg-launchpad-far.webp` | 1920×1080 | Golden hour rooftop panorama, city horizon, warm pink/gold sky |
| 16 | `bg-launchpad-mid.webp` | 1920×1080 | Rooftop details: plants, sketches pinned to railing, telescope |

### 10.4 Kit Mentor (5 expression base images)

| # | Image | Size | Description |
|---|-------|------|-------------|
| 17 | `kit-neutral.png` | 400×560 | Kit standing relaxed, slight smile, hands at sides |
| 18 | `kit-encouraging.png` | 400×560 | Kit bigger smile, head tilt, warm eyes |
| 19 | `kit-thinking.png` | 400×560 | Kit hand on chin, looking up, one eye squinted |
| 20 | `kit-excited.png` | 400×560 | Kit wide eyes, both hands up, slight bounce |
| 21 | `kit-gentle.png` | 400×560 | Kit soft smile, head tilted, open palm gesture |

### 10.5 Scenario Scene Illustrations (6 images)

| # | Image | Size | Description |
|---|-------|------|-------------|
| 22 | `scene-friend-panic.webp` | 560×200 | Two friends at messy table, one stressed, materials scattered |
| 23 | `scene-workshop-mess.webp` | 560×200 | Chaotic workbench with half-finished projects |
| 24 | `scene-community-need.webp` | 560×200 | People in a neighborhood, one person looking at a problem |
| 25 | `scene-team-challenge.webp` | 560×200 | Small group around a whiteboard, markers in hand |
| 26 | `scene-design-brief.webp` | 560×200 | Desk with brief document, reference materials, deadline calendar |
| 27 | `scene-user-testing.webp` | 560×200 | Person using a prototype, observer taking notes |

### 10.6 Tool Icons (12 images)

| # | Image | Size | Description |
|---|-------|------|-------------|
| 28-39 | `tool-hammer.webp` through `tool-seedling.webp` | 160×160 | Each tool illustrated in studio style on warm wood surface. Hammer, ruler, paintbrush, laptop/code, camera, microscope, pencil, microphone, lightning bolt, puzzle piece, chart/graph, seedling plant |

### 10.7 Workspace Desk Items (12 images)

| # | Image | Size | Description |
|---|-------|------|-------------|
| 40-51 | `desk-plant.webp` through `desk-pet-rock.webp` | 120×120 | Each item illustrated in studio style. Potted plant, headphones, stack of books, sticky note wall, scale model, monitor, sketchbook, coffee mug, tool kit, trophy, clock, painted pet rock |

### 10.8 Visual Scene Selection (4 images)

| # | Image | Size | Description |
|---|-------|------|-------------|
| 52 | `scene-select-workshop.webp` | 520×360 | Workshop interior, warm tools, active making |
| 53 | `scene-select-library.webp` | 520×360 | Cozy library corner, books, reading lamp |
| 54 | `scene-select-garden.webp` | 520×360 | Rooftop garden, plants, natural light |
| 55 | `scene-select-stage.webp` | 520×360 | Small stage with spotlight, microphone |

### 10.9 Reveal Backgrounds (7 images)

| # | Image | Size | Description |
|---|-------|------|-------------|
| 56 | `reveal-firelit.webp` | 1920×1080 | Warm amber glow room for Working Style reveal |
| 57 | `reveal-workshop-light.webp` | 1920×1080 | Overhead workshop light for Archetype Hexagon |
| 58 | `reveal-night-sky.webp` | 1920×1080 | View from studio window at night for Constellation |
| 59 | `reveal-rain-window.webp` | 1920×1080 | Rain on glass, warm interior for Empathy Map |
| 60 | `reveal-tool-wall.webp` | 1920×1080 | Organized wall with spotlight for Readiness Radar |
| 61 | `reveal-corridor.webp` | 1920×1080 | Atmospheric corridor for Three Doors |
| 62 | `reveal-golden-rooftop.webp` | 1920×1080 | Duplicate of launchpad-far or variant for Grand Reveal |

### 10.10 Design Identity Card Frame (1 image)

| # | Image | Size | Description |
|---|-------|------|-------------|
| 63 | `identity-card-frame.png` | 600×900 | Illustrated card border/frame with warm studio textures |

### 10.11 Illustrated Desk Base (1 image)

| # | Image | Size | Description |
|---|-------|------|-------------|
| 64 | `desk-base.webp` | 560×300 | Empty warm wood desk with 4 marked spots, studio lighting |

**Total: ~64 images.** Generation time estimate: ~3-4 hours with ChatGPT. The key is generating with the master style prompt to maintain consistency.

---

## Part 11: File Architecture

```
src/
  app/
    (student)/
      discovery/
        page.tsx                    // Entry point, mentor selection
        [stationId]/
          page.tsx                  // Dynamic station route
        reveal/
          page.tsx                  // Grand Reveal
  components/
    discovery/
      JourneyBar.tsx               // Sticky progress bar with character dot
      StationScene.tsx             // Scene wrapper (parallax layers + card + mentor)
      MentorPanel.tsx              // Right panel (desktop) / bottom sheet (mobile)
      KitMentor.tsx                // Rive wrapper for Kit
      ActivityCard.tsx             // Frosted glass card container
      RevealScreen.tsx             // Between-station reveal container
      GrandReveal.tsx              // Final Ikigai reveal choreography
      DesignIdentityCard.tsx       // Avatar/profile card
      WarmGlow.tsx                 // Celebration light bloom
      LightMotes.tsx               // Floating particle celebration
      interactions/
        BinaryChoice.tsx           // Type 1
        ScenarioResponse.tsx       // Type 2
        CardSort.tsx               // Type 3
        VisualSceneSelect.tsx      // Type 4
        SliderScale.tsx            // Type 5
        IconMultiSelect.tsx        // Type 6
        QuickFire.tsx              // Type 7
        TextPrompt.tsx             // Type 8
      reveals/
        WorkingStyleSpectrum.tsx   // Station 1 reveal
        ArchetypeHexagon.tsx       // Station 2 reveal
        InterestConstellation.tsx  // Station 3 reveal
        EmpathyMap.tsx             // Station 4 reveal
        ReadinessRadar.tsx         // Station 5 reveal
        ThreeDoors.tsx             // Station 6 reveal
        IkigaiDiagram.tsx          // Grand Reveal diagram
      avatar/
        ColorPalettePicker.tsx     // Screen 1
        ToolBeltBuilder.tsx        // Screen 2
        WorkspaceDecorator.tsx     // Screen 3
  hooks/
    useDiscoveryEngine.ts          // Main state machine
    useStealthCapture.ts           // Behavioral signal collection
    useMentorState.ts              // Kit expression + speech management
    useStationProgress.ts          // Per-station activity tracking
    useDiscoveryAudio.ts           // Audio architecture (stub until sound ships)
    useAgeBand.ts                  // Age branching logic
  lib/
    discovery/
      archetypes.ts                // 6 archetype definitions + scoring
      stealth-signals.ts           // Behavioral composite computation
      profile-synthesis.ts         // Combine all data into DiscoveryProfile
      age-content.ts               // Age-branched content definitions
      station-config.ts            // Station definitions + activity lists
  public/
    discovery/
      backgrounds/                 // Station background images (WebP)
      mentors/
        kit.riv                    // Rive file for Kit
        kit-fallback.png           // Static fallback image
      tools/                       // 12 tool icon images
      desk-items/                  // 12 workspace item images
      scenes/                      // Scenario + scene selection images
      reveals/                     // Reveal background images
      identity-card-frame.png
      desk-base.webp
```

~40 component files + ~64 images + 1 Rive file.

---

## Part 12: Key Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **All illustrations** | ChatGPT image generation (gpt-image-1) | Rich, atmospheric, consistent style. Design students notice quality. |
| **Art style** | Warm painterly (Ghibli × Firewatch × Headspace) | Creative, not corporate. Warm, not cold. Textured, not flat. |
| **NOT using SVG illustrations** | NO inline SVGs for scenes/backgrounds | SVGs look like programmer art. Generated images feel like a real world. |
| **Overall layout** | Vertical scroll with station scenes | Mobile-first, accessible, no Safari bugs |
| **Avatar system** | Design Identity Card (color + tools + workspace) | 3 min, real data, no body image risk |
| **Mentor animation** | Rive state machines | Small files, interactive expressions, alive |
| **Mentor positioning** | Fixed right panel / bottom sheet mobile | Consistent, not distracting |
| **Celebrations** | Warm golden light bloom + light motes | Atmospheric, no confetti, feels studio-warm |
| **Activity transitions** | Framer Motion spring (slide left) | Forward momentum |
| **Station transitions** | AnimatePresence + warm light bloom | Clean separation, reveal moment |
| **Reveal visualizations** | SVG + Framer Motion on generated backgrounds | Full style control, atmospheric |
| **3D anything** | NO | Overkill, battery drain |
| **Dark mode** | YES — default for Discovery journey | Illustrations pop on dark, teens prefer dark |
| **Sound** | Architecture now, implementation later | Plug-in ready without blocking MVP |
| **Age branching** | Built from day one, content-driven | Data model supports it, no refactoring later |
| **Sharing** | Both in-app display + PNG export | Students want to show their profile |
| **MVP mentors** | Kit only, others later | Same rig, 1 week faster |
