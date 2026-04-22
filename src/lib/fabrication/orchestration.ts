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

// rule-buckets module imports only types from this file, so no cycle.
import { canSubmit } from "./rule-buckets";

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

// ============================================================
// Phase 5-1 — revisions + acknowledge + submit
// ============================================================

/** Choice values from the 3-option radio group in the should-fix UI. */
export const ACK_CHOICES = ["intentional", "will-fix-slicer", "acknowledged"] as const;
export type AckChoice = (typeof ACK_CHOICES)[number];

/**
 * Shape of acknowledged_warnings JSONB on fabrication_jobs.
 * Keyed `revision_<N>` → `{rule_id: {choice, timestamp}}`. Nested structure
 * gives per-revision audit trail which the teacher queue (Phase 6) will need.
 *
 * Note: migration 095's comment suggested a flat `[{rule_id, ack_at}]` array
 * — that was written in Phase 1A before the spec matured. JSONB column has
 * no CHECK constraint, so this nested shape is a conscious deviation for
 * better multi-revision audit.
 */
export type AcknowledgedWarnings = {
  [revisionKey: string]: {
    [ruleId: string]: { choice: AckChoice; timestamp: string };
  };
};

export interface CreateRevisionRequest {
  studentId: string;
  jobId: string;
  fileType: string;
  originalFilename: string;
  fileSizeBytes: number;
}

export type CreateRevisionResult = CreateUploadJobSuccess | CreateUploadJobError;

/**
 * Create revision N+1 on an existing job. Minimal version of createUploadJob
 * — skips the enrolment + machine-profile lookups (those were validated when
 * the job was first created) and just bumps the revision_number.
 */
export async function createRevision(
  db: SupabaseLike,
  req: CreateRevisionRequest
): Promise<CreateRevisionResult> {
  // 0. Validate body shape — mirror the Phase 4-1 validator rules but without
  //    classId / machineProfileId (those are locked to the existing job).
  if (!req.originalFilename || req.originalFilename.trim().length === 0) {
    return { error: { status: 400, message: "originalFilename required" } };
  }
  const trimmedFilename = req.originalFilename.trim();
  const ext = trimmedFilename.toLowerCase().split(".").pop() ?? "";
  if (!ALLOWED_FILE_TYPES.includes(req.fileType as FileType)) {
    return {
      error: {
        status: 400,
        message: `fileType must be one of: ${ALLOWED_FILE_TYPES.join(", ")}`,
      },
    };
  }
  if (ext !== req.fileType) {
    return {
      error: {
        status: 400,
        message: `originalFilename extension (.${ext}) does not match fileType (${req.fileType})`,
      },
    };
  }
  if (
    typeof req.fileSizeBytes !== "number" ||
    !Number.isFinite(req.fileSizeBytes) ||
    req.fileSizeBytes <= 0
  ) {
    return { error: { status: 400, message: "fileSizeBytes must be a positive number" } };
  }
  if (req.fileSizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    return {
      error: {
        status: 413,
        message: `File exceeds ${MAX_UPLOAD_SIZE_BYTES} byte limit (${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024} MB)`,
      },
    };
  }

  // 1. Load job + verify ownership.
  const ownership = await db
    .from("fabrication_jobs")
    .select("id, student_id, teacher_id, current_revision, file_type")
    .eq("id", req.jobId)
    .maybeSingle();
  if (ownership.error) {
    return {
      error: { status: 500, message: `Job lookup failed: ${ownership.error.message}` },
    };
  }
  if (!ownership.data) {
    return { error: { status: 404, message: "Job not found" } };
  }
  if (ownership.data.student_id !== req.studentId) {
    // 404 not 403 — don't telegraph job existence to non-owners (same
    // convention as the Phase 4-2 enqueue/status endpoints).
    return { error: { status: 404, message: "Job not found" } };
  }

  // 2. Validate re-upload file_type matches the job's file_type. A student
  //    who started with STL can't switch to SVG mid-job — machine profile
  //    applicability depends on file type.
  if (ownership.data.file_type !== req.fileType) {
    return {
      error: {
        status: 400,
        message: `Re-upload fileType (${req.fileType}) must match the original job fileType (${ownership.data.file_type})`,
      },
    };
  }

  // 3. Find the highest existing revision_number — we bump from there rather
  //    than trusting fabrication_jobs.current_revision (which may lag).
  const latestRev = await db
    .from("fabrication_job_revisions")
    .select("revision_number")
    .eq("job_id", req.jobId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestRev.error) {
    return {
      error: {
        status: 500,
        message: `Latest revision lookup failed: ${latestRev.error.message}`,
      },
    };
  }
  const nextRevisionNumber: number = (latestRev.data?.revision_number ?? 0) + 1;

  // 4. Build storage path for the new revision and INSERT.
  const teacherId: string = ownership.data.teacher_id;
  const storagePath = buildStoragePath({
    teacherId,
    studentId: req.studentId,
    jobId: req.jobId,
    revisionNumber: nextRevisionNumber,
    fileType: req.fileType as FileType,
  });

  const revInsert = await db
    .from("fabrication_job_revisions")
    .insert({
      job_id: req.jobId,
      revision_number: nextRevisionNumber,
      storage_path: storagePath,
      file_size_bytes: req.fileSizeBytes,
      scan_status: "pending",
    })
    .select("id")
    .single();
  if (revInsert.error || !revInsert.data) {
    return {
      error: {
        status: 500,
        message: `Revision insert failed: ${revInsert.error?.message ?? "unknown"}`,
      },
    };
  }
  const revisionId: string = revInsert.data.id;

  // 5. Also bump fabrication_jobs.current_revision so the denormalised column
  //    stays in sync (status endpoint reads current_revision to find the
  //    latest revision via join).
  const bump = await db
    .from("fabrication_jobs")
    .update({ current_revision: nextRevisionNumber })
    .eq("id", req.jobId);
  if (bump.error) {
    // Not fatal — revision row exists. Log via error path but don't delete
    // the revision (cleanup would cascade to undo the whole attempt).
    // Phase 6 can reconcile via max(revision_number) if current_revision
    // ever drifts.
  }

  // 6. Mint the signed upload URL.
  const urlResult = await db.storage
    .from(FABRICATION_UPLOAD_BUCKET)
    .createSignedUploadUrl(storagePath);
  if (urlResult.error || !urlResult.data) {
    // Delete the revision row we just created — no orphan storage path.
    await db.from("fabrication_job_revisions").delete().eq("id", revisionId);
    // Roll current_revision back only if we successfully bumped it above.
    if (!bump.error) {
      await db
        .from("fabrication_jobs")
        .update({ current_revision: nextRevisionNumber - 1 })
        .eq("id", req.jobId);
    }
    return {
      error: {
        status: 500,
        message: `Signed URL mint failed: ${urlResult.error?.message ?? "unknown"}`,
      },
    };
  }

  return {
    jobId: req.jobId,
    revisionId,
    uploadUrl: urlResult.data.signedUrl,
    storagePath,
  };
}

