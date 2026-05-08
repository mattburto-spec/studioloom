/**
 * Shared toolkit API helpers.
 *
 * Eliminates duplicated callHaiku(), rate limiting, JSON parsing,
 * error handling, and usage logging across all toolkit routes.
 *
 * Previously copied 17+ times across routes (~2,800 wasted lines).
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, type RateLimitWindow } from "@/lib/rate-limit";
import { logUsage } from "@/lib/usage-tracking";
import { callAnthropicMessages } from "@/lib/ai/call";
import * as Sentry from "@sentry/nextjs";
import type { ToolkitAIResult, ToolkitRequestBody } from "./types";
import { MODELS } from "@/lib/ai/models";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default rate limits for toolkit tools: 50/min, 500/hour per session */
export const TOOLKIT_RATE_LIMITS: RateLimitWindow[] = [
  { maxRequests: 50, windowMs: 60 * 1000 },
  { maxRequests: 500, windowMs: 60 * 60 * 1000 },
];

const HAIKU_MODEL = MODELS.HAIKU;

// ---------------------------------------------------------------------------
// callHaiku — single implementation replaces 17 copies
// ---------------------------------------------------------------------------

/**
 * Call Claude Haiku 4.5 with a system prompt and user prompt.
 * Used by all toolkit tools for student-facing AI interactions.
 *
 * Phase A.3 — routes through callAnthropicMessages chokepoint. Endpoint
 * attribution is set by logToolkitUsage at the call site (helper passes
 * a placeholder; real endpoint+studentId+metadata go through logToolkitUsage
 * to preserve the existing toolkit telemetry shape).
 */
export async function callHaiku(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 300
): Promise<ToolkitAIResult> {
  // skipLogUsage: callers wrap with logToolkitUsage which logs the per-tool
  // endpoint + tool/action metadata; helper-side logging would double-write.
  const callResult = await callAnthropicMessages({
    endpoint: "lib/toolkit/shared-api",
    model: HAIKU_MODEL,
    maxTokens,
    temperature: 0.8,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    skipLogUsage: true,
  });

  if (!callResult.ok) {
    if (callResult.reason === "no_credentials") throw new Error("AI service not configured");
    if (callResult.reason === "truncated") throw new Error(`AI call failed: max_tokens=${maxTokens} truncation`);
    if (callResult.reason === "api_error") {
      const msg = callResult.error instanceof Error ? callResult.error.message : String(callResult.error);
      throw new Error(`AI call failed: ${msg}`);
    }
    throw new Error(`AI call failed: ${callResult.reason}`);
  }

  const response = callResult.response;
  const textBlock = response.content.find((b) => b.type === "text");

  return {
    text: textBlock?.type === "text" ? textBlock.text : "",
    inputTokens: callResult.usage.input_tokens,
    outputTokens: callResult.usage.output_tokens,
  };
}

// ---------------------------------------------------------------------------
// validateToolkitRequest — parse body + rate limit in one call
// ---------------------------------------------------------------------------

/**
 * Parse and validate a toolkit API request. Returns the typed body or an error response.
 *
 * Checks: body parsing, required fields (action, challenge, sessionId),
 * action whitelist, and rate limiting.
 */
export async function validateToolkitRequest(
  request: NextRequest,
  toolName: string,
  validActions: string[]
): Promise<{ body: ToolkitRequestBody; error?: never } | { body?: never; error: NextResponse }> {
  let body: ToolkitRequestBody;
  try {
    body = (await request.json()) as ToolkitRequestBody;
  } catch {
    return { error: NextResponse.json({ error: "Invalid request body" }, { status: 400 }) };
  }

  const { action, challenge, sessionId } = body;

  if (!action || !challenge?.trim() || !sessionId) {
    return {
      error: NextResponse.json(
        { error: "Missing required fields: action, challenge, sessionId" },
        { status: 400 }
      ),
    };
  }

  if (!validActions.includes(action)) {
    return {
      error: NextResponse.json(
        { error: `Invalid action. Must be: ${validActions.join(", ")}` },
        { status: 400 }
      ),
    };
  }

  const { allowed, retryAfterMs } = rateLimit(`tool:${toolName}:${sessionId}`, TOOLKIT_RATE_LIMITS);
  if (!allowed) {
    return {
      error: NextResponse.json(
        { error: "Too many requests. Take a breath and try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((retryAfterMs || 1000) / 1000)) },
        }
      ),
    };
  }

  return { body };
}

// ---------------------------------------------------------------------------
// parseToolkitJSON — JSON parse with regex fallback
// ---------------------------------------------------------------------------

/**
 * Parse a JSON object from AI response text. Handles:
 * 1. Clean JSON
 * 2. JSON wrapped in markdown code blocks
 * 3. Regex extraction of individual fields as last resort
 *
 * Returns the parsed object or the fallback shape on failure.
 */
export function parseToolkitJSON<T extends Record<string, unknown>>(
  text: string,
  fallbackShape: T
): T {
  const trimmed = text.trim();

  // Try 1: direct JSON parse
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "object" && parsed !== null) return parsed as T;
  } catch {
    // continue
  }

  // Try 2: extract JSON object from surrounding text
  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === "object" && parsed !== null) return parsed as T;
    }
  } catch {
    // continue
  }

  // Try 3: regex extraction for common fields (nudge + acknowledgment)
  const result = { ...fallbackShape } as Record<string, unknown>;
  for (const key of Object.keys(fallbackShape)) {
    const match = trimmed.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, "i"));
    if (match) result[key] = match[1];
  }

  // If we extracted at least one field, return it
  const extracted = Object.keys(fallbackShape).some(
    (k) => result[k] !== fallbackShape[k]
  );
  if (extracted) return result as T;

  return fallbackShape;
}

/**
 * Parse a JSON array from AI response text with fallback extraction.
 */
export function parseToolkitJSONArray(text: string): string[] | null {
  const trimmed = text.trim();

  // Try 1: direct parse
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((p) => String(p).trim());
  } catch {
    // continue
  }

  // Try 2: extract array
  try {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed.map((p) => String(p).trim());
    }
  } catch {
    // continue
  }

  // Try 3: extract quoted strings
  const matches = trimmed.match(/"([^"]+)"/g);
  if (matches && matches.length >= 2) {
    return matches.map((m) => m.replace(/"/g, "").trim());
  }

  return null;
}

// ---------------------------------------------------------------------------
// logToolkitUsage — usage logging with Sentry
// ---------------------------------------------------------------------------

/**
 * Log toolkit AI usage and optionally capture in Sentry breadcrumbs.
 */
export function logToolkitUsage(
  endpoint: string,
  result: ToolkitAIResult,
  metadata: Record<string, unknown> = {}
): void {
  logUsage({
    endpoint,
    model: HAIKU_MODEL,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    metadata,
  });
}

// ---------------------------------------------------------------------------
// toolkitErrorResponse — consistent error format with Sentry
// ---------------------------------------------------------------------------

/**
 * Create a consistent error response for toolkit routes.
 * Logs to console and captures in Sentry.
 */
export function toolkitErrorResponse(toolName: string, error: unknown): NextResponse {
  console.error(`[${toolName}] Error:`, error);

  try {
    Sentry.captureException(error, { tags: { tool: toolName, layer: "toolkit-api" } });
  } catch {
    // Sentry not available — that's fine
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json(
    { error: `${toolName} tool error: ${message}` },
    { status: 500 }
  );
}
