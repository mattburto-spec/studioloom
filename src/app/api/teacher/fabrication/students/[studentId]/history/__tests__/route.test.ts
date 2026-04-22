import { describe, it, expect, beforeEach, vi } from "vitest";

let mockTeacherId: string | null = "teacher-1";
let historySpy: ReturnType<typeof vi.fn>;

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
  getTeacherStudentHistory: (...args: unknown[]) => historySpy(...args),
}));

import { GET } from "../route";
import { NextRequest } from "next/server";

function makeRequest(studentId: string) {
  return {
    req: new NextRequest(
      `http://localhost/api/teacher/fabrication/students/${studentId}/history`,
      { method: "GET" }
    ),
    context: { params: Promise.resolve({ studentId }) },
  };
}

describe("GET /api/teacher/fabrication/students/[studentId]/history", () => {
  beforeEach(() => {
    mockTeacherId = "teacher-1";
    historySpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockTeacherId = null;
    const { req, context } = makeRequest("student-1");
    const res = await GET(req, context);
    expect(res.status).toBe(401);
  });

  it("passes teacherId + studentId to getTeacherStudentHistory", async () => {
    historySpy.mockResolvedValueOnce({
      jobs: [],
      summary: {
        totalSubmissions: 0,
        passed: 0,
        passRate: 0,
        avgRevisions: 0,
        medianRevisions: 0,
        topFailureRule: null,
      },
      perStudent: null,
    });
    const { req, context } = makeRequest("student-xyz");
    await GET(req, context);
    expect(historySpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
      studentId: "student-xyz",
    });
  });

  it("returns 200 with full payload on success", async () => {
    const payload = {
      jobs: [
        {
          jobId: "job-1",
          status: "approved",
          currentRevision: 1,
          createdAt: "2026-04-22T12:00:00Z",
          updatedAt: "2026-04-22T12:00:00Z",
          originalFilename: "cube.stl",
          machineLabel: "Bambu X1C",
          machineCategory: "3d_printer",
          unitTitle: "Cube unit",
          studentId: "s1",
          studentName: "Kai",
          currentRevisionFailingRuleIds: [],
          ruleCounts: { block: 0, warn: 0, fyi: 0 },
        },
      ],
      summary: {
        totalSubmissions: 1,
        passed: 1,
        passRate: 1,
        avgRevisions: 1,
        medianRevisions: 1,
        topFailureRule: null,
      },
      perStudent: null,
    };
    historySpy.mockResolvedValueOnce(payload);
    const { req, context } = makeRequest("student-1");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
  });

  it("maps orchestration 500 to 500", async () => {
    historySpy.mockResolvedValueOnce({
      error: { status: 500, message: "DB error" },
    });
    const { req, context } = makeRequest("student-1");
    const res = await GET(req, context);
    expect(res.status).toBe(500);
  });

  it("sets Cache-Control: private, no-store", async () => {
    historySpy.mockResolvedValueOnce({
      jobs: [],
      summary: {
        totalSubmissions: 0,
        passed: 0,
        passRate: 0,
        avgRevisions: 0,
        medianRevisions: 0,
        topFailureRule: null,
      },
      perStudent: null,
    });
    const { req, context } = makeRequest("student-1");
    const res = await GET(req, context);
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
