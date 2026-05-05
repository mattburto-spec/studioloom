/**
 * AG.1 — payload composition + validation for structured-prompts responses.
 *
 * Pure logic — no React, no fetch. Tested in isolation per Lesson #71.
 *
 * Three responsibilities:
 *   1. validateResponses() — gate the Send button + return per-prompt errors
 *   2. composeContent() — turn the responses map into a portfolio_entries
 *      content blob (markdown-ish, scannable when teacher reads NM evidence)
 *   3. extractNextMove() — pull the "next" prompt's response so the Kanban
 *      auto-create can pick it up (AG.2 wiring)
 */

import type {
  StructuredPrompt,
  StructuredPromptResponses,
  StructuredPromptsConfig,
} from "./types";

// ─── Validation ──────────────────────────────────────────────────────────────

export interface PromptValidationError {
  promptId: string;
  message: string;
}

/**
 * Validate responses against the prompt config.
 *
 * Rules:
 *   - Every required prompt must have non-whitespace content
 *   - Soft character cap is informational (no error); the UI renders a count
 *     but doesn't block.
 *
 * Returns errors array keyed by promptId. Empty array = ready to submit.
 */
export function validateResponses(
  prompts: StructuredPromptsConfig,
  responses: StructuredPromptResponses,
  options: { photoProvided: boolean; photoRequired: boolean }
): PromptValidationError[] {
  const errors: PromptValidationError[] = [];

  for (const prompt of prompts) {
    const required = prompt.required !== false; // default true
    if (!required) continue;
    const value = (responses[prompt.id] ?? "").trim();
    if (value.length === 0) {
      errors.push({
        promptId: prompt.id,
        message: `${prompt.label} is required`,
      });
    }
  }

  if (options.photoRequired && !options.photoProvided) {
    errors.push({
      promptId: "__photo",
      message: "Photo of one decision point is required",
    });
  }

  return errors;
}

export function isReadyToSubmit(
  prompts: StructuredPromptsConfig,
  responses: StructuredPromptResponses,
  options: { photoProvided: boolean; photoRequired: boolean }
): boolean {
  return validateResponses(prompts, responses, options).length === 0;
}

// ─── Composition ─────────────────────────────────────────────────────────────

/**
 * Compose the responses into a markdown-ish blob suitable for
 * portfolio_entries.content. Format is intentionally human-readable —
 * teacher scrolls a student's narrative and can pick out the Decided
 * line at a glance for NM grading.
 *
 * Output shape:
 *
 *   ## What did you DO?
 *   <response>
 *
 *   ## What did you NOTICE?
 *   <response>
 *
 *   ## What did you DECIDE?
 *   <response>
 *
 *   ## What's NEXT?
 *   <response>
 *
 * Empty/whitespace responses for non-required prompts are skipped (header
 * only emitted when content exists).
 */
export function composeContent(
  prompts: StructuredPromptsConfig,
  responses: StructuredPromptResponses
): string {
  const sections: string[] = [];

  for (const prompt of prompts) {
    const value = (responses[prompt.id] ?? "").trim();
    if (value.length === 0) continue;
    sections.push(`## ${prompt.label}\n${value}`);
  }

  return sections.join("\n\n");
}

// ─── Next-move extraction (AG.2 Kanban wiring) ──────────────────────────────

/**
 * Pull the "next" prompt's response, if present + non-empty. Used by
 * AG.2 Kanban auto-create to seed a backlog card from the journal entry.
 *
 * Convention: the next-move prompt has id="next" (matches JOURNAL_PROMPTS).
 * Other presets that don't include a "next" id return null cleanly.
 */
export function extractNextMove(
  responses: StructuredPromptResponses,
  nextPromptId: string = "next"
): string | null {
  const value = (responses[nextPromptId] ?? "").trim();
  return value.length > 0 ? value : null;
}

// ─── Char count helpers (UI hint, not validation) ────────────────────────────

export function charCountStatus(
  prompt: StructuredPrompt,
  response: string
): "ok" | "approaching" | "over" {
  if (!prompt.softCharCap) return "ok";
  const len = response.length;
  if (len > prompt.softCharCap) return "over";
  if (len > prompt.softCharCap * 0.9) return "approaching";
  return "ok";
}
