/**
 * Tests for src/lib/access-v2/ai-budget/cascade-resolver.ts (Phase 5.2).
 *
 * Coverage:
 *   - Each cascade layer (1→5) wins when the higher layers are absent
 *   - Tighter overrides beat looser ones (student > class > school > col > tier)
 *   - Multiple class-level overrides → lowest cap wins (most restrictive)
 *   - Orphan student / missing school / missing tier → fallback
 */

import { describe, it, expect } from "vitest";
import { resolveStudentCap } from "../cascade-resolver";
import { TIER_DEFAULTS } from "../tier-defaults";

interface MockData {
  student?: { id: string; school_id: string | null } | null;
  classEnrollments?: Array<{ class_id: string }>;
  budgets?: Array<{
    subject_type: "student" | "class" | "school";
    subject_id: string;
    daily_token_cap: number;
  }>;
  school?: {
    id: string;
    default_student_ai_budget: number | null;
    subscription_tier: string | null;
  } | null;
  adminSettings?: Record<string, unknown>;
}

// The class_students + ai_budgets-IN queries return arrays. PostgREST builders
// resolve via thenable when await-ed without a terminal selector; we mock that
// by returning a plain Promise from the .eq()/.in() call.
function buildClient(data: MockData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (table: string): any => {
    if (table === "students") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: data.student ?? null,
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "class_students") {
      const rows = data.classEnrollments ?? [];
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: rows, error: null }),
        }),
      };
    }
    if (table === "ai_budgets") {
      return {
        select: () => ({
          eq: (col1: string, val1: string) => ({
            eq: (_col2: string, val2: string) => ({
              maybeSingle: async () => {
                const match = (data.budgets ?? []).find(
                  (b) => b.subject_type === val1 && b.subject_id === val2,
                );
                return {
                  data: match ? { daily_token_cap: match.daily_token_cap } : null,
                  error: null,
                };
              },
            }),
            in: (_col2: string, ids: string[]) => {
              const matches = (data.budgets ?? []).filter(
                (b) => b.subject_type === val1 && ids.includes(b.subject_id),
              );
              return Promise.resolve({
                data: matches.map((m) => ({
                  subject_id: m.subject_id,
                  daily_token_cap: m.daily_token_cap,
                })),
                error: null,
              });
            },
          }),
        }),
      };
    }
    if (table === "schools") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: data.school ?? null,
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "admin_settings") {
      return {
        select: () => ({
          eq: (_col: string, key: string) => ({
            maybeSingle: async () => {
              if (key in (data.adminSettings ?? {})) {
                return {
                  data: { value: (data.adminSettings ?? {})[key] },
                  error: null,
                };
              }
              return { data: null, error: null };
            },
          }),
        }),
      };
    }
    throw new Error(`Unmocked table: ${table}`);
  };
  return { from: handler } as unknown as Parameters<
    typeof resolveStudentCap
  >[0];
}

const STUDENT_ID = "11111111-1111-1111-1111-111111111111";
const SCHOOL_ID = "22222222-2222-2222-2222-222222222222";
const CLASS_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CLASS_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("resolveStudentCap — orphan student", () => {
  it("returns fallback (50000, tier_default, schoolId=null) for missing student", async () => {
    const supabase = buildClient({ student: null });
    const result = await resolveStudentCap(supabase, STUDENT_ID);
    expect(result).toEqual({
      cap: TIER_DEFAULTS.pilot,
      source: "tier_default",
      schoolId: null,
    });
  });
});

describe("resolveStudentCap — Layer 1: student override wins", () => {
  it("returns student-level cap regardless of class/school/tier", async () => {
    const supabase = buildClient({
      student: { id: STUDENT_ID, school_id: SCHOOL_ID },
      budgets: [
        { subject_type: "student", subject_id: STUDENT_ID, daily_token_cap: 5_000 },
        { subject_type: "class", subject_id: CLASS_A, daily_token_cap: 80_000 },
        { subject_type: "school", subject_id: SCHOOL_ID, daily_token_cap: 100_000 },
      ],
      classEnrollments: [{ class_id: CLASS_A }],
      school: {
        id: SCHOOL_ID,
        default_student_ai_budget: 200_000,
        subscription_tier: "school",
      },
    });
    const result = await resolveStudentCap(supabase, STUDENT_ID);
    expect(result.cap).toBe(5_000);
    expect(result.source).toBe("student");
    expect(result.schoolId).toBe(SCHOOL_ID);
  });
});

