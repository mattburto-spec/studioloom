/**
 * Stage I-5: Content Moderation (Haiku)
 *
 * Runs Haiku moderation on extracted activity blocks before they reach the
 * review queue. Populates `moderationStatus` + `moderationFlags` on each
 * block and returns a CostBreakdown (summed across the Haiku calls).
 *
 * This is the ingestion-side slice of spec §17.6. The broader student-facing
 * moderation (student_progress, gallery posts, peer review, client-side
 * blocklist, NSFW.js image model) lives in Phase 5 and is NOT wired here.
 *
 * Failure behaviour: if Haiku is unreachable or returns malformed output, the
 * block keeps `moderationStatus='pending'` (i.e. deferred to manual review).
 * We NEVER auto-approve on failure — per spec §7.3 "NEVER pass content
 * through as 'clean' on API failure."
 *
 * OS Seam 1: pure function, receives config, no HTTP/request dependencies.
 */

import { callAnthropicMessages } from "@/lib/ai/call";
import type { CostBreakdown } from "@/types/activity-blocks";
import type { ExtractedBlock, ModeratedBlock, PassConfig } from "./types";

import { MODELS } from "@/lib/ai/models";

const DEFAULT_MODEL = MODELS.HAIKU;

// Haiku pricing (approximate, matches pass-a.ts convention).
const INPUT_COST_PER_TOKEN = 0.001 / 1000;
const OUTPUT_COST_PER_TOKEN = 0.005 / 1000;

const MODERATION_TOOL = {
  name: "moderate_blocks",
  description:
    "Moderate a batch of candidate learning activities. Flag any that contain violence, sexual content, hate, self-harm, illegal activity, harassment, or personally identifying information about minors.",
  input_schema: {
    type: "object" as const,
    properties: {
      decisions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tempId: {
              type: "string",
              description: "The tempId echoed from the input — must match exactly",
            },
            status: {
              type: "string",
              enum: ["approved", "flagged"],
              description:
                "'approved' for clearly safe, age-appropriate educational content. 'flagged' for anything a teacher would want to review before using with students.",
            },
            reason: {
              type: "string",
              description: "One-sentence rationale. Required when status='flagged'.",
            },
            categories: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "violence",
                  "sexual",
                  "hate",
                  "self_harm",
                  "illegal",
                  "harassment",
                  "pii_minors",
                  "other",
                ],
              },
              description: "Flag categories that apply. Empty when status='approved'.",
            },
          },
          required: ["tempId", "status", "categories"],
        },
      },
    },
    required: ["decisions"],
  },
};

function zeroCost(timeMs = 0): CostBreakdown {
  return {
    inputTokens: 0,
    outputTokens: 0,
    modelId: "none",
    estimatedCostUSD: 0,
    timeMs,
  };
}

/**
 * Render a block into the minimal text Haiku needs to make a decision.
 * Kept short to control per-block cost — title + prompt + description is
 * enough to catch the overwhelming majority of flaggable content.
 */
function renderBlockForModeration(block: ExtractedBlock): string {
  const parts = [`[tempId:${block.tempId}]`, `Title: ${block.title}`];
  if (block.description) parts.push(`Description: ${block.description}`);
  parts.push(`Prompt: ${block.prompt.slice(0, 800)}`);
  return parts.join("\n");
}

interface ModerationDecision {
  tempId: string;
  status: "approved" | "flagged";
  reason?: string;
  categories: string[];
}

/**
 * Simulated moderation for sandbox/test mode. Approves everything; the
 * sandbox UI surfaces the fact that moderation ran in simulated mode so
 * the curator knows not to trust it.
 */
function simulateModeration(blocks: ExtractedBlock[]): ModerationDecision[] {
  return blocks.map((b) => ({
    tempId: b.tempId,
    status: "approved",
    categories: [],
  }));
}

export interface ModerationResult {
  blocks: ModeratedBlock[];
  /** Per-block decisions echoed for the log writer in the commit route. */
  decisions: ModerationDecision[];
  cost: CostBreakdown;
}

