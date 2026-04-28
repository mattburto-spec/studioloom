import { describe, it, expect } from "vitest";
import {
  listFabricatorQueue,
  getFabJobDetail,
  pickupJob,
  markComplete,
  markFailed,
} from "../fab-orchestration";

/**
 * Phase 7-1 fab-orchestration unit tests. Pure logic — Supabase
 * client faked as a query-builder chain matching the shape used by
 * teacher-orchestration.test.ts + orchestration.test.ts.
 *
 * Coverage goals per Phase 7 brief §4:
 *   - Machine-scoped visibility: queue filtered by `fabricator_machines`
 *   - Pickup race-safety: conditional update + post-write confirm
 *   - Idempotent re-download: same fabricator, same picked-up job
 *   - Complete/fail own-picked-up regardless of current assignment (§11 Q8)
 *   - Fail requires non-empty note (stop-trigger in brief §5)
 *   - Completion status derived from machine category (printer→printed / laser→cut)
 */

// ============================================================
// Shared fake: configurable query-builder
// ============================================================

interface FakeOpts {
  /** Which machine_profile_id's the fabricator is assigned to. */
  assignedMachineIds?: string[];
  /** Overrides the fabricator-assignments lookup to return an error. */
  assignmentLookupError?: string;
  /** Phase 8.1d-9: who invited this fabricator. Drives the new
   *  scope-by-teacher visibility model. Default "teacher-1". Set to
   *  null to simulate inactive/missing fabricator. */
  inviterTeacherId?: string | null;
  /** Force the fabricators.maybeSingle() lookup to error. */
  fabricatorLookupError?: string;
  /** Job row if looked up — null = not-found (404), an object = found. */
  jobRow?: {
    id: string;
    status: string;
    machine_profile_id: string;
    lab_tech_picked_up_by: string | null;
    current_revision?: number;
    teacher_id?: string;
  } | null;
  /** For detail tests: joined student / class / unit / machine nested rows. */
  detailJobOverrides?: Record<string, unknown>;
  /** For pickup confirm-read: override what the confirm lookup returns. */
  confirmPickedUpBy?: string | null;
  confirmPickedUpAt?: string | null;
  confirmStatus?: string;
  /** Current-revision row for storage_path lookup in pickup success. */
  currentRevisionRow?: { storage_path: string } | null;
  /** Machine category returned for complete/fail derivation. */
  machineCategory?: "3d_printer" | "laser_cutter" | null;
  /** Force errors on specific operations. */
  jobLookupError?: string;
  updateError?: string;
  confirmLookupError?: string;
}

