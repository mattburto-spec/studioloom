import { describe, it, expect, vi } from "vitest";
import {
  ACK_CHOICES,
  acknowledgeWarning,
  createRevision,
  submitJob,
  isOrchestrationError,
  type AcknowledgedWarnings,
} from "../orchestration";

/**
 * Phase 5-1 orchestration tests. createRevision + acknowledgeWarning +
 * submitJob.
 *
 * Split into a sibling file rather than appended to orchestration.test.ts
 * — that file is already 816 lines covering Phases 4-1 + 4-2. This file
 * owns the Phase 5-1 surface. Same pure-reducer / fake-supabase pattern.
 */

// ============================================================
// Supabase chain fake — tuned for the 3 Phase 5-1 functions
// ============================================================

interface Recorded {
  table: string;
  op: string;
  eq?: Array<[string, unknown]>;
  payload?: unknown;
  order?: { col: string; asc: boolean };
  limit?: number;
}

interface FakeOptions {
  // Shared job row state
  jobFound?: boolean;
  jobStudentId?: string;
  jobTeacherId?: string;
  jobFileType?: "stl" | "svg";
  jobCurrentRevision?: number;
  jobStatus?: string;
  jobMachineProfileId?: string;
  jobAcknowledgedWarnings?: AcknowledgedWarnings | null;
  jobLookupError?: string;

  // Revision lookup + insert (createRevision)
  latestRevisionNumber?: number | null;
  revisionLookupError?: string;
  revInsertId?: string;
  revInsertError?: string;
  signedUrl?: string;
  signedUrlError?: string;

  // Submit: current revision scan results
  currentRevScanStatus?: string;
  currentRevRules?: Array<{ id: string; severity: string }>;
  currentRevLookupError?: string;

  // Machine profile
  requiresTeacherApproval?: boolean;
  machineProfileFound?: boolean;
  machineProfileError?: string;

  // Write failure simulation
  statusUpdateError?: string;
  ackUpdateError?: string;
  currentRevisionBumpError?: string;
}

