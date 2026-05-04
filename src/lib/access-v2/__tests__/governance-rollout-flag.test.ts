/**
 * Tests for isGovernanceEngineRolloutEnabled.
 *
 * Phase 4.0 scaffold per docs/projects/access-model-v2-phase-4-brief.md
 * §3.8 Q4. Mirrors the Phase 3 isPermissionHelperRolloutEnabled pattern.
 */

import { describe, it, expect, vi } from "vitest";
import { isGovernanceEngineRolloutEnabled } from "../governance/rollout-flag";

function mockDb(value: unknown | null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () =>
            value === null
              ? { data: null, error: null }
              : { data: { value }, error: null }
          ),
        })),
      })),
    })),
  } as unknown as Parameters<typeof isGovernanceEngineRolloutEnabled>[0];
}

describe("isGovernanceEngineRolloutEnabled", () => {
  it("returns true when flag is set to true", async () => {
    expect(await isGovernanceEngineRolloutEnabled(mockDb(true))).toBe(true);
  });

  it("returns false when flag is set to false (kill-switch active)", async () => {
    expect(await isGovernanceEngineRolloutEnabled(mockDb(false))).toBe(false);
  });

  it("defaults to true when admin_settings row is absent", async () => {
    expect(await isGovernanceEngineRolloutEnabled(mockDb(null))).toBe(true);
  });

  it("treats non-boolean values as false (defensive)", async () => {
    expect(await isGovernanceEngineRolloutEnabled(mockDb("true"))).toBe(false);
    expect(await isGovernanceEngineRolloutEnabled(mockDb(1))).toBe(false);
  });
});
