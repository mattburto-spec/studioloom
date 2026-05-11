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
// Registry
// ────────────────────────────────────────────────────────────────────

export const PRODUCT_BRIEF_ARCHETYPES: Record<string, ProductBriefArchetype> = {
  [TOY_DESIGN_PB.id]: TOY_DESIGN_PB,
  [ARCHITECTURE_INTERIOR_PB.id]: ARCHITECTURE_INTERIOR_PB,
};

export function getProductBriefArchetype(
  id: string | null | undefined,
): ProductBriefArchetype | null {
  if (!id) return null;
  return PRODUCT_BRIEF_ARCHETYPES[id] ?? null;
}
