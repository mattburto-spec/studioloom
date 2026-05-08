/**
 * G1.3 — AI pre-score service.
 *
 * Given a tile (criterion + prompt) and a student's response, ask Haiku 4.5
 * for a suggested score, an 8–15 word evidence quote pulled from the
 * response, a confidence (0–1), and brief reasoning. The evidence quote is
 * the load-bearing artifact (per brief §0): without it, the row reads as
 * blind authority. With it, Calibrate's horizontal flow is viable.
 *
 * Returns null fields (rather than throwing) when the input is too thin —
 * empty response, prompt missing, etc. — so the caller can stamp a
 * "no submission" event without rolling back the whole batch.
 *
 * PII handling (security-overview.md §1.3, hardened 2026-05-09):
 * The student's real name MUST NOT reach Anthropic. The prompt addresses
 * the student by STUDENT_NAME_PLACEHOLDER ("Student") and the returned
 * feedback_draft contains the placeholder verbatim. The CALLER is
 * responsible for restoring the real name via restoreStudentName() before
 * persisting or rendering. See src/app/api/teacher/grading/tile-grades/
 * ai-prescore/route.ts for the canonical caller.
 *
 * Cost: ~600 input + ~200 output tokens per call ≈ $0.0017 per student/tile.
 * Raise the max_tokens guard if you change the schema.
 */

import { callAnthropicMessages } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import { STUDENT_NAME_PLACEHOLDER } from "@/lib/security/student-name-placeholder";

export const PROMPT_VERSION = "grading.aiprescore.v2.1.0";
// Bumped 600 → 900 to fit the new ~80-word feedback_draft alongside the
// existing score + quote + reasoning. Roughly: 200 prior + 200 feedback
// + tool overhead = ~500 actual; 900 gives headroom against truncation.
const MAX_OUTPUT_TOKENS = 900;

export interface AiPrescoreInput {
  /** Tile prompt, the question the student responded to. */
  tilePrompt: string;
  /** Resolved criterion display name (e.g. "Inquiring and analysing"). */
  criterionLabel: string;
  /** The student's text response. May be empty if no submission. */
  studentResponse: string;
  /** Scoring scale — drives both min/max + the description in the prompt. */
  scaleMin: number;
  scaleMax: number;
  /** Human-readable scale label, e.g. "MYP 1–8" or "GCSE percentage 0–100%". */
  scaleLabel: string;
  // NOTE: do NOT add a name field to this interface (display name, given
  // name, etc.). The helper INTERNALLY uses STUDENT_NAME_PLACEHOLDER for
  // every prompt path; the caller restores the real name on the returned
  // feedback_draft via restoreStudentName(). See file header + the CI
  // check at src/lib/security/__tests__/no-pii-in-ai-prompts.test.ts.
}

export interface AiPrescoreOutput {
  score: number | null;
  evidenceQuote: string | null;
  confidence: number | null;
  reasoning: string | null;
  /** G3.1 — drafted student-facing comment, ~80 words. Edit-or-send loop. */
  feedbackDraft: string | null;
  modelVersion: string;
  promptVersion: string;
}

