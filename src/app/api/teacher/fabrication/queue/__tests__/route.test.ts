import { describe, it, expect, beforeEach, vi } from "vitest";

let mockTeacherId: string | null = "teacher-1";
let queueSpy: ReturnType<typeof vi.fn>;

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

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/fabrication/teacher-orchestration", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fabrication/teacher-orchestration")>(
    "@/lib/fabrication/teacher-orchestration"
  );
  return {
    ...actual,
    getTeacherQueue: (...args: unknown[]) => queueSpy(...args),
  };
});

import { GET } from "../route";
import { NextRequest } from "next/server";

function makeRequest(search: string = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/teacher/fabrication/queue${search}`,
    { method: "GET" }
  );
}

describe("GET /api/teacher/fabrication/queue", () => {
  beforeEach(() => {
    mockTeacherId = "teacher-1";
    queueSpy = vi.fn();
  });

  it("returns 401 when unauthenticated", async () => {
    mockTeacherId = null;
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(queueSpy).not.toHaveBeenCalled();
  });

  it("calls getTeacherQueue with teacherId from auth + no filter when status absent", async () => {
    queueSpy.mockResolvedValueOnce({ total: 0, rows: [] });
    await GET(makeRequest());
    expect(queueSpy).toHaveBeenCalledWith(
      expect.anything(),
      { teacherId: "teacher-1", statuses: undefined, limit: 50, offset: 0 }
    );
  });

  it("parses single-value status filter", async () => {
    queueSpy.mockResolvedValueOnce({ total: 0, rows: [] });
    await GET(makeRequest("?status=pending_approval"));
    const call = queueSpy.mock.calls[0][1];
    expect(call.statuses).toEqual(["pending_approval"]);
  });

  it("parses comma-separated status filter", async () => {
    queueSpy.mockResolvedValueOnce({ total: 0, rows: [] });
    await GET(makeRequest("?status=approved,picked_up"));
    const call = queueSpy.mock.calls[0][1];
    expect(call.statuses).toEqual(["approved", "picked_up"]);
  });

  it("returns 400 for unknown status value", async () => {
    const res = await GET(makeRequest("?status=banana"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown status/);
    expect(queueSpy).not.toHaveBeenCalled();
  });

  it("parses limit + offset integers", async () => {
    queueSpy.mockResolvedValueOnce({ total: 0, rows: [] });
    await GET(makeRequest("?limit=10&offset=20"));
    const call = queueSpy.mock.calls[0][1];
    expect(call.limit).toBe(10);
    expect(call.offset).toBe(20);
  });

  it("returns 400 for non-integer limit/offset", async () => {
    const res = await GET(makeRequest("?limit=abc"));
    expect(res.status).toBe(400);
  });

  it("returns 200 with full payload on success", async () => {
    const payload = {
      total: 3,
      rows: [{ jobId: "job-1", studentName: "Kai" }],
    };
    queueSpy.mockResolvedValueOnce(payload);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
  });

  it("maps orchestration 500 to 500", async () => {
    queueSpy.mockResolvedValueOnce({
      error: { status: 500, message: "db down" },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("sets Cache-Control: private, no-store", async () => {
    queueSpy.mockResolvedValueOnce({ total: 0, rows: [] });
    const res = await GET(makeRequest());
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });
});
