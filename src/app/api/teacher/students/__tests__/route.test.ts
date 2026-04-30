import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * POST /api/teacher/students — single-student creation route tests.
 *
 * Closes FU-AV2-UI-STUDENT-INSERT-REFACTOR (P2). Replaces 5 client-side
 * supabase.from("students").insert(...) call sites with a single
 * server-side endpoint that handles auth + INSERT + auth.users
 * provisioning + optional class enrollment atomically.
 *
 * Covers:
 *   - 401 when not a teacher
 *   - 400 when username missing/invalid
 *   - 400 when classId is not a UUID
 *   - 403 when classId belongs to a different teacher
 *   - 409 when username already exists in teacher's roster
 *   - 200 happy-path (no class)
 *   - 200 happy-path (with class enrollment)
 *   - Rolls back student INSERT when provisionStudentAuthUserOrThrow fails
 *   - school_id derived from class when classId given, from teacher when not
 *   - Defaults: ell_level=3, gradYear/displayName=null when omitted
 */

// ─────────────────────────────────────────────────────────────────────────
// Mocks state
// ─────────────────────────────────────────────────────────────────────────

let mockTeacherId: string | null = "teacher-1";
let mockTeacherSchoolId: string | null = "school-teacher-default";
let mockClassOwned = true;
let mockClassSchoolId: string | null = "school-from-class";
let mockExistingStudent: { id: string } | null = null;

interface InsertedStudent {
  id: string;
  username: string;
  display_name: string | null;
  ell_level: number;
  graduation_year: number | null;
  class_id: string | null;
  school_id: string | null;
}

let insertedStudent: InsertedStudent | null = null;
let provisionShouldThrow = false;
let provisionedUserId = "auth-user-uuid";
let deleteCalledFor: string | null = null;
let enrollmentRowsInserted: Array<Record<string, unknown>> = [];

const insertStudentSpy = vi.fn();
const insertClassStudentsSpy = vi.fn();
const provisionSpy = vi.fn();

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
  verifyTeacherOwnsClass: async () => mockClassOwned,
}));

vi.mock("@/lib/access-v2/provision-student-auth-user", () => ({
  provisionStudentAuthUserOrThrow: async (...args: unknown[]) => {
    provisionSpy(...args);
    if (provisionShouldThrow) {
      throw new Error("provisionStudentAuthUser failed: simulated");
    }
    return {
      user_id: provisionedUserId,
      created: true,
      reused: false,
      skipped: false,
    };
  },
}));

vi.mock("@/lib/supabase/admin", () => {
  // Minimal Supabase client mock supporting the chains the route uses:
  //  - from("classes").select(...).eq(...).single()
  //  - from("teachers").select(...).eq(...).single()
  //  - from("students").select(...).eq(...).eq(...).maybeSingle()
  //  - from("students").insert(...).select(...).single()
  //  - from("students").delete().eq(...)
  //  - from("class_students").insert(...)
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === "classes") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { school_id: mockClassSchoolId },
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
                single: async () => ({
                  data: { school_id: mockTeacherSchoolId },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "students") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: mockExistingStudent,
                    error: null,
                  }),
                }),
              }),
            }),
            insert: (payload: Record<string, unknown>) => {
              insertStudentSpy(payload);
              insertedStudent = {
                id: "new-student-uuid",
                username: payload.username as string,
                display_name: (payload.display_name as string | null) ?? null,
                ell_level: (payload.ell_level as number) ?? 3,
                graduation_year: (payload.graduation_year as number | null) ?? null,
                class_id: (payload.class_id as string | null) ?? null,
                school_id: (payload.school_id as string | null) ?? null,
              };
              return {
                select: () => ({
                  single: async () => ({
                    data: insertedStudent,
                    error: null,
                  }),
                }),
              };
            },
            delete: () => ({
              eq: async (_col: string, val: string) => {
                deleteCalledFor = val;
                return { data: null, error: null };
              },
            }),
          };
        }
        if (table === "class_students") {
          return {
            insert: async (payload: Record<string, unknown>) => {
              insertClassStudentsSpy(payload);
              enrollmentRowsInserted.push(payload);
              return { data: null, error: null };
            },
          };
        }
        return {} as never;
      },
    }),
  };
});

// Wrap-with-error-handler — pass through.
vi.mock("@/lib/api/error-handler", () => ({
  withErrorHandler: (
    _name: string,
    fn: (req: unknown) => Promise<unknown>
  ) => fn,
}));

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/teacher/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockTeacherId = "teacher-1";
  mockTeacherSchoolId = "school-teacher-default";
  mockClassOwned = true;
  mockClassSchoolId = "school-from-class";
  mockExistingStudent = null;
  insertedStudent = null;
  provisionShouldThrow = false;
  provisionedUserId = "auth-user-uuid";
  deleteCalledFor = null;
  enrollmentRowsInserted = [];
  insertStudentSpy.mockClear();
  insertClassStudentsSpy.mockClear();
  provisionSpy.mockClear();
});

