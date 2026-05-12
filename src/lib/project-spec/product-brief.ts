/**
 * Product Brief — v2 lesson-page activity slot definitions.
 *
 * Archetype-driven (Toy + Architecture in v2.0, expanding via
 * FU-PSV2-ARCHETYPES-3-6). 9 slots per archetype — adds precedents,
 * constraints, and technical risks on top of v1's 7-slot version.
 *
 * Archetype IDs match the v1 ARCHETYPES registry. The picker shares
 * v1's ARCHETYPE_LIST; once an archetype is selected, the Product
 * Brief block reads slot definitions from THIS file (independent
 * from v1's slot defs).
 *
 * Spec: docs/projects/project-spec-v2-split-brief.md §4 (🧰 Product
 * Brief block, 9 slots).
 */

import type { SlotDefinition } from "./archetypes";
import { MATERIALS_CHIPS } from "./archetypes";

export interface ProductBriefArchetype {
  id: string;
  label: string;
  emoji: string;
  slots: SlotDefinition[]; // length 9
}

// ────────────────────────────────────────────────────────────────────
// Shared chip catalogues
// ────────────────────────────────────────────────────────────────────

/**
 * Constraint chips for Product Brief slot 7. 6 options; student picks
 * 0-3 via the multi-chip-picker input. IDs are stable strings stored
 * in slot_7.value.selected; do not rename once students have written.
 */
export const CONSTRAINT_CHIPS = [
  { id: "time", label: "Limited time", emoji: "⏰" },
  { id: "cost", label: "Cost / budget", emoji: "💰" },
  { id: "ethical", label: "Ethical / fairness", emoji: "🤝" },
  { id: "weight", label: "Weight cap", emoji: "🏋️" },
  { id: "safety", label: "Safety / age", emoji: "🛡️" },
  { id: "accessibility", label: "Accessibility", emoji: "♿" },
] as const;

// ────────────────────────────────────────────────────────────────────
// Slots 4 + 5 — Primary + Secondary materials (shared across archetypes)
// ────────────────────────────────────────────────────────────────────

const PRIMARY_MATERIAL_SLOT: SlotDefinition = {
  title: "Primary material — what's it mostly made of?",
  subhead: "Pick the main material. You can always combine — pick what dominates.",
  input: {
    kind: "chip-picker",
    chips: [...MATERIALS_CHIPS],
  },
};

const SECONDARY_MATERIAL_SLOT: SlotDefinition = {
  title: "Secondary material (optional)",
  subhead:
    "If you'll combine two materials — pick the second. Skip if it's pure single-material.",
  input: {
    kind: "chip-picker",
    chips: [...MATERIALS_CHIPS],
  },
};

// ────────────────────────────────────────────────────────────────────
// Slot 7 — Constraints (shared across archetypes, multi-chip 0-3)
// ────────────────────────────────────────────────────────────────────

const CONSTRAINTS_SLOT: SlotDefinition = {
  title: "What constraints will you design around?",
  subhead: "Pick up to 3 things that genuinely shape this project. Empty is fine if there are none.",
  input: {
    kind: "multi-chip-picker",
    chips: [...CONSTRAINT_CHIPS],
    maxSelected: 3,
  },
};

// ────────────────────────────────────────────────────────────────────
// Slot 9 — Technical risks (shared across archetypes, 3-field text)
// ────────────────────────────────────────────────────────────────────

const TECHNICAL_RISKS_SLOT: SlotDefinition = {
  title: "Technical risks — what might break or be hard?",
  subhead: "Honest ones. Naming risks early lets you plan for them. Up to 3.",
  input: {
    kind: "text-multifield",
    fields: [
      { label: "Risk 1", maxWords: 15 },
      { label: "Risk 2 (optional)", maxWords: 15 },
      { label: "Risk 3 (optional)", maxWords: 15 },
    ],
  },
  examples: {
    strong: [
      "Laser-cut joints might be too loose at this scale",
      "Resin curing time conflicts with class schedule",
      "Marble weight might exceed cardboard track strength",
    ],
    weak: ["It might break", "I'm not sure", "Could go wrong"],
  },
};

// ────────────────────────────────────────────────────────────────────
// Archetype 1: Toy / Game Design — 9 slots
// ────────────────────────────────────────────────────────────────────