function makeFakeClient(opts: FakeOpts = {}) {
  const log: Array<{
    table: string;
    op: string;
    eq: Array<[string, unknown]>;
    payload?: Record<string, unknown>;
    selectCols?: string;
  }> = [];

  // Multi-call state: each `.from(table).select(...).eq(...).maybeSingle()`
  // or range resolves based on which table + which eq keys are present.
  // We track how many times fabrication_jobs.maybeSingle has been
  // called so pickupJob can distinguish the initial ownership read
  // from the post-update confirm read + the storage-path lookup.
  let fabJobMaybeSingleCalls = 0;

  const tableHandler = (table: string) => {
    const entry: {
      table: string;
      op: string;
      eq: Array<[string, unknown]>;
      payload?: Record<string, unknown>;
      selectCols?: string;
    } = { table, op: "select", eq: [] };

    const chain: Record<string, unknown> = {};
    chain.select = (cols: string) => {
      entry.selectCols = cols;
      return chain;
    };
    chain.eq = (col: string, val: unknown) => {
      entry.eq.push([col, val]);
      return chain;
    };
    chain.in = (col: string, vals: unknown[]) => {
      entry.eq.push([col, vals]);
      return chain;
    };
    // Phase 8.1d-20: PostgREST `.gte` for the done_today tab's
    // completed_at >= today's UTC midnight filter. Recorded in
    // entry.eq the same way as `.eq` so test assertions can find
    // the col=completed_at filter.
    chain.gte = (col: string, val: unknown) => {
      entry.eq.push([col, val]);
      return chain;
    };
    chain.order = () => chain;
    chain.range = async () => {
      log.push({ ...entry });
      // fabrication_jobs range = queue list (ready or in_progress).
      if (table === "fabrication_jobs") {
        return { data: [], error: null };
      }
      return { data: [], error: null };
    };
    chain.maybeSingle = async () => {
      log.push({ ...entry });
      if (table === "fabricator_machines") {
        // (handled by .select().eq().then thenable — see below)
        return { data: null, error: null };
      }
      // Phase 8.1d-9: fabricators.maybeSingle() returns the inviter
      // teacher id. Drives the new scope-by-teacher model.
      if (table === "fabricators") {
        if (opts.fabricatorLookupError) {
          return { data: null, error: { message: opts.fabricatorLookupError } };
        }
        if (opts.inviterTeacherId === null) {
          return { data: null, error: null };
        }
        return {
          data: {
            invited_by_teacher_id: opts.inviterTeacherId ?? "teacher-1",
            is_active: true,
          },
          error: null,
        };
      }
      // Phase 8.1d-39 (audit HIGH-2/3): fabricatorSchoolContext
      // resolves the inviting teacher's school_id via a maybeSingle
      // on teachers. Default school is "school-1"; tests can
      // override via opts.inviterSchoolId.
      if (table === "teachers") {
        if (opts.teacherSchoolLookupError) {
          return {
            data: null,
            error: { message: opts.teacherSchoolLookupError },
          };
        }
        if (opts.inviterSchoolId === null) {
          return { data: { school_id: null }, error: null };
        }
        return {
          data: { school_id: opts.inviterSchoolId ?? "school-1" },
          error: null,
        };
      }
      if (table === "fabrication_jobs") {
        fabJobMaybeSingleCalls++;
        if (opts.jobLookupError) {
          return { data: null, error: { message: opts.jobLookupError } };
        }
        // pickup flow: first call = ownership lookup; second = confirm;
        // there's also currentRevisionStoragePath which hits
        // fabrication_jobs for `current_revision`.
        const isConfirmCall =
          fabJobMaybeSingleCalls === 2 &&
          entry.selectCols ===
            "lab_tech_picked_up_by, lab_tech_picked_up_at, status";
        if (isConfirmCall) {
          if (opts.confirmLookupError) {
            return { data: null, error: { message: opts.confirmLookupError } };
          }
          return {
            data: {
              lab_tech_picked_up_by: opts.confirmPickedUpBy ?? null,
              lab_tech_picked_up_at: opts.confirmPickedUpAt ?? null,
              status: opts.confirmStatus ?? "picked_up",
            },
            error: null,
          };
        }
        const isCurrentRevRead =
          entry.selectCols === "current_revision";
        if (isCurrentRevRead) {
          return {
            data: { current_revision: opts.jobRow?.current_revision ?? 1 },
            error: null,
          };
        }
        return opts.jobRow === undefined
          ? { data: null, error: null }
          : opts.jobRow === null
            ? { data: null, error: null }
            : {
                // Phase 8.1d-9: default teacher_id matches the
                // default inviter ("teacher-1") so existing tests
                // don't need an explicit teacher_id on every jobRow.
                data: {
                  teacher_id: opts.inviterTeacherId ?? "teacher-1",
                  ...opts.jobRow,
                  ...opts.detailJobOverrides,
                },
                error: null,
              };
      }
      if (table === "fabrication_job_revisions") {
        return {
          data: opts.currentRevisionRow ?? null,
          error: null,
        };
      }
      if (table === "machine_profiles") {
        return {
          data: { machine_category: opts.machineCategory ?? null },
          error: null,
        };
      }
      return { data: null, error: null };
    };
    chain.update = (payload: Record<string, unknown>) => {
      entry.op = "update";
      entry.payload = payload;
      const updChain: Record<string, unknown> = {};
      updChain.eq = (col: string, val: unknown) => {
        entry.eq.push([col, val]);
        return updChain;
      };
      updChain.then = (resolve: (v: unknown) => unknown) => {
        log.push({ ...entry });
        if (opts.updateError) {
          return Promise.resolve(
            resolve({ error: { message: opts.updateError } })
          );
        }
        return Promise.resolve(resolve({ error: null }));
      };
      return updChain;
    };

    // Phase 8.1d-39 (audit HIGH-2/3): teachers.select("id").eq("school_id", X)
    // returns the list of same-school teacher IDs. No .maybeSingle()
    // — the chain is awaited directly. Default returns the inviter's
    // own ID; tests can override via opts.sameSchoolTeacherIds.
    if (table === "teachers") {
      const teachersChain: Record<string, unknown> = {};
      teachersChain.select = (cols: string) => {
        entry.selectCols = cols;
        return teachersChain;
      };
      teachersChain.eq = (col: string, val: unknown) => {
        entry.eq.push([col, val]);
        // Maintain a thenable chain for the school-scoped teacher list.
        const thenable: Record<string, unknown> = {
          then: (resolve: (v: unknown) => unknown) => {
            log.push({ ...entry });
            if (opts.sameSchoolLookupError) {
              return Promise.resolve(
                resolve({
                  data: null,
                  error: { message: opts.sameSchoolLookupError },
                })
              );
            }
            const ids = opts.sameSchoolTeacherIds ?? [
              opts.inviterTeacherId ?? "teacher-1",
            ];
            return Promise.resolve(
              resolve({
                data: ids.map((id) => ({ id })),
                error: null,
              })
            );
          },
        };
        thenable.maybeSingle = chain.maybeSingle as () => Promise<unknown>;
        return thenable;
      };
      return teachersChain;
    }

    // fabricator_machines assignments: .select("machine_profile_id").eq()
    // returns array directly (not maybeSingle). Implement as a thenable
    // on the chain after .eq is called.
    if (table === "fabricator_machines") {
      chain.eq = (col: string, val: unknown) => {
        entry.eq.push([col, val]);
        const thenable: Record<string, unknown> = {
          then: (resolve: (v: unknown) => unknown) => {
            log.push({ ...entry });
            if (opts.assignmentLookupError) {
              return Promise.resolve(
                resolve({
                  data: null,
                  error: { message: opts.assignmentLookupError },
                })
              );
            }
            const ids = opts.assignedMachineIds ?? [];
            return Promise.resolve(
              resolve({
                data: ids.map((id) => ({ machine_profile_id: id })),
                error: null,
              })
            );
          },
        };
        return thenable;
      };
    }

    return chain;
  };

  const storage = {
    from: () => ({
      createSignedUrl: async () => ({
        data: { signedUrl: "https://signed.example/foo" },
        error: null,
      }),
    }),
  };

  return {
    client: { from: tableHandler, storage } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    log,
  };
}

