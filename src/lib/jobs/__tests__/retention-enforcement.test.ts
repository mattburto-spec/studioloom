/**
 * Tests for src/lib/jobs/retention-enforcement.ts (Phase 5.5).
 *
 * v1 manifest is empty by design (taxonomy has 7-year retention for student
 * data, indefinite for everything else). These tests prove the plumbing
 * works end-to-end + the Q7 sanity assertion fires correctly when a
 * future maintainer adds an invalid entry.
 *
 * Coverage:
 *   - Empty manifest → no-op success (no audit, no scheduled_deletions)
 *   - Q7 abort: invalid retentionDays (zero / negative / Infinity / >100yr) →
 *     critical audit + aborted=true (uses test-only injection helper)
 *   - Soft-delete + scheduled_deletions queue happy path
 *   - Per-table error captured but other tables continue
 *   - Audit emit shape (single event per table, not per row)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  run,
  processManifest,
  RETENTION_MANIFEST,
} from "../retention-enforcement";

const logAuditEventSpy = vi.fn(async () => ({ ok: true }));
vi.mock("../../access-v2/audit-log", () => ({
  logAuditEvent: (
    supabase: unknown,
    input: Record<string, unknown>,
  ) => logAuditEventSpy(supabase, input),
}));

interface MockState {
  /** Per-table soft-delete result. */
  softDeletes?: Record<
    string,
    | { rows: Array<{ id: string }>; error?: undefined }
    | { rows?: undefined; error: { message: string } }
  >;
  /** Captured INSERT into scheduled_deletions. */
  capturedInserts?: Array<unknown[]>;
}

function buildClient(state: MockState) {
  state.capturedInserts = state.capturedInserts ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (table: string): any => {
    if (table === "scheduled_deletions") {
      return {
        insert: async (rows: unknown[]) => {
          state.capturedInserts!.push(rows);
          return { error: null };
        },
      };
    }
    // Soft-delete chain: from(table).update(...).is(...).lt(...).select("id")
    return {
      update: () => ({
        is: () => ({
          lt: () => ({
            select: async () => {
              const result = state.softDeletes?.[table];
              if (!result) return { data: [], error: null };
              if (result.error) return { data: null, error: result.error };
              return { data: result.rows, error: null };
            },
          }),
        }),
      }),
    };
  };
  return { from: handler } as unknown as Parameters<typeof run>[0];
}

beforeEach(() => {
  logAuditEventSpy.mockClear();
});

describe("retention-enforcement — empty manifest (v1)", () => {
  it("RETENTION_MANIFEST is empty by design", () => {
    expect(RETENTION_MANIFEST).toEqual([]);
  });

  it("run() returns success no-op when manifest is empty", async () => {
    const supabase = buildClient({});
    const result = await run(supabase);
    expect(result.runId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.aborted).toBeUndefined();
    expect(result.summary).toEqual({
      tables: [],
      total_soft_deleted: 0,
    });
    expect(logAuditEventSpy).not.toHaveBeenCalled();
  });
});

// For the manifest-driven tests below, we simulate manifest entries by
// requiring + reassigning the constant. Since the export is `Object.freeze([])`,
// we can't mutate; instead we test the inner functions directly via a
// re-imported module that overrides the manifest. The simpler path is to
// verify behaviour via the structural invariants the manifest enforces +
// run() top-level result shape.

describe("retention-enforcement — run() shape", () => {
  it("returns runId, startedAt, completedAt, summary", async () => {
    const supabase = buildClient({});
    const result = await run(supabase);
    expect(result).toHaveProperty("runId");
    expect(result).toHaveProperty("startedAt");
    expect(result).toHaveProperty("completedAt");
    expect(result).toHaveProperty("summary");
    expect(result.summary).toHaveProperty("tables");
    expect(result.summary).toHaveProperty("total_soft_deleted");
  });

  it("startedAt and completedAt are valid ISO timestamps", async () => {
    const supabase = buildClient({});
    const result = await run(supabase);
    expect(result.startedAt).toMatch(/^2\d{3}-\d{2}-\d{2}T/);
    expect(result.completedAt).toMatch(/^2\d{3}-\d{2}-\d{2}T/);
    expect(Date.parse(result.completedAt)).toBeGreaterThanOrEqual(
      Date.parse(result.startedAt),
    );
  });

  it("each run gets a unique UUID", async () => {
    const supabase = buildClient({});
    const r1 = await run(supabase);
    const r2 = await run(supabase);
    expect(r1.runId).not.toBe(r2.runId);
  });
});

// To exercise the Q7 sanity assertion + the soft-delete happy path, we
// call processManifest() directly with synthetic manifests. The exported
// const is empty in v1; processManifest() is the testability seam.

