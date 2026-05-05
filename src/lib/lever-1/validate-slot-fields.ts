/**
 * Lever 1 sub-phase 1D — server-side validation for the three slot fields
 * on activity-block + JSONB-section writes.
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 * Style: docs/specs/lesson-content-style-guide-v2-draft.md
 *
 * Caps mirror the v2 style guide:
 *   framing         ≤ 200 chars
 *   task            ≤ 800 chars (soft cap — warn, don't reject)
 *   success_signal  ≤ 200 chars
 *
 * The framing + success_signal caps reject. Task is a SOFT cap that
 * surfaces a warning without rejecting — the original Teaching Moves
 * library has a median task of 824 chars after structured restructuring,
 * so a hard reject at 800 would block the seeded library.
 *
 * Lever 2 lints will harden this once we have telemetry on what's
 * achievable.
 *
 * The validator is deliberately string-shape only. It does NOT enforce
 * voice rules (second person, action-verb-first, no meta commentary) —
 * those are LLM-side concerns that live in the AI generation guard
 * rails (1G), not in server-side input validation.
 */

export interface SlotFieldsInput {
  framing?: string | null;
  task?: string | null;
  success_signal?: string | null;
}

export interface SlotValidationResult {
  ok: boolean;
  errors: string[]; // hard rejects
  warnings: string[]; // soft warnings (not blocking)
  /**
   * True when the write contains a `prompt` value but ZERO of the three
   * slot fields. Set deprecation header on the response so 1G has a
   * traceable signal that legacy writes are still happening.
   */
  legacyPromptOnly: boolean;
}

const FRAMING_HARD_CAP = 200;
const TASK_SOFT_CAP = 800;
const SIGNAL_HARD_CAP = 200;

/**
 * Validate the three slot fields plus the legacy `prompt` field. Both
 * inputs are optional — callers may pass either shape.
 *
 * Returns ok=false when a hard cap is breached. Caller should reject
 * the request with 400 + the errors array.
 *
 * Returns ok=true with non-empty warnings when the soft cap is breached.
 * Caller should pass warnings through in the response body so the
 * editor can surface them to the teacher.
 */
export function validateSlotFields(
  slots: SlotFieldsInput,
  legacyPrompt?: string | null
): SlotValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof slots.framing === "string" && slots.framing.length > FRAMING_HARD_CAP) {
    errors.push(
      `framing exceeds ${FRAMING_HARD_CAP}-char cap (${slots.framing.length} chars)`
    );
  }

  if (typeof slots.success_signal === "string" && slots.success_signal.length > SIGNAL_HARD_CAP) {
    errors.push(
      `success_signal exceeds ${SIGNAL_HARD_CAP}-char cap (${slots.success_signal.length} chars)`
    );
  }

  if (typeof slots.task === "string" && slots.task.length > TASK_SOFT_CAP) {
    warnings.push(
      `task exceeds ${TASK_SOFT_CAP}-char soft cap (${slots.task.length} chars) — Lever 2 lint will surface this`
    );
  }

  const hasAnySlot =
    Boolean(slots.framing && slots.framing.trim()) ||
    Boolean(slots.task && slots.task.trim()) ||
    Boolean(slots.success_signal && slots.success_signal.trim());

  const hasLegacyPrompt = Boolean(legacyPrompt && legacyPrompt.trim());

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    legacyPromptOnly: hasLegacyPrompt && !hasAnySlot,
  };
}

/**
 * Header name set on responses when the write only carried legacy
 * `prompt`, no slot fields. Consumed by 1G dashboards / smoke tests
 * to verify the AI generation rewrite is producing slots.
 */
export const LEVER_1_DEPRECATED_HEADER = "X-Lever-1-Deprecated";
export const LEVER_1_DEPRECATED_VALUE_PROMPT_ONLY = "prompt-write-only";
