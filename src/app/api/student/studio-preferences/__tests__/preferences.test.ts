import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Unit tests for PATCH /api/student/studio-preferences —
 * Preflight 1B-2-5 fabricationNotifyEmail field only.
 *
 * Per Lesson #45, we don't retroactively cover the pre-existing
 * mentor_id / theme_id fields. These tests assert only what this
 * phase added: accept boolean true/false, reject non-boolean,
 * and ensure the value maps to the DB column
 * `students.fabrication_notify_email`.
 */

let mockStudentId: string | null = "student-1";
let updateSpy: ReturnType<typeof vi.fn<(payload: Record<string, unknown>) => void>>;

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
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "students") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        update: (payload: Record<string, unknown>) => ({
          eq: async (_col: string, _val: string) => {
            updateSpy(payload);
            return { error: null };
          },
        }),
      };
    },
  }),
}));

import { PATCH } from "../route";
import { NextRequest, NextResponse } from "next/server";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/student/studio-preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/student/studio-preferences — fabricationNotifyEmail (1B-2-5)", () => {
  beforeEach(() => {
    mockStudentId = "student-1";
    updateSpy = vi.fn();
  });

  it("returns 401 when student is not authenticated", async () => {
    mockStudentId = null;
    const res = await PATCH(makeRequest({ fabricationNotifyEmail: false }));
    expect(res.status).toBe(401);
  });

  it("rejects non-boolean fabricationNotifyEmail with 400", async () => {
    const res = await PATCH(
      makeRequest({ fabricationNotifyEmail: "false" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/boolean/i);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("accepts fabricationNotifyEmail: true and writes fabrication_notify_email column", async () => {
    const res = await PATCH(makeRequest({ fabricationNotifyEmail: true }));
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][0]).toEqual({
      fabrication_notify_email: true,
    });
  });

  it("accepts fabricationNotifyEmail: false and writes fabrication_notify_email column", async () => {
    const res = await PATCH(makeRequest({ fabricationNotifyEmail: false }));
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy.mock.calls[0][0]).toEqual({
      fabrication_notify_email: false,
    });
  });
});
