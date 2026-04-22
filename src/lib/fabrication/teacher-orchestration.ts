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
import type {
  OrchestrationError,
  AcknowledgedWarnings,
} from "./orchestration";

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

// ============================================================
// getTeacherJobDetail — Phase 6-2
// ============================================================

/**
 * Compact summary of a historical revision, shown in the teacher's
 * detail-page history panel. Parallel to RevisionSummary on the
 * student side (listRevisions in orchestration.ts) but fetched via
 * the teacher-auth path.
 */
export interface TeacherRevisionSummary {
  id: string;
  revisionNumber: number;
  scanStatus: string | null;
  scanError: string | null;
  scanCompletedAt: string | null;
  thumbnailUrl: string | null;
  ruleCounts: { block: number; warn: number; fyi: number };
  createdAt: string;
}

export interface TeacherJobDetailSuccess {
  job: {
    id: string;
    status: string;
    currentRevision: number;
    fileType: string; // 'stl' | 'svg' — validated at insert time
    originalFilename: string;
    createdAt: string;
    updatedAt: string;
    teacherReviewNote: string | null;
    teacherReviewedAt: string | null;
  };
  student: { id: string; name: string };
  classInfo: { id: string; name: string } | null;
  unit: { id: string; title: string } | null;
  machine: { id: string; name: string; category: string | null };
  currentRevisionData: {
    id: string;
    revisionNumber: number;
    scanStatus: string | null;
    scanError: string | null;
    scanCompletedAt: string | null;
    scanRulesetVersion: string | null;
    thumbnailUrl: string | null;
    scanResults: {
      rules?: Array<{ id: string; severity: string; [k: string]: unknown }> | null;
    } | null;
  } | null;
  acknowledgedWarnings: AcknowledgedWarnings | null;
  revisions: TeacherRevisionSummary[];
}

export type TeacherJobDetailResult = TeacherJobDetailSuccess | OrchestrationError;

interface RawDetailJob {
  id: string;
  teacher_id: string;
  status: string;
  current_revision: number;
  file_type: string;
  original_filename: string;
  created_at: string;
  updated_at: string;
  teacher_review_note: string | null;
  teacher_reviewed_at: string | null;
  acknowledged_warnings: AcknowledgedWarnings | null;
  student_id: string;
  class_id: string | null;
  unit_id: string | null;
  machine_profile_id: string;
  students: { id?: string; display_name: string | null; username: string | null } | null;
  classes: { id?: string; name: string | null } | null;
  units: { id?: string; title: string | null } | null;
  machine_profiles: {
    id?: string;
    name: string | null;
    machine_category: string | null;
  } | null;
}

interface RawDetailRevision {
  id: string;
  revision_number: number;
  scan_status: string | null;
  scan_error: string | null;
  scan_completed_at: string | null;
  scan_ruleset_version: string | null;
  thumbnail_path: string | null;
  scan_results: { rules?: Array<{ severity?: string }> | null } | null;
  uploaded_at: string;
}

function pickFirst<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function countSeverities(
  rules: Array<{ severity?: string }> | null | undefined
): { block: number; warn: number; fyi: number } {
  const c = { block: 0, warn: 0, fyi: 0 };
  for (const r of rules ?? []) {
    if (r.severity === "block") c.block++;
    else if (r.severity === "warn") c.warn++;
    else if (r.severity === "fyi") c.fyi++;
  }
  return c;
}

/**
 * Load a single job + its context for the teacher detail page. One
 * round-trip (join) for the job + student + class + unit + machine;
 * one round-trip for all revisions; N parallel signed-URL mints for
 * thumbnails.
 *
 * Ownership: 404 when job not found OR teacher_id does not match the
 * requesting teacher (same as the 4 action endpoints).
 */
