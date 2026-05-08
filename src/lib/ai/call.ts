/**
 * AI provider chokepoint.
 *
 * Wraps Anthropic SDK so call sites get consistent stop_reason handling
 * (Lesson #39), logUsage attribution, and withAIBudget integration.
 * Phase A.1 — see docs/projects/ai-provider-abstraction-phase-a-brief.md.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withAIBudget, type AnthropicUsage } from "@/lib/access-v2/ai-budget/middleware";
import { logUsage } from "@/lib/usage-tracking";
import { resolveCredentials } from "./resolve-credentials";

export interface CallOptions {
  model: string;
  messages: Anthropic.MessageParam[];
  maxTokens: number;
  system?: string;
  temperature?: number;
  tools?: Anthropic.Tool[];
  toolChoice?: Anthropic.ToolChoice;
  /** Extended thinking config — incompatible with tool_choice (see CLAUDE.md). */
  thinking?: Anthropic.MessageCreateParamsNonStreaming["thinking"];

  /** Endpoint string for ai_usage_log.endpoint attribution. Required. */
  endpoint: string;

  /**
   * Service-role Supabase client. Required when studentId is set (withAIBudget
   * needs it). Required for teacherId BYOK lookup. Optional otherwise — pure
   * lib functions (ingestion, pipeline) pass `apiKey` directly without supabase.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase?: SupabaseClient<any, any, any>;

  /**
   * Direct Anthropic API key. Highest-priority credential source — bypasses
   * resolveCredentials BYOK and env var. Used by config-driven callers
   * (ingestion + pipeline) where the apiKey is plumbed through their config.
   */
  apiKey?: string;

  /** When set, the call is wrapped in withAIBudget (student-attributed billing). */
  studentId?: string;
  /** When set without studentId, attributed in ai_usage_log as user_id. Used for BYOK lookup. */
  teacherId?: string;
  /** Optional ai_usage_log.metadata enrichment (e.g. { word, l1Target, journeyId }). */
  metadata?: Record<string, unknown>;
  /**
   * Skip the helper's logUsage call. Use when the caller does its own logging
   * with richer attribution (e.g. toolkit tools that log per-tool endpoint
   * via logToolkitUsage). Default: false (helper logs).
   */
  skipLogUsage?: boolean;
}

export type CallSuccess = {
  ok: true;
  response: Anthropic.Message;
  usage: AnthropicUsage;
};

export type CallFailure =
  | { ok: false; reason: "truncated"; cap?: number; used?: number; resetAt?: string }
  | { ok: false; reason: "over_cap"; cap: number; used: number; resetAt: string }
  | { ok: false; reason: "no_credentials" }
  | { ok: false; reason: "api_error"; error: unknown };

export type CallResult = CallSuccess | CallFailure;

export type StreamEvent =
  | { type: "partial_json"; json: string }
  | { type: "complete"; response: Anthropic.Message; usage: AnthropicUsage }
  | { type: "error"; reason: "truncated" | "api_error"; error?: unknown };

interface ResolvedAnthropicCreds {
  apiKey: string;
  modelOverride?: string;
}

async function resolveAnthropicKey(opts: CallOptions): Promise<ResolvedAnthropicCreds | null> {
  if (opts.apiKey) return { apiKey: opts.apiKey };

  if (opts.teacherId && opts.supabase) {
    const creds = await resolveCredentials(opts.supabase, opts.teacherId);
    if (creds && creds.provider === "anthropic" && creds.apiKey) {
      return { apiKey: creds.apiKey, modelOverride: creds.source === "teacher" ? creds.modelName : undefined };
    }
  }
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) return { apiKey: envKey };
  return null;
}

function buildCreateParams(opts: CallOptions, model: string): Anthropic.MessageCreateParamsNonStreaming {
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: opts.maxTokens,
    messages: opts.messages,
  };
  if (opts.system !== undefined) params.system = opts.system;
  if (opts.temperature !== undefined) params.temperature = opts.temperature;
  if (opts.tools !== undefined) params.tools = opts.tools;
  if (opts.toolChoice !== undefined) params.tool_choice = opts.toolChoice;
  if (opts.thinking !== undefined) params.thinking = opts.thinking;
  return params;
}

