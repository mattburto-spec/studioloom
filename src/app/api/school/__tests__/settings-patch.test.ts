/**
 * Tests for PATCH /api/school/[id]/settings — Phase 4.4b.
 *
 * Goes through proposeSchoolSettingChange + applyChange chain.
 * Status mapping:
 *   200 — applied (low-stakes / bootstrap downgrade)
 *   202 — high-stakes pending
 *   429 — rate limited
 *   403 — archived / merged
 *   404 — cross-school OR school not found
 *   501 — governance kill-switch off
 *   500 — db_error / apply failed
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

interface ChainResult {
  data: unknown;
  error: unknown;
}

function buildChain(result: ChainResult = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "is"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(result).then(resolve);
  return chain as Record<string, ReturnType<typeof vi.fn>> & {
    then: (r: (v: unknown) => void) => Promise<unknown>;
  };
}

let teachersChain: ReturnType<typeof buildChain>;
let userProfilesChain: ReturnType<typeof buildChain>;
let mockClient: { from: ReturnType<typeof vi.fn> };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

const mockProposeChange = vi.fn();
vi.mock("@/lib/access-v2/governance/setting-change", () => ({
  proposeSchoolSettingChange: (...args: unknown[]) =>
    mockProposeChange(...args),
}));

const mockApplyChange = vi.fn();
vi.mock("@/lib/access-v2/governance/applier", () => ({
  applyChange: (...args: unknown[]) => mockApplyChange(...args),
}));

let PATCH_handler: typeof import("../[id]/settings/route").PATCH;

const SCHOOL_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_SCHOOL = "22222222-2222-2222-2222-222222222222";
const TEACHER_ID = "33333333-3333-3333-3333-333333333333";
const CHANGE_ID = "44444444-4444-4444-4444-444444444444";

beforeEach(async () => {
  vi.clearAllMocks();

  teachersChain = buildChain({
    data: { school_id: SCHOOL_ID },
    error: null,
  });
  userProfilesChain = buildChain({
    data: { is_platform_admin: false },
    error: null,
  });
  mockClient = {
    from: vi.fn((table: string) => {
      if (table === "teachers") return teachersChain;
      if (table === "user_profiles") return userProfilesChain;
      return buildChain();
    }),
  };

  mockGetUser.mockResolvedValue({
    data: { user: { id: TEACHER_ID, email: "matt@nis.org.cn" } },
  });
  // Default: low-stakes auto-applied
  mockProposeChange.mockResolvedValue({
    ok: true,
    changeId: CHANGE_ID,
    tier: "low_stakes",
    status: "applied",
    appliedAt: new Date(),
    expiresAt: null,
    effectiveTier: "low_stakes",
  });
  mockApplyChange.mockResolvedValue({
    ok: true,
    changeType: "period_bells",
    rowsAffected: 1,
  });

  const mod = await import("../[id]/settings/route");
  PATCH_handler = mod.PATCH;
});

function patchReq(body: unknown): NextRequest {
  return new Request(`http://x/api/school/${SCHOOL_ID}/settings`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/school/[id]/settings", () => {
  // ─── Auth + validation ───────────────────────────────────────────

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH_handler(
      patchReq({ changeType: "x", newValue: "y" }),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid UUID", async () => {
    const res = await PATCH_handler(
      patchReq({ changeType: "x", newValue: "y" }),
      ctx("not-a-uuid")
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for cross-school request", async () => {
    teachersChain = buildChain({
      data: { school_id: OTHER_SCHOOL },
      error: null,
    });
    mockClient.from = vi.fn((table: string) => {
      if (table === "teachers") return teachersChain;
      if (table === "user_profiles") return userProfilesChain;
      return buildChain();
    });
    const res = await PATCH_handler(
      patchReq({ changeType: "x", newValue: "y" }),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(404);
  });

  it("platform admin bypasses cross-school check", async () => {
    teachersChain = buildChain({
      data: { school_id: OTHER_SCHOOL },
      error: null,
    });
    userProfilesChain = buildChain({
      data: { is_platform_admin: true },
      error: null,
    });
    mockClient.from = vi.fn((table: string) => {
      if (table === "teachers") return teachersChain;
      if (table === "user_profiles") return userProfilesChain;
      return buildChain();
    });
    const res = await PATCH_handler(
      patchReq({ changeType: "period_bells", newValue: { time: "08:15" } }),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request(`http://x/api/school/${SCHOOL_ID}/settings`, {
      method: "PATCH",
      body: "not json",
    }) as unknown as NextRequest;
    const res = await PATCH_handler(req, ctx(SCHOOL_ID));
    expect(res.status).toBe(400);
  });

  it("returns 400 when changeType missing", async () => {
    const res = await PATCH_handler(patchReq({ newValue: "y" }), ctx(SCHOOL_ID));
    expect(res.status).toBe(400);
  });

  // ─── Happy paths ─────────────────────────────────────────────────

  it("low-stakes happy path: 200 with applied=true + rowsAffected", async () => {
    const res = await PATCH_handler(
      patchReq({
        changeType: "period_bells",
        currentValue: { time: "08:00" },
        newValue: { time: "08:15" },
      }),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.applied).toBe(true);
    expect(body.changeId).toBe(CHANGE_ID);
    expect(body.tier).toBe("low_stakes");
    expect(body.rowsAffected).toBe(1);
  });

  it("composes version-stamped PayloadV1 with before/after/scope", async () => {
    await PATCH_handler(
      patchReq({
        changeType: "default_student_ai_budget",
        currentValue: 100000,
        newValue: 120000,
        scope: { reason: "boost during exam week" },
      }),
      ctx(SCHOOL_ID)
    );
    expect(mockProposeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_ID,
        changeType: "default_student_ai_budget",
        actor: expect.objectContaining({
          userId: TEACHER_ID,
          email: "matt@nis.org.cn",
        }),
        payload: expect.objectContaining({
          version: 1,
          before_at_propose: 100000,
          after: 120000,
          scope: { reason: "boost during exam week" },
        }),
      })
    );
  });

  it("calls applyChange after applied proposal (low-stakes path)", async () => {
    await PATCH_handler(
      patchReq({
        changeType: "school_name",
        currentValue: "Old",
        newValue: "New",
      }),
      ctx(SCHOOL_ID)
    );
    expect(mockApplyChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_ID,
        changeType: "school_name",
        newValue: "New",
      })
    );
  });

  // ─── High-stakes pending ─────────────────────────────────────────

  it("high-stakes pending: 202 with applied=false + expiresAt; applyChange NOT called", async () => {
    const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
    mockProposeChange.mockResolvedValue({
      ok: true,
      changeId: CHANGE_ID,
      tier: "high_stakes",
      status: "pending",
      appliedAt: null,
      expiresAt,
      effectiveTier: "high_stakes",
    });
    const res = await PATCH_handler(
      patchReq({
        changeType: "school_name",
        currentValue: "Old",
        newValue: "New",
      }),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.applied).toBe(false);
    expect(body.tier).toBe("high_stakes");
    expect(body.changeId).toBe(CHANGE_ID);
    expect(body.expiresAt).toBeTruthy();
    expect(mockApplyChange).not.toHaveBeenCalled();
  });

  // ─── Failure paths ───────────────────────────────────────────────

  it("rate_limited: 429 + Retry-After header", async () => {
    mockProposeChange.mockResolvedValue({
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: 300,
      message: "Rate limit reached",
    });
    const res = await PATCH_handler(
      patchReq({ changeType: "period_bells", newValue: "x" }),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("300");
  });

  it("archived_school: 403", async () => {
    mockProposeChange.mockResolvedValue({
      ok: false,
      reason: "archived_school",
      message: "School is archived",
    });
    const res = await PATCH_handler(
      patchReq({ changeType: "period_bells", newValue: "x" }),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(403);
  });

  it("governance_disabled: 501", async () => {
    mockProposeChange.mockResolvedValue({
      ok: false,
      reason: "governance_disabled",
      message: "Kill-switch off",
    });
    const res = await PATCH_handler(
      patchReq({ changeType: "period_bells", newValue: "x" }),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(501);
  });

  it("apply_failed: 500 — proposal already in audit ledger; column write failed", async () => {
    mockApplyChange.mockResolvedValue({
      ok: false,
      changeType: "school_name",
      reason: "db_error",
      message: "constraint violation",
    });
    const res = await PATCH_handler(
      patchReq({
        changeType: "school_name",
        currentValue: "Old",
        newValue: "New",
      }),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.reason).toBe("apply_failed");
    expect(body.changeId).toBe(CHANGE_ID); // proposal still recorded
  });

  // ─── Headers ─────────────────────────────────────────────────────

  it("sets Cache-Control: private, no-store on 200", async () => {
    const res = await PATCH_handler(
      patchReq({ changeType: "period_bells", newValue: "x" }),
      ctx(SCHOOL_ID)
    );
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sets Cache-Control: private, no-store on 202", async () => {
    mockProposeChange.mockResolvedValue({
      ok: true,
      changeId: CHANGE_ID,
      tier: "high_stakes",
      status: "pending",
      appliedAt: null,
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      effectiveTier: "high_stakes",
    });
    const res = await PATCH_handler(
      patchReq({ changeType: "school_name", newValue: "x" }),
      ctx(SCHOOL_ID)
    );
    expect(res.status).toBe(202);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