export async function getTeacherJobDetail(
  db: SupabaseLike,
  params: { teacherId: string; jobId: string }
): Promise<TeacherJobDetailResult> {
  const { teacherId, jobId } = params;

  // 1. Job row with joins.
  const jobResult = await db
    .from("fabrication_jobs")
    .select(
      `
      id, teacher_id, status, current_revision, file_type, original_filename,
      created_at, updated_at, teacher_review_note, teacher_reviewed_at,
      acknowledged_warnings,
      student_id, class_id, unit_id, machine_profile_id,
      students(id, display_name, username),
      classes(id, name),
      units(id, title),
      machine_profiles(id, name, machine_category)
      `
    )
    .eq("id", jobId)
    .maybeSingle();
  if (jobResult.error) {
    return {
      error: { status: 500, message: `Job lookup failed: ${jobResult.error.message}` },
    };
  }
  const rawJob = jobResult.data as RawDetailJob | null;
  if (!rawJob || rawJob.teacher_id !== teacherId) {
    return { error: { status: 404, message: "Job not found" } };
  }

  // 2. All revisions, newest-first.
  const revResult = await db
    .from("fabrication_job_revisions")
    .select(
      "id, revision_number, scan_status, scan_error, scan_completed_at, scan_ruleset_version, thumbnail_path, scan_results, uploaded_at"
    )
    .eq("job_id", jobId)
    .order("revision_number", { ascending: false });
  const { data: revData, error: revError } = revResult as {
    data: RawDetailRevision[] | null;
    error: { message: string } | null;
  };
  if (revError) {
    return {
      error: { status: 500, message: `Revisions lookup failed: ${revError.message}` },
    };
  }
  const rawRevs = revData ?? [];

  // 3. Mint thumbnail signed URLs for every revision that has a
  //    thumbnail_path. Parallel. 10-min TTL matches status endpoint.
  const mintedThumbs = new Map<string, string>();
  await Promise.all(
    rawRevs
      .filter((r) => r.thumbnail_path)
      .map(async (r) => {
        const signed = await db.storage
          .from(FABRICATION_THUMBNAIL_BUCKET)
          .createSignedUrl(r.thumbnail_path as string, THUMBNAIL_URL_TTL_SECONDS);
        if (!signed.error && signed.data) {
          mintedThumbs.set(r.id, signed.data.signedUrl);
        }
      })
  );

  // 4. Build the revision summary list + pick out the current revision
  //    (spec-correct: current_revision on fabrication_jobs points at
  //    the authoritative latest; revisions.max(revision_number) should
  //    match in practice but we trust the job row).
  const revisionSummaries: TeacherRevisionSummary[] = rawRevs.map((r) => ({
    id: r.id,
    revisionNumber: r.revision_number,
    scanStatus: r.scan_status,
    scanError: r.scan_error,
    scanCompletedAt: r.scan_completed_at,
    thumbnailUrl: mintedThumbs.get(r.id) ?? null,
    ruleCounts: countSeverities(r.scan_results?.rules),
    createdAt: r.uploaded_at,
  }));

  const currentRawRev = rawRevs.find(
    (r) => r.revision_number === rawJob.current_revision
  );
  const currentRevisionData: TeacherJobDetailSuccess["currentRevisionData"] =
    currentRawRev
      ? {
          id: currentRawRev.id,
          revisionNumber: currentRawRev.revision_number,
          scanStatus: currentRawRev.scan_status,
          scanError: currentRawRev.scan_error,
          scanCompletedAt: currentRawRev.scan_completed_at,
          scanRulesetVersion: currentRawRev.scan_ruleset_version,
          thumbnailUrl: mintedThumbs.get(currentRawRev.id) ?? null,
          scanResults: currentRawRev.scan_results as NonNullable<
            TeacherJobDetailSuccess["currentRevisionData"]
          >["scanResults"],
        }
      : null;

  // 5. Normalize nested-table shapes (single-object vs array-of-one).
  const studentRow = pickFirst(rawJob.students);
  const classRow = pickFirst(rawJob.classes);
  const unitRow = pickFirst(rawJob.units);
  const machineRow = pickFirst(rawJob.machine_profiles);

  const studentName =
    studentRow?.display_name || studentRow?.username || "Unknown student";
  const machineName = machineRow?.name ?? "Unknown machine";

  return {
    job: {
      id: rawJob.id,
      status: rawJob.status,
      currentRevision: rawJob.current_revision,
      fileType: rawJob.file_type,
      originalFilename: rawJob.original_filename,
      createdAt: rawJob.created_at,
      updatedAt: rawJob.updated_at,
      teacherReviewNote: rawJob.teacher_review_note,
      teacherReviewedAt: rawJob.teacher_reviewed_at,
    },
    student: { id: rawJob.student_id, name: studentName },
    classInfo: classRow && classRow.name ? { id: rawJob.class_id ?? "", name: classRow.name } : null,
    unit: unitRow && unitRow.title ? { id: rawJob.unit_id ?? "", title: unitRow.title } : null,
    machine: {
      id: rawJob.machine_profile_id,
      name: machineName,
      category: machineRow?.machine_category ?? null,
    },
    currentRevisionData,
    acknowledgedWarnings: rawJob.acknowledged_warnings,
    revisions: revisionSummaries,
  };
}

// ============================================================
// getTeacherFabricationHistory — Phase 6-4
// ============================================================

/**
 * Shared summary metrics + job list used by both the per-student
 * fabrication tab (`/teacher/students/[studentId]` → Fabrication) and
 * the per-class section (`/teacher/classes/[classId]`).
 *
 * `perStudent` only populates for the class scope — it's the
 * per-student drill-down row list.
 */
