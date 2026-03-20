import { createAdminClient } from "@/lib/supabase/admin";

// Cost per 1M tokens (USD) — updated 2026-03
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.80, output: 4.00 },
  "claude-sonnet-4-20250514": { input: 3.00, output: 15.00 },
  "claude-opus-4-20250514": { input: 15.00, output: 75.00 },
};

function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-haiku-4-5-20251001"];
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

interface UsageEntry {
  userId?: string;
  studentId?: string;
  endpoint: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Log an AI API usage event. Fire-and-forget — does not throw.
 */
export function logUsage(entry: UsageEntry): void {
  const cost = estimateCost(
    entry.model,
    entry.inputTokens ?? 0,
    entry.outputTokens ?? 0
  );

  // Fire and forget — don't block the request
  const supabase = createAdminClient();
  supabase
    .from("ai_usage_log")
    .insert({
      user_id: entry.userId ?? null,
      student_id: entry.studentId ?? null,
      endpoint: entry.endpoint,
      model: entry.model,
      input_tokens: entry.inputTokens ?? null,
      output_tokens: entry.outputTokens ?? null,
      estimated_cost_usd: cost,
      metadata: entry.metadata ?? {},
    })
    .then(({ error }) => {
      if (error) {
        console.error("[usage-tracking] Failed to log:", error.message);
      }
    });
}