const TOY_DESIGN_PB: ProductBriefArchetype = {
  id: "toy-design",
  label: "Toy / Game Design",
  emoji: "🧸",
  slots: [
    // 1 — Project name
    {
      title: "What's your toy called?",
      subhead: "A name makes it real. 1–4 words. You can change it later.",
      input: { kind: "text", maxWords: 4 },
      examples: {
        strong: ["Marble Maze Reactor", "Pocket Fidget Cube", "The Drift Stick"],
        weak: ["My Toy", "Cool Game", "Untitled"],
      },
    },
    // 2 — Elevator pitch
    {
      title: "One-sentence elevator pitch — what does a user actually DO with it?",
      subhead: "Verbs, not adjectives. 25 words max.",
      input: { kind: "text", maxWords: 25 },
      examples: {
        strong: [
          "You spin the wheel, choose a category, and act out the prompt before the timer runs out.",
        ],
        weak: ["It's a fun game you play with friends."],
      },
    },
    // 3 — Core mechanism
    {
      title: "What's the ONE thing that makes it work?",
      subhead: "The mechanism, the move, the surprise. 15 words max.",
      input: { kind: "text", maxWords: 15 },
      examples: {
        strong: ["Marbles travel down 3 modular ramps the user reconfigures between rounds."],
        weak: ["It has lots of cool features."],
      },
    },
    // 4 — Primary material
    PRIMARY_MATERIAL_SLOT,
    // 5 — Secondary material
    SECONDARY_MATERIAL_SLOT,
    // 6 — Scale (size-reference for toys)
    {
      title: "How big is it?",
      subhead: "Pick the closest reference. Add cm if you already know.",
      input: {
        kind: "size-reference",
        references: [
          { id: "matchbox", label: "Matchbox (fits in palm)", emoji: "📦" },
          { id: "phone", label: "Phone (fits in hand)", emoji: "📱" },
          { id: "shoebox", label: "Shoebox (fits on desk)", emoji: "👟" },
          { id: "desk", label: "Desk-sized", emoji: "🖥️" },
        ],
        allowCm: true,
      },
    },
    // 7 — Constraints (shared)
    CONSTRAINTS_SLOT,
    // 8 — Precedents
    {
      title: "Precedents — what existing toy or game inspired you?",
      subhead:
        "Name 1–3 examples and what specifically you're borrowing from each. Be specific — 'cool toys' isn't useful.",
      input: { kind: "text", maxWords: 60 },
      examples: {
        strong: [
          "Operation (the buzzer feedback loop) + Marble Run (modular tracks). Borrowing the 'aim then react' tension from Operation.",
          "Beyblade — the spin-launch mechanism, but for a stationary spinner not a battler.",
        ],
        weak: ["Lego", "Cool toys I've seen"],
      },
    },
    // 9 — Technical risks (shared)
    TECHNICAL_RISKS_SLOT,
  ],
};

// ────────────────────────────────────────────────────────────────────
// Archetype 2: Architecture / Interior — 9 slots
// ────────────────────────────────────────────────────────────────────

