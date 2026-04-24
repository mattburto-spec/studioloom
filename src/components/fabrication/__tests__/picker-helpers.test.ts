import { describe, it, expect } from "vitest";
import {
  filterMachinesForClass,
  type ClassOption,
  type MachineProfileOption,
} from "../picker-helpers";

/**
 * Phase 8-5 student picker filter tests. Verifies the
 * `filterMachinesForClass` helper handles all 4 states:
 *   - No class selected → return all machines
 *   - Class with default_lab_id=null → return all (legacy fallback)
 *   - Class with default_lab_id set → narrow to lab match + system templates
 *     + any null-lab machines (safety net)
 *   - Soft-deleted machines → already filtered server-side, don't appear
 */

const M = (
  overrides: Partial<MachineProfileOption> & { id: string }
): MachineProfileOption => ({
  id: overrides.id,
  name: overrides.name ?? "M-" + overrides.id,
  machine_category: overrides.machine_category ?? "3d_printer",
  bed_size_x_mm: 200,
  bed_size_y_mm: 200,
  is_system_template: overrides.is_system_template ?? false,
  lab_id: overrides.lab_id,
});

const C = (id: string, default_lab_id: string | null): ClassOption => ({
  id,
  name: "Class " + id,
  code: id,
  default_lab_id,
});

describe("filterMachinesForClass", () => {
  it("returns all machines when no class selected", () => {
    const machines = [
      M({ id: "m1", lab_id: "lab-a" }),
      M({ id: "m2", lab_id: "lab-b" }),
    ];
    expect(filterMachinesForClass(machines, null)).toEqual(machines);
    expect(filterMachinesForClass(machines, undefined)).toEqual(machines);
  });

  it("returns all machines when class has null default_lab_id (legacy)", () => {
    const machines = [
      M({ id: "m1", lab_id: "lab-a" }),
      M({ id: "m2", lab_id: "lab-b" }),
    ];
    const result = filterMachinesForClass(machines, C("c1", null));
    expect(result).toEqual(machines);
  });

  it("filters to machines matching the class's lab_id", () => {
    const machines = [
      M({ id: "m1", lab_id: "lab-a", name: "Keep" }),
      M({ id: "m2", lab_id: "lab-b", name: "Drop" }),
      M({ id: "m3", lab_id: "lab-a", name: "Keep2" }),
    ];
    const result = filterMachinesForClass(machines, C("c1", "lab-a"));
    expect(result.map((m) => m.id)).toEqual(["m1", "m3"]);
  });

  it("keeps system templates regardless of lab (copy-from-template path)", () => {
    const machines = [
      M({ id: "tpl-1", lab_id: null, is_system_template: true }),
      M({ id: "m1", lab_id: "lab-b", name: "Drop" }),
      M({ id: "m2", lab_id: "lab-a", name: "Keep" }),
    ];
    const result = filterMachinesForClass(machines, C("c1", "lab-a"));
    expect(result.map((m) => m.id).sort()).toEqual(["m2", "tpl-1"]);
  });

  it("keeps null-lab machines as a safety net (post-backfill edge case)", () => {
    const machines = [
      M({ id: "m1", lab_id: null, name: "Orphan" }),
      M({ id: "m2", lab_id: "lab-a", name: "Normal" }),
      M({ id: "m3", lab_id: "lab-b", name: "Drop" }),
    ];
    const result = filterMachinesForClass(machines, C("c1", "lab-a"));
    expect(result.map((m) => m.id).sort()).toEqual(["m1", "m2"]);
  });

  it("handles the empty-machines case cleanly", () => {
    expect(filterMachinesForClass([], C("c1", "lab-a"))).toEqual([]);
  });
});
