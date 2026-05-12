/**
 * Pure type module split out of `BlockPalette.tsx` so `.test.ts` files
 * (and any other JSX-free importer) can pick up the type definitions
 * without vitest's default config tripping on JSX syntax.
 *
 * `BlockPalette.tsx` re-exports these so the existing public surface
 * stays unchanged.
 */

import type { ActivitySection } from "@/types";

export interface BlockDefinition {
  id: string;
  label: string;
  /** @deprecated Kept for backward compat — not rendered in palette */
  icon: string;
  category: BlockCategory;
  description: string;
  /** Which Workshop Model phase this block naturally fits in */
  defaultPhase: "opening" | "miniLesson" | "workTime" | "debrief" | "any";
  /** Factory function to create the ActivitySection */
  create: () => ActivitySection;
  /** Optional: marks this block as user-added or imported */
  source?: "built-in" | "custom" | "imported";
  /**
   * Lever-MM (NM block category): when set, this block represents an NM
   * competency element rather than a regular activity. Click → register
   * a checkpoint on the current lesson via onAddNmCheckpoint instead of
   * onAddBlock. The `create()` factory is a no-op stub for these — never
   * called through the regular onAddBlock path.
   */
  nmElementId?: string;
  /** Lever-MM: parent competency ID for NM-element blocks (so the click handler can persist it). */
  nmCompetencyId?: string;
}

export type BlockCategory =
  | "response"
  | "content"
  | "toolkit"
  | "assessment"
  | "collaboration"
  | "custom"
  /** Lever-MM: New Metrics competency elements. Empty when school's `use_new_metrics` flag is off. */
  | "new_metrics";

/**
 * Choice Cards block (12 May 2026) — deck composition + behaviour.
 *
 * Stored on `ActivitySection.choiceCardsConfig`. The block fetches
 * choice_cards rows by `cardIds` (slugs) at render time and renders a
 * Framer Motion grid; students pick one card and the system writes to
 * `choice_card_selections` + emits a `choice-card.picked` learning_event.
 *
 * v1: `selectionMode="single"` and `layout="grid"` are the only
 * functional values. `multi` / `fan` / `stack` are reserved for v2.
 */
export interface ChoiceCardsBlockConfig {
  /** Slugs of choice_cards to render. Order matters — grid lays out left-to-right top-to-bottom. */
  cardIds: string[];
  /** v1: only "single" is implemented. "multi" reserved for constraint cards in v2. */
  selectionMode: "single" | "multi";
  /** When true, an extra dashed "+ pitch your own idea" card appears at the end. */
  showPitchYourOwn: boolean;
  /** v1: only "grid" is functional. "fan" / "stack" are visual presets for v2 (`FU-CCB-LAYOUT-FAN-STACK`). */
  layout: "grid" | "fan" | "stack";
}