const ARCHITECTURE_INTERIOR_PB: ProductBriefArchetype = {
  id: "architecture-interior",
  label: "Architecture / Interior",
  emoji: "🏛️",
  slots: [
    // 1 — Project name
    {
      title: "What's your space called?",
      subhead: "1–4 words. Specific beats clever.",
      input: { kind: "text", maxWords: 4 },
      examples: {
        strong: ["Reading Tower", "Café for Cyclists", "Tiny Studio Loft"],
        weak: ["My Room", "The Building", "Untitled Space"],
      },
    },
    // 2 — Elevator pitch
    {
      title: "One-sentence elevator pitch — what's the core activity this space is FOR?",
      subhead: "A real person doing a real thing. 25 words max.",
      input: { kind: "text", maxWords: 25 },
      examples: {
        strong: [
          "A solo reader spends 2 uninterrupted hours with a book and natural light, drinking coffee.",
        ],
        weak: ["A nice cozy space to relax in."],
      },
    },
    // 3 — Core mechanism (signature feature)
    {
      title: "What's the ONE thing that makes this space yours?",
      subhead:
        "The signature element. The thing that makes it not just any room. 15 words max.",
      input: { kind: "text", maxWords: 15 },
      examples: {
        strong: [
          "A reading nook that slides under a skylight when occupied.",
          "A wall of books that pivots open into a hidden study.",
        ],
        weak: ["Modern feel", "Good lighting", "Cozy vibe"],
      },
    },
    // 4 — Primary material
    PRIMARY_MATERIAL_SLOT,
    // 5 — Secondary material
    SECONDARY_MATERIAL_SLOT,
    // 6 — Scale (number-pair for architecture models)
    {
      title: "How big is your model going to be?",
      subhead: "Two numbers — width × depth in cm. Has to fit on a desk.",
      input: {
        kind: "number-pair",
        firstLabel: "Width",
        secondLabel: "Depth",
        firstMin: 20,
        firstMax: 60,
        secondMin: 20,
        secondMax: 60,
        unit: "cm",
      },
      examples: {
        strong: ["40 × 30 cm"],
        weak: [],
      },
    },
    // 7 — Constraints (shared)
    CONSTRAINTS_SLOT,
    // 8 — Precedents
    {
      title: "Precedents — what existing building or space inspired you?",
      subhead:
        "Name 1–3 examples (real buildings, films, photos) and what specifically you're borrowing.",
      input: { kind: "text", maxWords: 60 },
      examples: {
        strong: [
          "Tadao Ando's Church of Light (controlled natural light) + my grandmother's reading chair (the alcove geometry).",
        ],
        weak: ["Modern buildings", "Cool architecture"],
      },
    },
    // 9 — Technical risks (shared)
    TECHNICAL_RISKS_SLOT,
  ],
};

// ────────────────────────────────────────────────────────────────────
// Archetype 3: App / Digital Tool — 9 slots
// ────────────────────────────────────────────────────────────────────
// Added 12 May 2026 to ground the 3 G8 ships_to_platform Choice Cards
// (Designer Mentor, Studio Theme, Scaffold). Designed to flex across:
//   - designer/mentor characters (persona + question set)
//   - studio themes (palette + prompts + mood)
//   - student scaffolds (trigger + UX flow + AI behaviour)
// Slot 4/5 use a `medium` chip catalogue (text, character, theme,
// interactive, visual, code, sound, data) rather than physical
// materials. Slot 6 uses a "scope" size-reference (single-prompt →
// multi-screen system) — analogue to physical scale.

const DIGITAL_MEDIUM_CHIPS = [
  { id: "text-prompt", label: "Text / prompt", emoji: "📝" },
  { id: "character", label: "Character / persona", emoji: "👤" },
  { id: "theme-palette", label: "Theme / palette", emoji: "🎨" },
  { id: "interactive-flow", label: "Interactive flow", emoji: "🔀" },
  { id: "visual-image", label: "Visual / image", emoji: "🖼️" },
  { id: "code-logic", label: "Code / logic", emoji: "⚙️" },
  { id: "sound", label: "Sound", emoji: "🎵" },
  { id: "data-schema", label: "Data / schema", emoji: "🗂️" },
  { id: "mixed", label: "Mixed media", emoji: "🧩" },
] as const;