// ------------------------------------------------------------
// acknowledgeWarning
// ------------------------------------------------------------

export interface AcknowledgeWarningRequest {
  studentId: string;
  jobId: string;
  revisionNumber: number;
  ruleId: string;
  choice: AckChoice;
}

export type AcknowledgeWarningResult =
  | { acknowledgedWarnings: AcknowledgedWarnings }
  | OrchestrationError;

/**
 * Persist a single rule acknowledgement. Merge-patches
 * fabrication_jobs.acknowledged_warnings JSONB — READ-MODIFY-WRITE (no
 * atomic JSONB update RPC in v1; concurrent acks by the same student
 * would race but the same student can't realistically click two radios
 * simultaneously).
 */
export async function acknowledgeWarning(
  db: SupabaseLike,
  req: AcknowledgeWarningRequest
): Promise<AcknowledgeWarningResult> {
  if (!ACK_CHOICES.includes(req.choice)) {
    return {
      error: {
        status: 400,
        message: `choice must be one of: ${ACK_CHOICES.join(", ")}`,
      },
    };
  }
  if (!req.ruleId || typeof req.ruleId !== "string") {
    return { error: { status: 400, message: "ruleId required" } };
  }
  if (!Number.isInteger(req.revisionNumber) || req.revisionNumber < 1) {
    return { error: { status: 400, message: "revisionNumber must be a positive integer" } };
  }

  // 1. Load job + verify ownership + read current acknowledged_warnings.
  const ownership = await db
    .from("fabrication_jobs")
    .select("student_id, acknowledged_warnings")
    .eq("id", req.jobId)
    .maybeSingle();
  if (ownership.error) {
    return {
      error: { status: 500, message: `Job lookup failed: ${ownership.error.message}` },
    };
  }
  if (!ownership.data || ownership.data.student_id !== req.studentId) {
    return { error: { status: 404, message: "Job not found" } };
  }

  // 2. Merge-patch.
  const existing: AcknowledgedWarnings = ownership.data.acknowledged_warnings ?? {};
  const revisionKey = `revision_${req.revisionNumber}`;
  const updated: AcknowledgedWarnings = {
    ...existing,
    [revisionKey]: {
      ...(existing[revisionKey] ?? {}),
      [req.ruleId]: {
        choice: req.choice,
        timestamp: new Date().toISOString(),
      },
    },
  };

  // 3. Write back.
  const write = await db
    .from("fabrication_jobs")
    .update({ acknowledged_warnings: updated })
    .eq("id", req.jobId);
  if (write.error) {
    return {
      error: {
        status: 500,
        message: `Ack write failed: ${write.error.message}`,
      },
    };
  }

  return { acknowledgedWarnings: updated };
}

