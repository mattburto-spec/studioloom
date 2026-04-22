import { describe, it, expect, beforeEach, vi } from "vitest";

let mockTeacherId: string | null = "teacher-1";
let rejectSpy: ReturnType<typeof vi.fn>;

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
  rejectJob: (...args: unknown[]) => rejectSpy(...args),
}));

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(jobId: string, body: unknown = {}) {
  return {
    req: new NextRequest(
      `http://localhost/api/teacher/fabrication/jobs/${jobId}/reject`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

describe("POST /api/teacher/fabrication/jobs/[jobId]/reject", () => {
  beforeEach(() => {
    mockTeacherId = "teacher-1";
    rejectSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockTeacherId = null;
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(401);
  });

  it("passes optional note when provided (safety flag reason)", async () => {
    rejectSpy.mockResolvedValueOnce({
      jobId: "job-1",
      newStatus: "rejected",
      teacherReviewedAt: "x",
    });
    const { req, context } = makeRequest("job-1", {
      note: "Weapon-shaped STL — safety policy",
    });
    await POST(req, context);
    expect(rejectSpy.mock.calls[0][1].note).toMatch(/Weapon-shaped/);
  });

  it("accepts empty body (reject without a note)", async () => {
    rejectSpy.mockResolvedValueOnce({
      jobId: "job-1",
      newStatus: "rejected",
      teacherReviewedAt: "x",
    });
    const req = new NextRequest(
      "http://localhost/api/teacher/fabrication/jobs/job-1/reject",
      { method: "POST" }
    );
    const res = await POST(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(res.status).toBe(200);
    expect(rejectSpy.mock.calls[0][1].note).toBeUndefined();
  });

  it("maps 409 from orchestration", async () => {
    rejectSpy.mockResolvedValueOnce({
      error: { status: 409, message: "already approved" },
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(409);
  });
});
