/**
 * TFL.3 C.4 — Tweak-button regeneration helper.
 *
 * Given an existing teacher feedback draft (either the prescore
 * draft for drafted/no_draft items OR the AI follow-up for
 * reply_waiting items) and a tweak directive, regenerate the draft
 * applying the adjustment.
 *
 * Four pre-set directives surface in the inbox UI:
 *   - "shorter" — compress to 1-2 sentences, keep the key point
 *   - "warmer"  — soften tone, more encouraging
 *   - "sharper" — more direct + specific, cut hedging
 *   - "ask"     — free-form teacher instruction (askText required)
 *
 * The regenerator is STATELESS w.r.t. score / evidence / confidence
 * — it only rewrites the feedback body. Score columns are untouched.
 *
 * PII contract (security-overview.md §1.3): the student's real name
 * MUST NOT reach Anthropic. The current draft input from the route
 * has ALREADY had restoreStudentName run on it (it was returned to
 * the inbox at draft time). This helper strips the real name out
 * via the inverse pattern: route swaps real-name → placeholder
 * before calling the helper, helper rebuilds with placeholder, route
 * restores real-name on the response. The helper itself takes NO
 * name field on its input — see file at PII-allowlist in
 * src/lib/security/__tests__/no-pii-in-ai-prompts.test.ts.
 *
 * Cost: ~600 input + ~150 output tokens per call ≈ $0.001 each.
 * A teacher tweaking 3 drafts per inbox session ≈ $0.003.
 */

import { callAnthropicMessages } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import { STUDENT_NAME_PLACEHOLDER } from "@/lib/security/student-name-placeholder";

export const PROMPT_VERSION = "grading.regeneratedraft.v1.0.0";
const MAX_OUTPUT_TOKENS = 400;

export type RegenerateDirective = "shorter" | "warmer" | "sharper" | "ask";

export interface RegenerateDraftInput {
  /** The teacher's current draft (with placeholder name already
   *  swapped IN by the caller). */
  currentDraft: string;
  /** The tile prompt + criterion give the AI context. */
  tilePrompt: string;
  criterionLabel: string;
  /** The student's response — anchors the regeneration to specifics. */
  studentResponse: string;
  /** Which tweak the teacher hit. */
  directive: RegenerateDirective;
  /** Required when directive === "ask"; the teacher's free-form
   *  instruction (e.g. "make it more specific to the design cycle"). */
  askText?: string;
  // NO name field — see file header.
}

export interface RegenerateDraftOutput {
  draftBody: string;
  directive: RegenerateDirective;
  modelVersion: string;
  promptVersion: string;
}

const REGENERATE_TOOL = {
  name: "submit_regenerated_draft",
  description:
    "Submit the regenerated teacher feedback draft. The body MUST preserve the original pedagogical intent but apply the directed adjustment. Use 'Student' as the placeholder name — the platform substitutes the real name post-response.",
  input_schema: {
    type: "object" as const,
    properties: {
      draft_body: {
        type: "string",
        description:
          "The regenerated teacher feedback. Plain text (no HTML). Addressed in second person to 'Student'. Length depends on directive — see system prompt.",
      },
    },
    required: ["draft_body"],
  },
};

function directiveInstruction(input: RegenerateDraftInput): string {
  switch (input.directive) {
    case "shorter":
      return "ADJUSTMENT: compress this to 1-2 sentences. Keep the single most important point. Drop preamble + softening phrases.";
    case "warmer":
      return "ADJUSTMENT: soften the tone — more encouraging, more human, less clinical. Acknowledge effort where genuine. Do NOT add empty praise ('great', 'awesome'). Keep the substance.";
    case "sharper":
      return "ADJUSTMENT: more direct + specific. Cut hedging words ('maybe', 'might', 'perhaps', 'I think'). Name the gap exactly. The student learns more from clarity than from cushioning.";
    case "ask": {
      const ask = (input.askText ?? "").trim();
      // Route validates non-empty before calling; defensive fallback.
      if (!ask) {
        return "ADJUSTMENT: refine for clarity and specificity.";
      }
      // Cap the teacher's instruction to keep the prompt bounded.
      const trimmed = ask.length > 400 ? ask.slice(0, 400) + "…" : ask;
      return `ADJUSTMENT (teacher's free-form instruction): ${trimmed}`;
    }
  }
}

