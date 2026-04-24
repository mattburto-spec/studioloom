/**
 * Machine-profile orchestration — Preflight Phase 8-3.
 *
 * Parallel to `lab-orchestration.ts` (Phase 8-2) and
 * `teacher-orchestration.ts` (Phase 6). Every function takes a
 * teacherId from requireTeacherAuth and scopes writes by
 * `machine_profiles.teacher_id = teacherId`. No cross-teacher
 * visibility; 404 (not 403) for "not yours" — same pattern as the
 * rest of Preflight.
 *
 * Exports per parent brief §3.3 + the "bulk lab-level approval
 * toggle" promised to Matt at the 8-2 pre-flight conversation:
 *   - createMachineProfile    — POST /api/teacher/machine-profiles
 *   - listMyMachines          — GET  /api/teacher/machine-profiles
 *   - updateMachineProfile    — PATCH .../[id]
 *   - softDeleteMachineProfile— DELETE .../[id] (is_active = false; 409 if active jobs)
 *   - bulkSetApprovalForLab   — POST /api/teacher/labs/[id]/bulk-approval
 *
 * Design decisions:
 *
 *   Create-from-template vs create-from-scratch: one endpoint, two
 *   paths. Pass `fromTemplateId` to copy; omit to create from scratch.
 *   Copy-from-template inherits every spec field, swaps
 *   `teacher_id` to self + `is_system_template` to false, ignores
 *   the template's own `lab_id` (template lab_id is always null per
 *   8-1 backfill rules) and uses the caller-provided `labId`. `rule_overrides`
 *   + `operation_color_map` + `supported_materials` are deep-copied
 *   (these are JSONB so a shallow object copy is fine).
 *
 *   Hard delete vs soft delete: ALWAYS soft-delete. Sets
 *   `is_active = false`. Preserves historical trail (completed jobs
 *   still reference the machine). Matches the "no hard-delete"
 *   pattern from fabricators (1B-2 D-FABRICATOR-3). If the teacher
 *   later wants to permanently remove, that's an admin-level action
 *   not shipped in v1.
 *
 *   Active-jobs guard on delete: any job whose status is NOT in
 *   {completed, rejected, cancelled} counts as active. Blocks machines
 *   mid-flow from being deactivated under a student or fabricator's
 *   feet.
 *
 *   System templates are read-only. Teachers can copy them but can't
 *   edit or delete them — those are global seeds. API calls mutating
 *   a template row return 404 (we scope by teacher_id, so the template
 *   never matches).
 */

// ============================================================
// Shared types (re-used from lab-orchestration for consistency)
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
 * Machine category enum — mirrors the DB CHECK from migration 093.
 */
export type MachineCategory = "3d_printer" | "laser_cutter";

/**
 * Operation colour map shape: hex-colour → operation name.
 * Laser cutters only; 3D printer rows pass `null`.
 * Matches the 094 seed shape: `{"#FF0000": "cut", "#0000FF": "score", ...}`.
 */
export type OperationColorMap = Record<string, "cut" | "score" | "engrave">;

/**
 * Full spec payload returned to callers. Maps 1:1 to the columns on
 * `machine_profiles` with camelCase + sensible null semantics.
 */
export interface MachineProfileRow {
  id: string;
  teacherId: string | null;
  schoolId: string | null;
  labId: string | null;
  isSystemTemplate: boolean;
  name: string;
  machineCategory: MachineCategory;
  machineModel: string | null;
  isActive: boolean;
  requiresTeacherApproval: boolean;
  bedSizeXMm: number;
  bedSizeYMm: number;
  bedSizeZMm: number | null;
  nozzleDiameterMm: number | null;
  supportedMaterials: unknown | null;
  maxPrintTimeMin: number | null;
  supportsAutoSupports: boolean | null;
  kerfMm: number | null;
  operationColorMap: OperationColorMap | null;
  minFeatureMm: number | null;
  ruleOverrides: unknown | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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

function validateMachineCategory(
  raw: unknown
): MachineCategory | OrchestrationError {
  if (raw !== "3d_printer" && raw !== "laser_cutter") {
    return {
      error: {
        status: 400,
        message: "`machineCategory` must be '3d_printer' or 'laser_cutter'.",
      },
    };
  }
  return raw;
}

function validateBedSize(raw: unknown, field: string): number | OrchestrationError {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return {
      error: {
        status: 400,
        message: `\`${field}\` must be a positive number (mm).`,
      },
    };
  }
  return raw;
}

