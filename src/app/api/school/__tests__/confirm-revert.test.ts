/**
 * Tests for POST .../proposals/[changeId]/confirm and
 *           POST .../changes/[changeId]/revert.
 *
 * Phase 4.4c. Both routes share auth pattern; both go through the
 * governance helper + applier.
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
  for (const m of ["select", "eq", "is"]) {
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
let sscChain: ReturnType<typeof buildChain>;
let mockClient: { from: ReturnType<typeof vi.fn> };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockClient,
}));

const mockConfirm = vi.fn();
const mockRevert = vi.fn();
vi.mock("@/lib/access-v2/governance/setting-change", () => ({
  confirmHighStakesChange: (...args: unknown[]) => mockConfirm(...args),
  revertChange: (...args: unknown[]) => mockRevert(...args),
}));

const mockApplyChange = vi.fn();
vi.mock("@/lib/access-v2/governance/applier", () => ({
  applyChange: (...args: unknown[]) => mockApplyChange(...args),
}));

let CONFIRM_handler: typeof import("../[id]/proposals/[changeId]/confirm/route").POST;
let REVERT_handler: typeof import("../[id]/changes/[changeId]/revert/route").POST;

const SCHOOL_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_SCHOOL = "22222222-2222-2222-2222-222222222222";
const TEACHER_ID = "33333333-3333-3333-3333-333333333333";
const PROPOSER_ID = "44444444-4444-4444-4444-444444444444";
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
  // Default ssc row — pending high-stakes change with valid payload
  sscChain = buildChain({
    data: {
      id: CHANGE_ID,
      school_id: SCHOOL_ID,
      change_type: "school_name",
      status: "pending",
      payload_jsonb: {
        version: 1,
        before_at_propose: "Old Name",
        after: "New Name",
      },
    },
    error: null,
  });
  mockClient = {
    from: vi.fn((table: string) => {
      if (table === "teachers") return teachersChain;
      if (table === "user_profiles") return userProfilesChain;
      if (table === "school_setting_changes") return sscChain;
      return buildChain();
    }),
  };

  mockGetUser.mockResolvedValue({
    data: { user: { id: TEACHER_ID } },
  });
  // Default: confirm + revert succeed; apply succeeds with 1 row affected
  mockConfirm.mockResolvedValue({
    ok: true,
    changeId: CHANGE_ID,
    appliedAt: new Date(),
  });
  mockRevert.mockResolvedValue({
    ok: true,
    changeId: CHANGE_ID,
    revertedAt: new Date(),
  });
  mockApplyChange.mockResolvedValue({
    ok: true,
    changeType: "school_name",
    rowsAffected: 1,
  });

  const confirmMod = await import(
    "../[id]/proposals/[changeId]/confirm/route"
  );
  CONFIRM_handler = confirmMod.POST;
  const revertMod = await import("../[id]/changes/[changeId]/revert/route");
  REVERT_handler = revertMod.POST;
});

function reqFor(path: string): NextRequest {
  return new Request(`http://x${path}`, {
    method: "POST",
  }) as unknown as NextRequest;
}

function ctx(id: string, changeId: string) {
  return { params: Promise.resolve({ id, changeId }) };
}

// ─── Confirm route ──────────────────────────────────────────────────

describe("POST /api/school/[id]/proposals/[changeId]/confirm", () => {
  function go() {
    return CONFIRM_handler(
      reqFor(`/api/school/${SCHOOL_ID}/proposals/${CHANGE_ID}/confirm`),
      ctx(SCHOOL_ID, CHANGE_ID)
    );
  }

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await go();
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid school UUID", async () => {
    const res = await CONFIRM_handler(
      reqFor("/x"),
      ctx("not-a-uuid", CHANGE_ID)
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid change UUID", async () => {
    const res = await CONFIRM_handler(reqFor("/x"), ctx(SCHOOL_ID, "no"));
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
      if (table === "school_setting_changes") return sscChain;
      return buildChain();
    });
    const res = await go();
    expect(res.status).toBe(404);
  });

  it("returns 404 when change row missing", async () => {
    sscChain = buildChain({ data: null, error: null });
    mockClient.from = vi.fn((table: string) => {
      if (table === "teachers") return teachersChain;
      if (table === "user_profiles") return userProfilesChain;
      if (table === "school_setting_changes") return sscChain;
      return buildChain();
    });
    const res = await go();
    expect(res.status).toBe(404);
  });

  it("happy path: 200 with appliedAt + rowsAffected", async () => {
    const res = await go();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.changeId).toBe(CHANGE_ID);
    expect(body.rowsAffected).toBe(1);
    expect(mockConfirm).toHaveBeenCalledWith({
      changeId: CHANGE_ID,
      confirmerUserId: TEACHER_ID,
    });
    expect(mockApplyChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_ID,
        changeType: "school_name",
        newValue: "New Name", // from payload.after
      })
    );
  });

  it("self_confirm_forbidden → 409", async () => {
    mockConfirm.mockResolvedValue({
      ok: false,
      reason: "self_confirm_forbidden",
      message: "Cannot confirm own proposal",
    });
    const res = await go();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.reason).toBe("self_confirm_forbidden");
    expect(mockApplyChange).not.toHaveBeenCalled();
  });

  it("not_pending → 409", async () => {
    mockConfirm.mockResolvedValue({
      ok: false,
      reason: "not_pending",
      message: "Already applied",
    });
    const res = await go();
    expect(res.status).toBe(409);
  });

  it("expired → 409", async () => {
    mockConfirm.mockResolvedValue({
      ok: false,
      reason: "expired",
      message: "48h window passed",
    });
    const res = await go();
    expect(res.status).toBe(409);
  });

  it("apply_failed → 500 with changeId so caller can retry via PATCH", async () => {
    mockApplyChange.mockResolvedValue({
      ok: false,
      changeType: "school_name",
      reason: "db_error",
      message: "constraint violation",
    });
    const res = await go();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.reason).toBe("apply_failed");
    expect(body.changeId).toBe(CHANGE_ID);
  });
});

// ─── Revert route ───────────────────────────────────────────────────

describe("POST /api/school/[id]/changes/[changeId]/revert", () => {
  function go() {
    return REVERT_handler(
      reqFor(`/api/school/${SCHOOL_ID}/changes/${CHANGE_ID}/revert`),
      ctx(SCHOOL_ID, CHANGE_ID)
    );
  }

  beforeEach(() => {
    // Revert defaults: applied row, payload has before_at_propose
    sscChain = buildChain({
      data: {
        id: CHANGE_ID,
        school_id: SCHOOL_ID,
        change_type: "school_name",
        status: "applied",
        payload_jsonb: {
          version: 1,
          before_at_propose: "Old Name",
          after: "New Name",
        },
      },
      error: null,
    });
    mockClient.from = vi.fn((table: string) => {
      if (table === "teachers") return teachersChain;
      if (table === "user_profiles") return userProfilesChain;
      if (table === "school_setting_changes") return sscChain;
      return buildChain();
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await go();
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid UUIDs", async () => {
    const res = await REVERT_handler(
      reqFor("/x"),
      ctx("not-a-uuid", CHANGE_ID)
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for cross-school", async () => {
    teachersChain = buildChain({
      data: { school_id: OTHER_SCHOOL },
      error: null,
    });
    mockClient.from = vi.fn((table: string) => {
      if (table === "teachers") return teachersChain;
      if (table === "user_profiles") return userProfilesChain;
      if (table === "school_setting_changes") return sscChain;
      return buildChain();
    });
    const res = await go();
    expect(res.status).toBe(404);
  });

  it("returns 404 when change row missing", async () => {
    sscChain = buildChain({ data: null, error: null });
    mockClient.from = vi.fn((table: string) => {
      if (table === "teachers") return teachersChain;
      if (table === "user_profiles") return userProfilesChain;
      if (table === "school_setting_changes") return sscChain;
      return buildChain();
    });
    const res = await go();
    expect(res.status).toBe(404);
  });

  it("happy path: 200; applyChange called with before_at_propose as newValue", async () => {
    const res = await go();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.rowsAffected).toBe(1);
    expect(mockRevert).toHaveBeenCalledWith({
      changeId: CHANGE_ID,
      reverterUserId: TEACHER_ID,
    });
    expect(mockApplyChange).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolId: SCHOOL_ID,
        changeType: "school_name",
        newValue: "Old Name", // from before_at_propose
      })
    );
  });

  it("not_applied → 409", async () => {
    mockRevert.mockResolvedValue({
      ok: false,
      reason: "not_applied",
      message: "Pending or already reverted",
    });
    const res = await go();
    expect(res.status).toBe(409);
    expect(mockApplyChange).not.toHaveBeenCalled();
  });

  it("outside_revert_window → 409", async () => {
    mockRevert.mockResolvedValue({
      ok: false,
      reason: "outside_revert_window",
      message: "Older than 7 days",
    });
    const res = await go();
    expect(res.status).toBe(409);
  });

  it("returns 500 with reason='missing_before_value' when payload lacks before_at_propose", async () => {
    sscChain = buildChain({
      data: {
        id: CHANGE_ID,
        school_id: SCHOOL_ID,
        change_type: "school_name",
        status: "applied",
        payload_jsonb: {
          version: 1,
          // before_at_propose missing
          after: "New Name",
        },
      },
      error: null,
    });
    mockClient.from = vi.fn((table: string) => {
      if (table === "teachers") return teachersChain;
      if (table === "user_profiles") return userProfilesChain;
      if (table === "school_setting_changes") return sscChain;
      return buildChain();
    });
    const res = await go();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.reason).toBe("missing_before_value");
  });

  it("apply_failed after revert → 500 with changeId so caller knows revert recorded but column write failed", async () => {
    mockApplyChange.mockResolvedValue({
      ok: false,
      changeType: "school_name",
      reason: "db_error",
      message: "constraint violation",
    });
    const res = await go();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.reason).toBe("apply_failed");
    expect(body.changeId).toBe(CHANGE_ID);
  });
});
