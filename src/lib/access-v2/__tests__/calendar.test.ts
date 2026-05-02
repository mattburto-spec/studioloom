/**
 * Tests for calendar read-precedence helper — Phase 4.8.
 *
 * Verifies the 3-layer fallback:
 *   1. class_units.schedule_overrides_jsonb (highest — adds scheduleOverrides)
 *   2. schools.academic_calendar_jsonb (NEW)
 *   3. school_calendar_terms WHERE teacher_id = ? (legacy fallback)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveCalendar,
  getSchoolCalendar,
  type CalendarTerm,
} from "../school/calendar";

interface ChainResult {
  data: unknown;
  error: unknown;
}
type MockChain = Record<string, ReturnType<typeof vi.fn>> & {
  then: (r: (v: unknown) => void) => Promise<unknown>;
};

function buildChain(result: ChainResult = { data: null, error: null }): MockChain {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "eq",
    "order",
    "limit",
    "single",
    "maybeSingle",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(result).then(resolve);
  return chain as MockChain;
}

const SCHOOL_ID = "11111111-1111-1111-1111-111111111111";
const TEACHER_ID = "22222222-2222-2222-2222-222222222222";
const CLASS_ID = "33333333-3333-3333-3333-333333333333";

const SAMPLE_TERMS: CalendarTerm[] = [
  {
    term_name: "Term 1",
    term_order: 1,
    academic_year: "2026-2027",
    start_date: "2026-09-01",
    end_date: "2026-12-15",
  },
  {
    term_name: "Term 2",
    term_order: 2,
    academic_year: "2026-2027",
    start_date: "2027-01-10",
    end_date: "2027-04-15",
  },
];

function buildClient(handlers: Record<string, ChainResult[]>) {
  const queues = new Map<string, MockChain[]>();
  for (const [table, results] of Object.entries(handlers)) {
    queues.set(table, results.map((r) => buildChain(r)));
  }
  return {
    from: vi.fn((table: string) => {
      const q = queues.get(table);
      if (!q || q.length === 0) {
        return buildChain({ data: null, error: null });
      }
      return q.shift()!;
    }),
  };
}

describe("resolveCalendar — 3-layer precedence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 'none' when no source has data", async () => {
    const client = buildClient({
      class_units: [{ data: null, error: null }],
      schools: [{ data: { academic_calendar_jsonb: null }, error: null }],
      school_calendar_terms: [{ data: null, error: null }],
    });
    const result = await resolveCalendar({
      classId: CLASS_ID,
      schoolId: SCHOOL_ID,
      teacherId: TEACHER_ID,
      supabase: client as never,
    });
    expect(result.source).toBe("none");
    expect(result.terms).toHaveLength(0);
  });

  it("layer 2 (school) wins over layer 3 (teacher)", async () => {
    const client = buildClient({
      class_units: [{ data: null, error: null }],
      schools: [
        { data: { academic_calendar_jsonb: SAMPLE_TERMS }, error: null },
      ],
      // Teacher fallback would also have data — but layer 2 wins
      school_calendar_terms: [
        {
          data: [
            {
              term_name: "Different",
              term_order: 1,
              academic_year: "2025-2026",
              start_date: null,
              end_date: null,
            },
          ],
          error: null,
        },
      ],
    });
    const result = await resolveCalendar({
      classId: CLASS_ID,
      schoolId: SCHOOL_ID,
      teacherId: TEACHER_ID,
      supabase: client as never,
    });
    expect(result.source).toBe("school");
    expect(result.terms).toEqual(SAMPLE_TERMS);
  });

  it("layer 3 (teacher legacy) used when layer 2 is empty", async () => {
    const client = buildClient({
      class_units: [{ data: null, error: null }],
      schools: [{ data: { academic_calendar_jsonb: null }, error: null }],
      school_calendar_terms: [
        { data: SAMPLE_TERMS, error: null },
      ],
    });
    const result = await resolveCalendar({
      classId: CLASS_ID,
      schoolId: SCHOOL_ID,
      teacherId: TEACHER_ID,
      supabase: client as never,
    });
    expect(result.source).toBe("teacher_legacy");
    expect(result.terms).toEqual(SAMPLE_TERMS);
  });

  it("school layer with empty array falls through to teacher", async () => {
    // Defensive: if academic_calendar_jsonb is [] (not null), helper
    // should treat as no-data and fall through.
    const client = buildClient({
      class_units: [{ data: null, error: null }],
      schools: [{ data: { academic_calendar_jsonb: [] }, error: null }],
      school_calendar_terms: [{ data: SAMPLE_TERMS, error: null }],
    });
    const result = await resolveCalendar({
      classId: CLASS_ID,
      schoolId: SCHOOL_ID,
      teacherId: TEACHER_ID,
      supabase: client as never,
    });
    expect(result.source).toBe("teacher_legacy");
  });

  it("class_units schedule_overrides_jsonb attaches alongside layer 2/3 terms", async () => {
    const overrides = { skip_dates: ["2026-10-15"], notes: { p1: "Field trip" } };
    const client = buildClient({
      class_units: [
        {
          data: { schedule_overrides_jsonb: overrides },
          error: null,
        },
      ],
      schools: [{ data: { academic_calendar_jsonb: SAMPLE_TERMS }, error: null }],
      school_calendar_terms: [{ data: null, error: null }],
    });
    const result = await resolveCalendar({
      classId: CLASS_ID,
      schoolId: SCHOOL_ID,
      teacherId: TEACHER_ID,
      supabase: client as never,
    });
    expect(result.source).toBe("school");
    expect(result.scheduleOverrides).toEqual(overrides);
  });

  it("returns 'class_override' source when only schedule overrides exist (no terms)", async () => {
    const overrides = { skip_dates: ["2026-10-15"] };
    const client = buildClient({
      class_units: [
        {
          data: { schedule_overrides_jsonb: overrides },
          error: null,
        },
      ],
      schools: [{ data: { academic_calendar_jsonb: null }, error: null }],
      school_calendar_terms: [{ data: null, error: null }],
    });
    const result = await resolveCalendar({
      classId: CLASS_ID,
      schoolId: SCHOOL_ID,
      teacherId: TEACHER_ID,
      supabase: client as never,
    });
    expect(result.source).toBe("class_override");
    expect(result.terms).toHaveLength(0);
    expect(result.scheduleOverrides).toEqual(overrides);
  });

  it("works with no classId (skips layer 1)", async () => {
    const client = buildClient({
      schools: [{ data: { academic_calendar_jsonb: SAMPLE_TERMS }, error: null }],
    });
    const result = await resolveCalendar({
      schoolId: SCHOOL_ID,
      teacherId: TEACHER_ID,
      supabase: client as never,
    });
    expect(result.source).toBe("school");
    expect(result.terms).toEqual(SAMPLE_TERMS);
  });

  it("works with no schoolId or teacherId (returns 'none')", async () => {
    const client = buildClient({});
    const result = await resolveCalendar({
      classId: CLASS_ID,
      supabase: client as never,
    });
    expect(result.source).toBe("none");
    expect(result.terms).toHaveLength(0);
  });
});

describe("getSchoolCalendar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns terms array when populated", async () => {
    const client = buildClient({
      schools: [{ data: { academic_calendar_jsonb: SAMPLE_TERMS }, error: null }],
    });
    const result = await getSchoolCalendar(SCHOOL_ID, client as never);
    expect(result).toEqual(SAMPLE_TERMS);
  });

  it("returns [] when column is NULL", async () => {
    const client = buildClient({
      schools: [{ data: { academic_calendar_jsonb: null }, error: null }],
    });
    const result = await getSchoolCalendar(SCHOOL_ID, client as never);
    expect(result).toEqual([]);
  });

  it("returns [] when school not found", async () => {
    const client = buildClient({
      schools: [{ data: null, error: null }],
    });
    const result = await getSchoolCalendar(SCHOOL_ID, client as never);
    expect(result).toEqual([]);
  });
});
