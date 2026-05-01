/**
 * Tests for GET /api/teacher/me/scope (Phase 3.3).
 *
 * Brief: docs/projects/access-model-v2-phase-3-brief.md §3.6 + §4 Phase 3.3
 *
 * Coverage:
 *   1. 401 when not authenticated
 *   2. Empty scopes for teacher with no rows in any of the 3 tables
 *   3. Class membership returns class scope (with class_name from embed)
 *   4. Mentor row returns student scope (with programme + student_name)
 *   5. School responsibility returns school scope
 *   6. Combined union of all 3 scope types
 *   7. Cache-Control: private, max-age=30 header
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────
// Mock state
// ─────────────────────────────────────────────────────────────────────

let mockUserId: string | null = "teacher-1";
type Row = Record<string, unknown>;
const fixtures: {
  class_members: Row[];
  student_mentors: Row[];
  school_responsibilities: Row[];
} = {
  class_members: [],
  student_mentors: [],
  school_responsibilities: [],
};

beforeEach(() => {
  mockUserId = "teacher-1";
  fixtures.class_members = [];
  fixtures.student_mentors = [];
  fixtures.school_responsibilities = [];
});

// requireTeacherAuth reads via @supabase/ssr's createServerClient.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockUserId ? { id: mockUserId } : null },
      })),
    },
  }),
}));

// createServerSupabaseClient is the SSR client our route uses for data reads.
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    from: (table: keyof typeof fixtures) => {
      const filters: Array<(r: Row) => boolean> = [];
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters.push((r) => r[col] === val);
          return builder;
        },
        is: (col: string, val: unknown) => {
          filters.push((r) => r[col] === val);
          return builder;
        },
        then(onFulfilled: (v: { data: Row[]; error: null }) => unknown) {
          const rows = (fixtures[table] ?? []).filter((r) =>
            filters.every((f) => f(r))
          );
          return Promise.resolve({ data: rows, error: null }).then(
            onFulfilled
          );
        },
      };
      return builder;
    },
  }),
}));

import { GET } from "../route";
import { NextRequest } from "next/server";

function makeRequest() {
  return new NextRequest("http://localhost/api/teacher/me/scope");
}

// ─────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────

describe("GET /api/teacher/me/scope", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUserId = null;
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns empty scopes when teacher has no rows", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scopes).toEqual([]);
    expect(typeof body.fetched_at).toBe("string");
  });

  it("returns class scope with class_name from embed", async () => {
    fixtures.class_members = [
      {
        class_id: "abc123",
        member_user_id: "teacher-1",
        role: "lead_teacher",
        removed_at: null,
        classes: { name: "G10 Design" },
      },
    ];
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.scopes).toEqual([
      { scope: "class:abc123", role: "lead_teacher", class_name: "G10 Design" },
    ]);
  });

  it("handles array-shaped embed from PostgREST", async () => {
    // PostgREST sometimes returns embeds as arrays (depending on cardinality).
    fixtures.class_members = [
      {
        class_id: "def456",
        member_user_id: "teacher-1",
        role: "co_teacher",
        removed_at: null,
        classes: [{ name: "G11 Service" }],
      },
    ];
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.scopes[0]).toMatchObject({
      scope: "class:def456",
      role: "co_teacher",
      class_name: "G11 Service",
    });
  });

  it("returns student-mentor scope with programme + student_name", async () => {
    fixtures.student_mentors = [
      {
        student_id: "stu1",
        mentor_user_id: "teacher-1",
        programme: "pp",
        deleted_at: null,
        students: { name: "John D." },
      },
    ];
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.scopes).toEqual([
      {
        scope: "student:stu1",
        role: "mentor",
        programme: "pp",
        student_name: "John D.",
      },
    ]);
  });

  it("returns school responsibility scope", async () => {
    fixtures.school_responsibilities = [
      {
        school_id: "nis",
        teacher_id: "teacher-1",
        responsibility_type: "pyp_coordinator",
        deleted_at: null,
      },
    ];
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.scopes).toEqual([
      { scope: "school:nis", role: "pyp_coordinator" },
    ]);
  });

  it("returns combined union of all 3 scope types", async () => {
    fixtures.class_members = [
      {
        class_id: "c1",
        member_user_id: "teacher-1",
        role: "lead_teacher",
        removed_at: null,
        classes: { name: "G10" },
      },
    ];
    fixtures.student_mentors = [
      {
        student_id: "s1",
        mentor_user_id: "teacher-1",
        programme: "pp",
        deleted_at: null,
        students: { name: "Alice" },
      },
    ];
    fixtures.school_responsibilities = [
      {
        school_id: "nis",
        teacher_id: "teacher-1",
        responsibility_type: "myp_coordinator",
        deleted_at: null,
      },
    ];

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.scopes).toHaveLength(3);
    expect(body.scopes.map((s: { scope: string }) => s.scope)).toEqual([
      "class:c1",
      "student:s1",
      "school:nis",
    ]);
  });

  it("sets Cache-Control: private, max-age=30 header", async () => {
    const res = await GET(makeRequest());
    expect(res.headers.get("cache-control")).toBe("private, max-age=30");
  });
});
