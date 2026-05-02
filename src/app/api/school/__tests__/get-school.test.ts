/**
 * Tests for GET /api/school/[id] — Phase 4.4a.
 *
 * Returns school + teacher count + pending proposals + 30-day recent
 * changes feed. Cross-school 404 (don't leak existence) unless
 * is_platform_admin. Archived schools return read_only:true (preserve
 * historical access per §3.9 item 16).
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
  count?: number | null;
}

function buildChain(result: ChainResult = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "in", "gte", "order", "limit"];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.single = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(result).then(resolve);
  return chain as Record<string, ReturnType<typeof vi.fn>> & {
    then: (r: (v: unknown) => void) => Promise<unknown>;
  };
}

let teachersChain: ReturnType<typeof buildChain>;
let userProfilesChain: ReturnType<typeof buildChain>;
let schoolsChain: ReturnType<typeof buildChain>;
let teacherCountChain: ReturnType<typeof buildChain>;
let sscPendingChain: ReturnType<typeof buildChain>;
let sscRecentChain: ReturnType<typeof buildChain>;
let mockClient: { from: ReturnType<typeof vi.fn> };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

const mockArchivedGuard = vi.fn();
vi.mock("@/lib/access-v2/school/archived-guard", () => ({
  enforceArchivedReadOnly: (...args: unknown[]) =>
    mockArchivedGuard(...args),
}));

let GET_handler: typeof import("../[id]/route").GET;

const SCHOOL_ID = "636ff4fc-4413-4a8e-a3cd-c6f1e17bd5a1";
const OTHER_SCHOOL = "11111111-1111-1111-1111-111111111111";
const TEACHER_ID = "22222222-2222-2222-2222-222222222222";

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
  schoolsChain = buildChain({
    data: {
      id: SCHOOL_ID,
      name: "Nanjing International School",
      city: "Nanjing",
      country: "CN",
      region: "default",
      timezone: "Asia/Shanghai",
      default_locale: "en",
      status: "active",
      subscription_tier: "pilot",
      allowed_auth_modes: ["email_password", "google", "microsoft"],
      bootstrap_expires_at: null,
      parent_school_id: null,
    },
    error: null,
  });
  teacherCountChain = buildChain({ data: null, error: null, count: 1 });
  sscPendingChain = buildChain({ data: [], error: null });
  sscRecentChain = buildChain({ data: [], error: null });

  // Counter to dispatch sequential calls to school_setting_changes
  let sscCallCount = 0;

  mockClient = {
    from: vi.fn((table: string) => {
      if (table === "teachers") {
        // First teachers call = auth lookup; subsequent = teacher count
        // We use a counter approach since both call .eq + chain differently
        if (teachersChain.eq.mock.calls.length === 0) return teachersChain;
        return teacherCountChain;
      }
      if (table === "user_profiles") return userProfilesChain;
      if (table === "schools") return schoolsChain;
      if (table === "school_setting_changes") {
        sscCallCount++;
        return sscCallCount === 1 ? sscPendingChain : sscRecentChain;
      }
      return buildChain();
    }),
  };

  mockGetUser.mockResolvedValue({
    data: { user: { id: TEACHER_ID, email: "matt@nis.org.cn" } },
  });
  mockArchivedGuard.mockResolvedValue({
    readOnly: false,
    status: "active",
  });

  const mod = await import("../[id]/route");
  GET_handler = mod.GET;
});

function mkReq(): NextRequest {
  return new Request(`http://x/api/school/${SCHOOL_ID}`) as unknown as NextRequest;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/school/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET_handler(mkReq(), ctx(SCHOOL_ID));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid UUID", async () => {
    const res = await GET_handler(mkReq(), ctx("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for cross-school request (don't leak existence)", async () => {
    teachersChain = buildChain({
      data: { school_id: OTHER_SCHOOL },
      error: null,
    });
    mockClient.from = vi.fn((table: string) => {
      if (table === "teachers") return teachersChain;
      if (table === "user_profiles") return userProfilesChain;
      return buildChain();
    });
    const res = await GET_handler(mkReq(), ctx(SCHOOL_ID));
    expect(res.status).toBe(404);
  });

  it("platform admin can view any school (cross-school bypass)", async () => {
    teachersChain = buildChain({
      data: { school_id: OTHER_SCHOOL },
      error: null,
    });
    userProfilesChain = buildChain({
      data: { is_platform_admin: true },
      error: null,
    });
    let sscCount = 0;
    mockClient.from = vi.fn((table: string) => {
      if (table === "teachers") {
        if (teachersChain.eq.mock.calls.length === 0) return teachersChain;
        return teacherCountChain;
      }
      if (table === "user_profiles") return userProfilesChain;
      if (table === "schools") return schoolsChain;
      if (table === "school_setting_changes") {
        sscCount++;
        return sscCount === 1 ? sscPendingChain : sscRecentChain;
      }
      return buildChain();
    });
    const res = await GET_handler(mkReq(), ctx(SCHOOL_ID));
    expect(res.status).toBe(200);
  });

  it("returns 404 when school is missing (school_not_found from guard)", async () => {
    mockArchivedGuard.mockResolvedValue({
      readOnly: true,
      status: null,
      reason: "school_not_found",
    });
    const res = await GET_handler(mkReq(), ctx(SCHOOL_ID));
    expect(res.status).toBe(404);
  });

  it("returns 200 with school + counts for same-school teacher", async () => {
    const res = await GET_handler(mkReq(), ctx(SCHOOL_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.school).toMatchObject({
      id: SCHOOL_ID,
      name: "Nanjing International School",
    });
    expect(body.teacherCount).toBe(1);
    expect(body.pendingProposals).toEqual([]);
    expect(body.recentChanges).toEqual([]);
    expect(body.readOnly).toBe(false);
  });

  it("includes readOnly=true with reason when school is archived", async () => {
    mockArchivedGuard.mockResolvedValue({
      readOnly: true,
      status: "archived",
      reason: "archived_school",
    });
    const res = await GET_handler(mkReq(), ctx(SCHOOL_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.readOnly).toBe(true);
    expect(body.readOnlyReason).toBe("archived_school");
  });

  it("includes pending proposals + recent changes in response shape", async () => {
    sscPendingChain = buildChain({
      data: [
        {
          id: "p1",
          change_type: "school_name",
          tier: "high_stakes",
          status: "pending",
          expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          actor_user_id: TEACHER_ID,
        },
      ],
      error: null,
    });
    sscRecentChain = buildChain({
      data: [
        {
          id: "r1",
          change_type: "period_bells",
          tier: "low_stakes",
          status: "applied",
          applied_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        },
      ],
      error: null,
    });
    let sscCount = 0;
    mockClient.from = vi.fn((table: string) => {
      if (table === "teachers") {
        if (teachersChain.eq.mock.calls.length === 0) return teachersChain;
        return teacherCountChain;
      }
      if (table === "user_profiles") return userProfilesChain;
      if (table === "schools") return schoolsChain;
      if (table === "school_setting_changes") {
        sscCount++;
        return sscCount === 1 ? sscPendingChain : sscRecentChain;
      }
      return buildChain();
    });

    const res = await GET_handler(mkReq(), ctx(SCHOOL_ID));
    const body = await res.json();
    expect(body.pendingProposals).toHaveLength(1);
    expect(body.pendingProposals[0].change_type).toBe("school_name");
    expect(body.recentChanges).toHaveLength(1);
    expect(body.recentChanges[0].change_type).toBe("period_bells");
  });

  it("sets Cache-Control: private, no-store", async () => {
    const res = await GET_handler(mkReq(), ctx(SCHOOL_ID));
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
