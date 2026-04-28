/**
 * Lab orchestration — Preflight Phase 8-2 (revised 28 Apr 2026 for
 * school-scoped lab ownership).
 *
 * Parallel to `teacher-orchestration.ts` (teacher job approval) and
 * `fab-orchestration.ts` (fabricator queue + completion). Every
 * function takes a teacherId from requireTeacherAuth, derives the
 * teacher's school_id, and scopes every read + write by
 * `fabrication_labs.school_id = teacher.school_id`. Labs are
 * school-owned (not teacher-owned per the original 24 Apr draft) —
 * any teacher at the same school sees + edits the same labs.
 *
 * Mismatches → 404 (not 403) to avoid leaking the existence of
 * labs at other schools — same pattern as the rest of the
 * Preflight orchestration layer.
 *
 * Exports 5 functions per parent brief §3.2 + this revision:
 *   - createLab            — POST   /api/teacher/labs
 *   - listMyLabs           — GET    /api/teacher/labs
 *   - updateLab            — PATCH  /api/teacher/labs/[id]
 *   - deleteLab            — DELETE /api/teacher/labs/[id]
 *   - reassignMachineToLab — PATCH  /api/teacher/labs/[labId]/machines
 *
 * Key contracts:
 *   - Lab name is unique within a school (DB-enforced via
 *     idx_fabrication_labs_unique_name_per_school, case-insensitive,
 *     whitespace-collapsed). Duplicate name → 23505 → 409.
 *   - `created_by_teacher_id` is audit-only — does NOT gate access.
 *     Any teacher at the same school can edit/delete a lab someone
 *     else created (flat membership per access-model-v2).
 *   - Delete safety rails: 409 if lab is referenced by ≥1
 *     machine_profile, ≥1 class.default_lab_id, OR ≥1
 *     teacher.default_lab_id. Caller must reassign-or-clear those
 *     before the delete proceeds. fabrication_jobs.lab_id is
 *     ON DELETE SET NULL so jobs are not blockers.
 *   - reassignMachineToLab: both source + target lab must be in the
 *     same school as the calling teacher. Cross-school reassignment
 *     → 404.
 *
 * The `is_default` flag from the 24 Apr draft is GONE. Per-class
 * defaults live on `classes.default_lab_id`; per-teacher preferences
 * live on `teachers.default_lab_id`. Labs themselves are uniform.
 *
 * Lab-level auto-approve bulk toggle stays out-of-scope here; that
 * lands in 8-3 alongside machine CRUD.
 */

// ============================================================
// Shared types
// ============================================================

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

