/**
 * Preflight Phase 4-1 — student fabrication upload orchestration.
 *
 * First code in the codebase to mint a Supabase Storage signed-upload URL.
 * Encapsulates the create-rows-then-mint-URL-with-cleanup-on-failure pattern
 * (option C from the Phase 4 pre-flight report) so the HTTP route handler
 * stays thin and testable.
 *
 * Flow:
 *   1. Validate request shape (extension matches fileType, size ≤ 50 MB,
 *      UUIDs well-formed).
 *   2. Verify student is enrolled in the chosen class (anti-spoof).
 *   3. Resolve teacher_id from the class (classes.teacher_id IS auth.users.id
 *      via the teachers.id = auth.users.id 1:1 mirror per schema-registry).
 *   4. Verify the machine_profile_id exists (v1 ships unfiltered per
 *      FU-CLASS-MACHINE-LINK — any profile is allowed).
 *   5. INSERT fabrication_jobs + fabrication_job_revisions atomically. If
 *      either INSERT fails, no orphan rows (we check the second result and
 *      delete the job if the revision failed).
 *   6. Mint a signed PUT URL via supabase.storage.createSignedUploadUrl().
 *      On failure, DELETE the job row (cascade removes the revision).
 *   7. UPDATE the revision's storage_path column to the minted path.
 *
 * Refs:
 *   - Phase 4 brief:          docs/projects/preflight-phase-4-brief.md §3 4-1
 *   - Schema:                 supabase/migrations/095_fabrication_jobs.sql
 *   - Bucket RLS:             supabase/migrations/102_fabrication_storage_buckets.sql
 *   - Lessons:                #38 (assert expected values), #45 (surgical),
 *                             #53 (column writes explicit — Phase 4-2 concern,
 *                             noted for the status route)
 */

export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB — Supabase Free Plan ceiling
export const FABRICATION_UPLOAD_BUCKET = "fabrication-uploads";
export const FABRICATION_THUMBNAIL_BUCKET = "fabrication-thumbnails";
export const THUMBNAIL_URL_TTL_SECONDS = 10 * 60; // 10 min — enough for UI to render
export const ALLOWED_FILE_TYPES = ["stl", "svg"] as const;

type FileType = (typeof ALLOWED_FILE_TYPES)[number];

// Simple RFC 4122 UUID v1–v5 check. Good enough to reject obvious garbage
// before we hit PostgREST — better error shape + saves a round trip.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CreateUploadJobRequest {
  studentId: string;
  classId: string;
  machineProfileId: string;
  fileType: string; // validated here, not at type level, so bad input surfaces as 400 not TS error
  originalFilename: string;
  fileSizeBytes: number;
}

export interface CreateUploadJobSuccess {
  jobId: string;
  revisionId: string;
  uploadUrl: string;
  storagePath: string;
}

export interface CreateUploadJobError {
  error: {
    status: number;
    message: string;
  };
}

export type CreateUploadJobResult = CreateUploadJobSuccess | CreateUploadJobError;

/**
 * Minimal Supabase client shape this module depends on. Keeps the test
 * mock tight — we only care about `.from(...)` and `.storage.from(...)`.
 * The route handler passes in the full createAdminClient() instance.
 */
// deno-fmt-ignore
interface SupabaseLike {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  storage: {
    from: (bucket: string) => {
      createSignedUploadUrl: (
        path: string
      ) => Promise<{
        data: { signedUrl: string; token: string; path: string } | null;
        error: { message: string } | null;
      }>;
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => Promise<{
        data: { signedUrl: string } | null;
        error: { message: string } | null;
      }>;
    };
  };
}

/**
 * Validate the incoming request body. Returns the typed payload on success
 * or a 400-shaped error on failure. Every message names the failing field
 * so the UI can surface it inline (Lesson #38 — assert expected values also
 * means the client gets a value it can act on, not "Bad request").
 */
