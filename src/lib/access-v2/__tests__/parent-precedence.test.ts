/**
 * Tests for resolveSchoolColumn + resolveSchoolSettings.
 *
 * Phase 4.0 scaffold per docs/projects/access-model-v2-phase-4-brief.md
 * §3.9 item 13. Multi-campus parent_school_id self-join read precedence.
 */

import { describe, it, expect, vi } from "vitest";
import {
  resolveSchoolColumn,
  resolveSchoolSettings,
  INHERITABLE_COLUMNS,
} from "../school/parent-precedence";

const CHILD_ID = "11111111-1111-1111-1111-111111111111";
const PARENT_ID = "22222222-2222-2222-2222-222222222222";
const GRANDPARENT_ID = "33333333-3333-3333-3333-333333333333";

type SchoolRow = Record<string, unknown> & {
  id: string;
  parent_school_id: string | null;
};

function mockDb(rows: SchoolRow[]) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((_col: string, val: string) => ({
          maybeSingle: vi.fn(async () => ({
            data: byId.get(val) ?? null,
            error: null,
          })),
        })),
      })),
    })),
  } as unknown as Parameters<typeof resolveSchoolColumn>[2];
}

describe("resolveSchoolColumn", () => {
  it("returns own value when set", async () => {
    const db = mockDb([
      {
        id: CHILD_ID,
        parent_school_id: PARENT_ID,
        academic_calendar_jsonb: { terms: ["T1"] },
      },
    ]);
    const result = await resolveSchoolColumn(
      CHILD_ID,
      "academic_calendar_jsonb",
      db
    );
    expect(result).toEqual({
      value: { terms: ["T1"] },
      source: "own",
      fromSchoolId: CHILD_ID,
      depth: 0,
    });
  });

  it("falls back to parent when child column is null", async () => {
    const db = mockDb([
      { id: CHILD_ID, parent_school_id: PARENT_ID, academic_calendar_jsonb: null },
      { id: PARENT_ID, parent_school_id: null, academic_calendar_jsonb: { terms: ["P1"] } },
    ]);
    const result = await resolveSchoolColumn(
      CHILD_ID,
      "academic_calendar_jsonb",
      db
    );
    expect(result).toEqual({
      value: { terms: ["P1"] },
      source: "inherited",
      fromSchoolId: PARENT_ID,
      depth: 1,
    });
  });

  it("falls back to grandparent when child + parent are null", async () => {
    const db = mockDb([
      { id: CHILD_ID, parent_school_id: PARENT_ID, default_grading_scale: null },
      { id: PARENT_ID, parent_school_id: GRANDPARENT_ID, default_grading_scale: null },
      { id: GRANDPARENT_ID, parent_school_id: null, default_grading_scale: "MYP_1_8" },
    ]);
    const result = await resolveSchoolColumn(
      CHILD_ID,
      "default_grading_scale",
      db
    );
    expect(result).toEqual({
      value: "MYP_1_8",
      source: "inherited",
      fromSchoolId: GRANDPARENT_ID,
      depth: 2,
    });
  });

  it("returns null at depth 0 when entire chain has no value", async () => {
    const db = mockDb([
      { id: CHILD_ID, parent_school_id: PARENT_ID, default_grading_scale: null },
      { id: PARENT_ID, parent_school_id: null, default_grading_scale: null },
    ]);
    const result = await resolveSchoolColumn(
      CHILD_ID,
      "default_grading_scale",
      db
    );
    expect(result.value).toBeNull();
  });

  it("throws on cycle", async () => {
    const db = mockDb([
      { id: CHILD_ID, parent_school_id: PARENT_ID, default_grading_scale: null },
      { id: PARENT_ID, parent_school_id: CHILD_ID, default_grading_scale: null },
    ]);
    await expect(
      resolveSchoolColumn(CHILD_ID, "default_grading_scale", db)
    ).rejects.toThrow(/Cycle detected/);
  });

  it("rejects non-inheritable columns", async () => {
    const db = mockDb([{ id: CHILD_ID, parent_school_id: null }]);
    await expect(
      // @ts-expect-error — testing runtime guard
      resolveSchoolColumn(CHILD_ID, "name", db)
    ).rejects.toThrow(/never inherits/);
  });

  it("bails at MAX_PRECEDENCE_DEPTH (3) without infinite loop", async () => {
    // 5-deep chain; resolver should stop at depth 3 even if the value is at depth 4
    const id4 = "44444444-4444-4444-4444-444444444444";
    const id5 = "55555555-5555-5555-5555-555555555555";
    const db = mockDb([
      { id: CHILD_ID, parent_school_id: PARENT_ID, default_grading_scale: null },
      { id: PARENT_ID, parent_school_id: GRANDPARENT_ID, default_grading_scale: null },
      { id: GRANDPARENT_ID, parent_school_id: id4, default_grading_scale: null },
      { id: id4, parent_school_id: id5, default_grading_scale: "MYP_1_8" },
      { id: id5, parent_school_id: null, default_grading_scale: "GCSE_A_E" },
    ]);
    const result = await resolveSchoolColumn(
      CHILD_ID,
      "default_grading_scale",
      db
    );
    expect(result.value).toBeNull();
  });
});

