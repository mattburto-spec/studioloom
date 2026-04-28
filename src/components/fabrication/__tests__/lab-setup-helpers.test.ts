import { describe, it, expect } from "vitest";
import {
  groupMachinesByLab,
  labAutoApproveState,
  operationLabel,
  normaliseHex,
  colorMapToRows,
  rowsToColorMap,
  validateColorMapRows,
  type LabWithMachines,
} from "../lab-setup-helpers";
import type { LabListRow } from "@/lib/fabrication/lab-orchestration";
import type { MachineProfileRow } from "@/lib/fabrication/machine-orchestration";

/**
 * Phase 8-4 lab-setup pure-helper tests. Covers the state-shaping +
 * validation logic that drives the UI. Component-level tests are
 * light per parent brief §3.4 — most of the risk is in these helpers.
 */

// ============================================================
// Fixture helpers
// ============================================================

function lab(id: string, name: string): LabListRow {
  // Phase 8-2 (revised 28 Apr): school-scoped LabRow shape
  // (no teacher_id, no is_default — defaults live per-class).
  return {
    id,
    schoolId: "s1",
    createdByTeacherId: "t1",
    name,
    description: null,
    createdAt: "2026-04-25T00:00:00Z",
    updatedAt: "2026-04-25T00:00:00Z",
    machineCount: 0,
  };
}

function machine(
  overrides: Partial<MachineProfileRow> & { id: string; labId: string | null }
): MachineProfileRow {
  return {
    id: overrides.id,
    teacherId: "t1",
    schoolId: null,
    labId: overrides.labId,
    isSystemTemplate: false,
    name: overrides.name ?? "Machine " + overrides.id,
    machineCategory: overrides.machineCategory ?? "3d_printer",
    machineModel: null,
    isActive: true,
    requiresTeacherApproval: overrides.requiresTeacherApproval ?? false,
    bedSizeXMm: 256,
    bedSizeYMm: 256,
    bedSizeZMm: null,
    nozzleDiameterMm: null,
    supportedMaterials: null,
    maxPrintTimeMin: null,
    supportsAutoSupports: null,
    kerfMm: null,
    operationColorMap: null,
    minFeatureMm: null,
    ruleOverrides: null,
    notes: null,
    createdAt: "2026-04-25T00:00:00Z",
    updatedAt: "2026-04-25T00:00:00Z",
  };
}

// ============================================================
// groupMachinesByLab
// ============================================================

describe("groupMachinesByLab", () => {
  it("returns labs in incoming order with machines bucketed + sorted alpha", () => {
    const labs = [
      lab("l1", "Default lab"),
      lab("l2", "2nd floor"),
    ];
    const machines = [
      machine({ id: "m1", labId: "l2", name: "Zebra" }),
      machine({ id: "m2", labId: "l1", name: "Apple" }),
      machine({ id: "m3", labId: "l2", name: "Avocado" }),
    ];
    const grouped = groupMachinesByLab(labs, machines);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].lab.id).toBe("l1");
    expect(grouped[0].machines.map((m) => m.name)).toEqual(["Apple"]);
    expect(grouped[1].lab.id).toBe("l2");
    expect(grouped[1].machines.map((m) => m.name)).toEqual(["Avocado", "Zebra"]);
  });

  it("includes labs with no machines (empty grid)", () => {
    const grouped = groupMachinesByLab([lab("l1", "Empty lab")], []);
    expect(grouped[0].machines).toEqual([]);
  });

  it("synthesises an 'Unassigned machines' bucket for null-lab machines", () => {
    const grouped = groupMachinesByLab(
      [lab("l1", "Only lab")],
      [
        machine({ id: "m1", labId: null, name: "Orphan" }),
        machine({ id: "m2", labId: "l1", name: "Normal" }),
      ]
    );
    expect(grouped).toHaveLength(2);
    const unassigned = grouped[1];
    expect(unassigned.lab.id).toBe("__unassigned__");
    expect(unassigned.machines).toHaveLength(1);
    expect(unassigned.machines[0].name).toBe("Orphan");
  });

  it("omits the unassigned bucket when no orphan machines", () => {
    const grouped = groupMachinesByLab(
      [lab("l1", "Only lab")],
      [machine({ id: "m1", labId: "l1" })]
    );
    expect(grouped).toHaveLength(1);
    expect(grouped[0].lab.id).toBe("l1");
  });

  it("case-insensitive sort preserves casing", () => {
    const grouped = groupMachinesByLab(
      [lab("l1", "Only")],
      [
        machine({ id: "m1", labId: "l1", name: "bambu" }),
        machine({ id: "m2", labId: "l1", name: "Apple" }),
      ]
    );
    expect(grouped[0].machines.map((m) => m.name)).toEqual(["Apple", "bambu"]);
  });
});

// ============================================================
// labAutoApproveState
// ============================================================