// ============================================================
// listFabricatorQueue
// ============================================================

describe("listFabricatorQueue", () => {
  // Phase 8.1d-9: tests rewritten for the scope-by-inviter model.
  // Fabricator sees ALL jobs from their inviting teacher, not filtered
  // by per-machine `fabricator_machines` junction.

  it("returns empty when fabricator is missing/inactive (no inviter)", async () => {
    const { client } = makeFakeClient({ inviterTeacherId: null });
    const result = await listFabricatorQueue(client, {
      fabricatorId: "fab-1",
      tab: "ready",
    });
    expect(result).toEqual({ jobs: [] });
  });

  it("filters by status=approved on 'ready' tab", async () => {
    const { client, log } = makeFakeClient({});
    await listFabricatorQueue(client, { fabricatorId: "fab-1", tab: "ready" });
    const jobQuery = log.find((l) => l.table === "fabrication_jobs");
    const hasApprovedFilter = jobQuery?.eq.some(
      ([col, val]) => col === "status" && val === "approved"
    );
    expect(hasApprovedFilter).toBe(true);
  });

  it("filters by status=picked_up + picked_up_by=self on 'in_progress' tab", async () => {
    const { client, log } = makeFakeClient({});
    await listFabricatorQueue(client, {
      fabricatorId: "fab-7",
      tab: "in_progress",
    });
    const jobQuery = log.find((l) => l.table === "fabrication_jobs");
    const filters = jobQuery?.eq ?? [];
    expect(
      filters.some(([col, val]) => col === "status" && val === "picked_up")
    ).toBe(true);
    expect(
      filters.some(([col, val]) => col === "lab_tech_picked_up_by" && val === "fab-7")
    ).toBe(true);
  });

  it("scopes teacher_id IN same-school teachers (Phase 8.1d-39 audit HIGH-2 — was teacher-scoped)", async () => {
    const { client, log } = makeFakeClient({
      inviterTeacherId: "teacher-99",
      sameSchoolTeacherIds: ["teacher-99", "teacher-100", "teacher-101"],
    });
    await listFabricatorQueue(client, { fabricatorId: "fab-1", tab: "ready" });
    const jobQuery = log.find((l) => l.table === "fabrication_jobs");
    const teacherFilter = jobQuery?.eq.find(([col]) => col === "teacher_id");
    expect(teacherFilter).toBeDefined();
    // Now matches IN list of same-school teachers, not a single inviter.
    expect(teacherFilter?.[1]).toEqual([
      "teacher-99",
      "teacher-100",
      "teacher-101",
    ]);
    // Crucially: NO per-machine filter (was Phase 8.1d-9 contract; still holds).
    const machineFilter = jobQuery?.eq.find(
      ([col]) => col === "machine_profile_id"
    );
    expect(machineFilter).toBeUndefined();
  });

  it("surfaces fabricator-lookup errors as 500", async () => {
    const { client } = makeFakeClient({
      fabricatorLookupError: "connection dropped",
    });
    const result = await listFabricatorQueue(client, {
      fabricatorId: "fab-1",
      tab: "ready",
    });
    if (!("error" in result)) throw new Error("expected error shape");
    expect(result.error.status).toBe(500);
    expect(result.error.message).toContain("connection dropped");
  });

  // Phase 8.1d-20: done_today is a new tab supporting the dashboard
  // redesign. Locks the contract:
  //   - status filter = "completed"
  //   - completed_at >= UTC midnight of today
  //   - sort key = completed_at DESC (newest finish first)
  //   - NO scope by lab_tech_picked_up_by (team output, not just self)
  it("filters status=completed + completed_at >= UTC midnight on 'done_today' tab", async () => {
    const { client, log } = makeFakeClient({});
    await listFabricatorQueue(client, {
      fabricatorId: "fab-1",
      tab: "done_today",
    });
    const jobQuery = log.find((l) => l.table === "fabrication_jobs");
    const filters = jobQuery?.eq ?? [];
    expect(
      filters.some(([col, val]) => col === "status" && val === "completed")
    ).toBe(true);

    // Should NOT filter by lab_tech_picked_up_by — done_today shows
    // the whole team's output for collection-readiness, not just
    // jobs THIS fabricator picked up.
    const selfFilter = filters.find(([col]) => col === "lab_tech_picked_up_by");
    expect(selfFilter).toBeUndefined();

    // Should still scope by inviting teacher_id.
    const teacherFilter = filters.find(([col]) => col === "teacher_id");
    expect(teacherFilter).toBeDefined();
  });
});

