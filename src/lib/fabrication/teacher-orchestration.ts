/**
 * Teacher-side fabrication orchestration — Preflight Phase 6-1.
 *
 * Parallel to `orchestration.ts` (student-facing). Every function takes
 * a teacherId from requireTeacherAuth and scopes writes by
 * `fabrication_jobs.teacher_id = teacherId`. No cross-teacher
 * visibility; 404 (not 403) for "not yours" to avoid telegraphing
 * existence (same pattern as Phase 4-2/5-1 student-side).
 *
 * Status transition rules (Phase 6 v1):
 *   approve             : pending_approval → approved
 *   return-for-revision : pending_approval → needs_revision
 *   reject              : pending_approval → rejected
 *   note                : any status (no transition, just updates
 *                         teacher_review_note)
 *
 * Transitions from other states (e.g. approving an already-approved
 * job) return 409. Teachers who want to change their mind on an
 * already-approved job should have Phase 9+ introduce an "undo
 * approval" flow — not in Phase 6 scope.
 */

import {
  FABRICATION_THUMBNAIL_BUCKET,
  THUMBNAIL_URL_TTL_SECONDS,
} from "./orchestration";
import type { OrchestrationError } from "./orchestration";

// Re-export for callers that import from this module only.
export type { OrchestrationError } from "./orchestration";

// ============================================================
// Shared types
// ============================================================

/**
 * Minimal Supabase-like client shape. Copied from orchestration.ts
 * rather than imported to keep teacher-side tight — if the student
 * surface evolves we don't auto-drag teacher-side along.
 */
