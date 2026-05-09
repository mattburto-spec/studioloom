/**
 * S2 (F-5 9 May 2026) — units publish case must gate on verifyTeacherHasUnit.
 *
 * Pre-fix the publish case at src/app/api/teacher/units/route.ts:217-285 had
 * NO ownership check — only `.eq("id", unitId)` on the UPDATE. Combined with
 * the absent role guard at line 33-38 (still bare auth.getUser()), any
 * logged-in teacher AND any logged-in student JWT could send
 * `{action:"publish", unitId:"<any-uuid>"}` and overwrite author_teacher_id
 * to themselves + force-publish another teacher's draft. Horizontal privilege
 * escalation: teacher A → silently steals authorship + publishes teacher B's
 * draft unit.
 *
 * Fix mirrors the unpublish case (line 287-307): verifyTeacherHasUnit before
 * any mutation, return 404 if !hasAccess.
 *
 * Test approach: hybrid.
 *   1. Source-static guards (matches existing route.test.ts pattern) — catch
 *      future drift if anyone removes the gate.
 *   2. Behavioral test — mock the auth + helper layer, send a
 *      cross-teacher publish, assert 404 + UPDATE never reached.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";

// ─── Source-static guards ──────────────────────────────────────────────

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/teacher/units POST publish case — source-static (F-5)", () => {
  it("publish case calls verifyTeacherHasUnit before any UPDATE", () => {
    const publishIdx = src.indexOf('case "publish":');
    const unpublishIdx = src.indexOf('case "unpublish":');
    expect(publishIdx).toBeGreaterThan(0);
    expect(unpublishIdx).toBeGreaterThan(publishIdx);
    const publishBody = src.slice(publishIdx, unpublishIdx);
    const verifyIdx = publishBody.indexOf("verifyTeacherHasUnit(teacherId, unitId)");
    const updateIdx = publishBody.indexOf('.update({');
    expect(verifyIdx).toBeGreaterThan(0);
    expect(updateIdx).toBeGreaterThan(verifyIdx);
  });

  it("publish case returns 404 when !access.hasAccess", () => {
    const publishIdx = src.indexOf('case "publish":');
    const unpublishIdx = src.indexOf('case "unpublish":');
    const publishBody = src.slice(publishIdx, unpublishIdx);
    expect(publishBody).toMatch(/!access\.hasAccess/);
    expect(publishBody).toMatch(/status:\s*404/);
  });

  it("publish case requires unitId (defensive guard)", () => {
    const publishIdx = src.indexOf('case "publish":');
    const unpublishIdx = src.indexOf('case "unpublish":');
    const publishBody = src.slice(publishIdx, unpublishIdx);
    expect(publishBody).toMatch(/if\s*\(!unitId\)/);
    expect(publishBody).toMatch(/unitId required/);
  });
});

// ─── Behavioral test — cross-teacher hijack returns 404 ────────────────

// Default mocks: a logged-in teacher trying to publish someone else's unit.
let mockUserId = "teacher-b-uuid";
let mockHasAccess = false;
let updateCalled = false;
let teacherLookupResult: { data: unknown; error: unknown } = {
  data: { name: "Teacher B" },
  error: null,
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: mockUserId, email: "teacher-b@example.com", app_metadata: { user_type: "teacher" } } },
      })),
    },
  }),
}));

const adminFrom = vi.fn((table: string) => {
  if (table === "teachers" || table === "teacher_profiles") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => teacherLookupResult,
        }),
      }),
    };
  }
  if (table === "units") {
    return {
      update: () => ({
        eq: () => {
          updateCalled = true;
          return Promise.resolve({ error: null });
        },
      }),
    };
  }
  return {
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminFrom }),
}));

vi.mock("@/lib/auth/verify-teacher-unit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/verify-teacher-unit")>(
    "@/lib/auth/verify-teacher-unit",
  );
  return {
    ...actual,
    verifyTeacherHasUnit: vi.fn(async () => ({
      hasAccess: mockHasAccess,
      isAuthor: false,
      classIds: [] as string[],
    })),
  };
});

import { POST } from "../route";

beforeEach(() => {
  mockUserId = "teacher-b-uuid";
  mockHasAccess = false;
  updateCalled = false;
  teacherLookupResult = { data: { name: "Teacher B" }, error: null };
  adminFrom.mockClear();
});

function makePublishRequest(unitId: string) {
  return new NextRequest("http://localhost/api/teacher/units", {
    method: "POST",
    body: JSON.stringify({ action: "publish", unitId }),
    headers: { "Content-Type": "application/json" },
  });
}

describe("/api/teacher/units POST publish case — behavioral (F-5)", () => {
  it("rejects cross-teacher publish hijack with 404", async () => {
    // Teacher B (mockUserId) is trying to publish teacher A's unit. The
    // verifyTeacherHasUnit mock returns hasAccess: false by default.
    const res = await POST(makePublishRequest("teacher-a-unit-uuid"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Unit not found");
  });

  it("does NOT call units.update when the access check fails", async () => {
    await POST(makePublishRequest("teacher-a-unit-uuid"));
    expect(updateCalled).toBe(false);
  });

  it("rejects publish without a unitId with 400", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/teacher/units", {
        method: "POST",
        body: JSON.stringify({ action: "publish" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("allows publish when the teacher owns the unit (hasAccess: true)", async () => {
    mockHasAccess = true;
    const res = await POST(makePublishRequest("teacher-b-unit-uuid"));
    expect(res.status).toBe(200);
    expect(updateCalled).toBe(true);
  });
});
