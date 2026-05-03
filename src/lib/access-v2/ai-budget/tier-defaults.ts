/**
 * AI budget tier defaults — Phase 5.2.
 *
 * Per-tier daily AI token cap defaults. Code constants are the FLOOR;
 * admin_settings.ai.budget.tier_default.<tier> overrides at runtime when set.
 *
 * Q1 resolution (3 May 2026): code constants + admin_settings runtime override.
 * Constants ensure the system always works on a fresh deploy with no DB rows;
 * admin_settings allows changing caps without redeploy when monetisation lands.
 *
 * Mirrors cost-alert pattern (env-var-first, code-fallback).
 *
 * Tier values per master spec §4 line 269:
 *   pilot/free → 50000
 *   starter    → 75000
 *   pro        → 100000
 *   school     → 200000
 *
 * Tier 'starter' kept dormant per Phase 4 part 2 close-out decision (5-tier
 * enum stays for forward-compat; v1 only uses pilot/free/pro/school).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const TIER_DEFAULTS = {
  pilot: 50_000,
  free: 50_000,
  starter: 75_000,
  pro: 100_000,
  school: 200_000,
} as const;

export type SubscriptionTier = keyof typeof TIER_DEFAULTS;

const ADMIN_SETTING_KEY_PREFIX = "ai.budget.tier_default.";

/**
 * Resolve the daily token cap for a subscription tier. Reads
 * admin_settings.ai.budget.tier_default.<tier> first; falls back to
 * the code constant. Returns the constant on any DB read failure
 * (defensive — tier defaults must always have a value).
 */
export async function readTierDefault(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  tier: SubscriptionTier,
): Promise<number> {
  const key = `${ADMIN_SETTING_KEY_PREFIX}${tier}`;
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    const raw = (data as { value?: unknown } | null)?.value;
    const parsed = parseTokenCap(raw);
    if (parsed !== null) {
      return parsed;
    }
  } catch {
    // Fall through to constant
  }
  return TIER_DEFAULTS[tier];
}

/**
 * Coerce an admin_settings.value JSON payload to a non-negative integer.
 * Accepts plain numbers OR { tokens: number } shape. Returns null for
 * anything else (caller falls back to constant).
 */
function parseTokenCap(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw);
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    "tokens" in raw &&
    typeof (raw as { tokens: unknown }).tokens === "number"
  ) {
    const n = (raw as { tokens: number }).tokens;
    if (Number.isFinite(n) && n >= 0) {
      return Math.floor(n);
    }
  }
  return null;
}
