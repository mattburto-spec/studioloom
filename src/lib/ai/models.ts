/**
 * Centralized Anthropic model ID constants.
 *
 * Every production call site that passes a model ID to the Anthropic API
 * should import from here. Hardcoded model strings in src/ are prevented
 * by the wiring-lock test in render-path-fixtures.test.ts (5.13).
 *
 * When upgrading model versions, change the strings here — all call sites
 * update automatically.
 */

export const MODELS = {
  /** Sonnet — used for generation, analysis, enrichment (Tier 2+3). */
  SONNET: "claude-sonnet-4-20250514",
  /** Haiku — used for ingestion, classification, mentoring, tools (Tier 1). */
  HAIKU: "claude-haiku-4-5-20251001",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];
