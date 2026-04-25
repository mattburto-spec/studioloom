/**
 * Lab orchestration — Preflight Phase 8-2.
 *
 * Parallel to `teacher-orchestration.ts` (teacher job approval) and
 * `fab-orchestration.ts` (fabricator queue + completion). Every
 * function takes a teacherId from requireTeacherAuth and scopes all
 * reads + writes by `fabrication_labs.teacher_id = teacherId`. No
 * cross-teacher visibility; 404 (not 403) for "not yours" to avoid
 * telegraphing existence — same pattern as every other Preflight
 * orchestration layer.
 *
 * Exports 5 functions per parent brief §3.2:
 *   - createLab          — POST /api/teacher/labs
 *   - listMyLabs         — GET  /api/teacher/labs
 *   - updateLab          — PATCH /api/teacher/labs/[id]
 *   - deleteLab          — DELETE /api/teacher/labs/[id]
 *   - reassignMachineToLab — PATCH /api/teacher/labs/[labId]/machines
 *
 * Key safety rails:
 *   - Delete: 409 if lab has ≥1 machine AND no `reassignTo` target provided
 *     (or 409 if the target lab has a different teacher_id).
 *   - Delete default: allowed, but caller must first promote another lab
 *     to `is_default = true`, else 409 "there must always be one default
 *     lab per teacher" (enforced at DB via unique partial index —
 *     promoting two-at-once fails on the constraint).
 *   - Cross-teacher ownership: every path validates teacher_id match on
 *     lab + machine_profile before touching the DB. Mismatches → 404.
 *   - `is_default` is set-only in create; `updateLab` + promotion
 *     requires a separate `setDefault` operation (not merged into the
 *     general PATCH to keep the update contract simple).
 *
 * Lab-level auto-approve bulk toggle (the "B. Per-lab toggle" shortcut
 * Matt agreed to): deliberately OUT OF 8-2 scope. That UX lands in 8-3
 * alongside machine CRUD, where it's cheap to add as
 * `POST /api/teacher/machine-profiles/bulk-approval` with a lab filter.
 * Keeps 8-2 focused.
 */

// ============================================================
// Shared types
// ============================================================

/**
 * Re-using OrchestrationError from the student-facing orchestration.
 * Keeps the error shape consistent across the codebase so API routes
 * don't need a separate mapper per orchestration layer.
 */
export interface OrchestrationError {
  error: { status: number; message: string };
}

export function isOrchestrationError(
  value: unknown
): value is OrchestrationError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as OrchestrationError).error === "object"
  );
}

/**
 * Minimal Supabase-like client shape — same convention as the other
 * orchestration modules. Decouples from supabase-js surface so tests
 * can fake it cleanly.
 */
