import { describe, it, expect, beforeEach, vi } from "vitest";

let mockTeacherId: string | null = "teacher-1";
let noteSpy: ReturnType<typeof vi.fn>;

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
  addTeacherNote: (...args: unknown[]) => noteSpy(...args),
}));

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(jobId: string, body: unknown = {}) {
  return {
    req: new NextRequest(
      `http://localhost/api/teacher/fabrication/jobs/${jobId}/note`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

describe("POST /api/teacher/fabrication/jobs/[jobId]/note", () => {
  beforeEach(() => {
    mockTeacherId = "teacher-1";
    noteSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockTeacherId = null;
    const { req, context } = makeRequest("job-1", { note: "x" });
    const res = await POST(req, context);
    expect(res.status).toBe(401);
  });

  it("passes teacherId + jobId + note", async () => {
    noteSpy.mockResolvedValueOnce({
      jobId: "job-1",
      newStatus: "pending_approval",
      teacherReviewedAt: "x",
    });
    const { req, context } = makeRequest("job-1", {
      note: "Checking on wall thickness",
    });
    await POST(req, context);
    expect(noteSpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
      jobId: "job-1",
      note: "Checking on wall thickness",
    });
  });

  it("maps 400 when orchestration rejects empty note", async () => {
    noteSpy.mockResolvedValueOnce({
      error: { status: 400, message: "Note cannot be empty." },
    });
    const { req, context } = makeRequest("job-1", { note: "" });
    const res = await POST(req, context);
    expect(res.status).toBe(400);
  });

  it("returns 200 with unchanged status on success (note-only action)", async () => {
    noteSpy.mockResolvedValueOnce({
      jobId: "job-1",
      newStatus: "pending_approval",
      teacherReviewedAt: "x",
    });
    const { req, context } = makeRequest("job-1", { note: "Checking…" });
    const res = await POST(req, context);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.newStatus).toBe("pending_approval");
  });
});