function fireLogUsage(opts: CallOptions, model: string, usage: AnthropicUsage): void {
  if (opts.skipLogUsage) return;
  // Truly fire-and-forget — logUsage's createAdminClient() throws synchronously
  // when SUPABASE_URL is missing (e.g. tests). Never let logging fail an AI call.
  try {
    logUsage({
      userId: opts.studentId ? undefined : opts.teacherId,
      studentId: opts.studentId,
      endpoint: opts.endpoint,
      model,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      metadata: opts.metadata,
    });
  } catch (err) {
    console.error("[callAnthropicMessages] logUsage failed:", err);
  }
}

function extractUsage(response: Anthropic.Message): AnthropicUsage {
  return {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    stop_reason: response.stop_reason ?? "end_turn",
  };
}

/**
 * Non-streaming Anthropic Messages call. See Lesson #39 — stop_reason="max_tokens"
 * returns reason="truncated" (no logUsage, no billing).
 */
export async function callAnthropicMessages(opts: CallOptions): Promise<CallResult> {
  const resolved = await resolveAnthropicKey(opts);
  if (!resolved) return { ok: false, reason: "no_credentials" };

  const model = resolved.modelOverride || opts.model;
  const client = new Anthropic({ apiKey: resolved.apiKey, maxRetries: 2 });
  const params = buildCreateParams(opts, model);

  if (opts.studentId) {
    if (!opts.supabase) {
      throw new Error("callAnthropicMessages: studentId requires supabase client for withAIBudget");
    }
    const budgetResult = await withAIBudget(opts.supabase, opts.studentId, async () => {
      const response = await client.messages.create(params);
      return { result: response, usage: extractUsage(response) };
    });

    if (!budgetResult.ok) {
      if (budgetResult.reason === "over_cap") {
        return { ok: false, reason: "over_cap", cap: budgetResult.cap, used: budgetResult.used, resetAt: budgetResult.resetAt };
      }
      return { ok: false, reason: "truncated", cap: budgetResult.cap, used: budgetResult.used, resetAt: budgetResult.resetAt };
    }

    const usage = extractUsage(budgetResult.result);
    fireLogUsage(opts, model, usage);
    return { ok: true, response: budgetResult.result, usage };
  }

  let response: Anthropic.Message;
  try {
    response = await client.messages.create(params);
  } catch (error) {
    return { ok: false, reason: "api_error", error };
  }

  const usage = extractUsage(response);
  if (usage.stop_reason === "max_tokens") {
    return { ok: false, reason: "truncated" };
  }

  fireLogUsage(opts, model, usage);
  return { ok: true, response, usage };
}

/**
 * Streaming variant. Yields partial_json events during the stream, then a single
 * complete or error event at the end. Same Lesson #39 + logUsage rules apply.
 */
export async function* streamAnthropicMessages(opts: CallOptions): AsyncGenerator<StreamEvent> {
  const resolved = await resolveAnthropicKey(opts);
  if (!resolved) {
    yield { type: "error", reason: "api_error", error: new Error("no_credentials") };
    return;
  }

  const model = resolved.modelOverride || opts.model;
  const client = new Anthropic({ apiKey: resolved.apiKey, maxRetries: 2 });
  const params = buildCreateParams(opts, model);

  let stream: ReturnType<typeof client.messages.stream>;
  try {
    stream = client.messages.stream(params);
  } catch (error) {
    yield { type: "error", reason: "api_error", error };
    return;
  }

  try {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
        yield { type: "partial_json", json: event.delta.partial_json };
      }
    }
  } catch (error) {
    yield { type: "error", reason: "api_error", error };
    return;
  }

  let finalMessage: Anthropic.Message;
  try {
    finalMessage = await stream.finalMessage();
  } catch (error) {
    yield { type: "error", reason: "api_error", error };
    return;
  }

  const usage = extractUsage(finalMessage);
  if (usage.stop_reason === "max_tokens") {
    yield { type: "error", reason: "truncated" };
    return;
  }

  fireLogUsage(opts, model, usage);
  yield { type: "complete", response: finalMessage, usage };
}
