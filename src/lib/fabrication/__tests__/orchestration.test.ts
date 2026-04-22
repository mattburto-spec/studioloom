import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MAX_UPLOAD_SIZE_BYTES,
  FABRICATION_UPLOAD_BUCKET,
  buildStoragePath,
  validateUploadRequest,
  createUploadJob,
  isUploadJobError,
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
          return { data: { teacher_id: classTeacherId }, error: null };
        }
        if (table === "machine_profiles") {
          if (machineError) return { data: null, error: { message: machineError } };
          return { data: machineFound ? { id: entry.eq![0][1] } : null, error: null };
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
    const jobInsert = log.find((e) => e.table === "fabrication_jobs" && e.op === "insert");
    expect(jobInsert?.payload).toEqual({
      teacher_id: "teacher-uuid-111",
      student_id: validReq.studentId,
      class_id: validReq.classId,
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