export async function moderateExtractedBlocks(
  blocks: ExtractedBlock[],
  config: PassConfig
): Promise<ModerationResult> {
  const startTime = Date.now();

  if (blocks.length === 0) {
    return { blocks: [], decisions: [], cost: zeroCost() };
  }

  // Sandbox / no-key mode — approve all, zero cost, obvious signal to curator.
  if (config.sandboxMode || !config.apiKey) {
    const decisions = simulateModeration(blocks);
    const decisionById = new Map(decisions.map((d) => [d.tempId, d]));
    return {
      blocks: blocks.map((b) => ({
        ...b,
        moderationStatus: decisionById.get(b.tempId)?.status ?? "pending",
        moderationFlags: [],
      })),
      decisions,
      cost: { ...zeroCost(Date.now() - startTime), modelId: "simulated" },
    };
  }

  const modelId = config.modelOverride || DEFAULT_MODEL;

  const batchText = blocks.map(renderBlockForModeration).join("\n\n---\n\n");
  const prompt = `You are moderating candidate educational activities before they reach a teacher's review queue. For each block below, decide whether it is safe and age-appropriate for a K-12 classroom, OR whether a teacher should review it first.

Flag anything containing violence beyond age-appropriate context, sexual content, hate speech, self-harm encouragement, illegal activity instructions, harassment, or personally identifying information about minors (names, school, contact details).

Normal design / science / engineering / creative-writing content is almost always 'approved'. Do not flag mild classroom language, historical content, or mature-but-curricular topics (e.g. WW2, evolution, public health). Use 'flagged' sparingly and only when a human should sanity-check.

Blocks to moderate:

${batchText}

Return one decision per block, keyed by the exact tempId from each block's header. Do not invent tempIds.`;

  let decisions: ModerationDecision[];
  let cost: CostBreakdown;
  try {
    const callResult = await callAnthropicMessages({
      apiKey: config.apiKey,
      endpoint: "lib/ingestion/moderate",
      model: modelId,
      system:
        "You are a conservative but sensible content safety reviewer for K-12 classroom material. Your job is to catch things a teacher would want to double-check before assigning, not to flag anything remotely edgy.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2000,
      temperature: 0.1,
      tools: [MODERATION_TOOL],
      toolChoice: { type: "tool", name: "moderate_blocks" },
    });

    if (!callResult.ok) {
      if (callResult.reason === "api_error") throw callResult.error;
      throw new Error(`[Moderation] callAnthropicMessages failed: ${callResult.reason}`);
    }

    const response = callResult.response;
    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new Error("[Moderation] AI did not return structured output");
    }

    const parsed = toolBlock.input as { decisions: ModerationDecision[] };
    decisions = parsed.decisions || [];

    const inputTokens = callResult.usage.input_tokens;
    const outputTokens = callResult.usage.output_tokens;
    cost = {
      inputTokens,
      outputTokens,
      modelId,
      estimatedCostUSD:
        inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN,
      timeMs: Date.now() - startTime,
    };
  } catch (e) {
    // Fail-safe: leave every block at 'pending' so nothing auto-ships.
    console.error("[Moderation] Haiku call failed — deferring all blocks to pending:", e);
    return {
      blocks: blocks.map((b) => ({
        ...b,
        moderationStatus: "pending",
        moderationFlags: [{ category: "other", severity: "info", reason: "moderation_unavailable" }],
      })),
      decisions: blocks.map((b) => ({ tempId: b.tempId, status: "flagged", categories: ["other"], reason: "moderation_unavailable" })),
      cost: { ...zeroCost(Date.now() - startTime), modelId: `${modelId} (failed)` },
    };
  }

  // Join decisions back onto blocks. Any block the model forgot about stays
  // 'pending' — we refuse to auto-approve missing decisions.
  const decisionById = new Map(decisions.map((d) => [d.tempId, d]));
  const moderated: ModeratedBlock[] = blocks.map((b) => {
    const d = decisionById.get(b.tempId);
    if (!d) {
      return {
        ...b,
        moderationStatus: "pending",
        moderationFlags: [{ category: "other", severity: "info", reason: "no_decision_returned" }],
      };
    }
    return {
      ...b,
      moderationStatus: d.status,
      moderationFlags:
        d.categories.length > 0
          ? d.categories.map((c) => ({ category: c, severity: d.status === "flagged" ? "warning" : "info", reason: d.reason }))
          : [],
    };
  });

  return { blocks: moderated, decisions, cost };
}