const PRESCORE_TOOL = {
  name: "submit_prescore",
  description:
    "Submit a calibrated pre-score for the student's response based on the tile's criterion. " +
    "The evidence_quote MUST be a verbatim 8–15 word excerpt from the student response — " +
    "this is the load-bearing artifact a teacher uses to trust or override the score.",
  input_schema: {
    type: "object" as const,
    properties: {
      score: {
        type: "integer",
        description:
          "Your suggested score on the scale. Must be within [min, max] inclusive. " +
          "Pick the score that best matches the response's quality given the criterion. " +
          "Do not be generous — calibrate so a typical satisfactory response sits at ~60% of max.",
      },
      evidence_quote: {
        type: "string",
        description:
          "A verbatim 8–15 word excerpt from the student's response that justifies the score. " +
          "Quote exactly — do not paraphrase. If the response is empty or too short to quote " +
          "(<8 words), return an empty string.",
      },
      confidence: {
        type: "number",
        description:
          "Your confidence in the score from 0.0 (guess) to 1.0 (certain). " +
          "Use <0.5 when the response is ambiguous, missing, or borderline between two levels.",
      },
      reasoning: {
        type: "string",
        description:
          "1–2 sentences linking the evidence_quote to the score. Reference specific qualities " +
          "(e.g. 'depth of analysis', 'use of vocabulary', 'logical structure'). Do not include " +
          "the student's name or first-person address — this is internal teacher-facing reasoning.",
      },
      feedback_draft: {
        type: "string",
        description:
          "A draft comment written DIRECTLY TO THE STUDENT in second person. " +
          "Length: 60–100 words, 2–4 sentences. Structure: 1) one sentence naming what " +
          "specifically landed (anchored to the evidence quote when possible), 2) one " +
          "sentence on the gap or what's still missing, 3) one sentence with a concrete " +
          "next step they can take. " +
          "Style: warm but specific, no generic praise ('great job'), no jargon, no scoring " +
          "language ('Level 5', 'Criterion B'). Address them by first name once, naturally. " +
          "If you cannot find anything specific to comment on (empty submission, off-topic " +
          "answer), return a single sentence asking them to revisit the prompt — DO NOT " +
          "fabricate a comment.",
      },
    },
    required: ["score", "evidence_quote", "confidence", "reasoning", "feedback_draft"],
  },
};

function buildSystemPrompt(input: AiPrescoreInput): string {
  // PII redaction (security-overview.md §1.3): the student is referenced as
  // STUDENT_NAME_PLACEHOLDER throughout the prompt. The caller swaps it back
  // to the real name on the returned feedback_draft via restoreStudentName().
  const studentRef = STUDENT_NAME_PLACEHOLDER;
  return [
    "You are a calibrated grading assistant for a secondary-school design-technology platform.",
    "Your job is to (1) suggest a draft score the teacher will confirm or override, and",
    `(2) draft a student-facing comment to ${studentRef} that the teacher will edit + send.`,
    "",
    "SCORING principles:",
    "- Anchor every score to a verbatim quote from the response. No quote = no confidence.",
    `- Use the full scale (${input.scaleMin}–${input.scaleMax}). A typical satisfactory response should land near 60% of max.`,
    "- Penalise length-padding. Reward specificity, evidence, and reasoning quality over word count.",
    "- If the response is missing, off-topic, or empty, set confidence < 0.5 and reasoning that names the gap.",
    "- Never invent evidence. If you cannot find an 8-word quote, return an empty evidence_quote and confidence < 0.4.",
    "",
    "FEEDBACK principles (this is the comment the student will read — get it right):",
    "- Specific over generic. 'You picked PLA because it's biodegradable' beats 'Good material choice'.",
    "- Anchor at least one sentence in the response itself. Reference what they actually wrote.",
    "- One thing landed, one thing's missing, one concrete next step. In that order.",
    `- Address the student warmly but not preciously. Use the placeholder "${studentRef}" exactly as written when addressing them — the platform substitutes their real name post-response. No 'awesome', 'amazing', 'great job'.`,
    "- Don't reveal the score or use scoring language. The teacher decides whether to mention numbers.",
    "- Don't paper over weakness. If their reasoning is thin, name it specifically.",
    "- If you have nothing specific to say (blank/off-topic submission), say only: " +
      `"${studentRef}, I can't see a response to this question yet — try the prompt again and aim for X." Replace X with the genre of answer the prompt asks for.`,
    "",
    `Criterion being graded: ${input.criterionLabel}.`,
    `Scale: ${input.scaleLabel} (${input.scaleMin}–${input.scaleMax}).`,
  ].join("\n");
}

