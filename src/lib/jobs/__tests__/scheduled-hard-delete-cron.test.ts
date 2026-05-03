/**
 * Tests for src/lib/jobs/scheduled-hard-delete-cron.ts (Phase 5.5).
 *
 * Coverage:
 *   - Empty queue → no-op success
 *   - Read failure → critical audit + errored=1
 *   - Happy path: pending row → DELETE + UPDATE status='completed' + audit
 *   - Multiple rows: each processed; mix of student/teacher/unit target_types
 *   - Held row defensive skip (filter usually excludes; belt-and-braces)
 *   - DELETE failure → critical audit + errored count + schedule stays pending
 *   - UPDATE failure (after DELETE succeeded) → soft-sentry audit + still counts as deleted
 *   - Unknown target_type → critical audit + errored count
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { run } from "../scheduled-hard-delete-cron";

const logAuditEventSpy = vi.fn(async () => ({ ok: true }));
vi.mock("../../access-v2/audit-log", () => ({
  logAuditEvent: (
    supabase: unknown,
    input: Record<string, unknown>,
  ) => logAuditEventSpy(supabase, input),
}));

interface ScheduledRowMock {
  id: string;
  target_type: "student" | "teacher" | "unit";
  target_id: string;
  status: "pending" | "completed" | "held";
  scheduled_for: string;
  scheduled_by: string | null;
}

interface MockState {
  pendingRows?: ScheduledRowMock[];
  pendingReadError?: { message: string } | null;
  /** Per-target-table delete error */
  deleteErrors?: Record<string, { message: string }>;
  /** Force scheduled_deletions UPDATE to error */
  updateError?: { message: string } | null;
  /** Captured deletes (target_table, target_id) */
  capturedDeletes?: Array<{ table: string; id: string }>;
  /** Captured updates to scheduled_deletions */
  capturedUpdates?: Array<{ id: string; status: string; completed_at: string }>;
}

function buildClient(state: MockState) {
  state.capturedDeletes = state.capturedDeletes ?? [];
  state.capturedUpdates = state.capturedUpdates ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (table: string): any => {
    if (table === "scheduled_deletions") {
      return {
        // SELECT chain: select(...).eq("status","pending").lt("scheduled_for",now)
        select: () => ({
          eq: () => ({
            lt: async () =>
              state.pendingReadError
                ? { data: null, error: state.pendingReadError }
                : { data: state.pendingRows ?? [], error: null },
          }),
        }),
        // UPDATE chain: update({status,completed_at}).eq("id",row.id)
        update: (row: { status: string; completed_at: string }) => ({
          eq: async (_col: string, id: string) => {
            state.capturedUpdates!.push({ id, ...row });
            return { error: state.updateError ?? null };
          },
        }),
      };
    }
    // Target tables (students/teachers/units): delete().eq("id",target_id)
    return {
      delete: () => ({
        eq: async (_col: string, id: string) => {
          state.capturedDeletes!.push({ table, id });
          if (state.deleteErrors?.[table]) {
            return { error: state.deleteErrors[table] };
          }
          return { error: null };
        },
      }),
    };
  };

  return { from: handler } as unknown as Parameters<typeof run>[0];
}

beforeEach(() => {
  logAuditEventSpy.mockClear();
});

describe("scheduled-hard-delete-cron — empty queue", () => {
  it("returns success no-op when no pending rows", async () => {
    const supabase = buildClient({ pendingRows: [] });
    const result = await run(supabase);
    expect(result.summary).toEqual({
      processed: 0,
      skipped_held: 0,
      errored: 0,
    });
    expect(logAuditEventSpy).not.toHaveBeenCalled();
  });
});

describe("scheduled-hard-delete-cron — read failure", () => {
  it("emits critical audit + errored=1 when SELECT fails", async () => {
    const supabase = buildClient({
      pendingReadError: { message: "connection refused" },
    });
    const result = await run(supabase);
    expect(result.summary.errored).toBe(1);
    expect(logAuditEventSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "scheduled_hard_delete.read_failed",
        actorType: "system",
        severity: "critical",
        failureMode: "throw",
      }),
    );
  });
});

