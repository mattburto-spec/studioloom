import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Route test for POST /api/fab/jobs/[jobId]/complete (Phase 7-2).
 */

let mockFabricatorId: string | null = "fab-1";
let completeSpy: ReturnType<typeof vi.fn>;

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
    markComplete: (...args: unknown[]) => completeSpy(...args),
  };
});

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(jobId: string, body: unknown = {}) {
  return {
    req: new NextRequest(
      `http://localhost/api/fab/jobs/${jobId}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

describe("POST /api/fab/jobs/[jobId]/complete", () => {
  beforeEach(() => {
    mockFabricatorId = "fab-1";
    completeSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockFabricatorId = null;
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(401);
  });

  it("passes fabricatorId + jobId + note to markComplete", async () => {
    completeSpy.mockResolvedValueOnce({
      jobId: "job-1",
      completionStatus: "printed",
      completedAt: "2026-04-24T02:00:00Z",
    });
    const { req, context } = makeRequest("job-xyz", {
      completion_note: "Looked great, slight stringing",
    });
    await POST(req, context);
    expect(completeSpy).toHaveBeenCalledWith(expect.anything(), {
      fabricatorId: "fab-1",
      jobId: "job-xyz",
      completionNote: "Looked great, slight stringing",
    });
  });

  it("accepts empty body (note is optional)", async () => {
    completeSpy.mockResolvedValueOnce({
      jobId: "job-1",
      completionStatus: "cut",
      completedAt: "2026-04-24T02:00:00Z",
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(200);
  });

  it("returns 200 with the success payload", async () => {
    completeSpy.mockResolvedValueOnce({
      jobId: "job-1",
      completionStatus: "printed",
      completedAt: "2026-04-24T02:00:00Z",
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.completionStatus).toBe("printed");
  });

  it("maps orchestration 404 (not owner) to 404", async () => {
    completeSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Job not found" },
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(404);
  });

  it("maps orchestration 409 (not picked_up) to 409", async () => {
    completeSpy.mockResolvedValueOnce({
      error: {
        status: 409,
        message: "Can't complete a job in status 'approved'.",
      },
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(409);
  });

  it("sets Cache-Control: private, no-store", async () => {
    completeSpy.mockResolvedValueOnce({
      jobId: "job-1",
      completionStatus: "printed",
      completedAt: "x",
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