const APP_DIGITAL_TOOL_PB: ProductBriefArchetype = {
  id: "app-digital-tool",
  label: "App / Digital Tool",
  emoji: "✨",
  slots: [
    // 1 — Project name
    {
      title: "What's your tool called?",
      subhead: "1–4 words. Specific beats clever.",
      input: { kind: "text", maxWords: 4 },
      examples: {
        strong: ["Ramsey", "The Quiet Forge", "Stuck-Moment Lifeline"],
        weak: ["My Tool", "Cool Idea", "Untitled"],
      },
    },
    // 2 — Elevator pitch
    {
      title: "One-sentence elevator pitch — who uses it and what do they actually DO?",
      subhead: "Verbs, not adjectives. 25 words max.",
      input: { kind: "text", maxWords: 25 },
      examples: {
        strong: [
          "A G8 student stuck on ideation asks the mentor a question and gets back 3 sketch prompts in the mentor's voice.",
          "A teacher picks a domain, gets a 5-colour palette plus 5 starter prompts students will see when they enter that theme.",
        ],
        weak: ["A really useful AI thing", "It helps students."],
      },
    },
    // 3 — Core mechanism
    {
      title: "What's the ONE thing that makes it work?",
      subhead: "The mechanism, the move, the trigger. 15 words max.",
      input: { kind: "text", maxWords: 15 },
      examples: {
        strong: [
          "Mentor asks a question back instead of giving an answer — Socratic loop.",
          "Theme triggers on student choosing the domain and re-skins the whole studio.",
          "Scaffold detects 5+ idle minutes and surfaces a 3-prompt 'unstick' card.",
        ],
        weak: ["Uses AI", "It's interactive"],
      },
    },
    // 4 — Primary medium
    {
      title: "Primary medium — what's it mostly made of?",
      subhead: "Pick the one that does most of the work. You can combine — pick what dominates.",
      input: { kind: "chip-picker", chips: [...DIGITAL_MEDIUM_CHIPS] },
    },
    // 5 — Secondary medium (optional)
    {
      title: "Secondary medium (optional)",
      subhead: "If you'll combine two mediums — pick the second. Skip if it's pure single-medium.",
      input: { kind: "chip-picker", chips: [...DIGITAL_MEDIUM_CHIPS] },
    },
    // 6 — Scope (size-reference for digital)
    {
      title: "How big is it?",
      subhead: "Pick the closest scope. Bigger isn't better — small and sharp wins.",
      input: {
        kind: "size-reference",
        references: [
          { id: "single-prompt", label: "Single prompt (one moment)", emoji: "💬" },
          { id: "mini-pattern", label: "Mini pattern (3–5 prompts)", emoji: "🧩" },
          { id: "full-flow", label: "Full flow (multi-step UX)", emoji: "🔀" },
          { id: "system", label: "Multi-screen system", emoji: "🖼️" },
        ],
        allowCm: false,
      },
    },
    // 7 — Constraints (shared)
    CONSTRAINTS_SLOT,
    // 8 — Precedents
    {
      title: "Precedents — what existing tool, character, or theme inspired you?",
      subhead:
        "Name 1–3 (real apps, characters, themes, AI mentors) and what specifically you're borrowing. Be specific.",
      input: { kind: "text", maxWords: 60 },
      examples: {
        strong: [
          "Duolingo's owl Duo (passive-aggressive nudge) + Khan Academy's hint ladder (gradual reveal). Borrowing the nudge tone for the stuck-moment trigger.",
          "Sir Jony Ive (the obsessive material focus) + Dieter Rams (the 10 principles). I'm borrowing both lenses for the mentor character.",
        ],
        weak: ["AI mentors I've seen", "Cool apps"],
      },
    },
    // 9 — Technical risks (shared)
    TECHNICAL_RISKS_SLOT,
  ],
};

// ────────────────────────────────────────────────────────────────────
// Archetype 4: Film / Video — 9 slots
// ────────────────────────────────────────────────────────────────────

const FILM_FORMAT_CHIPS = [
  { id: "live-action", label: "Live action", emoji: "🎥" },
  { id: "animation-2d", label: "Animation 2D", emoji: "🎨" },
  { id: "stop-motion", label: "Stop-motion", emoji: "🧱" },
  { id: "documentary", label: "Documentary", emoji: "📹" },
  { id: "mixed-format", label: "Mixed format", emoji: "🎬" },
];

