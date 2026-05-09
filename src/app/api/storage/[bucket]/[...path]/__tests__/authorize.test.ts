/**
 * Tests for the per-bucket authorization helper (security-plan.md P-3
 * follow-up — closes the IDOR caught by Gemini external review 9 May 2026).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";

// ─── Mocks ──────────────────────────────────────────────────────────────

type StudentRow = { id: string } | null;
type ProfileRow = { is_platform_admin: boolean } | null;

let studentRow: StudentRow = null;
let profileRow: ProfileRow = null;
let teacherCanManage = false;

const fromMock = vi.fn((table: string) => {
  const eqMaybeSingle = async () => {
    if (table === "students") return { data: studentRow };
    if (table === "user_profiles") return { data: profileRow };
    return { data: null };
  };
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: eqMaybeSingle,
      }),
    }),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/auth/verify-teacher-unit", () => ({
  verifyTeacherCanManageStudent: vi.fn(async () => teacherCanManage),
}));

import { authorizeBucketAccess } from "../authorize";

// ─── Test fixtures ──────────────────────────────────────────────────────

const STUDENT_A_UUID = "11111111-1111-1111-1111-111111111111";
const STUDENT_B_UUID = "22222222-2222-2222-2222-222222222222";
const TEACHER_UUID = "33333333-3333-3333-3333-333333333333";
const ADMIN_UUID = "44444444-4444-4444-4444-444444444444";

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
  teacherCanManage = false;
  fromMock.mockClear();
});

// ─── unit-images + knowledge-media ──────────────────────────────────────

describe("authorizeBucketAccess — unit-images / knowledge-media", () => {
  it("allows any authenticated user on unit-images", async () => {
    const result = await authorizeBucketAccess(
      asUser("any-user", { user_type: "student" }),
      "unit-images",
      "any/path/x.jpg",
    );
    expect(result.ok).toBe(true);
  });

  it("allows any authenticated user on knowledge-media", async () => {
    const result = await authorizeBucketAccess(
      asUser("any-user", { user_type: "teacher" }),
      "knowledge-media",
      "any/path/x.pdf",
    );
    expect(result.ok).toBe(true);
  });
});

// ─── responses bucket — students ────────────────────────────────────────

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
    // This is the IDOR Gemini caught.
    studentRow = { id: STUDENT_A_UUID };
    const result = await authorizeBucketAccess(
      asUser("auth-uid-a", { user_type: "student" }),
      "responses",
      `${STUDENT_B_UUID}/avatar/img.jpg`,
    );
    expect(result.ok).toBe(false);
    expect((result as { ok: false; reason: string }).reason).toBe(
      "forbidden",
    );
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

// ─── responses bucket — teachers ────────────────────────────────────────

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

// ─── responses bucket — platform admin without typed user_type ──────────

describe("authorizeBucketAccess — platform admin", () => {
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

// ─── path validation ────────────────────────────────────────────────────

describe("authorizeBucketAccess — path validation", () => {
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
    // Use a UUID containing hex letters so toUpperCase has an effect.
    const lowerUuid = "abcdef01-2345-6789-abcd-ef0123456789";
    const upperUuid = lowerUuid.toUpperCase();
    studentRow = { id: lowerUuid };
    const result = await authorizeBucketAccess(
      asUser("u", { user_type: "student" }),
      "responses",
      `${upperUuid}/avatar/x.jpg`,
    );
    // students.id is canonical lowercase (Postgres UUIDs serialize
    // lowercase); mixed-case incoming UUID is rejected because the
    // comparison is exact string match. Defense-in-depth — any
    // case-shenanigans get refused even if the regex would accept them.
    expect(result.ok).toBe(false);
  });
});

// ─── unknown bucket ──────────────────────────────────────────────────────

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