// ============================================================
// getFabJobDetail
// ============================================================

describe("getFabJobDetail", () => {
  it("allows access when job.machine is currently assigned to fabricator", async () => {
    const { client } = makeFakeClient({
      assignedMachineIds: ["machine-1"],
      jobRow: {
        id: "job-1",
        status: "approved",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: null,
        current_revision: 1,
      },
      detailJobOverrides: {
        file_type: "stl",
        original_filename: "x.stl",
        teacher_review_note: null,
        lab_tech_picked_up_at: null,
        completion_status: null,
        completion_note: null,
        completed_at: null,
        notifications_sent: null,
        student_id: "student-1",
        class_id: null,
        unit_id: null,
        students: { display_name: "Kai", username: "kai" },
        classes: null,
        units: null,
        machine_profiles: {
          id: "machine-1",
          name: "Bambu X1",
          machine_category: "3d_printer",
        },
      },
    });
    const result = await getFabJobDetail(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
    });
    if ("error" in result) throw new Error("expected success");
    expect(result.job.id).toBe("job-1");
    expect(result.machine.name).toBe("Bambu X1");
  });

  it("allows access when fabricator already picked_up this job — even if unassigned since", async () => {
    const { client } = makeFakeClient({
      // Fabricator NO LONGER assigned to this machine (empty list) but
      // they still own the pickup, so detail view should work (§11 Q8).
      assignedMachineIds: [],
      jobRow: {
        id: "job-1",
        status: "picked_up",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: "fab-1",
        current_revision: 1,
      },
      detailJobOverrides: {
        file_type: "stl",
        original_filename: "x.stl",
        teacher_review_note: null,
        lab_tech_picked_up_at: "2026-04-23T10:00:00Z",
        completion_status: null,
        completion_note: null,
        completed_at: null,
        notifications_sent: null,
        student_id: "student-1",
        class_id: null,
        unit_id: null,
        students: { display_name: "Kai", username: "kai" },
        classes: null,
        units: null,
        machine_profiles: null,
      },
    });
    const result = await getFabJobDetail(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
    });
    expect("error" in result).toBe(false);
  });

  it("returns 404 when job belongs to a different teacher AND fab isn't the owner", async () => {
    // Phase 8.1d-9: visibility = (job.teacher_id == inviter) OR
    // (lab_tech_picked_up_by == fabricator). Neither here → 404.
    const { client } = makeFakeClient({
      inviterTeacherId: "teacher-1",
      jobRow: {
        id: "job-1",
        status: "approved",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: "some-other-fab",
        current_revision: 1,
        teacher_id: "teacher-other", // different teacher
      },
      detailJobOverrides: { file_type: "stl", original_filename: "x.stl" },
    });
    const result = await getFabJobDetail(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
    });
    if (!("error" in result)) throw new Error("expected error");
    expect(result.error.status).toBe(404);
  });

  it("returns 404 when job doesn't exist at all", async () => {
    const { client } = makeFakeClient({
      assignedMachineIds: ["machine-1"],
      jobRow: null,
    });
    const result = await getFabJobDetail(client, {
      fabricatorId: "fab-1",
      jobId: "ghost",
    });
    if (!("error" in result)) throw new Error("expected error");
    expect(result.error.status).toBe(404);
  });
});

