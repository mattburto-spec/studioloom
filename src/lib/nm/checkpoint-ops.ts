/**
 * Pure NM-config state transitions used by the Phase 0.5 lesson editor's
 * New Metrics block category (Lever-MM, 4 May 2026). Lifted out of
 * `LessonEditor.tsx` so the transition logic is testable in isolation
 * without mounting the React tree.
 *
 * All functions are immutable: they return a new `NMUnitConfig` object;
 * the input is never mutated. Idempotency / zombie-pageId guards are
 * baked in here (per Lever-MM brief stop-triggers).
 */

import type { NMUnitConfig, NMCheckpointConfig } from "./constants";

/**
 * Add an NM-element checkpoint to a specific lesson page. Idempotent —
 * silently no-ops if the element is already on that page. Flips
 * `enabled = true` on first checkpoint registration so the rest of the
 * NM system (results panel, student observation surfaces) treats this
 * unit as configured. Keeps the unit-level `competencies` and
 * `elements` arrays in sync — covers the bootstrap case where an
 * empty config gets its first checkpoint.
 */
export function addCheckpoint(
  config: NMUnitConfig,
  pageId: string,
  elementId: string,
  competencyId: string,
): NMUnitConfig {
  const existing = config.checkpoints?.[pageId]?.elements ?? [];
  if (existing.includes(elementId)) {
    // Idempotent: same element on same page → return the same config
    // (caller can reference-compare to detect no-op if it cares).
    return config;
  }
  const competencies = config.competencies?.length
    ? config.competencies
    : [competencyId];
  const elements = config.elements?.includes(elementId)
    ? config.elements
    : [...(config.elements ?? []), elementId];
  const checkpoints: Record<string, NMCheckpointConfig> = {
    ...(config.checkpoints ?? {}),
    [pageId]: { elements: [...existing, elementId] },
  };
  return {
    ...config,
    enabled: true,
    competencies,
    elements,
    checkpoints,
  };
}

/**
 * Remove an NM-element checkpoint from a lesson page. When the removal
 * would leave the page's checkpoint list empty, the entire `pageId`
 * entry is dropped from the `checkpoints` map (zombie-pageId guard per
 * Lever-MM brief stop-trigger — prevents storage pollution where pages
 * accumulate empty `{ elements: [] }` entries that no consumer needs).
 *
 * Does NOT touch the unit-level `elements` array — that's a union of
 * elements across all pages, and a removal from one page might still
 * leave the element in use on another. (Pruning unit.elements requires
 * a cross-page recompute; out-of-scope for v1, future cleanup.)
 *
 * No-op when the element wasn't on that page in the first place.
 */
export function removeCheckpoint(
  config: NMUnitConfig,
  pageId: string,
  elementId: string,
): NMUnitConfig {
  const existing = config.checkpoints?.[pageId]?.elements ?? [];
  if (!existing.includes(elementId)) {
    return config; // no-op
  }
  const filtered = existing.filter((id) => id !== elementId);
  const nextCheckpoints: Record<string, NMCheckpointConfig> = {
    ...(config.checkpoints ?? {}),
  };
  if (filtered.length === 0) {
    delete nextCheckpoints[pageId];
  } else {
    nextCheckpoints[pageId] = { elements: filtered };
  }
  return {
    ...config,
    checkpoints: nextCheckpoints,
  };
}

/**
 * Set the active competency for the unit. v1 supports a single
 * competency per unit (multi-competency parked as v2), so the
 * `competencies` array is always replaced with `[competencyId]`.
 *
 * Does NOT touch `elements` or `checkpoints` per the Lever-MM brief
 * stop-trigger ("Switch loses elements — don't auto-erase elements
 * when competency changes — warn instead"). Orphaned chips on lessons
 * stay visible and removable by the teacher; they're not pruned
 * automatically because the data model has no concept of
 * "elements-from-competency-X-only" (all element IDs are in a flat
 * namespace).
 *
 * Idempotent — returns the same config (reference-equal) when the
 * given competencyId is already the active one.
 */
export function setCompetency(
  config: NMUnitConfig,
  competencyId: string,
): NMUnitConfig {
  if (config.competencies?.[0] === competencyId) {
    return config;
  }
  return {
    ...config,
    competencies: [competencyId],
  };
}
