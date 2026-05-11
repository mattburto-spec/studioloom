/**
 * Project Spec v1 — archetype definitions (Toy + Architecture only).
 *
 * Two seeded archetypes for tomorrow's G9 class (12 May 2026). The other
 * 4 archetypes from Matt's brief (Film / App / Fashion / Event-Service)
 * are filed as FU-PSB-ARCHETYPES-3-6 and added when needed.
 *
 * Lesson #44 (simplicity): copy lives in this TS file, not in a DB table.
 * No project_archetypes table in v1 — archetype IDs are stable kebab-case
 * strings referenced from student_unit_project_specs.archetype_id.
 *
 * Stability: archetype IDs are LOAD-BEARING. Once a student writes
 * project_specs.archetype_id = 'toy-design', the row's slot interpretation
 * depends on the slot definitions here being stable. Don't rename IDs.
 */

// ────────────────────────────────────────────────────────────────────
// Shared chip catalogs
// ────────────────────────────────────────────────────────────────────

/**
 * Materials catalog — shared across Toy slot 4 and Architecture slot 6.
 * 12 options covering common DT-lab materials. IDs are LOAD-BEARING
 * (persisted as slot_N.value.primary on student_unit_project_specs);
 * don't rename once students have picked. Add new IDs at the end.
 */
export const MATERIALS_CHIPS = [
  { id: "cardboard", label: "Cardboard", emoji: "📦" },
  { id: "foamboard", label: "Foamboard", emoji: "⬜" },
  { id: "balsa", label: "Balsa wood", emoji: "🪶" },
  { id: "pine", label: "Pine timber", emoji: "🪵" },
  { id: "ply-3mm", label: "3mm Plywood", emoji: "🟫" },
  { id: "laser-mdf", label: "Laser-cut MDF", emoji: "🪚" },
  { id: "laser-acrylic", label: "Laser-cut acrylic", emoji: "🟦" },
  { id: "3d-print", label: "3D print (PLA)", emoji: "🖨️" },
  { id: "resin", label: "Cast resin", emoji: "💧" },
  { id: "wire-metal", label: "Wire / sheet metal", emoji: "🔩" },
  { id: "clay", label: "Air-dry clay", emoji: "🧱" },
  { id: "mixed", label: "Mixed media", emoji: "🧩" },
] as const;

// ────────────────────────────────────────────────────────────────────
// Slot input types
// ────────────────────────────────────────────────────────────────────

export type SlotInputType =
  | { kind: "text"; maxWords?: number; maxChars?: number }
  | {
      kind: "text-multifield";
      fields: Array<{ label: string; maxWords?: number; maxChars?: number }>;
    }
  | {
      kind: "chip-picker";
      chips: Array<{ id: string; label: string; emoji?: string }>;
      allowSecondary?: {
        label: string;
        chips: Array<{ id: string; label: string }>;
      };
    }
  | {
      kind: "size-reference";
      references: Array<{ id: string; label: string; emoji: string }>;
      allowCm?: boolean;
    }
  | {
      kind: "number-pair";
      firstLabel: string;
      secondLabel: string;
      firstMin?: number;
      firstMax?: number;
      secondMin?: number;
      secondMax?: number;
      unit?: string;
    };

// ────────────────────────────────────────────────────────────────────
// Slot value (persisted shape) — discriminated union by kind
// ────────────────────────────────────────────────────────────────────

export type SlotValue =
  | { kind: "text"; text: string }
  | { kind: "text-multifield"; values: string[] }
  | { kind: "chip"; primary: string; secondary?: string }
  | {
      kind: "size";
      ref: string;
      cm?: { w?: number; h?: number; d?: number };
    }
  | { kind: "pair"; first: number; second: number };

