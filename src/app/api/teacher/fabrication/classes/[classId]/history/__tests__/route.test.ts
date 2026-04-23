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
  getTeacherClassHistory: (...args: unknown[]) => historySpy(...args),
}));

import { GET } from "../route";
import { NextRequest } from "next/server";

function makeRequest(classId: string) {
  return {
    req: new NextRequest(
      `http://localhost/api/teacher/fabrication/classes/${classId}/history`,
      { method: "GET" }
    ),
    context: { params: Promise.resolve({ classId }) },
  };
}

describe("GET /api/teacher/fabrication/classes/[classId]/history", () => {
  beforeEach(() => {
    mockTeacherId = "teacher-1";
    historySpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockTeacherId = null;
    const { req, context } = makeRequest("class-1");
    const res = await GET(req, context);
    expect(res.status).toBe(401);
  });

  it("passes teacherId + classId to getTeacherClassHistory", async () => {
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
      perStudent: [],
    });
    const { req, context } = makeRequest("class-xyz");
    await GET(req, context);
    expect(historySpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
      classId: "class-xyz",
    });
  });

  it("returns 200 with perStudent populated on class scope", async () => {
    const payload = {
      jobs: [],
      summary: {
        totalSubmissions: 2,
        passed: 1,
        passRate: 0.5,
        avgRevisions: 1.5,
        medianRevisions: 1.5,
        topFailureRule: { ruleId: "R-STL-01", count: 1 },
      },
      perStudent: [
        {
          studentId: "s1",
          studentName: "Kai",
          totalJobs: 1,
          passed: 1,
          passRate: 1,
          latestJobStatus: "approved",
          latestJobCreatedAt: "2026-04-22T12:00:00Z",
        },
      ],
    };
    historySpy.mockResolvedValueOnce(payload);
    const { req, context } = makeRequest("class-1");
    const res = await GET(req, context);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.perStudent).toHaveLength(1);
    expect(body.perStudent[0].studentName).toBe("Kai");
  });

  it("maps orchestration 500 to 500", async () => {
    historySpy.mockResolvedValueOnce({
      error: { status: 500, message: "DB error" },
    });
    const { req, context } = makeRequest("class-1");
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
      perStudent: [],
    });
    const { req, context } = makeRequest("class-1");
    const res = await GET(req, context);
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
