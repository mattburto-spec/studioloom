/**
 * Success Criteria — v2 lesson-page activity slot definitions.
 *
 * UNIVERSAL across archetypes. Every project needs a way to evaluate
 * it. Replaces v1's single Q7 ("your test goes well if…") with 5
 * slots covering observable signal, measurement protocol, test setup,
 * failure mode, iteration trigger.
 *
 * Pedagogically: teaches students to think like researchers, not
 * designers — plan logistics + decide failure modes before building.
 *
 * Spec: docs/projects/project-spec-v2-split-brief.md §4 (🎯 Success
 * Criteria block, 5 slots).
 */

import type { SlotDefinition } from "./archetypes";

export const MEASUREMENT_PROTOCOL_CHIPS = [
  { id: "timed", label: "Timed (stopwatch)", emoji: "⏱️" },
  { id: "counted", label: "Counted (tally)", emoji: "🔢" },
  { id: "qualitative", label: "Qualitative (notes)", emoji: "📝" },
  { id: "before-after", label: "Before / after", emoji: "🔄" },
  { id: "scale", label: "1–5 rating", emoji: "⭐" },
] as const;

export const SUCCESS_CRITERIA_SLOTS: SlotDefinition[] = [
  // 1 — Observable success signal
  {
    title: "What WILL happen if it works?",
    subhead:
      "One observable behaviour you can WATCH happen. Not 'they liked it' — that's opinion. 20 words max.",
    input: { kind: "text", maxWords: 20 },
    examples: {
      strong: [
        "She figures out how to play in under 60 seconds without me explaining.",
        "He reaches the top shelf without asking for help on the first try.",
        "Three of five testers ask 'where can I get one?' within 2 minutes of using it.",
      ],
      weak: ["They like it", "They have fun", "It's cool"],
    },
  },
  // 2 — Measurement protocol
  {
    title: "How will you measure it?",
    subhead: "Pick the protocol that fits — different signals demand different evidence.",
    input: {
      kind: "chip-picker",
      chips: [...MEASUREMENT_PROTOCOL_CHIPS],
    },
  },
  // 3 — Test setup
  {
    title: "Test setup",
    subhead: "Plan the logistics now. If you can't answer these 4, you'll waste a class on day 1.",
    input: {
      kind: "text-multifield",
      fields: [
        { label: "Where", maxWords: 10 },
        { label: "When (date / time of day)", maxWords: 10 },
        { label: "How long", maxWords: 8 },
        { label: "Who watches / takes notes", maxWords: 10 },
      ],
    },
    examples: {
      strong: [
        "My kitchen table",
        "Saturday afternoon, after lunch",
        "20 minutes",
        "Me (filming on phone) + my mum (taking notes)",
      ],
      weak: ["Anywhere", "Whenever", "A while", "Someone"],
    },
  },
  // 4 — Failure mode
  {
    title: "What does 'going wrong' look like?",
    subhead:
      "Specific failure signal. If you see THIS during the test, you know it didn't work. 25 words max.",
    input: { kind: "text", maxWords: 25 },
    examples: {
      strong: [
        "She loses interest in under 30 seconds and reaches for her phone.",
        "He still asks for help on the second attempt.",
        "Two of five testers say 'I don't get it' before finishing the first task.",
      ],
      weak: ["It doesn't work", "Nobody likes it", "Things go badly"],
    },
  },
  // 5 — Iteration trigger
  {
    title: "Iteration trigger — at what point would you redesign?",
    subhead:
      "Set the bar BEFORE the test. Stops you handwaving away bad results after the fact. 20 words max.",
    input: { kind: "text", maxWords: 20 },
    examples: {
      strong: [
        "If 2 of 3 testers can't figure it out without help, I scrap the controls.",
        "If anyone gives up before 2 minutes, the mechanism needs rethinking.",
      ],
      weak: ["If it fails", "If it's bad", "Maybe redesign it"],
    },
  },
];
