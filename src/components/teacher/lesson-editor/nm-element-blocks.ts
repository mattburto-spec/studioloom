/**
 * Lever-MM (4 May 2026) — pure factory for the New Metrics palette
 * BlockDefinitions. Lifted out of `BlockPalette.tsx` so the helper is
 * importable from `.test.ts` files without dragging in JSX (which
 * vitest's default config can't transform).
 *
 * `BlockDefinition` is re-imported from BlockPalette to keep the type
 * source-of-truth in one place; consumers should import this helper
 * via the existing `BlockPalette.tsx` re-export so the public surface
 * stays unchanged.
 */

import type { BlockDefinition } from "./BlockPalette.types";

/**
 * Build a list of palette BlockDefinitions from a competency's elements.
 * Each element renders in the "New Metrics" accordion. Click → registers
 * a checkpoint on the current lesson via the NM API path (handled at the
 * click site via the `onAddNmCheckpoint` prop on `BlockPalette`).
 *
 * Caller is responsible for:
 *   - Gating on `school_context.use_new_metrics === true` (pass empty array
 *     when off — empty category accordion auto-hides via activeCategories).
 *   - Resolving the active competency (only one shown at a time per unit).
 *   - Wiring `onAddNmCheckpoint` to /api/teacher/nm-config persistence.
 */
export function buildNmElementBlocks(
  /**
   * Accepts the canonical `NMElement` shape from `@/lib/nm/constants`.
   * Defined inline as a structural type so this helper doesn't need to
   * import the NM module (keeps the palette decoupled from NM internals
   * — only the field names matter).
   */
  elements: ReadonlyArray<{ id: string; name: string; definition?: string; studentDescription?: string }>,
  competencyId: string,
): BlockDefinition[] {
  return elements.map((el) => ({
    id: `nm-element-${competencyId}-${el.id}`,
    label: el.name,
    icon: "🎯",
    category: "new_metrics" as const,
    // Prefer the student-facing description (more human) over the formal
    // definition for the palette tooltip; fall back to a generic CTA when
    // both are missing.
    description: el.studentDescription || el.definition || `Add a checkpoint for ${el.name} on this lesson.`,
    defaultPhase: "any" as const,
    nmElementId: el.id,
    nmCompetencyId: competencyId,
    source: "built-in" as const,
    // Stub create() — should never be invoked through onAddBlock. The click
    // handler in BlockPalette short-circuits NM blocks and routes to the
    // NM checkpoint registration path instead. Throwing here makes any
    // accidental invocation a loud error rather than silent junk-section.
    create: () => {
      throw new Error(
        `[BlockPalette] NM-element block "${el.id}" was invoked through onAddBlock — should route through onAddNmCheckpoint instead. (Lever-MM regression.)`,
      );
    },
  }));
}