describe("retention-enforcement — Q7 sanity assertion (processManifest)", () => {
  it("zero retentionDays → critical audit + aborted=true", async () => {
    const supabase = buildClient({});
    const result = await processManifest(supabase, [
      { table: "ai_usage_log", retentionDays: 0, basis: "legitimate_interest" },
    ]);
    expect(result.aborted).toBe(true);
    expect(result.abortReason).toMatch(/retentionDays=0/);
    expect(result.summary.tables).toEqual([]);
    expect(logAuditEventSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "retention.aborted",
        actorType: "system",
        severity: "critical",
        failureMode: "throw",
      }),
    );
  });

  it("negative retentionDays → aborted", async () => {
    const supabase = buildClient({});
    const result = await processManifest(supabase, [
      { table: "junk", retentionDays: -1 },
    ]);
    expect(result.aborted).toBe(true);
  });

  it("retentionDays > 100 years (sanity bound) → aborted", async () => {
    const supabase = buildClient({});
    const result = await processManifest(supabase, [
      { table: "junk", retentionDays: 99_999_999 },
    ]);
    expect(result.aborted).toBe(true);
  });

  it("Infinity retentionDays → aborted", async () => {
    const supabase = buildClient({});
    const result = await processManifest(supabase, [
      { table: "junk", retentionDays: Infinity },
    ]);
    expect(result.aborted).toBe(true);
  });

  it("first invalid entry aborts even if later entries are valid", async () => {
    const supabase = buildClient({
      softDeletes: { students: { rows: [{ id: "ok-1" }] } },
    });
    const result = await processManifest(supabase, [
      { table: "junk", retentionDays: -5 },
      { table: "students", retentionDays: 365 },
    ]);
    expect(result.aborted).toBe(true);
    // No table processed
    expect(result.summary.tables).toEqual([]);
  });
});

describe("retention-enforcement — happy path (processManifest)", () => {
  it("soft-deletes + writes scheduled_deletions + emits one audit per table", async () => {
    const state: MockState = {
      softDeletes: {
        students: {
          rows: [{ id: "stu-1" }, { id: "stu-2" }, { id: "stu-3" }],
        },
      },
    };
    const supabase = buildClient(state);
    const result = await processManifest(supabase, [
      { table: "students", retentionDays: 365, basis: "coppa_art_6" },
    ]);

    expect(result.aborted).toBeUndefined();
    expect(result.summary.total_soft_deleted).toBe(3);
    expect(result.summary.tables).toEqual([
      { table: "students", retentionDays: 365, soft_deleted: 3 },
    ]);

    // scheduled_deletions row inserted for each soft-deleted target
    expect(state.capturedInserts).toHaveLength(1);
    expect(state.capturedInserts![0]).toHaveLength(3);
    expect(state.capturedInserts![0][0]).toMatchObject({
      target_type: "student",
      target_id: "stu-1",
      status: "pending",
    });

    // ONE audit event per table per run (not one per row — flooding guard)
    expect(logAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(logAuditEventSpy.mock.calls[0][1]).toMatchObject({
      action: "retention.soft_delete",
      actorType: "system",
      severity: "info",
      failureMode: "throw",
      targetTable: "students",
    });
    const payload = (logAuditEventSpy.mock.calls[0][1] as {
      payload: Record<string, unknown>;
    }).payload;
    expect(payload).toMatchObject({
      retention_days: 365,
      basis: "coppa_art_6",
      soft_deleted_count: 3,
    });
  });

  it("per-table error captured; processing continues; no audit for the failed table", async () => {
    const state: MockState = {
      softDeletes: {
        students: { error: { message: "RLS denied" } },
        teachers: { rows: [{ id: "t-1" }] },
      },
    };
    const supabase = buildClient(state);
    const result = await processManifest(supabase, [
      { table: "students", retentionDays: 365 },
      { table: "teachers", retentionDays: 365 },
    ]);

    expect(result.aborted).toBeUndefined();
    expect(result.summary.total_soft_deleted).toBe(1);
    const studentsResult = result.summary.tables.find(
      (t) => t.table === "students",
    );
    expect(studentsResult).toMatchObject({
      table: "students",
      soft_deleted: 0,
      error: "RLS denied",
    });
    const teachersResult = result.summary.tables.find(
      (t) => t.table === "teachers",
    );
    expect(teachersResult?.soft_deleted).toBe(1);

    // 1 audit emit (only for teachers — students errored)
    expect(logAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(logAuditEventSpy.mock.calls[0][1]).toMatchObject({
      targetTable: "teachers",
    });
  });

  it("zero soft-deleted rows → no scheduled_deletions insert + no audit", async () => {
    const state: MockState = {
      softDeletes: { students: { rows: [] } },
    };
    const supabase = buildClient(state);
    const result = await processManifest(supabase, [
      { table: "students", retentionDays: 365 },
    ]);

    expect(result.summary.total_soft_deleted).toBe(0);
    expect(result.summary.tables[0].soft_deleted).toBe(0);
    expect(state.capturedInserts).toHaveLength(0);
    expect(logAuditEventSpy).not.toHaveBeenCalled();
  });

  it("unknown table maps to no scheduled_deletions row but soft-delete still fires", async () => {
    // mapTableToTargetType returns null for tables outside students/teachers/units.
    // The soft-delete UPDATE still happens; just no scheduled_deletions queue entry.
    const state: MockState = {
      softDeletes: { ai_usage_log: { rows: [{ id: "log-1" }] } },
    };
    const supabase = buildClient(state);
    const result = await processManifest(supabase, [
      { table: "ai_usage_log", retentionDays: 365 },
    ]);
    expect(result.summary.tables[0].soft_deleted).toBe(1);
    // No scheduled_deletions insert because target_type doesn't map
    expect(state.capturedInserts).toHaveLength(0);
    // Audit DOES fire — soft-delete happened
    expect(logAuditEventSpy).toHaveBeenCalledTimes(1);
  });
});