const FILM_VIDEO_PB: ProductBriefArchetype = {
  id: "film-video",
  label: "Film / Video",
  emoji: "🎬",
  slots: [
    {
      title: "What's your film called?",
      subhead: "Working title. 1–6 words.",
      input: { kind: "text", maxWords: 6 },
      examples: {
        strong: ["Last Bus Home", "How To Vanish", "The Long Walk"],
        weak: ["My Movie", "Untitled Film"],
      },
    },
    {
      title: "One-sentence elevator pitch — what does a viewer EXPERIENCE?",
      subhead: "What do they see, hear, feel happen? 25 words max.",
      input: { kind: "text", maxWords: 25 },
      examples: {
        strong: [
          "A teenager walks home in silence for 4 minutes while the city soundscape slowly reveals what she's running from.",
        ],
        weak: ["It's a cool film about life."],
      },
    },
    {
      title: "What's the ONE thing that makes this film work?",
      subhead: "The hook, the twist, the reveal. 15 words max.",
      input: { kind: "text", maxWords: 15 },
      examples: {
        strong: ["The audience doesn't realise it's a memory until the final shot."],
        weak: ["It has lots of cool scenes."],
      },
    },
    {
      title: "Primary format — how are you shooting it?",
      subhead: "Pick the main format. You can mix later if needed.",
      input: { kind: "chip-picker", chips: [...FILM_FORMAT_CHIPS] },
    },
    {
      title: "Secondary format (optional)",
      subhead: "If combining two — pick the second. Skip otherwise.",
      input: { kind: "chip-picker", chips: [...FILM_FORMAT_CHIPS] },
    },
    {
      title: "How long is it?",
      subhead: "Pick the closest length. Shorter is usually stronger for first films.",
      input: {
        kind: "chip-picker",
        chips: [
          { id: "30s", label: "30 sec (one moment)", emoji: "⚡" },
          { id: "1min", label: "1 min (one beat)", emoji: "🎯" },
          { id: "2-3min", label: "2–3 min (a short scene)", emoji: "📍" },
          { id: "5plus", label: "5+ min (multi-scene)", emoji: "📚" },
        ],
      },
    },
    CONSTRAINTS_SLOT,
    {
      title: "Precedents — what existing film or scene inspired you?",
      subhead:
        "Name 1–3 examples (films, music videos, ads) and what specifically you're borrowing.",
      input: { kind: "text", maxWords: 60 },
      examples: {
        strong: [
          "Spike Jonze's 'Where the Wild Things Are' for the lonely-kid atmosphere + the slow zoom from 'There Will Be Blood' final shot.",
        ],
        weak: ["Cool movies", "Films I like"],
      },
    },
    TECHNICAL_RISKS_SLOT,
  ],
};

// ────────────────────────────────────────────────────────────────────
// Archetype 5: Fashion / Wearable — 9 slots
// ────────────────────────────────────────────────────────────────────

const FASHION_MATERIAL_CHIPS = [
  { id: "cotton-canvas", label: "Cotton / canvas", emoji: "👕" },
  { id: "denim", label: "Denim", emoji: "👖" },
  { id: "synthetic", label: "Synthetic / technical", emoji: "🦺" },
  { id: "recycled", label: "Recycled / upcycled", emoji: "♻️" },
  { id: "wool-felt", label: "Wool / felt", emoji: "🧶" },
  { id: "mixed", label: "Mixed media", emoji: "🧩" },
];

const FASHION_WEARABLE_PB: ProductBriefArchetype = {
  id: "fashion-wearable",
  label: "Fashion / Wearable",
  emoji: "👗",
  slots: [
    {
      title: "What's your piece called?",
      subhead: "1–4 words. Working title.",
      input: { kind: "text", maxWords: 4 },
      examples: {
        strong: ["Storm Coat", "Bike Light Vest", "Reversible Bag"],
        weak: ["My Outfit", "Untitled Piece"],
      },
    },
    {
      title: "One-sentence elevator pitch — what does the wearer DO with it?",
      subhead: "Function and context. A specific moment of use. 25 words max.",
      input: { kind: "text", maxWords: 25 },
      examples: {
        strong: [
          "A cyclist wears this vest at night and is visible from 100m without looking like a construction worker.",
        ],
        weak: ["It looks cool and people wear it."],
      },
    },
    {
      title: "What's the ONE thing that makes it special?",
      subhead: "The construction move, hidden feature, silhouette signature. 15 words max.",
      input: { kind: "text", maxWords: 15 },
      examples: {
        strong: ["The reflective panels are hidden inside pleats until the wearer moves."],
        weak: ["It has nice details."],
      },
    },
    {
      title: "Primary fabric / material",
      subhead: "What it's mostly made of.",
      input: { kind: "chip-picker", chips: [...FASHION_MATERIAL_CHIPS] },
    },
    {
      title: "Secondary fabric / material (optional)",
      subhead: "If combining — pick the second. Skip otherwise.",
      input: { kind: "chip-picker", chips: [...FASHION_MATERIAL_CHIPS] },
    },
    {
      title: "What scale are you making?",
      subhead: "Display-scale model or actually wearable?",
      input: {
        kind: "chip-picker",
        chips: [
          { id: "doll", label: "Doll/model scale (display)", emoji: "🪆" },
          { id: "wearable-you", label: "Wearable — your size", emoji: "🧍" },
          { id: "wearable-user", label: "Wearable — test user's size", emoji: "🧑" },
        ],
      },
    },
    CONSTRAINTS_SLOT,
    {
      title: "Precedents — what existing piece or designer inspired you?",
      subhead: "Name 1–3 references + what specifically you're borrowing.",
      input: { kind: "text", maxWords: 60 },
      examples: {
        strong: [
          "Issey Miyake's pleating (the way fabric moves) + Patagonia's hidden-utility pocket placement. Borrowing 'function disguised as form'.",
        ],
        weak: ["Cool fashion", "Famous designers"],
      },
    },
    TECHNICAL_RISKS_SLOT,
  ],
};