export function validateUploadRequest(
  body: unknown
): { ok: true; data: CreateUploadJobRequest & { fileType: FileType } } | CreateUploadJobError {
  if (!body || typeof body !== "object") {
    return { error: { status: 400, message: "Request body must be JSON object" } };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.classId !== "string" || !UUID_RE.test(b.classId)) {
    return { error: { status: 400, message: "classId must be a UUID" } };
  }
  if (typeof b.machineProfileId !== "string" || !UUID_RE.test(b.machineProfileId)) {
    return { error: { status: 400, message: "machineProfileId must be a UUID" } };
  }
  if (typeof b.fileType !== "string" || !ALLOWED_FILE_TYPES.includes(b.fileType as FileType)) {
    return {
      error: {
        status: 400,
        message: `fileType must be one of: ${ALLOWED_FILE_TYPES.join(", ")}`,
      },
    };
  }
  if (typeof b.originalFilename !== "string" || b.originalFilename.trim().length === 0) {
    return { error: { status: 400, message: "originalFilename required" } };
  }
  const trimmedFilename = b.originalFilename.trim();
  const ext = trimmedFilename.toLowerCase().split(".").pop() ?? "";
  if (ext !== b.fileType) {
    return {
      error: {
        status: 400,
        message: `originalFilename extension (.${ext}) does not match fileType (${b.fileType})`,
      },
    };
  }
  if (typeof b.fileSizeBytes !== "number" || !Number.isFinite(b.fileSizeBytes) || b.fileSizeBytes <= 0) {
    return { error: { status: 400, message: "fileSizeBytes must be a positive number" } };
  }
  if (b.fileSizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    return {
      error: {
        status: 413,
        message: `File exceeds ${MAX_UPLOAD_SIZE_BYTES} byte limit (${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024} MB)`,
      },
    };
  }

  // studentId is supplied by the caller (from requireStudentAuth), not the
  // request body — trust the auth layer, don't re-derive.
  return {
    ok: true,
    data: {
      studentId: "", // filled in by caller before passing to createUploadJob
      classId: b.classId,
      machineProfileId: b.machineProfileId,
      fileType: b.fileType as FileType,
      originalFilename: trimmedFilename,
      fileSizeBytes: b.fileSizeBytes,
    },
  };
}

/**
 * Build the Storage path for a revision. Spec §4 Stage 1 proposed
 * `fabrication/{school_id}/{teacher_id}/{student_id}/{job_id}/v{version}.{ext}`
 * — we drop school_id because it's nullable throughout the schema.
 * Easy to add later by inserting `{schoolId}/` when schools lands.
 */
export function buildStoragePath(params: {
  teacherId: string;
  studentId: string;
  jobId: string;
  revisionNumber: number;
  fileType: FileType;
}): string {
  const { teacherId, studentId, jobId, revisionNumber, fileType } = params;
  return `fabrication/${teacherId}/${studentId}/${jobId}/v${revisionNumber}.${fileType}`;
}

/**
 * Orchestrator. Called by the POST route after requireStudentAuth resolves.
 *
 * On any failure after the fabrication_jobs INSERT succeeds, cleans up the
 * job row (cascade removes the revision via the FK's ON DELETE CASCADE on
 * fabrication_job_revisions.job_id). This keeps the orchestration atomic
 * from the client's perspective even though we don't wrap in a Postgres
 * transaction (supabase-js doesn't expose BEGIN/COMMIT via PostgREST; the
 * cleanup path is the pragmatic substitute).
 */