function makeClient(opts: FakeOptions = {}) {
  const {
    jobFound = true,
    jobStudentId = "student-1",
    jobTeacherId = "teacher-1",
    jobFileType = "stl",
    jobCurrentRevision = 1,
    jobStatus = "uploaded",
    jobMachineProfileId = "machine-1",
    jobAcknowledgedWarnings = null,
    jobLookupError,
    latestRevisionNumber = 1,
    revisionLookupError,
    revInsertId = "rev-new",
    revInsertError,
    signedUrl = "https://stor.example.com/signed",
    signedUrlError,
    currentRevScanStatus = "done",
    currentRevRules = [],
    currentRevLookupError,
    requiresTeacherApproval = false,
    machineProfileFound = true,
    machineProfileError,
    statusUpdateError,
    ackUpdateError,
    currentRevisionBumpError,
  } = opts;

  const log: Recorded[] = [];

  const tableHandler = (table: string) => {
    const entry: Recorded = { table, op: "select", eq: [] };
    const chain: Record<string, unknown> = {};
    chain.eq = (col: string, val: unknown) => {
      entry.eq!.push([col, val]);
      return chain;
    };
    chain.order = (col: string, o: { ascending: boolean }) => {
      entry.order = { col, asc: o.ascending };
      return chain;
    };
    chain.limit = (n: number) => {
      entry.limit = n;
      return chain;
    };
    chain.maybeSingle = async () => {
      log.push({ ...entry });
      if (table === "fabrication_jobs") {
        if (jobLookupError) return { data: null, error: { message: jobLookupError } };
        if (!jobFound) return { data: null, error: null };
        return {
          data: {
            id: entry.eq![0][1],
            student_id: jobStudentId,
            teacher_id: jobTeacherId,
            file_type: jobFileType,
            current_revision: jobCurrentRevision,
            status: jobStatus,
            machine_profile_id: jobMachineProfileId,
            acknowledged_warnings: jobAcknowledgedWarnings,
          },
          error: null,
        };
      }
      if (table === "fabrication_job_revisions") {
        if (revisionLookupError) return { data: null, error: { message: revisionLookupError } };
        // Distinguish "latest revision" lookup (uses order+limit) from
        // "current revision for submit" (uses eq revision_number).
        const filteringByRev = entry.eq!.some(([col]) => col === "revision_number");
        if (filteringByRev) {
          if (currentRevLookupError)
            return { data: null, error: { message: currentRevLookupError } };
          return {
            data: {
              scan_status: currentRevScanStatus,
              scan_results: { rules: currentRevRules },
              revision_number: jobCurrentRevision,
            },
            error: null,
          };
        }
        if (latestRevisionNumber === null) return { data: null, error: null };
        return { data: { revision_number: latestRevisionNumber }, error: null };
      }
      if (table === "machine_profiles") {
        if (machineProfileError)
          return { data: null, error: { message: machineProfileError } };
        if (!machineProfileFound) return { data: null, error: null };
        return {
          data: { requires_teacher_approval: requiresTeacherApproval },
          error: null,
        };
      }
      return { data: null, error: null };
    };
    chain.single = async () => {
      log.push({ ...entry });
      if (table === "fabrication_job_revisions" && entry.op === "insert") {
        if (revInsertError) return { data: null, error: { message: revInsertError } };
        return { data: { id: revInsertId }, error: null };
      }
      return { data: null, error: null };
    };
    return {
      select: (_cols: string) => {
        entry.op = "select";
        return chain;
      },
      insert: (payload: unknown) => {
        entry.op = "insert";
        entry.payload = payload;
        return {
          select: (_cols: string) => ({ single: chain.single }),
        };
      },
      update: (payload: unknown) => {
        entry.op = "update";
        entry.payload = payload;
        return {
          eq: async (col: string, val: unknown) => {
            entry.eq = [[col, val]];
            log.push({ ...entry });
            if (table === "fabrication_jobs") {
              if (payload && typeof payload === "object") {
                const p = payload as Record<string, unknown>;
                if ("status" in p && statusUpdateError)
                  return { error: { message: statusUpdateError } };
                if ("acknowledged_warnings" in p && ackUpdateError)
                  return { error: { message: ackUpdateError } };
                if ("current_revision" in p && currentRevisionBumpError)
                  return { error: { message: currentRevisionBumpError } };
              }
            }
            return { error: null };
          },
        };
      },
      delete: () => {
        entry.op = "delete";
        return {
          eq: async (col: string, val: unknown) => {
            entry.eq = [[col, val]];
            log.push({ ...entry });
            return { error: null };
          },
        };
      },
    };
  };

  const storage = {
    from: (bucket: string) => ({
      createSignedUploadUrl: async (path: string) => {
        log.push({
          table: `storage:${bucket}`,
          op: "signed-upload",
          eq: [["path", path]],
        });
        if (signedUrlError) return { data: null, error: { message: signedUrlError } };
        return { data: { signedUrl, token: "tok", path }, error: null };
      },
    }),
  };

  return {
    client: { from: tableHandler, storage } as unknown as Parameters<typeof createRevision>[0],
    log,
  };
}

// ============================================================
// createRevision
// ============================================================

const validRevisionReq = {
  studentId: "student-1",
  jobId: "job-1",
  fileType: "stl",
  originalFilename: "fixed-cube.stl",
  fileSizeBytes: 1024,
};

describe("createRevision — validation", () => {
  it("rejects empty originalFilename with 400", async () => {
    const { client } = makeClient();
    const r = await createRevision(client, { ...validRevisionReq, originalFilename: " " });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(400);
  });
  it("rejects unsupported fileType with 400", async () => {
    const { client } = makeClient();
    const r = await createRevision(client, {
      ...validRevisionReq,
      fileType: "pdf",
      originalFilename: "x.pdf",
    });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(400);
    expect(r.error.message).toMatch(/stl.*svg/);
  });
  it("rejects extension mismatch with 400", async () => {
    const { client } = makeClient();
    const r = await createRevision(client, {
      ...validRevisionReq,
      fileType: "stl",
      originalFilename: "coaster.svg",
    });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(400);
    expect(r.error.message).toMatch(/extension/);
  });
  it("rejects oversize file with 413", async () => {
    const { client } = makeClient();
    const r = await createRevision(client, {
      ...validRevisionReq,
      fileSizeBytes: 60 * 1024 * 1024,
    });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(413);
  });
});