// ────────────────────────────────────────────────────────────────────
// Archetype 6: Event / Service / Performance — 9 slots
// ────────────────────────────────────────────────────────────────────

const EVENT_FORMAT_CHIPS = [
  { id: "one-off", label: "Single one-off event", emoji: "🎉" },
  { id: "recurring", label: "Weekly recurring", emoji: "🔁" },
  { id: "popup", label: "Pop-up service", emoji: "⛺" },
  { id: "performance", label: "Performance", emoji: "🎭" },
  { id: "installation", label: "Installation", emoji: "🖼️" },
];

const EVENT_SERVICE_PERFORMANCE_PB: ProductBriefArchetype = {
  id: "event-service-performance",
  label: "Event / Service / Performance",
  emoji: "🎤",
  slots: [
    {
      title: "What's your event or service called?",
      subhead: "1–4 words. Tells someone what to expect.",
      input: { kind: "text", maxWords: 4 },
      examples: {
        strong: ["Lunch Swap", "Quiet Hour Library", "Senior Citizen Game Night"],
        weak: ["My Event", "Untitled Service"],
      },
    },
    {
      title: "One-sentence elevator pitch — what HAPPENS for the participant?",
      subhead: "Specific action + outcome. 25 words max.",
      input: { kind: "text", maxWords: 25 },
      examples: {
        strong: [
          "Students bring one homemade dish and trade it for someone else's during a 20-minute lunchtime slot.",
        ],
        weak: ["People come and have a good time."],
      },
    },
    {
      title: "What's the ONE thing that makes it work?",
      subhead: "The rule, format, or structure that makes it not just a party. 15 words max.",
      input: { kind: "text", maxWords: 15 },
      examples: {
        strong: ["Every participant must explain their dish in one sentence before trading."],
        weak: ["It has lots of activities."],
      },
    },
    {
      title: "Primary format",
      subhead: "The main shape of the experience.",
      input: { kind: "chip-picker", chips: [...EVENT_FORMAT_CHIPS] },
    },
    {
      title: "Secondary format (optional)",
      subhead: "If combining — pick the second. Skip otherwise.",
      input: { kind: "chip-picker", chips: [...EVENT_FORMAT_CHIPS] },
    },
    {
      title: "How long + how many people?",
      subhead: "Duration in minutes (15–120) × number of participants (5–50).",
      input: {
        kind: "number-pair",
        firstLabel: "Minutes",
        secondLabel: "Participants",
        firstMin: 15,
        firstMax: 120,
        secondMin: 5,
        secondMax: 50,
      },
      examples: {
        strong: ["20 × 15 (20 min, 15 people)"],
        weak: [],
      },
    },
    CONSTRAINTS_SLOT,
    {
      title: "Precedents — what existing event or service inspired you?",
      subhead: "Name 1–3 references + what specifically you're borrowing.",
      input: { kind: "text", maxWords: 60 },
      examples: {
        strong: [
          "Speed-dating's rotating-pairs format + community pot-luck dinners. Borrowing 'forced novelty' + 'shared contribution'.",
        ],
        weak: ["Things I've been to", "Cool events"],
      },
    },
    TECHNICAL_RISKS_SLOT,
  ],
};

