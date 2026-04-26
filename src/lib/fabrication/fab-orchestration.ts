/**
 * Fabricator-side orchestration — Preflight Phase 7-1.
 *
 * Pure business logic for the lab tech's pickup + completion flow.
 * Parallel to teacher-orchestration.ts and the student-side
 * orchestration.ts — every function takes a `fabricatorId` (from
 * requireFabricatorAuth) and scopes visibility to jobs whose
 * `machine_profile_id` is in the fabricator's assigned-machines
 * junction (`fabricator_machines`). NOT by teacher_id; NOT by
 * class_id — lab techs are physical-resource-scoped, spanning
 * whoever owns the job pedagogically.
 *
 * Status transition rules (Phase 7 decisions):
 *   pickup       : approved    → picked_up   (records lab_tech_picked_up_by/_at)
 *   complete     : picked_up   → completed   (completion_status printed/cut per machine category)
 *   fail         : picked_up   → completed   (completion_status='failed', required note)
 *
 * 404 (not found OR not-assigned to the fabricator) — no distinction
 * client-side, same pattern as student-side loadOwnedJob + teacher-
 * side loadTeacherOwnedJob.
 *
 * Race-safety: pickup + complete + fail all use conditional UPDATE
 * (.eq('status', expected)) so if two fabricators click Pickup on
 * the same approved job within milliseconds, only one update
 * affects a row — the other gets 0 rows affected and 409s out.
 *
 * Phase 7 edge case §11 Q8: allow Complete / Fail on an own-
 * picked-up job EVEN IF the fabricator has since been unassigned
 * from the machine. They already have the file; the outcome log
 * is still valuable. Only NEW pickups check current assignment.
 */

import {
  FABRICATION_THUMBNAIL_BUCKET,
  THUMBNAIL_URL_TTL_SECONDS,
} from "./orchestration";
import type { OrchestrationError } from "./orchestration";

// Re-export for route callers that only touch this module.
export type { OrchestrationError } from "./orchestration";

// ============================================================
// Shared types
// ============================================================

/**
 * Minimal Supabase-like client shape. Copied from the other two
 * orchestration files rather than imported — keeps each surface
 * independently-evolvable if their query shapes diverge.
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

/** Queue tab keys. `ready` shows approved jobs waiting to be picked
 *  up. `in_progress` shows this fabricator's own picked_up jobs
 *  (cross-fabricator visibility is intentionally not surfaced). */
export const FAB_QUEUE_TABS = ["ready", "in_progress"] as const;
export type FabQueueTab = (typeof FAB_QUEUE_TABS)[number];

/** Single queue row — kept compact for the queue page's list. */
export interface FabJobRow {
  jobId: string;
  studentName: string;
  className: string | null;
  unitTitle: string | null;
  originalFilename: string;
  /** Phase 8.1d-17: file type so the queue UI can render a chip
   *  (.STL / .SVG) without parsing the filename. Source is
   *  `fabrication_jobs.file_type`. */
  fileType: "stl" | "svg";
  machineLabel: string;
  machineCategory: "3d_printer" | "laser_cutter" | null;
  thumbnailUrl: string | null;
  currentRevision: number;
  fileSizeBytes: number | null;
  jobStatus: string;
  /** Phase 8.1d-17: time the student first submitted the job
   *  (= jobs.created_at). Distinct from approvedAt — lets the fab
   *  queue show how long total a job has been in flight. */
  createdAt: string;
  approvedAt: string | null;
  pickedUpAt: string | null;
  teacherReviewNote: string | null;
}

/** Detailed view — everything the fabricator detail page needs. */
export interface FabJobDetail {
  job: {
    id: string;
    status: string;
    currentRevision: number;
    fileType: "stl" | "svg";
    originalFilename: string;
    approvedAt: string | null;
    pickedUpAt: string | null;
    teacherReviewNote: string | null;
    completionStatus: string | null;
    completionNote: string | null;
    completedAt: string | null;
  };
  student: { id: string; name: string };
  classInfo: { id: string; name: string } | null;
  unit: { id: string; title: string } | null;
  machine: {
    id: string;
    name: string;
    category: "3d_printer" | "laser_cutter" | null;
  };
  currentRevisionData: {
    id: string;
    revisionNumber: number;
    scanStatus: string | null;
    thumbnailUrl: string | null;
    fileSizeBytes: number | null;
    storagePath: string;
    /** Derived severity counts so the detail page can show
     *  "3B · 2W · 1I" without teaching the fabricator about the
     *  full rules schema. */
    ruleCounts: { block: number; warn: number; fyi: number };
  } | null;
}

