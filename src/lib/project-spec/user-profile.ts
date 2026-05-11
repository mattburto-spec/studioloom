/**
 * User Profile — v2 lesson-page activity slot definitions.
 *
 * UNIVERSAL across archetypes. Every project has a user; this block
 * doesn't need to know whether the project is a toy, an architectural
 * model, or anything else.
 *
 * Replaces v1's single Q6 ("test user name + relationship") with 8
 * slots covering name + age + context + problem + alternatives +
 * unique value + optional photo + optional quote. Pedagogical anchor
 * for real empathy work.
 *
 * Spec: docs/projects/project-spec-v2-split-brief.md §4 (👤 User
 * Profile block, 8 slots).
 */

import type { SlotDefinition } from "./archetypes";

export const AGE_BAND_CHIPS = [
  { id: "early-childhood", label: "0-5 (early childhood)", emoji: "🍼" },
  { id: "primary", label: "6-10 (primary)", emoji: "🎒" },
  { id: "middle", label: "11-14 (middle)", emoji: "📚" },
  { id: "secondary", label: "15-18 (secondary)", emoji: "🎓" },
  { id: "adult", label: "Adult", emoji: "👤" },
  { id: "mixed", label: "Mixed ages", emoji: "👨‍👩‍👧" },
] as const;

export const USER_PROFILE_SLOTS: SlotDefinition[] = [
  // 1 — User name + relationship
  {
    title: "Who is this for? Name + relationship",
    subhead:
      "A real person. Name + how you know them. Someone you can actually talk to.",
    input: { kind: "text", maxChars: 60 },
    examples: {
      strong: [
        "My sister Maya, age 8",
        "Mr Chen's Grade 4 class",
        "My grandmother (lives upstairs)",
      ],
      weak: ["A kid", "Someone younger", "My family"],
    },
  },
  // 2 — Age band
  {
    title: "Age band",
    subhead: "Pick the closest band. Mixed is fine if it's a varied group.",
    input: {
      kind: "chip-picker",
      chips: [...AGE_BAND_CHIPS],
    },
  },
  // 3 — Where & when used
  {
    title: "Where & when would they use it?",
    subhead: "Specific time + place. Frequency if relevant. 30 words max.",
    input: { kind: "text", maxWords: 30 },
    examples: {
      strong: [
        "After school in her bedroom, while doing homework — 3-4 evenings a week.",
        "Saturday mornings in the community garden, with her dad watching nearby.",
      ],
      weak: ["At home sometimes", "Whenever they feel like it"],
    },
  },
  // 4 — Problem they're trying to solve
  {
    title: "What problem are they trying to solve?",
    subhead:
      "From THEIR perspective, not yours. What's frustrating about life today? 30 words max.",
    input: { kind: "text", maxWords: 30 },
    examples: {
      strong: [
        "She gets distracted and forgets what she was doing, then has to start her homework again.",
        "He can't reach the top shelf and asks for help every time, which embarrasses him.",
      ],
      weak: ["They want something fun", "They need a thing"],
    },
  },
  // 5 — What exists today + why it doesn't fit
  {
    title: "What exists today + why it doesn't fit",
    subhead:
      "What do they use now (or wish for)? Why isn't it working? Be specific.",
    input: {
      kind: "text-multifield",
      fields: [
        { label: "What they use today", maxWords: 15 },
        { label: "Why it doesn't fit them", maxWords: 20 },
      ],
    },
    examples: {
      strong: [
        "Sticky notes",
        "She loses them and they don't stay where she puts them.",
      ],
      weak: ["Nothing", "I don't know"],
    },
  },
  // 6 — Why they'd care about your version
  {
    title: "Why would they care about YOUR version?",
    subhead:
      "The unique value. What makes yours land for THIS person specifically? 25 words max.",
    input: { kind: "text", maxWords: 25 },
    examples: {
      strong: [
        "It stays put because it clips onto her desk, and the colours match her room.",
        "It's adjustable so it grows with him over the next 2 years.",
      ],
      weak: ["It's better", "They'll love it"],
    },
  },
  // 7 — Optional photo / sketch (NEW input kind: image-upload)
  {
    title: "Photo or sketch of your user (optional)",
    subhead:
      "Optional — a photo of them, or them using a current alternative. Helps you stay grounded.",
    input: {
      kind: "image-upload",
      bucket: "user-profile-photos",
      altPlaceholder: "Caption (who they are, what they're doing)",
    },
  },
  // 8 — Quote / observation
  {
    title: "Quote or observation from talking to them (optional)",
    subhead:
      "Their actual words, OR what you observed when watching them. Pushes you toward real research.",
    input: { kind: "text", maxWords: 40 },
    examples: {
      strong: [
        '"I just give up and play on my phone instead." — Maya, when I asked her about her homework spot.',
        "Watched him try 3 times to reach the shelf, then walk away. Didn't ask for help.",
      ],
      weak: ["They liked my idea", "Said it was cool"],
    },
  },
];
