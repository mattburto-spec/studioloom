import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MAX_UPLOAD_SIZE_BYTES,
  FABRICATION_UPLOAD_BUCKET,
  FABRICATION_THUMBNAIL_BUCKET,
  THUMBNAIL_URL_TTL_SECONDS,
  ACK_CHOICES,
  buildStoragePath,
  validateUploadRequest,
  createUploadJob,
  enqueueScanJob,
  getJobStatus,
  createRevision,
  acknowledgeWarning,
  submitJob,
  isUploadJobError,
  isOrchestrationError,
  type AckChoice,
} from "../orchestration";

/**
 * Phase 4-1 orchestration unit tests.
 *
 * Covers the validateUploadRequest + createUploadJob paths with a fake
 * Supabase client that simulates the query-builder chain. The real DB is
 * never touched — integration verification happens at Checkpoint 4.1
 * via end-to-end prod smoke.
 *
 * Per Lesson #38 every assertion checks a specific value (error message
 * text, payload shape) rather than just truthy/present.
 */

// ---------- validateUploadRequest ----------

describe("validateUploadRequest", () => {
  const valid = {
    classId: "c43f52fc-f69e-4bc4-b43f-b1219ea6fbe1",
    machineProfileId: "46bdc2cc-01f5-4e2b-86fd-47e8a4af1288",
    fileType: "stl",
    originalFilename: "cube.stl",
    fileSizeBytes: 1024,
  };

  it("returns ok:true for a well-formed body", () => {
    const r = validateUploadRequest(valid);
    expect("ok" in r && r.ok).toBe(true);
  });

  it("rejects non-object body with 400", () => {
    const r = validateUploadRequest(null);
    expect(isUploadJobError(r as never)).toBe(true);
    expect((r as { error: { status: number; message: string } }).error.status).toBe(400);
  });

  it("rejects classId that isn't a UUID with 400", () => {
    const r = validateUploadRequest({ ...valid, classId: "not-a-uuid" });
    expect((r as { error: { message: string; status: number } }).error.status).toBe(400);
    expect((r as { error: { message: string } }).error.message).toMatch(/classId.*UUID/);
  });

  it("rejects machineProfileId that isn't a UUID with 400", () => {
    const r = validateUploadRequest({ ...valid, machineProfileId: "xyz" });
    expect((r as { error: { message: string } }).error.message).toMatch(/machineProfileId.*UUID/);
  });

  it("rejects unsupported fileType with 400", () => {
    const r = validateUploadRequest({ ...valid, fileType: "pdf", originalFilename: "x.pdf" });
    expect((r as { error: { message: string; status: number } }).error.status).toBe(400);
    expect((r as { error: { message: string } }).error.message).toMatch(/fileType.*stl.*svg/);
  });

  it("rejects empty originalFilename with 400", () => {
    const r = validateUploadRequest({ ...valid, originalFilename: "   " });
    expect((r as { error: { message: string } }).error.message).toMatch(/originalFilename required/);
  });

  it("rejects extension mismatch with 400", () => {
    const r = validateUploadRequest({
      ...valid,
      fileType: "stl",
      originalFilename: "coaster.svg",
    });
    expect((r as { error: { status: number; message: string } }).error.status).toBe(400);
    expect((r as { error: { message: string } }).error.message).toMatch(
      /extension.*\.svg.*fileType.*stl/
    );
  });

  it("rejects non-positive fileSizeBytes with 400", () => {
    const r = validateUploadRequest({ ...valid, fileSizeBytes: 0 });
    expect((r as { error: { message: string } }).error.message).toMatch(/positive number/);
  });

  it("rejects oversize fileSizeBytes with 413", () => {
    const r = validateUploadRequest({ ...valid, fileSizeBytes: MAX_UPLOAD_SIZE_BYTES + 1 });
    expect((r as { error: { status: number; message: string } }).error.status).toBe(413);
  });

  it("accepts exactly MAX_UPLOAD_SIZE_BYTES", () => {
    const r = validateUploadRequest({ ...valid, fileSizeBytes: MAX_UPLOAD_SIZE_BYTES });
    expect("ok" in r && r.ok).toBe(true);
  });

  it("trims originalFilename whitespace", () => {
    const r = validateUploadRequest({ ...valid, originalFilename: "  cube.stl  " });
    if (!("ok" in r && r.ok)) throw new Error("expected ok result");
    expect(r.data.originalFilename).toBe("cube.stl");
  });
});

