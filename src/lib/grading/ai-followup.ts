/**
 * TFL.3 C.3 — Reply-draft AI service.
 *
 * Given a thread where the student has replied to the teacher's
 * feedback (sentiment ∈ {got_it, not_sure, pushback}), draft a
 * pedagogically-grounded follow-up the teacher can one-click approve.
 *
 * Three variants, picked by the student's sentiment. Each is a
 * different pedagogical move:
 *
 *   got_it   — thread resolves; usually no follow-up needed. Return
 *              empty string when silence is the right answer, or a
 *              single warm acknowledgement line when the student's
 *              "got it" carries a side-question worth engaging.
 *   not_sure — clarifying. RE-FRAME using different scaffolding
 *              (concrete example / simpler language / Socratic
 *              question). Never repeat the original wording.
 *   pushback — engage with the disagreement: acknowledge / hold-with-
 *              stronger-reasoning / Socratic question. The most
 *              important pedagogical moment in the thread — the
 *              student is doing the very work the platform is for.
 *
 * PII handling (security-overview.md §1.3): the student's real name
 * MUST NOT reach Anthropic. The prompts address the student by
 * STUDENT_NAME_PLACEHOLDER ("Student"). Caller restores the real
 * name via restoreStudentName() on the returned draftBody. The
 * helper takes NO name field on its input — same contract as the
 * G3.1 generateAiPrescore helper. The route at
 * /api/teacher/grading/draft-followup is the canonical caller.
 *
 * Cost: ~1000 input + ~150 output tokens per call ≈ $0.0015 each.
 * For a teacher with 5 reply_waiting items per inbox session, that's
 * ~$0.0075 per session.
 */

import { callAnthropicMessages } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import { STUDENT_NAME_PLACEHOLDER } from "@/lib/security/student-name-placeholder";
import type { Sentiment } from "@/components/lesson/TeacherFeedback/types";

export const PROMPT_VERSION = "grading.aifollowup.v1.0.0";
const MAX_OUTPUT_TOKENS = 400;

/** Sentinel returned for got_it threads where no follow-up makes
 *  sense. The inbox UI surfaces this as "(no follow-up needed —
 *  approve to close the thread silently)". */
export const NO_FOLLOWUP_SENTINEL = "(no follow-up needed)";

export interface AiFollowupInput {
  /** The student's sentiment on the latest reply turn. */
  sentiment: Sentiment;
  /** The student's reply text (may be empty for single-click got_it). */
  replyText: string;
  /** The original teacher comment that the student is replying to. */
  originalTeacherBody: string;
  /** The student's response to the tile prompt — anchors the thread. */
  studentResponse: string;
  /** Tile prompt + criterion give the AI context. */
  tilePrompt: string;
  criterionLabel: string;
  // No name field — see file header.
}

export interface AiFollowupOutput {
  draftBody: string;
  promptVariant: Sentiment;
  modelVersion: string;
  promptVersion: string;
}

const FOLLOWUP_TOOL = {
  name: "submit_followup",
  description:
    "Submit a teacher follow-up reply to the student. The body MUST address the student's specific reply, NOT repeat the teacher's original wording verbatim. Use the placeholder 'Student' wherever you address them by name — the platform substitutes their real name post-response.",
  input_schema: {
    type: "object" as const,
    properties: {
      followup_body: {
        type: "string",
        description:
          "The follow-up reply body. Plain text (no HTML), addressed in second person to 'Student'. Length depends on sentiment — see system prompt for specifics. Return the literal string \"(no follow-up needed)\" ONLY for got_it cases where silence is more pedagogically honest than a forced acknowledgement.",
      },
    },
    required: ["followup_body"],
  },
};

