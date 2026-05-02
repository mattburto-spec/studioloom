/**
 * Tests for unit-use-request helpers — Phase 4.6.
 *
 * Covers:
 *   - requestUse: happy + unit_not_found / unit_not_published /
 *     self_request / cross_school / requester_no_school /
 *     duplicate_pending
 *   - approveRequest: not_authorized / wrong_status; happy is more
 *     involved (creates fork + audit row) — tested at integration level
 *   - denyRequest: not_authorized / wrong_status / happy
 *   - withdrawRequest: not_authorized / wrong_status / happy
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requestUse,
  approveRequest,
  denyRequest,
  withdrawRequest,
} from "../school/unit-use-requests";

interface ChainResult {
  data: unknown;
  error: unknown;
  count?: number | null;
}
type MockChain = Record<string, ReturnType<typeof vi.fn>> & {
  then: (r: (v: unknown) => void) => Promise<unknown>;
};

function buildChain(result: ChainResult = { data: null, error: null }): MockChain {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "or",
    "in",
    "is",
    "order",
    "limit",
    "single",
    "maybeSingle",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(result).then(resolve);
  return chain as MockChain;
}

const SCHOOL_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_SCHOOL_ID = "22222222-2222-2222-2222-222222222222";
const REQUESTER_ID = "33333333-3333-3333-3333-333333333333";
const AUTHOR_ID = "44444444-4444-4444-4444-444444444444";
const UNIT_ID = "55555555-5555-5555-5555-555555555555";
const REQUEST_ID = "66666666-6666-6666-6666-666666666666";

function buildClient(handlers: Record<string, ChainResult[]>) {
  const queues = new Map<string, MockChain[]>();
  for (const [table, results] of Object.entries(handlers)) {
    queues.set(
      table,
      results.map((r) => buildChain(r))
    );
  }
  return {
    from: vi.fn((table: string) => {
      const q = queues.get(table);
      if (!q || q.length === 0) {
        return buildChain({ data: null, error: null, count: 0 });
      }
      return q.shift()!;
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════
// requestUse
// ═══════════════════════════════════════════════════════════════════

describe("requestUse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns unit_not_found when unit missing", async () => {
    const client = buildClient({ units: [{ data: null, error: null }] });
    const result = await requestUse({
      unitId: UNIT_ID,
      requesterUserId: REQUESTER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unit_not_found");
  });

  it("returns unit_not_published when is_published=false", async () => {
    const client = buildClient({
      units: [
        {
          data: {
            id: UNIT_ID,
            author_teacher_id: AUTHOR_ID,
            school_id: SCHOOL_ID,
            is_published: false,
          },
          error: null,
        },
      ],
    });
    const result = await requestUse({
      unitId: UNIT_ID,
      requesterUserId: REQUESTER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unit_not_published");
  });

  it("rejects self-request (author requests own unit)", async () => {
    const client = buildClient({
      units: [
        {
          data: {
            id: UNIT_ID,
            author_teacher_id: AUTHOR_ID, // same as requester below
            school_id: SCHOOL_ID,
            is_published: true,
          },
          error: null,
        },
      ],
    });
    const result = await requestUse({
      unitId: UNIT_ID,
      requesterUserId: AUTHOR_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("self_request");
  });

  it("rejects cross-school request", async () => {
    const client = buildClient({
      units: [
        {
          data: {
            id: UNIT_ID,
            author_teacher_id: AUTHOR_ID,
            school_id: SCHOOL_ID,
            is_published: true,
          },
          error: null,
        },
      ],
      teachers: [
        { data: { school_id: OTHER_SCHOOL_ID }, error: null },
      ],
    });
    const result = await requestUse({
      unitId: UNIT_ID,
      requesterUserId: REQUESTER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("cross_school");
  });

  it("rejects requester with no school_id", async () => {
    const client = buildClient({
      units: [
        {
          data: {
            id: UNIT_ID,
            author_teacher_id: AUTHOR_ID,
            school_id: SCHOOL_ID,
            is_published: true,
          },
          error: null,
        },
      ],
      teachers: [{ data: { school_id: null }, error: null }],
    });
    const result = await requestUse({
      unitId: UNIT_ID,
      requesterUserId: REQUESTER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("requester_no_school");
  });

  it("returns duplicate_pending on 23505", async () => {
    const client = buildClient({
      units: [
        {
          data: {
            id: UNIT_ID,
            author_teacher_id: AUTHOR_ID,
            school_id: SCHOOL_ID,
            is_published: true,
          },
          error: null,
        },
      ],
      teachers: [{ data: { school_id: SCHOOL_ID }, error: null }],
      unit_use_requests: [
        {
          data: null,
          error: { code: "23505", message: "unique violation" },
        },
      ],
    });
    const result = await requestUse({
      unitId: UNIT_ID,
      requesterUserId: REQUESTER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("duplicate_pending");
  });

  it("happy path", async () => {
    const client = buildClient({
      units: [
        {
          data: {
            id: UNIT_ID,
            author_teacher_id: AUTHOR_ID,
            school_id: SCHOOL_ID,
            is_published: true,
          },
          error: null,
        },
      ],
      teachers: [{ data: { school_id: SCHOOL_ID }, error: null }],
      unit_use_requests: [
        { data: { id: REQUEST_ID }, error: null },
      ],
    });
    const result = await requestUse({
      unitId: UNIT_ID,
      requesterUserId: REQUESTER_ID,
      intentMessage: "  trim me  ",
      supabase: client as never,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.requestId).toBe(REQUEST_ID);
  });
});

// ═══════════════════════════════════════════════════════════════════
// approveRequest (auth + status only — fork integration tested in prod)
// ═══════════════════════════════════════════════════════════════════

describe("approveRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns not_authorized when caller != author", async () => {
    const client = buildClient({
      unit_use_requests: [
        {
          data: {
            id: REQUEST_ID,
            unit_id: UNIT_ID,
            requester_user_id: REQUESTER_ID,
            author_user_id: AUTHOR_ID,
            school_id: SCHOOL_ID,
            status: "pending",
          },
          error: null,
        },
      ],
    });
    const result = await approveRequest({
      requestId: REQUEST_ID,
      authorUserId: REQUESTER_ID, // wrong — requester trying to approve
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_authorized");
  });

  it("returns wrong_status when not pending", async () => {
    const client = buildClient({
      unit_use_requests: [
        {
          data: {
            id: REQUEST_ID,
            unit_id: UNIT_ID,
            requester_user_id: REQUESTER_ID,
            author_user_id: AUTHOR_ID,
            school_id: SCHOOL_ID,
            status: "approved",
          },
          error: null,
        },
      ],
    });
    const result = await approveRequest({
      requestId: REQUEST_ID,
      authorUserId: AUTHOR_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong_status");
  });

  it("returns request_not_found when row missing", async () => {
    const client = buildClient({
      unit_use_requests: [{ data: null, error: null }],
    });
    const result = await approveRequest({
      requestId: REQUEST_ID,
      authorUserId: AUTHOR_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("request_not_found");
  });
});

// ═══════════════════════════════════════════════════════════════════
// denyRequest
// ═══════════════════════════════════════════════════════════════════

describe("denyRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns not_authorized when caller != author", async () => {
    const client = buildClient({
      unit_use_requests: [
        {
          data: {
            id: REQUEST_ID,
            author_user_id: AUTHOR_ID,
            school_id: SCHOOL_ID,
            status: "pending",
          },
          error: null,
        },
      ],
    });
    const result = await denyRequest({
      requestId: REQUEST_ID,
      authorUserId: REQUESTER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_authorized");
  });

  it("returns wrong_status when already decided", async () => {
    const client = buildClient({
      unit_use_requests: [
        {
          data: {
            id: REQUEST_ID,
            author_user_id: AUTHOR_ID,
            school_id: SCHOOL_ID,
            status: "denied",
          },
          error: null,
        },
      ],
    });
    const result = await denyRequest({
      requestId: REQUEST_ID,
      authorUserId: AUTHOR_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong_status");
  });

  it("happy path", async () => {
    const client = buildClient({
      unit_use_requests: [
        {
          data: {
            id: REQUEST_ID,
            author_user_id: AUTHOR_ID,
            school_id: SCHOOL_ID,
            status: "pending",
          },
          error: null,
        },
        // Update returns no data but no error
        { data: null, error: null },
      ],
    });
    const result = await denyRequest({
      requestId: REQUEST_ID,
      authorUserId: AUTHOR_ID,
      response: "Still drafting; ask again in 2 weeks",
      supabase: client as never,
    });
    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// withdrawRequest
// ═══════════════════════════════════════════════════════════════════

describe("withdrawRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns not_authorized when caller != requester", async () => {
    const client = buildClient({
      unit_use_requests: [
        {
          data: {
            id: REQUEST_ID,
            requester_user_id: REQUESTER_ID,
            school_id: SCHOOL_ID,
            status: "pending",
          },
          error: null,
        },
      ],
    });
    const result = await withdrawRequest({
      requestId: REQUEST_ID,
      requesterUserId: AUTHOR_ID, // not the original requester
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_authorized");
  });

  it("returns wrong_status when not pending", async () => {
    const client = buildClient({
      unit_use_requests: [
        {
          data: {
            id: REQUEST_ID,
            requester_user_id: REQUESTER_ID,
            school_id: SCHOOL_ID,
            status: "approved",
          },
          error: null,
        },
      ],
    });
    const result = await withdrawRequest({
      requestId: REQUEST_ID,
      requesterUserId: REQUESTER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong_status");
  });

  it("happy path", async () => {
    const client = buildClient({
      unit_use_requests: [
        {
          data: {
            id: REQUEST_ID,
            requester_user_id: REQUESTER_ID,
            school_id: SCHOOL_ID,
            status: "pending",
          },
          error: null,
        },
        { data: null, error: null },
      ],
    });
    const result = await withdrawRequest({
      requestId: REQUEST_ID,
      requesterUserId: REQUESTER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(true);
  });
});
