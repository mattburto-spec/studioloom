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

/**
 * Inspiration Board block (12 May 2026) — board behaviour config.
 *
 * Stored on `ActivitySection.inspirationBoardConfig`. The block fetches
 * the student's archetype on mount (via getStudentArchetype) and reads
 * archetype-aware content via getArchetypeAwareContent. Students upload
 * 3–5 images, write commentary on each, then synthesise the pattern.
 */
export interface InspirationBoardConfig {
  /** Minimum images before the synthesis prompt unlocks + Mark complete enables. Default 3. */
  minItems: number;
  /** Max images. Upload button disables at this cap. Default 5. */
  maxItems: number;
  /** When true, each image requires a commentary sentence to count toward minItems. Default true. */
  requireCommentary: boolean;
  /** When true, the synthesis card appears below the grid once minItems reached. Default true. */
  showSynthesisPrompt: boolean;
  /** When true, each card surfaces an optional "What would you steal?" follow-up. Default false. */
  showStealPrompt: boolean;
  /** When true, students can paste an image URL instead of uploading a file. Default true. */
  allowUrlPaste: boolean;
}

/**
 * First Move block (12 May 2026) — studio-open orientation.
 *
 * Stored on `ActivitySection.firstMoveConfig`. Block fetches consolidated
 * payload from /api/student/first-move/[unitId] on mount (design
 * philosophy + last journal NEXT + this_class kanban cards) and renders
 * a hero card + commitment field. POST to .../commit moves the chosen
 * kanban card to "doing" (demoting any current doing card to
 * "this_class" to preserve WIP=1) and logs a learning_event.
 *
 * Reusable across all studio classes — drop once at the top of each
 * self-paced lesson page.
 */
export interface FirstMoveConfig {
  /** Minimum words in the commitment field before "Start studio →" enables. Default 5. */
  minCommitmentWords: number;
  /** When true, students must tap one of their this_class cards to enable Start. Default true. */
  requireCardChoice: boolean;
  /** When true, the design-philosophy hero scrim shows at the top. Default true. */
  showDesignPhilosophy: boolean;
  /** When true, the "Where you left off" panel surfaces last journal NEXT + last done card. Default true. */
  showWhereLeftOff: boolean;
  /** When true, the "Coming up next" forward-look strip surfaces the next 2-3 incomplete planning_tasks by target_date. Default true. */
  showComingUp: boolean;
}
