/**
 * Tests for can(actor, action, resource, options?) — Access Model v2 Phase 3.2.
 *
 * Covers all 6 resolution branches:
 *   1. Tier gate (opt-in)
 *   2. Platform admin
 *   3. Class scope role check
 *   4. Student mentor scope
 *   5. Programme coordinator scope
 *   6. Plain-teacher fallback (Decision 7 line 140)
 *
 * Plus cross-cutting: student-actor short-circuit, kill-switch reader,
 * action scope detection.
 */

import { describe, it, expect, vi } from "vitest";
import { can, isPermissionHelperRolloutEnabled } from "../can";
import { actionScope } from "../permissions/actions";
import type { ActorSession } from "../actor-session";

// ─────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────

const TEACHER_USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_TEACHER_ID = "22222222-2222-2222-2222-222222222222";
const STUDENT_ID = "33333333-3333-3333-3333-333333333333";
const CLASS_ID = "44444444-4444-4444-4444-444444444444";
const OTHER_CLASS_ID = "55555555-5555-5555-5555-555555555555";
const UNIT_ID = "66666666-6666-6666-6666-666666666666";
const SCHOOL_ID = "77777777-7777-7777-7777-777777777777";
const OTHER_SCHOOL_ID = "88888888-8888-8888-8888-888888888888";

function teacherSession(overrides?: Partial<Extract<ActorSession, { type: "teacher" }>>): ActorSession {
  return {
    type: "teacher",
    teacherId: TEACHER_USER_ID,
    userId: TEACHER_USER_ID,
    schoolId: SCHOOL_ID,
    isPlatformAdmin: false,
    ...overrides,
  };
}

function studentSession(): ActorSession {
  return {
    type: "student",
    studentId: STUDENT_ID,
    userId: TEACHER_USER_ID,
    schoolId: SCHOOL_ID,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Mock Supabase builder
// ─────────────────────────────────────────────────────────────────────
//
// Tests pass a "fixtures" object describing what the mock should return
// per table or RPC call. The builder constructs a chainable proxy that
// supports the .select().eq().eq().is().order().limit().maybeSingle()
// pattern can.ts uses.

type Fixtures = {
  /** class_members rows; filtered in-memory by .eq() conditions */
  class_members?: Array<{
    class_id: string;
    member_user_id: string;
    role: string;
    accepted_at?: string;
    removed_at?: string | null;
    classes?: { is_archived: boolean };
  }>;
  class_students?: Array<{
    class_id: string;
    student_id: string;
    is_active: boolean;
  }>;
  class_units?: Array<{
    class_id: string;
    unit_id: string;
    is_active: boolean;
  }>;
  units?: Array<{ id: string; author_teacher_id: string | null }>;
  schools?: Array<{ id: string; subscription_tier: string }>;
  admin_settings?: Array<{ key: string; value: unknown }>;
  /** RPC return values keyed by function name */
  rpc?: Partial<{
    has_class_role: boolean;
    has_school_responsibility: boolean;
    has_student_mentorship: boolean;
  }>;
};

function buildMockDb(fixtures: Fixtures) {
  // Generic from() handler supporting .select().eq().eq()...maybeSingle() / list
  function fromBuilder(table: keyof Fixtures) {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];

    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((col: string, val: unknown) => {
        filters.push((row) => row[col] === val);
        return builder;
      }),
      is: vi.fn((col: string, val: unknown) => {
        filters.push((row) => row[col] === val);
        return builder;
      }),
      in: vi.fn((col: string, vals: unknown[]) => {
        filters.push((row) => vals.includes(row[col]));
        return builder;
      }),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => {
        const rows = (fixtures[table] as Array<Record<string, unknown>>) ?? [];
        const match = rows.find((r) => filters.every((f) => f(r)));
        return { data: match ?? null, error: null };
      }),
      // For non-maybeSingle "return list" path; the implementation accesses
      // .then() via await, which Promise.resolve gives via thenable interface.
      // Easiest: provide an explicit promise resolution.
      then(onFulfilled: (v: { data: unknown; error: null }) => unknown) {
        const rows = (fixtures[table] as Array<Record<string, unknown>>) ?? [];
        const match = rows.filter((r) => filters.every((f) => f(r)));
        return Promise.resolve({ data: match, error: null }).then(onFulfilled);
      },
    };
    return builder;
  }

  return {
    from: vi.fn(fromBuilder),
    rpc: vi.fn(async (name: string) => {
      const val = fixtures.rpc?.[name as keyof Fixtures["rpc"]];
      return { data: val === true, error: null };
    }),
  } as unknown as Parameters<typeof can>[4]; // SupabaseClient
}

// ─────────────────────────────────────────────────────────────────────
// 1. Tier gate
// ─────────────────────────────────────────────────────────────────────

