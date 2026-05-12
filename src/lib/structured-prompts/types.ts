/**
 * AG.1 — structured-prompts responseType
 *
 * Generic shape for activity blocks that ask students to fill multiple
 * structured prompts in sequence (e.g. journal entries: Did / Noticed /
 * Decided / Next). Composes into a single portfolio_entries row.
 *
 * Per-unit pre-canned presets live in `presets.ts` (e.g. JOURNAL_PROMPTS
 * for the agency unit). Generic enough to power any structured-prompt
 * activity (lab observation, design crit, peer feedback, etc.).
 *
 * See: docs/units/co2-racers-build-brief.md §AG.1
 */

/** Single prompt the student responds to. */
export interface StructuredPrompt {
  /** Stable ID — used as response key + portfolio composition key. */
  id: string;
  /** Visible label above the textarea (e.g. "What did you DO?"). */
  label: string;
  /** Placeholder text inside the textarea. */
  placeholder?: string;
  /** Optional helper text below the textarea (e.g. "with a because clause"). */
  helper?: string;
  /** If true, the student MUST fill this before submit. Default true. */
  required?: boolean;
  /** Soft character cap — UI shows count, doesn't hard-block. */
  softCharCap?: number;
  /**
   * Character target — minimum the student needs to type before
   * "Continue" enables (in stepper mode). When unset, the
   * MultiQuestionResponse adapter defaults to min(80, softCharCap).
   * Set lower (e.g. 30-40) for quick-reflection prompts where a
   * sentence is enough; set higher when you want a substantive
   * paragraph. Per-prompt override — sits next to softCharCap.
   */
  targetChars?: number;
  /**
   * Optional sentence starters — tappable chips above the textarea
   * that insert (or append) the chip text into the field. Helps
   * non-native speakers + reduces blank-page friction at the close of
   * a lesson. Keep to 3-4 short starters per prompt; more is clutter.
   */
  sentenceStarters?: string[];
  /**
   * LIS.C — optional criterion tag, used by the stepper layout
   * (MultiQuestionResponse) to drive accent colour, badge tone, and ring
   * colour. DO=orange, NOTICE=blue, DECIDE=green, NEXT=purple. Only
   * consumed when section.promptsLayout === "stepper"; ignored otherwise.
   */
  criterion?: "DO" | "NOTICE" | "DECIDE" | "NEXT";
}

/**
 * Map of prompt id → student response text. Stored in submit payload + composed
 * into portfolio_entries.content.
 */
export type StructuredPromptResponses = Record<string, string>;

/**
 * Shape stored as the activity block's `prompts` field (when responseType is
 * "structured-prompts"). Authored at unit-creation time; immutable from
 * student side.
 */
export type StructuredPromptsConfig = StructuredPrompt[];
