import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Bug 2 — resolveStudentClassId unit tests.
 *
 * Mocks createAdminClient with a tiny in-memory store. Tests cover all
 * three input shapes (classId / unitId / both / neither) plus the
 * defensive paths (non-UUID, not enrolled, no classes own the unit).
 */

const STUDENT_ID = "11111111-1111-4111-8111-111111111111";
const CLASS_A = "22222222-2222-4222-8222-222222222222";
const CLASS_B = "33333333-3333-4333-8333-333333333333";
const UNIT_X = "44444444-4444-4444-8444-444444444444";

// In-memory store the mock supabase client reads from.
type Enrollment = { class_id: string; enrolled_at: string };
const store = {
  // class_students rows for STUDENT_ID, used by both Path 1 (classId verify)
  // and Path 2 (in()-filtered enrollment lookup).
  studentEnrollments: [] as Enrollment[],
  // class_units rows for UNIT_X (which classes use this unit).
  unitClasses: [] as { class_id: string }[],
  // 28 Apr 2026 — set of class IDs marked as archived. The resolver
  // queries `classes` with `is_archived.is.null OR is_archived.eq.false`
  // and we faithfully model the filter: a class id in this set returns
  // is_archived=true (filtered OUT); not in the set → is_archived=false
  // (passes through).
  archivedClassIds: new Set<string>(),
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "class_students") {
        // Path 1: .select.eq(student_id).eq(class_id).eq(is_active).maybeSingle
        // Path 2: .select.eq(student_id).eq(is_active).in(class_id, [...]).order().limit()
        const filters: { col: string; val: unknown }[] = [];
        let inFilter: { col: string; vals: unknown[] } | null = null;
        const chain = {
          select: (_cols: string) => chain,
          eq: (col: string, val: unknown) => {
            filters.push({ col, val });
            return chain;
          },
          in: (col: string, vals: unknown[]) => {
            inFilter = { col, vals };
            return chain;
          },
          order: (_c: string, _o: { ascending: boolean }) => chain,
          limit: async (_n: number) => {
            // Path 2 finalizer.
            const sid = filters.find((f) => f.col === "student_id")?.val as string | undefined;
            const matches = store.studentEnrollments
              .filter((e) => sid === STUDENT_ID && (inFilter ? inFilter.vals.includes(e.class_id) : true))
              .sort((a, b) => (b.enrolled_at > a.enrolled_at ? 1 : -1));
            return { data: matches, error: null };
          },
          maybeSingle: async () => {
            // Path 1 finalizer.
            const sid = filters.find((f) => f.col === "student_id")?.val as string | undefined;
            const cid = filters.find((f) => f.col === "class_id")?.val as string | undefined;
            const hit = store.studentEnrollments.find(
              (e) => sid === STUDENT_ID && e.class_id === cid
            );
            return { data: hit ?? null, error: null };
          },
        };
        return chain;
      }
      if (table === "class_units") {
        const chain = {
          select: (_cols: string) => chain,
          eq: async (_col: string, _val: unknown) => {
            // Drain the chain — assume both .eq calls happen, return after second.
            return chain;
          },
        };
        // class_units uses two .eq calls then awaits — return a promise-like
        // on the second eq via Object.assign trickery.
        return {
          select: (_cols: string) => ({
            eq: (_col1: string, _val1: unknown) => ({
              eq: (_col2: string, _val2: unknown) =>
                Promise.resolve({ data: store.unitClasses, error: null }),
            }),
          }),
        };
      }
      if (table === "classes") {
        // filterOutArchivedClasses chain:
        //   .from("classes").select("id").in("id", [...]).or("is_archived.is.null,is_archived.eq.false")
        let inIds: string[] = [];
        const chain = {
          select: (_cols: string) => chain,
          in: (_col: string, vals: string[]) => {
            inIds = vals;
            return chain;
          },
          or: async (_clause: string) => {
            const rows = inIds
              .filter((id) => !store.archivedClassIds.has(id))
              .map((id) => ({ id }));
            return { data: rows, error: null };
          },
        };
        return chain;
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { resolveStudentClassId } from "../resolve-class-id";

beforeEach(() => {
  store.studentEnrollments = [];
  store.unitClasses = [];
  store.archivedClassIds = new Set();
});

describe("resolveStudentClassId", () => {
  describe("Path 1: caller-supplied classId", () => {
    it("returns classId when student is enrolled", async () => {
      store.studentEnrollments = [{ class_id: CLASS_A, enrolled_at: "2026-04-01T00:00:00Z" }];
      const result = await resolveStudentClassId({ studentId: STUDENT_ID, classId: CLASS_A });
      expect(result).toBe(CLASS_A);
    });

    it("returns undefined when student NOT enrolled in supplied class", async () => {
      store.studentEnrollments = [{ class_id: CLASS_A, enrolled_at: "2026-04-01T00:00:00Z" }];
      const result = await resolveStudentClassId({ studentId: STUDENT_ID, classId: CLASS_B });
      expect(result).toBeUndefined();
    });

    it("returns undefined for non-UUID classId (defensive)", async () => {
      store.studentEnrollments = [{ class_id: CLASS_A, enrolled_at: "2026-04-01T00:00:00Z" }];
      const result = await resolveStudentClassId({ studentId: STUDENT_ID, classId: "not-a-uuid" });
      expect(result).toBeUndefined();
    });

    it("does NOT fall through to unitId when classId was supplied (caller intent)", async () => {
      // Bad classId + valid unitId → stays undefined (don't second-guess the caller)
      store.studentEnrollments = [{ class_id: CLASS_A, enrolled_at: "2026-04-01T00:00:00Z" }];
      store.unitClasses = [{ class_id: CLASS_A }];
      const result = await resolveStudentClassId({
        studentId: STUDENT_ID,
        classId: CLASS_B, // student NOT enrolled
        unitId: UNIT_X,
      });
      expect(result).toBeUndefined();
    });
  });

  describe("Path 2: derive from unitId", () => {
    it("returns the class that uses the unit AND that the student is enrolled in", async () => {
      store.studentEnrollments = [{ class_id: CLASS_A, enrolled_at: "2026-04-01T00:00:00Z" }];
      store.unitClasses = [{ class_id: CLASS_A }];
      const result = await resolveStudentClassId({ studentId: STUDENT_ID, unitId: UNIT_X });
      expect(result).toBe(CLASS_A);
    });

    it("picks most-recently-enrolled when multiple classes match", async () => {
      store.studentEnrollments = [
        { class_id: CLASS_A, enrolled_at: "2026-01-01T00:00:00Z" },
        { class_id: CLASS_B, enrolled_at: "2026-04-01T00:00:00Z" },
      ];
      store.unitClasses = [{ class_id: CLASS_A }, { class_id: CLASS_B }];
      const result = await resolveStudentClassId({ studentId: STUDENT_ID, unitId: UNIT_X });
      expect(result).toBe(CLASS_B);
    });

    it("returns undefined when no classes use this unit", async () => {
      store.studentEnrollments = [{ class_id: CLASS_A, enrolled_at: "2026-04-01T00:00:00Z" }];
      store.unitClasses = [];
      const result = await resolveStudentClassId({ studentId: STUDENT_ID, unitId: UNIT_X });
      expect(result).toBeUndefined();
    });

    it("returns undefined when student is enrolled in no class that owns this unit", async () => {
      store.studentEnrollments = [{ class_id: CLASS_A, enrolled_at: "2026-04-01T00:00:00Z" }];
      store.unitClasses = [{ class_id: CLASS_B }]; // unit lives in a class student isn't in
      const result = await resolveStudentClassId({ studentId: STUDENT_ID, unitId: UNIT_X });
      expect(result).toBeUndefined();
    });

    it("returns undefined for non-UUID unitId (defensive)", async () => {
      store.studentEnrollments = [{ class_id: CLASS_A, enrolled_at: "2026-04-01T00:00:00Z" }];
      store.unitClasses = [{ class_id: CLASS_A }];
      const result = await resolveStudentClassId({ studentId: STUDENT_ID, unitId: "not-a-uuid" });
      expect(result).toBeUndefined();
    });
  });

  describe("Path 3: neither classId nor unitId", () => {
    it("returns undefined", async () => {
      const result = await resolveStudentClassId({ studentId: STUDENT_ID });
      expect(result).toBeUndefined();
    });
  });

  describe("archived-class filtering (28 Apr 2026 fix)", () => {
    it("Path 1: archived classId returns undefined even if student is enrolled", async () => {
      store.studentEnrollments = [{ class_id: CLASS_A, enrolled_at: "2026-04-01T00:00:00Z" }];
      store.archivedClassIds.add(CLASS_A);
      const result = await resolveStudentClassId({ studentId: STUDENT_ID, classId: CLASS_A });
      expect(result).toBeUndefined();
    });

    it("Path 2: skips archived class even when most-recently enrolled (regression — student `test` 28 Apr)", async () => {
      // Mirrors the prod scenario: same unit lives in both classes; student is
      // enrolled in both; the archived class has a more-recent enrollment date.
      // Pre-fix the resolver picked the archived class. Post-fix it picks the
      // active one.
      store.studentEnrollments = [
        { class_id: CLASS_A, enrolled_at: "2026-03-27T00:00:00Z" }, // active class
        { class_id: CLASS_B, enrolled_at: "2026-03-28T00:00:00Z" }, // archived (1 day newer)
      ];
      store.unitClasses = [{ class_id: CLASS_A }, { class_id: CLASS_B }];
      store.archivedClassIds.add(CLASS_B);
      const result = await resolveStudentClassId({ studentId: STUDENT_ID, unitId: UNIT_X });
      expect(result).toBe(CLASS_A);
    });

    it("Path 2: returns undefined when ALL candidate classes are archived", async () => {
      store.studentEnrollments = [{ class_id: CLASS_A, enrolled_at: "2026-04-01T00:00:00Z" }];
      store.unitClasses = [{ class_id: CLASS_A }];
      store.archivedClassIds.add(CLASS_A);
      const result = await resolveStudentClassId({ studentId: STUDENT_ID, unitId: UNIT_X });
      expect(result).toBeUndefined();
    });
  });
});