describe("resolveSchoolSettings", () => {
  it("resolves all inheritable columns in one pass", async () => {
    const db = mockDb([
      {
        id: CHILD_ID,
        parent_school_id: PARENT_ID,
        academic_calendar_jsonb: { terms: ["T1"] },
        timetable_skeleton_jsonb: null,
        frameworks_in_use_jsonb: null,
        default_grading_scale: null,
        notification_branding_jsonb: null,
        safeguarding_contacts_jsonb: null,
        default_student_ai_budget: null,
      },
      {
        id: PARENT_ID,
        parent_school_id: null,
        academic_calendar_jsonb: { terms: ["P1"] },
        timetable_skeleton_jsonb: { periods: 6 },
        frameworks_in_use_jsonb: ["MYP"],
        default_grading_scale: "MYP_1_8",
        notification_branding_jsonb: { sender: "NIS" },
        safeguarding_contacts_jsonb: ["safe@nis.org.cn"],
        default_student_ai_budget: 100000,
      },
    ]);
    const result = await resolveSchoolSettings(CHILD_ID, db);

    // Child wins for academic_calendar
    expect(result.academic_calendar_jsonb).toMatchObject({
      value: { terms: ["T1"] },
      source: "own",
      depth: 0,
    });
    // Parent wins for everything else
    expect(result.default_grading_scale).toMatchObject({
      value: "MYP_1_8",
      source: "inherited",
      depth: 1,
    });
    expect(result.default_student_ai_budget).toMatchObject({
      value: 100000,
      source: "inherited",
    });
  });

  it("returns null entries when chain has no value", async () => {
    const db = mockDb([
      {
        id: CHILD_ID,
        parent_school_id: null,
        academic_calendar_jsonb: null,
        timetable_skeleton_jsonb: null,
        frameworks_in_use_jsonb: null,
        default_grading_scale: null,
        notification_branding_jsonb: null,
        safeguarding_contacts_jsonb: null,
        default_student_ai_budget: null,
      },
    ]);
    const result = await resolveSchoolSettings(CHILD_ID, db);
    for (const col of INHERITABLE_COLUMNS) {
      expect(result[col].value).toBeNull();
    }
  });

  it("INHERITABLE_COLUMNS export covers all 7 expected entries", () => {
    expect(INHERITABLE_COLUMNS).toEqual([
      "academic_calendar_jsonb",
      "timetable_skeleton_jsonb",
      "frameworks_in_use_jsonb",
      "default_grading_scale",
      "notification_branding_jsonb",
      "safeguarding_contacts_jsonb",
      "default_student_ai_budget",
    ]);
  });
});