// ------------------------------------------------------------
// submitJob
// ------------------------------------------------------------

export interface SubmitJobRequest {
  studentId: string;
  jobId: string;
}

export type SubmitJobResult =
  | {
      jobId: string;
      newStatus: "pending_approval" | "approved";
      requiresTeacherApproval: boolean;
    }
  | OrchestrationError;

/**
 * Validate + transition. Reads the latest revision's scan_results, confirms
 * zero BLOCK rules fired AND every WARN rule has an ack for the current
 * revision, then transitions fabrication_jobs.status to 'pending_approval'
 * or 'approved' based on machine_profiles.requires_teacher_approval.
 */
export async function submitJob(
  db: SupabaseLike,
  req: SubmitJobRequest
): Promise<SubmitJobResult> {
  // 1. Load job (student ownership + machine profile id + current revision +
  //    acknowledged warnings + status).
  const jobResult = await db
    .from("fabrication_jobs")
    .select(
      "id, student_id, machine_profile_id, current_revision, acknowledged_warnings, status"
    )
    .eq("id", req.jobId)
    .maybeSingle();
  if (jobResult.error) {
    return {
      error: { status: 500, message: `Job lookup failed: ${jobResult.error.message}` },
    };
  }
  if (!jobResult.data || jobResult.data.student_id !== req.studentId) {
    return { error: { status: 404, message: "Job not found" } };
  }
  const job = jobResult.data;

  // 2. Guard against double-submit — once the job has progressed past
  //    'uploaded' / 'scanning' / 'needs_revision', it's in the teacher's
  //    or lab tech's court.
  const submittableStatuses = new Set(["uploaded", "scanning", "needs_revision"]);
  if (!submittableStatuses.has(job.status)) {
    return {
      error: {
        status: 409,
        message: `Job is in status '${job.status}' — can't submit from this state`,
      },
    };
  }

  // 3. Load the current revision's scan results.
  const revResult = await db
    .from("fabrication_job_revisions")
    .select("scan_status, scan_results, revision_number")
    .eq("job_id", req.jobId)
    .eq("revision_number", job.current_revision)
    .maybeSingle();
  if (revResult.error) {
    return {
      error: { status: 500, message: `Revision lookup failed: ${revResult.error.message}` },
    };
  }
  if (!revResult.data) {
    return { error: { status: 500, message: "Current revision not found" } };
  }
  if (revResult.data.scan_status !== "done") {
    return {
      error: {
        status: 400,
        message: `Scan not complete — status is '${revResult.data.scan_status}'`,
      },
    };
  }

  // 4. Validate via the shared gate (Phase 5-2). canSubmit is the single
  //    source of truth for "is this student cleared to submit" — same
  //    predicate the results viewer uses to enable the Submit button.
  //    Lesson #39: pattern bugs get fixed in one place, not duplicated.
  //    rule-buckets uses type-only imports from this file so no cycle.
  const gate = canSubmit({
    results: revResult.data.scan_results ?? { rules: [] },
    acknowledgedWarnings: job.acknowledged_warnings ?? {},
    revisionNumber: revResult.data.revision_number,
  });
  if (!gate.ok) {
    return {
      error: { status: 400, message: gate.message },
    };
  }

  // 5. Look up machine profile for approval routing.
  const profileResult = await db
    .from("machine_profiles")
    .select("requires_teacher_approval")
    .eq("id", job.machine_profile_id)
    .maybeSingle();
  if (profileResult.error) {
    return {
      error: {
        status: 500,
        message: `Machine profile lookup failed: ${profileResult.error.message}`,
      },
    };
  }
  if (!profileResult.data) {
    return { error: { status: 500, message: "Machine profile not found" } };
  }
  const requiresTeacherApproval: boolean = !!profileResult.data.requires_teacher_approval;
  const newStatus: "pending_approval" | "approved" = requiresTeacherApproval
    ? "pending_approval"
    : "approved";

  // 6. Transition status.
  const write = await db
    .from("fabrication_jobs")
    .update({ status: newStatus })
    .eq("id", req.jobId);
  if (write.error) {
    return {
      error: {
        status: 500,
        message: `Status transition failed: ${write.error.message}`,
      },
    };
  }

  return {
    jobId: req.jobId,
    newStatus,
    requiresTeacherApproval,
  };
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