export interface HistoryJobRow {
  jobId: string;
  status: string;
  currentRevision: number;
  createdAt: string;
  updatedAt: string;
  originalFilename: string;
  machineLabel: string;
  machineCategory: "3d_printer" | "laser_cutter" | null;
  unitTitle: string | null;
  /** Only present on class-scope responses (so the student column
   *  renders). Null on student-scope responses. */
  studentId: string | null;
  studentName: string | null;
  /** Rule ids that fired as block/warn on the current revision's
   *  scan — used client-side for the top-failure-rule aggregation.
   *  (We could recompute client-side but that's extra work; easier to
   *  ship it baked.) */
  currentRevisionFailingRuleIds: string[];
  /** Severity breakdown for the current-revision scan. */
  ruleCounts: { block: number; warn: number; fyi: number };
}

export interface HistorySummaryPayload {
  totalSubmissions: number;
  passed: number;
  /** 0–1. */
  passRate: number;
  avgRevisions: number;
  medianRevisions: number;
  topFailureRule: { ruleId: string; count: number } | null;
}

export interface PerStudentHistoryRow {
  studentId: string;
  studentName: string;
  totalJobs: number;
  passed: number;
  passRate: number;
  latestJobStatus: string | null;
  latestJobCreatedAt: string | null;
}

export interface HistorySuccess {
  jobs: HistoryJobRow[];
  summary: HistorySummaryPayload;
  /** Class scope only — null on student scope. */
  perStudent: PerStudentHistoryRow[] | null;
}

export type HistoryResult = HistorySuccess | OrchestrationError;

interface RawHistoryJob {
  id: string;
  status: string;
  current_revision: number;
  created_at: string;
  updated_at: string;
  original_filename: string;
  student_id: string;
  unit_id: string | null;
  students: { display_name: string | null; username: string | null } | null;
  units: { title: string | null } | null;
  machine_profiles: { name: string | null; machine_category: string | null } | null;
  fabrication_job_revisions: Array<{
    revision_number: number;
    scan_results: {
      rules?: Array<{ id?: string; severity?: string }> | null;
    } | null;
  }> | null;
}

/**
 * Shared query runner + row builder for both scopes. Student-scope
 * filters by `.eq("student_id", ...)`; class-scope by
 * `.eq("class_id", ...)`. Both always filter by teacher_id first so a
 * teacher can never see another teacher's rows.
 */
async function fetchHistoryJobs(
  db: SupabaseLike,
  filter: { teacherId: string; studentId?: string; classId?: string }
): Promise<HistoryJobRow[] | OrchestrationError> {
  let query = db
    .from("fabrication_jobs")
    .select(
      `
      id, status, current_revision, created_at, updated_at, original_filename,
      student_id, unit_id,
      students(display_name, username),
      units(title),
      machine_profiles(name, machine_category),
      fabrication_job_revisions(revision_number, scan_results)
      `
    )
    .eq("teacher_id", filter.teacherId)
    .order("created_at", { ascending: false });

  if (filter.studentId) {
    query = query.eq("student_id", filter.studentId);
  }
  if (filter.classId) {
    query = query.eq("class_id", filter.classId);
  }

  const result = await query;
  const { data, error } = result as {
    data: RawHistoryJob[] | null;
    error: { message: string } | null;
  };
  if (error) {
    return {
      error: { status: 500, message: `History lookup failed: ${error.message}` },
    };
  }

  const rows: HistoryJobRow[] = (data ?? []).map((raw) => {
    const latestRev = (raw.fabrication_job_revisions ?? []).find(
      (r) => r.revision_number === raw.current_revision
    );
    const rules = latestRev?.scan_results?.rules ?? [];
    const counts = { block: 0, warn: 0, fyi: 0 };
    const failingRuleIds: string[] = [];
    for (const r of rules) {
      if (r.severity === "block") counts.block++;
      else if (r.severity === "warn") counts.warn++;
      else if (r.severity === "fyi") counts.fyi++;
      if (
        typeof r.id === "string" &&
        (r.severity === "block" || r.severity === "warn")
      ) {
        failingRuleIds.push(r.id);
      }
    }

    const studentRow = pickFirst(raw.students);
    const unitRow = pickFirst(raw.units);
    const machineRow = pickFirst(raw.machine_profiles);
    const studentName =
      studentRow?.display_name || studentRow?.username || "Unknown student";
    const machineName = machineRow?.name ?? "Unknown machine";

    return {
      jobId: raw.id,
      status: raw.status,
      currentRevision: raw.current_revision,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      originalFilename: raw.original_filename,
      machineLabel: machineName,
      machineCategory:
        (machineRow?.machine_category as HistoryJobRow["machineCategory"]) ??
        null,
      unitTitle: unitRow?.title ?? null,
      studentId: raw.student_id,
      studentName,
      currentRevisionFailingRuleIds: failingRuleIds,
      ruleCounts: counts,
    };
  });

  return rows;
}