/**
 * Validate operation_color_map payload. Accepts:
 *   - null (no map — typical for 3D printers)
 *   - {} (empty map — teacher will fill in later)
 *   - { "#RRGGBB": "cut" | "score" | "engrave" } (normal case)
 * Rejects unknown operations and non-hex keys.
 */
function validateOperationColorMap(
  raw: unknown
): OperationColorMap | null | OrchestrationError {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return {
      error: {
        status: 400,
        message: "`operationColorMap` must be an object or null.",
      },
    };
  }
  const validOps = new Set(["cut", "score", "engrave"]);
  const hexRe = /^#[0-9A-Fa-f]{6}$/;
  const out: OperationColorMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!hexRe.test(key)) {
      return {
        error: {
          status: 400,
          message: `\`operationColorMap\` key '${key}' is not a valid #RRGGBB hex colour.`,
        },
      };
    }
    if (typeof value !== "string" || !validOps.has(value)) {
      return {
        error: {
          status: 400,
          message: `\`operationColorMap\` value for '${key}' must be 'cut' | 'score' | 'engrave' (got ${JSON.stringify(value)}).`,
        },
      };
    }
    out[key] = value as "cut" | "score" | "engrave";
  }
  return out;
}

/**
 * Which statuses count as "active" — i.e. block soft-delete. Anything
 * not in {completed, rejected, cancelled} is still mid-flow.
 *
 * Keep in sync with `CANCELLABLE_STATUSES` in orchestration.ts +
 * `studentActionsLocked` in teacher-review-note-helpers.ts. Shared
 * terminal-status vocabulary — will get a single source of truth in
 * a future polish pass.
 */
const TERMINAL_STATUSES = ["completed", "rejected", "cancelled"] as const;

