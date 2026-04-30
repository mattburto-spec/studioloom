import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Route-level test for GET /api/student/fabrication/jobs/[jobId]/status.
 * Orchestration lib is mocked.
 */

let mockStudentId: string | null = "student-1";
let getStatusSpy: ReturnType<typeof vi.fn>;

vi.mock("@/lib/access-v2/actor-session", () => ({
  requireStudentSession: async () => {
    if (!mockStudentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return {
      type: "student" as const,
      studentId: mockStudentId,
      userId: "user-" + mockStudentId,
      schoolId: null,
    };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

// NB: vi.importActual is flaky when the test file lives inside a dynamic
// route segment (e.g. `[jobId]`). Mock the full surface directly.
vi.mock("@/lib/fabrication/orchestration", () => ({
  getJobStatus: (...args: unknown[]) => getStatusSpy(...args),
  isOrchestrationError: (r: { error?: unknown }) => r.error !== undefined,
}));

import { GET } from "../route";
import { NextRequest, NextResponse } from "next/server";

function makeRequest(jobId: string = "job-1"): {
  req: NextRequest;
  context: { params: Promise<{ jobId: string }> };
} {
  return {
    req: new NextRequest(
      `http://localhost/api/student/fabrication/jobs/${jobId}/status`,
      { method: "GET" }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

describe("GET /api/student/fabrication/jobs/[jobId]/status", () => {
  beforeEach(() => {
    mockStudentId = "student-1";
    getStatusSpy = vi.fn();
  });

  it("returns 401 when student is not authenticated", async () => {
    mockStudentId = null;
    const { req, context } = makeRequest();
    const res = await GET(req, context);
    expect(res.status).toBe(401);
    expect(getStatusSpy).not.toHaveBeenCalled();
  });

  it("passes studentId from auth + jobId from URL", async () => {
    getStatusSpy.mockResolvedValueOnce({
      jobId: "job-1",
      jobStatus: "uploaded",
      currentRevision: 1,
      revision: null,
      scanJob: null,
    });
    const { req, context } = makeRequest("job-xyz");
    await GET(req, context);
    expect(getStatusSpy.mock.calls[0][1]).toEqual({
      studentId: "student-1",
      jobId: "job-xyz",
      includeResults: false,
    });
  });

  it("passes includeResults: true when ?include=results is in the URL", async () => {
    getStatusSpy.mockResolvedValueOnce({
      jobId: "job-1",
      jobStatus: "scanning",
      currentRevision: 1,
      revision: null,
      scanJob: null,
    });
    const req = new NextRequest(
      "http://localhost/api/student/fabrication/jobs/job-1/status?include=results",
      { method: "GET" }
    );
    await GET(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(getStatusSpy.mock.calls[0][1]).toEqual({
      studentId: "student-1",
      jobId: "job-1",
      includeResults: true,
    });
  });

  it("returns full payload on 200", async () => {
    const payload = {
      jobId: "job-1",
      jobStatus: "scanning",
      currentRevision: 2,
      revision: {
        id: "rev-2",
        revisionNumber: 2,
        scanStatus: "done",
        scanError: null,
        scanCompletedAt: "2026-04-22T22:14:21Z",
        scanRulesetVersion: "stl-v1.0.0+svg-v1.0.0",
        thumbnailUrl: "https://stor.example.com/thumb?token=xyz",
      },
      scanJob: {
        id: "sj-1",
        status: "done",
        attemptCount: 1,
        errorDetail: null,
      },
    };
    getStatusSpy.mockResolvedValueOnce(payload);
    const { req, context } = makeRequest();
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
  });

  it("maps orchestration 404 to 404 (job not found OR not owned)", async () => {
    getStatusSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Job not found" },
    });
    const { req, context } = makeRequest();
    const res = await GET(req, context);
    expect(res.status).toBe(404);
  });

  it("maps orchestration 500 to 500", async () => {
    getStatusSpy.mockResolvedValueOnce({
      error: { status: 500, message: "db down" },
    });
    const { req, context } = makeRequest();
    const res = await GET(req, context);
    expect(res.status).toBe(500);
  });

  it("sets Cache-Control: private, no-store on responses (Lesson #11, polled endpoint)", async () => {
    getStatusSpy.mockResolvedValueOnce({
      jobId: "job-1",
      jobStatus: "uploaded",
      currentRevision: 1,
      revision: null,
      scanJob: null,
    });
    const { req, context } = makeRequest();
    const res = await GET(req, context);
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });
});