interface SupabaseLike {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  storage: {
    from: (bucket: string) => {
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
 * Which statuses the queue endpoint accepts as a filter. The UI's tab
 * labels map to these values:
 *   Pending approval       → ["pending_approval"]
 *   Approved / queued      → ["approved", "picked_up"]
 *   Completed              → ["completed", "rejected"]
 *   Revisions in progress  → ["needs_revision"]
 *   All                    → undefined (no filter)
 */
export const QUEUE_STATUSES = [
  "uploaded",
  "scanning",
  "needs_revision",
  "pending_approval",
  "approved",
  "picked_up",
  "completed",
  "rejected",
  "cancelled",
] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export interface QueueRow {
  jobId: string;
  studentName: string;
  studentId: string;
  className: string | null;
  classId: string | null;
  unitTitle: string | null;
  machineLabel: string;
  machineCategory: "3d_printer" | "laser_cutter" | null;
  thumbnailUrl: string | null;
  currentRevision: number;
  ruleCounts: { block: number; warn: number; fyi: number };
  jobStatus: string;
  createdAt: string;
  updatedAt: string;
  originalFilename: string;
}

export interface TeacherActionSuccess {
  jobId: string;
  newStatus: string;
  teacherReviewedAt: string;
}

export type TeacherActionResult = TeacherActionSuccess | OrchestrationError;

// ============================================================
// Shared helper: load a teacher-owned job
// ============================================================

/**
 * Confirm the teacher owns this job before any mutation. Returns the
 * minimal row fields other helpers need (status, etc). 404 on not-
 * found OR not-owned (indistinguishable to the client by design).
 */
async function loadTeacherOwnedJob(
  db: SupabaseLike,
  teacherId: string,
  jobId: string
): Promise<
  | {
      job: {
        id: string;
        teacher_id: string;
        status: string;
        current_revision: number;
        teacher_review_note: string | null;
      };
    }
  | OrchestrationError
> {
  const result = await db
    .from("fabrication_jobs")
    .select("id, teacher_id, status, current_revision, teacher_review_note")
    .eq("id", jobId)
    .maybeSingle();
  if (result.error) {
    return {
      error: { status: 500, message: `Job lookup failed: ${result.error.message}` },
    };
  }
  if (!result.data || result.data.teacher_id !== teacherId) {
    return { error: { status: 404, message: "Job not found" } };
  }
  return { job: result.data };
}

/**
 * Confirms `status` is a legal starting point for a teacher-action
 * transition. All 4 action endpoints require `pending_approval`.
 * Returns null on OK, or a 409 error object on fail.
 */
function requirePendingApproval(currentStatus: string): OrchestrationError | null {
  if (currentStatus !== "pending_approval") {
    return {
      error: {
        status: 409,
        message: `Job is in status '${currentStatus}' — teacher action requires 'pending_approval'.`,
      },
    };
  }
  return null;
}

// ============================================================
// approveJob
// ============================================================

export interface ApproveJobRequest {
  teacherId: string;
  jobId: string;
  note?: string;
}

export async function approveJob(
  db: SupabaseLike,
  params: ApproveJobRequest
): Promise<TeacherActionResult> {
  const ownership = await loadTeacherOwnedJob(db, params.teacherId, params.jobId);
  if ("error" in ownership) return ownership;

  const statusCheck = requirePendingApproval(ownership.job.status);
  if (statusCheck) return statusCheck;

  const now = new Date().toISOString();
  const patch: Record<string, string | null> = {
    status: "approved",
    teacher_reviewed_by: params.teacherId,
    teacher_reviewed_at: now,
  };
  if (params.note !== undefined) {
    patch.teacher_review_note = params.note;
  }

  const update = await db
    .from("fabrication_jobs")
    .update(patch)
    .eq("id", params.jobId);
  if (update.error) {
    return {
      error: { status: 500, message: `Status transition failed: ${update.error.message}` },
    };
  }

  return { jobId: params.jobId, newStatus: "approved", teacherReviewedAt: now };
}

// ============================================================
// returnForRevision
// ============================================================

export interface ReturnForRevisionRequest {
  teacherId: string;
  jobId: string;
  note: string; // required — student needs to know what to fix
}

export async function returnForRevision(
  db: SupabaseLike,
  params: ReturnForRevisionRequest
): Promise<TeacherActionResult> {
  if (!params.note || params.note.trim().length === 0) {
    return {
      error: { status: 400, message: "A note is required when returning for revision." },
    };
  }

  const ownership = await loadTeacherOwnedJob(db, params.teacherId, params.jobId);
  if ("error" in ownership) return ownership;

  const statusCheck = requirePendingApproval(ownership.job.status);
  if (statusCheck) return statusCheck;

  const now = new Date().toISOString();
  const update = await db
    .from("fabrication_jobs")
    .update({
      status: "needs_revision",
      teacher_reviewed_by: params.teacherId,
      teacher_reviewed_at: now,
      teacher_review_note: params.note,
    })
    .eq("id", params.jobId);
  if (update.error) {
    return {
      error: { status: 500, message: `Status transition failed: ${update.error.message}` },
    };
  }

  return {
    jobId: params.jobId,
    newStatus: "needs_revision",
    teacherReviewedAt: now,
  };
}

// ============================================================
// rejectJob
// ============================================================

export interface RejectJobRequest {
  teacherId: string;
  jobId: string;
  note?: string;
}

export async function rejectJob(
  db: SupabaseLike,
  params: RejectJobRequest
): Promise<TeacherActionResult> {
  const ownership = await loadTeacherOwnedJob(db, params.teacherId, params.jobId);
  if ("error" in ownership) return ownership;

  const statusCheck = requirePendingApproval(ownership.job.status);
  if (statusCheck) return statusCheck;

  const now = new Date().toISOString();
  const patch: Record<string, string | null> = {
    status: "rejected",
    teacher_reviewed_by: params.teacherId,
    teacher_reviewed_at: now,
  };
  if (params.note !== undefined) {
    patch.teacher_review_note = params.note;
  }

  const update = await db
    .from("fabrication_jobs")
    .update(patch)
    .eq("id", params.jobId);
  if (update.error) {
    return {
      error: { status: 500, message: `Status transition failed: ${update.error.message}` },
    };
  }

  return { jobId: params.jobId, newStatus: "rejected", teacherReviewedAt: now };
}

// ============================================================
// addTeacherNote
// ============================================================

export interface AddTeacherNoteRequest {
  teacherId: string;
  jobId: string;
  note: string;
}

/**
 * Add/update a teacher note on a job WITHOUT changing status. Used
 * during review when the teacher wants to leave a comment but not
 * yet commit to an action. Overwrites any existing note (single-
 * field v1 per Phase 6 decision 3; thread history = PH6-FU-NOTE-
 * HISTORY P3).
 */
export async function addTeacherNote(
  db: SupabaseLike,
  params: AddTeacherNoteRequest
): Promise<TeacherActionResult> {
  if (!params.note || params.note.trim().length === 0) {
    return { error: { status: 400, message: "Note cannot be empty." } };
  }

  const ownership = await loadTeacherOwnedJob(db, params.teacherId, params.jobId);
  if ("error" in ownership) return ownership;

  const now = new Date().toISOString();
  const update = await db
    .from("fabrication_jobs")
    .update({
      teacher_review_note: params.note,
      // Bump reviewed_* even on a note-only action — signals "teacher
      // has seen this". Doesn't change status.
      teacher_reviewed_by: params.teacherId,
      teacher_reviewed_at: now,
    })
    .eq("id", params.jobId);
  if (update.error) {
    return {
      error: { status: 500, message: `Note write failed: ${update.error.message}` },
    };
  }

  return {
    jobId: params.jobId,
    newStatus: ownership.job.status, // unchanged
    teacherReviewedAt: now,
  };
}

// ============================================================
// getTeacherQueue
// ============================================================

export interface GetTeacherQueueRequest {
  teacherId: string;
  statuses?: string[]; // optional filter; undefined = all
  limit?: number; // default 50
  offset?: number; // default 0
}

export interface GetTeacherQueueSuccess {
  total: number;
  rows: QueueRow[];
}

export type GetTeacherQueueResult = GetTeacherQueueSuccess | OrchestrationError;

interface RawJobRow {
  id: string;
  status: string;
  current_revision: number;
  created_at: string;
  updated_at: string;
  original_filename: string;
  student_id: string;
  class_id: string | null;
  unit_id: string | null;
  students: { display_name: string | null; username: string | null } | null;
  classes: { name: string | null } | null;
  units: { title: string | null } | null;
  machine_profiles: { name: string | null; machine_category: string | null } | null;
  fabrication_job_revisions: Array<{
    revision_number: number;
    thumbnail_path: string | null;
    scan_results: { rules?: Array<{ severity?: string }> | null } | null;
  }> | null;
}

export async function getTeacherQueue(
  db: SupabaseLike,
  params: GetTeacherQueueRequest
): Promise<GetTeacherQueueResult> {
  const { teacherId, statuses, limit = 50, offset = 0 } = params;

  // Bound pagination — defensive against huge page requests.
  const boundedLimit = Math.max(1, Math.min(limit, 200));
  const boundedOffset = Math.max(0, offset);

  // PostgREST nested-select. Pulls in the joined tables + all revisions
  // for each job (we filter to current_revision in TS — could be tighter
  // at the query layer but 50-row pages × ~3 revs = ~150 revision rows,
  // acceptable for v1).
  let query = db
    .from("fabrication_jobs")
    .select(
      `
      id, status, current_revision, created_at, updated_at, original_filename,
      student_id, class_id, unit_id,
      students(display_name, username),
      classes(name),
      units(title),
      machine_profiles(name, machine_category),
      fabrication_job_revisions(revision_number, thumbnail_path, scan_results)
      `,
      { count: "exact" }
    )
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: true }) // FIFO triage
    .range(boundedOffset, boundedOffset + boundedLimit - 1);