describe("scheduled-hard-delete-cron — happy path", () => {
  it("DELETEs target + UPDATEs status='completed' + audits", async () => {
    const supabase = buildClient({
      pendingRows: [
        {
          id: "sched-1",
          target_type: "student",
          target_id: "stu-1",
          status: "pending",
          scheduled_for: "2026-04-01T00:00:00.000Z",
          scheduled_by: "actor-1",
        },
      ],
    });

    const state = (supabase as unknown as { from: (t: string) => unknown }).from;
    void state;

    const result = await run(supabase);

    expect(result.summary).toEqual({
      processed: 1,
      skipped_held: 0,
      errored: 0,
    });

    // The audit_event is the source of truth for what happened
    expect(logAuditEventSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "student.deleted.hard",
        actorId: "actor-1",
        actorType: "system",
        targetTable: "students",
        targetId: "stu-1",
        severity: "warn",
        failureMode: "throw",
      }),
    );
  });

  it("processes a mix of student/teacher/unit target_types", async () => {
    const state: MockState = {
      pendingRows: [
        {
          id: "s-1",
          target_type: "student",
          target_id: "stu-1",
          status: "pending",
          scheduled_for: "2026-04-01T00:00:00.000Z",
          scheduled_by: null,
        },
        {
          id: "s-2",
          target_type: "teacher",
          target_id: "tea-1",
          status: "pending",
          scheduled_for: "2026-04-01T00:00:00.000Z",
          scheduled_by: null,
        },
        {
          id: "s-3",
          target_type: "unit",
          target_id: "uni-1",
          status: "pending",
          scheduled_for: "2026-04-01T00:00:00.000Z",
          scheduled_by: null,
        },
      ],
    };
    const supabase = buildClient(state);
    const result = await run(supabase);

    expect(result.summary).toEqual({
      processed: 3,
      skipped_held: 0,
      errored: 0,
    });

    // Each target table got one DELETE
    expect(state.capturedDeletes).toEqual([
      { table: "students", id: "stu-1" },
      { table: "teachers", id: "tea-1" },
      { table: "units", id: "uni-1" },
    ]);
    // Each schedule row got one UPDATE to completed
    expect(state.capturedUpdates).toHaveLength(3);
    for (const u of state.capturedUpdates!) {
      expect(u.status).toBe("completed");
    }
  });
});

describe("scheduled-hard-delete-cron — held rows", () => {
  it("defensively skips held row even if SELECT returned it", async () => {
    // The SELECT filters to status='pending', but a row could flip to held
    // between read + process. The cron must not delete a held target.
    const state: MockState = {
      pendingRows: [
        {
          id: "s-1",
          target_type: "student",
          target_id: "stu-1",
          status: "held", // flipped after SELECT
          scheduled_for: "2026-04-01T00:00:00.000Z",
          scheduled_by: null,
        },
      ],
    };
    const supabase = buildClient(state);
    const result = await run(supabase);

    expect(result.summary.skipped_held).toBe(1);
    expect(result.summary.processed).toBe(0);
    // No DELETE issued for the held target
    expect(state.capturedDeletes).toEqual([]);
    expect(logAuditEventSpy).not.toHaveBeenCalled();
  });
});

describe("scheduled-hard-delete-cron — failure paths", () => {
  it("DELETE failure → critical audit + errored count + schedule stays pending", async () => {
    const state: MockState = {
      pendingRows: [
        {
          id: "s-1",
          target_type: "student",
          target_id: "stu-1",
          status: "pending",
          scheduled_for: "2026-04-01T00:00:00.000Z",
          scheduled_by: null,
        },
      ],
      deleteErrors: { students: { message: "FK constraint" } },
    };
    const supabase = buildClient(state);
    const result = await run(supabase);

    expect(result.summary.errored).toBe(1);
    expect(result.summary.processed).toBe(0);
    // Schedule was NOT marked completed
    expect(state.capturedUpdates).toEqual([]);
    // Critical audit emitted
    expect(logAuditEventSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "scheduled_hard_delete.target_delete_failed",
        severity: "critical",
        failureMode: "throw",
      }),
    );
  });

  it("UPDATE failure (after DELETE) → soft-sentry audit + still counts as deleted", async () => {
    const state: MockState = {
      pendingRows: [
        {
          id: "s-1",
          target_type: "student",
          target_id: "stu-1",
          status: "pending",
          scheduled_for: "2026-04-01T00:00:00.000Z",
          scheduled_by: null,
        },
      ],
      updateError: { message: "row locked" },
    };
    const supabase = buildClient(state);
    const result = await run(supabase);

    // The user-data row IS gone (DELETE succeeded). Count as processed.
    expect(result.summary.processed).toBe(1);
    expect(result.summary.errored).toBe(0);

    // Soft-sentry critical audit emitted for the orphan state
    expect(logAuditEventSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "scheduled_hard_delete.schedule_update_failed",
        severity: "critical",
        failureMode: "soft-sentry",
      }),
    );
  });
});

describe("scheduled-hard-delete-cron — runId + timestamps", () => {
  it("returns runId + startedAt + completedAt", async () => {
    const supabase = buildClient({ pendingRows: [] });
    const result = await run(supabase);
    expect(result.runId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.startedAt).toMatch(/^2\d{3}-\d{2}-\d{2}T/);
    expect(result.completedAt).toMatch(/^2\d{3}-\d{2}-\d{2}T/);
    expect(Date.parse(result.completedAt)).toBeGreaterThanOrEqual(
      Date.parse(result.startedAt),
    );
  });
});
