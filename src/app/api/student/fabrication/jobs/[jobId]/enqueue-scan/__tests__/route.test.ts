import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Route-level integration test for POST /api/student/fabrication/jobs/[jobId]/enqueue-scan.
 * Orchestration lib is mocked — only the thin route-handler behaviour is under test here.
 */

let mockStudentId: string | null = "student-1";
let enqueueSpy: ReturnType<typeof vi.fn>;

vi.mock("@/lib/auth/student", () => ({
  requireStudentAuth: async () => {
    if (!mockStudentId) {
      return {
        error: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      };
    }
    return { studentId: mockStudentId };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

// NB: vi.importActual is flaky when the test file lives inside a dynamic
// route segment (e.g. `[jobId]`) — the bracket characters collide with
// some module-graph resolution paths. We mock the full surface directly
// (both the spy target + the narrow isOrchestrationError guard).
vi.mock("@/lib/fabrication/orchestration", () => ({
  enqueueScanJob: (...args: unknown[]) => enqueueSpy(...args),
  isOrchestrationError: (r: { error?: unknown }) => r.error !== undefined,
}));

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(jobId: string = "job-1"): { req: NextRequest; context: { params: Promise<{ jobId: string }> } } {
  return {
    req: new NextRequest(
      `http://localhost/api/student/fabrication/jobs/${jobId}/enqueue-scan`,
      { method: "POST" }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

describe("POST /api/student/fabrication/jobs/[jobId]/enqueue-scan", () => {
  beforeEach(() => {
    mockStudentId = "student-1";
    enqueueSpy = vi.fn();
  });

  it("returns 401 when student is not authenticated", async () => {
    mockStudentId = null;
    const { req, context } = makeRequest();
    const res = await POST(req, context);
    expect(res.status).toBe(401);
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it("passes studentId from auth + jobId from URL into enqueueScanJob", async () => {
    enqueueSpy.mockResolvedValueOnce({
      scanJobId: "sj-1",
      status: "pending",
      attemptCount: 0,
      isNew: true,
      jobRevisionId: "rev-1",
    });
    const { req, context } = makeRequest("job-abc");
    await POST(req, context);
    expect(enqueueSpy).toHaveBeenCalledTimes(1);
    expect(enqueueSpy.mock.calls[0][1]).toEqual({
      studentId: "student-1",
      jobId: "job-abc",
    });
  });

  it("returns 200 with isNew: true payload on fresh enqueue", async () => {
    enqueueSpy.mockResolvedValueOnce({
      scanJobId: "sj-new",
      status: "pending",
      attemptCount: 0,
      isNew: true,
      jobRevisionId: "rev-1",
    });
    const { req, context } = makeRequest();
    const res = await POST(req, context);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      scanJobId: "sj-new",
      status: "pending",
      attemptCount: 0,
      isNew: true,
      jobRevisionId: "rev-1",
    });
  });

  it("returns 200 with isNew: false on idempotent re-enqueue", async () => {
    enqueueSpy.mockResolvedValueOnce({
      scanJobId: "sj-existing",
      status: "running",
      attemptCount: 1,
      isNew: false,
      jobRevisionId: "rev-1",
    });
    const { req, context } = makeRequest();
    const res = await POST(req, context);
    const body = await res.json();
    expect(body.isNew).toBe(false);
    expect(body.status).toBe("running");
    expect(body.attemptCount).toBe(1);
  });

  it("maps orchestration 404 to 404", async () => {
    enqueueSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Job not found" },
    });
    const { req, context } = makeRequest();
    const res = await POST(req, context);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Job not found");
  });

  it("sets Cache-Control: private, no-store on all responses", async () => {
    enqueueSpy.mockResolvedValueOnce({
      scanJobId: "sj-1",
      status: "pending",
      attemptCount: 0,
      isNew: true,
      jobRevisionId: "rev-1",
    });
    const { req, context } = makeRequest();
    const res = await POST(req, context);
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });
});
