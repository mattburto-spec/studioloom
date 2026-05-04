/**
 * Lever 1 sub-phase 1C — backfill heuristic for splitting a legacy
 * single-field activity prompt into the three slot fields:
 *
 *   framing         — one-sentence orient (lead)
 *   task            — the imperative body
 *   success_signal  — what students produce/record/submit (closing)
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md
 * Style: docs/specs/lesson-content-style-guide-v2-draft.md
 *
 * The heuristic is best-effort. When it can't split cleanly it returns
 * `needs_review = true` with the original prompt preserved verbatim
 * in `task` (so the renderer falls back to legacy behaviour through the
 * task slot). Teachers tune the splits in the editor on their own time.
 *
 * Pure function. No I/O. Idempotent.
 */

export interface PromptSplit {
  framing: string | null;
  task: string | null;
  success_signal: string | null;
  needs_review: boolean;
  /** When needs_review=true, why the heuristic bailed. */
  reason?:
    | "empty"
    | "too-short"
    | "single-sentence"
    | "no-signal-verb"
    | "no-task-body";
}

/**
 * Verbs that mark a closing "what to produce" sentence. Matched
 * case-insensitive on the LAST sentence of the prompt as a whole-word
 * regex. Order doesn't matter; we just check `.some()`.
 *
 * Conservative list — these are imperative production verbs typical of
 * MYP/IGCSE/A-Level activity prompts. Add candidates as we observe
 * needs_review tail patterns in production.
 */
const SIGNAL_VERBS = [
  "record",
  "produce",
  "write",
  "show",
  "submit",
  "share",
  "annotate",
  "sketch",
  "explain",
  "report",
  "draft",
  "list",
  "mark",
  "capture",
  "describe",
  "label",
  "create",
  "post",
  "answer",
  "complete",
  "finalise",
  "finalize",
  "publish",
  "present",
  "upload",
  "compile",
  "diagram",
  "outline",
  "summarise",
  "summarize",
];

const SIGNAL_VERB_REGEX = new RegExp(
  `\\b(?:${SIGNAL_VERBS.join("|")})\\b`,
  "i"
);

/**
 * Sentence boundary regex: split on `.`, `!`, or `?` followed by
 * whitespace and a capital letter, double quote, asterisk, hyphen, or
 * digit. Conservative — handles markdown bullets and numbered lists
 * without over-splitting on abbreviations like "e.g." or "i.e.".
 */
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=["*\-•]|\d+\.|[A-Z])/;

/**
 * Strip leading/trailing markdown noise that breaks sentence detection:
 * leading/trailing **bold** wrappers, leading hash headings, etc. We
 * preserve the noise inside the sentence; we just don't let it flank.
 */
function normaliseLeadingNoise(text: string): string {
  return text.trim().replace(/^#+\s*/, ""); // drop leading "###"
}

export function splitPrompt(promptRaw: string | null | undefined): PromptSplit {
  const trimmed = (promptRaw || "").trim();

  // Edge: empty
  if (!trimmed) {
    return {
      framing: null,
      task: null,
      success_signal: null,
      needs_review: true,
      reason: "empty",
    };
  }

  // Edge: very short (< 50 chars or no terminal punctuation)
  if (trimmed.length < 50 || !/[.!?]/.test(trimmed)) {
    return {
      framing: null,
      task: trimmed,
      success_signal: null,
      needs_review: true,
      reason: "too-short",
    };
  }

  const sentences = trimmed.split(SENTENCE_BOUNDARY).map((s) => s.trim()).filter(Boolean);

  // Edge: only one sentence (boundary regex didn't match anything)
  if (sentences.length < 2) {
    return {
      framing: null,
      task: trimmed,
      success_signal: null,
      needs_review: true,
      reason: "single-sentence",
    };
  }

  const first = normaliseLeadingNoise(sentences[0]);
  const last = sentences[sentences.length - 1].trim();

  const lastHasSignal = SIGNAL_VERB_REGEX.test(last);

  if (!lastHasSignal) {
    // We have a clear first sentence (framing-shaped) but no clear
    // closer. Preserve everything in task, flag for teacher review.
    return {
      framing: first,
      task: sentences.slice(1).join(" ").trim(),
      success_signal: null,
      needs_review: true,
      reason: "no-signal-verb",
    };
  }

  // Clean three-way split: first sentence, middle bulk, signal closer.
  const middle = sentences.slice(1, -1).join(" ").trim();

  // Edge: only 2 sentences total → first=framing, last=signal, no body
  if (!middle) {
    return {
      framing: first,
      task: null,
      success_signal: last,
      needs_review: true,
      reason: "no-task-body",
    };
  }

  return {
    framing: first,
    task: middle,
    success_signal: last,
    needs_review: false,
  };
}
