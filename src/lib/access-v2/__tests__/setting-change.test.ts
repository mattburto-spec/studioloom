/**
 * Tests for governance helpers: propose / confirm / revert.
 *
 * Phase 4.3 per docs/projects/access-model-v2-phase-4-brief.md §4 Phase 4.3.
 *
 * Coverage:
 *   - kill-switch (governance_disabled)
 *   - archived-school guard
 *   - rate limit
 *   - tier resolution + bootstrap grace
 *   - version-stamped payload preservation
 *   - confirm: not-found / wrong status / self-confirm / expired / happy
 *   - revert: not-found / wrong status / outside window / happy
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  proposeSchoolSettingChange,
  confirmHighStakesChange,
  revertChange,
} from "../governance/setting-change";

// ─── Module-level mocks ──────────────────────────────────────────

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

const mockGovernanceFlag = vi.fn();
vi.mock("../governance/rollout-flag", () => ({
  isGovernanceEngineRolloutEnabled: (...args: unknown[]) =>
    mockGovernanceFlag(...args),
}));

const mockArchivedGuard = vi.fn();
vi.mock("../school/archived-guard", () => ({
  enforceArchivedReadOnly: (...args: unknown[]) =>
    mockArchivedGuard(...args),
}));

// ─── Builder helpers ─────────────────────────────────────────────

interface ChainResult {
  data: unknown;
  error: unknown;
}

function buildChain(result: ChainResult = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "delete", "eq", "order"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(result).then(resolve);
  return chain as Record<string, ReturnType<typeof vi.fn>> & {
    then: (r: (v: unknown) => void) => Promise<unknown>;
  };
}

let mockClient: {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

let schoolsChain: ReturnType<typeof buildChain>;
let sscChain: ReturnType<typeof buildChain>;

const SCHOOL_ID = "11111111-1111-1111-1111-111111111111";
const ACTOR_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_ID = "33333333-3333-3333-3333-333333333333";
const CHANGE_ID = "44444444-4444-4444-4444-444444444444";

const ACTOR = {
  userId: ACTOR_ID,
  email: "matt@nis.org.cn",
  isPlatformAdmin: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  schoolsChain = buildChain({
    data: { bootstrap_expires_at: null },
    error: null,
  }); // single-teacher school by default
  sscChain = buildChain({
    data: {
      id: CHANGE_ID,
      tier: "low_stakes",
      status: "applied",
      applied_at: new Date().toISOString(),
      expires_at: null,
    },
    error: null,
  });
  mockClient = {
    from: vi.fn((table: string) => {
      if (table === "schools") return schoolsChain;
      if (table === "school_setting_changes") return sscChain;
      return buildChain();
    }),
    rpc: vi.fn().mockResolvedValue({
      data: [{ bucket_count: 1, window_total: 1, rate_limited: false }],
      error: null,
    }),
  };
  mockGovernanceFlag.mockResolvedValue(true);
  mockArchivedGuard.mockResolvedValue({
    readOnly: false,
    status: "active",
  });
});

// ─── proposeSchoolSettingChange ──────────────────────────────────

describe("proposeSchoolSettingChange", () => {
  function basicArgs() {
    return {
      schoolId: SCHOOL_ID,
      actor: ACTOR,
      changeType: "period_bells",
      payload: {
        version: 1 as const,
        before_at_propose: { time: "08:00" },
        after: { time: "08:15" },
      },
    };
  }

  it("returns governance_disabled when kill-switch flips off", async () => {
    mockGovernanceFlag.mockResolvedValue(false);
    const result = await proposeSchoolSettingChange(basicArgs());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("governance_disabled");
  });

  it("returns archived_school when school status is archived", async () => {
    mockArchivedGuard.mockResolvedValue({
      readOnly: true,
      status: "archived",
      reason: "archived_school",
    });
    const result = await proposeSchoolSettingChange(basicArgs());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("archived_school");
  });

  it("returns rate_limited when RPC reports rate-limit breach", async () => {
    mockClient.rpc.mockResolvedValue({
      data: [{ bucket_count: 0, window_total: 10, rate_limited: true }],
      error: null,
    });
    const result = await proposeSchoolSettingChange(basicArgs());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("rate_limited");
  });

  it("low-stakes change: applied immediately with applied_at set", async () => {
    sscChain = buildChain({
      data: {
        id: CHANGE_ID,
        tier: "low_stakes",
        status: "applied",
        applied_at: new Date().toISOString(),
        expires_at: null,
      },
      error: null,
    });
    mockClient.from = vi.fn((table: string) => {
      if (table === "schools") return schoolsChain;
      if (table === "school_setting_changes") return sscChain;
      return buildChain();
    });
    const result = await proposeSchoolSettingChange({
      ...basicArgs(),
      changeType: "period_bells", // ALWAYS_LOW_STAKES
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tier).toBe("low_stakes");
      expect(result.status).toBe("applied");
      expect(result.appliedAt).not.toBeNull();
      expect(result.expiresAt).toBeNull();
    }
  });

  it("high-stakes change in single-teacher bootstrap → effectiveTier = low_stakes (auto-confirm)", async () => {
    // schoolsChain default returns bootstrap_expires_at: null → bootstrap active
    sscChain = buildChain({
      data: {
        id: CHANGE_ID,
        tier: "high_stakes",
        status: "applied",
        applied_at: new Date().toISOString(),
        expires_at: null,
      },
      error: null,
    });
    mockClient.from = vi.fn((table: string) => {
      if (table === "schools") return schoolsChain;
      if (table === "school_setting_changes") return sscChain;
      return buildChain();
    });
    const result = await proposeSchoolSettingChange({
      ...basicArgs(),
      changeType: "school_name", // ALWAYS_HIGH_STAKES
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // tier persists as resolved (high), but effectiveTier = low (bootstrap)
      expect(result.tier).toBe("high_stakes");
      expect(result.effectiveTier).toBe("low_stakes");
      expect(result.appliedAt).not.toBeNull();
    }
  });

  it("high-stakes change post-bootstrap → status=pending with expires_at", async () => {
    schoolsChain = buildChain({
      data: { bootstrap_expires_at: new Date(Date.now() - 1000).toISOString() }, // closed 1s ago
      error: null,
    });
    sscChain = buildChain({
      data: {
        id: CHANGE_ID,
        tier: "high_stakes",
        status: "pending",
        applied_at: null,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      },
      error: null,
    });
    mockClient.from = vi.fn((table: string) => {
      if (table === "schools") return schoolsChain;
      if (table === "school_setting_changes") return sscChain;
      return buildChain();
    });
    const result = await proposeSchoolSettingChange({
      ...basicArgs(),
      changeType: "school_name",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tier).toBe("high_stakes");
      expect(result.effectiveTier).toBe("high_stakes");
      expect(result.status).toBe("pending");
      expect(result.appliedAt).toBeNull();
      expect(result.expiresAt).not.toBeNull();
    }
  });

  it("inserts version-stamped payload with effective_tier scope marker", async () => {
    sscChain = buildChain({
      data: {
        id: CHANGE_ID,
        tier: "low_stakes",
        status: "applied",
        applied_at: new Date().toISOString(),
        expires_at: null,
      },
      error: null,
    });
    mockClient.from = vi.fn((table: string) => {
      if (table === "schools") return schoolsChain;
      if (table === "school_setting_changes") return sscChain;
      return buildChain();
    });
    await proposeSchoolSettingChange(basicArgs());
    expect(sscChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        payload_jsonb: expect.objectContaining({
          version: 1,
          before_at_propose: { time: "08:00" },
          after: { time: "08:15" },
          scope: expect.objectContaining({
            effective_tier: expect.any(String),
            bootstrap_grace_applied: expect.any(Boolean),
          }),
        }),
      })
    );
  });

  it("respects forcedTier override", async () => {
    schoolsChain = buildChain({
      data: { bootstrap_expires_at: new Date(Date.now() - 1000).toISOString() },
      error: null,
    });
    sscChain = buildChain({
      data: {
        id: CHANGE_ID,
        tier: "high_stakes",
        status: "pending",
        applied_at: null,
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      },
      error: null,
    });
    mockClient.from = vi.fn((table: string) => {
      if (table === "schools") return schoolsChain;
      if (table === "school_setting_changes") return sscChain;
      return buildChain();
    });
    const result = await proposeSchoolSettingChange({
      ...basicArgs(),
      changeType: "period_bells", // would resolve to low
      forcedTier: "high_stakes", // but caller forces high
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tier).toBe("high_stakes");
      expect(result.status).toBe("pending");
    }
  });
});

// ─── confirmHighStakesChange ─────────────────────────────────────

describe("confirmHighStakesChange", () => {
  function basicArgs() {
    return {
      changeId: CHANGE_ID,
      confirmerUserId: OTHER_ID,
    };
  }

  it("returns not_found when change doesn't exist", async () => {
    sscChain = buildChain({ data: null, error: null });
    mockClient.from = vi.fn(() => sscChain);
    const result = await confirmHighStakesChange(basicArgs());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });

  it("returns not_pending when change is already applied", async () => {
    sscChain = buildChain({
      data: {
        id: CHANGE_ID,
        school_id: SCHOOL_ID,
        actor_user_id: ACTOR_ID,
        status: "applied",
        expires_at: null,
        tier: "high_stakes",
      },
      error: null,
    });
    mockClient.from = vi.fn(() => sscChain);
    const result = await confirmHighStakesChange(basicArgs());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_pending");
  });

  it("returns self_confirm_forbidden when proposer tries to confirm own", async () => {
    sscChain = buildChain({
      data: {
        id: CHANGE_ID,
        school_id: SCHOOL_ID,
        actor_user_id: ACTOR_ID,
        status: "pending",
        expires_at: new Date(Date.now() + 1000).toISOString(),
        tier: "high_stakes",
      },
      error: null,
    });
    mockClient.from = vi.fn(() => sscChain);
    const result = await confirmHighStakesChange({
      changeId: CHANGE_ID,
      confirmerUserId: ACTOR_ID, // same as proposer
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("self_confirm_forbidden");
  });

  it("returns expired when expires_at has passed", async () => {
    sscChain = buildChain({
      data: {
        id: CHANGE_ID,
        school_id: SCHOOL_ID,
        actor_user_id: ACTOR_ID,
        status: "pending",
        expires_at: new Date(Date.now() - 1000).toISOString(), // 1s ago
        tier: "high_stakes",
      },
      error: null,
    });
    mockClient.from = vi.fn(() => sscChain);
    const result = await confirmHighStakesChange(basicArgs());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("happy path: confirms pending change, sets applied_at + confirmed_by_user_id", async () => {
    sscChain = buildChain({
      data: {
        id: CHANGE_ID,
        school_id: SCHOOL_ID,
        actor_user_id: ACTOR_ID,
        status: "pending",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        tier: "high_stakes",
      },
      error: null,
    });
    mockClient.from = vi.fn(() => sscChain);
    const result = await confirmHighStakesChange(basicArgs());
    expect(result.ok).toBe(true);
    expect(sscChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "applied",
        confirmed_by_user_id: OTHER_ID,
      })
    );
  });
});

// ─── revertChange ────────────────────────────────────────────────

describe("revertChange", () => {
  function basicArgs() {
    return {
      changeId: CHANGE_ID,
      reverterUserId: OTHER_ID,
    };
  }

  it("returns not_found when change doesn't exist", async () => {
    sscChain = buildChain({ data: null, error: null });
    mockClient.from = vi.fn(() => sscChain);
    const result = await revertChange(basicArgs());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });

  it("returns not_applied when change is pending or reverted", async () => {
    sscChain = buildChain({
      data: { id: CHANGE_ID, status: "pending", applied_at: null },
      error: null,
    });
    mockClient.from = vi.fn(() => sscChain);
    const result = await revertChange(basicArgs());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_applied");
  });

  it("returns outside_revert_window when applied_at older than 7 days", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    sscChain = buildChain({
      data: {
        id: CHANGE_ID,
        status: "applied",
        applied_at: eightDaysAgo.toISOString(),
      },
      error: null,
    });
    mockClient.from = vi.fn(() => sscChain);
    const result = await revertChange(basicArgs());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("outside_revert_window");
  });

  it("happy path: reverts within 7-day window, sets reverted_at + reverted_by_user_id", async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    sscChain = buildChain({
      data: {
        id: CHANGE_ID,
        status: "applied",
        applied_at: oneDayAgo.toISOString(),
      },
      error: null,
    });
    mockClient.from = vi.fn(() => sscChain);
    const result = await revertChange(basicArgs());
    expect(result.ok).toBe(true);
    expect(sscChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "reverted",
        reverted_by_user_id: OTHER_ID,
      })
    );
  });
});