export interface PickupSuccess {
  jobId: string;
  storagePath: string;
  pickedUpAt: string;
}
export type PickupResult = PickupSuccess | OrchestrationError;

export interface CompleteSuccess {
  jobId: string;
  completionStatus: "printed" | "cut" | "failed";
  completedAt: string;
}
export type CompleteResult = CompleteSuccess | OrchestrationError;

// ============================================================
// Shared helpers
// ============================================================

/** PostgREST returns nested joins as singular-object OR array-of-one
 *  depending on the query shape. Normalise. */
function pickFirst<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

/**
 * Returns the list of machine profile IDs this fabricator is assigned
 * to run. Empty array means no assignments (queue will be empty, UI
 * should surface a "no machines assigned yet" state). Returns a 500
 * error if the junction lookup itself fails (rare).
 */
async function fabricatorMachineIds(
  db: SupabaseLike,
  fabricatorId: string
): Promise<string[] | OrchestrationError> {
  const result = await db
    .from("fabricator_machines")
    .select("machine_profile_id")
    .eq("fabricator_id", fabricatorId);
  if (result.error) {
    return {
      error: {
        status: 500,
        message: `Fabricator-machines lookup failed: ${result.error.message}`,
      },
    };
  }
  const rows = (result.data ?? []) as Array<{ machine_profile_id: string }>;
  return rows.map((r) => r.machine_profile_id);
}

/**
 * Phase 8.1d-9: returns the teacher_id who invited this fabricator.
 *
 * Replaces the per-machine `fabricator_machines` junction filtering
 * for queue + pickup operations. Matt's UX call 26 Apr AM:
 * "the fabricator needs to be able to manage the machines themselves,
 * dont want a teacher to need to do this. they should be able to
 * see all machines."
 *
 * Fabricators now see ALL jobs from their inviting teacher's classes
 * — no per-machine restrictions. Cynthia (NIS lab tech) sees every
 * job regardless of which machine, no setup overhead for the teacher.
 *
 * The fabricator_machines table + its API routes stay in the schema
 * (deferred deprecation). Post-FU-P, school-scoped roles can re-add
 * fine-grain restrictions if needed (filed as
 * PH9-FU-FAB-MACHINE-RESTRICT). For v1, all-access is the right call.
 *
 * Returns null on missing/inactive fabricator (route should 404).
 */
async function fabricatorInvitingTeacherId(
  db: SupabaseLike,
  fabricatorId: string
): Promise<string | null | OrchestrationError> {
  const result = await db
    .from("fabricators")
    .select("invited_by_teacher_id, is_active")
    .eq("id", fabricatorId)
    .maybeSingle();
  if (result.error) {
    return {
      error: {
        status: 500,
        message: `Fabricator lookup failed: ${result.error.message}`,
      },
    };
  }
  const row = result.data as
    | { invited_by_teacher_id: string | null; is_active: boolean }
    | null;
  if (!row || !row.is_active) return null;
  return row.invited_by_teacher_id;
}

/**
 * Confirms the fabricator can CURRENTLY pick up this job — job
 * exists AND its machine is in the fabricator's assignment list.
 * Used for fresh pickups; NOT used for complete/fail on an own
 * picked_up job (per §11 Q8 that's allowed even after unassignment).
 */
async function loadFabricatorAssignedJob(
  db: SupabaseLike,
  fabricatorId: string,
  jobId: string
): Promise<
  | {
      job: {
        id: string;
        status: string;
        machine_profile_id: string;
        lab_tech_picked_up_by: string | null;
      };
    }
  | OrchestrationError
