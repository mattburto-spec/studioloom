/**
 * Class DJ — Stage 5 (LLM narration).
 *
 * Writes the three "why" lines (≤18 words each) for the picks the
 * deterministic Stage 4 ranker has already chosen. The LLM ONLY writes
 * words — the picks are locked.
 *
 * Brief: docs/projects/class-dj-block-brief.md §3.5 Stage 5 + §6.2
 * (system prompt frozen v1).
 *
 * Chokepoint compliance: routes via callAnthropicMessages. Endpoint:
 * `student/class-dj-narrate`. Attribution: teacherId.
 *
 * stop_reason guard per Lesson #39: max_tokens = 600 (three short
 * lines + frame).
 *
 * Failure tolerance: if Stage 5 fails, the round can STILL complete
 * with generic "the room voted for X" placeholder lines — the picks
 * themselves are unchanged. The frontend exposes a "Regenerate
 * narration" button that re-calls this stage only.
 */

import { callAnthropicMessages } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import type { Candidate, ConflictMode } from "./types";

interface NarrationOk {
  ok: true;
  whyLines: [string, string, string];
}
interface NarrationFail {
  ok: false;
  error: string;
}

function validateNarration(input: unknown): NarrationOk | NarrationFail {
  if (!input || typeof input !== "object") return { ok: false, error: "Input not an object" };
  const obj = input as { why_lines?: unknown };
  if (!Array.isArray(obj.why_lines)) return { ok: false, error: "Missing or non-array `why_lines`" };
  if (obj.why_lines.length !== 3) {
    return { ok: false, error: `Expected exactly 3 why_lines, got ${obj.why_lines.length}` };
  }
  for (let i = 0; i < 3; i++) {
    const w = obj.why_lines[i];
    if (typeof w !== "string" || w.length === 0 || w.length > 200) {
      return { ok: false, error: `why_lines[${i}] invalid (must be non-empty string ≤ 200 chars)` };
    }
  }
  return { ok: true, whyLines: [obj.why_lines[0], obj.why_lines[1], obj.why_lines[2]] as [string, string, string] };
}

const SYSTEM_PROMPT = `You write the "why" line for three already-chosen music suggestions in a classroom Class DJ round. The picks were made by a deterministic ranker; you only write the words. Each why-line must:
1. Be ≤ 18 words.
2. Name the room's mood/energy consensus or the split honestly ("4 of you voted focus", "your room split between build and vibe").
3. Be written for students aged 11–18 — playful, not patronising.
4. Reference specific data from the inputs — counts, conflict mode, seeds that won.
5. If the pick's seed_origin is set, you may casually acknowledge ("…inspired by what one of you put in the hat").

Return JSON via the submit_narration tool: { "why_lines": [w1, w2, w3] } — three strings, ordered to match the input picks.`;

const TOOL_DEFINITION = {
  name: "submit_narration",
  description: "Submit three why-lines (≤18 words each), in the same order as the picks.",
  input_schema: {
    type: "object" as const,
    properties: {
      why_lines: {
        type: "array",
        items: { type: "string", maxLength: 200 },
        minItems: 3,
        maxItems: 3,
      },
    },
    required: ["why_lines"],
  },
};

const MAX_TOKENS = 600;

export interface Stage5Input {
  picks: Candidate[]; // exactly 3
  conflictMode: ConflictMode;
  dominantMoodSummary: string;
  seedsThatContributed: string[];
  fairnessStory?: string;
  voteCount: number;
  classSize: number;
}

export type Stage5Result =
  | { ok: true; whyLines: [string, string, string]; raw: unknown }
  | { ok: false; reason: "truncated" | "parse_error" | "api_error" | "no_credentials" | "over_cap"; detail?: string };

function buildUserPrompt(input: Stage5Input): string {
  const lines: string[] = [];
  lines.push(`Vote count: ${input.voteCount} of ${input.classSize} students voted.`);
  lines.push(`Conflict mode: ${input.conflictMode}.`);
  lines.push(`Dominant mood/energy: ${input.dominantMoodSummary}`);
  if (input.seedsThatContributed.length > 0) {
    lines.push(`Seeds that contributed: ${input.seedsThatContributed.join(", ")}`);
  }
  if (input.fairnessStory) lines.push(`Fairness note: ${input.fairnessStory}`);
  lines.push("");
  lines.push("Picks (in order — your why_lines must match this order):");
  input.picks.forEach((p, i) => {
    lines.push(
      `${i + 1}. ${p.name} (${p.kind}) — mood tags ${p.moodTags.join(",")} — energy ${p.energyEstimate}` +
        (p.seedOrigin ? ` — seed_origin: ${p.seedOrigin}` : ""),
    );
  });
  return lines.join("\n");
}

export async function callStage5Narrate(
  input: Stage5Input,
  teacherId: string,
  metadata: Record<string, unknown> = {},
): Promise<Stage5Result> {
  if (input.picks.length !== 3) {
    return { ok: false, reason: "parse_error", detail: `Expected exactly 3 picks, got ${input.picks.length}` };
  }

  const userPrompt = buildUserPrompt(input);

  const result = await callAnthropicMessages({
    model: MODELS.HAIKU,
    endpoint: "student/class-dj-narrate",
    teacherId,
    maxTokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    tools: [TOOL_DEFINITION],
    toolChoice: { type: "tool", name: "submit_narration" },
    metadata: {
      ...metadata,
      conflict_mode: input.conflictMode,
      vote_count: input.voteCount,
      stage: 5,
    },
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason, detail: result.reason === "truncated" ? "Stage 5 narration truncated at max_tokens" : undefined };
  }

  const block = result.response.content.find((c) => c.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    return { ok: false, reason: "parse_error", detail: "No tool_use block in response" };
  }

  const parsed = validateNarration(block.input);
  if (!parsed.ok) {
    return { ok: false, reason: "parse_error", detail: parsed.error };
  }

  return {
    ok: true,
    whyLines: parsed.whyLines,
    raw: block.input,
  };
}

/** Fallback narration when Stage 5 fails — keeps the round shippable. */
export function fallbackWhyLines(picks: Candidate[]): string[] {
  return picks.map((p) => `the room voted for ${p.moodTags[0] ?? "this vibe"}`);
}

export const STAGE5_MAX_TOKENS = MAX_TOKENS;
export const STAGE5_SYSTEM_PROMPT = SYSTEM_PROMPT;
