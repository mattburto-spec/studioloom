import { describe, it, expect, beforeEach, vi } from "vitest";

let mockTeacherId: string | null = "teacher-1";
let ownsClass = true;
let existingEnrollment:
  | { support_settings: unknown }
  | null = { support_settings: {} };
let updateSpy: ReturnType<typeof vi.fn<(payload: Record<string, unknown>) => void>>;
let resolveSpy: ReturnType<typeof vi.fn<() => Promise<unknown>>>;

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
      return {
        select: () => {
          const chain = {
            eq: () => chain,
            maybeSingle: async () => ({ data: existingEnrollment, error: null }),
          };
          return chain;
        },
        update: (payload: Record<string, unknown>) => {
          updateSpy(payload);
          // Awaitable chain: .eq().eq() resolves to { error: null }
          // Each .eq() returns an object that is BOTH chainable (more .eq()) AND thenable (final await).
          const makeChain = (): unknown => {
            const chain: Record<string, unknown> = {
              eq: () => makeChain(),
              then: (onFulfilled: (val: { error: null }) => unknown) =>
                Promise.resolve({ error: null }).then(onFulfilled),
            };
            return chain;
          };
          return makeChain();
        },
      };
    },
  }),
}));

vi.mock("@/lib/student-support/resolve-settings", () => ({
  resolveStudentSettings: async (...args: unknown[]) => {
    resolveSpy();
    return {
      l1Target: "zh",
      tapAWordEnabled: true,
      l1Source: "class-override",
      tapASource: "default",
    };
  },
}));

import { PATCH } from "../route";
import { NextRequest } from "next/server";

function makeReq(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost/api/teacher/classes/c1/students/s1/support-settings",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

const CTX = { params: Promise.resolve({ classId: "c1", studentId: "s1" }) };

describe("PATCH /api/teacher/classes/[classId]/students/[studentId]/support-settings", () => {
  beforeEach(() => {
    mockTeacherId = "teacher-1";
    ownsClass = true;
    existingEnrollment = { support_settings: {} };
    updateSpy = vi.fn();
    resolveSpy = vi.fn();
  });

  it("401 when teacher not authenticated", async () => {
    mockTeacherId = null;
    const res = await PATCH(makeReq({ l1_target_override: "zh" }), CTX);
    expect(res.status).toBe(401);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("403 when teacher doesn't own the class", async () => {
    ownsClass = false;
    const res = await PATCH(makeReq({ l1_target_override: "zh" }), CTX);
    expect(res.status).toBe(403);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("400 when body is invalid JSON", async () => {
    const req = new NextRequest(
      "http://localhost/api/teacher/classes/c1/students/s1/support-settings",
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "not json" }
    );
    const res = await PATCH(req, CTX);
    expect(res.status).toBe(400);
  });

  it("400 when body has no recognised override fields", async () => {
    const res = await PATCH(makeReq({ random_field: "x" }), CTX);
    expect(res.status).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("404 when student is not enrolled in this class", async () => {
    existingEnrollment = null;
    const res = await PATCH(makeReq({ l1_target_override: "zh" }), CTX);
    expect(res.status).toBe(404);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("merges incoming settings with existing (partial update preserves other fields)", async () => {
    existingEnrollment = {
      support_settings: { l1_target_override: "ko", tap_a_word_enabled: false },
    };
    const res = await PATCH(makeReq({ l1_target_override: "zh" }), CTX);
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith({
      support_settings: { l1_target_override: "zh", tap_a_word_enabled: false },
    });
  });

  it("returns the resolved settings after merge", async () => {
    const res = await PATCH(makeReq({ l1_target_override: "zh" }), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.resolved.l1Target).toBe("zh");
    expect(resolveSpy).toHaveBeenCalled();
  });

  it("response carries Cache-Control: private", async () => {
    const res = await PATCH(makeReq({ l1_target_override: "zh" }), CTX);
    expect(res.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate"
    );
  });

  it("strips garbage values from incoming body via parseSupportSettings", async () => {
    const res = await PATCH(
      makeReq({ l1_target_override: "klingon", tap_a_word_enabled: "yes" }),
      CTX
    );
    // Both fields invalid → parseSupportSettings returns {} → 400
    expect(res.status).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("explicit null DELETES the key from JSONB (Bug 3, 28 Apr 2026)", async () => {
    existingEnrollment = {
      support_settings: { l1_target_override: "ko", tap_a_word_enabled: false },
    };
    const res = await PATCH(makeReq({ l1_target_override: null }), CTX);
    expect(res.status).toBe(200);
    // Pre-Bug-3 this stored {l1_target_override: null, tap_a_word_enabled: false}.
    // Now mergeSupportSettingsForWrite deletes the reset key entirely so the
    // JSONB stays clean. Resolver behaviour is identical (null and missing-key
    // both fall through), but stored shape matches teacher intent.
    expect(updateSpy).toHaveBeenCalledWith({
      support_settings: { tap_a_word_enabled: false },
    });
  });
});