> {
  // Phase 8.1d-9: scope by inviting teacher's jobs, not by junction.
  // Fabricator can pick up any job from their inviting teacher.
  const teacherId = await fabricatorInvitingTeacherId(db, fabricatorId);
  if (teacherId !== null && typeof teacherId === "object") return teacherId;
  if (!teacherId) {
    return { error: { status: 404, message: "Job not found" } };
  }

  const result = await db
    .from("fabrication_jobs")
    .select("id, status, machine_profile_id, lab_tech_picked_up_by, teacher_id")
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
  // 404 (not 403) on cross-teacher job — don't leak existence.
  const data = result.data as {
    id: string;
    status: string;
    machine_profile_id: string;
    lab_tech_picked_up_by: string | null;
    teacher_id: string;
  };
  if (data.teacher_id !== teacherId) {
    return { error: { status: 404, message: "Job not found" } };
  }
  return {
    job: {
      id: data.id,
      status: data.status,
      machine_profile_id: data.machine_profile_id,
      lab_tech_picked_up_by: data.lab_tech_picked_up_by,
    },
  };
}

/**
 * Confirms the fabricator can CURRENTLY complete/fail this job — it's
 * in status=picked_up AND THEY are the one who picked it up. Does
 * NOT check current machine assignment (§11 Q8: allow logging the
 * outcome even after unassignment).
 */
async function loadFabricatorOwnedPickedUpJob(
  db: SupabaseLike,
  fabricatorId: string,
  jobId: string
): Promise<
  | {
      job: {
        id: string;
        status: string;
        lab_tech_picked_up_by: string | null;
        machine_profile_id: string;
      };
    }
  | OrchestrationError
> {
  const result = await db
    .from("fabrication_jobs")
    .select("id, status, lab_tech_picked_up_by, machine_profile_id")
    .eq("id", jobId)
    .maybeSingle();
  if (result.error) {
    return {
      error: { status: 500, message: `Job lookup failed: ${result.error.message}` },
    };
  }
  if (!result.data || result.data.lab_tech_picked_up_by !== fabricatorId) {
    return { error: { status: 404, message: "Job not found" } };
  }
  return { job: result.data };
}

/**
 * Machine category → completion_status when NOT a failure. Lasers
 * "cut"; printers "print". Anything else defaults to "printed" as a
 * safe fallback — future non-standard categories should add a
 * branch.
 */
function completionStatusForCategory(
  category: "3d_printer" | "laser_cutter" | null
): "printed" | "cut" {
  if (category === "laser_cutter") return "cut";
  return "printed";
}

// ============================================================
// listFabricatorQueue
// ============================================================

export interface ListFabQueueRequest {
  fabricatorId: string;
  tab: FabQueueTab;
  limit?: number;
}

export interface ListFabQueueSuccess {
  jobs: FabJobRow[];
}
export type ListFabQueueResult = ListFabQueueSuccess | OrchestrationError;

interface RawFabQueueJob {
  id: string;
  status: string;
  current_revision: number;
  file_type: string;
  original_filename: string;
  teacher_review_note: string | null;
  lab_tech_picked_up_at: string | null;
  machine_profile_id: string;
  created_at: string;
  updated_at: string;
  notifications_sent: Record<string, unknown> | null;
  students: { display_name: string | null; username: string | null } | null;
  classes: { name: string | null } | null;
  units: { title: string | null } | null;
  machine_profiles: { name: string | null; machine_category: string | null } | null;
  fabrication_job_revisions: Array<{
    revision_number: number;
    thumbnail_path: string | null;
    file_size_bytes: number | null;
  }> | null;
}

/**
 * Returns the fabricator's per-machine queue rows, filtered by tab.
 *   ready: status='approved' + machine ∈ assignments
 *   in_progress: status='picked_up' + lab_tech_picked_up_by = self
 *
 * Sorted oldest-first (FIFO triage — lab techs run the earliest
 * waiters first). Thumbnail signed URLs minted in parallel with a
 * 10-min TTL.
 */