/** Persisted per-slot answer. Stored in student_unit_project_specs.slot_N JSONB. */
export interface SlotAnswer {
  value?: SlotValue;
  skipped: boolean;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────────────
// Slot + archetype definitions
// ────────────────────────────────────────────────────────────────────

export interface SlotDefinition {
  title: string;
  subhead: string;
  input: SlotInputType;
  examples?: {
    strong: string[];
    weak: string[];
  };
}

export interface ArchetypeDefinition {
  id: string;
  label: string;
  emoji: string;
  slots: [
    SlotDefinition,
    SlotDefinition,
    SlotDefinition,
    SlotDefinition,
    SlotDefinition,
    SlotDefinition,
    SlotDefinition,
  ];
}

// ────────────────────────────────────────────────────────────────────
// Archetype 1: Toy / Game Design
// ────────────────────────────────────────────────────────────────────

const TOY_DESIGN: ArchetypeDefinition = {
  id: "toy-design",
  label: "Toy / Game Design",
  emoji: "🧸",
  slots: [
    {
      title: "What's your toy called?",
      subhead: "A name makes it real. 1–4 words. You can change it later.",
      input: { kind: "text", maxWords: 4 },
      examples: {
        strong: ["Marble Maze Reactor", "Pocket Fidget Cube", "The Drift Stick"],
        weak: ["My Toy", "Cool Game", "Untitled"],
      },
    },
    {
      title: "In one sentence — what does a user actually DO with it?",
      subhead: "Verbs, not adjectives. 25 words max.",
      input: { kind: "text", maxWords: 25 },
      examples: {
        strong: [
          "You spin the wheel, choose a category, and act out the prompt before the timer runs out.",
        ],
        weak: ["It's a fun game you play with friends."],
      },
    },
    {
      title: "What's the ONE thing that makes it work?",
      subhead: "The mechanism, the move, the surprise. 15 words max.",
      input: { kind: "text", maxWords: 15 },
      examples: {
        strong: ["Marbles travel down 3 modular ramps the user reconfigures between rounds."],
        weak: ["It has lots of cool features."],
      },
    },
    {
      title: "What will you build it from?",
      subhead: "Pick the main material. You can always combine — pick what dominates.",
      input: {
        kind: "chip-picker",
        chips: [...MATERIALS_CHIPS],
      },
    },
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
    {
      title: "Who will you put this in front of on Lesson 12?",
      subhead:
        "A real person. Name + relationship. Someone you can actually get hold of.",
      input: { kind: "text", maxChars: 60 },
      examples: {
        strong: ["My sister Maya, age 8", "Mr. Chen's Grade 4 class", "My cousin Theo, 11"],
        weak: ["A kid", "Someone younger", "My family"],
      },
    },
    {
      title: "Your test goes well if your user…",
      subhead: "One observable thing. Something you can WATCH happen.",
      input: { kind: "text", maxWords: 20 },
      examples: {
        strong: [
          "…figures out how to play in under 60 seconds without me explaining.",
          "…keeps playing for 5+ minutes without losing interest.",
        ],
        weak: ["…likes it", "…has fun", "…thinks it's cool"],
      },
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// Archetype 2: Architecture / Interior
// ────────────────────────────────────────────────────────────────────

const ARCHITECTURE_INTERIOR: ArchetypeDefinition = {
  id: "architecture-interior",
  label: "Architecture / Interior",
  emoji: "🏛️",
  slots: [
    {
      title: "What's your space called?",
      subhead: "1–4 words. Specific beats clever.",
      input: { kind: "text", maxWords: 4 },
      examples: {
        strong: ["Reading Tower", "Café for Cyclists", "Tiny Studio Loft"],
        weak: ["My Room", "The Building", "Untitled Space"],
      },
    },
    {
      title: "In one sentence — what's the core activity this space is FOR?",
      subhead: "A real person doing a real thing. 25 words max.",
      input: { kind: "text", maxWords: 25 },
      examples: {
        strong: [
          "A solo reader spends 2 uninterrupted hours with a book and natural light, drinking coffee.",
        ],
        weak: ["A nice cozy space to relax in."],
      },
    },
    {
      title: "Name 3 things that make this space yours.",
      subhead: "Concrete elements. Not vibes. 4 words each, max.",
      input: {
        kind: "text-multifield",
        fields: [
          { label: "Element 1", maxWords: 4 },
          { label: "Element 2", maxWords: 4 },
          { label: "Element 3", maxWords: 4 },
        ],
      },
      examples: {
        strong: ["Reading nook", "Skylight over chair", "Hidden book wall"],
        weak: ["Cozy", "Modern feel", "Good lighting"],
      },
    },
    {
      title: "What scale will you build at?",
      subhead: "Bigger scale = fewer details but more impact.",
      input: {
        kind: "chip-picker",
        chips: [
          { id: "1-10", label: "1:10 (big — chair = 8cm tall)" },
          { id: "1-20", label: "1:20 (balanced — chair = 4cm tall)" },
          { id: "1-50", label: "1:50 (whole building — chair = 1.5cm tall)" },
        ],
      },
    },
    {
      title: "How big is your model going to be?",
      subhead: "Two numbers. Has to fit on a desk.",
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
    {
      title: "What's your model made of?",
      subhead: "Pick the main material. You can always combine — pick what dominates.",
      input: {
        kind: "chip-picker",
        chips: [...MATERIALS_CHIPS],
      },
    },
    {
      title: "Who & what's the takeaway?",
      subhead:
        "Who do you present your model to on Lesson 13, and what should they walk away understanding?",
      input: {
        kind: "text-multifield",
        fields: [
          { label: "Presenting to", maxChars: 60 },
          { label: "They walk away understanding…", maxWords: 20 },
        ],
      },
      examples: {
        strong: [
          "The class + Mr. Burton",
          "…how natural light shapes how long someone stays in a space.",
        ],
        weak: ["Some people", "…that my model is good."],
      },
    },
  ],
};

// ────────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────────

export const ARCHETYPES: Record<string, ArchetypeDefinition> = {
  [TOY_DESIGN.id]: TOY_DESIGN,
  [ARCHITECTURE_INTERIOR.id]: ARCHITECTURE_INTERIOR,
};

export const ARCHETYPE_LIST: ArchetypeDefinition[] = [
  TOY_DESIGN,
  ARCHITECTURE_INTERIOR,
];

export function getArchetype(id: string | null | undefined): ArchetypeDefinition | null {
  if (!id) return null;
  return ARCHETYPES[id] ?? null;
}