export async function createUploadJob(
  db: SupabaseLike,
  req: CreateUploadJobRequest
): Promise<CreateUploadJobResult> {
  // 1. Verify student enrolment in the class. Anti-spoof — auth gives us a
  //    studentId, the request gives us a classId, they must match.
  const enrolment = await db
    .from("class_students")
    .select("student_id")
    .eq("student_id", req.studentId)
    .eq("class_id", req.classId)
    .maybeSingle();
  if (enrolment.error) {
    return {
      error: { status: 500, message: `Enrolment check failed: ${enrolment.error.message}` },
    };
  }
  if (!enrolment.data) {
    return { error: { status: 403, message: "Not enrolled in this class" } };
  }

  // 2. Resolve teacher_id from the class. classes.teacher_id IS auth.users.id
  //    (teachers.id = auth.users.id per schema-registry.yaml).
  const classRow = await db
    .from("classes")
    .select("teacher_id")
    .eq("id", req.classId)
    .maybeSingle();
  if (classRow.error) {
    return {
      error: { status: 500, message: `Class lookup failed: ${classRow.error.message}` },
    };
  }
  if (!classRow.data || !classRow.data.teacher_id) {
    return { error: { status: 500, message: "Class has no teacher — data integrity issue" } };
  }
  const teacherId: string = classRow.data.teacher_id;

  // 3. Verify machine profile exists. v1 unfiltered per FU-CLASS-MACHINE-LINK.
  const profile = await db
    .from("machine_profiles")
    .select("id")
    .eq("id", req.machineProfileId)
    .maybeSingle();
  if (profile.error) {
    return {
      error: {
        status: 500,
        message: `Machine profile lookup failed: ${profile.error.message}`,
      },
    };
  }
  if (!profile.data) {
    return { error: { status: 404, message: "Machine profile not found" } };
  }

  // 4. INSERT fabrication_jobs. status='uploaded' + current_revision=1 are
  //    defaulted by the schema but we set explicitly for readability.
  const jobInsert = await db
    .from("fabrication_jobs")
    .insert({
      teacher_id: teacherId,
      student_id: req.studentId,
      class_id: req.classId,
      machine_profile_id: req.machineProfileId,
      file_type: req.fileType,
      original_filename: req.originalFilename,
      status: "uploaded",
      current_revision: 1,
    })
    .select("id")
    .single();
  if (jobInsert.error || !jobInsert.data) {
    return {
      error: {
        status: 500,
        message: `Job insert failed: ${jobInsert.error?.message ?? "unknown"}`,
      },
    };
  }
  const jobId: string = jobInsert.data.id;

  // 5. Build the storage path now that we have the jobId.
  const storagePath = buildStoragePath({
    teacherId,
    studentId: req.studentId,
    jobId,
    revisionNumber: 1,
    fileType: req.fileType as FileType,
  });

  // 6. INSERT fabrication_job_revisions. storage_path set in same INSERT
  //    (not as an UPDATE afterward) to avoid a window where the row exists
  //    without its path.
  const revInsert = await db
    .from("fabrication_job_revisions")
    .insert({
      job_id: jobId,
      revision_number: 1,
      storage_path: storagePath,
      file_size_bytes: req.fileSizeBytes,
      scan_status: "pending",
    })
    .select("id")
    .single();
  if (revInsert.error || !revInsert.data) {
    // Cleanup: delete the orphan job row.
    await db.from("fabrication_jobs").delete().eq("id", jobId);
    return {
      error: {
        status: 500,
        message: `Revision insert failed: ${revInsert.error?.message ?? "unknown"}`,
      },
    };
  }
  const revisionId: string = revInsert.data.id;

  // 7. Mint the signed upload URL. On failure, cascade-delete the job to
  //    remove both rows (FK ON DELETE CASCADE on revisions.job_id).
  const urlResult = await db.storage
    .from(FABRICATION_UPLOAD_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (urlResult.error || !urlResult.data) {
    await db.from("fabrication_jobs").delete().eq("id", jobId);
    return {
      error: {
        status: 500,
        message: `Signed URL mint failed: ${urlResult.error?.message ?? "unknown"}`,
      },
    };
  }

  return {
    jobId,
    revisionId,
    uploadUrl: urlResult.data.signedUrl,
    storagePath,
  };
}

// Narrow-cast helper for the route handler — TypeScript can't distinguish the
// union return type without a user-defined guard.
export function isUploadJobError(r: CreateUploadJobResult): r is CreateUploadJobError {
  return (r as CreateUploadJobError).error !== undefined;
}

// ============================================================
// Phase 4-2 — scan enqueue + status
// ============================================================

export interface OrchestrationError {
  error: {
    status: number;
    message: string;
  };
}

export interface EnqueueScanSuccess {
  scanJobId: string;
  status: "pending" | "running" | "done" | "error";
  attemptCount: number;
  isNew: boolean; // false if this call was idempotent-no-op
  jobRevisionId: string;
}

export type EnqueueScanResult = EnqueueScanSuccess | OrchestrationError;

export interface JobStatusRevision {
  id: string;
  revisionNumber: number;
  scanStatus: string | null;
  scanError: string | null;
  scanCompletedAt: string | null;
  scanRulesetVersion: string | null;
  thumbnailUrl: string | null; // signed, 10-min TTL; null if no thumbnail_path set yet
}

export interface JobStatusScanJob {
  id: string;
  status: "pending" | "running" | "done" | "error";
  attemptCount: number;
  errorDetail: string | null;
}

export interface JobStatusSuccess {
  jobId: string;
  jobStatus: string; // fabrication_jobs.status ('uploaded' | 'scanning' | ...)
  currentRevision: number;
  revision: JobStatusRevision | null;
  scanJob: JobStatusScanJob | null;
}

export type JobStatusResult = JobStatusSuccess | OrchestrationError;

export function isOrchestrationError(r: unknown): r is OrchestrationError {
  return (
    typeof r === "object" &&
    r !== null &&
    "error" in r &&
    typeof (r as { error: unknown }).error === "object"
  );
}

/**
 * Verify the student owns this fabrication job. All student-facing job
 * routes (enqueue, status, future re-upload, future cancel) share this
 * check — pull it into one helper so every route path is identical.
 * Also confirms the job exists at all — a missing row returns 404, not
 * 403, so clients can distinguish.
 */
async function loadOwnedJob(
  db: SupabaseLike,
  studentId: string,
  jobId: string
): Promise<
  | { job: { id: string; student_id: string; status: string; current_revision: number } }
  | OrchestrationError
> {
  const result = await db
    .from("fabrication_jobs")
    .select("id, student_id, status, current_revision")
    .eq("id", jobId)
    .maybeSingle();
  if (result.error) {
    return {
      error: { status: 500, message: `Job lookup failed: ${result.error.message}` },
    };
  }
  if (!result.data) {
    return { error: { status: 404, message: "Job not found" } };
  }
  if (result.data.student_id !== studentId) {
    // 404 not 403 — don't telegraph that a job with this id exists but
    // belongs to someone else. Same-shape response for "doesn't exist"
    // and "not yours".
    return { error: { status: 404, message: "Job not found" } };
  }
  return { job: result.data };
}

/**
 * Idempotent enqueue. Finds the latest revision for the job, checks for
 * an existing active (pending|running) scan_job via the unique index,
 * and either returns the existing row or INSERTs a new one.
 *
 * Race behaviour: the SELECT→INSERT pair isn't atomic. If two concurrent
 * enqueues both find no existing row, both try to INSERT; the DB's
 * `uq_fabrication_scan_jobs_active_per_revision` unique index (migration
 * 096) rejects the second with 23505. We catch + retry the SELECT so
 * the loser still returns the winner's row — idempotent from both
 * clients' perspective.
 */
export async function enqueueScanJob(
  db: SupabaseLike,
  params: { studentId: string; jobId: string }
): Promise<EnqueueScanResult> {
  const { studentId, jobId } = params;

  const ownership = await loadOwnedJob(db, studentId, jobId);
  if (isOrchestrationError(ownership)) return ownership;

  // Find the latest revision. Order desc + limit 1.
  const latestRev = await db
    .from("fabrication_job_revisions")
    .select("id, revision_number")
    .eq("job_id", jobId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestRev.error) {
    return {
      error: {
        status: 500,
        message: `Revision lookup failed: ${latestRev.error.message}`,
      },
    };
  }
  if (!latestRev.data) {
    return { error: { status: 404, message: "No revision found for this job" } };
  }
  const revisionId: string = latestRev.data.id;

  // Check for an existing active scan job for this revision.
  const existing = await db
    .from("fabrication_scan_jobs")
    .select("id, status, attempt_count")
    .eq("job_revision_id", revisionId)
    .in("status", ["pending", "running"])
    .maybeSingle();
  if (existing.error) {
    return {
      error: {
        status: 500,
        message: `Existing scan lookup failed: ${existing.error.message}`,
      },
    };
  }
  if (existing.data) {
    return {
      scanJobId: existing.data.id,
      status: existing.data.status,
      attemptCount: existing.data.attempt_count,
      isNew: false,
      jobRevisionId: revisionId,
    };
  }

  // Insert a fresh scan_job row. status defaults to 'pending' per the
  // schema CHECK constraint, but we set it explicitly for readability.
  const insert = await db
    .from("fabrication_scan_jobs")
    .insert({ job_revision_id: revisionId, status: "pending" })
    .select("id, status, attempt_count")
    .single();
  if (insert.error || !insert.data) {
    // Handle the unique-violation race. PostgREST returns code '23505'
    // or the message includes 'duplicate key'. Either way, re-read.
    const msg = insert.error?.message ?? "";
    const isUniqueViolation =
      msg.includes("23505") ||
      msg.toLowerCase().includes("duplicate key") ||
      msg.toLowerCase().includes("uq_fabrication_scan_jobs_active_per_revision");
    if (isUniqueViolation) {
      const retry = await db
        .from("fabrication_scan_jobs")
        .select("id, status, attempt_count")
        .eq("job_revision_id", revisionId)
        .in("status", ["pending", "running"])
        .maybeSingle();
      if (retry.data) {
        return {
          scanJobId: retry.data.id,
          status: retry.data.status,
          attemptCount: retry.data.attempt_count,
          isNew: false,
          jobRevisionId: revisionId,
        };
      }
    }
    return {
      error: {
        status: 500,
        message: `Scan job insert failed: ${insert.error?.message ?? "unknown"}`,
      },
    };
  }

  return {
    scanJobId: insert.data.id,
    status: insert.data.status,
    attemptCount: insert.data.attempt_count,
    isNew: true,
    jobRevisionId: revisionId,
  };
}

/**
 * Load the denormalised status payload for the student-facing poll. Joins
 * the latest revision and the latest scan_job, mints a fresh thumbnail
 * signed URL if thumbnail_path is set.
 *
 * Lesson #53 applies: we read `thumbnail_path` off the column directly,
 * not from `scan_results->>'thumbnail_path'`. The column is authoritative
 * post-22-Apr.
 */
export async function getJobStatus(
  db: SupabaseLike,
  params: { studentId: string; jobId: string }
): Promise<JobStatusResult> {
  const { studentId, jobId } = params;

  const ownership = await loadOwnedJob(db, studentId, jobId);
  if (isOrchestrationError(ownership)) return ownership;
  const job = ownership.job;

  // Latest revision for the job.
  const revResult = await db
    .from("fabrication_job_revisions")
    .select(
      "id, revision_number, scan_status, scan_error, scan_completed_at, scan_ruleset_version, thumbnail_path"
    )
    .eq("job_id", jobId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (revResult.error) {
    return {
      error: {
        status: 500,
        message: `Revision lookup failed: ${revResult.error.message}`,
      },
    };
  }

  let revision: JobStatusRevision | null = null;
  let scanJob: JobStatusScanJob | null = null;

  if (revResult.data) {
    // Mint a fresh thumbnail URL if the column is populated. If the bucket
    // says the object doesn't exist yet (worker hasn't uploaded), skip.
    let thumbnailUrl: string | null = null;
    if (revResult.data.thumbnail_path) {
      const signed = await db.storage
        .from(FABRICATION_THUMBNAIL_BUCKET)
        .createSignedUrl(revResult.data.thumbnail_path, THUMBNAIL_URL_TTL_SECONDS);
      if (signed.error) {
        // Non-fatal — log path would be nice but keep this lib dep-free.
        // UI just sees null and falls back to a placeholder.
        thumbnailUrl = null;
      } else if (signed.data) {
        thumbnailUrl = signed.data.signedUrl;
      }
    }

    revision = {
      id: revResult.data.id,
      revisionNumber: revResult.data.revision_number,
      scanStatus: revResult.data.scan_status ?? null,
      scanError: revResult.data.scan_error ?? null,
      scanCompletedAt: revResult.data.scan_completed_at ?? null,
      scanRulesetVersion: revResult.data.scan_ruleset_version ?? null,
      thumbnailUrl,
    };

    // Latest scan_job for that revision (if any exist yet).
    const sjResult = await db
      .from("fabrication_scan_jobs")
      .select("id, status, attempt_count, error_detail")
      .eq("job_revision_id", revResult.data.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sjResult.error) {
      return {
        error: {
          status: 500,
          message: `Scan job lookup failed: ${sjResult.error.message}`,
        },
      };
    }
    if (sjResult.data) {
      scanJob = {
        id: sjResult.data.id,
        status: sjResult.data.status,
        attemptCount: sjResult.data.attempt_count,
        errorDetail: sjResult.data.error_detail ?? null,
      };
    }
  }

  return {
    jobId: job.id,
    jobStatus: job.status,
    currentRevision: job.current_revision,
    revision,
    scanJob,
  };
}