// ============================================================
// pickupJob
// ============================================================

describe("pickupJob", () => {
  it("transitions approved → picked_up with timestamps + returns storage_path", async () => {
    const { client, log } = makeFakeClient({
      assignedMachineIds: ["machine-1"],
      jobRow: {
        id: "job-1",
        status: "approved",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: null,
        current_revision: 2,
      },
      confirmPickedUpBy: "fab-1",
      confirmPickedUpAt: "2026-04-23T12:00:00Z",
      confirmStatus: "picked_up",
      currentRevisionRow: { storage_path: "fab-1/job-1/v2.stl" },
    });
    const result = await pickupJob(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
    });
    if ("error" in result) throw new Error("expected success");
    expect(result.jobId).toBe("job-1");
    expect(result.storagePath).toBe("fab-1/job-1/v2.stl");
    expect(result.pickedUpAt).toBe("2026-04-23T12:00:00Z");

    // Verify the update payload set status to picked_up + wrote the
    // lab_tech_picked_up_by/_at columns, and that the WHERE clause
    // included status=approved (race-safety guard).
    const updateCall = log.find(
      (l) => l.table === "fabrication_jobs" && l.op === "update"
    );
    expect(updateCall?.payload?.status).toBe("picked_up");
    expect(updateCall?.payload?.lab_tech_picked_up_by).toBe("fab-1");
    expect(updateCall?.payload?.lab_tech_picked_up_at).toBeTruthy();
    const statusGuard = updateCall?.eq.find(([c]) => c === "status");
    expect(statusGuard?.[1]).toBe("approved");
  });

  it("is idempotent on re-download by same fabricator (status=picked_up + picked_up_by=self)", async () => {
    const { client, log } = makeFakeClient({
      assignedMachineIds: ["machine-1"],
      jobRow: {
        id: "job-1",
        status: "picked_up",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: "fab-1",
        current_revision: 1,
      },
      currentRevisionRow: { storage_path: "fab-1/job-1/v1.stl" },
    });
    const result = await pickupJob(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
    });
    if ("error" in result) throw new Error("expected success");
    expect(result.storagePath).toBe("fab-1/job-1/v1.stl");
    // No update call expected — idempotent path.
    const updateCall = log.find(
      (l) => l.table === "fabrication_jobs" && l.op === "update"
    );
    expect(updateCall).toBeUndefined();
  });

  it("returns 409 when another fabricator wins the race (confirm-read shows different picked_up_by)", async () => {
    const { client } = makeFakeClient({
      assignedMachineIds: ["machine-1"],
      jobRow: {
        id: "job-1",
        status: "approved",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: null,
      },
      // Post-update confirm returns a DIFFERENT fabricator — race lost.
      confirmPickedUpBy: "fab-other",
      confirmStatus: "picked_up",
    });
    const result = await pickupJob(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
    });
    if (!("error" in result)) throw new Error("expected error");
    expect(result.error.status).toBe(409);
    expect(result.error.message).toContain("Another lab tech");
  });

  it("returns 409 when job is already picked up by someone else", async () => {
    const { client } = makeFakeClient({
      assignedMachineIds: ["machine-1"],
      jobRow: {
        id: "job-1",
        status: "picked_up",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: "fab-other",
      },
    });
    const result = await pickupJob(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
    });
    if (!("error" in result)) throw new Error("expected error");
    expect(result.error.status).toBe(409);
  });

  it("returns 409 when job is in a non-pickupable status (completed / rejected)", async () => {
    const { client } = makeFakeClient({
      assignedMachineIds: ["machine-1"],
      jobRow: {
        id: "job-1",
        status: "completed",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: "fab-other",
      },
    });
    const result = await pickupJob(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
    });
    if (!("error" in result)) throw new Error("expected error");
    expect(result.error.status).toBe(409);
  });

  it("returns 404 when job belongs to a different teacher", async () => {
    // Phase 8.1d-9: pickup ownership scoped to inviter, not junction.
    const { client } = makeFakeClient({
      inviterTeacherId: "teacher-1",
      jobRow: {
        id: "job-1",
        status: "approved",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: null,
        teacher_id: "teacher-other", // different teacher
      },
    });
    const result = await pickupJob(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
    });
    if (!("error" in result)) throw new Error("expected error");
    expect(result.error.status).toBe(404);
  });
});

