import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Route test for GET /api/fab/queue (Phase 7-2). Orchestration +
 * fab auth both mocked.
 */

let mockFabricatorId: string | null = "fab-1";
let queueSpy: ReturnType<typeof vi.fn>;

vi.mock("@/lib/fab/auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireFabricatorAuth: async () => {
      if (!mockFabricatorId) {
        return {
          error: NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
          ),
        };
      }
      return {
        fabricator: {
          id: mockFabricatorId,
          display_name: "Test Fab",
          email: "fab@test",
          is_active: true,
        },
        session: { id: "sess-1" },
      };
    },
  };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

vi.mock("@/lib/fabrication/fab-orchestration", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/fabrication/fab-orchestration")
  >("@/lib/fabrication/fab-orchestration");
  return {
    ...actual,
    listFabricatorQueue: (...args: unknown[]) => queueSpy(...args),
  };
});

import { GET } from "../route";
import { NextRequest } from "next/server";

function makeRequest(query = "") {
  return new NextRequest(`http://localhost/api/fab/queue${query}`, {
    method: "GET",
  });
}

describe("GET /api/fab/queue", () => {
  beforeEach(() => {
    mockFabricatorId = "fab-1";
    queueSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockFabricatorId = null;
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("defaults to tab=ready when not specified + passes fabricatorId", async () => {
    queueSpy.mockResolvedValueOnce({ jobs: [] });
    await GET(makeRequest());
    expect(queueSpy).toHaveBeenCalledWith(expect.anything(), {
      fabricatorId: "fab-1",
      tab: "ready",
    });
  });

  it("accepts tab=in_progress", async () => {
    queueSpy.mockResolvedValueOnce({ jobs: [] });
    await GET(makeRequest("?tab=in_progress"));
    expect(queueSpy).toHaveBeenCalledWith(expect.anything(), {
      fabricatorId: "fab-1",
      tab: "in_progress",
    });
  });

  it("rejects unknown tab with 400", async () => {
    const res = await GET(makeRequest("?tab=weird"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("weird");
  });

  it("returns 200 with jobs payload", async () => {
    const payload = { jobs: [{ jobId: "job-1" }] };
    queueSpy.mockResolvedValueOnce(payload);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
  });

  it("maps orchestration 500 to 500", async () => {
    queueSpy.mockResolvedValueOnce({
      error: { status: 500, message: "DB error" },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("sets Cache-Control: private, no-store", async () => {
    queueSpy.mockResolvedValueOnce({ jobs: [] });
    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