export async function listFabricatorQueue(
  db: SupabaseLike,
  params: ListFabQueueRequest
): Promise<ListFabQueueResult> {
  const { fabricatorId, tab, limit = 100 } = params;
  const boundedLimit = Math.max(1, Math.min(limit, 200));

  // Phase 8.1d-9: scope by inviting teacher (sees ALL their machines)
  // not by per-machine junction. Drops the "teacher must assign
  // machines per fabricator" overhead. See fabricatorInvitingTeacherId
  // for the rationale.
  const teacherId = await fabricatorInvitingTeacherId(db, fabricatorId);
  if (teacherId !== null && typeof teacherId === "object") return teacherId;

  // Fabricator missing/inactive — empty queue (route still returns
  // 200; the fab session middleware would have 401'd if truly invalid).
  if (!teacherId) {
    return { jobs: [] };
  }

  // Build the query step-by-step. Tab-specific filters go BEFORE
  // .order + .range because PostgREST's fluent chain returns a
  // promise after .range — can't add .eq after that.
  let query = db
    .from("fabrication_jobs")
    .select(
      `
      id, status, current_revision, file_type, original_filename,
      teacher_review_note, lab_tech_picked_up_at, machine_profile_id,
      created_at, updated_at, notifications_sent,
      students(display_name, username),
      classes(name),
      units(title),
      machine_profiles(name, machine_category),
      fabrication_job_revisions(revision_number, thumbnail_path, file_size_bytes)
      `
    )
    .eq("teacher_id", teacherId);

  if (tab === "ready") {
    query = query.eq("status", "approved");
  } else {
    // in_progress — this fabricator's own picked-up jobs
    query = query
      .eq("status", "picked_up")
      .eq("lab_tech_picked_up_by", fabricatorId);
  }

  const result = await query
    .order("updated_at", { ascending: true })
    .range(0, boundedLimit - 1);
  const { data, error } = result as {
    data: RawFabQueueJob[] | null;
    error: { message: string } | null;
  };
  if (error) {
    return {
      error: {
        status: 500,
        message: `Fabricator queue lookup failed: ${error.message}`,
      },
    };
  }

  const rows = data ?? [];
  const built: FabJobRow[] = await Promise.all(
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

      const studentRow = pickFirst(raw.students);
      const classRow = pickFirst(raw.classes);
      const unitRow = pickFirst(raw.units);
      const machineRow = pickFirst(raw.machine_profiles);

      // `approvedAt` lives on notifications_sent.approved_at per
      // migration 098 design — the column stores a JSONB map of
      // lifecycle timestamps. If missing (older jobs pre-phase-6),
      // fall back to null.
      let approvedAt: string | null = null;
      const notifs = raw.notifications_sent ?? null;
      if (
        notifs &&
        typeof notifs === "object" &&
        typeof (notifs as Record<string, unknown>).approved_at === "string"
      ) {
        approvedAt = (notifs as Record<string, string>).approved_at;
      }

      return {
        jobId: raw.id,
        studentName:
          studentRow?.display_name ||
          studentRow?.username ||
          "Unknown student",
        className: classRow?.name ?? null,
        unitTitle: unitRow?.title ?? null,
        originalFilename: raw.original_filename,
        fileType: (raw.file_type === "svg" ? "svg" : "stl") as "stl" | "svg",
        machineLabel: machineRow?.name ?? "Unknown machine",
        machineCategory:
          (machineRow?.machine_category as FabJobRow["machineCategory"]) ??
          null,
        thumbnailUrl,
        currentRevision: raw.current_revision,
        fileSizeBytes: latestRev?.file_size_bytes ?? null,
        jobStatus: raw.status,
        createdAt: raw.created_at,
        approvedAt,
        pickedUpAt: raw.lab_tech_picked_up_at,
        teacherReviewNote: raw.teacher_review_note,
      };
    })
  );

  return { jobs: built };
}

// ============================================================
// getFabJobDetail
// ============================================================

interface RawFabDetailJob {
  id: string;
  status: string;
  current_revision: number;
  file_type: string;
  original_filename: string;
  teacher_review_note: string | null;
  lab_tech_picked_up_at: string | null;
  completion_status: string | null;
  completion_note: string | null;
  completed_at: string | null;
  notifications_sent: Record<string, unknown> | null;
  student_id: string;
  class_id: string | null;
  unit_id: string | null;
  machine_profile_id: string;
  students: { display_name: string | null; username: string | null } | null;
  classes: { id?: string; name: string | null } | null;
  units: { id?: string; title: string | null } | null;
  machine_profiles: {
    id?: string;
    name: string | null;
    machine_category: string | null;
  } | null;
}

