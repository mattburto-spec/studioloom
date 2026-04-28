import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Per-student unified support-settings endpoint tests.
 *
 * Covers:
 *   - GET shape (student + classes array, including ELL fields)
 *   - GET 403 when teacher doesn't share a class with the student
 *   - GET 404 when student doesn't exist
 *   - PATCH partial UPDATE (only support_settings, only ell_level, both)
 *   - PATCH ell_level validation (1-3 only)
 *   - PATCH 403/404
 *   - PATCH 400 on invalid body / empty incoming
 *   - PATCH delete-key behavior (Bug 3) — null deletes, doesn't persist
 */

let mockTeacherId: string | null = "teacher-1";
let canManage = true;
let existingStudentRow:
  | {
      id: string;
      display_name: string | null;
      username: string;
      ell_level: number | null;
      learning_profile: unknown;
      support_settings: unknown;
    }
  | null = null;
let enrollmentRows: Array<{
  class_id: string;
  support_settings: unknown;
  ell_level_override: number | null;
  classes: { id: string; name: string; code: string; framework: string | null; is_archived: boolean | null };
}> = [];
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
  verifyTeacherCanManageStudent: async () => canManage,
}));

vi.mock("@/lib/student-support/resolve-settings", () => ({
  resolveStudentSettings: async (...args: unknown[]) => {
    resolveSpy(...args);
    return {
      l1Target: "en",
      tapAWordEnabled: true,
      l1Source: "default",
      tapASource: "default",
    };
  },
}));

vi.mock("@/lib/tap-a-word/language-mapping", () => ({
  mapLanguageToCode: (raw: string) => {
    const map: Record<string, string> = { Mandarin: "zh", English: "en" };
    return map[raw] ?? null;
  },
}));