function buildUserPrompt(input: AiPrescoreInput): string {
  const lines: string[] = [];
  // No STUDENT: name line — the helper never receives the real name. The
  // PROMPT addresses the student by STUDENT_NAME_PLACEHOLDER (handled in
  // buildSystemPrompt); the caller restores the real name client-side.
  lines.push("TILE PROMPT:");
  lines.push(input.tilePrompt.trim() || "(prompt not available)");
  lines.push("");
  lines.push("STUDENT RESPONSE:");
  lines.push(input.studentResponse.trim() || "(no submission)");
  lines.push("");
  lines.push("Submit your pre-score AND a draft comment using the submit_prescore tool.");
  return lines.join("\n");
}

/**
 * Call Haiku and return the structured pre-score. Throws on Anthropic API
 * errors (caller wraps for batch tolerance). Returns nulled fields when the
 * response is too thin to score meaningfully.
 */
export async function generateAiPrescore(
  input: AiPrescoreInput,
  apiKey?: string,
): Promise<AiPrescoreOutput> {
  const baseOutput: AiPrescoreOutput = {
    score: null,
    evidenceQuote: null,
    confidence: null,
    reasoning: null,
    feedbackDraft: null,
    modelVersion: MODELS.HAIKU,
    promptVersion: PROMPT_VERSION,
  };

  // Guard: don't burn a Haiku call on an empty submission.
  // Feedback uses STUDENT_NAME_PLACEHOLDER; caller restores the real name
  // via restoreStudentName() — same contract as the AI-generated path.
  if (!input.studentResponse.trim()) {
    return {
      ...baseOutput,
      reasoning: "No submission to grade.",
      confidence: 0,
      feedbackDraft:
        `${STUDENT_NAME_PLACEHOLDER}, I can't see a response to this prompt yet — give it another go when you're ready, and aim to address the question directly.`,
    };
  }

  const callResult = await callAnthropicMessages({
    apiKey,
    endpoint: "lib/grading/ai-prescore",
    model: MODELS.HAIKU,
    maxTokens: MAX_OUTPUT_TOKENS,
    system: buildSystemPrompt(input),
    messages: [{ role: "user", content: buildUserPrompt(input) }],
    tools: [PRESCORE_TOOL],
    toolChoice: { type: "tool", name: PRESCORE_TOOL.name },
  });

  // Lesson #39: helper centralises stop_reason guard. Translate truncation
  // to the same throw the existing caller contract expects.
  if (!callResult.ok) {
    if (callResult.reason === "truncated") {
      throw new Error(
        `aiPrescore hit max_tokens=${MAX_OUTPUT_TOKENS} cap — response truncated. Raise cap or shorten prompt.`,
      );
    }
    if (callResult.reason === "api_error") throw callResult.error;
    throw new Error(`aiPrescore — callAnthropicMessages failed: ${callResult.reason}`);
  }

  const response = callResult.response;
  // Find the tool_use block; tool_choice forces it to the front.
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use" || !toolUse.input) {
    throw new Error(
      `aiPrescore — Haiku returned no tool_use block (stop_reason=${response.stop_reason}). Check prompt + tool definition.`,
    );
  }

  const raw = toolUse.input as {
    score?: unknown;
    evidence_quote?: unknown;
    confidence?: unknown;
    reasoning?: unknown;
    feedback_draft?: unknown;
  };

  const score =
    typeof raw.score === "number" && Number.isFinite(raw.score)
      ? clampScore(raw.score, input.scaleMin, input.scaleMax)
      : null;
  const evidenceQuote =
    typeof raw.evidence_quote === "string" && raw.evidence_quote.trim().length > 0
      ? raw.evidence_quote.trim()
      : null;
  const confidence =
    typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : null;
  const reasoning =
    typeof raw.reasoning === "string" && raw.reasoning.trim().length > 0
      ? raw.reasoning.trim()
      : null;
  const feedbackDraft =
    typeof raw.feedback_draft === "string" && raw.feedback_draft.trim().length > 0
      ? raw.feedback_draft.trim()
      : null;

  return {
    ...baseOutput,
    score,
    evidenceQuote,
    confidence,
    reasoning,
    feedbackDraft,
  };
}

function clampScore(raw: number, min: number, max: number): number {
  const rounded = Math.round(raw);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}
