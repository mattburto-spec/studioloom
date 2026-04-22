import { describe, it, expect, beforeEach, vi } from "vitest";

let mockTeacherId: string | null = "teacher-1";
let detailSpy: ReturnType<typeof vi.fn>;

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

vi.mock("@/lib/fabrication/teacher-orchestration", () => ({
  getTeacherJobDetail: (...args: unknown[]) => detailSpy(...args),
}));

import { GET } from "../route";
import { NextRequest } from "next/server";

function makeRequest(jobId: string) {
  return {
    req: new NextRequest(
      `http://localhost/api/teacher/fabrication/jobs/${jobId}`,
      { method: "GET" }
    ),
    context: { params: Promise.resolve({ jobId }) },
  };
}

describe("GET /api/teacher/fabrication/jobs/[jobId]", () => {
  beforeEach(() => {
    mockTeacherId = "teacher-1";
    detailSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockTeacherId = null;
    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);
    expect(res.status).toBe(401);
  });

  it("passes teacherId + jobId to getTeacherJobDetail", async () => {
    detailSpy.mockResolvedValueOnce({
      job: { id: "job-1" },
      student: {},
      machine: {},
      revisions: [],
    });
    const { req, context } = makeRequest("job-xyz");
    await GET(req, context);
    expect(detailSpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
      jobId: "job-xyz",
    });
  });

  it("returns 200 with full payload on success", async () => {
    const payload = {
      job: { id: "job-1", status: "pending_approval" },
      student: { id: "s1", name: "Kai" },
      machine: { id: "m1", name: "Bambu X1C", category: "3d_printer" },
      classInfo: null,
      unit: null,
      currentRevisionData: null,
      acknowledgedWarnings: null,
      revisions: [],
    };
    detailSpy.mockResolvedValueOnce(payload);
    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
  });

  it("maps orchestration 404 to 404", async () => {
    detailSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Job not found" },
    });
    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);
    expect(res.status).toBe(404);
  });

  it("sets Cache-Control: private, no-store", async () => {
    detailSpy.mockResolvedValueOnce({
      job: {},
      student: {},
      machine: {},
      revisions: [],
    });
    const { req, context } = makeRequest("job-1");
    const res = await GET(req, context);
    expect(res.headers.get("Cache-Control")).toContain("private");
  });
});