interface SupabaseLike {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Lab row shape returned to callers. Mirrors the post-revision
 * fabrication_labs columns (school_id NOT NULL, created_by_teacher_id
 * audit-only nullable). camelCase per the orchestration-layer convention.
 */
export interface LabRow {
  id: string;
  schoolId: string;
  createdByTeacherId: string | null;
  name: string;
  description: string | null;
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
 * Look up the calling teacher's school_id. Returns 401 when the
 * teacher row is missing, OR when school_id IS NULL (orphan teacher
 * pre-welcome-wizard — they need to pick a school before they can
 * manage labs). Used at the top of every lab orchestration function.
 */
export async function loadTeacherSchoolId(
  db: SupabaseLike,
  teacherId: string
): Promise<{ schoolId: string } | OrchestrationError> {
  const result = await db
    .from("teachers")
    .select("school_id")
    .eq("id", teacherId)
    .maybeSingle();
  const { data, error } = result as {
    data: { school_id: string | null } | null;
    error: { message: string } | null;
  };
  if (error) {
    return {
      error: { status: 500, message: `Teacher lookup failed: ${error.message}` },
    };
  }
  if (!data) {
    return { error: { status: 401, message: "Teacher not found." } };
  }
  if (!data.school_id) {
    return {
      error: {
        status: 401,
        message:
          "Pick your school before managing labs. Open Settings → School to set it.",
      },
    };
  }
  return { schoolId: data.school_id };
}

/**
 * Load a lab by id, scoped to a teacher's school. Returns 404 on
 * not-found OR cross-school access (same error message — don't
 * leak existence of labs at other schools). Used by update + delete
 * + reassign paths.
 */
export async function loadSchoolOwnedLab(
  db: SupabaseLike,
  schoolId: string,
  labId: string
): Promise<{ lab: LabRow } | OrchestrationError> {
  const result = await db
    .from("fabrication_labs")
    .select(
      "id, school_id, created_by_teacher_id, name, description, created_at, updated_at"
    )
    .eq("id", labId)
    .maybeSingle();
  const { data, error } = result as {
    data: {
      id: string;
      school_id: string;
      created_by_teacher_id: string | null;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    } | null;
    error: { message: string } | null;
  };

  if (error) {
    return { error: { status: 500, message: `Lab lookup failed: ${error.message}` } };
  }
  if (!data || data.school_id !== schoolId) {
    return { error: { status: 404, message: "Lab not found." } };
  }

  return {
    lab: {
      id: data.id,
      schoolId: data.school_id,
      createdByTeacherId: data.created_by_teacher_id,
      name: data.name,
      description: data.description,
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

  const schoolResult = await loadTeacherSchoolId(db, params.teacherId);
  if (isOrchestrationError(schoolResult)) return schoolResult;

  const insertResult = await db
    .from("fabrication_labs")
    .insert({
      school_id: schoolResult.schoolId,
      created_by_teacher_id: params.teacherId,
      name,
      description,
    })
    .select(
      "id, school_id, created_by_teacher_id, name, description, created_at, updated_at"
    )
    .single();
  const { data, error } = insertResult as {
    data: {
      id: string;
      school_id: string;
      created_by_teacher_id: string | null;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    } | null;
    error: { message: string; code?: string } | null;
  };

  if (error) {
    // 23505 = unique_violation on idx_fabrication_labs_unique_name_per_school.
    // Triggered when another teacher at the same school already has a lab
    // with the same case-insensitive name. Surface as 409 with a clear
    // message — the user can rename and retry.
    if (error.code === "23505") {
      return {
        error: {
          status: 409,
          message: `A lab named "${name}" already exists at your school. Pick a different name.`,
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
      schoolId: data.school_id,
      createdByTeacherId: data.created_by_teacher_id,
      name: data.name,
      description: data.description,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

// ============================================================
// listMyLabs (school-scoped — every teacher at the school sees the
// same list)
// ============================================================

export interface ListMyLabsSuccess {
  labs: LabListRow[];
}

export type ListMyLabsResult = ListMyLabsSuccess | OrchestrationError;

export async function listMyLabs(
  db: SupabaseLike,
  params: { teacherId: string }
): Promise<ListMyLabsResult> {
  const schoolResult = await loadTeacherSchoolId(db, params.teacherId);
  if (isOrchestrationError(schoolResult)) {
    // Orphan teacher (no school_id) → empty list. Don't 401 here —
    // the page should render with a "set your school first" prompt
    // surfaced from the auth/settings layer, not from /api/teacher/labs.
    if (schoolResult.error.status === 401) {
      return { labs: [] };
    }
    return schoolResult;
  }

  const labsQuery = await db
    .from("fabrication_labs")
    .select(
      "id, school_id, created_by_teacher_id, name, description, created_at, updated_at"
    )
    .eq("school_id", schoolResult.schoolId)
    .order("name", { ascending: true });
  const { data: labData, error: labError } = labsQuery as {
    data: Array<{
      id: string;
      school_id: string;
      created_by_teacher_id: string | null;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    }> | null;
    error: { message: string } | null;
  };

  if (labError) {
    return {
      error: { status: 500, message: `Lab list failed: ${labError.message}` },
    };
  }
  if (!labData || labData.length === 0) {
    return { labs: [] };
  }

  // Per-lab machine count. Single GROUP-BY-style query via PostgREST:
  // pull all machine rows in those labs, group in JS. Lab cardinality
  // is tiny (<10 per school) and machine cardinality is small (<50)
  // so this is cheap.
  const labIds = labData.map((l) => l.id);
  const machinesQuery = await db
    .from("machine_profiles")
    .select("id, lab_id")
    .in("lab_id", labIds)
    .eq("is_active", true)
    .eq("is_system_template", false);
  const { data: machineData, error: machineError } = machinesQuery as {
    data: Array<{ id: string; lab_id: string }> | null;
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

  const countByLab = new Map<string, number>();
  for (const m of machineData ?? []) {
    countByLab.set(m.lab_id, (countByLab.get(m.lab_id) ?? 0) + 1);
  }

  const labs: LabListRow[] = labData.map((l) => ({
    id: l.id,
    schoolId: l.school_id,
    createdByTeacherId: l.created_by_teacher_id,
    name: l.name,
    description: l.description,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
    machineCount: countByLab.get(l.id) ?? 0,
  }));

  return { labs };
}

// ============================================================
// updateLab
// ============================================================

export interface UpdateLabRequest {
  teacherId: string;
  labId: string;
  name?: string;
  description?: string | null;
}

export interface UpdateLabSuccess {
  lab: LabRow;
}

export type UpdateLabResult = UpdateLabSuccess | OrchestrationError;

export async function updateLab(
  db: SupabaseLike,
  params: UpdateLabRequest
): Promise<UpdateLabResult> {
  const schoolResult = await loadTeacherSchoolId(db, params.teacherId);
  if (isOrchestrationError(schoolResult)) return schoolResult;

  // Load + verify same-school. 404 on cross-school.
  const existing = await loadSchoolOwnedLab(
    db,
    schoolResult.schoolId,
    params.labId
  );
  if (isOrchestrationError(existing)) return existing;

  const patch: Record<string, unknown> = {};
  if (params.name !== undefined) {
    const validatedName = validateName(params.name);
    if (isOrchestrationError(validatedName)) return validatedName;
    patch.name = validatedName;
  }
  if (params.description !== undefined) {
    const validatedDescription = validateDescription(params.description);
    if (isOrchestrationError(validatedDescription)) return validatedDescription;
    patch.description = validatedDescription;
  }

  if (Object.keys(patch).length === 0) {
    // No-op — return the existing lab unchanged. Avoids a pointless
    // round-trip + keeps the response shape consistent.
    return { lab: existing.lab };
  }

  const updateResult = await db
    .from("fabrication_labs")
    .update(patch)
    .eq("id", params.labId)
    .eq("school_id", schoolResult.schoolId) // defence in depth
    .select(
      "id, school_id, created_by_teacher_id, name, description, created_at, updated_at"
    )
    .single();
  const { data, error } = updateResult as {
    data: {
      id: string;
      school_id: string;
      created_by_teacher_id: string | null;
      name: string;
      description: string | null;
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
          message: `A lab named "${patch.name}" already exists at your school. Pick a different name.`,
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
      schoolId: data.school_id,
      createdByTeacherId: data.created_by_teacher_id,
      name: data.name,
      description: data.description,
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
  /** Optional reassignment target. If provided, every machine_profile
   *  + class.default_lab_id + teacher.default_lab_id currently
   *  pointing at labId will be redirected to reassignTo BEFORE the
   *  delete fires. Both labs must be at the same school. */
  reassignTo?: string;
}

export interface DeleteLabSuccess {
  deletedId: string;
  /** Counts of references that were redirected (or 0 if no
   *  reassignTo was provided). Surfaced for audit + UI feedback. */
  reassigned: {
    machines: number;
    classes: number;
    teachers: number;
  };
}

export type DeleteLabResult = DeleteLabSuccess | OrchestrationError;

export async function deleteLab(
  db: SupabaseLike,
  params: DeleteLabRequest
): Promise<DeleteLabResult> {
  const schoolResult = await loadTeacherSchoolId(db, params.teacherId);
  if (isOrchestrationError(schoolResult)) return schoolResult;

  // Verify the lab exists + same school.
  const existing = await loadSchoolOwnedLab(
    db,
    schoolResult.schoolId,
    params.labId
  );
  if (isOrchestrationError(existing)) return existing;

  // If a reassignment target is provided, verify it's also same-school
  // BEFORE we touch any rows. Cross-school reassign → 404.
  if (params.reassignTo) {
    if (params.reassignTo === params.labId) {
      return {
        error: {
          status: 400,
          message: "Cannot reassign a lab to itself.",
        },
      };
    }
    const reassignTarget = await loadSchoolOwnedLab(
      db,
      schoolResult.schoolId,
      params.reassignTo
    );
    if (isOrchestrationError(reassignTarget)) {
      return {
        error: {
          status: 404,
          message: "Reassignment target lab not found.",
        },
      };
    }
  }

  // Count + (optionally) reassign references on three tables.
  // Order matters: count BEFORE any UPDATE so the counts reflect the
  // pre-action state. Then apply UPDATEs (or 409 if blocked).
  const reassigned = { machines: 0, classes: 0, teachers: 0 };

  const machinesRefResult = await db
    .from("machine_profiles")
    .select("id")
    .eq("lab_id", params.labId);
  const machinesRefs =
    (machinesRefResult.data as Array<{ id: string }> | null) ?? [];

  const classesRefResult = await db
    .from("classes")
    .select("id")
    .eq("default_lab_id", params.labId);
  const classesRefs =
    (classesRefResult.data as Array<{ id: string }> | null) ?? [];

  const teachersRefResult = await db
    .from("teachers")
    .select("id")
    .eq("default_lab_id", params.labId);
  const teachersRefs =
    (teachersRefResult.data as Array<{ id: string }> | null) ?? [];

  if (params.reassignTo) {
    if (machinesRefs.length > 0) {
      const update = await db
        .from("machine_profiles")
        .update({ lab_id: params.reassignTo })
        .eq("lab_id", params.labId);
      if ((update as { error: { message: string } | null }).error) {
        return {
          error: {
            status: 500,
            message: `Machine reassign failed: ${(update as { error: { message: string } }).error.message}`,
          },
        };
      }
      reassigned.machines = machinesRefs.length;
    }
    if (classesRefs.length > 0) {
      const update = await db
        .from("classes")
        .update({ default_lab_id: params.reassignTo })
        .eq("default_lab_id", params.labId);
      if ((update as { error: { message: string } | null }).error) {
        return {
          error: {
            status: 500,
            message: `Class reassign failed: ${(update as { error: { message: string } }).error.message}`,
          },
        };
      }
      reassigned.classes = classesRefs.length;
    }
    if (teachersRefs.length > 0) {
      const update = await db
        .from("teachers")
        .update({ default_lab_id: params.reassignTo })
        .eq("default_lab_id", params.labId);
      if ((update as { error: { message: string } | null }).error) {
        return {
          error: {
            status: 500,
            message: `Teacher-default reassign failed: ${(update as { error: { message: string } }).error.message}`,
          },
        };
      }
      reassigned.teachers = teachersRefs.length;
    }
  } else if (
    machinesRefs.length > 0 ||
    classesRefs.length > 0 ||
    teachersRefs.length > 0
  ) {
    // No reassign target + at least one blocker → 409 with a
    // detailed message so the UI can prompt for a target.
    const parts: string[] = [];
    if (machinesRefs.length > 0)
      parts.push(`${machinesRefs.length} machine${machinesRefs.length === 1 ? "" : "s"}`);
    if (classesRefs.length > 0)
      parts.push(`${classesRefs.length} class${classesRefs.length === 1 ? "" : "es"}`);
    if (teachersRefs.length > 0)
      parts.push(`${teachersRefs.length} teacher default${teachersRefs.length === 1 ? "" : "s"}`);
    return {
      error: {
        status: 409,
        message: `Can't delete this lab — it's still referenced by ${parts.join(
          ", "
        )}. Pick another lab to reassign them to, or remove the references first.`,
      },
    };
  }

  // All clear — delete the lab. fabrication_jobs.lab_id is
  // ON DELETE SET NULL so historical jobs keep working.
  const deleteResult = await db
    .from("fabrication_labs")
    .delete()
    .eq("id", params.labId)
    .eq("school_id", schoolResult.schoolId); // defence in depth
  if ((deleteResult as { error: { message: string } | null }).error) {
    return {
      error: {
        status: 500,
        message: `Lab delete failed: ${(deleteResult as { error: { message: string } }).error.message}`,
      },
    };
  }

  return {
    deletedId: params.labId,
    reassigned,
  };
}

// ============================================================
// reassignMachineToLab
// ============================================================

export interface ReassignMachineRequest {
  teacherId: string;
  /** The lab whose `/machines` endpoint was hit — source of truth
   *  for "this machine SHOULD currently be in this lab". */
  fromLabId: string;
  machineProfileId: string;
  toLabId: string;
}

export interface ReassignMachineSuccess {
  machineProfileId: string;
  fromLabId: string;
  toLabId: string;
}

export type ReassignMachineResult =
  | ReassignMachineSuccess
  | OrchestrationError;

export async function reassignMachineToLab(
  db: SupabaseLike,
  params: ReassignMachineRequest
): Promise<ReassignMachineResult> {
  const schoolResult = await loadTeacherSchoolId(db, params.teacherId);
  if (isOrchestrationError(schoolResult)) return schoolResult;

  if (params.fromLabId === params.toLabId) {
    return {
      error: {
        status: 400,
        message: "Source and target lab must differ.",
      },
    };
  }

  // Both labs must be in the same school as the calling teacher.
  // Cross-school → 404.
  const fromLab = await loadSchoolOwnedLab(
    db,
    schoolResult.schoolId,
    params.fromLabId
  );
  if (isOrchestrationError(fromLab)) return fromLab;
  const toLab = await loadSchoolOwnedLab(
    db,
    schoolResult.schoolId,
    params.toLabId
  );
  if (isOrchestrationError(toLab)) return toLab;

  // Verify the machine exists + currently in fromLabId.
  const machineResult = await db
    .from("machine_profiles")
    .select("id, lab_id")
    .eq("id", params.machineProfileId)
    .maybeSingle();
  const { data: machineData, error: machineError } = machineResult as {
    data: { id: string; lab_id: string | null } | null;
    error: { message: string } | null;
  };

  if (machineError) {
    return {
      error: {
        status: 500,
        message: `Machine lookup failed: ${machineError.message}`,
      },
    };
  }
  if (!machineData) {
    return { error: { status: 404, message: "Machine not found." } };
  }
  if (machineData.lab_id !== params.fromLabId) {
    return {
      error: {
        status: 409,
        message:
          "Machine is not currently in the source lab. The page may be stale — refresh and try again.",
      },
    };
  }

  // Conditional UPDATE — re-checks lab_id at write time so a parallel
  // reassign racing this one doesn't double-move.
  const updateResult = await db
    .from("machine_profiles")
    .update({ lab_id: params.toLabId })
    .eq("id", params.machineProfileId)
    .eq("lab_id", params.fromLabId);
  if ((updateResult as { error: { message: string } | null }).error) {
    return {
      error: {
        status: 500,
        message: `Machine reassign failed: ${(updateResult as { error: { message: string } }).error.message}`,
      },
    };
  }

  return {
    machineProfileId: params.machineProfileId,
    fromLabId: params.fromLabId,
    toLabId: params.toLabId,
  };
}
