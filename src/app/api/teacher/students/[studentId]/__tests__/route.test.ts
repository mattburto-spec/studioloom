import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * PATCH + DELETE /api/teacher/students/[studentId]
 *
 * Round 20 (6 May 2026 PM) — covers the new edit-name + delete-student
 * affordances on the per-student teacher view.
 *
 * PATCH:
 *   - 401 when not authenticated
 *   - 403 when teacher can't manage the student
 *   - 400 when displayName is too long (> 80) or wrong type
 *   - 400 when no fields to update
 *   - 200 happy path → display_name persisted via supabase update
 *   - empty / whitespace-only displayName normalises to null
 *
 * DELETE:
 *   - 401 when not authenticated
 *   - 403 when teacher can't manage the student
 *   - 404 when student row not found
 *   - happy path: cascades through class_students + student_progress + students
 *     + auth.users; missing user_id is tolerated
 */

// ─────────────────────────────────────────────────────────────────────────
// Mock state
// ─────────────────────────────────────────────────────────────────────────

let mockTeacherId: string | null = "teacher-1";
let mockCanManage = true;
let mockStudentRow: { id: string; user_id: string | null } | null = {
  id: "student-1",
  user_id: "auth-user-1",
};

// Relaxed-gate fixtures (13 May 2026) — drive the DELETE-only fallback
// path that allows hard-delete when the student has no active enrollments
// anywhere AND the teacher had a historical relationship with them.
// Tests can flip these to exercise allow/deny per scenario.
let mockAnyActiveEnrollmentRow: { class_id: string } | null = null;
let mockTeacherClassRows: Array<{ id: string }> = [];
let mockHistoricEnrollmentRow: { class_id: string } | null = null;

const updateStudentsSpy = vi.fn();
const deleteClassStudentsSpy = vi.fn();
const deleteStudentProgressSpy = vi.fn();
const deleteStudentsSpy = vi.fn();
const authDeleteSpy = vi.fn();

let updatedStudentRow: { id: string; display_name: string | null; username: string } | null = {
  id: "student-1",
  display_name: "Alice S.",
  username: "alice",
};

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
  verifyTeacherCanManageStudent: async () => mockCanManage,
}));

vi.mock("@/lib/supabase/admin", () => {
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === "students") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: mockStudentRow,
                  error: null,
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              updateStudentsSpy(payload);
              return {
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: updatedStudentRow
                        ? {
                            ...updatedStudentRow,
                            display_name: (payload.display_name as
                              | string
                              | null
                              | undefined) ?? updatedStudentRow.display_name,
                          }
                        : null,
                      error: null,
                    }),
                  }),
                }),
              };
            },
            delete: () => ({
              eq: async () => {
                deleteStudentsSpy();
                return { data: null, error: null };
              },
            }),
          };
        }
        if (table === "class_students") {
          return {
            delete: () => ({
              eq: async () => {
                deleteClassStudentsSpy();
                return { data: null, error: null };
              },
            }),
            // Relaxed-gate paths read class_students via SELECT chains:
            //   1. .select("class_id").eq().eq("is_active", true).limit().maybeSingle()
            //      → "is the student actively enrolled anywhere?"
            //   2. .select("class_id").eq().in("class_id", [...]).limit().maybeSingle()
            //      → "did THIS teacher ever have them?"
            // The chain branches on whether `.in()` is called (path 2) or
            // a second `.eq()` (path 1). Both terminate at maybeSingle().
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: mockAnyActiveEnrollmentRow,
                      error: null,
                    }),
                  }),
                }),
                in: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: mockHistoricEnrollmentRow,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "classes") {
          return {
            select: () => ({
              eq: async () => ({
                data: mockTeacherClassRows,
                error: null,
              }),
            }),
          };
        }
        if (table === "student_progress") {
          return {
            delete: () => ({
              eq: async () => {
                deleteStudentProgressSpy();
                return { data: null, error: null };
              },
            }),
          };
        }
        return {} as never;
      },
      auth: {
        admin: {
          deleteUser: async (uid: string) => {
            authDeleteSpy(uid);
            return { data: null, error: null };
          },
        },
      },
    }),
  };
});

import { PATCH, DELETE } from "../route";
import { NextRequest } from "next/server";

