/**
 * Pure helpers for the ClassMachinePicker component. Separated from
 * ClassMachinePicker.tsx so the vitest test file can import these
 * without pulling in the JSX surface (the project has no JSX-aware
 * test transformer — existing `.test.tsx` files avoid component
 * imports for the same reason).
 */

export interface MachineProfileOption {
  id: string;
  name: string;
  machine_category: string;
  bed_size_x_mm: number;
  bed_size_y_mm: number;
  nozzle_diameter_mm?: number | null;
  kerf_mm?: number | null;
  is_system_template?: boolean;
  /** Phase 8-5: lab_id used by the client-side filter. Machines with
   *  lab_id = class.default_lab_id are shown; system templates and
   *  any null-lab machines stay visible as a legacy fallback. */
  lab_id?: string | null;
}

export interface ClassOption {
  id: string;
  name: string;
  code: string;
  /** Phase 8-5: drives the silent machine-picker filter. Null = show
   *  all teacher-owned machines (legacy behaviour for any class the
   *  8-1 backfill somehow missed). */
  default_lab_id?: string | null;
}

/**
 * Phase 8-5: filter machines by a class's default_lab_id. When the
 * class has no default_lab_id (legacy/null state), returns all
 * machines unfiltered. System templates always stay visible to
 * preserve the "add machine from template" path at teacher-admin
 * time — though students picking a system-template machine is
 * unusual post-8-3 (teachers usually copy templates to owned rows).
 */
export function filterMachinesForClass(
  machines: MachineProfileOption[],
  selectedClass: ClassOption | null | undefined
): MachineProfileOption[] {
  if (!selectedClass || !selectedClass.default_lab_id) {
    return machines;
  }
  const targetLab = selectedClass.default_lab_id;
  return machines.filter((m) => {
    // Keep system templates (teachers copy these before use; edge case)
    if (m.is_system_template) return true;
    // Keep machines in the class's default lab
    if (m.lab_id === targetLab) return true;
    // Keep orphan-lab machines as a safety net (shouldn't exist
    // post-backfill but defensive)
    if (m.lab_id === null || m.lab_id === undefined) return true;
    return false;
  });
}

export function formatMachineLabel(p: MachineProfileOption): string {
  const category = p.machine_category === "laser_cutter" ? "Laser" : "3D Printer";
  const bed = `${p.bed_size_x_mm}×${p.bed_size_y_mm}mm`;
  return `${p.name} — ${category}, ${bed}`;
}

// ============================================================
// Phase 4-4 — file picker helpers
// ============================================================

export type FabricationFileType = "stl" | "svg";
export const MAX_UPLOAD_SIZE_BYTES_CLIENT = 50 * 1024 * 1024; // 50 MB

/**
 * Derive fileType from a filename's extension. Returns null if the
 * extension isn't one we accept — the caller turns that into a user-
 * facing rejection message.
 */
export function detectFileType(filename: string): FabricationFileType | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "stl") return "stl";
  if (ext === "svg") return "svg";
  return null;
}

export interface ValidationOk {
  ok: true;
  fileType: FabricationFileType;
}
export interface ValidationError {
  ok: false;
  error: string;
}

/**
 * Client-side validator: extension → fileType + size cap. Mirrors the
 * server-side validateUploadRequest gate but runs before the network
 * call so the user gets instant feedback. Matches the Free Plan 50 MB
 * ceiling (Supabase dashboard-verified 22 Apr 2026).
 */
export function validateUploadFile(file: {
  name: string;
  size: number;
}): ValidationOk | ValidationError {
  if (!file.name || file.size <= 0) {
    return { ok: false, error: "File is empty or unnamed" };
  }
  const fileType = detectFileType(file.name);
  if (!fileType) {
    return {
      ok: false,
      error: "Only .stl and .svg files are supported",
    };
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES_CLIENT) {
    const mbLimit = MAX_UPLOAD_SIZE_BYTES_CLIENT / 1024 / 1024;
    const mbActual = (file.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      error: `File is ${mbActual} MB — the maximum is ${mbLimit} MB. Try exporting at lower resolution or splitting the model.`,
    };
  }
  return { ok: true, fileType };
}

/**
 * Human-readable file size formatter. Used by FileDropzone + progress UI.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