describe("createRevision — ownership + job lookups", () => {
  it("returns 404 when job does not exist", async () => {
    const { client } = makeClient({ jobFound: false });
    const r = await createRevision(client, validRevisionReq);
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(404);
  });
  it("returns 404 when student does not own the job", async () => {
    const { client } = makeClient({ jobStudentId: "other-student" });
    const r = await createRevision(client, validRevisionReq);
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(404);
  });
  it("returns 400 when re-upload fileType doesn't match the original job", async () => {
    const { client } = makeClient({ jobFileType: "svg" });
    const r = await createRevision(client, validRevisionReq); // validRevisionReq uses stl
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(400);
    expect(r.error.message).toMatch(/must match the original job/);
  });
});

describe("createRevision — happy path", () => {
  it("creates revision N+1 and mints signed URL using the bumped revision_number", async () => {
    const { client, log } = makeClient({
      latestRevisionNumber: 3, // so new revision = 4
      jobTeacherId: "teacher-abc",
    });
    const r = await createRevision(client, validRevisionReq);
    if (isOrchestrationError(r)) throw new Error(`unexpected error: ${r.error.message}`);

    expect(r.revisionId).toBe("rev-new");
    expect(r.storagePath).toBe("fabrication/teacher-abc/student-1/job-1/v4.stl");

    // Verify the insert payload on fabrication_job_revisions.
    const insert = log.find((e) => e.table === "fabrication_job_revisions" && e.op === "insert");
    expect(insert?.payload).toMatchObject({
      job_id: "job-1",
      revision_number: 4,
      storage_path: "fabrication/teacher-abc/student-1/job-1/v4.stl",
      scan_status: "pending",
    });

    // Verify current_revision bump on fabrication_jobs.
    const bump = log.find(
      (e) =>
        e.table === "fabrication_jobs" &&
        e.op === "update" &&
        (e.payload as { current_revision?: number }).current_revision === 4
    );
    expect(bump).toBeDefined();
  });

  it("starts at revision 2 when no prior revision exists (defensive, fabrication_jobs lags)", async () => {
    const { client } = makeClient({ latestRevisionNumber: null });
    const r = await createRevision(client, validRevisionReq);
    if (isOrchestrationError(r)) throw new Error("expected success");
    expect(r.storagePath).toMatch(/\/v1\.stl$/);
  });
});

describe("createRevision — cleanup on signed URL failure", () => {
  it("deletes the revision row and rolls back current_revision when URL mint fails", async () => {
    const { client, log } = makeClient({
      latestRevisionNumber: 2,
      signedUrlError: "bucket policy denied",
    });
    const r = await createRevision(client, validRevisionReq);
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(500);
    expect(r.error.message).toMatch(/Signed URL mint failed/);

    // Delete on revision row
    const del = log.find((e) => e.table === "fabrication_job_revisions" && e.op === "delete");
    expect(del).toBeDefined();
    // Rollback on current_revision
    const rollback = log.find(
      (e) =>
        e.table === "fabrication_jobs" &&
        e.op === "update" &&
        (e.payload as { current_revision?: number }).current_revision === 2
    );
    expect(rollback).toBeDefined();
  });
});

// ============================================================
// acknowledgeWarning
// ============================================================

describe("acknowledgeWarning — validation", () => {
  it("rejects invalid choice with 400", async () => {
    const { client } = makeClient();
    const r = await acknowledgeWarning(client, {
      studentId: "student-1",
      jobId: "job-1",
      revisionNumber: 1,
      ruleId: "R-STL-03",
      choice: "banana" as never,
    });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(400);
    expect(r.error.message).toMatch(/choice must be one of/);
  });
  it("rejects non-integer revisionNumber with 400", async () => {
    const { client } = makeClient();
    const r = await acknowledgeWarning(client, {
      studentId: "student-1",
      jobId: "job-1",
      revisionNumber: 1.5,
      ruleId: "R-STL-03",
      choice: "acknowledged",
    });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(400);
  });
  it("rejects empty ruleId with 400", async () => {
    const { client } = makeClient();
    const r = await acknowledgeWarning(client, {
      studentId: "student-1",
      jobId: "job-1",
      revisionNumber: 1,
      ruleId: "",
      choice: "acknowledged",
    });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(400);
  });
});

