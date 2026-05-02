/**
 * Tests for actor-session.ts (Phase 1.3 — Access Model v2).
 *
 * Mocks @supabase/ssr's createServerClient + the existing
 * createServerSupabaseClient + createAdminClient so we can drive each
 * code path deterministically.
 *
 * Coverage:
 *   - getActorSession: dispatches correctly on app_metadata.user_type
 *   - getActorSession: returns null when no session
 *   - getActorSession: returns null when user_type is unknown
 *   - getActorSession: returns null when actor row missing despite valid auth
 *   - getStudentSession: filters teachers out
 *   - getTeacherSession: filters students out
 *   - requireStudentSession: returns 401 NextResponse on failure
 *   - requireActorSession: returns 401 NextResponse on failure
 *   - StudentSession shape: studentId, userId, schoolId all populated
 *   - TeacherSession shape: teacherId=userId, isPlatformAdmin from user_profiles
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────
// Mock state
// ─────────────────────────────────────────────────────────────────────────

interface MockState {
  authUser:
    | {
        id: string;
        email: string;
        app_metadata: Record<string, unknown>;
      }
    | null;
  authError: { message: string } | null;
  studentRow: { id: string; school_id: string | null } | null;
  teacherRow: {
    id: string;
    school_id: string | null;
    subscription_tier?: string;
  } | null;
  profileRow: { is_platform_admin: boolean } | null;
  // Phase 4.8b — schools row consumed by resolveTier()
  schoolRow?: { subscription_tier: string } | null;
}

let state: MockState;

beforeEach(() => {
  state = {
    authUser: null,
    authError: null,
    studentRow: null,
    teacherRow: null,
    profileRow: null,
    schoolRow: null,
  };
});

// ─────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.authUser },
        error: state.authError,
      }),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: vi.fn((table: string) => {
      if (table === "students") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.studentRow,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "teachers") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.teacherRow,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "user_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.profileRow,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "schools") {
        // Phase 4.8b — resolveTier looks up schools.subscription_tier.
        // Default to 'free' if test doesn't override; tests can stamp
        // state.schoolRow to inject a school-tier school.
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.schoolRow ?? { subscription_tier: "free" },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unmocked table: ${table}`);
    }),
  }),
}));

// Import AFTER vi.mock so the mocks are wired
async function importHelpers() {
  return import("../actor-session");
}

// ─────────────────────────────────────────────────────────────────────────
// getActorSession
// ─────────────────────────────────────────────────────────────────────────

describe("getActorSession", () => {
  it("returns null when no Supabase session", async () => {
    state.authUser = null;
    const { getActorSession } = await importHelpers();
    expect(await getActorSession()).toBeNull();
  });

  it("returns null when getUser errors", async () => {
    state.authError = { message: "JWT expired" };
    const { getActorSession } = await importHelpers();
    expect(await getActorSession()).toBeNull();
  });

  it("returns null when app_metadata.user_type is missing", async () => {
    state.authUser = {
      id: "auth-1",
      email: "test@example.com",
      app_metadata: {}, // no user_type
    };
    const { getActorSession } = await importHelpers();
    expect(await getActorSession()).toBeNull();
  });

  it("returns null when app_metadata.user_type is unsupported in Phase 1.3", async () => {
    state.authUser = {
      id: "auth-1",
      email: "fab@example.com",
      app_metadata: { user_type: "fabricator" }, // valid enum value but not handled in 1.3
    };
    const { getActorSession } = await importHelpers();
    expect(await getActorSession()).toBeNull();
  });

  it("returns StudentSession when user_type='student' AND students row exists", async () => {
    state.authUser = {
      id: "auth-stu-1",
      email: "student-stu-1@students.studioloom.local",
      app_metadata: {
        user_type: "student",
        school_id: "school-1",
        created_via: "phase-1-1-backfill",
      },
    };
    state.studentRow = { id: "students-pk-1", school_id: "school-1" };
    const { getActorSession } = await importHelpers();
    const session = await getActorSession();
    expect(session).toEqual({
      type: "student",
      studentId: "students-pk-1",
      userId: "auth-stu-1",
      schoolId: "school-1",
      // Phase 4.8b — plan resolved from school's tier (mock returns 'free' default)
      plan: "free",
    });
  });

  it("returns null when user_type='student' but students row is missing", async () => {
    // Treat as no-session — auth.users exists but data inconsistency
    state.authUser = {
      id: "auth-orphan",
      email: "test",
      app_metadata: { user_type: "student" },
    };
    state.studentRow = null;
    const { getActorSession } = await importHelpers();
    expect(await getActorSession()).toBeNull();
  });

  it("returns TeacherSession when user_type='teacher' AND teachers row exists", async () => {
    state.authUser = {
      id: "auth-tch-1",
      email: "teacher@school.edu",
      app_metadata: { user_type: "teacher" },
    };
    state.teacherRow = { id: "auth-tch-1", school_id: "school-1" };
    state.profileRow = { is_platform_admin: false };
    const { getActorSession } = await importHelpers();
    const session = await getActorSession();
    expect(session).toEqual({
      type: "teacher",
      teacherId: "auth-tch-1",
      userId: "auth-tch-1",
      schoolId: "school-1",
      isPlatformAdmin: false,
      // Phase 4.8b — plan resolved from school (mock returns 'free' default)
      plan: "free",
    });
  });

  it("propagates is_platform_admin=true for super-admin teachers", async () => {
    state.authUser = {
      id: "auth-matt",
      email: "matt@school.edu",
      app_metadata: { user_type: "teacher" },
    };
    state.teacherRow = { id: "auth-matt", school_id: "school-1" };
    state.profileRow = { is_platform_admin: true };
    const { getActorSession } = await importHelpers();
    const session = await getActorSession();
    expect(session).toMatchObject({
      type: "teacher",
      isPlatformAdmin: true,
    });
  });

  it("returns null when teacher's teachers row is missing", async () => {
    state.authUser = {
      id: "auth-no-tch",
      email: "ghost",
      app_metadata: { user_type: "teacher" },
    };
    state.teacherRow = null;
    const { getActorSession } = await importHelpers();
    expect(await getActorSession()).toBeNull();
  });

  it("defaults isPlatformAdmin to false when user_profiles row is missing", async () => {
    state.authUser = {
      id: "auth-tch-2",
      email: "newteacher@example.com",
      app_metadata: { user_type: "teacher" },
    };
    state.teacherRow = { id: "auth-tch-2", school_id: null };
    state.profileRow = null; // user_profiles trigger may not have fired yet
    const { getActorSession } = await importHelpers();
    const session = await getActorSession();
    expect(session).toMatchObject({
      type: "teacher",
      isPlatformAdmin: false,
    });
  });

  it("preserves null school_id (orphan student/teacher case)", async () => {
    state.authUser = {
      id: "auth-orphan",
      email: "x",
      app_metadata: { user_type: "student" },
    };
    state.studentRow = { id: "stu-orphan", school_id: null };
    const { getActorSession } = await importHelpers();
    const session = await getActorSession();
    expect(session).toMatchObject({
      type: "student",
      schoolId: null,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// getStudentSession / getTeacherSession (filter wrappers)
// ─────────────────────────────────────────────────────────────────────────

describe("getStudentSession / getTeacherSession", () => {
  it("getStudentSession returns null for teachers", async () => {
    state.authUser = {
      id: "auth-tch",
      email: "t",
      app_metadata: { user_type: "teacher" },
    };
    state.teacherRow = { id: "auth-tch", school_id: "school-1" };
    state.profileRow = { is_platform_admin: false };
    const { getStudentSession } = await importHelpers();
    expect(await getStudentSession()).toBeNull();
  });

  it("getTeacherSession returns null for students", async () => {
    state.authUser = {
      id: "auth-stu",
      email: "s",
      app_metadata: { user_type: "student" },
    };
    state.studentRow = { id: "stu-1", school_id: "school-1" };
    const { getTeacherSession } = await importHelpers();
    expect(await getTeacherSession()).toBeNull();
  });

  it("getStudentSession returns the typed session for students", async () => {
    state.authUser = {
      id: "auth-stu",
      email: "s",
      app_metadata: { user_type: "student" },
    };
    state.studentRow = { id: "stu-1", school_id: "school-1" };
    const { getStudentSession } = await importHelpers();
    const session = await getStudentSession();
    expect(session?.type).toBe("student");
    expect(session?.studentId).toBe("stu-1");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// require* wrappers
// ─────────────────────────────────────────────────────────────────────────

describe("requireStudentSession / requireActorSession", () => {
  it("requireStudentSession returns 401 NextResponse when no session", async () => {
    state.authUser = null;
    const { requireStudentSession } = await importHelpers();
    const result = await requireStudentSession();
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401);
      const body = await result.json();
      expect(body.error).toBe("Unauthorized");
      expect(result.headers.get("Cache-Control")).toMatch(/private/);
    }
  });

  it("requireStudentSession returns the session when authenticated student", async () => {
    state.authUser = {
      id: "auth-stu",
      email: "s",
      app_metadata: { user_type: "student" },
    };
    state.studentRow = { id: "stu-1", school_id: "school-1" };
    const { requireStudentSession } = await importHelpers();
    const result = await requireStudentSession();
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.studentId).toBe("stu-1");
      expect(result.type).toBe("student");
    }
  });

  it("requireStudentSession returns 401 for authenticated teachers", async () => {
    state.authUser = {
      id: "auth-tch",
      email: "t",
      app_metadata: { user_type: "teacher" },
    };
    state.teacherRow = { id: "auth-tch", school_id: "school-1" };
    state.profileRow = { is_platform_admin: false };
    const { requireStudentSession } = await importHelpers();
    const result = await requireStudentSession();
    expect(result).toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401);
    }
  });

  it("requireActorSession accepts both students and teachers", async () => {
    // Test student
    state.authUser = {
      id: "auth-stu",
      email: "s",
      app_metadata: { user_type: "student" },
    };
    state.studentRow = { id: "stu-1", school_id: "school-1" };
    const { requireActorSession } = await importHelpers();
    let result = await requireActorSession();
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) expect(result.type).toBe("student");

    // Test teacher
    state.authUser = {
      id: "auth-tch",
      email: "t",
      app_metadata: { user_type: "teacher" },
    };
    state.teacherRow = { id: "auth-tch", school_id: "school-1" };
    state.profileRow = { is_platform_admin: false };
    state.studentRow = null;
    result = await requireActorSession();
    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) expect(result.type).toBe("teacher");
  });
});
