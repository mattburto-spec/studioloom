/**
 * Pre-canned structured-prompts presets.
 *
 * `JOURNAL_PROMPTS` is the 4-prompt journal structure for the CO2 Racers
 * agency unit (and reusable for any maker / design unit that wants the
 * same pedagogical shape — Hatton & Smith reflection ladder + Schön
 * reflection-in-action + the Three Cs anchor on "Decided").
 *
 * See: docs/units/co2-racers-agency-unit.md §4.7 + co2-racers-cowork-response.md §3
 */

import type { StructuredPromptsConfig } from "./types";

/**
 * The 4-prompt journal preset — Did / Noticed / Decided / Next.
 *
 * - "Noticed" is the surprise-engineering slot (Cowork's strongest
 *   pedagogical move; turns description into reflection).
 * - "Decided" is the Three Cs anchor — students must include a `because`
 *   clause; this is the agency evidence trail.
 * - "Next" auto-feeds the Kanban (AG.2 wires this — moving the next-move
 *   into Backlog or This Class column on save).
 */
export const JOURNAL_PROMPTS: StructuredPromptsConfig = [
  {
    id: "did",
    label: "What did you DO?",
    placeholder: "What you actually did — not what you planned. Be specific.",
    helper: "Anti-fiction anchor. The gap between plan and reality is itself evidence.",
    required: true,
    softCharCap: 400,
    // End-of-class journal — a single specific sentence is enough.
    // Bumped down from default 80 after Matt's smoke: 80 was too long
    // for non-native speakers under time pressure.
    targetChars: 40,
    // Per-block sentenceStarters removed 13 May 2026 — Matt's call: defer
    // sentence-starter scaffolding to a future cross-block system rather
    // than authoring them per preset. Type field stays on StructuredPrompt
    // for forward compat; just no preset data here.
    criterion: "DO",
  },
  {
    id: "noticed",
    label: "What did you NOTICE?",
    placeholder: "What surprised you, broke, or didn't go as expected?",
    helper: "Noticing the unexpected is the doorway to learning.",
    required: true,
    softCharCap: 400,
    targetChars: 40,
    criterion: "NOTICE",
  },
  {
    id: "decided",
    label: "What did you DECIDE?",
    placeholder: "What did you change your mind about? I decided X because Y…",
    helper: "Use a because clause. Vague entries don't count as evidence.",
    required: true,
    softCharCap: 400,
    targetChars: 50, // Slightly higher — the "because" clause needs room.
    criterion: "DECIDE",
  },
  {
    id: "next",
    label: "What's NEXT?",
    placeholder: "Your next move, and why that and not something else.",
    helper: "This auto-creates a card in your Kanban backlog.",
    required: true,
    softCharCap: 300,
    targetChars: 30,
    criterion: "NEXT",
  },
];

// ─── AG.5 Anchor lesson presets (round 12, 6 May 2026) ────────────────────

/**
 * Class 1 — Strategy Canvas. Three first-day commitments that anchor
 * the unit. Per docs/units/co2-racers-agency-unit.md §4.11: kept as a
 * header strip on the timeline view, re-prompted at Class 7
 * ("anything changed?"). Auto-Kanban OFF — these aren't tasks.
 */
export const STRATEGY_CANVAS_PROMPTS: StructuredPromptsConfig = [
  {
    id: "philosophy",
    label: "Design philosophy",
    placeholder: "What approach are you taking, and why? (e.g. minimalist + low-mass / aerodynamic + ratio-tuned / structural-first / experimental)",
    helper: "Your guiding principle for the build. Will be re-read at Class 7.",
    required: true,
    softCharCap: 300,
  },
  {
    id: "biggest_risk",
    label: "Biggest risk",
    placeholder: "What's most likely to go wrong with this approach?",
    helper: "Naming it now is half the work. Honest > optimistic.",
    required: true,
    softCharCap: 300,
  },
  {
    id: "fallback_plan",
    label: "Fallback plan",
    placeholder: "If your biggest risk hits, what's plan B?",
    helper: "A real plan, not 'I'll figure it out'. The point is to think it through before the bandsaw is running.",
    required: true,
    softCharCap: 300,
  },
];

/**
 * Class 7 — Self-reread observation. Single deep prompt, one
 * deliberately wide field. Per agency-unit §4.6: highest-leverage
 * intervention. Schön reflection-on-action.
 */
export const SELF_REREAD_PROMPTS: StructuredPromptsConfig = [
  {
    id: "pattern",
    label: "What pattern do you notice?",
    placeholder: "Read your last 3 journal entries. What's the pattern? What's surprising about how you've been thinking?",
    helper: "Look across entries, not at any one. Patterns are evidence; one-offs aren't.",
    required: true,
    softCharCap: 600,
  },
];

/**
 * Class 14 — Final reflection. Deep agency-growth reflection,
 * side-by-side with the baseline survey from Class 1. Per
 * agency-unit §4.4 Class 14: 8-10 questions, deeper than mid-unit.
 * autoCreateKanbanCard OFF — race day is over, no more cards.
 */
export const FINAL_REFLECTION_PROMPTS: StructuredPromptsConfig = [
  {
    id: "biggest_change",
    label: "What's the biggest change in HOW you work since Class 1?",
    placeholder: "Compare your starting habits to your habits now. Be specific — not 'I learned a lot'.",
    helper: "Look at decisions, not skills. The point is metacognition, not technical wins.",
    required: true,
    softCharCap: 500,
  },
  {
    id: "biggest_decision",
    label: "What's the most important decision you made in this unit, and why?",
    placeholder: "Pick ONE decision. Walk through what you considered, what you chose, and why.",
    helper: "Causation is the C that gets thinnest under pressure. Show your reasoning.",
    required: true,
    softCharCap: 500,
  },
  {
    id: "evidence_of_change",
    label: "Where can you SEE evidence of change in your work?",
    placeholder: "Point to a specific journal entry, kanban card, or photo. What does it show that an earlier version of you wouldn't have done?",
    helper: "Cite evidence, not feelings.",
    required: true,
    softCharCap: 500,
  },
  {
    id: "agency_meaning",
    label: "What does agency mean to YOU now, after 14 classes of this?",
    placeholder: "Compare to your Class 1 'open journal entry' on this same question.",
    helper: "Honest changes welcome. So is 'I still don't really know'.",
    required: true,
    softCharCap: 500,
  },
  {
    id: "what_next",
    label: "What's one thing you'll carry into your next unit?",
    placeholder: "A habit, a way of thinking, a tool — something you didn't have at Class 1 that you'll keep using.",
    helper: "Future-tense reflection. The point is transfer.",
    required: false,
    softCharCap: 300,
  },
];