/**
 * Tiny summary builder — kept inline rather than importing
 * `buildHistorySummary` from the components folder because
 * orchestration shouldn't reach into components for server-side
 * code. The math is the same; tests on the component-side helper
 * cover the algorithm.
 */
function summariseHistoryJobs(jobs: HistoryJobRow[]): HistorySummaryPayload {
  const total = jobs.length;
  const passed = jobs.filter((j) =>
    ["approved", "picked_up", "completed"].includes(j.status)
  ).length;
  const passRate = total === 0 ? 0 : passed / total;

  const revisionCounts = jobs.map((j) => j.currentRevision);
  const avgRevisions =
    revisionCounts.length === 0
      ? 0
      : revisionCounts.reduce((a, b) => a + b, 0) / revisionCounts.length;

  const sorted = [...revisionCounts].sort((a, b) => a - b);
  const medianRevisions =
    sorted.length === 0
      ? 0
      : sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

  const ruleCounts = new Map<string, number>();
  for (const j of jobs) {
    for (const id of j.currentRevisionFailingRuleIds) {
      ruleCounts.set(id, (ruleCounts.get(id) ?? 0) + 1);
    }
  }
  let topFailureRule: { ruleId: string; count: number } | null = null;
  for (const [ruleId, count] of ruleCounts) {
    if (!topFailureRule || count > topFailureRule.count) {
      topFailureRule = { ruleId, count };
    }
  }

  return {
    totalSubmissions: total,
    passed,
    passRate,
    avgRevisions,
    medianRevisions,
    topFailureRule,
  };
}

/**
 * Per-student drill-down builder — groups the flat job list by
 * studentId, summarises each group. Returned in descending
 * "totalJobs" order so the most active students rise to the top.
 */
function buildPerStudentRows(jobs: HistoryJobRow[]): PerStudentHistoryRow[] {
  const byStudent = new Map<string, HistoryJobRow[]>();
  for (const j of jobs) {
    if (!j.studentId) continue;
    const bucket = byStudent.get(j.studentId) ?? [];
    bucket.push(j);
    byStudent.set(j.studentId, bucket);
  }

  const rows: PerStudentHistoryRow[] = [];
  for (const [studentId, studentJobs] of byStudent) {
    const passed = studentJobs.filter((j) =>
      ["approved", "picked_up", "completed"].includes(j.status)
    ).length;
    const totalJobs = studentJobs.length;
    const passRate = totalJobs === 0 ? 0 : passed / totalJobs;
    // Jobs are already sorted created_at DESC by the orchestration
    // query — [0] is the most recent.
    const latest = studentJobs[0];
    rows.push({
      studentId,
      studentName: latest.studentName ?? "Unknown student",
      totalJobs,
      passed,
      passRate,
      latestJobStatus: latest.status,
      latestJobCreatedAt: latest.createdAt,
    });
  }

  rows.sort((a, b) => b.totalJobs - a.totalJobs);
  return rows;
}

/**
 * Per-student fabrication history. Scoped to the teacher's owned jobs
 * AND the requested student. The teacher could reach this page for a
 * student in any of their classes — we don't require class ownership
 * on top of teacher ownership because the student must be in the
 * teacher's student pool to be selected from `/teacher/students/`.
 */
export async function getTeacherStudentHistory(
  db: SupabaseLike,
  params: { teacherId: string; studentId: string }
): Promise<HistoryResult> {
  const jobsResult = await fetchHistoryJobs(db, {
    teacherId: params.teacherId,
    studentId: params.studentId,
  });
  if ("error" in jobsResult) return jobsResult;

  return {
    jobs: jobsResult,
    summary: summariseHistoryJobs(jobsResult),
    perStudent: null,
  };
}

/**
 * Per-class fabrication history. Scoped to the teacher's owned jobs
 * AND the requested class. Teacher ownership of the class is
 * additionally verified by the `teacher_id = teacherId` filter — if
 * the teacher doesn't own any job in this class, an empty history
 * comes back (which is the correct response for "no submissions
 * yet", indistinguishable from "wrong class" by design).
 */
export async function getTeacherClassHistory(
  db: SupabaseLike,
  params: { teacherId: string; classId: string }
): Promise<HistoryResult> {
  const jobsResult = await fetchHistoryJobs(db, {
    teacherId: params.teacherId,
    classId: params.classId,
  });
  if ("error" in jobsResult) return jobsResult;

  return {
    jobs: jobsResult,
    summary: summariseHistoryJobs(jobsResult),
    perStudent: buildPerStudentRows(jobsResult),
  };
}