describe("labAutoApproveState", () => {
  it("returns 'empty' for no machines", () => {
    expect(labAutoApproveState([])).toBe("empty");
  });

  it("returns 'all' when every machine auto-approves", () => {
    expect(
      labAutoApproveState([
        machine({ id: "m1", labId: "l1", requiresTeacherApproval: false }),
        machine({ id: "m2", labId: "l1", requiresTeacherApproval: false }),
      ])
    ).toBe("all");
  });

  it("returns 'none' when every machine requires approval", () => {
    expect(
      labAutoApproveState([
        machine({ id: "m1", labId: "l1", requiresTeacherApproval: true }),
        machine({ id: "m2", labId: "l1", requiresTeacherApproval: true }),
      ])
    ).toBe("none");
  });

  it("returns 'mixed' for a split", () => {
    expect(
      labAutoApproveState([
        machine({ id: "m1", labId: "l1", requiresTeacherApproval: false }),
        machine({ id: "m2", labId: "l1", requiresTeacherApproval: true }),
      ])
    ).toBe("mixed");
  });
});

// ============================================================
// operationLabel + normaliseHex
// ============================================================

describe("operationLabel", () => {
  it("returns sentence-case for each operation", () => {
    expect(operationLabel("cut")).toBe("Cut");
    expect(operationLabel("score")).toBe("Score");
    expect(operationLabel("engrave")).toBe("Engrave");
  });
});

describe("normaliseHex", () => {
  it("upper-cases valid hex", () => {
    expect(normaliseHex("#ff0000")).toBe("#FF0000");
    expect(normaliseHex("  #abcdef ")).toBe("#ABCDEF");
  });

  it("returns null for invalid hex", () => {
    expect(normaliseHex("red")).toBeNull();
    expect(normaliseHex("#FF")).toBeNull();
    expect(normaliseHex("FF0000")).toBeNull(); // missing #
    expect(normaliseHex("#GG0000")).toBeNull();
    expect(normaliseHex("")).toBeNull();
  });
});

// ============================================================
// colorMapToRows + rowsToColorMap (round-trip)
// ============================================================

describe("colorMapToRows + rowsToColorMap", () => {
  it("round-trips a full map", () => {
    const map = {
      "#FF0000": "cut" as const,
      "#0000FF": "score" as const,
      "#000000": "engrave" as const,
    };
    const rows = colorMapToRows(map);
    expect(rows).toHaveLength(3);
    const roundTripped = rowsToColorMap(rows);
    expect(roundTripped).toEqual(map);
  });

  it("returns empty array for null", () => {
    expect(colorMapToRows(null)).toEqual([]);
  });

  it("rowsToColorMap drops invalid hex rows", () => {
    const rows = [
      { hex: "#FF0000", operation: "cut" as const },
      { hex: "not-a-colour", operation: "score" as const },
      { hex: "#0000FF", operation: "engrave" as const },
    ];
    const out = rowsToColorMap(rows);
    expect(Object.keys(out)).toHaveLength(2);
    expect(out["#FF0000"]).toBe("cut");
    expect(out["#0000FF"]).toBe("engrave");
  });

  it("rowsToColorMap: last write wins on duplicate hex", () => {
    const rows = [
      { hex: "#FF0000", operation: "cut" as const },
      { hex: "#FF0000", operation: "score" as const },
    ];
    const out = rowsToColorMap(rows);
    expect(out["#FF0000"]).toBe("score");
  });

  it("normalises hex during row→map conversion", () => {
    const rows = [{ hex: "#ff00aa", operation: "cut" as const }];
    expect(rowsToColorMap(rows)).toEqual({ "#FF00AA": "cut" });
  });
});

// ============================================================
// validateColorMapRows
// ============================================================

describe("validateColorMapRows", () => {
  it("returns no errors for a clean map", () => {
    expect(
      validateColorMapRows([
        { hex: "#FF0000", operation: "cut" },
        { hex: "#0000FF", operation: "score" },
      ])
    ).toEqual([]);
  });

  it("flags invalid hex with a row-numbered message", () => {
    const errors = validateColorMapRows([
      { hex: "#FF0000", operation: "cut" },
      { hex: "red", operation: "score" },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Row 2/);
    expect(errors[0]).toMatch(/valid hex/i);
  });

  it("flags duplicate hex with both row numbers", () => {
    const errors = validateColorMapRows([
      { hex: "#FF0000", operation: "cut" },
      { hex: "#ff0000", operation: "score" },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Rows 1 \+ 2/);
    expect(errors[0]).toMatch(/#FF0000/);
  });

  it("ignores blank hex rows (caller decides if empty map OK)", () => {
    expect(
      validateColorMapRows([
        { hex: "", operation: "cut" },
        { hex: "   ", operation: "score" },
      ])
    ).toEqual([]);
  });
});