// ---------- buildStoragePath ----------

describe("buildStoragePath", () => {
  it("produces the canonical shape fabrication/{teacher}/{student}/{job}/v{n}.{ext}", () => {
    const p = buildStoragePath({
      teacherId: "T",
      studentId: "S",
      jobId: "J",
      revisionNumber: 1,
      fileType: "stl",
    });
    expect(p).toBe("fabrication/T/S/J/v1.stl");
  });

  it("uses the fileType as the extension (svg)", () => {
    const p = buildStoragePath({
      teacherId: "T",
      studentId: "S",
      jobId: "J",
      revisionNumber: 3,
      fileType: "svg",
    });
    expect(p).toBe("fabrication/T/S/J/v3.svg");
  });
});

// ---------- createUploadJob ----------
//
// The Supabase client is faked as a query-builder chain. Each table's
// helper returns a thenable-less object that the orchestrator `await`s
// directly via `.maybeSingle()`, `.single()`, etc.

interface Recorded {
  table: string;
  op: "select" | "insert" | "delete" | "update";
  payload?: unknown;
  eq?: Array<[string, unknown]>;
}

function makeClient(params: {
  enrolmentFound?: boolean;
  enrolmentError?: string;
  classTeacherId?: string | null;
  classError?: string;
  machineFound?: boolean;
  machineError?: string;
  jobInsertError?: string;
  revInsertError?: string;
  signedUrlError?: string;
  signedUrl?: string;
}) {
  const {
    enrolmentFound = true,
    enrolmentError,
    classTeacherId = "teacher-uuid-111",
    classError,
    machineFound = true,
    machineError,
    jobInsertError,
    revInsertError,
    signedUrlError,
    signedUrl = "https://stor.example.com/signed?token=abc",
  } = params;

  const log: Recorded[] = [];
  const createdJobId = "job-uuid-zzz";
  const createdRevId = "rev-uuid-yyy";

  const tableHandler = (table: string) => {
    const entry: Recorded = { table, op: "select", eq: [] };

    const eqChain = {
      eq: (col: string, val: unknown) => {
        entry.eq!.push([col, val]);
        return eqChain;
      },
      maybeSingle: async () => {
        log.push({ ...entry });
        if (table === "class_students") {
          if (enrolmentError) return { data: null, error: { message: enrolmentError } };
          return { data: enrolmentFound ? { student_id: entry.eq![0][1] } : null, error: null };
        }
        if (table === "classes") {
          if (classError) return { data: null, error: { message: classError } };
          // Phase 8-1 + 4-May fix: orchestration now embeds
          // teachers(school_id) for school-scoped machine validation.
          return {
            data: {
              teacher_id: classTeacherId,
              teachers: { school_id: "school-uuid-nis" },
            },
            error: null,
          };
        }
        if (table === "machine_profiles") {
          if (machineError) return { data: null, error: { message: machineError } };
          // Phase 8-1 + 4-May fix: orchestration now selects (id,
          // school_id, lab_id, machine_category, is_system_template,
          // is_active). school_id matches the class's school so the
          // path-A branch passes validation.
          return {
            data: machineFound
              ? {
                  id: entry.eq![0][1],
                  school_id: "school-uuid-nis",
                  lab_id: "lab-uuid-aaa",
                  machine_category: "3d_printer",
                  is_system_template: false,
                  is_active: true,
                }
              : null,
            error: null,
          };
        }
        if (table === "fabrication_labs") {
          // 8.1d-22: only used by path B (labId+machineCategory). The
          // path-A tests don't exercise this branch.
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        log.push({ ...entry });
        if (table === "fabrication_jobs" && entry.op === "insert") {
          if (jobInsertError) return { data: null, error: { message: jobInsertError } };
          return { data: { id: createdJobId }, error: null };
        }
        if (table === "fabrication_job_revisions" && entry.op === "insert") {
          if (revInsertError) return { data: null, error: { message: revInsertError } };
          return { data: { id: createdRevId }, error: null };
        }
        return { data: null, error: null };
      },
    };

    return {
      select: (_cols: string) => {
        entry.op = "select";
        return eqChain;
      },
      insert: (payload: unknown) => {
        entry.op = "insert";
        entry.payload = payload;
        return {
          select: (_cols: string) => ({ single: eqChain.single }),
        };
      },
      delete: () => {
        entry.op = "delete";
        return {
          eq: (col: string, val: unknown) => {
            entry.eq = [[col, val]];
            log.push({ ...entry });
            return Promise.resolve({ error: null });
          },
        };
      },
    };
  };

  const storage = {
    from: (bucket: string) => ({
      createSignedUploadUrl: async (path: string) => {
        log.push({ table: `storage:${bucket}`, op: "select", eq: [["path", path]] });
        if (signedUrlError) return { data: null, error: { message: signedUrlError } };
        return {
          data: { signedUrl, token: "tok-1", path },
          error: null,
        };
      },
    }),
  };

  return {
    client: { from: tableHandler, storage } as Parameters<typeof createUploadJob>[0],
    log,
    createdJobId,
    createdRevId,
  };
}

const validReq = {
  studentId: "f24ff3a8-65dc-4b87-9148-7cb603b1654a",
  classId: "7c534538-c047-4753-b250-d0bd082c8131",
  machineProfileId: "46bdc2cc-01f5-4e2b-86fd-47e8a4af1288",
  fileType: "stl",
  originalFilename: "cube.stl",
  fileSizeBytes: 1024,
};

describe("createUploadJob — happy path", () => {
  it("creates job + revision, mints signed URL, returns full payload", async () => {
    const { client, log, createdJobId, createdRevId } = makeClient({});
    const r = await createUploadJob(client, validReq);

    if (isUploadJobError(r)) throw new Error(`expected success, got: ${r.error.message}`);

    expect(r.jobId).toBe(createdJobId);
    expect(r.revisionId).toBe(createdRevId);
    expect(r.uploadUrl).toBe("https://stor.example.com/signed?token=abc");
    expect(r.storagePath).toBe(
      `fabrication/teacher-uuid-111/${validReq.studentId}/${createdJobId}/v1.stl`
    );

    // Walks through the expected call sequence.
    const sequence = log.map((e) => `${e.op} ${e.table}`);
    expect(sequence).toEqual([
      "select class_students",
      "select classes",
      "select machine_profiles",
      "insert fabrication_jobs",
      "insert fabrication_job_revisions",
      `select storage:${FABRICATION_UPLOAD_BUCKET}`,
    ]);

    // fabrication_jobs INSERT payload matches schema requirements.
    // Phase 8.1d-22: lab_id + machine_category resolved from the
    // bound machine on the path-A flow (machineProfileId set) and
    // written to the row alongside machine_profile_id.
    const jobInsert = log.find((e) => e.table === "fabrication_jobs" && e.op === "insert");
    expect(jobInsert?.payload).toEqual({
      teacher_id: "teacher-uuid-111",
      student_id: validReq.studentId,
      class_id: validReq.classId,
      lab_id: "lab-uuid-aaa",
      machine_category: "3d_printer",
      machine_profile_id: validReq.machineProfileId,
      file_type: "stl",
      original_filename: "cube.stl",
      status: "uploaded",
      current_revision: 1,
    });

    // fabrication_job_revisions INSERT includes storage_path + scan_status.
    const revInsert = log.find(
      (e) => e.table === "fabrication_job_revisions" && e.op === "insert"
    );
    expect(revInsert?.payload).toMatchObject({
      job_id: createdJobId,
      revision_number: 1,
      scan_status: "pending",
      storage_path: `fabrication/teacher-uuid-111/${validReq.studentId}/${createdJobId}/v1.stl`,
      file_size_bytes: 1024,
    });
  });
});

describe("createUploadJob — error paths", () => {
  it("returns 403 when student is not enrolled in the class", async () => {
    const { client } = makeClient({ enrolmentFound: false });
    const r = await createUploadJob(client, validReq);
    if (!isUploadJobError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(403);
    expect(r.error.message).toMatch(/Not enrolled/);
  });

  it("returns 500 when enrolment query errors", async () => {
    const { client } = makeClient({ enrolmentError: "db down" });
    const r = await createUploadJob(client, validReq);
    if (!isUploadJobError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(500);
    expect(r.error.message).toMatch(/Enrolment check failed.*db down/);
  });

  it("returns 500 when class has no teacher_id", async () => {
    const { client } = makeClient({ classTeacherId: null });
    const r = await createUploadJob(client, validReq);
    if (!isUploadJobError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(500);
    expect(r.error.message).toMatch(/no teacher/);
  });

  it("returns 404 when machine profile not found", async () => {
    const { client } = makeClient({ machineFound: false });
    const r = await createUploadJob(client, validReq);
    if (!isUploadJobError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(404);
    expect(r.error.message).toMatch(/Machine profile not found/);
  });

  it("returns 500 when fabrication_jobs insert fails (no cleanup needed)", async () => {
    const { client, log } = makeClient({ jobInsertError: "fk_violation" });
    const r = await createUploadJob(client, validReq);
    if (!isUploadJobError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(500);
    expect(r.error.message).toMatch(/Job insert failed.*fk_violation/);
    // No delete calls expected since nothing was inserted.
    expect(log.find((e) => e.op === "delete")).toBeUndefined();
  });

  it("returns 500 and deletes job when revision insert fails", async () => {
    const { client, log, createdJobId } = makeClient({ revInsertError: "unique_violation" });
    const r = await createUploadJob(client, validReq);
    if (!isUploadJobError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(500);
    expect(r.error.message).toMatch(/Revision insert failed.*unique_violation/);
    // Cleanup: job row deleted by id.
    const del = log.find((e) => e.op === "delete");
    expect(del?.table).toBe("fabrication_jobs");
    expect(del?.eq).toEqual([["id", createdJobId]]);
  });

  it("returns 500 and deletes job when signed URL mint fails", async () => {
    const { client, log, createdJobId } = makeClient({ signedUrlError: "bucket not found" });
    const r = await createUploadJob(client, validReq);
    if (!isUploadJobError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(500);
    expect(r.error.message).toMatch(/Signed URL mint failed.*bucket not found/);
    // Cleanup: job row deleted by id (cascade removes the revision).
    const del = log.find((e) => e.op === "delete");
    expect(del?.table).toBe("fabrication_jobs");
    expect(del?.eq).toEqual([["id", createdJobId]]);
  });
});

// ============================================================
// Phase 4-2 — enqueueScanJob
// ============================================================
//
// Another query-builder chain fake, sharper this time: the routes only
// touch 3 tables (jobs, revisions, scan_jobs) and thumbnails storage.

interface EnqueueFakeOpts {
  jobFound?: boolean;
  jobStudentId?: string;
  jobLookupError?: string;
  latestRevision?: { id: string; revision_number: number } | null;
  revisionLookupError?: string;
  existingActiveScanJob?: {
    id: string;
    status: "pending" | "running";
    attempt_count: number;
  } | null;
  existingScanJobLookupError?: string;
  insertError?: string;
  insertedScanJob?: { id: string; status: string; attempt_count: number };
  // For retry-after-unique-violation test
  retryFindExisting?: { id: string; status: string; attempt_count: number };
}

function makeEnqueueClient(opts: EnqueueFakeOpts) {
  const {
    jobFound = true,
    jobStudentId = "student-1",
    jobLookupError,
    latestRevision = { id: "rev-latest", revision_number: 1 },
    revisionLookupError,
    existingActiveScanJob = null,
    existingScanJobLookupError,
    insertError,
    insertedScanJob = { id: "sj-new", status: "pending", attempt_count: 0 },
    retryFindExisting,
  } = opts;

  const log: Array<{ table: string; op: string; eq?: Array<[string, unknown]>; payload?: unknown }> = [];
  // Tracks consecutive lookups on fabrication_scan_jobs to simulate
  // the retry-after-unique-violation path.
  let scanJobSelectCount = 0;

  const tableHandler = (table: string) => {
    const entry: { table: string; op: string; eq: Array<[string, unknown]>; payload?: unknown; inFilter?: { col: string; vals: unknown[] }; order?: { col: string; asc: boolean }; limit?: number } = {
      table,
      op: "select",
      eq: [],
    };

    const chain: Record<string, unknown> = {};
    chain.eq = (col: string, val: unknown) => {
      entry.eq.push([col, val]);
      return chain;
    };
    chain.in = (col: string, vals: unknown[]) => {
      entry.inFilter = { col, vals };
      return chain;
    };
    chain.order = (col: string, opts: { ascending: boolean }) => {
      entry.order = { col, asc: opts.ascending };
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
            id: entry.eq[0][1],
            student_id: jobStudentId,
            status: "uploaded",
            current_revision: 1,
          },
          error: null,
        };
      }
      if (table === "fabrication_job_revisions") {
        if (revisionLookupError) return { data: null, error: { message: revisionLookupError } };
        return { data: latestRevision, error: null };
      }
      if (table === "fabrication_scan_jobs") {
        scanJobSelectCount++;
        if (existingScanJobLookupError) return { data: null, error: { message: existingScanJobLookupError } };
        // First select — look for existing active.
        if (scanJobSelectCount === 1) return { data: existingActiveScanJob, error: null };
        // Retry select (after unique violation) — return retryFindExisting.
        return { data: retryFindExisting ?? null, error: null };
      }
      return { data: null, error: null };
    };
    chain.single = async () => {
      log.push({ ...entry });
      if (table === "fabrication_scan_jobs" && entry.op === "insert") {
        if (insertError) return { data: null, error: { message: insertError } };
        return { data: insertedScanJob, error: null };
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
    };
  };

  return {
    client: { from: tableHandler, storage: { from: () => ({}) } } as unknown as Parameters<typeof enqueueScanJob>[0],
    log,
  };
}

describe("enqueueScanJob — happy paths", () => {
  it("inserts a new scan_job when none active exists (isNew: true)", async () => {
    const { client, log } = makeEnqueueClient({});
    const r = await enqueueScanJob(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error(`unexpected error: ${r.error.message}`);
    expect(r.isNew).toBe(true);
    expect(r.scanJobId).toBe("sj-new");
    expect(r.status).toBe("pending");
    expect(r.attemptCount).toBe(0);
    expect(r.jobRevisionId).toBe("rev-latest");

    // Insert payload shape check
    const insert = log.find((e) => e.table === "fabrication_scan_jobs" && e.op === "insert");
    expect(insert?.payload).toEqual({ job_revision_id: "rev-latest", status: "pending" });
  });

  it("returns existing scan_job when one is already pending (isNew: false, no INSERT)", async () => {
    const { client, log } = makeEnqueueClient({
      existingActiveScanJob: { id: "sj-existing", status: "pending", attempt_count: 0 },
    });
    const r = await enqueueScanJob(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error(`unexpected error: ${r.error.message}`);
    expect(r.isNew).toBe(false);
    expect(r.scanJobId).toBe("sj-existing");
    expect(r.status).toBe("pending");

    // No INSERT should have happened.
    expect(log.find((e) => e.table === "fabrication_scan_jobs" && e.op === "insert")).toBeUndefined();
  });

  it("returns existing scan_job when one is currently running (isNew: false)", async () => {
    const { client } = makeEnqueueClient({
      existingActiveScanJob: { id: "sj-running", status: "running", attempt_count: 1 },
    });
    const r = await enqueueScanJob(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error(`unexpected error: ${r.error.message}`);
    expect(r.isNew).toBe(false);
    expect(r.status).toBe("running");
    expect(r.attemptCount).toBe(1);
  });

  it("recovers from unique-violation race by re-reading the existing row", async () => {
    const { client } = makeEnqueueClient({
      insertError: "duplicate key value violates unique constraint \"uq_fabrication_scan_jobs_active_per_revision\"",
      retryFindExisting: { id: "sj-winner", status: "pending", attempt_count: 0 },
    });
    const r = await enqueueScanJob(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error(`unexpected error: ${r.error.message}`);
    expect(r.isNew).toBe(false);
    expect(r.scanJobId).toBe("sj-winner");
  });
});

describe("enqueueScanJob — ownership + error paths", () => {
  it("returns 404 when job does not exist", async () => {
    const { client } = makeEnqueueClient({ jobFound: false });
    const r = await enqueueScanJob(client, { studentId: "student-1", jobId: "does-not-exist" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(404);
    expect(r.error.message).toMatch(/Job not found/);
  });

  it("returns 404 when student does not own the job (no 403 — don't telegraph existence)", async () => {
    const { client } = makeEnqueueClient({ jobStudentId: "other-student" });
    const r = await enqueueScanJob(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(404);
    expect(r.error.message).toMatch(/Job not found/);
  });

  it("returns 500 when job lookup errors", async () => {
    const { client } = makeEnqueueClient({ jobLookupError: "db down" });
    const r = await enqueueScanJob(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(500);
    expect(r.error.message).toMatch(/Job lookup failed.*db down/);
  });

  it("returns 404 when no revision exists for the job", async () => {
    const { client } = makeEnqueueClient({ latestRevision: null });
    const r = await enqueueScanJob(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(404);
    expect(r.error.message).toMatch(/No revision/);
  });

  it("returns 500 when scan_job insert fails with a non-unique-violation error", async () => {
    const { client } = makeEnqueueClient({ insertError: "connection timeout" });
    const r = await enqueueScanJob(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(500);
    expect(r.error.message).toMatch(/Scan job insert failed.*connection timeout/);
  });
});

// ============================================================
// Phase 4-2 — getJobStatus
// ============================================================

interface StatusFakeOpts {
  jobFound?: boolean;
  jobStudentId?: string;
  jobStatus?: string;
  currentRevision?: number;
  revision?: {
    id: string;
    revision_number: number;
    scan_status: string | null;
    scan_error: string | null;
    scan_completed_at: string | null;
    scan_ruleset_version: string | null;
    thumbnail_path: string | null;
  } | null;
  scanJob?: {
    id: string;
    status: string;
    attempt_count: number;
    error_detail: string | null;
  } | null;
  thumbnailSignedUrl?: string;
  thumbnailError?: string;
}

function makeStatusClient(opts: StatusFakeOpts = {}) {
  const {
    jobFound = true,
    jobStudentId = "student-1",
    jobStatus = "scanning",
    currentRevision = 1,
    revision = {
      id: "rev-1",
      revision_number: 1,
      scan_status: "done",
      scan_error: null,
      scan_completed_at: "2026-04-22T22:14:21Z",
      scan_ruleset_version: "stl-v1.0.0+svg-v1.0.0",
      thumbnail_path: "abc-123.png",
    },
    scanJob = { id: "sj-1", status: "done", attempt_count: 1, error_detail: null },
    thumbnailSignedUrl = "https://stor.example.com/thumb?token=xyz",
    thumbnailError,
  } = opts;

  const log: Array<{ table: string; op: string; args?: unknown }> = [];

  const tableHandler = (table: string) => {
    const chain: Record<string, unknown> = {};
    chain.eq = (_col: string, _val: unknown) => chain;
    chain.order = (_col: string, _opts: unknown) => chain;
    chain.limit = (_n: number) => chain;
    chain.maybeSingle = async () => {
      log.push({ table, op: "select" });
      if (table === "fabrication_jobs") {
        if (!jobFound) return { data: null, error: null };
        return {
          data: {
            id: "job-1",
            student_id: jobStudentId,
            status: jobStatus,
            current_revision: currentRevision,
          },
          error: null,
        };
      }
      if (table === "fabrication_job_revisions") {
        return { data: revision, error: null };
      }
      if (table === "fabrication_scan_jobs") {
        return { data: scanJob, error: null };
      }
      return { data: null, error: null };
    };

    return {
      select: (_cols: string) => chain,
    };
  };

  const storage = {
    from: (bucket: string) => ({
      createSignedUrl: async (path: string, ttl: number) => {
        log.push({ table: `storage:${bucket}`, op: "signed-download", args: { path, ttl } });
        if (thumbnailError) return { data: null, error: { message: thumbnailError } };
        return { data: { signedUrl: thumbnailSignedUrl }, error: null };
      },
    }),
  };

  return {
    client: { from: tableHandler, storage } as unknown as Parameters<typeof getJobStatus>[0],
    log,
  };
}

describe("getJobStatus — happy path", () => {
  it("returns full denormalised payload with signed thumbnail URL", async () => {
    const { client, log } = makeStatusClient();
    const r = await getJobStatus(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error(`unexpected error: ${r.error.message}`);

    expect(r.jobId).toBe("job-1");
    expect(r.jobStatus).toBe("scanning");
    expect(r.currentRevision).toBe(1);
    expect(r.revision).toMatchObject({
      id: "rev-1",
      revisionNumber: 1,
      scanStatus: "done",
      scanRulesetVersion: "stl-v1.0.0+svg-v1.0.0",
      thumbnailUrl: "https://stor.example.com/thumb?token=xyz",
    });
    expect(r.scanJob).toEqual({
      id: "sj-1",
      status: "done",
      attemptCount: 1,
      errorDetail: null,
    });

    // Verify signed URL was minted against the right bucket + TTL.
    const sign = log.find((e) => e.op === "signed-download");
    expect(sign?.table).toBe(`storage:${FABRICATION_THUMBNAIL_BUCKET}`);
    expect((sign?.args as { path: string; ttl: number }).path).toBe("abc-123.png");
    expect((sign?.args as { path: string; ttl: number }).ttl).toBe(THUMBNAIL_URL_TTL_SECONDS);
  });

  it("reads thumbnail_path from the column, not from scan_results JSONB (Lesson #53)", async () => {
    // Sanity check — the fake's revision object exposes thumbnail_path at
    // the top level (column). If the impl ever regressed to scan_results
    // -> thumbnail_path lookup, our fake wouldn't expose it and the
    // signed-URL mint would be skipped → thumbnailUrl null.
    const { client } = makeStatusClient({
      revision: {
        id: "rev-1",
        revision_number: 1,
        scan_status: "done",
        scan_error: null,
        scan_completed_at: "x",
        scan_ruleset_version: "y",
        thumbnail_path: "column-path.png",
      },
    });
    const r = await getJobStatus(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error("expected success");
    expect(r.revision?.thumbnailUrl).toMatch(/thumb/);
  });

  it("returns thumbnailUrl: null when thumbnail_path column is empty", async () => {
    const { client } = makeStatusClient({
      revision: {
        id: "rev-1",
        revision_number: 1,
        scan_status: "pending",
        scan_error: null,
        scan_completed_at: null,
        scan_ruleset_version: null,
        thumbnail_path: null,
      },
      scanJob: { id: "sj-1", status: "pending", attempt_count: 0, error_detail: null },
    });
    const r = await getJobStatus(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error("expected success");
    expect(r.revision?.thumbnailUrl).toBeNull();
  });

  it("returns thumbnailUrl: null when signed URL minting fails (non-fatal)", async () => {
    const { client } = makeStatusClient({ thumbnailError: "bucket not found" });
    const r = await getJobStatus(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error("expected success despite thumb error");
    expect(r.revision?.thumbnailUrl).toBeNull();
    // Rest of the payload still populated.
    expect(r.revision?.scanStatus).toBe("done");
  });

  it("returns revision: null and scanJob: null for a job with no revisions yet", async () => {
    const { client } = makeStatusClient({ revision: null });
    const r = await getJobStatus(client, { studentId: "student-1", jobId: "job-1" });
    if (isOrchestrationError(r)) throw new Error("expected success");
    expect(r.revision).toBeNull();
    expect(r.scanJob).toBeNull();
  });
});

describe("getJobStatus — ownership", () => {
  it("returns 404 when job does not exist", async () => {
    const { client } = makeStatusClient({ jobFound: false });
    const r = await getJobStatus(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(404);
  });

  it("returns 404 when student does not own the job", async () => {
    const { client } = makeStatusClient({ jobStudentId: "other-student" });
    const r = await getJobStatus(client, { studentId: "student-1", jobId: "job-1" });
    if (!isOrchestrationError(r)) throw new Error("expected error");
    expect(r.error.status).toBe(404);
    expect(r.error.message).toMatch(/Job not found/);
  });
});

