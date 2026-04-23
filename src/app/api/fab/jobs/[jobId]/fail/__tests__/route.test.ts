import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Route test for POST /api/fab/jobs/[jobId]/fail (Phase 7-2).
 */

let mockFabricatorId: string | null = "fab-1";
let failSpy: ReturnType<typeof vi.fn>;

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
    markFailed: (...args: unknown[]) => failSpy(...args),
  };
});

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(jobId: string, body: unknown = {}) {
  return {
    req: new NextRequest(
      `http://localhost/api/fab/jobs/${jobId}/fail`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

describe("POST /api/fab/jobs/[jobId]/fail", () => {
  beforeEach(() => {
    mockFabricatorId = "fab-1";
    failSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockFabricatorId = null;
    const { req, context } = makeRequest("job-1", {
      completion_note: "warped",
    });
    const res = await POST(req, context);
    expect(res.status).toBe(401);
    // Shouldn't even call the orchestration.
    expect(failSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when note is missing entirely", async () => {
    const { req, context } = makeRequest("job-1", {});
    const res = await POST(req, context);
    expect(res.status).toBe(400);
    expect(failSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when note is empty string", async () => {
    const { req, context } = makeRequest("job-1", { completion_note: "" });
    const res = await POST(req, context);
    expect(res.status).toBe(400);
    expect(failSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when note is whitespace only", async () => {
    const { req, context } = makeRequest("job-1", {
      completion_note: "  \n\t  ",
    });
    const res = await POST(req, context);
    expect(res.status).toBe(400);
    expect(failSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when body isn't valid JSON", async () => {
    const req = new NextRequest(
      "http://localhost/api/fab/jobs/job-1/fail",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }
    );
    const context = { params: Promise.resolve({ jobId: "job-1" }) };
    const res = await POST(req, context);
    expect(res.status).toBe(400);
  });

  it("passes note through to markFailed and returns 200 on success", async () => {
    failSpy.mockResolvedValueOnce({
      jobId: "job-1",
      completionStatus: "failed",
      completedAt: "2026-04-24T02:00:00Z",
    });
    const { req, context } = makeRequest("job-1", {
      completion_note: "Warped off the bed at layer 12",
    });
    const res = await POST(req, context);
    expect(res.status).toBe(200);
    expect(failSpy).toHaveBeenCalledWith(expect.anything(), {
      fabricatorId: "fab-1",
      jobId: "job-1",
      completionNote: "Warped off the bed at layer 12",
    });
  });

  it("maps orchestration 409 (not picked_up) to 409", async () => {
    failSpy.mockResolvedValueOnce({
      error: {
        status: 409,
        message: "Can't fail a job in status 'completed'.",
      },
    });
    const { req, context } = makeRequest("job-1", {
      completion_note: "ok",
    });
    const res = await POST(req, context);
    expect(res.status).toBe(409);
  });

  it("sets Cache-Control: private, no-store", async () => {
    failSpy.mockResolvedValueOnce({
      jobId: "job-1",
      completionStatus: "failed",
      completedAt: "x",
    });
    const { req, context } = makeRequest("job-1", {
      completion_note: "ok",
    });
    const res = await POST(req, context);
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