describe("acknowledgeWarning — ownership", () => {
  it("returns 404 when job not owned by student", async () => {
    const { client } = makeClient({ jobStudentId: "other" });
    const r = await acknowledgeWarning(client, {
      studentId: "student-1",
      jobId: "job-1",
      revisionNumber: 1,
      ruleId: "R-STL-03",
      choice: "acknowledged",
    });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(404);
  });
});

describe("acknowledgeWarning — merge behaviour", () => {
  it("initialises acknowledged_warnings when previously null", async () => {
    const { client, log } = makeClient({ jobAcknowledgedWarnings: null });
    const r = await acknowledgeWarning(client, {
      studentId: "student-1",
      jobId: "job-1",
      revisionNumber: 2,
      ruleId: "R-STL-11",
      choice: "intentional",
    });
    if (isOrchestrationError(r)) throw new Error("expected success");
    expect(r.acknowledgedWarnings).toEqual({
      revision_2: {
        "R-STL-11": {
          choice: "intentional",
          timestamp: expect.any(String),
        },
      },
    });
    const update = log.find(
      (e) =>
        e.table === "fabrication_jobs" &&
        e.op === "update" &&
        (e.payload as { acknowledged_warnings?: unknown }).acknowledged_warnings !== undefined
    );
    expect(update).toBeDefined();
  });

  it("preserves existing acks on other rules + other revisions when adding a new ack", async () => {
    const existing: AcknowledgedWarnings = {
      revision_1: {
        "R-STL-03": { choice: "will-fix-slicer", timestamp: "2026-04-22T00:00:00Z" },
      },
      revision_2: {
        "R-STL-11": { choice: "intentional", timestamp: "2026-04-22T01:00:00Z" },
      },
    };
    const { client } = makeClient({ jobAcknowledgedWarnings: existing });
    const r = await acknowledgeWarning(client, {
      studentId: "student-1",
      jobId: "job-1",
      revisionNumber: 2,
      ruleId: "R-STL-14",
      choice: "acknowledged",
    });
    if (isOrchestrationError(r)) throw new Error("expected success");
    expect(r.acknowledgedWarnings.revision_1).toEqual(existing.revision_1);
    expect(r.acknowledgedWarnings.revision_2?.["R-STL-11"]).toEqual(existing.revision_2!["R-STL-11"]);
    expect(r.acknowledgedWarnings.revision_2?.["R-STL-14"]).toMatchObject({
      choice: "acknowledged",
    });
  });

  it("overwrites the same rule+revision pair if acked twice (student changed their mind)", async () => {
    const existing: AcknowledgedWarnings = {
      revision_1: {
        "R-STL-03": { choice: "intentional", timestamp: "2026-04-22T00:00:00Z" },
      },
    };
    const { client } = makeClient({ jobAcknowledgedWarnings: existing });
    const r = await acknowledgeWarning(client, {
      studentId: "student-1",
      jobId: "job-1",
      revisionNumber: 1,
      ruleId: "R-STL-03",
      choice: "will-fix-slicer",
    });
    if (isOrchestrationError(r)) throw new Error("expected success");
    expect(r.acknowledgedWarnings.revision_1?.["R-STL-03"].choice).toBe("will-fix-slicer");
  });

  it("accepts all three ACK_CHOICES", async () => {
    for (const choice of ACK_CHOICES as readonly AckChoice[]) {
      const { client } = makeClient();
      const r = await acknowledgeWarning(client, {
        studentId: "student-1",
        jobId: "job-1",
        revisionNumber: 1,
        ruleId: "R-STL-03",
        choice,
      });
      if (isOrchestrationError(r)) throw new Error(`choice ${choice} rejected: ${r.error.message}`);
      expect(r.acknowledgedWarnings.revision_1?.["R-STL-03"].choice).toBe(choice);
    }
  });

  it("returns 500 on DB write failure", async () => {
    const { client } = makeClient({ ackUpdateError: "db down" });
    const r = await acknowledgeWarning(client, {
      studentId: "student-1",
      jobId: "job-1",
      revisionNumber: 1,
      ruleId: "R-STL-03",
      choice: "acknowledged",
    });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(500);
  });
});

// ============================================================
// submitJob
// ============================================================