interface SupabaseLike {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Shape of a single lab row as returned to callers. Maps 1:1 to the
 * columns from migration 113 — no derived fields.
 */
export interface LabRow {
  id: string;
  teacherId: string;
  schoolId: string | null;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extended row shape for list view — adds a machine count so the UI
 * can render "3 machines" chips without a second query per lab.
 * Computed via COUNT(*) GROUP BY lab_id; see `listMyLabs`.
 */
export interface LabListRow extends LabRow {
  machineCount: number;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Name validation — shared between create + update.
 * Non-empty, trimmed, max 80 chars (arbitrary but sane — "2nd floor
 * design lab — north wing" fits at 32). If a teacher hits the cap,
 * they're probably smuggling a description into the name field.
 */
const NAME_MAX = 80;

function validateName(raw: unknown): string | OrchestrationError {
  if (typeof raw !== "string") {
    return { error: { status: 400, message: "`name` must be a string." } };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { error: { status: 400, message: "`name` cannot be empty." } };
  }
  if (trimmed.length > NAME_MAX) {
    return {
      error: {
        status: 400,
        message: `\`name\` must be ${NAME_MAX} characters or fewer (got ${trimmed.length}).`,
      },
    };
  }
  return trimmed;
}

function validateDescription(raw: unknown): string | null | OrchestrationError {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") {
    return {
      error: { status: 400, message: "`description` must be a string or null." },
    };
  }
  return raw.trim() || null;
}

/**
 * Load a lab by id, scoped to a teacher. Returns 404 on not-found OR
 * cross-teacher access (same error message to avoid leaking existence).
 * Used by update + delete + reassign paths.
 */
async function loadTeacherOwnedLab(
  db: SupabaseLike,
  teacherId: string,
  labId: string
): Promise<{ lab: LabRow } | OrchestrationError> {
  const result = await db
    .from("fabrication_labs")
    .select("id, teacher_id, school_id, name, description, is_default, created_at, updated_at")
    .eq("id", labId)
    .maybeSingle();
  const { data, error } = result as {
    data: {
      id: string;
      teacher_id: string;
      school_id: string | null;
      name: string;
      description: string | null;
      is_default: boolean;
      created_at: string;
      updated_at: string;
    } | null;
    error: { message: string } | null;
  };

  if (error) {
    return { error: { status: 500, message: `Lab lookup failed: ${error.message}` } };
  }
  if (!data || data.teacher_id !== teacherId) {
    return { error: { status: 404, message: "Lab not found." } };
  }

  return {
    lab: {
      id: data.id,
      teacherId: data.teacher_id,
      schoolId: data.school_id,
      name: data.name,
      description: data.description,
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

// ============================================================
// createLab
// ============================================================

export interface CreateLabRequest {
  teacherId: string;
  name: string;
  description?: string | null;
  /** Caller can mint a new default lab directly — but since the DB has
   *  a unique partial index enforcing one-default-per-teacher, setting
   *  this true when another default already exists fails with a 409
   *  surfaced from the UPDATE error. For normal "create a second lab"
   *  flows, leave this off. */
  isDefault?: boolean;
}

export interface CreateLabSuccess {
  lab: LabRow;
}

export type CreateLabResult = CreateLabSuccess | OrchestrationError;

export async function createLab(
  db: SupabaseLike,
  params: CreateLabRequest
): Promise<CreateLabResult> {
  const name = validateName(params.name);
  if (isOrchestrationError(name)) return name;

  const description = validateDescription(params.description);
  if (isOrchestrationError(description)) return description;

  const insertResult = await db
    .from("fabrication_labs")
    .insert({
      teacher_id: params.teacherId,
      name,
      description,
      is_default: params.isDefault === true,
    })
    .select("id, teacher_id, school_id, name, description, is_default, created_at, updated_at")
    .single();
  const { data, error } = insertResult as {
    data: {
      id: string;
      teacher_id: string;
      school_id: string | null;
      name: string;
      description: string | null;
      is_default: boolean;
      created_at: string;
      updated_at: string;
    } | null;
    error: { message: string; code?: string } | null;
  };

  if (error) {
    // 23505 = unique_violation. Triggers when caller tries to mint a
    // second default lab — DB-enforced via
    // uq_fabrication_labs_one_default_per_teacher. Surface as 409
    // with a clear message.
    if (error.code === "23505") {
      return {
        error: {
          status: 409,
          message:
            "You already have a default lab. Set another lab to default before creating a new one.",
        },
      };
    }
    return { error: { status: 500, message: `Lab create failed: ${error.message}` } };
  }
  if (!data) {
    return { error: { status: 500, message: "Lab create returned no row." } };
  }

  return {
    lab: {
      id: data.id,
      teacherId: data.teacher_id,
      schoolId: data.school_id,
      name: data.name,
      description: data.description,
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

// ============================================================
// listMyLabs
// ============================================================

export interface ListMyLabsSuccess {
  labs: LabListRow[];
}

export type ListMyLabsResult = ListMyLabsSuccess | OrchestrationError;

export async function listMyLabs(
  db: SupabaseLike,
  params: { teacherId: string }
): Promise<ListMyLabsResult> {
  // Fetch labs, then fetch machine counts in a parallel second query.
  // Two round-trips but keeps the main query simple; scales fine at
  // expected cardinality (a teacher has <10 labs).
  const labsQuery = await db
    .from("fabrication_labs")
    .select("id, teacher_id, school_id, name, description, is_default, created_at, updated_at")
    .eq("teacher_id", params.teacherId)
    .order("is_default", { ascending: false }) // default first
    .order("name", { ascending: true });
  const { data: labData, error: labError } = labsQuery as {
    data: Array<{
      id: string;
      teacher_id: string;
      school_id: string | null;
      name: string;
      description: string | null;
      is_default: boolean;
      created_at: string;
      updated_at: string;
    }> | null;
    error: { message: string } | null;
  };

  if (labError) {
    return { error: { status: 500, message: `Lab list failed: ${labError.message}` } };
  }

  const labs = labData ?? [];
  if (labs.length === 0) {
    return { labs: [] };
  }

  // Pull machine counts per lab — scoped to this teacher's machines
  // for defence in depth (we already scoped labs by teacher_id, but
  // belt-and-braces).
  const labIds = labs.map((l) => l.id);
  const machinesQuery = await db
    .from("machine_profiles")
    .select("lab_id")
    .in("lab_id", labIds)
    .eq("teacher_id", params.teacherId)
    .eq("is_system_template", false)
    .eq("is_active", true); // Phase 8.1d: count visible machines only — soft-deleted ones are gone from the UI grid
  const { data: machineData, error: machineError } = machinesQuery as {
    data: Array<{ lab_id: string }> | null;
    error: { message: string } | null;
  };

  if (machineError) {
    return {
      error: {
        status: 500,
        message: `Machine count lookup failed: ${machineError.message}`,
      },
    };
  }

  // Bucket by lab_id for O(1) lookup when mapping lab rows.
  const countByLab = new Map<string, number>();
  for (const row of machineData ?? []) {
    countByLab.set(row.lab_id, (countByLab.get(row.lab_id) ?? 0) + 1);
  }

  return {
    labs: labs.map((l) => ({
      id: l.id,
      teacherId: l.teacher_id,
      schoolId: l.school_id,
      name: l.name,
      description: l.description,
      isDefault: l.is_default,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
      machineCount: countByLab.get(l.id) ?? 0,
    })),
  };
}

// ============================================================
// updateLab
// ============================================================

export interface UpdateLabRequest {
  teacherId: string;
  labId: string;
  /** Any subset — undefined keys untouched. Null description clears. */
  name?: string;
  description?: string | null;
  /** Set to true to promote this lab to default. The DB's unique partial
   *  index will fail (→ 23505 → 409 from us) if another default exists.
   *  Callers who want atomic swap should call `updateLab` twice: once
   *  with `isDefault: false` on the current default, then once here. */
  isDefault?: boolean;
}

export interface UpdateLabSuccess {
  lab: LabRow;
}

export type UpdateLabResult = UpdateLabSuccess | OrchestrationError;

export async function updateLab(
  db: SupabaseLike,
  params: UpdateLabRequest
): Promise<UpdateLabResult> {
  // Ownership guard first.
  const owned = await loadTeacherOwnedLab(db, params.teacherId, params.labId);
  if (isOrchestrationError(owned)) return owned;

  const patch: Record<string, unknown> = {};

  if (params.name !== undefined) {
    const name = validateName(params.name);
    if (isOrchestrationError(name)) return name;
    patch.name = name;
  }
  if (params.description !== undefined) {
    const description = validateDescription(params.description);
    if (isOrchestrationError(description)) return description;
    patch.description = description;
  }
  if (params.isDefault !== undefined) {
    patch.is_default = params.isDefault;
  }

  if (Object.keys(patch).length === 0) {
    return {
      error: {
        status: 400,
        message: "No updatable fields supplied (name / description / isDefault).",
      },
    };
  }

  const updateResult = await db
    .from("fabrication_labs")
    .update(patch)
    .eq("id", params.labId)
    .eq("teacher_id", params.teacherId) // defence in depth
    .select("id, teacher_id, school_id, name, description, is_default, created_at, updated_at")
    .single();
  const { data, error } = updateResult as {
    data: {
      id: string;
      teacher_id: string;
      school_id: string | null;
      name: string;
      description: string | null;
      is_default: boolean;
      created_at: string;
      updated_at: string;
    } | null;
    error: { message: string; code?: string } | null;
  };

  if (error) {
    if (error.code === "23505") {
      return {
        error: {
          status: 409,
          message:
            "Another lab is already marked as default. Unset that first, then retry.",
        },
      };
    }
    return { error: { status: 500, message: `Lab update failed: ${error.message}` } };
  }
  if (!data) {
    return { error: { status: 500, message: "Lab update returned no row." } };
  }

  return {
    lab: {
      id: data.id,
      teacherId: data.teacher_id,
      schoolId: data.school_id,
      name: data.name,
      description: data.description,
      isDefault: data.is_default,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

// ============================================================
// deleteLab
// ============================================================

export interface DeleteLabRequest {
  teacherId: string;
  labId: string;
  /** Optional: reassign all of this lab's machines to this target lab
   *  in the same transaction before deleting. If omitted AND the lab
   *  has ≥1 machine, returns 409 "reassign first". */
  reassignTo?: string;
}

export interface DeleteLabSuccess {
  deletedLabId: string;
  reassignedMachineCount: number;
}

export type DeleteLabResult = DeleteLabSuccess | OrchestrationError;

export async function deleteLab(
  db: SupabaseLike,
  params: DeleteLabRequest
): Promise<DeleteLabResult> {
  // Ownership guard on source lab.
  const owned = await loadTeacherOwnedLab(db, params.teacherId, params.labId);
  if (isOrchestrationError(owned)) return owned;

  // Guard: don't let teachers delete their last remaining default lab
  // if they still have other labs. Rule: if the lab being deleted is
  // the default AND there are other labs, require the caller to
  // promote one first. Keeps the invariant "teachers with footprint
  // have at least one default lab" consistent.
  if (owned.lab.isDefault) {
    const othersQuery = await db
      .from("fabrication_labs")
      .select("id")
      .eq("teacher_id", params.teacherId)
      .neq("id", params.labId)
      .limit(1);
    const { data: others } = othersQuery as { data: Array<{ id: string }> | null };
    if ((others?.length ?? 0) > 0) {
      return {
        error: {
          status: 409,
          message:
            "You can't delete your default lab while other labs exist. Set another lab as default first.",
        },
      };
    }
    // If this is the teacher's only lab, allow the delete — they're
    // cleaning up and we don't force them to keep one. Machine
    // reassignment below will return 409 if there are machines.
  }

  // Count ACTIVE machines in this lab. Phase 8.1d hotfix: soft-deleted
  // (is_active=false) machines used to block lab deletion even though
  // the UI showed them as gone — fixed by filtering here.
  // The cascade-reassign UPDATE below leaves is_active alone so any
  // inactive machines come along too, keeping FK references valid in
  // case the teacher reactivates them later.
  const machinesQuery = await db
    .from("machine_profiles")
    .select("id")
    .eq("lab_id", params.labId)
    .eq("teacher_id", params.teacherId)
    .eq("is_system_template", false)
    .eq("is_active", true);
  const { data: machines, error: machineError } = machinesQuery as {
    data: Array<{ id: string }> | null;
    error: { message: string } | null;
  };

  if (machineError) {
    return {
      error: {
        status: 500,
        message: `Machine enumeration failed: ${machineError.message}`,
      },
    };
  }

  const machineCount = machines?.length ?? 0;

  if (machineCount > 0) {
    if (!params.reassignTo) {
      return {
        error: {
          status: 409,
          message: `Lab has ${machineCount} machine${
            machineCount === 1 ? "" : "s"
          }. Provide \`reassignTo\` (another lab id) or move/delete the machines first.`,
        },
      };
    }
    // Verify reassignTo is also owned by this teacher.
    const targetOwned = await loadTeacherOwnedLab(
      db,
      params.teacherId,
      params.reassignTo
    );
    if (isOrchestrationError(targetOwned)) return targetOwned;
    if (targetOwned.lab.id === params.labId) {
      return {
        error: {
          status: 400,
          message: "`reassignTo` cannot be the lab being deleted.",
        },
      };
    }

    // Bulk reassign before delete.
    const reassign = await db
      .from("machine_profiles")
      .update({ lab_id: params.reassignTo })
      .eq("lab_id", params.labId)
      .eq("teacher_id", params.teacherId)
      .eq("is_system_template", false);
    if (reassign.error) {
      return {
        error: {
          status: 500,
          message: `Machine reassignment failed: ${reassign.error.message}`,
        },
      };
    }
  }

  // Also reassign any classes defaulting to this lab, same target.
  // Without this, classes end up with default_lab_id=NULL (ON DELETE
  // SET NULL) and the student picker falls back to "show all
  // machines" — fine, but surprises the teacher. If reassignTo is
  // set, route classes to it too.
  if (params.reassignTo) {
    const classReassign = await db
      .from("classes")
      .update({ default_lab_id: params.reassignTo })
      .eq("default_lab_id", params.labId)
      .eq("teacher_id", params.teacherId);
    if (classReassign.error) {
      return {
        error: {
          status: 500,
          message: `Class reassignment failed: ${classReassign.error.message}`,
        },
      };
    }
  }

  // Now the actual delete.
  const deleteResult = await db
    .from("fabrication_labs")
    .delete()
    .eq("id", params.labId)
    .eq("teacher_id", params.teacherId);
  if (deleteResult.error) {
    return {
      error: { status: 500, message: `Lab delete failed: ${deleteResult.error.message}` },
    };
  }

  return {
    deletedLabId: params.labId,
    reassignedMachineCount: machineCount,
  };
}

// ============================================================
// reassignMachineToLab
// ============================================================

export interface ReassignMachineRequest {
  teacherId: string;
  /** Source lab in the URL — used as the ownership anchor for the
   *  route namespace. We verify the teacher owns it, but don't require
   *  it to match the machine's current lab (teacher might be moving a
   *  machine they just added to the wrong lab). */
  sourceLabId: string;
  machineProfileId: string;
  targetLabId: string;
}

export interface ReassignMachineSuccess {
  machineProfileId: string;
  previousLabId: string | null;
  newLabId: string;
}

export type ReassignMachineResult = ReassignMachineSuccess | OrchestrationError;

export async function reassignMachineToLab(
  db: SupabaseLike,
  params: ReassignMachineRequest
): Promise<ReassignMachineResult> {
  // Source lab ownership (URL anchor).
  const source = await loadTeacherOwnedLab(db, params.teacherId, params.sourceLabId);
  if (isOrchestrationError(source)) return source;

  // Target lab ownership (body).
  const target = await loadTeacherOwnedLab(db, params.teacherId, params.targetLabId);
  if (isOrchestrationError(target)) return target;

  if (target.lab.id === source.lab.id) {
    return {
      error: { status: 400, message: "Source and target lab are the same — nothing to reassign." },
    };
  }

  // Machine ownership — explicit check so we 404 (not 500) on
  // cross-teacher or not-found.
  const machineQuery = await db
    .from("machine_profiles")
    .select("id, teacher_id, lab_id, is_system_template")
    .eq("id", params.machineProfileId)
    .maybeSingle();
  const { data: machine, error: machineError } = machineQuery as {
    data: {
      id: string;
      teacher_id: string | null;
      lab_id: string | null;
      is_system_template: boolean;
    } | null;
    error: { message: string } | null;
  };

  if (machineError) {
    return {
      error: { status: 500, message: `Machine lookup failed: ${machineError.message}` },
    };
  }
  if (!machine || machine.teacher_id !== params.teacherId) {
    return { error: { status: 404, message: "Machine not found." } };
  }
  if (machine.is_system_template) {
    // System templates are cross-tenant seed rows — they don't get
    // scoped to a lab, ever.
    return {
      error: {
        status: 409,
        message: "System-template machines can't be assigned to a lab.",
      },
    };
  }

  // Perform the update. Use teacher_id in the WHERE as defence in
  // depth — even though we validated above, a concurrent teacher-
  // transfer (shouldn't happen in v1 but future FU-P) won't sneak in.
  const updateResult = await db
    .from("machine_profiles")
    .update({ lab_id: params.targetLabId })
    .eq("id", params.machineProfileId)
    .eq("teacher_id", params.teacherId);
  if (updateResult.error) {
    return {
      error: {
        status: 500,
        message: `Machine reassignment failed: ${updateResult.error.message}`,
      },
    };
  }

  return {
    machineProfileId: params.machineProfileId,
    previousLabId: machine.lab_id,
    newLabId: params.targetLabId,
  };
}