  if (statuses && statuses.length > 0) {
    query = query.in("status", statuses);
  }

  const result = await query;
  const { data, error, count } = result as {
    data: RawJobRow[] | null;
    error: { message: string } | null;
    count: number | null;
  };
  if (error) {
    return {
      error: { status: 500, message: `Queue lookup failed: ${error.message}` },
    };
  }

  const rows = data ?? [];

  // Build QueueRow shape. Mint thumbnail signed URLs in parallel.
  const built: QueueRow[] = await Promise.all(
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

      const counts = { block: 0, warn: 0, fyi: 0 };
      for (const rule of latestRev?.scan_results?.rules ?? []) {
        if (rule.severity === "block") counts.block++;
        else if (rule.severity === "warn") counts.warn++;
        else if (rule.severity === "fyi") counts.fyi++;
      }

      // Supabase nested-table returns could come back as an array-per-
      // row or single-object-per-row depending on the schema hint. We
      // accept both shapes defensively.
      const studentRow = Array.isArray(raw.students) ? raw.students[0] : raw.students;
      const classRow = Array.isArray(raw.classes) ? raw.classes[0] : raw.classes;
      const unitRow = Array.isArray(raw.units) ? raw.units[0] : raw.units;
      const machineRow = Array.isArray(raw.machine_profiles)
        ? raw.machine_profiles[0]
        : raw.machine_profiles;

      const studentName =
        studentRow?.display_name || studentRow?.username || "Unknown student";
      const machineName = machineRow?.name ?? "Unknown machine";
      const machineCategory = machineRow?.machine_category ?? null;

      return {
        jobId: raw.id,
        studentName,
        studentId: raw.student_id,
        className: classRow?.name ?? null,
        classId: raw.class_id,
        unitTitle: unitRow?.title ?? null,
        machineLabel: machineName,
        machineCategory: machineCategory as QueueRow["machineCategory"],
        thumbnailUrl,
        currentRevision: raw.current_revision,
        ruleCounts: counts,
        jobStatus: raw.status,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        originalFilename: raw.original_filename,
      };
    })
  );

  return {
    total: count ?? built.length,
    rows: built,
  };
}
