/**
 * Tests for PATCH /api/teacher/gallery/[roundId]/layout
 *
 * Phase GV2-1 — Spatial canvas layout save endpoint.
 * Spec: docs/projects/gallery-v2.md §10 GV2-1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ───

const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

// Admin client builder — tests override its behaviour per case.
const mockAdminFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockAdminFrom }),
}));

// ─── Helpers ───

const VALID_ROUND_ID = "00000000-0000-0000-0000-000000000001";
const VALID_SUB_A = "00000000-0000-0000-0000-00000000000a";
const VALID_SUB_B = "00000000-0000-0000-0000-00000000000b";
const OTHER_TEACHER_ROUND = "00000000-0000-0000-0000-000000000002";

function buildRequest(roundId: string, body: unknown): NextRequest {
  return new NextRequest(
    new URL(`https://example.test/api/teacher/gallery/${roundId}/layout`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }
  );
}

/**
 * Build a Supabase admin mock that simulates:
 *  - gallery_rounds lookup: returns {id} if ownedRoundId matches, else null
 *  - gallery_submissions "in(ids)" lookup: returns rows for every id in `ownedSubmissionIds`
 *  - gallery_submissions update: always succeeds
 */
function configureAdmin({
  ownedRoundId = VALID_ROUND_ID,
  ownedSubmissionIds = [VALID_SUB_A, VALID_SUB_B],
  updateError = null as unknown,
}: {
  ownedRoundId?: string | null;
  ownedSubmissionIds?: string[];
  updateError?: unknown;
} = {}) {
  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "gallery_rounds") {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.maybeSingle = vi.fn().mockImplementation(async () => {
        // The route calls: .eq("id", roundId).eq("teacher_id", user.id)
        // We approximate by returning a row if the roundId passed matches.
        const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
        const roundEq = eqCalls.find((c) => c[0] === "id");
        const requestedRoundId = roundEq?.[1];
        if (ownedRoundId && requestedRoundId === ownedRoundId) {
          return { data: { id: ownedRoundId }, error: null };
        }
        return { data: null, error: null };
      });
      return chain;
    }
    if (table === "gallery_submissions") {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.in = vi.fn().mockImplementation(async () => {
        return {
          data: ownedSubmissionIds.map((id) => ({ id })),
          error: null,
        };
      });
      chain.update = vi.fn().mockReturnValue(chain);
      // For update chain, the final await lands on .eq() — make it thenable at chain level.
      chain.then = (resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: updateError }).then(resolve);
      return chain;
    }
    throw new Error(`unexpected table: ${table}`);
  });
}

// ─── Tests ───

describe("PATCH /api/teacher/gallery/[roundId]/layout", () => {
  let PATCH: typeof import("../route").PATCH;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "teacher-uuid-1", app_metadata: { user_type: "teacher" } } } });
    configureAdmin();
    const mod = await import("../route");
    PATCH = mod.PATCH;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("401 when no authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const req = buildRequest(VALID_ROUND_ID, {
      submissions: [{ id: VALID_SUB_A, canvas_x: 0, canvas_y: 0 }],
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("400 for malformed round UUID in URL", async () => {
    const req = buildRequest("not-a-uuid", {
      submissions: [{ id: VALID_SUB_A, canvas_x: 0, canvas_y: 0 }],
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid round id");
  });

  it("400 for invalid JSON body", async () => {
    const req = buildRequest(VALID_ROUND_ID, "{not-json");
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON body");
  });

  it("400 when submissions array is missing", async () => {
    const req = buildRequest(VALID_ROUND_ID, { foo: "bar" });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("submissions array required");
  });

  it("200 with updated=0 for empty submissions array (no-op short-circuit)", async () => {
    const req = buildRequest(VALID_ROUND_ID, { submissions: [] });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.updated).toBe(0);
  });

  it("400 when more than 50 submissions in one call", async () => {
    const submissions = Array.from({ length: 51 }, (_, i) => ({
      id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      canvas_x: 0,
      canvas_y: 0,
    }));
    const req = buildRequest(VALID_ROUND_ID, { submissions });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Too many submissions");
  });

  it("400 for non-UUID submission id", async () => {
    const req = buildRequest(VALID_ROUND_ID, {
      submissions: [{ id: "not-uuid", canvas_x: 0, canvas_y: 0 }],
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("valid uuid");
  });

  it("400 for non-finite canvas_x", async () => {
    const req = buildRequest(VALID_ROUND_ID, {
      submissions: [{ id: VALID_SUB_A, canvas_x: Infinity, canvas_y: 0 }],
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("finite numbers");
  });

  it("400 for canvas_x outside [-10000, 10000]", async () => {
    const req = buildRequest(VALID_ROUND_ID, {
      submissions: [{ id: VALID_SUB_A, canvas_x: 99999, canvas_y: 0 }],
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("finite numbers");
  });

  it("403 when teacher doesn't own the round", async () => {
    configureAdmin({ ownedRoundId: OTHER_TEACHER_ROUND });
    const req = buildRequest(VALID_ROUND_ID, {
      submissions: [{ id: VALID_SUB_A, canvas_x: 10, canvas_y: 20 }],
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Round not found");
  });

  it("400 when a submission id doesn't belong to this round", async () => {
    configureAdmin({ ownedSubmissionIds: [VALID_SUB_A] }); // B missing
    const req = buildRequest(VALID_ROUND_ID, {
      submissions: [
        { id: VALID_SUB_A, canvas_x: 0, canvas_y: 0 },
        { id: VALID_SUB_B, canvas_x: 100, canvas_y: 50 },
      ],
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("do not belong");
  });

  it("200 with updated count matching submission count on happy path", async () => {
    const req = buildRequest(VALID_ROUND_ID, {
      submissions: [
        { id: VALID_SUB_A, canvas_x: 100, canvas_y: 200 },
        { id: VALID_SUB_B, canvas_x: 300, canvas_y: 400 },
      ],
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.updated).toBe(2);
  });
});