function buildSystemPrompt(input: AiFollowupInput): string {
  const studentRef = STUDENT_NAME_PLACEHOLDER;
  const common = [
    "You are a calibrated grading assistant for a secondary-school design-technology platform.",
    `You are drafting a TEACHER follow-up to a student's reply in an ongoing feedback thread. The reply is to ${studentRef}. The platform will substitute their real name post-response — always address them by "${studentRef}" exactly.`,
    "",
    "Universal principles:",
    "- Anchor your reply to something specific from the student's response or their reply. Generic feedback teaches nothing.",
    "- Do not repeat your original feedback verbatim. If they didn't get it the first time, the SAME wording won't land the second time.",
    "- Plain text only — no headings, bullets, or HTML. 1-3 sentences.",
    "- Warm but not preachy. Skip 'great question' / 'awesome' / 'I appreciate you sharing'.",
    "- Don't reveal scores or use scoring language. The teacher decides whether to mention numbers.",
    "",
  ];

  switch (input.sentiment) {
    case "got_it":
      return [
        ...common,
        "THIS THREAD: the student replied with 'Got it' to your previous feedback.",
        "",
        "MOST OF THE TIME, the right response is NO RESPONSE — the thread resolves cleanly. If a brief warm acknowledgement feels natural (e.g. their 'got it' had a small side-question or carried real engagement), draft ONE sentence (max 20 words) acknowledging that specifically.",
        "",
        `If silence is more honest than a forced acknowledgement, return the literal string "${NO_FOLLOWUP_SENTINEL}" and nothing else. Do NOT manufacture warmth.`,
        "",
        `Criterion: ${input.criterionLabel}.`,
      ].join("\n");

    case "not_sure":
      return [
        ...common,
        "THIS THREAD: the student replied 'Not sure' — they didn't follow your previous feedback.",
        "",
        "YOUR JOB: identify what specifically confused them from their reply text, then RE-FRAME your original point using DIFFERENT scaffolding. Options:",
        "  (a) Give a concrete example anchored to their own response.",
        "  (b) Restate using simpler language than your original.",
        "  (c) Ask a question that helps them locate the part they DO understand, so you can build from there.",
        "",
        "Length: 2-3 sentences, 40-80 words. Address the student as " +
          studentRef +
          " once, naturally.",
        "",
        "Do NOT repeat your original wording. They already saw that — it didn't land.",
        "",
        `Criterion: ${input.criterionLabel}.`,
      ].join("\n");

    case "pushback":
      return [
        ...common,
        "THIS THREAD: the student disagreed with your previous feedback. This is the most pedagogically valuable moment in the thread — they're doing real thinking.",
        "",
        "YOUR JOB: respond with ONE of three moves, picked by what their counter-argument actually warrants:",
        "  (a) ACKNOWLEDGE where they're right and revise your position. Specific, not 'good point'.",
        "  (b) HOLD your line with STRONGER reasoning, anchored to something specific from their response or reply. Don't just restate.",
        "  (c) Ask a SOCRATIC question that helps them see the weakness in their argument — not a 'gotcha', a genuine prompt to think harder.",
        "",
        "Length: 2-3 sentences, 40-80 words. Address as " + studentRef + " once.",
        "",
        "Critical: do NOT double-down with the SAME wording as your original. That reads as defensive. If you're holding, hold with NEW reasoning.",
        "",
        `Criterion: ${input.criterionLabel}.`,
      ].join("\n");
  }
}

function buildUserPrompt(input: AiFollowupInput): string {
  const lines: string[] = [];
  lines.push("TILE PROMPT:");
  lines.push(input.tilePrompt.trim() || "(prompt not available)");
  lines.push("");
  lines.push("STUDENT'S ORIGINAL RESPONSE:");
  lines.push(input.studentResponse.trim() || "(no submission)");
  lines.push("");
  lines.push("YOUR ORIGINAL FEEDBACK (which the student is replying to):");
  lines.push(input.originalTeacherBody.trim() || "(feedback not available)");
  lines.push("");
  lines.push(`STUDENT'S REPLY (sentiment: ${input.sentiment}):`);
  lines.push(input.replyText.trim() || "(no message — single-click reply)");
  lines.push("");
  lines.push("Draft your follow-up using the submit_followup tool.");
  return lines.join("\n");
}

/**
 * Call Haiku and return the drafted follow-up reply. Throws on
 * Anthropic API errors (caller wraps for route-level handling).
 */
export async function generateAiFollowup(
  input: AiFollowupInput,
  apiKey?: string,
): Promise<AiFollowupOutput> {
  const baseOutput: AiFollowupOutput = {
    draftBody: "",
    promptVariant: input.sentiment,
    modelVersion: MODELS.HAIKU,
    promptVersion: PROMPT_VERSION,
  };

  // Guard: got_it with no reply text + a thin response — no point
  // calling Haiku, just return the sentinel.
  if (
    input.sentiment === "got_it" &&
    !input.replyText.trim() &&
    input.studentResponse.trim().length < 20
  ) {
    return { ...baseOutput, draftBody: NO_FOLLOWUP_SENTINEL };
  }

  const callResult = await callAnthropicMessages({
    apiKey,
    endpoint: "lib/grading/ai-followup",
    model: MODELS.HAIKU,
    maxTokens: MAX_OUTPUT_TOKENS,
    system: buildSystemPrompt(input),
    messages: [{ role: "user", content: buildUserPrompt(input) }],
    tools: [FOLLOWUP_TOOL],
    toolChoice: { type: "tool", name: FOLLOWUP_TOOL.name },
  });

  if (!callResult.ok) {
    if (callResult.reason === "truncated") {
      throw new Error(
        `aiFollowup hit max_tokens=${MAX_OUTPUT_TOKENS} cap — response truncated. Raise cap or shorten prompt.`,
      );
    }
    if (callResult.reason === "api_error") throw callResult.error;
    throw new Error(
      `aiFollowup — callAnthropicMessages failed: ${callResult.reason}`,
    );
  }

  const response = callResult.response;
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use" || !toolUse.input) {
    throw new Error(
      `aiFollowup — Haiku returned no tool_use block (stop_reason=${response.stop_reason}). Check prompt + tool definition.`,
    );
  }

  const raw = toolUse.input as { followup_body?: unknown };
  const draftBody =
    typeof raw.followup_body === "string" && raw.followup_body.trim().length > 0
      ? raw.followup_body.trim()
      : "";

  return { ...baseOutput, draftBody };
}
