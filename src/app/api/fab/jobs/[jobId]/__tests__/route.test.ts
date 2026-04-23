import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Route test for GET /api/fab/jobs/[jobId] (Phase 7-2).
 */

let mockFabricatorId: string | null = "fab-1";
let detailSpy: ReturnType<typeof vi.fn>;

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
          display_name: "Test",
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
    getFabJobDetail: (...args: unknown[]) => detailSpy(...args),
  };
});

import { GET } from "../route";
import { NextRequest } from "next/server";

function makeRequest(jobId: string) {
  return {
    req: new NextRequest(
      `http://localhost/api/fab/jobs/${jobId}`,
      { method: "GET" }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

describe("GET /api/fab/jobs/[jobId]", () => {
  beforeEach(() => {
    mockFabricatorId = "fab-1";
    detailSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockFabricatorId = null;
    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);
    expect(res.status).toBe(401);
  });

  it("passes fabricatorId + jobId to getFabJobDetail", async () => {
    detailSpy.mockResolvedValueOnce({
      job: { id: "job-1" },
      student: {},
      machine: {},
      currentRevisionData: null,
      classInfo: null,
      unit: null,
    });
    const { req, context } = makeRequest("job-xyz");
    await GET(req, context);
    expect(detailSpy).toHaveBeenCalledWith(expect.anything(), {
      fabricatorId: "fab-1",
      jobId: "job-xyz",
    });
  });

  it("returns 200 with the full detail payload", async () => {
    const payload = {
      job: { id: "job-1", status: "approved" },
      student: { id: "s1", name: "Kai" },
      classInfo: null,
      unit: null,
      machine: { id: "m1", name: "Bambu X1", category: "3d_printer" },
      currentRevisionData: null,
    };
    detailSpy.mockResolvedValueOnce(payload);
    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
  });

  it("maps orchestration 404 (not-assigned/not-owner) to 404", async () => {
    detailSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Job not found" },
    });
    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);
    expect(res.status).toBe(404);
  });

  it("sets Cache-Control: private, no-store", async () => {
    detailSpy.mockResolvedValueOnce({
      job: {},
      student: {},
      machine: {},
      currentRevisionData: null,
      classInfo: null,
      unit: null,
    });
    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
