import { describe, it, expect, beforeEach, vi } from "vitest";

let mockStudentId: string | null = "student-1";
let submitSpy: ReturnType<typeof vi.fn>;

vi.mock("@/lib/auth/student", () => ({
  requireStudentAuth: async () => {
    if (!mockStudentId)
      return {
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      };
    return { studentId: mockStudentId };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/fabrication/orchestration", () => ({
  submitJob: (...args: unknown[]) => submitSpy(...args),
  isOrchestrationError: (r: { error?: unknown }) => r.error !== undefined,
}));

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(jobId: string) {
  return {
    req: new NextRequest(
      `http://localhost/api/student/fabrication/jobs/${jobId}/submit`,
      { method: "POST" }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

describe("POST /api/student/fabrication/jobs/[jobId]/submit", () => {
  beforeEach(() => {
    mockStudentId = "student-1";
    submitSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockStudentId = null;
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(401);
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it("passes studentId from auth + jobId from URL", async () => {
    submitSpy.mockResolvedValueOnce({
      jobId: "job-1",
      newStatus: "approved",
      requiresTeacherApproval: false,
    });
    const { req, context } = makeRequest("job-xyz");
    await POST(req, context);
    expect(submitSpy.mock.calls[0][1]).toEqual({
      studentId: "student-1",
      jobId: "job-xyz",
    });
  });

  it("returns 200 with newStatus='approved' when no teacher approval required", async () => {
    submitSpy.mockResolvedValueOnce({
      jobId: "job-1",
      newStatus: "approved",
      requiresTeacherApproval: false,
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      jobId: "job-1",
      newStatus: "approved",
      requiresTeacherApproval: false,
    });
  });

  it("returns 200 with newStatus='pending_approval' when teacher approval required", async () => {
    submitSpy.mockResolvedValueOnce({
      jobId: "job-1",
      newStatus: "pending_approval",
      requiresTeacherApproval: true,
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    const body = await res.json();
    expect(body.newStatus).toBe("pending_approval");
    expect(body.requiresTeacherApproval).toBe(true);
  });

  it("maps orchestration 400 (missing acks) to 400", async () => {
    submitSpy.mockResolvedValueOnce({
      error: { status: 400, message: "Each warning needs an acknowledgement. Missing: R-STL-11" },
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/R-STL-11/);
  });

  it("maps orchestration 404 to 404", async () => {
    submitSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Job not found" },
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(404);
  });

  it("maps orchestration 409 to 409 (double-submit guard)", async () => {
    submitSpy.mockResolvedValueOnce({
      error: { status: 409, message: "Job is in status 'approved' — can't submit from this state" },
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(409);
  });

  it("sets Cache-Control: private, no-store", async () => {
    submitSpy.mockResolvedValueOnce({
      jobId: "job-1",
      newStatus: "approved",
      requiresTeacherApproval: false,
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });
});