function buildSystemPrompt(input: RegenerateDraftInput): string {
  const studentRef = STUDENT_NAME_PLACEHOLDER;
  return [
    "You are a calibrated grading assistant for a secondary-school design-technology platform.",
    `You are REGENERATING an existing teacher feedback draft to ${studentRef} based on a specific adjustment the teacher requested. The platform will substitute the real student name post-response — always address them by "${studentRef}".`,
    "",
    "Universal principles:",
    "- Preserve the original pedagogical intent (what the teacher was trying to teach). Only change HOW it's said, not WHAT.",
    "- Anchor to something specific from the student's response. Generic feedback teaches nothing.",
    "- Plain text only — no headings, bullets, HTML. No 'Hi Student,' opening; just the substance.",
    "- Skip 'great', 'awesome', 'I appreciate'. Warmth comes from precision, not flattery.",
    "- Don't reveal scores or use scoring language.",
    "",
    directiveInstruction(input),
    "",
    `Criterion: ${input.criterionLabel}.`,
  ].join("\n");
}

function buildUserPrompt(input: RegenerateDraftInput): string {
  const lines: string[] = [];
  lines.push("TILE PROMPT:");
  lines.push(input.tilePrompt.trim() || "(prompt not available)");
  lines.push("");
  lines.push("STUDENT'S RESPONSE:");
  lines.push(input.studentResponse.trim() || "(no submission)");
  lines.push("");
  lines.push("CURRENT DRAFT (to be regenerated):");
  lines.push(input.currentDraft.trim() || "(empty)");
  lines.push("");
  lines.push(
    "Apply the adjustment from the system prompt and submit via submit_regenerated_draft.",
  );
  return lines.join("\n");
}

/**
 * Call Haiku and return the regenerated draft. Throws on API errors;
 * caller wraps for route-level handling.
 */
export async function regenerateDraft(
  input: RegenerateDraftInput,
  apiKey?: string,
): Promise<RegenerateDraftOutput> {
  const baseOutput: RegenerateDraftOutput = {
    draftBody: "",
    directive: input.directive,
    modelVersion: MODELS.HAIKU,
    promptVersion: PROMPT_VERSION,
  };

  // Defensive: if the current draft is empty, nothing to tweak. The
  // route should pre-check + 400 before reaching here.
  if (!input.currentDraft.trim()) {
    return { ...baseOutput, draftBody: "" };
  }

  const callResult = await callAnthropicMessages({
    apiKey,
    endpoint: "lib/grading/regenerate-draft",
    model: MODELS.HAIKU,
    maxTokens: MAX_OUTPUT_TOKENS,
    system: buildSystemPrompt(input),
    messages: [{ role: "user", content: buildUserPrompt(input) }],
    tools: [REGENERATE_TOOL],
    toolChoice: { type: "tool", name: REGENERATE_TOOL.name },
  });

  if (!callResult.ok) {
    if (callResult.reason === "truncated") {
      throw new Error(
        `regenerateDraft hit max_tokens=${MAX_OUTPUT_TOKENS} cap — response truncated. Raise cap or shorten draft.`,
      );
    }
    if (callResult.reason === "api_error") throw callResult.error;
    throw new Error(
      `regenerateDraft — callAnthropicMessages failed: ${callResult.reason}`,
    );
  }

  const response = callResult.response;
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use" || !toolUse.input) {
    throw new Error(
      `regenerateDraft — Haiku returned no tool_use block (stop_reason=${response.stop_reason}). Check prompt + tool definition.`,
    );
  }

  const raw = toolUse.input as { draft_body?: unknown };
  const draftBody =
    typeof raw.draft_body === "string" && raw.draft_body.trim().length > 0
      ? raw.draft_body.trim()
      : "";

  return { ...baseOutput, draftBody };
}
