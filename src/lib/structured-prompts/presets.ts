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
  },
  {
    id: "noticed",
    label: "What did you NOTICE?",
    placeholder: "What surprised you, broke, or didn't go as expected?",
    helper: "Noticing the unexpected is the doorway to learning.",
    required: true,
    softCharCap: 400,
  },
  {
    id: "decided",
    label: "What did you DECIDE?",
    placeholder: "What did you change your mind about? I decided X because Y…",
    helper: "Use a because clause. Vague entries don't count as evidence.",
    required: true,
    softCharCap: 400,
  },
  {
    id: "next",
    label: "What's NEXT?",
    placeholder: "Your next move, and why that and not something else.",
    helper: "This auto-creates a card in your Kanban backlog.",
    required: true,
    softCharCap: 300,
  },
];