// ────────────────────────────────────────────────────────────────────
// Archetype 7: Other / Pitch your own — 9 slots
//
// Generic free-form slots for projects that don't fit any preset
// archetype. Companion to the Choice Cards `_pitch-your-own` sentinel
// (src/lib/choice-cards/resolve-for-unit.ts) — when a student picks
// "Pitch your own idea" in Choice Cards, they land on the archetype
// picker and the natural choice is "Other".
// ────────────────────────────────────────────────────────────────────

const OTHER_FREEFORM_PB: ProductBriefArchetype = {
  id: "other",
  label: "Other / Pitch your own",
  emoji: "💡",
  slots: [
    {
      title: "What's your project called?",
      subhead: "1–4 words. A working title makes it feel real.",
      input: { kind: "text", maxWords: 4 },
      examples: {
        strong: [],
        weak: ["My Project", "Untitled"],
      },
    },
    {
      title: "One-sentence elevator pitch — what does it DO?",
      subhead: "Specific action + who it's for. 25 words max.",
      input: { kind: "text", maxWords: 25 },
      examples: {
        strong: [],
        weak: ["It's a thing I'm making."],
      },
    },
    {
      title: "What's the ONE thing that makes it work?",
      subhead: "The mechanism, format, or unique move. 15 words max.",
      input: { kind: "text", maxWords: 15 },
      examples: {
        strong: [],
        weak: ["It has lots of features."],
      },
    },
    {
      title: "Primary medium",
      subhead: "What's it built from / where does it live? Free-form — be specific.",
      input: { kind: "text", maxWords: 12 },
      examples: {
        strong: [
          "Audio recording + paper booklet",
          "Live performance with custom-built props",
          "Web page + printed companion zine",
        ],
        weak: ["Stuff", "Materials"],
      },
    },
    {
      title: "Secondary medium (optional)",
      subhead: "If combining — describe it. Skip otherwise.",
      input: { kind: "text", maxWords: 12 },
    },
    {
      title: "Scale — describe the size or duration",
      subhead: "How big? How long? Free-form because every project is different.",
      input: { kind: "text", maxWords: 20 },
      examples: {
        strong: [
          "A4 zine, 12 pages, ~3 minutes to read",
          "1m × 1m installation in the school foyer for one week",
          "Audio piece, 8 minutes, single-channel headphone listening",
        ],
        weak: ["Medium-sized", "A while"],
      },
    },
    CONSTRAINTS_SLOT,
    {
      title: "Precedents — what existing thing inspired you?",
      subhead: "Name 1–3 examples + what specifically you're borrowing.",
      input: { kind: "text", maxWords: 60 },
    },
    TECHNICAL_RISKS_SLOT,
  ],
};

// ────────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────────

export const PRODUCT_BRIEF_ARCHETYPES: Record<string, ProductBriefArchetype> = {
  [TOY_DESIGN_PB.id]: TOY_DESIGN_PB,
  [ARCHITECTURE_INTERIOR_PB.id]: ARCHITECTURE_INTERIOR_PB,
  [APP_DIGITAL_TOOL_PB.id]: APP_DIGITAL_TOOL_PB,
  [FILM_VIDEO_PB.id]: FILM_VIDEO_PB,
  [FASHION_WEARABLE_PB.id]: FASHION_WEARABLE_PB,
  [EVENT_SERVICE_PERFORMANCE_PB.id]: EVENT_SERVICE_PERFORMANCE_PB,
  [OTHER_FREEFORM_PB.id]: OTHER_FREEFORM_PB,
};

/**
 * Ordered list for the Product Brief archetype picker. Order = picker
 * tile order. "Other / Pitch your own" stays last so it reads as the
 * escape hatch, not as an equal option to the preset archetypes.
 */
export const PRODUCT_BRIEF_ARCHETYPE_LIST: ProductBriefArchetype[] = [
  TOY_DESIGN_PB,
  ARCHITECTURE_INTERIOR_PB,
  APP_DIGITAL_TOOL_PB,
  FILM_VIDEO_PB,
  FASHION_WEARABLE_PB,
  EVENT_SERVICE_PERFORMANCE_PB,
  OTHER_FREEFORM_PB,
];

export function getProductBriefArchetype(
  id: string | null | undefined,
): ProductBriefArchetype | null {
  if (!id) return null;
  return PRODUCT_BRIEF_ARCHETYPES[id] ?? null;
}
