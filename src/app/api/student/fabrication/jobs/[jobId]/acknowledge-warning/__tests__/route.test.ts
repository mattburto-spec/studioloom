import { describe, it, expect, beforeEach, vi } from "vitest";

let mockStudentId: string | null = "student-1";
let acknowledgeSpy: ReturnType<typeof vi.fn>;

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

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/fabrication/orchestration", () => ({
  ACK_CHOICES: ["intentional", "will-fix-slicer", "acknowledged"],
  acknowledgeWarning: (...args: unknown[]) => acknowledgeSpy(...args),
  isOrchestrationError: (r: { error?: unknown }) => r.error !== undefined,
}));

import { POST } from "../route";
import { NextRequest, NextResponse } from "next/server";

function makeRequest(jobId: string, body: unknown) {
  return {
    req: new NextRequest(
      `http://localhost/api/student/fabrication/jobs/${jobId}/acknowledge-warning`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

const validBody = {
  revisionNumber: 1,
  ruleId: "R-STL-03",
  choice: "acknowledged",
};

describe("POST /api/student/fabrication/jobs/[jobId]/acknowledge-warning", () => {
  beforeEach(() => {
    mockStudentId = "student-1";
    acknowledgeSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockStudentId = null;
    const { req, context } = makeRequest("job-1", validBody);
    const res = await POST(req, context);
    expect(res.status).toBe(401);
    expect(acknowledgeSpy).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid choice at the route layer (before hitting orchestration)", async () => {
    const { req, context } = makeRequest("job-1", { ...validBody, choice: "bogus" });
    const res = await POST(req, context);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/choice must be one of/);
    expect(acknowledgeSpy).not.toHaveBeenCalled();
  });

  it("returns 200 with merged ack state on success", async () => {
    acknowledgeSpy.mockResolvedValueOnce({
      acknowledgedWarnings: {
        revision_1: {
          "R-STL-03": { choice: "acknowledged", timestamp: "2026-04-22T00:00:00Z" },
        },
      },
    });
    const { req, context } = makeRequest("job-1", validBody);
    const res = await POST(req, context);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.acknowledgedWarnings.revision_1["R-STL-03"].choice).toBe("acknowledged");
  });

  it("passes studentId from auth + jobId from URL, rejects body spoofs", async () => {
    acknowledgeSpy.mockResolvedValueOnce({ acknowledgedWarnings: {} });
    const { req, context } = makeRequest("job-abc", {
      ...validBody,
      studentId: "attacker",
      jobId: "other-job",
    });
    await POST(req, context);
    const call = acknowledgeSpy.mock.calls[0][1];
    expect(call.studentId).toBe("student-1");
    expect(call.jobId).toBe("job-abc");
  });

  it("maps orchestration 404 to 404", async () => {
    acknowledgeSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Job not found" },
    });
    const { req, context } = makeRequest("job-1", validBody);
    const res = await POST(req, context);
    expect(res.status).toBe(404);
  });

  it("sets Cache-Control: private, no-store", async () => {
    acknowledgeSpy.mockResolvedValueOnce({ acknowledgedWarnings: {} });
    const { req, context } = makeRequest("job-1", validBody);
    const res = await POST(req, context);
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });
});
