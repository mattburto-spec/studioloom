/**
 * Tests for DELETE /api/school/[id]/domains/[domainId] — Phase 4.3.
 *
 * Goes through the governance engine (proposeSchoolSettingChange) with
 * change_type='remove_school_domain' which is ALWAYS_HIGH_STAKES per
 * tier-resolvers.ts. Single-teacher bootstrap mode downgrades to low
 * (auto-confirm + immediate row delete); post-bootstrap returns 202
 * with pending proposal awaiting 2nd-teacher confirm.
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

let teachersChain: ReturnType<typeof buildChain>;
let userProfilesChain: ReturnType<typeof buildChain>;
let schoolDomainsChain: ReturnType<typeof buildChain>;
let mockClient: { from: ReturnType<typeof vi.fn>; rpc: ReturnType<typeof vi.fn> };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

const mockProposeChange = vi.fn();
vi.mock("@/lib/access-v2/governance/setting-change", () => ({
  proposeSchoolSettingChange: (...args: unknown[]) =>
    mockProposeChange(...args),
}));

let DELETE_handler: typeof import("../[id]/domains/[domainId]/route").DELETE;

const SCHOOL_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_SCHOOL = "22222222-2222-2222-2222-222222222222";
const TEACHER_ID = "33333333-3333-3333-3333-333333333333";
const DOMAIN_ID = "44444444-4444-4444-4444-444444444444";
const CHANGE_ID = "55555555-5555-5555-5555-555555555555";

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
  schoolDomainsChain = buildChain({
    data: {
      id: DOMAIN_ID,
      school_id: SCHOOL_ID,
      domain: "nis.org.cn",
      verified: true,
      added_by: TEACHER_ID,
      created_at: "2026-05-02T00:00:00Z",
    },
    error: null,
  });
  mockClient = {
    from: vi.fn((table: string) => {
      if (table === "teachers") return teachersChain;
      if (table === "user_profiles") return userProfilesChain;
      if (table === "school_domains") return schoolDomainsChain;
      return buildChain();
    }),
    rpc: vi.fn(),
  };
  mockGetUser.mockResolvedValue({
    data: { user: { id: TEACHER_ID, email: "matt@nis.org.cn" } },
  });
  // Default: low-stakes auto-applied
  mockProposeChange.mockResolvedValue({
    ok: true,
    changeId: CHANGE_ID,
    tier: "high_stakes",
    status: "applied",
    appliedAt: new Date(),
    expiresAt: null,
    effectiveTier: "low_stakes",
  });

  const mod = await import("../[id]/domains/[domainId]/route");
  DELETE_handler = mod.DELETE;
});

function mkReq(): NextRequest {
  return new Request(`http://x/api/school/${SCHOOL_ID}/domains/${DOMAIN_ID}`, {
    method: "DELETE",
  }) as unknown as NextRequest;
}

function ctx(id: string, domainId: string) {
  return { params: Promise.resolve({ id, domainId }) };
}

describe("DELETE /api/school/[id]/domains/[domainId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE_handler(mkReq(), ctx(SCHOOL_ID, DOMAIN_ID));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid UUID school id", async () => {
    const res = await DELETE_handler(
      mkReq(),
      ctx("not-a-uuid", DOMAIN_ID)
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid UUID domain id", async () => {
    const res = await DELETE_handler(mkReq(), ctx(SCHOOL_ID, "not-a-uuid"));
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
      if (table === "school_domains") return schoolDomainsChain;
      return buildChain();
    });
    const res = await DELETE_handler(mkReq(), ctx(SCHOOL_ID, DOMAIN_ID));
    expect(res.status).toBe(404);
  });

  it("returns 404 when domain doesn't exist in this school", async () => {
    schoolDomainsChain = buildChain({ data: null, error: null });
    mockClient.from = vi.fn((table: string) => {
      if (table === "teachers") return teachersChain;
      if (table === "user_profiles") return userProfilesChain;
      if (table === "school_domains") return schoolDomainsChain;
      return buildChain();
    });
    const res = await DELETE_handler(mkReq(), ctx(SCHOOL_ID, DOMAIN_ID));
    expect(res.status).toBe(404);
  });

  it("low-stakes (single-teacher bootstrap): 200 with deleted=true, applied=true", async () => {
    mockProposeChange.mockResolvedValue({
      ok: true,
      changeId: CHANGE_ID,
      tier: "high_stakes",
      status: "applied",
      appliedAt: new Date(),
      expiresAt: null,
      effectiveTier: "low_stakes",
    });
    const res = await DELETE_handler(mkReq(), ctx(SCHOOL_ID, DOMAIN_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(body.applied).toBe(true);
    expect(body.changeId).toBe(CHANGE_ID);
    expect(schoolDomainsChain.delete).toHaveBeenCalled();
  });

  it("high-stakes pending: 202 with deleted=false, applied=false, expiresAt set", async () => {
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    mockProposeChange.mockResolvedValue({
      ok: true,
      changeId: CHANGE_ID,
      tier: "high_stakes",
      status: "pending",
      appliedAt: null,
      expiresAt,
      effectiveTier: "high_stakes",
    });
    const res = await DELETE_handler(mkReq(), ctx(SCHOOL_ID, DOMAIN_ID));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.deleted).toBe(false);
    expect(body.applied).toBe(false);
    expect(body.expiresAt).toBeTruthy();
    expect(schoolDomainsChain.delete).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when rate-limited", async () => {
    mockProposeChange.mockResolvedValue({
      ok: false,
      reason: "rate_limited",
      retryAfterSeconds: 300,
      message: "Rate limit reached.",
    });
    const res = await DELETE_handler(mkReq(), ctx(SCHOOL_ID, DOMAIN_ID));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("300");
  });

  it("returns 403 when school is archived", async () => {
    mockProposeChange.mockResolvedValue({
      ok: false,
      reason: "archived_school",
      message: "School is archived.",
    });
    const res = await DELETE_handler(mkReq(), ctx(SCHOOL_ID, DOMAIN_ID));
    expect(res.status).toBe(403);
  });

  it("returns 501 when governance kill-switch is off", async () => {
    mockProposeChange.mockResolvedValue({
      ok: false,
      reason: "governance_disabled",
      message: "Governance disabled.",
    });
    const res = await DELETE_handler(mkReq(), ctx(SCHOOL_ID, DOMAIN_ID));
    expect(res.status).toBe(501);
  });

  it("calls proposeSchoolSettingChange with change_type='remove_school_domain' and version-stamped payload", async () => {
    await DELETE_handler(mkReq(), ctx(SCHOOL_ID, DOMAIN_ID));
    expect(mockProposeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_ID,
        actor: expect.objectContaining({
          userId: TEACHER_ID,
          email: "matt@nis.org.cn",
        }),
        changeType: "remove_school_domain",
        payload: expect.objectContaining({
          version: 1,
          before_at_propose: expect.objectContaining({
            id: DOMAIN_ID,
            domain: "nis.org.cn",
          }),
          after: null,
          scope: expect.objectContaining({
            domain_id: DOMAIN_ID,
            domain: "nis.org.cn",
          }),
        }),
      })
    );
  });

  it("returns 500 if propose succeeded but actual delete fails", async () => {
    mockProposeChange.mockResolvedValue({
      ok: true,
      changeId: CHANGE_ID,
      tier: "high_stakes",
      status: "applied",
      appliedAt: new Date(),
      expiresAt: null,
      effectiveTier: "low_stakes",
    });
    schoolDomainsChain = buildChain({
      data: {
        id: DOMAIN_ID,
        school_id: SCHOOL_ID,
        domain: "nis.org.cn",
        verified: true,
        added_by: TEACHER_ID,
        created_at: "2026-05-02T00:00:00Z",
      },
      error: null,
    });
    // Override delete to fail
    schoolDomainsChain.delete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "delete failed" },
        }),
      }),
    });
    mockClient.from = vi.fn((table: string) => {
      if (table === "teachers") return teachersChain;
      if (table === "user_profiles") return userProfilesChain;
      if (table === "school_domains") return schoolDomainsChain;
      return buildChain();
    });
    const res = await DELETE_handler(mkReq(), ctx(SCHOOL_ID, DOMAIN_ID));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.changeId).toBe(CHANGE_ID); // proposal still recorded
  });
});