// In-memory mock supabase: handles students + class_students reads + students update.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "students") {
        return {
          select: (_cols: string) => {
            const chain = {
              eq: () => chain,
              maybeSingle: async () => ({ data: existingStudentRow, error: null }),
            };
            return chain;
          },
          update: (payload: Record<string, unknown>) => {
            updateSpy(payload);
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
      }
      if (table === "class_students") {
        return {
          select: (_cols: string) => {
            const chain = {
              eq: () => chain,
              order: () => chain,
              then: (onFulfilled: (val: { data: unknown; error: null }) => unknown) =>
                Promise.resolve({ data: enrollmentRows, error: null }).then(onFulfilled),
            };
            return chain;
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { GET, PATCH } from "../route";

const STUDENT_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_A = "22222222-2222-4222-8222-222222222222";

const CTX = { params: Promise.resolve({ studentId: STUDENT_ID }) };

function makeReq(body: unknown): Parameters<typeof PATCH>[0] {
  return new Request("http://test", {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0];
}

function makeGetReq(): Parameters<typeof GET>[0] {
  return new Request("http://test") as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  mockTeacherId = "teacher-1";
  canManage = true;
  existingStudentRow = {
    id: STUDENT_ID,
    display_name: "Test Student",
    username: "test",
    ell_level: 2,
    learning_profile: { languages_at_home: ["Mandarin", "English"] },
    support_settings: {},
  };
  enrollmentRows = [
    {
      class_id: CLASS_A,
      support_settings: {},
      ell_level_override: null,
      classes: {
        id: CLASS_A,
        name: "10 Design",
        code: "10DHVO",
        framework: "MYP",
        is_archived: false,
      },
    },
  ];
  updateSpy = vi.fn();
  resolveSpy = vi.fn();
});

describe("GET /api/teacher/students/[studentId]/support-settings", () => {
  it("returns full payload shape with student + classes array", async () => {
    const res = await GET(makeGetReq(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.student).toMatchObject({
      id: STUDENT_ID,
      displayName: "Test Student",
      username: "test",
      ellLevel: 2,
    });
    expect(body.student.intake.firstLanguageRaw).toBe("Mandarin");
    expect(body.student.intake.intakeL1Code).toBe("zh");
    expect(body.student.globalSupportSettings).toEqual({});
    expect(body.student.resolvedGlobal).toBeDefined();

    expect(Array.isArray(body.classes)).toBe(true);
    expect(body.classes).toHaveLength(1);
    expect(body.classes[0]).toMatchObject({
      classId: CLASS_A,
      className: "10 Design",
      classCode: "10DHVO",
      framework: "MYP",
      ellLevelOverride: null,
      ellSource: "student-global",
      resolvedEll: 2,
    });
  });

  it("excludes archived classes from the classes array (mirrors resolver filter)", async () => {
    enrollmentRows = [
      ...enrollmentRows,
      {
        class_id: "33333333-3333-4333-8333-333333333333",
        support_settings: {},
        ell_level_override: null,
        classes: {
          id: "33333333-3333-4333-8333-333333333333",
          name: "6 Design (archived)",
          code: "OLDCODE",
          framework: "MYP",
          is_archived: true,
        },
      },
    ];
    const res = await GET(makeGetReq(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.classes).toHaveLength(1);
    expect(body.classes[0].classId).toBe(CLASS_A);
  });

  it("classOverrides reflects per-class JSONB and ellLevelOverride flips ellSource", async () => {
    enrollmentRows = [
      {
        class_id: CLASS_A,
        support_settings: { l1_target_override: "ja" },
        ell_level_override: 3,
        classes: enrollmentRows[0].classes,
      },
    ];
    const res = await GET(makeGetReq(), CTX);
    const body = await res.json();
    expect(body.classes[0].classOverrides).toEqual({ l1_target_override: "ja" });
    expect(body.classes[0].ellLevelOverride).toBe(3);
    expect(body.classes[0].ellSource).toBe("class-override");
    expect(body.classes[0].resolvedEll).toBe(3);
  });

  it("returns 401 when teacher is not authenticated", async () => {
    mockTeacherId = null;
    const res = await GET(makeGetReq(), CTX);
    expect(res.status).toBe(401);
  });

  it("returns 403 when teacher doesn't share a class with the student", async () => {
    canManage = false;
    const res = await GET(makeGetReq(), CTX);
    expect(res.status).toBe(403);
  });

  it("returns 404 when student doesn't exist", async () => {
    existingStudentRow = null;
    const res = await GET(makeGetReq(), CTX);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/teacher/students/[studentId]/support-settings", () => {
  it("partial UPDATE — support_settings only does NOT include ell_level in payload", async () => {
    const res = await PATCH(makeReq({ l1_target_override: "zh" }), CTX);
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const payload = updateSpy.mock.calls[0][0];
    expect(payload).toHaveProperty("support_settings");
    expect(payload).not.toHaveProperty("ell_level");
    expect(payload.support_settings).toEqual({ l1_target_override: "zh" });
  });

  it("partial UPDATE — ell_level only does NOT include support_settings in payload", async () => {
    const res = await PATCH(makeReq({ ell_level: 3 }), CTX);
    expect(res.status).toBe(200);
    const payload = updateSpy.mock.calls[0][0];
    expect(payload).toEqual({ ell_level: 3 });
    expect(payload).not.toHaveProperty("support_settings");
  });

  it("partial UPDATE — both fields includes both in payload", async () => {
    const res = await PATCH(
      makeReq({ l1_target_override: "ko", ell_level: 1 }),
      CTX
    );
    expect(res.status).toBe(200);
    const payload = updateSpy.mock.calls[0][0];
    expect(payload.support_settings).toEqual({ l1_target_override: "ko" });
    expect(payload.ell_level).toBe(1);
  });

  it("Bug 3 — explicit null in support_settings DELETES the key on merge", async () => {
    existingStudentRow!.support_settings = {
      l1_target_override: "zh",
      tap_a_word_enabled: false,
    };
    const res = await PATCH(makeReq({ l1_target_override: null }), CTX);
    expect(res.status).toBe(200);
    const payload = updateSpy.mock.calls[0][0];
    expect(payload.support_settings).toEqual({ tap_a_word_enabled: false });
    expect("l1_target_override" in (payload.support_settings as object)).toBe(false);
  });

  it("rejects ell_level=0 with 400", async () => {
    const res = await PATCH(makeReq({ ell_level: 0 }), CTX);
    expect(res.status).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rejects ell_level=4 with 400", async () => {
    const res = await PATCH(makeReq({ ell_level: 4 }), CTX);
    expect(res.status).toBe(400);
  });

  it("rejects ell_level as string with 400", async () => {
    const res = await PATCH(makeReq({ ell_level: "2" }), CTX);
    expect(res.status).toBe(400);
  });

  it("rejects empty body (no valid fields) with 400", async () => {
    const res = await PATCH(makeReq({ random_key: "x" }), CTX);
    expect(res.status).toBe(400);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400", async () => {
    const req = new Request("http://test", { method: "PATCH", body: "{ not json" });
    const res = await PATCH(req as unknown as Parameters<typeof PATCH>[0], CTX);
    expect(res.status).toBe(400);
  });

  it("returns 401 when teacher is not authenticated", async () => {
    mockTeacherId = null;
    const res = await PATCH(makeReq({ l1_target_override: "zh" }), CTX);
    expect(res.status).toBe(401);
  });

  it("returns 403 when teacher doesn't share a class with the student", async () => {
    canManage = false;
    const res = await PATCH(makeReq({ l1_target_override: "zh" }), CTX);
    expect(res.status).toBe(403);
  });

  it("returns 404 when student doesn't exist (post-auth check)", async () => {
    existingStudentRow = null;
    const res = await PATCH(makeReq({ l1_target_override: "zh" }), CTX);
    expect(res.status).toBe(404);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("response carries Cache-Control: private", async () => {
    const res = await PATCH(makeReq({ l1_target_override: "zh" }), CTX);
    expect(res.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate"
    );
  });

  it("PATCH returns the full GET shape so UI can refresh in one round-trip", async () => {
    const res = await PATCH(makeReq({ l1_target_override: "zh" }), CTX);
    const body = await res.json();
    expect(body.student).toBeDefined();
    expect(body.classes).toBeDefined();
    expect(Array.isArray(body.classes)).toBe(true);
  });
});