// ============================================================
// markComplete
// ============================================================

describe("markComplete", () => {
  it("derives completion_status='printed' for 3d_printer + transitions to completed", async () => {
    const { client, log } = makeFakeClient({
      jobRow: {
        id: "job-1",
        status: "picked_up",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: "fab-1",
      },
      machineCategory: "3d_printer",
    });
    const result = await markComplete(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
      completionNote: "Looked great",
    });
    if ("error" in result) throw new Error("expected success");
    expect(result.completionStatus).toBe("printed");

    const updateCall = log.find(
      (l) => l.table === "fabrication_jobs" && l.op === "update"
    );
    expect(updateCall?.payload?.status).toBe("completed");
    expect(updateCall?.payload?.completion_status).toBe("printed");
    expect(updateCall?.payload?.completion_note).toBe("Looked great");
    expect(updateCall?.payload?.completed_at).toBeTruthy();
  });

  it("derives completion_status='cut' for laser_cutter", async () => {
    const { client } = makeFakeClient({
      jobRow: {
        id: "job-1",
        status: "picked_up",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: "fab-1",
      },
      machineCategory: "laser_cutter",
    });
    const result = await markComplete(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
    });
    if ("error" in result) throw new Error("expected success");
    expect(result.completionStatus).toBe("cut");
  });

  it("trims + nulls empty note (single space → null in DB)", async () => {
    const { client, log } = makeFakeClient({
      jobRow: {
        id: "job-1",
        status: "picked_up",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: "fab-1",
      },
      machineCategory: "3d_printer",
    });
    await markComplete(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
      completionNote: "   ",
    });
    const updateCall = log.find(
      (l) => l.table === "fabrication_jobs" && l.op === "update"
    );
    expect(updateCall?.payload?.completion_note).toBeNull();
  });

  it("returns 404 when fabricator is not the owner of the picked-up job", async () => {
    const { client } = makeFakeClient({
      jobRow: {
        id: "job-1",
        status: "picked_up",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: "fab-other",
      },
    });
    const result = await markComplete(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
    });
    if (!("error" in result)) throw new Error("expected error");
    expect(result.error.status).toBe(404);
  });
});

