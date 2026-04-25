import { describe, it, expect } from "vitest";
import {
  filterMachinesForClass,
  groupMachinesByLab,
  type ClassOption,
  type MachineProfileOption,
} from "../picker-helpers";

/**
 * Phase 8.1d-5 picker tests.
 *
 * filterMachinesForClass: deprecated in 8.1d-5 (class-to-lab filter
 * dropped per Matt's UX call). Function is a no-op pass-through now;
 * we keep one identity test to lock the contract.
 *
 * groupMachinesByLab: replacement for the old filter — buckets
 * machines by lab_name for the picker's <optgroup> rendering.
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
  lab_name: overrides.lab_name,
});

const C = (id: string, default_lab_id: string | null): ClassOption => ({
  id,
  name: "Class " + id,
  code: id,
  default_lab_id,
});

describe("filterMachinesForClass (deprecated, no-op)", () => {
  it("returns the input list unchanged regardless of class", () => {
    const machines = [
      M({ id: "m1", lab_id: "lab-a" }),
      M({ id: "m2", lab_id: "lab-b" }),
    ];
    expect(filterMachinesForClass(machines, null)).toEqual(machines);
    expect(filterMachinesForClass(machines, undefined)).toEqual(machines);
    expect(filterMachinesForClass(machines, C("c1", "lab-a"))).toEqual(machines);
    expect(filterMachinesForClass(machines, C("c1", null))).toEqual(machines);
  });
});

describe("groupMachinesByLab", () => {
  it("buckets machines by lab_name and sorts groups alpha", () => {
    const groups = groupMachinesByLab([
      M({ id: "m1", lab_id: "lab-z", lab_name: "Z lab", name: "Z1" }),
      M({ id: "m2", lab_id: "lab-a", lab_name: "A lab", name: "A1" }),
      M({ id: "m3", lab_id: "lab-z", lab_name: "Z lab", name: "Z2" }),
      M({ id: "m4", lab_id: "lab-a", lab_name: "A lab", name: "A2" }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["A lab", "Z lab"]);
    expect(groups[0].machines.map((m) => m.name)).toEqual(["A1", "A2"]);
    expect(groups[1].machines.map((m) => m.name)).toEqual(["Z1", "Z2"]);
  });

  it("synthesises an Unassigned bucket for null-lab machines", () => {
    const groups = groupMachinesByLab([
      M({ id: "m1", lab_id: "lab-a", lab_name: "A lab" }),
      M({ id: "m2", lab_id: null, name: "Orphan" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("A lab");
    expect(groups[1].label).toBe("Unassigned");
    expect(groups[1].machines.map((m) => m.name)).toEqual(["Orphan"]);
  });

  it("places system templates in Unassigned (cross-tenant — they have no lab)", () => {
    const groups = groupMachinesByLab([
      M({
        id: "tpl-1",
        is_system_template: true,
        lab_id: null,
        name: "Template",
      }),
      M({ id: "m1", lab_id: "lab-a", lab_name: "A lab" }),
    ]);
    expect(groups[1].label).toBe("Unassigned");
    expect(groups[1].machines[0].is_system_template).toBe(true);
  });

  it("returns single group when all machines share a lab", () => {
    const groups = groupMachinesByLab([
      M({ id: "m1", lab_id: "lab-a", lab_name: "Default lab" }),
      M({ id: "m2", lab_id: "lab-a", lab_name: "Default lab" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Default lab");
  });

  it("omits Unassigned bucket when no orphans exist", () => {
    const groups = groupMachinesByLab([
      M({ id: "m1", lab_id: "lab-a", lab_name: "A lab" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("A lab");
  });

  it("returns empty array for empty input", () => {
    expect(groupMachinesByLab([])).toEqual([]);
  });

  it("treats lab_name=null as Unassigned even with lab_id set (defensive)", () => {
    // Edge case: lab_id is set but lab_name failed to nest in PostgREST.
    // Group as Unassigned rather than dropping or crashing.
    const groups = groupMachinesByLab([
      M({ id: "m1", lab_id: "lab-x", lab_name: null, name: "Stale" }),
    ]);
    expect(groups[0].label).toBe("Unassigned");
  });
});
