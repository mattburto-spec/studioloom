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
}

export interface ClassOption {
  id: string;
  name: string;
  code: string;
}

export function formatMachineLabel(p: MachineProfileOption): string {
  const category = p.machine_category === "laser_cutter" ? "Laser" : "3D Printer";
  const bed = `${p.bed_size_x_mm}×${p.bed_size_y_mm}mm`;
  return `${p.name} — ${category}, ${bed}`;
}
