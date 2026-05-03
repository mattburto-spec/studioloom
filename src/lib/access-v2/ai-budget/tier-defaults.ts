/**
 * SCAFFOLD — Phase 5.2
 *
 * Per-tier daily AI token cap defaults. Code constants are the FLOOR;
 * admin_settings.ai.budget.tier_default.<tier> overrides at runtime when set.
 *
 * Q1 resolution (3 May 2026): code constants + admin_settings runtime override.
 * Constants ensure the system always works on a fresh deploy with no DB rows;
 * admin_settings allows changing caps without redeploy when monetisation lands.
 *
 * Mirrors cost-alert pattern (env-var-first, code-fallback).
 */

export const TIER_DEFAULTS = {
  pilot: 50_000,
  free: 50_000,
  starter: 75_000,
  pro: 100_000,
  school: 200_000,
} as const;

export type SubscriptionTier = keyof typeof TIER_DEFAULTS;

export async function readTierDefault(
  _supabase: unknown,
  _tier: SubscriptionTier,
): Promise<number> {
  throw new Error(
    "[scaffold] readTierDefault not implemented — see docs/projects/access-model-v2-phase-5-brief.md §5.2",
  );
}
