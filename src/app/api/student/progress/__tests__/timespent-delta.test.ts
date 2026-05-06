import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * POST /api/student/progress — `timeSpentDelta` increment behaviour.
 *
 * Round 20 (6 May 2026 PM) — client autosave now sends a per-save delta
 * of active-tab seconds. The route must add this to the existing
 * student_progress.time_spent value (not replace it, which is what the
 * old `timeSpent` absolute path did).
 *
 * Locks the contract:
 *   - delta is added to the prior column value
 *   - delta of 0 / negative / NaN is a no-op
 *   - delta is clamped at 1 hour per save (defends against clock skew)
 *   - existing `timeSpent` (absolute) path still works for back-compat
 */

// ─────────────────────────────────────────────────────────────────────────
// Mock state
// ─────────────────────────────────────────────────────────────────────────

let mockUpsertResult: { id: string; time_spent: number } = {
  id: "progress-row-1",
  time_spent: 100,
};

const upsertSpy = vi.fn();
const updateSpy = vi.fn();
let lastUpdatePayload: Record<string, unknown> | null = null;

vi.mock("@/lib/access-v2/actor-session", () => ({
  requireStudentSession: async () => ({ studentId: "student-1" }),
}));

vi.mock("@/lib/api/error-handler", () => ({
  withErrorHandler: (
    _name: string,
    fn: (req: unknown) => Promise<unknown>
  ) => fn,
}));

vi.mock("@/lib/notifications/dispatch-integrity-alerts", () => ({
  dispatchIntegrityAlerts: async () => {},
}));

vi.mock("@/lib/content-safety/moderate-and-log", () => ({
  moderateAndLog: async () => ({
    result: { moderation: { status: "ok", flags: [] } },
  }),
}));

vi.mock("@/lib/supabase/admin", () => {
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === "class_students") {
          return {
            select: () => ({
              eq: () => ({
                eq: async () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === "students") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { class_id: null }, error: null }),
              }),
            }),
          };
        }
        if (table === "class_units") {
          return {
            select: () => ({
              in: () => ({
                eq: () => ({
                  eq: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "student_progress") {
          return {
            upsert: (payload: Record<string, unknown>) => {
              upsertSpy(payload);
              return {
                select: () => ({
                  single: async () => ({
                    data: { ...mockUpsertResult },
                    error: null,
                  }),
                }),
              };
            },
            update: (payload: Record<string, unknown>) => {
              updateSpy(payload);
              lastUpdatePayload = payload;
              return {
                eq: async () => ({ data: null, error: null }),
              };
            },
          };
        }
        return {} as never;
      },
    }),
  };
});

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/student/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  upsertSpy.mockClear();
  updateSpy.mockClear();
  lastUpdatePayload = null;
  mockUpsertResult = { id: "progress-row-1", time_spent: 100 };
});

describe("POST /api/student/progress — timeSpentDelta", () => {
  it("adds delta to existing time_spent (100 + 30 = 130)", async () => {
    const res = await POST(
      makeReq({
        unitId: "unit-1",
        pageId: "lesson-1",
        timeSpentDelta: 30,
      })
    );
    expect((res as Response).status).toBe(200);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(lastUpdatePayload).toEqual({ time_spent: 130 });
  });

  it("treats null/missing existing time_spent as 0", async () => {
    mockUpsertResult = {
      id: "progress-row-1",
      time_spent: null as unknown as number,
    };
    const res = await POST(
      makeReq({
        unitId: "unit-1",
        pageId: "lesson-1",
        timeSpentDelta: 12,
      })
    );
    expect((res as Response).status).toBe(200);
    expect(lastUpdatePayload).toEqual({ time_spent: 12 });
  });

  it("ignores zero delta", async () => {
    await POST(
      makeReq({
        unitId: "unit-1",
        pageId: "lesson-1",
        timeSpentDelta: 0,
      })
    );
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("ignores negative delta (clock skew defence)", async () => {
    await POST(
      makeReq({
        unitId: "unit-1",
        pageId: "lesson-1",
        timeSpentDelta: -50,
      })
    );
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("ignores non-finite delta (NaN, Infinity)", async () => {
    await POST(
      makeReq({
        unitId: "unit-1",
        pageId: "lesson-1",
        timeSpentDelta: "lots" as unknown as number,
      })
    );
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("clamps each save to 1 hour to defend against laptop-sleep dumps", async () => {
    await POST(
      makeReq({
        unitId: "unit-1",
        pageId: "lesson-1",
        timeSpentDelta: 9999,
      })
    );
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(lastUpdatePayload).toEqual({ time_spent: 100 + 3600 });
  });

  it("fractional delta is rounded to the nearest second", async () => {
    await POST(
      makeReq({
        unitId: "unit-1",
        pageId: "lesson-1",
        timeSpentDelta: 2.6,
      })
    );
    expect(lastUpdatePayload).toEqual({ time_spent: 103 });
  });

  it("absolute timeSpent path still works (back-compat)", async () => {
    await POST(
      makeReq({
        unitId: "unit-1",
        pageId: "lesson-1",
        timeSpent: 999, // absolute
      })
    );
    // upsertSpy should have time_spent in the payload
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const payload = upsertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.time_spent).toBe(999);
    // No follow-up update (no delta path)
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