describe("POST /api/teacher/students", () => {
  it("returns 401 when not authenticated as a teacher", async () => {
    mockTeacherId = null;
    const res = await POST(makeRequest({ username: "alice" }));
    expect((res as Response).status).toBe(401);
  });

  it("returns 400 when username is missing", async () => {
    const res = await POST(makeRequest({}));
    expect((res as Response).status).toBe(400);
    const body = await (res as Response).json();
    expect(body.error).toMatch(/username/i);
  });

  it("returns 400 when username has no alphanumeric characters", async () => {
    const res = await POST(makeRequest({ username: "!!!" }));
    expect((res as Response).status).toBe(400);
  });

  it("returns 400 when classId is not a valid UUID", async () => {
    const res = await POST(
      makeRequest({ username: "alice", classId: "not-a-uuid" })
    );
    expect((res as Response).status).toBe(400);
  });

  it("returns 403 when classId is not owned by the teacher", async () => {
    mockClassOwned = false;
    const res = await POST(
      makeRequest({
        username: "alice",
        classId: "11111111-1111-4111-8111-111111111111",
      })
    );
    expect((res as Response).status).toBe(403);
  });

  it("returns 409 when username already exists in teacher's roster", async () => {
    mockExistingStudent = { id: "existing-student-uuid" };
    const res = await POST(makeRequest({ username: "alice" }));
    expect((res as Response).status).toBe(409);
    const body = await (res as Response).json();
    expect(body.code).toBe("DUPLICATE_USERNAME");
    expect(body.existingStudentId).toBe("existing-student-uuid");
  });

  it("happy path — no classId — INSERTs student + provisions auth.users + uses teacher's school_id", async () => {
    const res = await POST(
      makeRequest({
        username: "alice",
        displayName: "Alice Smith",
        ellLevel: 2,
        gradYear: 2030,
      })
    );

    expect((res as Response).status).toBe(200);
    const body = await (res as Response).json();
    expect(body.student).toMatchObject({
      id: "new-student-uuid",
      username: "alice",
      display_name: "Alice Smith",
      ell_level: 2,
      graduation_year: 2030,
      class_id: null,
      school_id: "school-teacher-default", // from teachers table since no classId
      user_id: "auth-user-uuid",
    });

    // INSERT was called with the right payload
    expect(insertStudentSpy).toHaveBeenCalledTimes(1);
    expect(insertStudentSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "alice",
        display_name: "Alice Smith",
        ell_level: 2,
        graduation_year: 2030,
        author_teacher_id: "teacher-1",
        school_id: "school-teacher-default",
        class_id: null,
      })
    );

    // No class_students enrollment when no classId
    expect(insertClassStudentsSpy).not.toHaveBeenCalled();

    // provisionStudentAuthUserOrThrow was called
    expect(provisionSpy).toHaveBeenCalledTimes(1);
  });

  it("happy path — with classId — uses class's school_id + enrolls in class_students", async () => {
    const res = await POST(
      makeRequest({
        username: "bob",
        classId: "22222222-2222-4222-8222-222222222222",
      })
    );

    expect((res as Response).status).toBe(200);
    const body = await (res as Response).json();
    expect(body.student.school_id).toBe("school-from-class");
    expect(body.student.class_id).toBe("22222222-2222-4222-8222-222222222222");

    // Enrollment was created
    expect(insertClassStudentsSpy).toHaveBeenCalledTimes(1);
    expect(insertClassStudentsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: "new-student-uuid",
        class_id: "22222222-2222-4222-8222-222222222222",
        is_active: true,
      })
    );
  });

  it("rolls back student INSERT when auth.users provisioning throws", async () => {
    provisionShouldThrow = true;

    const res = await POST(makeRequest({ username: "carol" }));

    expect((res as Response).status).toBe(500);

    // Student INSERT happened
    expect(insertStudentSpy).toHaveBeenCalledTimes(1);

    // ...but the row was deleted afterwards (rollback)
    expect(deleteCalledFor).toBe("new-student-uuid");

    // class_students never inserted
    expect(insertClassStudentsSpy).not.toHaveBeenCalled();
  });

  it("scrubs username — lowercases and strips non-allowed characters", async () => {
    const res = await POST(makeRequest({ username: "ALICE!@#" }));
    expect((res as Response).status).toBe(200);
    expect(insertStudentSpy).toHaveBeenCalledWith(
      expect.objectContaining({ username: "alice" })
    );
  });

  it("defaults ellLevel to 3 when omitted, accepts 1-3", async () => {
    await POST(makeRequest({ username: "alice" }));
    expect(insertStudentSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ ell_level: 3 })
    );

    insertStudentSpy.mockClear();
    await POST(makeRequest({ username: "bob", ellLevel: 1 }));
    expect(insertStudentSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ ell_level: 1 })
    );

    // ellLevel out-of-range falls back to default
    insertStudentSpy.mockClear();
    await POST(makeRequest({ username: "carol", ellLevel: 99 }));
    expect(insertStudentSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ ell_level: 3 })
    );
  });
});
