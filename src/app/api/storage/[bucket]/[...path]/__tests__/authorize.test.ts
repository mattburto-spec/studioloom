/**
 * Tests for the per-bucket authorization helper.
 *
 * Original (9 May 2026) — closes the IDOR caught by Gemini external review.
 * S5 update (9 May 2026) — F-11: tightens unit-images + knowledge-media
 * from "any authenticated user" to per-resource scoping.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";

// ─── Mock state ─────────────────────────────────────────────────────────

type Fixture<T> = T | null;

let studentRow: Fixture<{ id: string; school_id?: string | null }> = null;
let profileRow: Fixture<{ is_platform_admin: boolean }> = null;
let teacherRow: Fixture<{ school_id?: string | null }> = null;
let classUnitsRows: Array<{ class_id: string }> = [];
let enrollmentRow: Fixture<{ class_id: string }> = null;
let teacherCanManage = false;
let teacherHasUnit = false;

// Captured-table-by-table mock. Each table exposes the chain method shape
// used by authorize.ts. Some tables need .in() and .limit() in the chain.
// Extracted as a named function so beforeEach can re-install it after any
// test that overrides via mockImplementation.
function defaultFromImpl(table: string) {
  switch (table) {
    case "students":
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: studentRow }),
          }),
        }),
      };
    case "user_profiles":
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: profileRow }),
          }),
        }),
      };
    case "teachers":
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: teacherRow }),
          }),
        }),
      };
    case "class_units":
      return {
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: classUnitsRows }),
          }),
        }),
      };
    case "class_students":
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              in: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: enrollmentRow }),
                }),
              }),
            }),
          }),
        }),
      };
    default:
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      };
  }
}

const fromMock = vi.fn(defaultFromImpl);

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/auth/verify-teacher-unit", () => ({
  verifyTeacherCanManageStudent: vi.fn(async () => teacherCanManage),
  verifyTeacherHasUnit: vi.fn(async () => ({
    hasAccess: teacherHasUnit,
    isAuthor: false,
    classIds: [] as string[],
  })),
}));

import { authorizeBucketAccess } from "../authorize";

// ─── Test fixtures ──────────────────────────────────────────────────────

const STUDENT_A_UUID = "11111111-1111-1111-1111-111111111111";
const STUDENT_B_UUID = "22222222-2222-2222-2222-222222222222";
const TEACHER_UUID = "33333333-3333-3333-3333-333333333333";
const ADMIN_UUID = "44444444-4444-4444-4444-444444444444";
const UNIT_UUID = "55555555-5555-5555-5555-555555555555";
const CLASS_UUID = "66666666-6666-6666-6666-666666666666";
const SCHOOL_A_UUID = "77777777-7777-7777-7777-777777777777";
const SCHOOL_B_UUID = "88888888-8888-8888-8888-888888888888";
const OWNER_TEACHER_UUID = "99999999-9999-9999-9999-999999999999";

function asUser(
  id: string,
  appMeta: Record<string, unknown> = {},
): User {
  return {
    id,
    app_metadata: appMeta,
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as unknown as User;
}

beforeEach(() => {
  studentRow = null;
  profileRow = null;
  teacherRow = null;
  classUnitsRows = [];
  enrollmentRow = null;
  teacherCanManage = false;
  teacherHasUnit = false;
  // Reset BOTH call history AND any per-test mockImplementation overrides
  // (the cross-school knowledge-media test installs a stateful per-call
  // implementation that would otherwise bleed into subsequent tests).
  fromMock.mockReset();
  fromMock.mockImplementation(defaultFromImpl);
});

// ═══════════════════════════════════════════════════════════════════════
// unit-images bucket — S5 / F-11 scoping
// ═══════════════════════════════════════════════════════════════════════

describe("authorizeBucketAccess — unit-images bucket (S5 F-11)", () => {
  it("rejects malformed path (non-UUID first segment)", async () => {
    const result = await authorizeBucketAccess(
      asUser("u", { user_type: "teacher" }),
      "unit-images",
      "not-a-uuid/x.jpg",
    );
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("malformed_path");
  });

  it("allows platform admin regardless of unit ownership", async () => {
    profileRow = { is_platform_admin: true };
    const result = await authorizeBucketAccess(
      asUser(ADMIN_UUID, {}),
      "unit-images",
      `${UNIT_UUID}/x.jpg`,
    );
    expect(result.ok).toBe(true);
  });

  it("allows a teacher who has the unit (verifyTeacherHasUnit: true)", async () => {
    teacherHasUnit = true;
    const result = await authorizeBucketAccess(
      asUser(TEACHER_UUID, { user_type: "teacher" }),
      "unit-images",
      `${UNIT_UUID}/x.jpg`,
    );
    expect(result.ok).toBe(true);
  });

  it("REJECTS a teacher who does NOT have the unit", async () => {
    teacherHasUnit = false;
    const result = await authorizeBucketAccess(
      asUser(TEACHER_UUID, { user_type: "teacher" }),
      "unit-images",
      `${UNIT_UUID}/x.jpg`,
    );
    expect(result.ok).toBe(false);
  });

  it("allows a student enrolled in a class with the unit assigned", async () => {
    studentRow = { id: STUDENT_A_UUID };
    classUnitsRows = [{ class_id: CLASS_UUID }];
    enrollmentRow = { class_id: CLASS_UUID };
    const result = await authorizeBucketAccess(
      asUser("auth-uid-a", { user_type: "student" }),
      "unit-images",
      `${UNIT_UUID}/x.jpg`,
    );
    expect(result.ok).toBe(true);
  });

  it("REJECTS a student NOT enrolled in any class with this unit", async () => {
    studentRow = { id: STUDENT_A_UUID };
    classUnitsRows = [{ class_id: CLASS_UUID }];
    enrollmentRow = null; // no matching enrollment
    const result = await authorizeBucketAccess(
      asUser("auth-uid-a", { user_type: "student" }),
      "unit-images",
      `${UNIT_UUID}/x.jpg`,
    );
    expect(result.ok).toBe(false);
  });

  it("REJECTS a student when the unit is unassigned to any class", async () => {
    studentRow = { id: STUDENT_A_UUID };
    classUnitsRows = []; // unit not in any class
    const result = await authorizeBucketAccess(
      asUser("auth-uid-a", { user_type: "student" }),
      "unit-images",
      `${UNIT_UUID}/x.jpg`,
    );
    expect(result.ok).toBe(false);
  });

  it("REJECTS an unknown user_type", async () => {
    const result = await authorizeBucketAccess(
      asUser("rando", {}),
      "unit-images",
      `${UNIT_UUID}/x.jpg`,
    );
    expect(result.ok).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// knowledge-media bucket — S5 / F-11 scoping
// ═══════════════════════════════════════════════════════════════════════

describe("authorizeBucketAccess — knowledge-media bucket (S5 F-11)", () => {
  it("rejects malformed path", async () => {
    const result = await authorizeBucketAccess(
      asUser("u", { user_type: "teacher" }),
      "knowledge-media",
      "not-a-uuid/x.png",
    );
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("malformed_path");
  });

  it("allows the owning teacher (self-access fast-path)", async () => {
    const result = await authorizeBucketAccess(
      asUser(OWNER_TEACHER_UUID, { user_type: "teacher" }),
      "knowledge-media",
      `${OWNER_TEACHER_UUID}/x.png`,
    );
    expect(result.ok).toBe(true);
  });

  it("allows platform admin", async () => {
    profileRow = { is_platform_admin: true };
    teacherRow = { school_id: SCHOOL_A_UUID };
    const result = await authorizeBucketAccess(
      asUser(ADMIN_UUID, {}),
      "knowledge-media",
      `${OWNER_TEACHER_UUID}/x.png`,
    );
    expect(result.ok).toBe(true);
  });

  it("allows a teacher in the same school as the owner", async () => {
    // Owning teacher's row (looked up first)
    teacherRow = { school_id: SCHOOL_A_UUID };
    const result = await authorizeBucketAccess(
      asUser(TEACHER_UUID, { user_type: "teacher" }),
      "knowledge-media",
      `${OWNER_TEACHER_UUID}/x.png`,
    );
    // Note: this test passes because both fromMock("teachers") calls
    // (owner and accessor) return the same teacherRow, so both have
    // school_id = SCHOOL_A_UUID. Real-world the owner's school_id +
    // accessor's school_id are different lookups; the mock just returns
    // the same fixture for both. Acceptable simplification — the logic
    // proven below in REJECTS-different-school is the non-trivial case.
    expect(result.ok).toBe(true);
  });

  it("REJECTS a teacher in a different school from the owner", async () => {
    // To distinguish owner vs accessor: use a per-call fixture switch.
    let callCount = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "teachers") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                callCount++;
                // First call is the owner lookup; second is the accessor.
                if (callCount === 1) return { data: { school_id: SCHOOL_A_UUID } };
                return { data: { school_id: SCHOOL_B_UUID } };
              },
            }),
          }),
        };
      }
      if (table === "user_profiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: profileRow }) }),
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      };
    });
    const result = await authorizeBucketAccess(
      asUser(TEACHER_UUID, { user_type: "teacher" }),
      "knowledge-media",
      `${OWNER_TEACHER_UUID}/x.png`,
    );
    expect(result.ok).toBe(false);
  });

  it("allows a student in the same school as the owner", async () => {
    teacherRow = { school_id: SCHOOL_A_UUID };
    studentRow = { id: STUDENT_A_UUID, school_id: SCHOOL_A_UUID };
    const result = await authorizeBucketAccess(
      asUser("auth-uid-a", { user_type: "student" }),
      "knowledge-media",
      `${OWNER_TEACHER_UUID}/x.png`,
    );
    expect(result.ok).toBe(true);
  });

  it("REJECTS a student in a different school from the owner", async () => {
    teacherRow = { school_id: SCHOOL_A_UUID };
    studentRow = { id: STUDENT_A_UUID, school_id: SCHOOL_B_UUID };
    const result = await authorizeBucketAccess(
      asUser("auth-uid-a", { user_type: "student" }),
      "knowledge-media",
      `${OWNER_TEACHER_UUID}/x.png`,
    );
    expect(result.ok).toBe(false);
  });

  it("REJECTS when the owning teacher has no school_id (orphan teacher)", async () => {
    teacherRow = { school_id: null };
    studentRow = { id: STUDENT_A_UUID, school_id: SCHOOL_A_UUID };
    const result = await authorizeBucketAccess(
      asUser("auth-uid-a", { user_type: "student" }),
      "knowledge-media",
      `${OWNER_TEACHER_UUID}/x.png`,
    );
    expect(result.ok).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// responses bucket — pre-S5 (unchanged behaviour)
// ═══════════════════════════════════════════════════════════════════════

describe("authorizeBucketAccess — responses bucket, student session", () => {
  it("allows a student to read their own path", async () => {
    studentRow = { id: STUDENT_A_UUID };
    const result = await authorizeBucketAccess(
      asUser("auth-uid-a", { user_type: "student" }),
      "responses",
      `${STUDENT_A_UUID}/avatar/img.jpg`,
    );
    expect(result.ok).toBe(true);
  });

  it("REJECTS a student trying to read another student's path", async () => {
    studentRow = { id: STUDENT_A_UUID };
    const result = await authorizeBucketAccess(
      asUser("auth-uid-a", { user_type: "student" }),
      "responses",
      `${STUDENT_B_UUID}/avatar/img.jpg`,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a student session with no students row", async () => {
    studentRow = null;
    const result = await authorizeBucketAccess(
      asUser("orphan-uid", { user_type: "student" }),
      "responses",
      `${STUDENT_A_UUID}/avatar/img.jpg`,
    );
    expect(result.ok).toBe(false);
  });
});

describe("authorizeBucketAccess — responses bucket, teacher session", () => {
  it("allows a teacher who manages the student", async () => {
    teacherCanManage = true;
    const result = await authorizeBucketAccess(
      asUser(TEACHER_UUID, { user_type: "teacher" }),
      "responses",
      `${STUDENT_A_UUID}/work/x.jpg`,
    );
    expect(result.ok).toBe(true);
  });

  it("REJECTS a teacher who does NOT manage the student", async () => {
    teacherCanManage = false;
    const result = await authorizeBucketAccess(
      asUser(TEACHER_UUID, { user_type: "teacher" }),
      "responses",
      `${STUDENT_A_UUID}/work/x.jpg`,
    );
    expect(result.ok).toBe(false);
  });

  it("falls back to platform-admin check for teachers", async () => {
    teacherCanManage = false;
    profileRow = { is_platform_admin: true };
    const result = await authorizeBucketAccess(
      asUser(ADMIN_UUID, { user_type: "teacher" }),
      "responses",
      `${STUDENT_A_UUID}/work/x.jpg`,
    );
    expect(result.ok).toBe(true);
  });
});

describe("authorizeBucketAccess — platform admin (responses)", () => {
  it("allows a platform admin without a typed user_type", async () => {
    profileRow = { is_platform_admin: true };
    const result = await authorizeBucketAccess(
      asUser(ADMIN_UUID, {}),
      "responses",
      `${STUDENT_A_UUID}/work/x.jpg`,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a non-admin without a typed user_type", async () => {
    profileRow = { is_platform_admin: false };
    const result = await authorizeBucketAccess(
      asUser("rando", {}),
      "responses",
      `${STUDENT_A_UUID}/work/x.jpg`,
    );
    expect(result.ok).toBe(false);
  });
});

describe("authorizeBucketAccess — responses path validation", () => {
  it("rejects empty path", async () => {
    const result = await authorizeBucketAccess(
      asUser("u", { user_type: "student" }),
      "responses",
      "",
    );
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("malformed_path");
  });

  it("rejects path that doesn't start with a UUID", async () => {
    const result = await authorizeBucketAccess(
      asUser("u", { user_type: "student" }),
      "responses",
      "not-a-uuid/x.jpg",
    );
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("malformed_path");
  });

  it("rejects mixed-case UUID variants of an owned path", async () => {
    const lowerUuid = "abcdef01-2345-6789-abcd-ef0123456789";
    const upperUuid = lowerUuid.toUpperCase();
    studentRow = { id: lowerUuid };
    const result = await authorizeBucketAccess(
      asUser("u", { user_type: "student" }),
      "responses",
      `${upperUuid}/avatar/x.jpg`,
    );
    expect(result.ok).toBe(false);
  });
});

describe("authorizeBucketAccess — unknown bucket", () => {
  it("rejects unknown buckets defensively", async () => {
    const result = await authorizeBucketAccess(
      asUser("u", { user_type: "student" }),
      "evil-bucket",
      "x.jpg",
    );
    expect(result.ok).toBe(false);
  });
});