interface RawFabDetailRevision {
  id: string;
  revision_number: number;
  scan_status: string | null;
  thumbnail_path: string | null;
  storage_path: string;
  file_size_bytes: number | null;
  scan_results: { rules?: Array<{ severity?: string }> | null } | null;
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

export async function getFabJobDetail(
  db: SupabaseLike,
  params: { fabricatorId: string; jobId: string }
): Promise<FabJobDetail | OrchestrationError> {
  const { fabricatorId, jobId } = params;

  // Phase 8.1d-9: scope by inviting teacher rather than per-machine
  // junction. Fabricator can see any job from their inviting teacher.
  const teacherId = await fabricatorInvitingTeacherId(db, fabricatorId);
  if (teacherId !== null && typeof teacherId === "object") return teacherId;

  // 1. Job row with joins.
  const jobResult = await db
    .from("fabrication_jobs")
    .select(
      `
      id, status, current_revision, file_type, original_filename,
      teacher_review_note, lab_tech_picked_up_at, lab_tech_picked_up_by,
      completion_status, completion_note, completed_at, notifications_sent,
      student_id, class_id, unit_id, machine_profile_id, teacher_id,
      students(display_name, username),
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
  const rawJob = jobResult.data as
    | (RawFabDetailJob & {
        lab_tech_picked_up_by: string | null;
        teacher_id: string;
      })
    | null;
  if (!rawJob) {
    return { error: { status: 404, message: "Job not found" } };
  }

  // Visibility: the fabricator sees this job if either
  //   (a) it's owned by their inviting teacher (default model — they
  //       see ALL of that teacher's jobs), OR
  //   (b) THEY are the one who picked it up (§11 Q8 — allows
  //       complete/fail access even if the inviter relationship
  //       changed mid-job, e.g. fabricator account got reassigned
  //       between teachers).
  const sameTeacher = teacherId && rawJob.teacher_id === teacherId;
  const ownedByMe = rawJob.lab_tech_picked_up_by === fabricatorId;
  if (!sameTeacher && !ownedByMe) {
    return { error: { status: 404, message: "Job not found" } };
  }

  // 2. Current revision only (fabricator doesn't need earlier revs).
  const revResult = await db
    .from("fabrication_job_revisions")
    .select(
      "id, revision_number, scan_status, thumbnail_path, storage_path, file_size_bytes, scan_results"
    )
    .eq("job_id", jobId)
    .eq("revision_number", rawJob.current_revision)
    .maybeSingle();
  if (revResult.error) {
    return {
      error: {
        status: 500,
        message: `Current revision lookup failed: ${revResult.error.message}`,
      },
    };
  }
  const rawRev = revResult.data as RawFabDetailRevision | null;

  let thumbnailUrl: string | null = null;
  if (rawRev?.thumbnail_path) {
    const signed = await db.storage
      .from(FABRICATION_THUMBNAIL_BUCKET)
      .createSignedUrl(rawRev.thumbnail_path, THUMBNAIL_URL_TTL_SECONDS);
    if (!signed.error && signed.data) {
      thumbnailUrl = signed.data.signedUrl;
    }
  }

  const studentRow = pickFirst(rawJob.students);
  const classRow = pickFirst(rawJob.classes);
  const unitRow = pickFirst(rawJob.units);
  const machineRow = pickFirst(rawJob.machine_profiles);

  let approvedAt: string | null = null;
  const notifs = rawJob.notifications_sent ?? null;
  if (
    notifs &&
    typeof notifs === "object" &&
    typeof (notifs as Record<string, unknown>).approved_at === "string"
  ) {
    approvedAt = (notifs as Record<string, string>).approved_at;
  }

  return {
    job: {
      id: rawJob.id,
      status: rawJob.status,
      currentRevision: rawJob.current_revision,
      fileType: (rawJob.file_type === "svg" ? "svg" : "stl") as "stl" | "svg",
      originalFilename: rawJob.original_filename,
      approvedAt,
      pickedUpAt: rawJob.lab_tech_picked_up_at,
      teacherReviewNote: rawJob.teacher_review_note,
      completionStatus: rawJob.completion_status,
      completionNote: rawJob.completion_note,
      completedAt: rawJob.completed_at,
    },
    student: {
      id: rawJob.student_id,
      name:
        studentRow?.display_name ||
        studentRow?.username ||
        "Unknown student",
    },
    classInfo:
      classRow && classRow.name
        ? { id: rawJob.class_id ?? "", name: classRow.name }
        : null,
    unit:
      unitRow && unitRow.title
        ? { id: rawJob.unit_id ?? "", title: unitRow.title }
        : null,
    machine: {
      id: rawJob.machine_profile_id,
      name: machineRow?.name ?? "Unknown machine",
      category:
        (machineRow?.machine_category as FabJobDetail["machine"]["category"]) ??
        null,
    },
    currentRevisionData: rawRev
      ? {
          id: rawRev.id,
          revisionNumber: rawRev.revision_number,
          scanStatus: rawRev.scan_status,
          thumbnailUrl,
          fileSizeBytes: rawRev.file_size_bytes,
          storagePath: rawRev.storage_path,
          ruleCounts: countSeverities(rawRev.scan_results?.rules),
        }
      : null,
  };
}

// ============================================================
// pickupJob — approved → picked_up (atomic, race-safe)
// ============================================================

/**
 * First-time pickup: transitions status approved → picked_up + writes
 * lab_tech_picked_up_by / _at. On re-download (status already
 * picked_up AND picked_up_by = self), returns the same success shape
 * without re-writing (idempotent, §11 Q4).
 *
 * Race-safe via conditional UPDATE: `.eq('status', 'approved')` so
 * if two fabricators click Pickup simultaneously, only the first
 * writes — the second reads status='picked_up' but picked_up_by !=
 * self, returns 409.
 */
export async function pickupJob(
  db: SupabaseLike,
  params: { fabricatorId: string; jobId: string }
): Promise<PickupResult> {
  const { fabricatorId, jobId } = params;

  const ownership = await loadFabricatorAssignedJob(db, fabricatorId, jobId);
  if ("error" in ownership) return ownership;

  const status = ownership.job.status;

  // Idempotent re-download: same fabricator re-fetching their own
  // picked-up job. Read storage_path of the current revision +
  // return success without rewriting any row. No new pickup event.
  if (status === "picked_up" && ownership.job.lab_tech_picked_up_by === fabricatorId) {
    const path = await currentRevisionStoragePath(db, jobId);
    if ("error" in path) return path;
    return {
      jobId,
      storagePath: path.storagePath,
      pickedUpAt: new Date(0).toISOString(), // caller should read detail if they need the actual timestamp
    };
  }

  // Picked up by someone else — 409. Already-completed / rejected /
  // cancelled — also 409 (terminal from pickup POV).
  if (status !== "approved") {
    return {
      error: {
        status: 409,
        message: `Can't pick up a job in status '${status}'.`,
      },
    };
  }

  const now = new Date().toISOString();
  const update = await db
    .from("fabrication_jobs")
    .update({
      status: "picked_up",
      lab_tech_picked_up_by: fabricatorId,
      lab_tech_picked_up_at: now,
    })
    .eq("id", jobId)
    .eq("status", "approved"); // race guard — zero rows if someone else won
  if (update.error) {
    return {
      error: {
        status: 500,
        message: `Pickup transition failed: ${update.error.message}`,
      },
    };
  }

  // NOTE: PostgREST UPDATE doesn't tell us how many rows were
  // affected without .select(). If a race hit between the status
  // read above and the update, the update's WHERE filter catches it
  // (zero rows affected, no error), but we'd return a false success.
  // Re-read to confirm pickup landed on us. One extra round-trip;
  // correctness > speed for this race-sensitive action.
  const confirm = await db
    .from("fabrication_jobs")
    .select("lab_tech_picked_up_by, lab_tech_picked_up_at, status")
    .eq("id", jobId)
    .maybeSingle();
  if (confirm.error || !confirm.data) {
    return {
      error: {
        status: 500,
        message: "Pickup confirmation read failed",
      },
    };
  }
  if (confirm.data.lab_tech_picked_up_by !== fabricatorId) {
    return {
      error: {
        status: 409,
        message: "Another lab tech picked up this job first.",
      },
    };
  }

  const pathResult = await currentRevisionStoragePath(db, jobId);
  if ("error" in pathResult) return pathResult;

  return {
    jobId,
    storagePath: pathResult.storagePath,
    pickedUpAt: confirm.data.lab_tech_picked_up_at ?? now,
  };
}

