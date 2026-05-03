/**
 * Tests for src/lib/access-v2/data-subject/delete-student.ts (Phase 5.4).
 *
 * Coverage:
 *   - Happy path: soft-delete + scheduled_deletions row + audit
 *   - Idempotent path: already-deleted student returns existing schedule
 *   - Race-handler: insert conflict reads existing row
 *   - student_not_found shape
 *   - db_error during read / soft-delete / insert
 *   - 30-day horizon = scheduled_for
 *   - Audit emitted with failureMode 'throw' + correct payload
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { softDeleteStudent } from "../delete-student";

const logAuditEventSpy = vi.fn(async () => ({ ok: true }));
vi.mock("../../audit-log", () => ({
  logAuditEvent: (
    supabase: unknown,
    input: Record<string, unknown>,
  ) => logAuditEventSpy(supabase, input),
}));

interface MockState {
  student?: { id: string; school_id: string | null; deleted_at: string | null } | null;
  studentReadError?: { message: string } | null;
  existingSchedule?: { id: string; scheduled_for: string } | null;
  softDeleteError?: { message: string } | null;
  insertResult?:
    | { data: { id: string; scheduled_for: string }; error: null }
    | { data: null; error: { message: string } };
  insertReadback?: { id: string; scheduled_for: string } | null;
  capturedSoftUpdate?: { deleted_at: string } | null;
  capturedInsertRow?: Record<string, unknown> | null;
}

function buildClient(state: MockState) {
  state.capturedSoftUpdate = null;
  state.capturedInsertRow = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (table: string): any => {
    if (table === "students") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: state.student ?? null,
              error: state.studentReadError ?? null,
            }),
          }),
        }),
        update: (row: { deleted_at: string }) => ({
          eq: async () => {
            state.capturedSoftUpdate = row;
            return { error: state.softDeleteError ?? null };
          },
        }),
      };
    }
    if (table === "scheduled_deletions") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: state.existingSchedule ?? null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              state.capturedInsertRow = row;
              if (state.insertResult) {
                return state.insertResult;
              }
              return {
                data: {
                  id: "fake-uuid-from-default-mock",
                  scheduled_for: "2026-06-02T14:30:00.000Z",
                },
                error: null,
              };
            },
          }),
        }),
      };
    }
    throw new Error(`Unmocked table: ${table}`);
  };
  return { from: handler } as unknown as Parameters<typeof softDeleteStudent>[0];
}

const STUDENT_ID = "11111111-1111-1111-1111-111111111111";
const SCHOOL_ID = "22222222-2222-2222-2222-222222222222";
const ACTOR_ID = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  logAuditEventSpy.mockClear();
});

describe("softDeleteStudent — happy path", () => {
  it("soft-deletes + schedules + audits when student exists and not yet deleted", async () => {
    const state: MockState = {
      student: { id: STUDENT_ID, school_id: SCHOOL_ID, deleted_at: null },
      insertResult: {
        data: { id: "schedule-uuid", scheduled_for: "2026-06-02T14:30:00.000Z" },
        error: null,
      },
    };
    const supabase = buildClient(state);
    const result = await softDeleteStudent(supabase, STUDENT_ID, ACTOR_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scheduledDeletionId).toBe("schedule-uuid");
      expect(result.scheduledHardDeleteAt).toBe("2026-06-02T14:30:00.000Z");
      expect(result.alreadyScheduled).toBe(false);
    }

    // students.deleted_at was set
    expect(state.capturedSoftUpdate?.deleted_at).toMatch(/^2\d{3}-\d{2}-\d{2}T/);

    // scheduled_deletions row was inserted with correct shape
    expect(state.capturedInsertRow).toMatchObject({
      target_type: "student",
      target_id: STUDENT_ID,
      status: "pending",
      scheduled_by: ACTOR_ID,
    });
    expect(state.capturedInsertRow?.scheduled_for).toMatch(/^2\d{3}-\d{2}-\d{2}T/);

    // Audit emitted with throw + correct shape
    expect(logAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(logAuditEventSpy.mock.calls[0][1]).toMatchObject({
      actorId: ACTOR_ID,
      actorType: "teacher",
      action: "student.deleted.soft",
      targetTable: "students",
      targetId: STUDENT_ID,
      schoolId: SCHOOL_ID,
      severity: "warn",
      failureMode: "throw",
    });
    const auditPayload = (logAuditEventSpy.mock.calls[0][1] as {
      payload: Record<string, unknown>;
    }).payload;
    expect(auditPayload).toMatchObject({
      scheduled_deletion_id: "schedule-uuid",
      scheduled_hard_delete_at: "2026-06-02T14:30:00.000Z",
      already_scheduled: false,
    });
  });

  it("scheduled_for is ~30 days from now (defensive sanity)", async () => {
    const state: MockState = {
      student: { id: STUDENT_ID, school_id: SCHOOL_ID, deleted_at: null },
      insertResult: {
        data: { id: "schedule-uuid", scheduled_for: "2026-06-02T14:30:00.000Z" },
        error: null,
      },
    };
    const supabase = buildClient(state);
    const before = Date.now();
    await softDeleteStudent(supabase, STUDENT_ID, ACTOR_ID);
    const after = Date.now();

    const insertedAt = Date.parse(state.capturedInsertRow!.scheduled_for as string);
    const expectedMin = before + 30 * 24 * 60 * 60 * 1000 - 1000;
    const expectedMax = after + 30 * 24 * 60 * 60 * 1000 + 1000;
    expect(insertedAt).toBeGreaterThanOrEqual(expectedMin);
    expect(insertedAt).toBeLessThanOrEqual(expectedMax);
  });
});

describe("softDeleteStudent — idempotency", () => {
  it("returns existing schedule when student already deleted (no audit re-emit)", async () => {
    const state: MockState = {
      student: {
        id: STUDENT_ID,
        school_id: SCHOOL_ID,
        deleted_at: "2026-04-30T10:00:00.000Z",
      },
      existingSchedule: {
        id: "old-schedule-uuid",
        scheduled_for: "2026-05-30T10:00:00.000Z",
      },
    };
    const supabase = buildClient(state);
    const result = await softDeleteStudent(supabase, STUDENT_ID, ACTOR_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scheduledDeletionId).toBe("old-schedule-uuid");
      expect(result.scheduledHardDeleteAt).toBe("2026-05-30T10:00:00.000Z");
      expect(result.alreadyScheduled).toBe(true);
    }

    // No re-soft-delete (deleted_at was already set)
    expect(state.capturedSoftUpdate).toBeNull();
    // No new insert
    expect(state.capturedInsertRow).toBeNull();
    // No audit re-emit
    expect(logAuditEventSpy).not.toHaveBeenCalled();
  });
});

describe("softDeleteStudent — race condition", () => {
  it("insert conflict → reads existing row + returns it", async () => {
    const state: MockState = {
      student: { id: STUDENT_ID, school_id: SCHOOL_ID, deleted_at: null },
      insertResult: {
        data: null,
        error: { message: "duplicate key value violates unique constraint" },
      },
      existingSchedule: {
        id: "race-winner-uuid",
        scheduled_for: "2026-06-01T00:00:00.000Z",
      },
    };
    const supabase = buildClient(state);
    const result = await softDeleteStudent(supabase, STUDENT_ID, ACTOR_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scheduledDeletionId).toBe("race-winner-uuid");
      expect(result.scheduledHardDeleteAt).toBe("2026-06-01T00:00:00.000Z");
    }
  });

  it("insert conflict + no existing row found → db_error", async () => {
    const state: MockState = {
      student: { id: STUDENT_ID, school_id: SCHOOL_ID, deleted_at: null },
      insertResult: {
        data: null,
        error: { message: "some constraint" },
      },
      existingSchedule: null,
    };
    const supabase = buildClient(state);
    const result = await softDeleteStudent(supabase, STUDENT_ID, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("db_error");
    }
  });
});

describe("softDeleteStudent — error paths", () => {
  it("returns student_not_found when student row doesn't exist", async () => {
    const state: MockState = { student: null };
    const supabase = buildClient(state);
    const result = await softDeleteStudent(supabase, STUDENT_ID, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("student_not_found");
    }
    // No audit emitted on not-found
    expect(logAuditEventSpy).not.toHaveBeenCalled();
  });

  it("returns db_error when initial student read fails", async () => {
    const state: MockState = {
      student: null,
      studentReadError: { message: "connection refused" },
    };
    const supabase = buildClient(state);
    const result = await softDeleteStudent(supabase, STUDENT_ID, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("db_error");
      expect(result.message).toBe("connection refused");
    }
  });

  it("returns db_error when soft-delete UPDATE fails", async () => {
    const state: MockState = {
      student: { id: STUDENT_ID, school_id: SCHOOL_ID, deleted_at: null },
      softDeleteError: { message: "row locked" },
    };
    const supabase = buildClient(state);
    const result = await softDeleteStudent(supabase, STUDENT_ID, ACTOR_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("db_error");
    }
    expect(logAuditEventSpy).not.toHaveBeenCalled();
  });
});
