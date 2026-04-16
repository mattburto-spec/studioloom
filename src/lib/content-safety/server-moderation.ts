// Server-side Haiku moderation — Phase 5D
// Sends student text or images to Haiku 4.5 for content safety classification.
// Returns ModerationResult from content-safety types.
//
// Failure behaviour: Haiku unreachable or malformed output → status='pending',
// NEVER 'clean'. Per spec §7.3: "NEVER pass content through as 'clean' on API failure."
//
// Image handling: accepts Buffer, base64-encodes for Haiku vision.
// No server-side resize — client already compresses via compressImage().

import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai/models";
import type {
  ModerationResult,
  ModerationFlag,
  ModerationContext,
  FlagType,
  Severity,
  ModerationLayer,
} from "./types";
import {
  MODERATION_SYSTEM_PROMPT,
  MODERATION_TOOL_SCHEMA,
} from "./prompts/moderation-system";

export interface ModerationCost {
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  estimatedCostUSD: number;
  timeMs: number;
}

export interface ServerModerationResult {
  moderation: ModerationResult;
  cost: ModerationCost;
  rawResponse?: Record<string, unknown>;
}

interface HaikuFlag {
  type: string;
  severity: string;
  confidence: number;
  lang: string;
}

interface HaikuModerationOutput {
  flags: HaikuFlag[];
  overall: string;
}

// Haiku pricing (approximate)
const INPUT_COST_PER_TOKEN = 0.001 / 1000;
const OUTPUT_COST_PER_TOKEN = 0.005 / 1000;

const VALID_FLAG_TYPES = new Set<FlagType>([
  "profanity",
  "bullying",
  "self_harm_risk",
  "sexual",
  "violence",
  "pii",
  "other",
]);
const VALID_SEVERITIES = new Set<Severity>(["info", "warning", "critical"]);

/**
 * Map Haiku's raw output to our typed ModerationFlag[].
 * Defensive: unknown types/severities are mapped to safe defaults.
 */
function mapFlags(raw: HaikuFlag[]): ModerationFlag[] {
  return raw.map((f) => ({
    type: VALID_FLAG_TYPES.has(f.type as FlagType)
      ? (f.type as FlagType)
      : "other",
    severity: VALID_SEVERITIES.has(f.severity as Severity)
      ? (f.severity as Severity)
      : "warning",
    confidence:
      typeof f.confidence === "number"
        ? Math.min(1, Math.max(0, f.confidence))
        : 0.5,
    lang: f.lang === "en" || f.lang === "zh" ? f.lang : "other",
  }));
}

/**
 * Derive overall ModerationResult status from flags.
 * We compute this ourselves rather than trusting Haiku's 'overall' field
 * — defence in depth against hallucinated overall values.
 */
function deriveStatus(flags: ModerationFlag[]): ModerationResult["status"] {
  if (flags.some((f) => f.severity === "critical")) return "blocked";
  if (flags.some((f) => f.severity === "warning")) return "flagged";
  if (flags.length > 0) return "flagged"; // info-only flags still surface
  return "clean";
}

/**
 * Build the pending result returned on any failure.
 * Per spec: "NEVER pass content through as 'clean' on API failure."
 */
function pendingResult(
  reason: string,
  timeMs: number
): ServerModerationResult {
  return {
    moderation: {
      ok: false,
      status: "pending",
      flags: [
        { type: "other", severity: "info", confidence: 0, detail: reason },
      ],
      layer: "server_haiku" as ModerationLayer,
    },
    cost: {
      inputTokens: 0,
      outputTokens: 0,
      modelId: `${MODELS.HAIKU} (failed)`,
      estimatedCostUSD: 0,
      timeMs,
    },
  };
}

/**
 * Build Anthropic message content for text input.
 */
function buildTextContent(text: string, context: ModerationContext) {
  const langHint = context.lang
    ? ` (detected language: ${context.lang})`
    : "";
  return [
    {
      type: "text" as const,
      text: `Content source: ${context.source}${langHint}\n\n${text}`,
    },
  ];
}

/**
 * Build Anthropic message content for image input (base64 → vision).
 */
function buildImageContent(
  imageBuffer: Buffer,
  mimeType: string,
  context: ModerationContext
) {
  const base64 = imageBuffer.toString("base64");
  const mediaType = (
    ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)
      ? mimeType
      : "image/jpeg"
  ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  return [
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: mediaType,
        data: base64,
      },
    },
    {
      type: "text" as const,
      text: `Moderate this image uploaded by a student. Source: ${context.source}. Check for sexual content, violence, self-harm imagery, hate symbols, or other inappropriate content for a K-12 classroom.`,
    },
  ];
}

/**
 * Moderate student content via Haiku 4.5.
 *
 * @param input - Text string OR image Buffer
 * @param context - Class, student, source info + detected language
 * @param apiKey - Anthropic API key (from env or config)
 * @param mimeType - Required when input is Buffer (image media type)
 */
export async function moderateContent(
  input: string | Buffer,
  context: ModerationContext,
  apiKey: string,
  mimeType?: string
): Promise<ServerModerationResult> {
  const startTime = Date.now();

  if (!apiKey) {
    return pendingResult("No API key configured", Date.now() - startTime);
  }

  const isImage = Buffer.isBuffer(input);
  const content = isImage
    ? buildImageContent(input, mimeType || "image/jpeg", context)
    : buildTextContent(input as string, context);

  const client = new Anthropic({ apiKey, maxRetries: 4 });

  try {
    // NOTE: tool_choice + thinking cannot coexist (CLAUDE.md constraint).
    const response = await client.messages.create({
      model: MODELS.HAIKU,
      system: MODERATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      max_tokens: 1024,
      temperature: 0.1,
      tools: [MODERATION_TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "moderate_content" },
    });

    // Lesson #39: inspect stop_reason for max_tokens truncation
    if (response.stop_reason === "max_tokens") {
      console.error(
        `[server-moderation] max_tokens hit: configured=1024, output_tokens=${response.usage?.output_tokens}, model=${MODELS.HAIKU}`
      );
      return pendingResult(
        `max_tokens truncation (output_tokens=${response.usage?.output_tokens})`,
        Date.now() - startTime
      );
    }

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return pendingResult(
        "No tool_use block in response",
        Date.now() - startTime
      );
    }

    // Lesson #39: defensive ?? on every destructured field
    const parsed = toolBlock.input as HaikuModerationOutput;
    const rawFlags = parsed.flags ?? [];
    const flags = mapFlags(rawFlags);
    const status = deriveStatus(flags);

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    return {
      moderation: {
        ok: status === "clean",
        status,
        flags,
        layer: "server_haiku",
      },
      cost: {
        inputTokens,
        outputTokens,
        modelId: MODELS.HAIKU,
        estimatedCostUSD:
          inputTokens * INPUT_COST_PER_TOKEN +
          outputTokens * OUTPUT_COST_PER_TOKEN,
        timeMs: Date.now() - startTime,
      },
      rawResponse: parsed as unknown as Record<string, unknown>,
    };
  } catch (err) {
    console.error(
      "[server-moderation] Haiku call failed — content goes to pending:",
      err instanceof Error ? err.message : err
    );
    return pendingResult(
      `Haiku call failed: ${err instanceof Error ? err.message : "unknown"}`,
      Date.now() - startTime
    );
  }
}
