import { describe, it, expect, beforeEach, vi } from "vitest";

let mockTeacherId: string | null = "teacher-1";
let returnSpy: ReturnType<typeof vi.fn>;

vi.mock("@/lib/auth/verify-teacher-unit", () => ({
  requireTeacherAuth: async () => {
    if (!mockTeacherId) {
      return {
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      };
    }
    return { teacherId: mockTeacherId };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

vi.mock("@/lib/fabrication/teacher-orchestration", () => ({
  returnForRevision: (...args: unknown[]) => returnSpy(...args),
}));

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(jobId: string, body: unknown = {}) {
  return {
    req: new NextRequest(
      `http://localhost/api/teacher/fabrication/jobs/${jobId}/return-for-revision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

describe("POST /api/teacher/fabrication/jobs/[jobId]/return-for-revision", () => {
  beforeEach(() => {
    mockTeacherId = "teacher-1";
    returnSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockTeacherId = null;
    const { req, context } = makeRequest("job-1", { note: "fix wall" });
    const res = await POST(req, context);
    expect(res.status).toBe(401);
    expect(returnSpy).not.toHaveBeenCalled();
  });

  it("passes teacherId + jobId + note (required)", async () => {
    returnSpy.mockResolvedValueOnce({
      jobId: "job-1",
      newStatus: "needs_revision",
      teacherReviewedAt: "x",
    });
    const { req, context } = makeRequest("job-1", { note: "Wall is too thin" });
    await POST(req, context);
    expect(returnSpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
      jobId: "job-1",
      note: "Wall is too thin",
    });
  });

  it("maps 400 when orchestration rejects missing note", async () => {
    returnSpy.mockResolvedValueOnce({
      error: { status: 400, message: "A note is required when returning for revision." },
    });
    const { req, context } = makeRequest("job-1", {});
    const res = await POST(req, context);
    expect(res.status).toBe(400);
  });

  it("maps 409 when job is not in pending_approval", async () => {
    returnSpy.mockResolvedValueOnce({
      error: { status: 409, message: "Job is in status 'approved'" },
    });
    const { req, context } = makeRequest("job-1", { note: "x" });
    const res = await POST(req, context);
    expect(res.status).toBe(409);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/teacher/fabrication/jobs/job-1/return-for-revision",
      { method: "POST", body: "not json" }
    );
    const res = await POST(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(res.status).toBe(400);
  });
});
