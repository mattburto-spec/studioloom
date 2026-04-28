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
 * Cost: ~600 input + ~200 output tokens per call ≈ $0.0017 per student/tile.
 * Raise the max_tokens guard if you change the schema.
 */

import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/models";

export const PROMPT_VERSION = "grading.aiprescore.v1.0.0";
const MAX_OUTPUT_TOKENS = 600;

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
  /** Display name used to ground reasoning ("Maya wrote..."). */
  studentDisplayName?: string;
}

export interface AiPrescoreOutput {
  score: number | null;
  evidenceQuote: string | null;
  confidence: number | null;
  reasoning: string | null;
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
    },
    required: ["score", "evidence_quote", "confidence", "reasoning"],
  },
};

function buildSystemPrompt(input: AiPrescoreInput): string {
  return [
    "You are a calibrated grading assistant for a secondary-school design-technology platform.",
    "Your job is to suggest a draft score that the human teacher will confirm or override.",
    "",
    "Calibration principles:",
    "- Anchor every score to a verbatim quote from the response. No quote = no confidence.",
    `- Use the full scale (${input.scaleMin}–${input.scaleMax}). A typical satisfactory response should land near 60% of max.`,
    "- Penalise length-padding. Reward specificity, evidence, and reasoning quality over word count.",
    "- If the response is missing, off-topic, or empty, set confidence < 0.5 and reasoning that names the gap.",
    "- Never invent evidence. If you cannot find an 8-word quote, return an empty evidence_quote and confidence < 0.4.",
    "",
    `Criterion being graded: ${input.criterionLabel}.`,
    `Scale: ${input.scaleLabel} (${input.scaleMin}–${input.scaleMax}).`,
  ].join("\n");
}

function buildUserPrompt(input: AiPrescoreInput): string {
  const lines: string[] = [];
  lines.push("TILE PROMPT:");
  lines.push(input.tilePrompt.trim() || "(prompt not available)");
  lines.push("");
  lines.push("STUDENT RESPONSE:");
  lines.push(input.studentResponse.trim() || "(no submission)");
  lines.push("");
  lines.push("Submit your pre-score using the submit_prescore tool.");
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
    modelVersion: MODELS.HAIKU,
    promptVersion: PROMPT_VERSION,
  };

  // Guard: don't burn a Haiku call on an empty submission.
  if (!input.studentResponse.trim()) {
    return {
      ...baseOutput,
      reasoning: "No submission to grade.",
      confidence: 0,
    };
  }

  const client = new Anthropic({
    apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
  });

  const response = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: buildSystemPrompt(input),
    messages: [{ role: "user", content: buildUserPrompt(input) }],
    tools: [PRESCORE_TOOL],
    tool_choice: { type: "tool", name: PRESCORE_TOOL.name },
  });

  // Lesson #39: every Anthropic call site must guard stop_reason. tool_use
  // calls truncate even more invisibly than text — the tool-input gets
  // dropped silently and you get a tool_use block with empty input.
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `aiPrescore hit max_tokens=${MAX_OUTPUT_TOKENS} cap — response truncated. Raise cap or shorten prompt.`,
    );
  }

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

  return {
    ...baseOutput,
    score,
    evidenceQuote,
    confidence,
    reasoning,
  };
}

function clampScore(raw: number, min: number, max: number): number {
  const rounded = Math.round(raw);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}
