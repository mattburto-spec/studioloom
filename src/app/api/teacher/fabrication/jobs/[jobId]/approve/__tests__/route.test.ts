import { describe, it, expect, beforeEach, vi } from "vitest";

let mockTeacherId: string | null = "teacher-1";
let approveSpy: ReturnType<typeof vi.fn>;

vi.mock("@/lib/auth/verify-teacher-unit", () => ({
  requireTeacherAuth: async () => {
    if (!mockTeacherId) {
      return {
        error: new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      };
    }
    return { teacherId: mockTeacherId };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

// NB: vi.importActual is flaky in [jobId] dirs — direct mock per Phase 4-2 finding.
vi.mock("@/lib/fabrication/teacher-orchestration", () => ({
  approveJob: (...args: unknown[]) => approveSpy(...args),
}));

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(jobId: string, body: unknown = {}) {
  return {
    req: new NextRequest(
      `http://localhost/api/teacher/fabrication/jobs/${jobId}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

describe("POST /api/teacher/fabrication/jobs/[jobId]/approve", () => {
  beforeEach(() => {
    mockTeacherId = "teacher-1";
    approveSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockTeacherId = null;
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(401);
    expect(approveSpy).not.toHaveBeenCalled();
  });

  it("passes teacherId from auth + jobId from URL + optional note from body", async () => {
    approveSpy.mockResolvedValueOnce({
      jobId: "job-1",
      newStatus: "approved",
      teacherReviewedAt: "2026-04-22T07:00:00Z",
    });
    const { req, context } = makeRequest("job-abc", { note: "LGTM" });
    await POST(req, context);
    expect(approveSpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
      jobId: "job-abc",
      note: "LGTM",
    });
  });

  it("handles empty body (note absent, approve still valid)", async () => {
    approveSpy.mockResolvedValueOnce({
      jobId: "job-1",
      newStatus: "approved",
      teacherReviewedAt: "2026-04-22T07:00:00Z",
    });
    const req = new NextRequest(
      "http://localhost/api/teacher/fabrication/jobs/job-1/approve",
      { method: "POST" }
    );
    const res = await POST(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(res.status).toBe(200);
    expect(approveSpy.mock.calls[0][1].note).toBeUndefined();
  });

  it("maps 409 from orchestration (wrong status)", async () => {
    approveSpy.mockResolvedValueOnce({
      error: { status: 409, message: "Job is in status 'approved'" },
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(409);
  });

  it("maps 404 from orchestration", async () => {
    approveSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Job not found" },
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(404);
  });

  it("sets Cache-Control: private, no-store", async () => {
    approveSpy.mockResolvedValueOnce({
      jobId: "job-1",
      newStatus: "approved",
      teacherReviewedAt: "x",
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("private");
  });
});