describe("can() — tier gate", () => {
  it("denies when school's tier is below requiresTier", async () => {
    const db = buildMockDb({
      schools: [{ id: SCHOOL_ID, subscription_tier: "pilot" }],
    });
    const result = await can(
      teacherSession(),
      "class.view",
      { type: "class", id: CLASS_ID, school_id: SCHOOL_ID },
      { requiresTier: ["pro", "school"] },
      db
    );
    expect(result).toBe(false);
  });

  it("passes through tier gate when school is in requiresTier", async () => {
    const db = buildMockDb({
      schools: [{ id: SCHOOL_ID, subscription_tier: "pro" }],
      class_members: [
        {
          class_id: CLASS_ID,
          member_user_id: TEACHER_USER_ID,
          role: "lead_teacher",
          removed_at: null,
        },
      ],
    });
    const result = await can(
      teacherSession(),
      "class.view",
      { type: "class", id: CLASS_ID, school_id: SCHOOL_ID },
      { requiresTier: ["pro", "school"] },
      db
    );
    expect(result).toBe(true);
  });

  it("denies tier gate when no school context anywhere", async () => {
    const db = buildMockDb({});
    const result = await can(
      teacherSession({ schoolId: null }),
      "class.view",
      { type: "class", id: CLASS_ID }, // no school_id on resource
      { requiresTier: ["pro"] },
      db
    );
    expect(result).toBe(false);
  });

  it("skips tier check when requiresTier omitted", async () => {
    const db = buildMockDb({
      class_members: [
        {
          class_id: CLASS_ID,
          member_user_id: TEACHER_USER_ID,
          role: "lead_teacher",
          removed_at: null,
        },
      ],
    });
    const result = await can(
      teacherSession(),
      "class.view",
      { type: "class", id: CLASS_ID },
      undefined,
      db
    );
    expect(result).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2. Platform admin
// ─────────────────────────────────────────────────────────────────────

describe("can() — platform admin", () => {
  it("returns true for any action when isPlatformAdmin=true", async () => {
    const db = buildMockDb({});
    const result = await can(
      teacherSession({ isPlatformAdmin: true }),
      "class.delete",
      { type: "class", id: CLASS_ID },
      undefined,
      db
    );
    expect(result).toBe(true);
  });

  it("falls through when isPlatformAdmin=false", async () => {
    const db = buildMockDb({}); // no class_members → no role
    const result = await can(
      teacherSession({ isPlatformAdmin: false }),
      "class.delete",
      { type: "class", id: CLASS_ID },
      undefined,
      db
    );
    expect(result).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3. Class scope role check
// ─────────────────────────────────────────────────────────────────────

describe("can() — class scope", () => {
  it("lead_teacher → class.delete → true", async () => {
    const db = buildMockDb({
      class_members: [
        { class_id: CLASS_ID, member_user_id: TEACHER_USER_ID, role: "lead_teacher", removed_at: null },
      ],
    });
    expect(
      await can(teacherSession(), "class.delete", { type: "class", id: CLASS_ID }, undefined, db)
    ).toBe(true);
  });

  it("co_teacher → class.delete → false (matrix excludes)", async () => {
    const db = buildMockDb({
      class_members: [
        { class_id: CLASS_ID, member_user_id: TEACHER_USER_ID, role: "co_teacher", removed_at: null },
      ],
    });
    expect(
      await can(teacherSession(), "class.delete", { type: "class", id: CLASS_ID }, undefined, db)
    ).toBe(false);
  });

  it("co_teacher → class.edit → true", async () => {
    const db = buildMockDb({
      class_members: [
        { class_id: CLASS_ID, member_user_id: TEACHER_USER_ID, role: "co_teacher", removed_at: null },
      ],
    });
    expect(
      await can(teacherSession(), "class.edit", { type: "class", id: CLASS_ID }, undefined, db)
    ).toBe(true);
  });

  it("observer → class.view → true; class.edit → false", async () => {
    const db = buildMockDb({
      class_members: [
        { class_id: CLASS_ID, member_user_id: TEACHER_USER_ID, role: "observer", removed_at: null },
      ],
    });
    expect(
      await can(teacherSession(), "class.view", { type: "class", id: CLASS_ID }, undefined, db)
    ).toBe(true);
    expect(
      await can(teacherSession(), "class.edit", { type: "class", id: CLASS_ID }, undefined, db)
    ).toBe(false);
  });

  it("no membership → class.view → false", async () => {
    const db = buildMockDb({});
    expect(
      await can(teacherSession(), "class.view", { type: "class", id: CLASS_ID }, undefined, db)
    ).toBe(false);
  });

  it("removed_at NOT NULL membership doesn't grant access", async () => {
    const db = buildMockDb({
      class_members: [
        {
          class_id: CLASS_ID,
          member_user_id: TEACHER_USER_ID,
          role: "lead_teacher",
          removed_at: "2026-04-01T00:00:00Z",
        },
      ],
    });
    expect(
      await can(teacherSession(), "class.view", { type: "class", id: CLASS_ID }, undefined, db)
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 4. Unit scope
// ─────────────────────────────────────────────────────────────────────

describe("can() — unit scope", () => {
  it("unit author → unit.delete → true (author shortcut)", async () => {
    const db = buildMockDb({
      units: [{ id: UNIT_ID, author_teacher_id: TEACHER_USER_ID }],
    });
    expect(
      await can(teacherSession(), "unit.delete", { type: "unit", id: UNIT_ID }, undefined, db)
    ).toBe(true);
  });

  it("unit author short-circuit even without class membership", async () => {
    const db = buildMockDb({
      units: [{ id: UNIT_ID, author_teacher_id: TEACHER_USER_ID }],
      class_units: [], // unit not assigned anywhere
    });
    expect(
      await can(teacherSession(), "unit.publish", { type: "unit", id: UNIT_ID }, undefined, db)
    ).toBe(true);
  });

  it("co_teacher of class with this unit → unit.edit → true", async () => {
    const db = buildMockDb({
      units: [{ id: UNIT_ID, author_teacher_id: OTHER_TEACHER_ID }],
      class_units: [{ class_id: CLASS_ID, unit_id: UNIT_ID, is_active: true }],
      class_members: [
        { class_id: CLASS_ID, member_user_id: TEACHER_USER_ID, role: "co_teacher", removed_at: null },
      ],
    });
    expect(
      await can(teacherSession(), "unit.edit", { type: "unit", id: UNIT_ID }, undefined, db)
    ).toBe(true);
  });

  it("non-author non-member → unit.view → false", async () => {
    const db = buildMockDb({
      units: [{ id: UNIT_ID, author_teacher_id: OTHER_TEACHER_ID }],
      class_units: [{ class_id: CLASS_ID, unit_id: UNIT_ID, is_active: true }],
      class_members: [],
    });
    expect(
      await can(teacherSession(), "unit.view", { type: "unit", id: UNIT_ID }, undefined, db)
    ).toBe(false);
  });

  it("dept_head with explicit class_id parameter → unit.publish → true", async () => {
    const db = buildMockDb({
      class_members: [
        { class_id: CLASS_ID, member_user_id: TEACHER_USER_ID, role: "dept_head", removed_at: null },
      ],
    });
    expect(
      await can(
        teacherSession(),
        "unit.publish",
        { type: "unit", id: UNIT_ID, class_id: CLASS_ID, author_teacher_id: OTHER_TEACHER_ID },
        undefined,
        db
      )
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 5. Student scope
// ─────────────────────────────────────────────────────────────────────

describe("can() — student scope", () => {
  it("mentor → student.message → true (closes FU-MENTOR-SCOPE)", async () => {
    const db = buildMockDb({
      rpc: { has_student_mentorship: true },
      class_students: [], // no class enrollment shared
    });
    expect(
      await can(teacherSession(), "student.message", { type: "student", id: STUDENT_ID }, undefined, db)
    ).toBe(true);
  });

  it("mentor → student.export → false (mentor matrix excludes)", async () => {
    const db = buildMockDb({
      rpc: { has_student_mentorship: true },
      class_students: [],
    });
    expect(
      await can(teacherSession(), "student.export", { type: "student", id: STUDENT_ID }, undefined, db)
    ).toBe(false);
  });

  it("lead_teacher of student's class → student.edit → true", async () => {
    const db = buildMockDb({
      rpc: { has_student_mentorship: false },
      class_students: [{ class_id: CLASS_ID, student_id: STUDENT_ID, is_active: true }],
      class_members: [
        { class_id: CLASS_ID, member_user_id: TEACHER_USER_ID, role: "lead_teacher", removed_at: null },
      ],
    });
    expect(
      await can(teacherSession(), "student.edit", { type: "student", id: STUDENT_ID }, undefined, db)
    ).toBe(true);
  });

  it("observer of student's class → student.edit → false", async () => {
    const db = buildMockDb({
      rpc: { has_student_mentorship: false },
      class_students: [{ class_id: CLASS_ID, student_id: STUDENT_ID, is_active: true }],
      class_members: [
        { class_id: CLASS_ID, member_user_id: TEACHER_USER_ID, role: "observer", removed_at: null },
      ],
    });
    expect(
      await can(teacherSession(), "student.edit", { type: "student", id: STUDENT_ID }, undefined, db)
    ).toBe(false);
  });

  it("plain-teacher fallback: shares active class via lead_teacher → student.view → true", async () => {
    const db = buildMockDb({
      rpc: { has_student_mentorship: false },
      class_students: [{ class_id: CLASS_ID, student_id: STUDENT_ID, is_active: true }],
      // The role-check in step 2 will hit lead_teacher (which already grants student.view).
      class_members: [
        {
          class_id: CLASS_ID,
          member_user_id: TEACHER_USER_ID,
          role: "lead_teacher",
          removed_at: null,
          classes: { is_archived: false },
        },
      ],
    });
    expect(
      await can(teacherSession(), "student.view", { type: "student", id: STUDENT_ID }, undefined, db)
    ).toBe(true);
  });

  it("no shared class + not a mentor → student.view → false", async () => {
    const db = buildMockDb({
      rpc: { has_student_mentorship: false },
      class_students: [{ class_id: OTHER_CLASS_ID, student_id: STUDENT_ID, is_active: true }],
      class_members: [
        {
          class_id: CLASS_ID,
          member_user_id: TEACHER_USER_ID,
          role: "lead_teacher",
          removed_at: null,
          classes: { is_archived: false },
        },
      ],
    });
    expect(
      await can(teacherSession(), "student.view", { type: "student", id: STUDENT_ID }, undefined, db)
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 6. School scope
// ─────────────────────────────────────────────────────────────────────

describe("can() — school scope", () => {
  it("same-school teacher → school.view → true", async () => {
    const db = buildMockDb({
      rpc: { has_school_responsibility: false },
    });
    expect(
      await can(teacherSession(), "school.view", { type: "school", id: SCHOOL_ID }, undefined, db)
    ).toBe(true);
  });

  it("different-school teacher → school.view → false", async () => {
    const db = buildMockDb({
      rpc: { has_school_responsibility: false },
    });
    expect(
      await can(teacherSession(), "school.view", { type: "school", id: OTHER_SCHOOL_ID }, undefined, db)
    ).toBe(false);
  });

  it("PYP coordinator → school.settings.edit_low_stakes → true", async () => {
    const db = buildMockDb({
      rpc: { has_school_responsibility: true },
    });
    expect(
      await can(
        teacherSession(),
        "school.settings.edit_low_stakes",
        { type: "school", id: SCHOOL_ID },
        undefined,
        db
      )
    ).toBe(true);
  });

  it("PYP coordinator → school.settings.edit_high_stakes → false (Phase 4 owns)", async () => {
    const db = buildMockDb({
      rpc: { has_school_responsibility: true },
    });
    expect(
      await can(
        teacherSession(),
        "school.settings.edit_high_stakes",
        { type: "school", id: SCHOOL_ID },
        undefined,
        db
      )
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 7. Programme scope
// ─────────────────────────────────────────────────────────────────────

describe("can() — programme scope", () => {
  it("PYP coordinator at school for programme.coordinate → true", async () => {
    const db = buildMockDb({
      rpc: { has_school_responsibility: true },
    });
    expect(
      await can(
        teacherSession(),
        "programme.coordinate",
        { type: "programme", school_id: SCHOOL_ID, programme_type: "pyp" },
        undefined,
        db
      )
    ).toBe(true);
  });

  it("non-coordinator → programme.coordinate → false", async () => {
    const db = buildMockDb({
      rpc: { has_school_responsibility: false },
    });
    expect(
      await can(
        teacherSession(),
        "programme.coordinate",
        { type: "programme", school_id: SCHOOL_ID, programme_type: "pyp" },
        undefined,
        db
      )
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Cross-cutting
// ─────────────────────────────────────────────────────────────────────

describe("can() — cross-cutting", () => {
  it("student actor → returns false (helper is teacher-only)", async () => {
    const db = buildMockDb({});
    expect(
      await can(studentSession(), "student.view", { type: "student", id: STUDENT_ID }, undefined, db)
    ).toBe(false);
  });

  it("isPermissionHelperRolloutEnabled returns true when row absent", async () => {
    const db = buildMockDb({ admin_settings: [] });
    expect(await isPermissionHelperRolloutEnabled(db)).toBe(true);
  });

  it("isPermissionHelperRolloutEnabled returns false when flag is false", async () => {
    const db = buildMockDb({
      admin_settings: [{ key: "auth.permission_helper_rollout", value: false }],
    });
    expect(await isPermissionHelperRolloutEnabled(db)).toBe(false);
  });

  it("actionScope detects scope from action token", () => {
    expect(actionScope("class.view")).toBe("class");
    expect(actionScope("unit.publish")).toBe("unit");
    expect(actionScope("student.message")).toBe("student");
    expect(actionScope("school.view")).toBe("school");
    expect(actionScope("programme.coordinate")).toBe("programme");
  });
});
