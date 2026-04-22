import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Route-level integration test for POST /api/student/fabrication/upload.
 *
 * Mocks requireStudentAuth + the orchestration layer so we exercise only
 * the route handler's responsibilities: body parse, header hygiene,
 * auth-gated dispatch, error → status mapping. The orchestration lib
 * itself is covered by `src/lib/fabrication/__tests__/orchestration.test.ts`.
 */

let mockStudentId: string | null = "student-f24ff3a8";
let createUploadJobSpy: ReturnType<typeof vi.fn>;

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

vi.mock("@/lib/fabrication/orchestration", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fabrication/orchestration")>(
    "@/lib/fabrication/orchestration"
  );
  return {
    ...actual,
    createUploadJob: (...args: unknown[]) => createUploadJobSpy(...args),
  };
});

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/student/fabrication/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  classId: "7c534538-c047-4753-b250-d0bd082c8131",
  machineProfileId: "46bdc2cc-01f5-4e2b-86fd-47e8a4af1288",
  fileType: "stl",
  originalFilename: "cube.stl",
  fileSizeBytes: 1024,
};

describe("POST /api/student/fabrication/upload", () => {
  beforeEach(() => {
    mockStudentId = "student-f24ff3a8";
    createUploadJobSpy = vi.fn();
  });

  it("returns 401 when student is not authenticated", async () => {
    mockStudentId = null;
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    expect(createUploadJobSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when body is not JSON", async () => {
    const req = new NextRequest("http://localhost/api/student/fabrication/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid JSON/);
  });

  it("returns 400 on validation failure (bad fileType)", async () => {
    const res = await POST(
      makeRequest({ ...validBody, fileType: "pdf", originalFilename: "x.pdf" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/fileType/);
    expect(createUploadJobSpy).not.toHaveBeenCalled();
  });

  it("returns 413 when fileSizeBytes exceeds 50 MB", async () => {
    const res = await POST(
      makeRequest({ ...validBody, fileSizeBytes: 50 * 1024 * 1024 + 1 })
    );
    expect(res.status).toBe(413);
  });

  it("sets Cache-Control: private, no-store on success responses", async () => {
    createUploadJobSpy.mockResolvedValueOnce({
      jobId: "job-1",
      revisionId: "rev-1",
      uploadUrl: "https://stor.example.com/signed",
      storagePath: "fabrication/t/s/job-1/v1.stl",
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("sets Cache-Control: private, no-store on error responses (Lesson #11)", async () => {
    const res = await POST(makeRequest({ ...validBody, fileType: "pdf", originalFilename: "x.pdf" }));
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("passes studentId from auth (not body) into createUploadJob", async () => {
    createUploadJobSpy.mockResolvedValueOnce({
      jobId: "job-1",
      revisionId: "rev-1",
      uploadUrl: "https://x",
      storagePath: "p",
    });
    // Attempt to spoof studentId via body — must be ignored.
    await POST(makeRequest({ ...validBody, studentId: "attacker-id" }));
    expect(createUploadJobSpy).toHaveBeenCalledTimes(1);
    const call = createUploadJobSpy.mock.calls[0][1];
    expect(call.studentId).toBe("student-f24ff3a8");
    expect(call.studentId).not.toBe("attacker-id");
  });

  it("maps orchestration 403 to 403", async () => {
    createUploadJobSpy.mockResolvedValueOnce({
      error: { status: 403, message: "Not enrolled in this class" },
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Not enrolled in this class");
  });

  it("maps orchestration 404 to 404", async () => {
    createUploadJobSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Machine profile not found" },
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
  });

  it("maps orchestration 500 to 500", async () => {
    createUploadJobSpy.mockResolvedValueOnce({
      error: { status: 500, message: "Job insert failed: db down" },
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });

  it("returns full success payload with all 4 fields", async () => {
    createUploadJobSpy.mockResolvedValueOnce({
      jobId: "job-abc",
      revisionId: "rev-xyz",
      uploadUrl: "https://stor.example.com/signed?token=abc",
      storagePath: "fabrication/t1/s1/job-abc/v1.stl",
    });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      jobId: "job-abc",
      revisionId: "rev-xyz",
      uploadUrl: "https://stor.example.com/signed?token=abc",
      storagePath: "fabrication/t1/s1/job-abc/v1.stl",
    });
  });
});
