// Archetype-aware block content reader.
//
// Canonical entry point for rendering an ActivitySection whose author
// supplied per-archetype variants via `archetype_overrides`. Returns the
// student-appropriate framing/task/success_signal/examples/prompts —
// pulling from `archetype_overrides[archetypeId]` when a match exists,
// otherwise falling back to the base block fields.
//
// Use anywhere a block renders student-facing copy. Never query
// `archetype_overrides` directly — always go through this helper so the
// fallback semantics stay consistent (and the override-version-drift
// follow-up can land cleanly later).
//
// See docs/design-guidelines.md → A12 (Archetype-Aware Blocks).

import type { ActivitySection } from "@/types";

export interface ArchetypeAwareContent {
  framing: string;
  task: string;
  success_signal: string;
  examples: string[];
  prompts: string[];
  /**
   * Block-specific override fields beyond the 5 canonical ones. E.g.
   * Inspiration Board can stash `synthesis_placeholder` here, and the
   * block reads `extras.synthesis_placeholder` at render time.
   */
  extras: Record<string, unknown>;
}

const CANONICAL_KEYS = new Set([
  "framing",
  "task",
  "success_signal",
  "examples",
  "prompts",
]);

/**
 * Resolve the rendered content for a block given the student's archetype.
 *
 * `archetypeId` may be a stable archetype ID ("toy-design") OR a card-slug
 * key ("g8-brief-designer-mentor") — the override table keys can hold
 * either, and a card-slug match takes precedence in real-world authoring
 * (the resolver returns whichever the author provided that the student's
 * pick matches).
 *
 * Always safe to call — returns base content when `archetypeId` is null
 * or no matching override exists.
 */
export function getArchetypeAwareContent(
  block: ActivitySection,
  archetypeId: string | null,
): ArchetypeAwareContent {
  const base: ArchetypeAwareContent = {
    framing: block.framing ?? "",
    task: block.task ?? "",
    success_signal: block.success_signal ?? "",
    examples: [],
    prompts: [],
    extras: {},
  };

  if (!archetypeId || !block.archetype_overrides) return base;
  const override = block.archetype_overrides[archetypeId];
  if (!override) return base;

  const merged: ArchetypeAwareContent = {
    framing: typeof override.framing === "string" ? override.framing : base.framing,
    task: typeof override.task === "string" ? override.task : base.task,
    success_signal:
      typeof override.success_signal === "string"
        ? override.success_signal
        : base.success_signal,
    examples: Array.isArray(override.examples)
      ? (override.examples as string[])
      : base.examples,
    prompts: Array.isArray(override.prompts)
      ? (override.prompts as string[])
      : base.prompts,
    extras: {},
  };

  for (const [k, v] of Object.entries(override)) {
    if (!CANONICAL_KEYS.has(k)) merged.extras[k] = v;
  }

  return merged;
}

/**
 * Resolve content using a chain of candidate IDs in priority order.
 * Useful when an authoring convention allows BOTH archetype-keyed
 * overrides AND card-slug-keyed overrides — pass `[cardSlug, archetypeId]`
 * to prefer the more specific card variant when both exist.
 */
export function getArchetypeAwareContentByChain(
  block: ActivitySection,
  candidateIds: Array<string | null>,
): ArchetypeAwareContent {
  for (const id of candidateIds) {
    if (!id) continue;
    if (block.archetype_overrides?.[id]) {
      return getArchetypeAwareContent(block, id);
    }
  }
  return getArchetypeAwareContent(block, null);
}
