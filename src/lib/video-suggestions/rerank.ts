/**
 * Re-ranker — feeds YouTube's top-N candidates into Sonnet and asks
 * for the best 3 matches with a one-line "Why this fits" caption.
 *
 * Uses Anthropic tool-use to force structured JSON output. The tool
 * has no side effects — it's a typed return-value schema in disguise,
 * the project's established pattern for "ask Claude for structured
 * data" (see callAnthropicMessages + toolChoice usage).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { callAnthropicMessages } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import type { SuggestionContext, VideoCandidate, YouTubeRawItem } from "./types";

// Use the central MODELS constant rather than hardcoding a string.
// Keeps the re-ranker in lockstep with the rest of the platform's
// Sonnet usage, dodges the render-path-fixtures wiring-lock guard
// (5.13), and avoids runtime 404s from typo'd model strings.
// PR #281 originally hardcoded "claude-sonnet-4-6"; if that newer
// Sonnet version is wanted long-term, add MODELS.SONNET_LATEST in
// models.ts first then swap here.
export const SONNET_MODEL = MODELS.SONNET;

const SYSTEM_PROMPT = `You re-rank YouTube videos for a secondary school (ages 11-18) teacher about to attach one to a lesson activity.

You receive a teacher's activity context and a list of candidate videos. Pick the 3 best fits and write a one-line "why this fits" caption for each.

Hard rules:
- Reject clickbait, reaction videos, drama, sensationalised hooks, off-topic content.
- Reject if the title or description suggests adult themes, profanity, or anything inappropriate for the stated grade.
- Reject videos that are pure entertainment with no teaching value for the stated activity.
- Captions must be ONE sentence (max ~20 words). Concrete, specific to the activity — not generic ("a good video about empathy").

If fewer candidates pass than the teacher asked for, return what you have. If none pass, return an empty array. NEVER return more than the requested count.`;

const RERANK_TOOL = {
  name: "submit_rerank",
  description: "Return the chosen videos with their fit captions.",
  input_schema: {
    type: "object",
    properties: {
      picks: {
        type: "array",
        maxItems: 10,
        description:
          "Best-fit videos in rank order (best first). Empty if none pass. Cap at the count the prompt asks for.",
        items: {
          type: "object",
          properties: {
            videoId: {
              type: "string",
              description: "YouTube video ID, copied verbatim from the input.",
            },
            caption: {
              type: "string",
              description:
                "One sentence (max ~20 words) — concrete reason this fits the teacher's activity.",
            },
          },
          required: ["videoId", "caption"],
        },
      },
    },
    required: ["picks"],
  },
} as const;

interface ToolPick {
  videoId: string;
  caption: string;
}

export function composeRerankPrompt(
  ctx: SuggestionContext,
  items: YouTubeRawItem[],
  count: number = 3,
): string {
  const ctxLines: string[] = [];
  if (ctx.unitTitle) ctxLines.push(`Unit: ${ctx.unitTitle}`);
  if (ctx.subject) ctxLines.push(`Subject: ${ctx.subject}`);
  if (ctx.gradeLevel) ctxLines.push(`Grade level: ${ctx.gradeLevel}`);
  if (ctx.framing) ctxLines.push(`Framing: ${ctx.framing}`);
  if (ctx.task) ctxLines.push(`Task: ${ctx.task}`);
  if (ctx.success_signal) ctxLines.push(`Success signal: ${ctx.success_signal}`);
  if (ctx.extraKeywords?.trim()) {
    ctxLines.push(`Teacher's extra keywords: ${ctx.extraKeywords.trim()}`);
  }
  if (ctx.excludeKeywords?.trim()) {
    ctxLines.push(`Teacher's exclude keywords: ${ctx.excludeKeywords.trim()}`);
  }

  const itemLines = items.map((it, i) => {
    const mins = Math.round(it.durationSeconds / 60);
    return [
      `[${i + 1}] videoId=${it.videoId}`,
      `  title: ${it.title}`,
      `  channel: ${it.channelTitle}`,
      `  duration: ${mins} min`,
      `  description: ${it.description.slice(0, 240)}`,
    ].join("\n");
  });

  return [
    "ACTIVITY CONTEXT:",
    ctxLines.join("\n") || "(no context)",
    "",
    `CANDIDATES (${items.length}):`,
    itemLines.join("\n\n"),
    "",
    `Call submit_rerank with up to ${count} picks (best first). Never exceed ${count}.`,
  ].join("\n");
}

/**
 * Match the tool-output picks back against the input items. Drops any
 * pick whose videoId isn't in the candidate set (defence against the
 * model hallucinating IDs).
 */
export function assembleCandidates(
  picks: ToolPick[],
  items: YouTubeRawItem[],
): VideoCandidate[] {
  const byId = new Map(items.map((i) => [i.videoId, i] as const));
  const out: VideoCandidate[] = [];
  for (const pick of picks) {
    const raw = byId.get(pick.videoId);
    if (!raw) continue;
    out.push({
      videoId: raw.videoId,
      url: `https://www.youtube.com/watch?v=${raw.videoId}`,
      title: raw.title,
      channelTitle: raw.channelTitle,
      thumbnail: raw.thumbnail,
      durationSeconds: raw.durationSeconds,
      caption: pick.caption.trim(),
    });
  }
  return out;
}

export interface RerankResult {
  candidates: VideoCandidate[];
  /** Reason if no candidates surfaced — useful for the UI empty state. */
  note?: string;
}

export async function rerankWithClaude(
  ctx: SuggestionContext,
  items: YouTubeRawItem[],
  opts: { supabase: SupabaseClient; teacherId: string; count?: number },
): Promise<RerankResult> {
  if (items.length === 0) {
    return { candidates: [], note: "no embeddable matches" };
  }
  // Hard-cap count to the tool schema's maxItems so a buggy caller
  // can't ask the model to overflow.
  const count = Math.min(Math.max(opts.count ?? 3, 1), 10);

  const result = await callAnthropicMessages({
    endpoint: "teacher/suggest-videos:rerank",
    model: SONNET_MODEL,
    supabase: opts.supabase,
    teacherId: opts.teacherId,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: composeRerankPrompt(ctx, items, count) },
    ],
    // Per-pick output ~50-80 tokens. Budget = count * 100 + 200 overhead,
    // floored at 800 so the 3-pick default behaves like before.
    maxTokens: Math.max(800, count * 100 + 200),
    temperature: 0.2,
    tools: [RERANK_TOOL as never],
    toolChoice: { type: "tool", name: RERANK_TOOL.name },
    metadata: {
      phase: "rerank",
      candidateCount: items.length,
      requestedCount: count,
    },
  });

  if (!result.ok) {
    if (result.reason === "over_cap") {
      throw Object.assign(new Error("over_cap"), { reason: "over_cap" as const });
    }
    throw Object.assign(new Error(`rerank ${result.reason}`), {
      reason: result.reason,
    });
  }

  const toolBlock = result.response.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> => b.type === "tool_use",
  );
  if (!toolBlock) {
    return { candidates: [], note: "rerank returned no structured output" };
  }
  const input = toolBlock.input as { picks?: ToolPick[] };
  // Hard-cap to count even though the prompt + schema both ask for ≤ count
  // — defensive against a model that overshoots.
  const picks = Array.isArray(input?.picks) ? input.picks.slice(0, count) : [];
  const candidates = assembleCandidates(picks, items);
  return {
    candidates,
    note: candidates.length === 0 ? "no candidates passed re-rank" : undefined,
  };
}
