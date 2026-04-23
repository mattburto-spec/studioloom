import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Route test for GET /api/student/fabrication/jobs (Phase 6-6i).
 * Orchestration mocked.
 */

let mockStudentId: string | null = "student-1";
let listJobsSpy: ReturnType<typeof vi.fn>;

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
    listStudentJobs: (...args: unknown[]) => listJobsSpy(...args),
  };
});

import { GET } from "../route";
import { NextRequest } from "next/server";

function makeRequest(query = "") {
  return new NextRequest(`http://localhost/api/student/fabrication/jobs${query}`, {
    method: "GET",
  });
}

describe("GET /api/student/fabrication/jobs", () => {
  beforeEach(() => {
    mockStudentId = "student-1";
    listJobsSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockStudentId = null;
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("passes studentId + default limit 100 to listStudentJobs", async () => {
    listJobsSpy.mockResolvedValueOnce({ jobs: [] });
    await GET(makeRequest());
    expect(listJobsSpy).toHaveBeenCalledWith(expect.anything(), {
      studentId: "student-1",
      limit: 100,
    });
  });

  it("parses ?limit= and passes it through", async () => {
    listJobsSpy.mockResolvedValueOnce({ jobs: [] });
    await GET(makeRequest("?limit=25"));
    expect(listJobsSpy).toHaveBeenCalledWith(expect.anything(), {
      studentId: "student-1",
      limit: 25,
    });
  });

  it("rejects bad limit with 400", async () => {
    const res = await GET(makeRequest("?limit=not-a-number"));
    expect(res.status).toBe(400);
  });

  it("returns 200 with the jobs payload on success", async () => {
    const payload = {
      jobs: [
        {
          jobId: "job-1",
          machineLabel: "Bambu X1C",
          machineCategory: "3d_printer",
          unitTitle: "Cube unit",
          className: "10 Design",
          thumbnailUrl: null,
          currentRevision: 1,
          ruleCounts: { block: 0, warn: 0, fyi: 2 },
          jobStatus: "approved",
          createdAt: "2026-04-23T12:00:00Z",
          updatedAt: "2026-04-23T12:00:00Z",
          originalFilename: "cube.stl",
        },
      ],
    };
    listJobsSpy.mockResolvedValueOnce(payload);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
  });

  it("maps orchestration 500 to 500", async () => {
    listJobsSpy.mockResolvedValueOnce({
      error: { status: 500, message: "DB error" },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("sets Cache-Control: private, no-store", async () => {
    listJobsSpy.mockResolvedValueOnce({ jobs: [] });
    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
