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

/**
 * Phase 8.1d-22: upload accepts EITHER a specific machineProfileId
 * OR a (labId + machineCategory) pair. Discriminated by presence of
 * machineProfileId in the request body. Both result in a row with
 * lab_id + machine_category populated; the difference is whether
 * machine_profile_id is also bound or left null for the fab to
 * assign on pickup.
 */
export interface CreateUploadJobRequest {
  studentId: string;
  classId: string;
  // EITHER pick a specific machine (existing flow):
  machineProfileId?: string;
  // OR pick category + lab and let the fab assign a machine:
  labId?: string;
  machineCategory?: "3d_printer" | "laser_cutter";
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
      // Phase 8.1d-32: deleteStudentJob removes uploaded + thumbnail
      // bytes from Storage when a student fully purges their own
      // job. Best-effort — partial failure is logged but the DB
      // delete still completes.
      remove: (paths: string[]) => Promise<{
        data: unknown;
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

  // Phase 8.1d-22: accept either a specific machineProfileId OR a
  // (labId + machineCategory) pair. Validate exactly ONE shape was
  // sent — both or neither is a 400.
  const hasMachine =
    typeof b.machineProfileId === "string" && b.machineProfileId.length > 0;
  const hasCategoryLab =
    (typeof b.labId === "string" && b.labId.length > 0) ||
    (typeof b.machineCategory === "string" && b.machineCategory.length > 0);

  if (hasMachine && hasCategoryLab) {
    return {
      error: {
        status: 400,
        message:
          "Send either machineProfileId OR (labId + machineCategory), not both.",
      },
    };
  }
  if (!hasMachine && !hasCategoryLab) {
    return {
      error: {
        status: 400,
        message:
          "Pick a machine — provide machineProfileId, or labId + machineCategory.",
      },
    };
  }

  if (hasMachine) {
    if (typeof b.machineProfileId !== "string" || !UUID_RE.test(b.machineProfileId)) {
      return { error: { status: 400, message: "machineProfileId must be a UUID" } };
    }
  } else {
    if (typeof b.labId !== "string" || !UUID_RE.test(b.labId)) {
      return { error: { status: 400, message: "labId must be a UUID" } };
    }
    if (
      b.machineCategory !== "3d_printer" &&
      b.machineCategory !== "laser_cutter"
    ) {
      return {
        error: {
          status: 400,
          message: "machineCategory must be '3d_printer' or 'laser_cutter'",
        },
      };
    }
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
      // Phase 8.1d-22: pass through whichever of the two shapes the
      // caller sent. createUploadJob's branch logic deals with the
      // resolution.
      ...(hasMachine
        ? { machineProfileId: b.machineProfileId as string }
        : {
            labId: b.labId as string,
            machineCategory: b.machineCategory as
              | "3d_printer"
              | "laser_cutter",
          }),
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

  // 3. Resolve lab_id + machine_category. Two paths per Phase
  //    8.1d-22:
  //      a) machineProfileId set → look up the machine, derive lab
  //         + category from it. machine_profile_id stays bound on
  //         the row.
  //      b) labId + machineCategory set → validate the lab is owned
  //         by this teacher; leave machine_profile_id NULL so the
  //         fab assigns it on pickup.
  //    Both paths converge on the same set of three fields written
  //    to the row: lab_id, machine_category, machine_profile_id (or
  //    null in path b).
  let resolvedLabId: string;
  let resolvedCategory: "3d_printer" | "laser_cutter";
  let resolvedMachineId: string | null;

  if (req.machineProfileId) {
    const profile = await db
      .from("machine_profiles")
      .select("id, teacher_id, lab_id, machine_category, is_active")
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
    if (!profile.data || profile.data.is_active === false) {
      return { error: { status: 404, message: "Machine profile not found" } };
    }
    if (
      profile.data.teacher_id !== null &&
      profile.data.teacher_id !== teacherId
    ) {
      // System templates (teacher_id null) pass through; teacher-
      // owned machines must belong to THIS class's teacher.
      return { error: { status: 404, message: "Machine profile not found" } };
    }
    if (!profile.data.lab_id) {
      return {
        error: {
          status: 409,
          message:
            "This machine isn't assigned to a lab. Ask your teacher to move it into a lab from the Lab Setup page.",
        },
      };
    }
    if (
      profile.data.machine_category !== "3d_printer" &&
      profile.data.machine_category !== "laser_cutter"
    ) {
      return {
        error: {
          status: 409,
          message: `Machine has unknown category '${profile.data.machine_category}'`,
        },
      };
    }
    resolvedLabId = profile.data.lab_id;
    resolvedCategory = profile.data.machine_category;
    resolvedMachineId = profile.data.id;
  } else {
    // Path b: labId + machineCategory provided directly. validate
    // the lab is real + owned by this teacher.
    const labRow = await db
      .from("fabrication_labs")
      .select("id, teacher_id")
      .eq("id", req.labId as string)
      .maybeSingle();
    if (labRow.error) {
      return {
        error: {
          status: 500,
          message: `Lab lookup failed: ${labRow.error.message}`,
        },
      };
    }
    if (!labRow.data || labRow.data.teacher_id !== teacherId) {
      return { error: { status: 404, message: "Lab not found" } };
    }
    resolvedLabId = req.labId as string;
    resolvedCategory = req.machineCategory as "3d_printer" | "laser_cutter";
    resolvedMachineId = null;
  }

  // 4. INSERT fabrication_jobs. status='uploaded' + current_revision=1 are
  //    defaulted by the schema but we set explicitly for readability.
  const jobInsert = await db
    .from("fabrication_jobs")
    .insert({
      teacher_id: teacherId,
      student_id: req.studentId,
      class_id: req.classId,
      lab_id: resolvedLabId,
      machine_category: resolvedCategory,
      machine_profile_id: resolvedMachineId,
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
  /** Phase 5-5: file_type of the job (stl | svg). Needed by ReuploadModal
   *  to lock the new revision to the same type as the original. */
  fileType: "stl" | "svg";
  revision: JobStatusRevision | null;
  scanJob: JobStatusScanJob | null;
  /**
   * Phase 5-4: full scan_results JSONB when `includeResults` was passed.
   * Omitted when absent to keep the 2s-poll payload light. Shape is the
   * worker's scan_results JSONB: { rules: Rule[], ruleset_version,
   *   scan_duration_ms, thumbnail_path }.
   */
  scanResults?: { rules?: Array<{ id: string; severity: string; [k: string]: unknown }> | null } | null;
  /**
   * Phase 5-4: acknowledged_warnings JSONB from fabrication_jobs when
   * includeResults=true. Omitted on thin polls.
   */
  acknowledgedWarnings?: { [revisionKey: string]: { [ruleId: string]: { choice: string; timestamp: string } } } | null;
  /**
   * Phase 6-5: teacher_review_note + teacher_reviewed_at from
   * fabrication_jobs when includeResults=true. Populated after a
   * teacher acts via /api/teacher/fabrication/jobs/[jobId]/{approve,
   * return-for-revision, reject, note}. Student UI keys off jobStatus
   * + the note to render the amber/red review card (see
   * TeacherReviewNoteCard). Both fields null when teacher hasn't
   * touched the job. Omitted (not in the payload at all) on thin
   * polls so the 2s poll stays tiny.
   */
  teacherReviewNote?: string | null;
  teacherReviewedAt?: string | null;
  /**
   * Phase 7-5: lab-tech completion fields from fabrication_jobs when
   * includeResults=true. Populated after a fabricator acts via
   * /api/fab/jobs/[jobId]/{complete,fail}. Student UI keys off
   * `completionStatus` + `completionNote` to render the green/red
   * result card (LabTechCompletionCard). All three null when no
   * fabricator action yet. Omitted on thin polls.
   */
  completionStatus?: string | null;
  completionNote?: string | null;
  completedAt?: string | null;
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
  // Phase 8.1d-25: also pull lab_id + machine_category so we can
  // resolve approval routing when machine_profile_id is NULL
  // (category-only "Any 3D printer" jobs from 8.1d-22). The
  // surrogate-machine logic mirrors the scanner's 8.1d-24 fix.
  const jobResult = await db
    .from("fabrication_jobs")
    .select(
      "id, student_id, machine_profile_id, lab_id, machine_category, current_revision, acknowledged_warnings, status"
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

  // 5. Look up requires_teacher_approval. Two paths per Phase 8.1d-25:
  //    - Specific machine bound: read its requires_teacher_approval
  //      directly (existing behaviour).
  //    - Category-only (machine_profile_id IS NULL): pick a surrogate
  //      machine in (lab_id, machine_category) and use its setting.
  //      Same surrogate logic as the Python scanner's 8.1d-24 fix.
  //      Lab-level bulk-approval toggle (8.1d-7) keeps these uniform
  //      within a lab+category bucket, so any active machine works.
  //
  //    Conservative fallback: when the bucket has zero active
  //    machines (data-integrity edge — student submitted to a lab
  //    whose machines were all deactivated mid-flow), require
  //    teacher approval so the teacher catches it. Better to over-
  //    route than skip the gate.
  let requiresTeacherApproval: boolean;
  if (job.machine_profile_id) {
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
    requiresTeacherApproval = !!profileResult.data.requires_teacher_approval;
  } else {
    // Category-only job — surrogate lookup.
    const surrogateResult = await db
      .from("machine_profiles")
      .select("requires_teacher_approval")
      .eq("lab_id", job.lab_id)
      .eq("machine_category", job.machine_category)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (surrogateResult.error) {
      return {
        error: {
          status: 500,
          message: `Surrogate machine lookup failed: ${surrogateResult.error.message}`,
        },
      };
    }
    requiresTeacherApproval = surrogateResult.data
      ? !!surrogateResult.data.requires_teacher_approval
      : true; // conservative fallback
  }
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
  | {
      job: {
        id: string;
        student_id: string;
        status: string;
        current_revision: number;
        file_type: "stl" | "svg";
      };
    }
  | OrchestrationError
> {
  const result = await db
    .from("fabrication_jobs")
    .select("id, student_id, status, current_revision, file_type")
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
  params: { studentId: string; jobId: string; includeResults?: boolean }
): Promise<JobStatusResult> {
  const { studentId, jobId, includeResults = false } = params;

  // Phase 5-4: when includeResults=true, fetch acknowledged_warnings from
  // the job row inline. Otherwise use loadOwnedJob's lean SELECT for the
  // 2s poll case. One DB round trip either way.
  let ackWarnings: { [k: string]: { [r: string]: { choice: string; timestamp: string } } } | null =
    null;
  // Phase 6-5: teacher review fields surface on includeResults=true
  // polls so the student status page can render the amber/red review
  // card without an extra round-trip. Thin polls skip these.
  let teacherReviewNote: string | null = null;
  let teacherReviewedAt: string | null = null;
  let completionStatus: string | null = null;
  let completionNote: string | null = null;
  let completedAt: string | null = null;
  let job: {
    id: string;
    student_id: string;
    status: string;
    current_revision: number;
    file_type: "stl" | "svg";
  };

  if (includeResults) {
    const full = await db
      .from("fabrication_jobs")
      .select(
        "id, student_id, status, current_revision, acknowledged_warnings, file_type, teacher_review_note, teacher_reviewed_at, completion_status, completion_note, completed_at"
      )
      .eq("id", jobId)
      .maybeSingle();
    if (full.error) {
      return {
        error: { status: 500, message: `Job lookup failed: ${full.error.message}` },
      };
    }
    if (!full.data || full.data.student_id !== studentId) {
      return { error: { status: 404, message: "Job not found" } };
    }
    ackWarnings = full.data.acknowledged_warnings ?? null;
    teacherReviewNote = full.data.teacher_review_note ?? null;
    teacherReviewedAt = full.data.teacher_reviewed_at ?? null;
    completionStatus = full.data.completion_status ?? null;
    completionNote = full.data.completion_note ?? null;
    completedAt = full.data.completed_at ?? null;
    job = full.data;
  } else {
    const ownership = await loadOwnedJob(db, studentId, jobId);
    if (isOrchestrationError(ownership)) return ownership;
    job = ownership.job;
  }

  // Latest revision for the job. Include scan_results JSONB when
  // includeResults is set.
  const selectCols = includeResults
    ? "id, revision_number, scan_status, scan_error, scan_completed_at, scan_ruleset_version, thumbnail_path, scan_results"
    : "id, revision_number, scan_status, scan_error, scan_completed_at, scan_ruleset_version, thumbnail_path";

  const revResult = await db
    .from("fabrication_job_revisions")
    .select(selectCols)
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
    fileType: job.file_type,
    revision,
    scanJob,
    ...(includeResults
      ? {
          scanResults: revResult.data?.scan_results ?? null,
          acknowledgedWarnings: ackWarnings,
          teacherReviewNote,
          teacherReviewedAt,
          completionStatus,
          completionNote,
          completedAt,
        }
      : {}),
  };
}

// ============================================================
// Phase 5-5 — listRevisions
// ============================================================

export interface RevisionSummary {
  id: string;
  revisionNumber: number;
  scanStatus: string | null;
  scanError: string | null;
  scanCompletedAt: string | null;
  thumbnailUrl: string | null;
  /** Counts derived from scan_results JSONB. Zero if scan not done or no rules. */
  ruleCounts: { block: number; warn: number; fyi: number };
  createdAt: string;
}

export interface ListRevisionsSuccess {
  revisions: RevisionSummary[];
}
export type ListRevisionsResult = ListRevisionsSuccess | OrchestrationError;

interface RevisionRow {
  id: string;
  revision_number: number;
  scan_status: string | null;
  scan_error: string | null;
  scan_completed_at: string | null;
  thumbnail_path: string | null;
  scan_results: { rules?: Array<{ severity?: string }> | null } | null;
  uploaded_at: string;
}

/**
 * Count rules by severity for the history panel summary strip.
 * Lowercase per worker contract — anything else is dropped.
 */
function countRulesBySeverity(rules: Array<{ severity?: string }> | null | undefined): {
  block: number;
  warn: number;
  fyi: number;
} {
  const counts = { block: 0, warn: 0, fyi: 0 };
  for (const r of rules ?? []) {
    if (r.severity === "block") counts.block++;
    else if (r.severity === "warn") counts.warn++;
    else if (r.severity === "fyi") counts.fyi++;
  }
  return counts;
}

/**
 * Return all revisions for a job, newest first, with mini-thumbnail
 * signed URLs + rule-count summaries. Used by the RevisionHistoryPanel
 * on the status page.
 */
export async function listRevisions(
  db: SupabaseLike,
  params: { studentId: string; jobId: string }
): Promise<ListRevisionsResult> {
  const { studentId, jobId } = params;

  // 1. Ownership via the existing helper.
  const ownership = await loadOwnedJob(db, studentId, jobId);
  if (isOrchestrationError(ownership)) return ownership;

  // 2. Fetch all revisions. Order DESC so most recent is first.
  const result = await db
    .from("fabrication_job_revisions")
    .select(
      "id, revision_number, scan_status, scan_error, scan_completed_at, thumbnail_path, scan_results, uploaded_at"
    )
    .eq("job_id", jobId)
    .order("revision_number", { ascending: false });

  // `order` on supabase-js returns a thenable at the bottom of the chain —
  // treat as an array result.
  const { data, error } = result as {
    data: RevisionRow[] | null;
    error: { message: string } | null;
  };
  if (error) {
    return {
      error: { status: 500, message: `Revisions lookup failed: ${error.message}` },
    };
  }

  const rows = data ?? [];

  // 3. Mint signed thumbnail URLs in parallel. 10-min TTL matches the
  //    status endpoint's thumbnail minting.
  //
  // Phase 8.1d-11: each createSignedUrl is wrapped so one bad
  // thumbnail_path (deleted blob, malformed path, transient bucket
  // glitch) doesn't reject the whole Promise.all and 500 the
  // endpoint. The history panel happily renders a missing thumbnail
  // as a placeholder; it must not block the rest of the column.
  const summaries: RevisionSummary[] = await Promise.all(
    rows.map(async (row) => {
      let thumbnailUrl: string | null = null;
      if (row.thumbnail_path) {
        try {
          const signed = await db.storage
            .from(FABRICATION_THUMBNAIL_BUCKET)
            .createSignedUrl(row.thumbnail_path, THUMBNAIL_URL_TTL_SECONDS);
          if (!signed.error && signed.data) {
            thumbnailUrl = signed.data.signedUrl;
          }
        } catch (e) {
          // Swallow — log on the server, hand back null so the row
          // still renders.
          console.warn(
            "[listRevisions] thumbnail signed URL failed",
            { path: row.thumbnail_path, revisionId: row.id, error: e }
          );
        }
      }
      return {
        id: row.id,
        revisionNumber: row.revision_number,
        scanStatus: row.scan_status,
        scanError: row.scan_error,
        scanCompletedAt: row.scan_completed_at,
        thumbnailUrl,
        ruleCounts: countRulesBySeverity(row.scan_results?.rules),
        createdAt: row.uploaded_at,
      };
    })
  );

  return { revisions: summaries };
}

// ============================================================
// Phase 6-6k — cancelJob (student withdraw)
// ============================================================

/** Which statuses a student is allowed to withdraw from. After the
 *  teacher has actioned the job (approved/returned/rejected) or the
 *  fabricator has picked it up, the decision is no longer
 *  student-reversible. `cancelled` is idempotent. */
const CANCELLABLE_STATUSES: readonly string[] = [
  "uploaded",
  "scanning",
  "pending_approval",
  "needs_revision",
];

export interface CancelJobRequest {
  studentId: string;
  jobId: string;
}

export interface CancelJobSuccess {
  jobId: string;
  newStatus: "cancelled";
}

export type CancelJobResult = CancelJobSuccess | OrchestrationError;

/**
 * Student withdraws their own submission. Transitions
 * `fabrication_jobs.status` → `cancelled` when the current status is
 * one of the student-reversible states (see `CANCELLABLE_STATUSES`).
 *
 *   - Ownership: 404 when job not found OR student_id mismatch.
 *   - Status guard: 409 with an explanatory message when the job is
 *     already terminal from the teacher's POV (approved / rejected /
 *     picked_up / completed / cancelled).
 *   - Idempotent: calling cancel on an already-cancelled job returns
 *     200 with newStatus: 'cancelled' (no 409 noise on
 *     double-clicks).
 *
 * Data is NOT deleted — the row stays in `fabrication_jobs` for
 * audit trail. Phase 9+ can add a soft-hide UI toggle if the
 * cancelled list gets noisy.
 */
export async function cancelJob(
  db: SupabaseLike,
  params: CancelJobRequest
): Promise<CancelJobResult> {
  const ownership = await loadOwnedJob(db, params.studentId, params.jobId);
  if (isOrchestrationError(ownership)) return ownership;

  // Idempotent: already cancelled → return the same success shape.
  if (ownership.job.status === "cancelled") {
    return { jobId: params.jobId, newStatus: "cancelled" };
  }

  if (!CANCELLABLE_STATUSES.includes(ownership.job.status)) {
    return {
      error: {
        status: 409,
        message: `Can't withdraw a job in status '${ownership.job.status}'. Your teacher has already acted on this submission.`,
      },
    };
  }

  const update = await db
    .from("fabrication_jobs")
    .update({ status: "cancelled" })
    .eq("id", params.jobId);
  if (update.error) {
    return {
      error: {
        status: 500,
        message: `Status transition failed: ${update.error.message}`,
      },
    };
  }

  return { jobId: params.jobId, newStatus: "cancelled" };
}

// ============================================================
// Phase 8.1d-32 — deleteStudentJob (student permanent delete)
// ============================================================

/** Statuses a student is allowed to permanently delete from. The
 *  exclusions are exactly the statuses where the fab/teacher is
 *  actively working with the file:
 *
 *    approved   — teacher approved, in fab queue / about to print
 *    picked_up  — actively being fabricated right now
 *
 *  Everything else is fair game — students should be able to clean
 *  up uploads that got stuck, cancelled jobs, or post-collection
 *  rows they don't want cluttering their overview. Mirrors the
 *  fab-side `deleteJob` (no status gate there) but more
 *  conservative on the student side because students don't see the
 *  full lab state and shouldn't yank work-in-progress.
 *
 *  Distinct from `cancelJob`:
 *    cancel — soft transition status → 'cancelled', row preserved
 *             for audit trail
 *    delete — permanent: DB cascade (revisions + scan_jobs via
 *             FK ON DELETE CASCADE) + Storage wipe of the uploaded
 *             file + thumbnail bytes. No undo.
 */
const STUDENT_DELETABLE_STATUSES: ReadonlySet<string> = new Set([
  "uploaded",
  "scanning",
  "pending_approval",
  "needs_revision",
  "cancelled",
  "rejected",
  "completed",
]);

export interface DeleteStudentJobRequest {
  studentId: string;
  jobId: string;
}

export interface DeleteStudentJobSuccess {
  jobId: string;
  /** Non-empty when storage cleanup partially failed. UI doesn't
   *  surface this — DB row is gone so the job has effectively
   *  disappeared. Logged for observability only. */
  storageWarnings: string[];
}

export type DeleteStudentJobResult =
  | DeleteStudentJobSuccess
  | OrchestrationError;

export async function deleteStudentJob(
  db: SupabaseLike,
  params: DeleteStudentJobRequest
): Promise<DeleteStudentJobResult> {
  const ownership = await loadOwnedJob(db, params.studentId, params.jobId);
  if (isOrchestrationError(ownership)) return ownership;

  if (!STUDENT_DELETABLE_STATUSES.has(ownership.job.status)) {
    return {
      error: {
        status: 409,
        message:
          ownership.job.status === "approved"
            ? "Can't delete — your teacher has approved this job and the fabricator may be about to start it. Ask them to remove it instead."
            : ownership.job.status === "picked_up"
              ? "Can't delete — the fabricator is currently working on this job."
              : `Can't delete a job in status '${ownership.job.status}'.`,
      },
    };
  }

  // Collect storage paths from all revisions BEFORE the cascade
  // delete — post-cascade the rows are gone.
  const revisionsResult = await db
    .from("fabrication_job_revisions")
    .select("storage_path, thumbnail_path")
    .eq("job_id", params.jobId);
  if (revisionsResult.error) {
    return {
      error: {
        status: 500,
        message: `Revision lookup failed: ${revisionsResult.error.message}`,
      },
    };
  }
  const revisions =
    (revisionsResult.data as Array<{
      storage_path: string | null;
      thumbnail_path: string | null;
    }> | null) ?? [];
  const uploadPaths = revisions
    .map((r) => r.storage_path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
  const thumbPaths = revisions
    .map((r) => r.thumbnail_path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);

  // Delete the parent row — cascade clears revisions + scan_jobs
  // via ON DELETE CASCADE (migration 095/096). Re-confirm
  // student_id ownership in the WHERE clause as a defence in
  // depth (loadOwnedJob already verified, but a stacked guard
  // costs nothing and protects against logic bugs in callers).
  const deleteResult = await db
    .from("fabrication_jobs")
    .delete()
    .eq("id", params.jobId)
    .eq("student_id", params.studentId)
    .select("id");
  const { data: deleteData, error: deleteError } = deleteResult as {
    data: Array<{ id: string }> | null;
    error: { message: string } | null;
  };
  if (deleteError) {
    return {
      error: {
        status: 500,
        message: `Delete failed: ${deleteError.message}`,
      },
    };
  }
  if (!deleteData || deleteData.length === 0) {
    // Vanished mid-flight (concurrent delete, or status changed
    // out of deletable range between the load and the delete).
    // Treat as already-deleted — idempotent success.
    return { jobId: params.jobId, storageWarnings: [] };
  }

  // Best-effort storage cleanup. Errors collected but not fatal.
  // Mirrors the fab-side deleteJob exactly — orphaned bytes get
  // reaped by the daily retention cron (Phase 2 D-04) if cleanup
  // here misses anything.
  const storageWarnings: string[] = [];
  if (uploadPaths.length > 0) {
    try {
      const r = await db.storage
        .from(FABRICATION_UPLOAD_BUCKET)
        .remove(uploadPaths);
      if (r.error) {
        storageWarnings.push(`uploads: ${r.error.message}`);
      }
    } catch (e) {
      storageWarnings.push(
        `uploads: ${e instanceof Error ? e.message : "unknown"}`
      );
    }
  }
  if (thumbPaths.length > 0) {
    try {
      const r = await db.storage
        .from(FABRICATION_THUMBNAIL_BUCKET)
        .remove(thumbPaths);
      if (r.error) {
        storageWarnings.push(`thumbnails: ${r.error.message}`);
      }
    } catch (e) {
      storageWarnings.push(
        `thumbnails: ${e instanceof Error ? e.message : "unknown"}`
      );
    }
  }

  return { jobId: params.jobId, storageWarnings };
}

// ============================================================
// Phase 6-6i — listStudentJobs (student-side overview)
// ============================================================

/**
 * Compact summary row for the student's own overview page at
 * `/fabrication`. Mirrors the teacher queue row shape but scoped to
 * `fabrication_jobs.student_id = studentId` so each student sees
 * only their own submissions.
 */
export interface StudentJobRow {
  jobId: string;
  machineLabel: string;
  machineCategory: "3d_printer" | "laser_cutter" | null;
  unitTitle: string | null;
  className: string | null;
  thumbnailUrl: string | null;
  currentRevision: number;
  ruleCounts: { block: number; warn: number; fyi: number };
  jobStatus: string;
  /** Phase 7-5d: `printed` / `cut` / `failed` when jobStatus='completed'.
   *  null otherwise. UI uses fabricationStatusPill() to branch the list
   *  pill so failed runs don't display as green "COMPLETED". */
  completionStatus: string | null;
  createdAt: string;
  updatedAt: string;
  originalFilename: string;
}

export interface ListStudentJobsSuccess {
  jobs: StudentJobRow[];
}
export type ListStudentJobsResult = ListStudentJobsSuccess | OrchestrationError;

interface RawStudentJobRow {
  id: string;
  status: string;
  completion_status: string | null;
  current_revision: number;
  created_at: string;
  updated_at: string;
  original_filename: string;
  classes: { name: string | null } | null;
  units: { title: string | null } | null;
  machine_profiles: { name: string | null; machine_category: string | null } | null;
  fabrication_job_revisions: Array<{
    revision_number: number;
    thumbnail_path: string | null;
    scan_results: { rules?: Array<{ severity?: string }> | null } | null;
  }> | null;
}

/**
 * Return all fabrication jobs for a student, newest first, with a
 * signed thumbnail URL + rule-count summary for the current
 * revision. Used by the `/fabrication` overview page.
 *
 * One round-trip via PostgREST nested-select — joins student →
 * classes / units / machine_profiles + all revisions. Matches the
 * pattern used by the teacher-side `getTeacherQueue` so behaviour
 * stays consistent.
 */
export async function listStudentJobs(
  db: SupabaseLike,
  params: { studentId: string; limit?: number }
): Promise<ListStudentJobsResult> {
  const { studentId, limit = 100 } = params;
  const boundedLimit = Math.max(1, Math.min(limit, 200));

  const result = await db
    .from("fabrication_jobs")
    .select(
      `
      id, status, completion_status, current_revision, created_at, updated_at, original_filename,
      classes(name),
      units(title),
      machine_profiles(name, machine_category),
      fabrication_job_revisions(revision_number, thumbnail_path, scan_results)
      `
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .range(0, boundedLimit - 1);

  const { data, error } = result as {
    data: RawStudentJobRow[] | null;
    error: { message: string } | null;
  };
  if (error) {
    return {
      error: { status: 500, message: `Student jobs lookup failed: ${error.message}` },
    };
  }

  const rows = data ?? [];

  // Build StudentJobRow shape with per-row signed thumbnail URLs
  // (parallel mint, same pattern as getTeacherQueue).
  const built: StudentJobRow[] = await Promise.all(
    rows.map(async (raw) => {
      const latestRev = (raw.fabrication_job_revisions ?? []).find(
        (r) => r.revision_number === raw.current_revision
      );

      let thumbnailUrl: string | null = null;
      if (latestRev?.thumbnail_path) {
        const signed = await db.storage
          .from(FABRICATION_THUMBNAIL_BUCKET)
          .createSignedUrl(latestRev.thumbnail_path, THUMBNAIL_URL_TTL_SECONDS);
        if (!signed.error && signed.data) {
          thumbnailUrl = signed.data.signedUrl;
        }
      }

      const counts = countRulesBySeverity(latestRev?.scan_results?.rules);

      // Defensive: PostgREST may return nested joins as array-of-one
      // (1:1 FK) or object (inferred singular). Accept both shapes —
      // same pattern as teacher-orchestration.ts pickFirst helper.
      const classRow = Array.isArray(raw.classes) ? raw.classes[0] : raw.classes;
      const unitRow = Array.isArray(raw.units) ? raw.units[0] : raw.units;
      const machineRow = Array.isArray(raw.machine_profiles)
        ? raw.machine_profiles[0]
        : raw.machine_profiles;

      return {
        jobId: raw.id,
        machineLabel: machineRow?.name ?? "Unknown machine",
        machineCategory:
          (machineRow?.machine_category as StudentJobRow["machineCategory"]) ??
          null,
        unitTitle: unitRow?.title ?? null,
        className: classRow?.name ?? null,
        thumbnailUrl,
        currentRevision: raw.current_revision,
        ruleCounts: counts,
        jobStatus: raw.status,
        completionStatus: raw.completion_status ?? null,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        originalFilename: raw.original_filename,
      };
    })
  );

  return { jobs: built };
}

