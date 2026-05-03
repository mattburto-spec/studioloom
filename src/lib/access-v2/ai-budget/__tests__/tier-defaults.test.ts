/**
 * Tests for src/lib/access-v2/ai-budget/tier-defaults.ts (Phase 5.2).
 *
 * Coverage:
 *   - Constants match master spec values
 *   - readTierDefault returns admin_settings value when present + valid
 *   - readTierDefault falls back to constant on missing / invalid / DB error
 */

import { describe, it, expect } from "vitest";
import { TIER_DEFAULTS, readTierDefault, type SubscriptionTier } from "../tier-defaults";

interface MockState {
  adminSettings: Record<string, unknown>;
  throwOnRead: boolean;
}

function buildClient(state: MockState) {
  return {
    from: (table: string) => {
      if (table !== "admin_settings") {
        throw new Error(`Unmocked table: ${table}`);
      }
      return {
        select: () => ({
          eq: (_col: string, key: string) => ({
            maybeSingle: async () => {
              if (state.throwOnRead) {
                throw new Error("simulated admin_settings read failure");
              }
              if (key in state.adminSettings) {
                return {
                  data: { value: state.adminSettings[key] },
                  error: null,
                };
              }
              return { data: null, error: null };
            },
          }),
        }),
      };
    },
  } as unknown as Parameters<typeof readTierDefault>[0];
}

describe("TIER_DEFAULTS constants", () => {
  it("matches the values from master spec §4 line 269", () => {
    expect(TIER_DEFAULTS).toEqual({
      pilot: 50_000,
      free: 50_000,
      starter: 75_000,
      pro: 100_000,
      school: 200_000,
    });
  });

  it("has exactly 5 tier keys (no accidental drift)", () => {
    expect(Object.keys(TIER_DEFAULTS).sort()).toEqual([
      "free",
      "pilot",
      "pro",
      "school",
      "starter",
    ]);
  });
});

describe("readTierDefault — admin_settings override", () => {
  const tiers: SubscriptionTier[] = ["pilot", "free", "starter", "pro", "school"];

  for (const tier of tiers) {
    it(`returns the constant ${TIER_DEFAULTS[tier]} for tier '${tier}' when admin_settings is empty`, async () => {
      const supabase = buildClient({ adminSettings: {}, throwOnRead: false });
      expect(await readTierDefault(supabase, tier)).toBe(TIER_DEFAULTS[tier]);
    });
  }

  it("returns admin_settings value when set as a plain number", async () => {
    const supabase = buildClient({
      adminSettings: { "ai.budget.tier_default.pro": 250_000 },
      throwOnRead: false,
    });
    expect(await readTierDefault(supabase, "pro")).toBe(250_000);
  });

  it("returns admin_settings value when wrapped as { tokens: number }", async () => {
    const supabase = buildClient({
      adminSettings: { "ai.budget.tier_default.school": { tokens: 500_000 } },
      throwOnRead: false,
    });
    expect(await readTierDefault(supabase, "school")).toBe(500_000);
  });

  it("floors fractional admin_settings values", async () => {
    const supabase = buildClient({
      adminSettings: { "ai.budget.tier_default.pilot": 50_000.99 },
      throwOnRead: false,
    });
    expect(await readTierDefault(supabase, "pilot")).toBe(50_000);
  });

  it("falls back to constant when admin_settings value is negative", async () => {
    const supabase = buildClient({
      adminSettings: { "ai.budget.tier_default.pro": -1 },
      throwOnRead: false,
    });
    expect(await readTierDefault(supabase, "pro")).toBe(TIER_DEFAULTS.pro);
  });

  it("falls back to constant when admin_settings value is a string", async () => {
    const supabase = buildClient({
      adminSettings: { "ai.budget.tier_default.pro": "100000" },
      throwOnRead: false,
    });
    expect(await readTierDefault(supabase, "pro")).toBe(TIER_DEFAULTS.pro);
  });

  it("falls back to constant when admin_settings value is null", async () => {
    const supabase = buildClient({
      adminSettings: { "ai.budget.tier_default.pro": null },
      throwOnRead: false,
    });
    expect(await readTierDefault(supabase, "pro")).toBe(TIER_DEFAULTS.pro);
  });

  it("falls back to constant when DB read throws (defensive)", async () => {
    const supabase = buildClient({ adminSettings: {}, throwOnRead: true });
    expect(await readTierDefault(supabase, "school")).toBe(TIER_DEFAULTS.school);
  });

  it("uses the correct admin_settings key prefix 'ai.budget.tier_default.<tier>'", async () => {
    // Setting under a different key must not match
    const supabase = buildClient({
      adminSettings: { "wrong.key.prefix.pro": 999_999 },
      throwOnRead: false,
    });
    expect(await readTierDefault(supabase, "pro")).toBe(TIER_DEFAULTS.pro);
  });
});