type MachineProfileRawRow = {
  id: string;
  teacher_id: string | null;
  school_id: string | null;
  lab_id: string | null;
  is_system_template: boolean;
  name: string;
  machine_category: string;
  machine_model: string | null;
  is_active: boolean;
  requires_teacher_approval: boolean;
  bed_size_x_mm: number;
  bed_size_y_mm: number;
  bed_size_z_mm: number | null;
  nozzle_diameter_mm: number | null;
  supported_materials: unknown | null;
  max_print_time_min: number | null;
  supports_auto_supports: boolean | null;
  kerf_mm: number | null;
  operation_color_map: unknown | null;
  min_feature_mm: number | null;
  rule_overrides: unknown | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function toRow(raw: MachineProfileRawRow): MachineProfileRow {
  return {
    id: raw.id,
    teacherId: raw.teacher_id,
    schoolId: raw.school_id,
    labId: raw.lab_id,
    isSystemTemplate: raw.is_system_template,
    name: raw.name,
    machineCategory: raw.machine_category as MachineCategory,
    machineModel: raw.machine_model,
    isActive: raw.is_active,
    requiresTeacherApproval: raw.requires_teacher_approval,
    bedSizeXMm: raw.bed_size_x_mm,
    bedSizeYMm: raw.bed_size_y_mm,
    bedSizeZMm: raw.bed_size_z_mm,
    nozzleDiameterMm: raw.nozzle_diameter_mm,
    supportedMaterials: raw.supported_materials,
    maxPrintTimeMin: raw.max_print_time_min,
    supportsAutoSupports: raw.supports_auto_supports,
    kerfMm: raw.kerf_mm,
    operationColorMap: (raw.operation_color_map as OperationColorMap | null) ?? null,
    minFeatureMm: raw.min_feature_mm,
    ruleOverrides: raw.rule_overrides,
    notes: raw.notes,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

const FULL_SELECT =
  "id, teacher_id, school_id, lab_id, is_system_template, name, machine_category, machine_model, is_active, requires_teacher_approval, bed_size_x_mm, bed_size_y_mm, bed_size_z_mm, nozzle_diameter_mm, supported_materials, max_print_time_min, supports_auto_supports, kerf_mm, operation_color_map, min_feature_mm, rule_overrides, notes, created_at, updated_at";

/**
 * Load a machine profile by id, scoped to a teacher. Returns 404 on
 * not-found / cross-teacher / system-template.
 * Used by update + soft-delete paths. Does NOT load templates — if a
 * teacher tries to mutate a template, they get 404 not 403 (per pattern).
 */
async function loadTeacherOwnedMachine(
  db: SupabaseLike,
  teacherId: string,
  machineId: string
): Promise<{ machine: MachineProfileRow } | OrchestrationError> {
  const result = await db
    .from("machine_profiles")
    .select(FULL_SELECT)
    .eq("id", machineId)
    .maybeSingle();
  const { data, error } = result as {
    data: MachineProfileRawRow | null;
    error: { message: string } | null;
  };

  if (error) {
    return {
      error: { status: 500, message: `Machine lookup failed: ${error.message}` },
    };
  }
  if (!data || data.teacher_id !== teacherId || data.is_system_template) {
    return { error: { status: 404, message: "Machine not found." } };
  }

  return { machine: toRow(data) };
}

// ============================================================
// createMachineProfile
// ============================================================

export interface CreateMachineProfileRequest {
  teacherId: string;
  /** If set, copy from this system template. Overrides most other
   *  fields — the caller provides only `name` + `labId` + optional
   *  spec overrides. */
  fromTemplateId?: string;
  /** Lab to assign the new machine to. Required for both paths —
   *  every machine belongs to a lab (enforced by UX / backfill, though
   *  the DB column is nullable). */
  labId: string;
  /** Teacher-friendly name — defaults to the template's name when
   *  fromTemplateId is set, but teacher can override (e.g. "Bambu X1C
   *  (main) — south corner"). */
  name: string;
  machineCategory?: MachineCategory;
  machineModel?: string | null;
  bedSizeXMm?: number;
  bedSizeYMm?: number;
  bedSizeZMm?: number | null;
  nozzleDiameterMm?: number | null;
  kerfMm?: number | null;
  minFeatureMm?: number | null;
  requiresTeacherApproval?: boolean;
  operationColorMap?: OperationColorMap | null;
  notes?: string | null;
  supportedMaterials?: unknown;
  supportsAutoSupports?: boolean | null;
  maxPrintTimeMin?: number | null;
}

export interface CreateMachineProfileSuccess {
  machine: MachineProfileRow;
}

export type CreateMachineProfileResult =
  | CreateMachineProfileSuccess
  | OrchestrationError;

export async function createMachineProfile(
  db: SupabaseLike,
  params: CreateMachineProfileRequest
): Promise<CreateMachineProfileResult> {
  const name = validateName(params.name);
  if (isOrchestrationError(name)) return name;

  // Verify labId belongs to this teacher (ownership pierce).
  const labCheck = await db
    .from("fabrication_labs")
    .select("id, teacher_id")
    .eq("id", params.labId)
    .maybeSingle();
  const { data: labRow, error: labError } = labCheck as {
    data: { id: string; teacher_id: string } | null;
    error: { message: string } | null;
  };
  if (labError) {
    return {
      error: { status: 500, message: `Lab lookup failed: ${labError.message}` },
    };
  }
  if (!labRow || labRow.teacher_id !== params.teacherId) {
    return { error: { status: 404, message: "Lab not found." } };
  }

  let insertPayload: Record<string, unknown>;

  if (params.fromTemplateId) {
    // Copy-from-template path: load the template row, override
    // name/lab/teacher, clear system-template flag.
    const tplResult = await db
      .from("machine_profiles")
      .select(FULL_SELECT)
      .eq("id", params.fromTemplateId)
      .maybeSingle();
    const { data: tplRaw, error: tplError } = tplResult as {
      data: MachineProfileRawRow | null;
      error: { message: string } | null;
    };
    if (tplError) {
      return {
        error: {
          status: 500,
          message: `Template lookup failed: ${tplError.message}`,
        },
      };
    }
    if (!tplRaw || !tplRaw.is_system_template) {
      return { error: { status: 404, message: "Template not found." } };
    }

    insertPayload = {
      teacher_id: params.teacherId,
      school_id: null,
      lab_id: params.labId,
      is_system_template: false,
      name,
      machine_category: tplRaw.machine_category,
      machine_model: tplRaw.machine_model,
      is_active: true,
      requires_teacher_approval:
        params.requiresTeacherApproval ?? tplRaw.requires_teacher_approval,
      bed_size_x_mm: params.bedSizeXMm ?? tplRaw.bed_size_x_mm,
      bed_size_y_mm: params.bedSizeYMm ?? tplRaw.bed_size_y_mm,
      bed_size_z_mm: params.bedSizeZMm ?? tplRaw.bed_size_z_mm,
      nozzle_diameter_mm: params.nozzleDiameterMm ?? tplRaw.nozzle_diameter_mm,
      supported_materials:
        params.supportedMaterials ?? tplRaw.supported_materials,
      max_print_time_min: params.maxPrintTimeMin ?? tplRaw.max_print_time_min,
      supports_auto_supports:
        params.supportsAutoSupports ?? tplRaw.supports_auto_supports,
      kerf_mm: params.kerfMm ?? tplRaw.kerf_mm,
      operation_color_map:
        params.operationColorMap ?? tplRaw.operation_color_map,
      min_feature_mm: params.minFeatureMm ?? tplRaw.min_feature_mm,
      rule_overrides: tplRaw.rule_overrides,
      notes: params.notes ?? tplRaw.notes,
    };
  } else {
    // From-scratch path: require machineCategory + bed dimensions.
    const category = validateMachineCategory(params.machineCategory);
    if (isOrchestrationError(category)) return category;

    const bedX = validateBedSize(params.bedSizeXMm, "bedSizeXMm");
    if (isOrchestrationError(bedX)) return bedX;
    const bedY = validateBedSize(params.bedSizeYMm, "bedSizeYMm");
    if (isOrchestrationError(bedY)) return bedY;

    const colorMap = validateOperationColorMap(params.operationColorMap);
    if (isOrchestrationError(colorMap)) return colorMap;

    insertPayload = {
      teacher_id: params.teacherId,
      school_id: null,
      lab_id: params.labId,
      is_system_template: false,
      name,
      machine_category: category,
      machine_model: params.machineModel ?? null,
      is_active: true,
      requires_teacher_approval: params.requiresTeacherApproval ?? false,
      bed_size_x_mm: bedX,
      bed_size_y_mm: bedY,
      bed_size_z_mm: params.bedSizeZMm ?? null,
      nozzle_diameter_mm: params.nozzleDiameterMm ?? null,
      supported_materials: params.supportedMaterials ?? null,
      max_print_time_min: params.maxPrintTimeMin ?? null,
      supports_auto_supports: params.supportsAutoSupports ?? null,
      kerf_mm: params.kerfMm ?? null,
      operation_color_map: colorMap,
      min_feature_mm: params.minFeatureMm ?? null,
      rule_overrides: null,
      notes: params.notes ?? null,
    };
  }

  const insertResult = await db
    .from("machine_profiles")
    .insert(insertPayload)
    .select(FULL_SELECT)
    .single();
  const { data: inserted, error: insertError } = insertResult as {
    data: MachineProfileRawRow | null;
    error: { message: string; code?: string } | null;
  };

  if (insertError) {
    // 23505 = unique name collision (per-teacher or system-template scope).
    if (insertError.code === "23505") {
      return {
        error: {
          status: 409,
          message:
            "You already have a machine with that name. Pick a unique name per teacher.",
        },
      };
    }
    return {
      error: { status: 500, message: `Machine create failed: ${insertError.message}` },
    };
  }
  if (!inserted) {
    return { error: { status: 500, message: "Machine create returned no row." } };
  }

  return { machine: toRow(inserted) };
}

// ============================================================
// listMyMachines
// ============================================================

export interface ListMyMachinesSuccess {
  teacherMachines: MachineProfileRow[];
  systemTemplates: MachineProfileRow[];
}

export type ListMyMachinesResult = ListMyMachinesSuccess | OrchestrationError;

export async function listMyMachines(
  db: SupabaseLike,
  params: { teacherId: string; includeInactive?: boolean }
): Promise<ListMyMachinesResult> {
  const includeInactive = params.includeInactive === true;

  // Teacher-owned machines.
  let teacherQuery = db
    .from("machine_profiles")
    .select(FULL_SELECT)
    .eq("teacher_id", params.teacherId)
    .eq("is_system_template", false);
  if (!includeInactive) {
    teacherQuery = teacherQuery.eq("is_active", true);
  }
  const teacherResult = await teacherQuery.order("name", { ascending: true });
  const { data: teacherData, error: teacherError } = teacherResult as {
    data: MachineProfileRawRow[] | null;
    error: { message: string } | null;
  };
  if (teacherError) {
    return {
      error: {
        status: 500,
        message: `Machine list failed: ${teacherError.message}`,
      },
    };
  }

  // System templates — always visible to every teacher, inactive
  // filter doesn't apply (templates are always active by seed).
  const templateResult = await db
    .from("machine_profiles")
    .select(FULL_SELECT)
    .eq("is_system_template", true)
    .order("name", { ascending: true });
  const { data: templateData, error: templateError } = templateResult as {
    data: MachineProfileRawRow[] | null;
    error: { message: string } | null;
  };
  if (templateError) {
    return {
      error: {
        status: 500,
        message: `Template list failed: ${templateError.message}`,
      },
    };
  }

  return {
    teacherMachines: (teacherData ?? []).map(toRow),
    systemTemplates: (templateData ?? []).map(toRow),
  };
}

// ============================================================
// updateMachineProfile
// ============================================================

/**
 * Fields callers can PATCH. Missing = untouched. Null where the
 * column is nullable = clear. Not exposed: `teacher_id`, `school_id`,
 * `is_system_template`, `is_active` (use soft-delete for the last).
 * Changing lab_id goes through `reassignMachineToLab` in 8-2.
 */
export interface UpdateMachineProfilePatch {
  name?: string;
  machineModel?: string | null;
  bedSizeXMm?: number;
  bedSizeYMm?: number;
  bedSizeZMm?: number | null;
  nozzleDiameterMm?: number | null;
  kerfMm?: number | null;
  minFeatureMm?: number | null;
  requiresTeacherApproval?: boolean;
  operationColorMap?: OperationColorMap | null;
  notes?: string | null;
  supportedMaterials?: unknown;
  supportsAutoSupports?: boolean | null;
  maxPrintTimeMin?: number | null;
}

export interface UpdateMachineProfileRequest extends UpdateMachineProfilePatch {
  teacherId: string;
  machineProfileId: string;
}

export interface UpdateMachineProfileSuccess {
  machine: MachineProfileRow;
}

export type UpdateMachineProfileResult =
  | UpdateMachineProfileSuccess
  | OrchestrationError;

export async function updateMachineProfile(
  db: SupabaseLike,
  params: UpdateMachineProfileRequest
): Promise<UpdateMachineProfileResult> {
  const owned = await loadTeacherOwnedMachine(
    db,
    params.teacherId,
    params.machineProfileId
  );
  if (isOrchestrationError(owned)) return owned;

  const patch: Record<string, unknown> = {};

  if (params.name !== undefined) {
    const name = validateName(params.name);
    if (isOrchestrationError(name)) return name;
    patch.name = name;
  }
  if (params.machineModel !== undefined) patch.machine_model = params.machineModel;
  if (params.bedSizeXMm !== undefined) {
    const v = validateBedSize(params.bedSizeXMm, "bedSizeXMm");
    if (isOrchestrationError(v)) return v;
    patch.bed_size_x_mm = v;
  }
  if (params.bedSizeYMm !== undefined) {
    const v = validateBedSize(params.bedSizeYMm, "bedSizeYMm");
    if (isOrchestrationError(v)) return v;
    patch.bed_size_y_mm = v;
  }
  if (params.bedSizeZMm !== undefined) patch.bed_size_z_mm = params.bedSizeZMm;
  if (params.nozzleDiameterMm !== undefined)
    patch.nozzle_diameter_mm = params.nozzleDiameterMm;
  if (params.kerfMm !== undefined) patch.kerf_mm = params.kerfMm;
  if (params.minFeatureMm !== undefined) patch.min_feature_mm = params.minFeatureMm;
  if (params.requiresTeacherApproval !== undefined)
    patch.requires_teacher_approval = params.requiresTeacherApproval;
  if (params.operationColorMap !== undefined) {
    const validated = validateOperationColorMap(params.operationColorMap);
    if (isOrchestrationError(validated)) return validated;
    patch.operation_color_map = validated;
  }
  if (params.notes !== undefined) patch.notes = params.notes;
  if (params.supportedMaterials !== undefined)
    patch.supported_materials = params.supportedMaterials;
  if (params.supportsAutoSupports !== undefined)
    patch.supports_auto_supports = params.supportsAutoSupports;
  if (params.maxPrintTimeMin !== undefined)
    patch.max_print_time_min = params.maxPrintTimeMin;

  if (Object.keys(patch).length === 0) {
    return {
      error: {
        status: 400,
        message: "No updatable fields supplied.",
      },
    };
  }

  const updateResult = await db
    .from("machine_profiles")
    .update(patch)
    .eq("id", params.machineProfileId)
    .eq("teacher_id", params.teacherId)
    .eq("is_system_template", false) // triple-belt: can't edit templates
    .select(FULL_SELECT)
    .single();
  const { data, error } = updateResult as {
    data: MachineProfileRawRow | null;
    error: { message: string; code?: string } | null;
  };

  if (error) {
    if (error.code === "23505") {
      return {
        error: {
          status: 409,
          message: "Another machine of yours already uses that name.",
        },
      };
    }
    return {
      error: {
        status: 500,
        message: `Machine update failed: ${error.message}`,
      },
    };
  }
  if (!data) {
    return { error: { status: 500, message: "Machine update returned no row." } };
  }

  return { machine: toRow(data) };
}

// ============================================================
// softDeleteMachineProfile
// ============================================================

export interface SoftDeleteMachineRequest {
  teacherId: string;
  machineProfileId: string;
}

export interface SoftDeleteMachineSuccess {
  machineProfileId: string;
  deactivatedAt: string;
}

export type SoftDeleteMachineResult =
  | SoftDeleteMachineSuccess
  | OrchestrationError;

export async function softDeleteMachineProfile(
  db: SupabaseLike,
  params: SoftDeleteMachineRequest
): Promise<SoftDeleteMachineResult> {
  const owned = await loadTeacherOwnedMachine(
    db,
    params.teacherId,
    params.machineProfileId
  );
  if (isOrchestrationError(owned)) return owned;

  // Active-jobs guard. Anything not in {completed, rejected, cancelled}
  // is still in flight and would be broken by the machine disappearing.
  const activeQuery = await db
    .from("fabrication_jobs")
    .select("id, status")
    .eq("machine_profile_id", params.machineProfileId)
    .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`);
  const { data: activeJobs, error: activeError } = activeQuery as {
    data: Array<{ id: string; status: string }> | null;
    error: { message: string } | null;
  };
  if (activeError) {
    return {
      error: {
        status: 500,
        message: `Active-jobs check failed: ${activeError.message}`,
      },
    };
  }

  const activeCount = activeJobs?.length ?? 0;
  if (activeCount > 0) {
    return {
      error: {
        status: 409,
        message: `Machine has ${activeCount} active job${
          activeCount === 1 ? "" : "s"
        } in flight. Wait for them to complete or ask the fabricator to fail them first.`,
      },
    };
  }

  // Soft-delete: is_active = false. Preserves historical FK references
  // from completed jobs.
  const updateResult = await db
    .from("machine_profiles")
    .update({ is_active: false })
    .eq("id", params.machineProfileId)
    .eq("teacher_id", params.teacherId)
    .eq("is_system_template", false);
  const { error: updateError } = updateResult as {
    error: { message: string } | null;
  };

  if (updateError) {
    return {
      error: {
        status: 500,
        message: `Machine soft-delete failed: ${updateError.message}`,
      },
    };
  }

  return {
    machineProfileId: params.machineProfileId,
    deactivatedAt: new Date().toISOString(),
  };
}

// ============================================================
// bulkSetApprovalForLab
// ============================================================

/**
 * The "lab-level approval toggle" Matt asked for during 8-2 pre-flight.
 * One endpoint, two operations:
 *   - requireApproval: true  → UPDATE every teacher-owned active
 *                              machine in the lab to require approval
 *   - requireApproval: false → same but to skip approval
 *
 * No denormalized `auto_approves_all` column on fabrication_labs —
 * this endpoint does the bulk UPDATE directly so the truth stays in
 * machine_profiles (single source of truth, no sync risk).
 *
 * Teachers can still per-machine override afterward; the lab-level
 * toggle is a shortcut, not a permanent override.
 */
export interface BulkSetApprovalRequest {
  teacherId: string;
  labId: string;
  requireApproval: boolean;
}

export interface BulkSetApprovalSuccess {
  labId: string;
  updatedMachineCount: number;
  requireApproval: boolean;
}

export type BulkSetApprovalResult =
  | BulkSetApprovalSuccess
  | OrchestrationError;

export async function bulkSetApprovalForLab(
  db: SupabaseLike,
  params: BulkSetApprovalRequest
): Promise<BulkSetApprovalResult> {
  if (typeof params.requireApproval !== "boolean") {
    return {
      error: {
        status: 400,
        message: "`requireApproval` must be a boolean.",
      },
    };
  }

  // Ownership check on the lab first.
  const labResult = await db
    .from("fabrication_labs")
    .select("id, teacher_id")
    .eq("id", params.labId)
    .maybeSingle();
  const { data: labRow, error: labError } = labResult as {
    data: { id: string; teacher_id: string } | null;
    error: { message: string } | null;
  };
  if (labError) {
    return {
      error: {
        status: 500,
        message: `Lab lookup failed: ${labError.message}`,
      },
    };
  }
  if (!labRow || labRow.teacher_id !== params.teacherId) {
    return { error: { status: 404, message: "Lab not found." } };
  }

  // Count machines first — we return the count in the response so the
  // UI can show "updated 3 machines". Scope to teacher + non-template
  // + active (skip already-deactivated ones).
  const machinesResult = await db
    .from("machine_profiles")
    .select("id")
    .eq("lab_id", params.labId)
    .eq("teacher_id", params.teacherId)
    .eq("is_system_template", false)
    .eq("is_active", true);
  const { data: machines, error: machinesError } = machinesResult as {
    data: Array<{ id: string }> | null;
    error: { message: string } | null;
  };
  if (machinesError) {
    return {
      error: {
        status: 500,
        message: `Machine count failed: ${machinesError.message}`,
      },
    };
  }

  const count = machines?.length ?? 0;
  if (count === 0) {
    return {
      labId: params.labId,
      updatedMachineCount: 0,
      requireApproval: params.requireApproval,
    };
  }

  // Bulk update.
  const updateResult = await db
    .from("machine_profiles")
    .update({ requires_teacher_approval: params.requireApproval })
    .eq("lab_id", params.labId)
    .eq("teacher_id", params.teacherId)
    .eq("is_system_template", false)
    .eq("is_active", true);
  const { error: updateError } = updateResult as {
    error: { message: string } | null;
  };

  if (updateError) {
    return {
      error: {
        status: 500,
        message: `Bulk approval update failed: ${updateError.message}`,
      },
    };
  }

  return {
    labId: params.labId,
    updatedMachineCount: count,
    requireApproval: params.requireApproval,
  };
}