async function currentRevisionStoragePath(
  db: SupabaseLike,
  jobId: string
): Promise<{ storagePath: string } | OrchestrationError> {
  const jobRow = await db
    .from("fabrication_jobs")
    .select("current_revision")
    .eq("id", jobId)
    .maybeSingle();
  if (jobRow.error || !jobRow.data) {
    return {
      error: {
        status: 500,
        message: "Couldn't read current_revision for storage path lookup",
      },
    };
  }
  const rev = await db
    .from("fabrication_job_revisions")
    .select("storage_path")
    .eq("job_id", jobId)
    .eq("revision_number", jobRow.data.current_revision)
    .maybeSingle();
  if (rev.error || !rev.data) {
    return {
      error: { status: 500, message: "Storage path lookup failed" },
    };
  }
  return { storagePath: rev.data.storage_path };
}

// ============================================================
// markComplete — picked_up → completed (printed / cut)
// ============================================================

export async function markComplete(
  db: SupabaseLike,
  params: {
    fabricatorId: string;
    jobId: string;
    /** Optional free-text note — "Printed fine, slight stringing
     *  on overhangs but well within tolerance". */
    completionNote?: string;
  }
): Promise<CompleteResult> {
  const ownership = await loadFabricatorOwnedPickedUpJob(
    db,
    params.fabricatorId,
    params.jobId
  );
  if ("error" in ownership) return ownership;

  if (ownership.job.status !== "picked_up") {
    return {
      error: {
        status: 409,
        message: `Can't complete a job in status '${ownership.job.status}'.`,
      },
    };
  }

  // Derive printed/cut from the machine's category.
  const machineResult = await db
    .from("machine_profiles")
    .select("machine_category")
    .eq("id", ownership.job.machine_profile_id)
    .maybeSingle();
  const machineCategory: "3d_printer" | "laser_cutter" | null =
    (machineResult.data?.machine_category as
      | "3d_printer"
      | "laser_cutter"
      | undefined) ?? null;
  const completionStatus = completionStatusForCategory(machineCategory);
  const now = new Date().toISOString();

  const update = await db
    .from("fabrication_jobs")
    .update({
      status: "completed",
      completion_status: completionStatus,
      completion_note: params.completionNote?.trim() || null,
      completed_at: now,
    })
    .eq("id", params.jobId)
    .eq("status", "picked_up")
    .eq("lab_tech_picked_up_by", params.fabricatorId);
  if (update.error) {
    return {
      error: {
        status: 500,
        message: `Completion transition failed: ${update.error.message}`,
      },
    };
  }

  return { jobId: params.jobId, completionStatus, completedAt: now };
}

