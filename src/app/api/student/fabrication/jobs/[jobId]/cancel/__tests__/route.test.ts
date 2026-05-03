import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Route test for POST /api/student/fabrication/jobs/[jobId]/cancel
 * (Phase 6-6k). Orchestration mocked.
 */

let mockStudentId: string | null = "student-1";
let cancelSpy: ReturnType<typeof vi.fn>;

vi.mock("@/lib/access-v2/actor-session", () => ({
  requireStudentSession: async () => {
    if (!mockStudentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return {
      type: "student" as const,
      studentId: mockStudentId,
      userId: "u-test-mock",
      schoolId: null,
      plan: "free" as const,
    };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

vi.mock("@/lib/fabrication/orchestration", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fabrication/orchestration")>(
    "@/lib/fabrication/orchestration"
  );
  return {
    ...actual,
    cancelJob: (...args: unknown[]) => cancelSpy(...args),
  };
});

import { POST } from "../route";
import { NextRequest, NextResponse } from "next/server";

function makeRequest(jobId: string) {
  return {
    req: new NextRequest(
      `http://localhost/api/student/fabrication/jobs/${jobId}/cancel`,
      { method: "POST" }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

describe("POST /api/student/fabrication/jobs/[jobId]/cancel", () => {
  beforeEach(() => {
    mockStudentId = "student-1";
    cancelSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockStudentId = null;
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(401);
  });

  it("passes studentId + jobId to cancelJob", async () => {
    cancelSpy.mockResolvedValueOnce({ jobId: "job-xyz", newStatus: "cancelled" });
    const { req, context } = makeRequest("job-xyz");
    await POST(req, context);
    expect(cancelSpy).toHaveBeenCalledWith(expect.anything(), {
      studentId: "student-1",
      jobId: "job-xyz",
    });
  });

  it("returns 200 with the cancel success payload", async () => {
    cancelSpy.mockResolvedValueOnce({ jobId: "job-1", newStatus: "cancelled" });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ jobId: "job-1", newStatus: "cancelled" });
  });

  it("maps orchestration 409 to 409 (already actioned by teacher)", async () => {
    cancelSpy.mockResolvedValueOnce({
      error: { status: 409, message: "Can't withdraw a job in status 'approved'." },
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("approved");
  });

  it("maps orchestration 404 to 404 (not found / not owned)", async () => {
    cancelSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Job not found" },
    });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.status).toBe(404);
  });

  it("sets Cache-Control: private, no-store", async () => {
    cancelSpy.mockResolvedValueOnce({ jobId: "job-1", newStatus: "cancelled" });
    const { req, context } = makeRequest("job-1");
    const res = await POST(req, context);
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