describe("submitJob — ownership + status guards", () => {
  it("returns 404 when job not found", async () => {
    const { client } = makeClient({ jobFound: false });
    const r = await submitJob(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(404);
  });
  it("returns 404 when student does not own the job", async () => {
    const { client } = makeClient({ jobStudentId: "other" });
    const r = await submitJob(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(404);
  });
  it("returns 409 when job already past submittable state (double-submit guard)", async () => {
    const { client } = makeClient({ jobStatus: "approved" });
    const r = await submitJob(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(409);
    expect(r.error.message).toMatch(/can't submit from this state/);
  });
});

describe("submitJob — validation", () => {
  it("returns 400 when scan is not done", async () => {
    const { client } = makeClient({ currentRevScanStatus: "running" });
    const r = await submitJob(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(400);
    expect(r.error.message).toMatch(/Scan not complete/);
  });

  it("returns 400 with rule ids listed when BLOCK rules still fire", async () => {
    const { client } = makeClient({
      currentRevRules: [
        { id: "R-STL-01", severity: "block" },
        { id: "R-STL-05", severity: "block" },
      ],
    });
    const r = await submitJob(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(400);
    expect(r.error.message).toContain("R-STL-01");
    expect(r.error.message).toContain("R-STL-05");
  });

  it("returns 400 with missing rule ids when WARN rules aren't acked", async () => {
    const { client } = makeClient({
      currentRevRules: [
        { id: "R-STL-04", severity: "warn" },
        { id: "R-STL-11", severity: "warn" },
      ],
      jobAcknowledgedWarnings: {
        revision_1: {
          "R-STL-04": { choice: "acknowledged", timestamp: "2026-04-22T00:00:00Z" },
          // R-STL-11 intentionally un-acked
        },
      },
    });
    const r = await submitJob(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(400);
    expect(r.error.message).toMatch(/Missing.*R-STL-11/);
    expect(r.error.message).not.toContain("R-STL-04"); // already acked
  });

  it("ignores acks from other revisions (rev 2 acks don't satisfy rev 1 warnings)", async () => {
    const { client } = makeClient({
      jobCurrentRevision: 1,
      currentRevRules: [{ id: "R-STL-04", severity: "warn" }],
      jobAcknowledgedWarnings: {
        revision_2: {
          "R-STL-04": { choice: "acknowledged", timestamp: "2026-04-22T00:00:00Z" },
        },
      },
    });
    const r = await submitJob(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error — rev 2 ack shouldn't cover rev 1 warning");
    expect(r.error.message).toContain("R-STL-04");
  });
});

describe("submitJob — happy paths", () => {
  it("transitions status to 'approved' when machine doesn't require teacher approval", async () => {
    const { client, log } = makeClient({
      currentRevRules: [{ id: "R-STL-15", severity: "fyi" }],
      requiresTeacherApproval: false,
    });
    const r = await submitJob(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error(`unexpected error: ${r.error.message}`);
    expect(r.newStatus).toBe("approved");
    expect(r.requiresTeacherApproval).toBe(false);

    const update = log.find(
      (e) =>
        e.table === "fabrication_jobs" &&
        e.op === "update" &&
        (e.payload as { status?: string }).status === "approved"
    );
    expect(update).toBeDefined();
  });

  it("transitions to 'pending_approval' when machine requires teacher approval", async () => {
    const { client } = makeClient({
      currentRevRules: [{ id: "R-STL-15", severity: "fyi" }],
      requiresTeacherApproval: true,
    });
    const r = await submitJob(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error("expected success");
    expect(r.newStatus).toBe("pending_approval");
    expect(r.requiresTeacherApproval).toBe(true);
  });

  it("succeeds when all WARN rules are acked for the current revision", async () => {
    const { client } = makeClient({
      jobCurrentRevision: 2,
      currentRevRules: [
        { id: "R-STL-04", severity: "warn" },
        { id: "R-STL-11", severity: "warn" },
        { id: "R-STL-15", severity: "fyi" },
      ],
      jobAcknowledgedWarnings: {
        revision_2: {
          "R-STL-04": { choice: "will-fix-slicer", timestamp: "2026-04-22T00:00:00Z" },
          "R-STL-11": { choice: "intentional", timestamp: "2026-04-22T00:00:00Z" },
        },
      },
    });
    const r = await submitJob(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error(`expected success: ${(r as { error: { message: string } }).error?.message}`);
    expect(r.newStatus).toBe("approved");
  });

  it("accepts empty rules array (no rules fired — auto-pass)", async () => {
    const { client } = makeClient({ currentRevRules: [] });
    const r = await submitJob(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error("expected success");
    expect(r.newStatus).toBe("approved");
  });
});

describe("submitJob — DB failures", () => {
  it("returns 500 when status update fails", async () => {
    const { client } = makeClient({
      currentRevRules: [],
      statusUpdateError: "constraint violation",
    });
    const r = await submitJob(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(500);
    expect(r.error.message).toMatch(/Status transition failed/);
  });

  it("returns 500 when machine profile lookup errors", async () => {
    const { client } = makeClient({
      currentRevRules: [],
      machineProfileError: "rls denied",
    });
    const r = await submitJob(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(500);
    expect(r.error.message).toMatch(/Machine profile lookup failed/);
  });
});

// ============================================================
// listRevisions (Phase 5-5)
// ============================================================
//
// The list query uses `.order(...)` without a terminal `.single/.maybeSingle`
// — the chain is thenable at that point. Below fake implements that via
// a custom chain object.

import { listRevisions } from "../orchestration";

interface ListRevFakeOpts {
  jobFound?: boolean;
  jobStudentId?: string;
  rows?: Array<{
    id: string;
    revision_number: number;
    scan_status: string | null;
    scan_error: string | null;
    scan_completed_at: string | null;
    thumbnail_path: string | null;
    scan_results: { rules?: Array<{ severity?: string }> | null } | null;
    uploaded_at: string;
  }>;
  rowsError?: string;
  signedUrl?: string;
}

function makeListClient(opts: ListRevFakeOpts = {}) {
  const {
    jobFound = true,
    jobStudentId = "student-1",
    rows = [],
    rowsError,
    signedUrl = "https://stor.example.com/thumb",
  } = opts;

  const tableHandler = (table: string) => {
    const entry: { table: string; op: string; eq: Array<[string, unknown]>; order?: unknown } = {
      table,
      op: "select",
      eq: [],
    };
    // Chain object that doubles as a thenable after .order() for the
    // list case. For single-row calls, .maybeSingle() is terminal.
    const chain: Record<string, unknown> = {};
    chain.eq = (col: string, val: unknown) => {
      entry.eq.push([col, val]);
      return chain;
    };
    chain.order = (_col: string, _opts: unknown) => {
      entry.order = _opts;
      // After .order, awaiting the chain yields the rows result.
      (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => {
        if (table !== "fabrication_job_revisions") {
          return resolve({ data: null, error: null });
        }
        if (rowsError) return resolve({ data: null, error: { message: rowsError } });
        return resolve({ data: rows, error: null });
      };
      return chain;
    };
    chain.maybeSingle = async () => {
      if (table === "fabrication_jobs") {
        if (!jobFound) return { data: null, error: null };
        return {
          data: {
            id: entry.eq[0][1],
            student_id: jobStudentId,
            status: "uploaded",
            current_revision: 1,
            file_type: "stl",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    };
    return {
      select: (_cols: string) => chain,
    };
  };

  const storage = {
    from: (_bucket: string) => ({
      createSignedUrl: async (_path: string, _ttl: number) => ({
        data: { signedUrl },
        error: null,
      }),
    }),
  };

  return {
    client: { from: tableHandler, storage } as unknown as Parameters<typeof listRevisions>[0],
  };
}

describe("listRevisions", () => {
  it("returns 404 when job not found (ownership gate)", async () => {
    const { client } = makeListClient({ jobFound: false });
    const r = await listRevisions(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(404);
  });

  it("returns 404 when student does not own the job", async () => {
    const { client } = makeListClient({ jobStudentId: "other" });
    const r = await listRevisions(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(404);
  });

  it("returns empty array when job has no revisions", async () => {
    const { client } = makeListClient({ rows: [] });
    const r = await listRevisions(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error("expected success");
    expect(r.revisions).toEqual([]);
  });

  it("maps rows to summaries with thumbnail URLs minted", async () => {
    const { client } = makeListClient({
      rows: [
        {
          id: "rev-1",
          revision_number: 1,
          scan_status: "done",
          scan_error: null,
          scan_completed_at: "2026-04-22T00:00:00Z",
          thumbnail_path: "rev-1.png",
          scan_results: {
            rules: [
              { severity: "block" },
              { severity: "block" },
              { severity: "warn" },
              { severity: "fyi" },
              { severity: "fyi" },
              { severity: "fyi" },
            ],
          },
          uploaded_at: "2026-04-22T00:00:00Z",
        },
      ],
    });
    const r = await listRevisions(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error("expected success");
    expect(r.revisions).toHaveLength(1);
    expect(r.revisions[0]).toEqual({
      id: "rev-1",
      revisionNumber: 1,
      scanStatus: "done",
      scanError: null,
      scanCompletedAt: "2026-04-22T00:00:00Z",
      thumbnailUrl: "https://stor.example.com/thumb",
      ruleCounts: { block: 2, warn: 1, fyi: 3 },
      createdAt: "2026-04-22T00:00:00Z",
    });
  });

  it("handles revisions with null thumbnail_path gracefully", async () => {
    const { client } = makeListClient({
      rows: [
        {
          id: "rev-1",
          revision_number: 1,
          scan_status: "pending",
          scan_error: null,
          scan_completed_at: null,
          thumbnail_path: null,
          scan_results: null,
          uploaded_at: "2026-04-22T00:00:00Z",
        },
      ],
    });
    const r = await listRevisions(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error("expected success");
    expect(r.revisions[0].thumbnailUrl).toBeNull();
    expect(r.revisions[0].ruleCounts).toEqual({ block: 0, warn: 0, fyi: 0 });
  });

  it("returns 500 on revision lookup error", async () => {
    const { client } = makeListClient({ rowsError: "rls denied" });
    const r = await listRevisions(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(500);
    expect(r.error.message).toMatch(/rls denied/);
  });

  // Phase 8.1d-11 regression: a single bad signed-URL mint must not
  // collapse the whole Promise.all and 500 the endpoint. Previously
  // a thrown createSignedUrl rejected listRevisions, the route had
  // no try/catch, and the student page hung on "Loading your
  // submission…" because /revisions errored in parallel with /status.
  it("returns rows with thumbnailUrl=null when storage createSignedUrl throws", async () => {
    // Custom client with a throwing storage layer.
    const tableHandler = (table: string) => {
      const entry: { eq: Array<[string, unknown]>; order?: unknown } = { eq: [] };
      const chain: Record<string, unknown> = {};
      chain.eq = (col: string, val: unknown) => {
        entry.eq.push([col, val]);
        return chain;
      };
      chain.order = () => {
        (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => {
          if (table !== "fabrication_job_revisions") {
            return resolve({ data: null, error: null });
          }
          return resolve({
            data: [
              {
                id: "rev-1",
                revision_number: 1,
                scan_status: "done",
                scan_error: null,
                scan_completed_at: "2026-04-22T00:00:00Z",
                thumbnail_path: "rev-1.png",
                scan_results: { rules: [] },
                uploaded_at: "2026-04-22T00:00:00Z",
              },
            ],
            error: null,
          });
        };
        return chain;
      };
      chain.maybeSingle = async () => {
        if (table === "fabrication_jobs") {
          return {
            data: {
              id: entry.eq[0][1],
              student_id: "student-1",
              status: "uploaded",
              current_revision: 1,
              file_type: "stl",
            },
            error: null,
          };
        }
        return { data: null, error: null };
      };
      return { select: (_cols: string) => chain };
    };

    const storage = {
      from: (_bucket: string) => ({
        createSignedUrl: async () => {
          throw new Error("supabase storage transient failure");
        },
      }),
    };

    // Silence the warn we expect listRevisions to emit.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const r = await listRevisions(
      { from: tableHandler, storage } as unknown as Parameters<typeof listRevisions>[0],
      { studentId: "student-1", jobId: "job-1" }
    );

    if (isOrchestrationError(r)) throw new Error("expected success despite storage throw");
    expect(r.revisions).toHaveLength(1);
    expect(r.revisions[0].id).toBe("rev-1");
    expect(r.revisions[0].thumbnailUrl).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