describe("resolveStudentCap — Layer 2: class override wins (lowest)", () => {
  it("returns the LOWEST class cap when student is in multiple classes", async () => {
    const supabase = buildClient({
      student: { id: STUDENT_ID, school_id: SCHOOL_ID },
      classEnrollments: [{ class_id: CLASS_A }, { class_id: CLASS_B }],
      budgets: [
        { subject_type: "class", subject_id: CLASS_A, daily_token_cap: 80_000 },
        { subject_type: "class", subject_id: CLASS_B, daily_token_cap: 30_000 },
        { subject_type: "school", subject_id: SCHOOL_ID, daily_token_cap: 100_000 },
      ],
    });
    const result = await resolveStudentCap(supabase, STUDENT_ID);
    expect(result.cap).toBe(30_000);
    expect(result.source).toBe("class");
    expect(result.winningClassId).toBe(CLASS_B);
  });

  it("ignores classes the student is NOT enrolled in", async () => {
    const supabase = buildClient({
      student: { id: STUDENT_ID, school_id: SCHOOL_ID },
      classEnrollments: [{ class_id: CLASS_A }],
      budgets: [
        { subject_type: "class", subject_id: CLASS_B, daily_token_cap: 1_000 },
      ],
      school: {
        id: SCHOOL_ID,
        default_student_ai_budget: null,
        subscription_tier: "free",
      },
    });
    const result = await resolveStudentCap(supabase, STUDENT_ID);
    expect(result.cap).toBe(TIER_DEFAULTS.free);
    expect(result.source).toBe("tier_default");
  });
});

describe("resolveStudentCap — Layer 3: school override wins", () => {
  it("returns school-level ai_budgets override over column + tier", async () => {
    const supabase = buildClient({
      student: { id: STUDENT_ID, school_id: SCHOOL_ID },
      classEnrollments: [],
      budgets: [
        { subject_type: "school", subject_id: SCHOOL_ID, daily_token_cap: 60_000 },
      ],
      school: {
        id: SCHOOL_ID,
        default_student_ai_budget: 200_000,
        subscription_tier: "school",
      },
    });
    const result = await resolveStudentCap(supabase, STUDENT_ID);
    expect(result.cap).toBe(60_000);
    expect(result.source).toBe("school");
  });
});

describe("resolveStudentCap — Layer 4: schools.default_student_ai_budget column", () => {
  it("returns the column value when no ai_budgets overrides exist", async () => {
    const supabase = buildClient({
      student: { id: STUDENT_ID, school_id: SCHOOL_ID },
      classEnrollments: [],
      school: {
        id: SCHOOL_ID,
        default_student_ai_budget: 123_456,
        subscription_tier: "free",
      },
    });
    const result = await resolveStudentCap(supabase, STUDENT_ID);
    expect(result.cap).toBe(123_456);
    expect(result.source).toBe("school_default_column");
  });
});

describe("resolveStudentCap — Layer 5: tier default", () => {
  it("returns the tier default when column is NULL", async () => {
    const supabase = buildClient({
      student: { id: STUDENT_ID, school_id: SCHOOL_ID },
      classEnrollments: [],
      school: {
        id: SCHOOL_ID,
        default_student_ai_budget: null,
        subscription_tier: "pro",
      },
    });
    const result = await resolveStudentCap(supabase, STUDENT_ID);
    expect(result.cap).toBe(TIER_DEFAULTS.pro);
    expect(result.source).toBe("tier_default");
  });

  it("admin_settings tier override wins over the constant", async () => {
    const supabase = buildClient({
      student: { id: STUDENT_ID, school_id: SCHOOL_ID },
      classEnrollments: [],
      school: {
        id: SCHOOL_ID,
        default_student_ai_budget: null,
        subscription_tier: "school",
      },
      adminSettings: {
        "ai.budget.tier_default.school": 500_000,
      },
    });
    const result = await resolveStudentCap(supabase, STUDENT_ID);
    expect(result.cap).toBe(500_000);
    expect(result.source).toBe("tier_default");
  });

  it("falls back to FALLBACK_CAP (pilot=50k) when school exists but tier is unknown", async () => {
    const supabase = buildClient({
      student: { id: STUDENT_ID, school_id: SCHOOL_ID },
      classEnrollments: [],
      school: {
        id: SCHOOL_ID,
        default_student_ai_budget: null,
        subscription_tier: "future_tier_not_in_enum",
      },
    });
    const result = await resolveStudentCap(supabase, STUDENT_ID);
    expect(result.cap).toBe(TIER_DEFAULTS.pilot);
    expect(result.source).toBe("tier_default");
  });

  it("returns fallback when student has no school_id", async () => {
    const supabase = buildClient({
      student: { id: STUDENT_ID, school_id: null },
      classEnrollments: [],
    });
    const result = await resolveStudentCap(supabase, STUDENT_ID);
    expect(result.cap).toBe(TIER_DEFAULTS.pilot);
    expect(result.source).toBe("tier_default");
    expect(result.schoolId).toBeNull();
  });
});
