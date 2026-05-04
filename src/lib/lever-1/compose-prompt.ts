/**
 * Lever 1 sub-phase 1E — compose the three slot fields into a single
 * plaintext string for non-React consumers (TextToSpeech, PDF export,
 * grading-tile titles, edit-tracker telemetry, knowledge chunking).
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 *
 * For the React renderer with hybrid visual treatment (muted framing →
 * task body → 🎯-prefixed bold success signal), see ComposedPrompt.tsx.
 *
 * Composition rules:
 *   - When ANY of the three slots is non-empty: stitch them with double
 *     newlines in render order (framing → task → success_signal),
 *     skipping empty slots.
 *   - When ALL three slots are empty: fall back to the legacy `prompt`
 *     field. This preserves rendering for blocks that haven't been
 *     migrated to the v2 shape (your 7 imports, future imports from
 *     pre-v2 sources).
 *   - When EVERYTHING is empty (legacy prompt also missing): empty
 *     string. Caller decides what to do.
 *
 * The helper trusts the slot strings as-authored. No length truncation,
 * no markdown stripping. Callers that need stripped plaintext (TTS)
 * pass the result through `stripMarkdown()` themselves.
 */

/**
 * Structural shape — any object that carries (a subset of) the v2 slot
 * fields plus the legacy `prompt`. Kept structural so this helper works
 * over `ActivitySection`, `TimelineActivity`, `ActivityBlock`, AI tool
 * payloads, fixtures, etc., without forcing every caller to widen at
 * the type level.
 */
export interface SlotBearing {
  framing?: string | null;
  task?: string | null;
  success_signal?: string | null;
  prompt?: string | null;
}

export function composedPromptText(section: SlotBearing): string {
  const framing = (section.framing || "").trim();
  const task = (section.task || "").trim();
  const signal = (section.success_signal || "").trim();

  const slots = [framing, task, signal].filter(Boolean);
  if (slots.length > 0) {
    return slots.join("\n\n");
  }

  return (section.prompt || "").trim();
}

/**
 * Returns true when at least one of the three slot fields is non-empty.
 * The renderer uses this to decide between hybrid composition vs the
 * legacy MarkdownPrompt fallback.
 */
export function hasSlotFields(section: SlotBearing): boolean {
  return (
    Boolean(section.framing && section.framing.trim()) ||
    Boolean(section.task && section.task.trim()) ||
    Boolean(section.success_signal && section.success_signal.trim())
  );
}