// ============================================================
// markFailed — picked_up → completed (failed, required note)
// ============================================================

export async function markFailed(
  db: SupabaseLike,
  params: {
    fabricatorId: string;
    jobId: string;
    /** REQUIRED — "Warped off the bed at layer 12", "laser didn't
     *  cut through on the outer profile". Students + teachers
     *  both need to see WHY the run failed. */
    completionNote: string;
  }
): Promise<CompleteResult> {
  if (!params.completionNote || !params.completionNote.trim()) {
    return {
      error: {
        status: 400,
        message: "A note is required when marking a run as failed.",
      },
    };
  }

  const ownership = await loadFabricatorOwnedPickedUpJob(
    db,
    params.fabricatorId,
    params.jobId
  );
  if ("error" in ownership) return ownership;

  if (ownership.job.status !== "picked_up") {
    return {
      error: {
        status: 409,
        message: `Can't fail a job in status '${ownership.job.status}'.`,
      },
    };
  }

  const now = new Date().toISOString();
  const update = await db
    .from("fabrication_jobs")
    .update({
      status: "completed",
      completion_status: "failed",
      completion_note: params.completionNote.trim(),
      completed_at: now,
    })
    .eq("id", params.jobId)
    .eq("status", "picked_up")
    .eq("lab_tech_picked_up_by", params.fabricatorId);
  if (update.error) {
    return {
      error: {
        status: 500,
        message: `Fail transition failed: ${update.error.message}`,
      },
    };
  }

  return { jobId: params.jobId, completionStatus: "failed", completedAt: now };
}
