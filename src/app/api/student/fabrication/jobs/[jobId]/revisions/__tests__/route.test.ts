import { describe, it, expect, beforeEach, vi } from "vitest";

let mockStudentId: string | null = "student-1";
let createRevisionSpy: ReturnType<typeof vi.fn>;

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
  createRevision: (...args: unknown[]) => createRevisionSpy(...args),
  isOrchestrationError: (r: { error?: unknown }) => r.error !== undefined,
}));

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(
  jobId: string,
  body: unknown
): {
  req: NextRequest;
  context: { params: Promise<{ jobId: string }> };
} {
  return {
    req: new NextRequest(
      `http://localhost/api/student/fabrication/jobs/${jobId}/revisions`,
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
  fileType: "stl",
  originalFilename: "fixed.stl",
  fileSizeBytes: 2048,
};

describe("POST /api/student/fabrication/jobs/[jobId]/revisions", () => {
  beforeEach(() => {
    mockStudentId = "student-1";
    createRevisionSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockStudentId = null;
    const { req, context } = makeRequest("job-1", validBody);
    const res = await POST(req, context);
    expect(res.status).toBe(401);
    expect(createRevisionSpy).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new NextRequest(
      "http://localhost/api/student/fabrication/jobs/job-1/revisions",
      { method: "POST", body: "not json" }
    );
    const res = await POST(req, { params: Promise.resolve({ jobId: "job-1" }) });
    expect(res.status).toBe(400);
  });

  it("passes studentId from auth + jobId from URL (not from body)", async () => {
    createRevisionSpy.mockResolvedValueOnce({
      jobId: "job-1",
      revisionId: "rev-new",
      uploadUrl: "https://x",
      storagePath: "p/v2.stl",
    });
    // Try to spoof studentId/jobId from body — must be ignored.
    const { req, context } = makeRequest("job-abc", {
      ...validBody,
      studentId: "attacker",
      jobId: "other-job",
    });
    await POST(req, context);
    const call = createRevisionSpy.mock.calls[0][1];
    expect(call.studentId).toBe("student-1");
    expect(call.jobId).toBe("job-abc");
  });

  it("returns 200 with full payload on success", async () => {
    createRevisionSpy.mockResolvedValueOnce({
      jobId: "job-1",
      revisionId: "rev-2",
      uploadUrl: "https://stor.example.com/signed",
      storagePath: "fabrication/t/s/job-1/v2.stl",
    });
    const { req, context } = makeRequest("job-1", validBody);
    const res = await POST(req, context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      jobId: "job-1",
      revisionId: "rev-2",
      uploadUrl: "https://stor.example.com/signed",
      storagePath: "fabrication/t/s/job-1/v2.stl",
    });
  });

  it("maps orchestration 404 to 404", async () => {
    createRevisionSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Job not found" },
    });
    const { req, context } = makeRequest("job-1", validBody);
    const res = await POST(req, context);
    expect(res.status).toBe(404);
  });

  it("maps orchestration 413 to 413", async () => {
    createRevisionSpy.mockResolvedValueOnce({
      error: { status: 413, message: "File too big" },
    });
    const { req, context } = makeRequest("job-1", validBody);
    const res = await POST(req, context);
    expect(res.status).toBe(413);
  });

  it("sets Cache-Control: private, no-store", async () => {
    createRevisionSpy.mockResolvedValueOnce({
      jobId: "job-1",
      revisionId: "r",
      uploadUrl: "u",
      storagePath: "p",
    });
    const { req, context } = makeRequest("job-1", validBody);
    const res = await POST(req, context);
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });
});
