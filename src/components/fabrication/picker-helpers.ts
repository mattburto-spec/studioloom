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
  lab_id?: string | null;
  /** Phase 8.1d-5: lab name for the group-by-lab picker. Null when
   *  the machine has no lab (system templates + orphans). */
  lab_name?: string | null;
}

export interface ClassOption {
  id: string;
  name: string;
  code: string;
  /** Phase 8-5 → 8.1d-5 deprecation: drove the silent class-to-lab
   *  filter. Phase 8.1d-5 dropped that filter (Matt's UX call: just
   *  show all machines grouped by lab name; class-to-lab assignment
   *  was teacher overhead with no clear benefit at NIS scale). The
   *  field stays on the schema + still ships in the API response for
   *  backwards-compat, but no UI consumer reads it as of 8.1d-5. */
  default_lab_id?: string | null;
}

/**
 * Phase 8.1d-5: group machines by lab name for the picker dropdown.
 * Returns an array of groups, each with a label + the machines in
 * that group. Sort order:
 *   1. Real labs first, sorted by name
 *   2. "Unassigned" group at the end (machines without a lab — orphans
 *      from Phase 8 cascade or user-created without a lab)
 *   3. System templates kept in "Unassigned" since they're cross-tenant
 *
 * Single-lab schools collapse to one group, which the picker can
 * render as a flat list (no group header needed).
 *
 * Replaces filterMachinesForClass — see header note.
 */
export interface MachineGroup {
  label: string; // "2nd Floor Design Lab", "Unassigned", etc.
  machines: MachineProfileOption[];
}

export function groupMachinesByLab(
  machines: MachineProfileOption[]
): MachineGroup[] {
  const byLab = new Map<string, MachineGroup>();
  const unassigned: MachineProfileOption[] = [];

  for (const m of machines) {
    if (!m.lab_id || !m.lab_name) {
      unassigned.push(m);
      continue;
    }
    const existing = byLab.get(m.lab_id);
    if (existing) {
      existing.machines.push(m);
    } else {
      byLab.set(m.lab_id, { label: m.lab_name, machines: [m] });
    }
  }

  // Sort lab groups alpha by name (case-insensitive).
  const labGroups = Array.from(byLab.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );

  // Append unassigned bucket at the end if non-empty.
  const result: MachineGroup[] = [...labGroups];
  if (unassigned.length > 0) {
    result.push({ label: "Unassigned", machines: unassigned });
  }
  return result;
}

/**
 * @deprecated Phase 8.1d-5: class-to-lab filtering removed. Use
 * groupMachinesByLab in the picker instead. Kept as a no-op for any
 * stale imports — returns the input list unchanged.
 */
export function filterMachinesForClass(
  machines: MachineProfileOption[],
  _selectedClass: ClassOption | null | undefined
): MachineProfileOption[] {
  return machines;
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
