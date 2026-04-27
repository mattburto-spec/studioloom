import { describe, it, expect, beforeEach, vi } from "vitest";

let mockTeacherId: string | null = "teacher-1";
let ownsClass = true;
let existingEnrollments: Array<{ student_id: string; support_settings: unknown }> = [
  { student_id: "s1", support_settings: {} },
  { student_id: "s2", support_settings: { tap_a_word_enabled: false } },
];
let updateCalls: Array<{ studentId: string; payload: Record<string, unknown> }>;

vi.mock("@/lib/auth/verify-teacher-unit", () => ({
  requireTeacherAuth: async () => {
    if (!mockTeacherId) {
      return {
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      };
    }
    return { teacherId: mockTeacherId };
  },
  verifyTeacherOwnsClass: async () => ownsClass,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "class_students") {
        throw new Error(`Unexpected table: ${table}`);
      }
      // Track current targeted student_id across the .eq() chain on update()
      let currentStudentId: string | null = null;
      return {
        select: () => {
          const chain = {
            eq: () => chain,
            in: () => chain,
            // also resolves on final .eq().eq() for plain selects
            then: (onFulfilled: (val: unknown) => unknown) =>
              Promise.resolve({ data: existingEnrollments, error: null }).then(onFulfilled),
            maybeSingle: async () => ({ data: null, error: null }),
          };
          return chain;
        },
        update: (payload: Record<string, unknown>) => {
          const chain: Record<string, unknown> = {
            eq: (col: string, val: unknown) => {
              if (col === "student_id") currentStudentId = val as string;
              const stage: Record<string, unknown> = {
                eq: (col2: string, val2: unknown) => {
                  if (col2 === "student_id") currentStudentId = val2 as string;
                  // Final eq — record + resolve
                  if (currentStudentId) {
                    updateCalls.push({ studentId: currentStudentId, payload });
                  }
                  return Promise.resolve({ error: null });
                },
                then: (onFulfilled: (val: { error: null }) => unknown) => {
                  if (currentStudentId) {
                    updateCalls.push({ studentId: currentStudentId, payload });
                  }
                  return Promise.resolve({ error: null }).then(onFulfilled);
                },
              };
              return stage;
            },
          };
          return chain;
        },
      };
    },
  }),
}));

import { PATCH, GET } from "../route";
import { NextRequest } from "next/server";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/teacher/classes/c1/students/support-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const CTX = { params: Promise.resolve({ classId: "c1" }) };

describe("PATCH /api/teacher/classes/[classId]/students/support-settings (bulk)", () => {
  beforeEach(() => {
    mockTeacherId = "teacher-1";
    ownsClass = true;
    existingEnrollments = [
      { student_id: "s1", support_settings: {} },
      { student_id: "s2", support_settings: { tap_a_word_enabled: false } },
    ];
    updateCalls = [];
  });

  it("401 when teacher not authenticated", async () => {
    mockTeacherId = null;
    const res = await PATCH(makeReq({ studentIds: ["s1"], settings: { tap_a_word_enabled: true } }), CTX);
    expect(res.status).toBe(401);
  });

  it("403 when teacher doesn't own the class", async () => {
    ownsClass = false;
    const res = await PATCH(makeReq({ studentIds: ["s1"], settings: { tap_a_word_enabled: true } }), CTX);
    expect(res.status).toBe(403);
  });

  it("400 when studentIds is missing or empty", async () => {
    const res1 = await PATCH(makeReq({ settings: { tap_a_word_enabled: true } }), CTX);
    expect(res1.status).toBe(400);
    const res2 = await PATCH(makeReq({ studentIds: [], settings: { tap_a_word_enabled: true } }), CTX);
    expect(res2.status).toBe(400);
  });

  it("400 when settings has no recognised fields", async () => {
    const res = await PATCH(makeReq({ studentIds: ["s1"], settings: { unknown: 1 } }), CTX);
    expect(res.status).toBe(400);
  });

  it("400 when studentIds exceeds 200", async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `s${i}`);
    const res = await PATCH(makeReq({ studentIds: ids, settings: { tap_a_word_enabled: true } }), CTX);
    expect(res.status).toBe(400);
  });

  it("applies the partial settings to each enrolled student (merges with existing)", async () => {
    const res = await PATCH(
      makeReq({ studentIds: ["s1", "s2"], settings: { l1_target_override: "zh" } }),
      CTX
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(2);
    expect(body.failed).toBe(0);
    expect(updateCalls.length).toBe(2);
    // s1 had no prior settings — gets just the new field
    expect(updateCalls.find((c) => c.studentId === "s1")?.payload).toEqual({
      support_settings: { l1_target_override: "zh" },
    });
    // s2 had tap_a_word_enabled: false — should be merged, not overwritten
    expect(updateCalls.find((c) => c.studentId === "s2")?.payload).toEqual({
      support_settings: { tap_a_word_enabled: false, l1_target_override: "zh" },
    });
  });

  it("reports per-student failure when student is not enrolled in the class", async () => {
    existingEnrollments = [{ student_id: "s1", support_settings: {} }]; // s2 not enrolled
    const res = await PATCH(
      makeReq({ studentIds: ["s1", "s2"], settings: { tap_a_word_enabled: false } }),
      CTX
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toBe(1);
    expect(body.failed).toBe(1);
    const failed = body.results.find((r: { studentId: string }) => r.studentId === "s2");
    expect(failed.ok).toBe(false);
    expect(failed.error).toMatch(/not enrolled/);
  });

  it("response carries Cache-Control: private", async () => {
    const res = await PATCH(
      makeReq({ studentIds: ["s1"], settings: { tap_a_word_enabled: true } }),
      CTX
    );
    expect(res.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate"
    );
  });
});