// ============================================================
// markFailed
// ============================================================

describe("markFailed", () => {
  it("requires a non-empty note — returns 400 on missing/whitespace", async () => {
    const { client } = makeFakeClient({
      jobRow: {
        id: "job-1",
        status: "picked_up",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: "fab-1",
      },
    });

    const emptyNote = await markFailed(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
      completionNote: "",
    });
    if (!("error" in emptyNote)) throw new Error("expected error");
    expect(emptyNote.error.status).toBe(400);

    const whitespaceNote = await markFailed(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
      completionNote: "  \n  ",
    });
    if (!("error" in whitespaceNote)) throw new Error("expected error");
    expect(whitespaceNote.error.status).toBe(400);
  });

  it("writes completion_status='failed' with trimmed note + timestamp", async () => {
    const { client, log } = makeFakeClient({
      jobRow: {
        id: "job-1",
        status: "picked_up",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: "fab-1",
      },
    });
    const result = await markFailed(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
      completionNote: "  Warped off the bed at layer 12  ",
    });
    if ("error" in result) throw new Error("expected success");
    expect(result.completionStatus).toBe("failed");

    const updateCall = log.find(
      (l) => l.table === "fabrication_jobs" && l.op === "update"
    );
    expect(updateCall?.payload?.status).toBe("completed");
    expect(updateCall?.payload?.completion_status).toBe("failed");
    expect(updateCall?.payload?.completion_note).toBe(
      "Warped off the bed at layer 12"
    );
  });

  it("returns 409 when job is not in picked_up status (already completed / approved)", async () => {
    const { client } = makeFakeClient({
      jobRow: {
        id: "job-1",
        status: "completed",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: "fab-1",
      },
    });
    const result = await markFailed(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
      completionNote: "Already done, can't re-fail",
    });
    if (!("error" in result)) throw new Error("expected error");
    expect(result.error.status).toBe(409);
  });

  it("scopes the update WHERE clause to status=picked_up AND picked_up_by=self (race + wrong-owner guard)", async () => {
    const { client, log } = makeFakeClient({
      jobRow: {
        id: "job-1",
        status: "picked_up",
        machine_profile_id: "machine-1",
        lab_tech_picked_up_by: "fab-1",
      },
    });
    await markFailed(client, {
      fabricatorId: "fab-1",
      jobId: "job-1",
      completionNote: "ok",
    });
    const updateCall = log.find(
      (l) => l.table === "fabrication_jobs" && l.op === "update"
    );
    const eqMap = Object.fromEntries(updateCall?.eq ?? []);
    expect(eqMap["status"]).toBe("picked_up");
    expect(eqMap["lab_tech_picked_up_by"]).toBe("fab-1");
  });
});
