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

// ─── Inverse of composeContent — re-parse on Edit (smoke-fix 6 May 2026) ──
// Round 3 deferred this saying it was fragile. Round 4 needed it: students
// shouldn't have to retype a saved journal to make a small edit.
//
// Strategy: split the composed text on lines that start with `## `, then
// match each chunk's heading against the current prompts list by exact
// label string. Any chunk whose heading doesn't match a current prompt is
// dropped (graceful degradation when prompt labels were edited mid-unit).
//
// Important: composeContent skips empty responses entirely, so the parsed
// map will contain ONLY the prompts that had non-empty answers. Callers
// that want a "fully populated by id" map should fold this result into
// the empty-string default themselves.

/**
 * Parse a composed-content markdown string back into a per-prompt
 * responses map. Best-effort: matches each `## <label>\n<value>` chunk
 * to a prompt by exact label. Unknown labels are silently dropped.
 */
export function parseComposedContent(
  prompts: StructuredPromptsConfig,
  composed: string
): StructuredPromptResponses {
  const result: StructuredPromptResponses = {};
  if (!composed || composed.trim().length === 0) return result;

  const labelToId = new Map<string, string>();
  for (const prompt of prompts) {
    labelToId.set(prompt.label, prompt.id);
  }

  // Split on lines that start with "## " — keep the heading attached to its body.
  // We scan line-by-line so we don't break responses that contain "##" inside text.
  const lines = composed.split(/\r?\n/);
  let currentLabel: string | null = null;
  let currentBody: string[] = [];

  function flush() {
    if (currentLabel === null) return;
    const id = labelToId.get(currentLabel);
    if (id) {
      result[id] = currentBody.join("\n").trimEnd();
    }
    currentLabel = null;
    currentBody = [];
  }

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      currentLabel = line.slice(3).trim();
      currentBody = [];
    } else if (currentLabel !== null) {
      currentBody.push(line);
    }
    // Lines before the first heading are dropped — composeContent never
    // emits a preamble, so this is the right behaviour for round-trips.
  }
  flush();

  // Strip leading/trailing blank lines from each captured body.
  for (const id of Object.keys(result)) {
    result[id] = result[id].replace(/^\s+/, "").replace(/\s+$/, "");
  }

  return result;
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

// ─── Submit-button label (round 4 — UX clarity) ──────────────────────────

/**
 * Decide the submit-button label based on save side-effects so the
 * student knows what's about to happen:
 *
 *   - First save + Kanban auto-create + has next-move text →
 *     "Save journal & update Project Board"
 *   - First save + no Kanban side-effect → "Save to Portfolio"
 *   - Re-save (entry already exists) → "Update saved entry"
 *
 * Pure helper so it's importable by tests + by the .tsx component without
 * crossing the JSX boundary in either direction.
 */
export function submitButtonLabel(args: {
  hasSavedEntry: boolean;
  autoCreateKanbanCardOnSave: boolean;
  hasNextMove: boolean;
}): string {
  if (args.hasSavedEntry) return "Update saved entry";
  if (args.autoCreateKanbanCardOnSave && args.hasNextMove) {
    return "Save journal & update Project Board";
  }
  return "Save to Portfolio";
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