function makePatch(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/teacher/students/student-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDelete(): NextRequest {
  return new NextRequest("http://localhost/api/teacher/students/student-1", {
    method: "DELETE",
  });
}

const params = Promise.resolve({ studentId: "student-1" });

beforeEach(() => {
  mockTeacherId = "teacher-1";
  mockCanManage = true;
  mockStudentRow = { id: "student-1", user_id: "auth-user-1" };
  // Default relaxed-gate fixtures: no active enrollments anywhere, no
  // historical teacher relationship. Tests opt in by mutating these.
  mockAnyActiveEnrollmentRow = null;
  mockTeacherClassRows = [];
  mockHistoricEnrollmentRow = null;
  updatedStudentRow = {
    id: "student-1",
    display_name: "Alice S.",
    username: "alice",
  };
  updateStudentsSpy.mockClear();
  deleteClassStudentsSpy.mockClear();
  deleteStudentProgressSpy.mockClear();
  deleteStudentsSpy.mockClear();
  authDeleteSpy.mockClear();
});

describe("PATCH /api/teacher/students/[studentId]", () => {
  it("returns 401 when not authenticated", async () => {
    mockTeacherId = null;
    const res = await PATCH(makePatch({ displayName: "Bob" }), { params });
    expect((res as Response).status).toBe(401);
  });

  it("returns 403 when teacher can't manage the student", async () => {
    mockCanManage = false;
    const res = await PATCH(makePatch({ displayName: "Bob" }), { params });
    expect((res as Response).status).toBe(403);
  });

  it("returns 400 when displayName is too long", async () => {
    const tooLong = "x".repeat(81);
    const res = await PATCH(makePatch({ displayName: tooLong }), { params });
    expect((res as Response).status).toBe(400);
  });

  it("returns 400 when displayName is the wrong type", async () => {
    const res = await PATCH(makePatch({ displayName: 42 }), { params });
    expect((res as Response).status).toBe(400);
  });

  it("returns 400 when no fields are provided", async () => {
    const res = await PATCH(makePatch({}), { params });
    expect((res as Response).status).toBe(400);
  });

  it("happy path — persists display_name + returns updated row", async () => {
    const res = await PATCH(makePatch({ displayName: "Bob Smith" }), {
      params,
    });
    expect((res as Response).status).toBe(200);
    expect(updateStudentsSpy).toHaveBeenCalledWith({
      display_name: "Bob Smith",
    });
    const body = await (res as Response).json();
    expect(body.student.display_name).toBe("Bob Smith");
  });

  it("normalises empty displayName to null (falls back to username)", async () => {
    const res = await PATCH(makePatch({ displayName: "   " }), { params });
    expect((res as Response).status).toBe(200);
    expect(updateStudentsSpy).toHaveBeenCalledWith({ display_name: null });
  });

  it("explicit null displayName is allowed (also clears it)", async () => {
    const res = await PATCH(makePatch({ displayName: null }), { params });
    expect((res as Response).status).toBe(200);
    expect(updateStudentsSpy).toHaveBeenCalledWith({ display_name: null });
  });
});

describe("DELETE /api/teacher/students/[studentId]", () => {
  it("returns 401 when not authenticated", async () => {
    mockTeacherId = null;
    const res = await DELETE(makeDelete(), { params });
    expect((res as Response).status).toBe(401);
  });

  it("returns 403 when teacher can't manage the student", async () => {
    mockCanManage = false;
    const res = await DELETE(makeDelete(), { params });
    expect((res as Response).status).toBe(403);
  });

  it("returns 404 when student row missing", async () => {
    mockStudentRow = null;
    const res = await DELETE(makeDelete(), { params });
    expect((res as Response).status).toBe(404);
  });

  it("happy path — cascades through class_students + student_progress + students + auth.users", async () => {
    const res = await DELETE(makeDelete(), { params });
    expect((res as Response).status).toBe(200);
    expect(deleteClassStudentsSpy).toHaveBeenCalledTimes(1);
    expect(deleteStudentProgressSpy).toHaveBeenCalledTimes(1);
    expect(deleteStudentsSpy).toHaveBeenCalledTimes(1);
    expect(authDeleteSpy).toHaveBeenCalledWith("auth-user-1");
  });

  it("missing user_id is tolerated — auth.users delete is skipped, students still removed", async () => {
    mockStudentRow = { id: "student-1", user_id: null };
    const res = await DELETE(makeDelete(), { params });
    expect((res as Response).status).toBe(200);
    expect(authDeleteSpy).not.toHaveBeenCalled();
    expect(deleteStudentsSpy).toHaveBeenCalledTimes(1);
  });

  // ── Relaxed gate (13 May 2026) ───────────────────────────────────
  // DELETE allows hard-delete when EITHER the strict gate passes OR
  // the student has no active enrollments anywhere AND this teacher
  // had a historical class_students relationship with them. Smoke
  // caught the strict-only gate blocking deletion of a test student
  // whose enrollments were all marked COMPLETED.

  it("relaxed gate: allows delete when strict gate fails but student has no active enrollments AND teacher had a historical relationship", async () => {
    mockCanManage = false;
    mockAnyActiveEnrollmentRow = null; // student is fully inactive
    mockTeacherClassRows = [{ id: "class-a" }, { id: "class-b" }];
    mockHistoricEnrollmentRow = { class_id: "class-a" }; // teacher had them once
    const res = await DELETE(makeDelete(), { params });
    expect((res as Response).status).toBe(200);
    expect(deleteStudentsSpy).toHaveBeenCalledTimes(1);
  });

  it("relaxed gate: 403 when strict gate fails AND student has active enrollment elsewhere (even if teacher had historical)", async () => {
    mockCanManage = false;
    mockAnyActiveEnrollmentRow = { class_id: "some-other-class" }; // active in T2's class
    mockTeacherClassRows = [{ id: "class-a" }];
    mockHistoricEnrollmentRow = { class_id: "class-a" }; // teacher had them once
    const res = await DELETE(makeDelete(), { params });
    expect((res as Response).status).toBe(403);
    expect(deleteStudentsSpy).not.toHaveBeenCalled();
  });

  it("relaxed gate: 403 when strict gate fails AND no historical teacher relationship (even if student is fully inactive)", async () => {
    mockCanManage = false;
    mockAnyActiveEnrollmentRow = null;
    mockTeacherClassRows = [{ id: "class-a" }];
    mockHistoricEnrollmentRow = null; // teacher never had them
    const res = await DELETE(makeDelete(), { params });
    expect((res as Response).status).toBe(403);
    expect(deleteStudentsSpy).not.toHaveBeenCalled();
  });

  it("relaxed gate: 403 when strict gate fails AND teacher has no classes at all (defensive)", async () => {
    mockCanManage = false;
    mockAnyActiveEnrollmentRow = null;
    mockTeacherClassRows = []; // teacher hasn't even got a class
    mockHistoricEnrollmentRow = null;
    const res = await DELETE(makeDelete(), { params });
    expect((res as Response).status).toBe(403);
    expect(deleteStudentsSpy).not.toHaveBeenCalled();
  });
});
