import { describe, it, expect } from "vitest";
import {
  createMachineProfile,
  listMyMachines,
  updateMachineProfile,
  softDeleteMachineProfile,
  bulkSetApprovalForLab,
  isOrchestrationError,
} from "../machine-orchestration";

/**
 * Phase 8-3 machine-orchestration unit tests. Pure logic — Supabase
 * client faked as a query-builder chain matching lab-orchestration.test.ts.
 *
 * Coverage goals per Phase 8-3 brief:
 *   - createMachineProfile: from-scratch (validation + happy), from-template
 *     (inherits spec + overrides), lab ownership 404, 23505 duplicate name 409
 *   - listMyMachines: teacher-owned + system templates returned separately
 *   - updateMachineProfile: happy patch, cross-teacher 404, template 404,
 *     empty-patch 400, invalid color-map 400, 23505 dup name 409
 *   - softDeleteMachineProfile: happy (no active jobs), 409 when active
 *     jobs exist, 404 cross-teacher + template
 *   - bulkSetApprovalForLab: happy bulk-on + bulk-off, empty-lab zero count,
 *     404 for not-owned lab, 400 for non-boolean requireApproval
 */

// ============================================================
// Shared fake
// ============================================================

interface FakeOpts {
  /** Responses from `fabrication_labs.maybeSingle()` (ownership check). */
  labRows?: Array<{ id: string; teacher_id: string } | null>;
  /** Response from `machine_profiles.maybeSingle()` (ownership or template). */
  machineLookupRows?: Array<Record<string, unknown> | null>;
  /** INSERT into machine_profiles → select().single() returns this. */
  insertRow?: Record<string, unknown> | null;
  insertError?: { message: string; code?: string };
  /** UPDATE ... .select().single() on machine_profiles for updateMachineProfile. */
  updatedRow?: Record<string, unknown> | null;
  updateError?: { message: string; code?: string };
  /** Terminal/active jobs lookup for soft-delete. */
  activeJobs?: Array<{ id: string; status: string }>;
  activeJobsError?: { message: string };
  /** Machines-in-lab listing for bulk + list. */
  machinesInLab?: Array<{ id: string }>;
  machinesInLabError?: { message: string };
  /** For listMyMachines. */
  teacherMachines?: Array<Record<string, unknown>>;
  systemTemplates?: Array<Record<string, unknown>>;
  listTeacherError?: { message: string };
  listTemplatesError?: { message: string };
}

function fullRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "m-1",
    teacher_id: "teacher-1",
    school_id: null,
    lab_id: "lab-1",
    is_system_template: false,
    name: "Bambu X1C",
    machine_category: "3d_printer",
    machine_model: "X1 Carbon",
    is_active: true,
    requires_teacher_approval: false,
    bed_size_x_mm: 256,
    bed_size_y_mm: 256,
    bed_size_z_mm: 256,
    nozzle_diameter_mm: 0.4,
    supported_materials: null,
    max_print_time_min: null,
    supports_auto_supports: true,
    kerf_mm: null,
    operation_color_map: null,
    min_feature_mm: null,
    rule_overrides: null,
    notes: null,
    created_at: "2026-04-25T00:00:00Z",
    updated_at: "2026-04-25T00:00:00Z",
    ...overrides,
  };
}

function makeFakeClient(opts: FakeOpts = {}) {
  const log: Array<{
    table: string;
    op: string;
    eq: Array<[string, unknown]>;
    payload?: Record<string, unknown>;
  }> = [];
  let labMaybeSingleCalls = 0;
  let machineMaybeSingleCalls = 0;
  let teacherListCalls = 0; // 0 = teacher list, 1 = template list

  const tableHandler = (table: string) => {
    const entry: {
      table: string;
      op: string;
      eq: Array<[string, unknown]>;
      payload?: Record<string, unknown>;
    } = { table, op: "select", eq: [] };

    let isListQuery = false;

    const chain: Record<string, unknown> = {};
    chain.select = (_cols: string) => {
      isListQuery = true;
      return chain;
    };
    chain.eq = (col: string, val: unknown) => {
      entry.eq.push([col, val]);
      return chain;
    };
    chain.not = (col: string, op: string, val: unknown) => {
      entry.eq.push([`not-${op}:${col}`, val]);
      return chain;
    };
    chain.order = () => chain;
    chain.maybeSingle = async () => {
      log.push({ ...entry });
      if (table === "fabrication_labs") {
        const idx = labMaybeSingleCalls++;
        return { data: opts.labRows?.[idx] ?? null, error: null };
      }
      if (table === "machine_profiles") {
        const idx = machineMaybeSingleCalls++;
        return { data: opts.machineLookupRows?.[idx] ?? null, error: null };
      }
      return { data: null, error: null };
    };
    chain.then = (resolve: (v: unknown) => unknown) => {
      log.push({ ...entry });
      if (!isListQuery) {
        return Promise.resolve(resolve({ data: null, error: null }));
      }
      if (table === "machine_profiles") {
        // Disambiguate: is this the listMyMachines-teacher query,
        // list-templates query, machines-in-lab count, or active-jobs lookup?
        const hasTeacherEq = entry.eq.some(([c]) => c === "teacher_id");
        const hasTemplateTrueEq = entry.eq.some(
          ([c, v]) => c === "is_system_template" && v === true
        );
        const hasLabEq = entry.eq.some(([c]) => c === "lab_id");

        if (hasLabEq && !hasTemplateTrueEq) {
          if (opts.machinesInLabError) {
            return Promise.resolve(
              resolve({ data: null, error: opts.machinesInLabError })
            );
          }
          return Promise.resolve(
            resolve({ data: opts.machinesInLab ?? [], error: null })
          );
        }
        if (hasTemplateTrueEq) {
          if (opts.listTemplatesError) {
            return Promise.resolve(
              resolve({ data: null, error: opts.listTemplatesError })
            );
          }
          return Promise.resolve(
            resolve({ data: opts.systemTemplates ?? [], error: null })
          );
        }
        if (hasTeacherEq) {
          teacherListCalls++;
          if (opts.listTeacherError) {
            return Promise.resolve(
              resolve({ data: null, error: opts.listTeacherError })
            );
          }
          return Promise.resolve(
            resolve({ data: opts.teacherMachines ?? [], error: null })
          );
        }
      }
      if (table === "fabrication_jobs") {
        if (opts.activeJobsError) {
          return Promise.resolve(
            resolve({ data: null, error: opts.activeJobsError })
          );
        }
        return Promise.resolve(
          resolve({ data: opts.activeJobs ?? [], error: null })
        );
      }
      return Promise.resolve(resolve({ data: null, error: null }));
    };
    chain.insert = (payload: Record<string, unknown>) => {
      entry.op = "insert";
      entry.payload = payload;
      const insChain: Record<string, unknown> = {};
      insChain.select = () => insChain;
      insChain.single = async () => {
        log.push({ ...entry });
        if (opts.insertError) return { data: null, error: opts.insertError };
        return { data: opts.insertRow ?? null, error: null };
      };
      return insChain;
    };
    chain.update = (payload: Record<string, unknown>) => {
      entry.op = "update";
      entry.payload = payload;
      const updChain: Record<string, unknown> = {};
      updChain.eq = (col: string, val: unknown) => {
        entry.eq.push([col, val]);
        return updChain;
      };
      updChain.select = () => updChain;
      updChain.single = async () => {
        log.push({ ...entry });
        if (opts.updateError) return { data: null, error: opts.updateError };
        return { data: opts.updatedRow ?? null, error: null };
      };
      updChain.then = (resolve: (v: unknown) => unknown) => {
        log.push({ ...entry });
        if (opts.updateError) {
          return Promise.resolve(resolve({ error: opts.updateError }));
        }
        return Promise.resolve(resolve({ error: null }));
      };
      return updChain;
    };

    void teacherListCalls;
    return chain;
  };

  return {
    from: (table: string) => tableHandler(table),
    _log: log,
  };
}

const T1 = "teacher-1";
const T2 = "teacher-2";
const LAB1 = "lab-1";
const LAB2 = "lab-2";
const M1 = "machine-1";
const TPL1 = "template-1";

// ============================================================
// createMachineProfile
// ============================================================

describe("createMachineProfile", () => {
  it("rejects empty name with 400", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
    });
    const result = await createMachineProfile(fake as never, {
      teacherId: T1,
      labId: LAB1,
      name: "",
      machineCategory: "3d_printer",
      bedSizeXMm: 200,
      bedSizeYMm: 200,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
  });

  it("404s when labId does not belong to teacher", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T2 }],
    });
    const result = await createMachineProfile(fake as never, {
      teacherId: T1,
      labId: LAB1,
      name: "x",
      machineCategory: "3d_printer",
      bedSizeXMm: 200,
      bedSizeYMm: 200,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(404);
  });

  it("creates from scratch with a valid payload", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
      insertRow: fullRow({ id: "new-m", name: "Prusa MK3", lab_id: LAB1 }),
    });
    const result = await createMachineProfile(fake as never, {
      teacherId: T1,
      labId: LAB1,
      name: "Prusa MK3",
      machineCategory: "3d_printer",
      bedSizeXMm: 250,
      bedSizeYMm: 210,
      bedSizeZMm: 210,
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.machine.id).toBe("new-m");
    expect(result.machine.name).toBe("Prusa MK3");
    expect(result.machine.labId).toBe(LAB1);
  });

  it("rejects invalid machineCategory with 400 (from-scratch)", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
    });
    const result = await createMachineProfile(fake as never, {
      teacherId: T1,
      labId: LAB1,
      name: "X",
      machineCategory: "cnc_mill" as never,
      bedSizeXMm: 200,
      bedSizeYMm: 200,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
  });

  it("rejects non-positive bedSize with 400", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
    });
    const result = await createMachineProfile(fake as never, {
      teacherId: T1,
      labId: LAB1,
      name: "X",
      machineCategory: "3d_printer",
      bedSizeXMm: 0,
      bedSizeYMm: 200,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
  });

  it("rejects invalid operationColorMap keys with 400", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
    });
    const result = await createMachineProfile(fake as never, {
      teacherId: T1,
      labId: LAB1,
      name: "X",
      machineCategory: "laser_cutter",
      bedSizeXMm: 400,
      bedSizeYMm: 300,
      operationColorMap: { "not-hex": "cut" } as never,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
    expect(result.error.message).toMatch(/hex colour/i);
  });

  it("rejects invalid operationColorMap values with 400", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
    });
    const result = await createMachineProfile(fake as never, {
      teacherId: T1,
      labId: LAB1,
      name: "X",
      machineCategory: "laser_cutter",
      bedSizeXMm: 400,
      bedSizeYMm: 300,
      operationColorMap: { "#FF0000": "bogus" as never },
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
  });

  it("copies spec from template when fromTemplateId is provided", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
      machineLookupRows: [
        fullRow({
          id: TPL1,
          teacher_id: null,
          is_system_template: true,
          name: "Bambu X1C",
          bed_size_x_mm: 256,
          bed_size_y_mm: 256,
          kerf_mm: null,
        }),
      ],
      insertRow: fullRow({ id: "copy-1", name: "My X1C", lab_id: LAB1 }),
    });
    const result = await createMachineProfile(fake as never, {
      teacherId: T1,
      labId: LAB1,
      name: "My X1C",
      fromTemplateId: TPL1,
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.machine.name).toBe("My X1C");
  });

  it("404s when fromTemplateId points to a non-template or missing row", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
      machineLookupRows: [
        // NOT a template
        fullRow({ id: TPL1, teacher_id: T1, is_system_template: false }),
      ],
    });
    const result = await createMachineProfile(fake as never, {
      teacherId: T1,
      labId: LAB1,
      name: "Bogus",
      fromTemplateId: TPL1,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(404);
  });

  it("maps 23505 duplicate name to 409", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
      insertError: { message: "dup", code: "23505" },
    });
    const result = await createMachineProfile(fake as never, {
      teacherId: T1,
      labId: LAB1,
      name: "Dup name",
      machineCategory: "3d_printer",
      bedSizeXMm: 200,
      bedSizeYMm: 200,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(409);
  });

  // Phase 8.1d-13: when 23505 fires AND there's a soft-deleted
  // machine with the same name, surface the "you have a deactivated
  // one" framing so the teacher knows to either rename the new one
  // or restore the old one — instead of being told "you already
  // have one" with no obvious next step.
  it("23505 + inactive duplicate surfaces 'deactivated machine' message", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
      insertError: { message: "dup", code: "23505" },
      machineLookupRows: [{ id: "soft-deleted-id" }],
    });
    const result = await createMachineProfile(fake as never, {
      teacherId: T1,
      labId: LAB1,
      name: "Bambu Lab P1S",
      machineCategory: "3d_printer",
      bedSizeXMm: 256,
      bedSizeYMm: 256,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(409);
    expect(result.error.message).toMatch(/deactivated machine/i);
    expect(result.error.message).toContain("Bambu Lab P1S");
    expect(result.error.message).toMatch(/reactivate|restore|bin/i);
  });

  it("23505 with no inactive duplicate surfaces 'another in this lab' message + suggested name", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
      insertError: { message: "dup", code: "23505" },
      machineLookupRows: [null], // inactive probe finds nothing
    });
    const result = await createMachineProfile(fake as never, {
      teacherId: T1,
      labId: LAB1,
      name: "Bambu Lab P1S",
      machineCategory: "3d_printer",
      bedSizeXMm: 256,
      bedSizeYMm: 256,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(409);
    expect(result.error.message).toMatch(/another machine in this lab/i);
    expect(result.error.message).toContain('"Bambu Lab P1S #2"');
  });
});

// ============================================================
// listMyMachines
// ============================================================

describe("listMyMachines", () => {
  it("returns both buckets separately", async () => {
    const fake = makeFakeClient({
      teacherMachines: [fullRow({ id: "tm-1", name: "My P1S" })],
      systemTemplates: [
        fullRow({ id: "tpl-1", teacher_id: null, is_system_template: true, name: "Bambu P1S" }),
      ],
    });
    const result = await listMyMachines(fake as never, { teacherId: T1 });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.teacherMachines).toHaveLength(1);
    expect(result.systemTemplates).toHaveLength(1);
    expect(result.teacherMachines[0].isSystemTemplate).toBe(false);
    expect(result.systemTemplates[0].isSystemTemplate).toBe(true);
  });

  it("returns empty buckets when nothing found", async () => {
    const fake = makeFakeClient({
      teacherMachines: [],
      systemTemplates: [],
    });
    const result = await listMyMachines(fake as never, { teacherId: T1 });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.teacherMachines).toEqual([]);
    expect(result.systemTemplates).toEqual([]);
  });

  it("propagates teacher-list query error as 500", async () => {
    const fake = makeFakeClient({
      listTeacherError: { message: "db dead" },
    });
    const result = await listMyMachines(fake as never, { teacherId: T1 });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(500);
  });
});

// ============================================================
// updateMachineProfile
// ============================================================

describe("updateMachineProfile", () => {
  it("updates name and returns new row", async () => {
    const fake = makeFakeClient({
      machineLookupRows: [fullRow({ id: M1, teacher_id: T1 })],
      updatedRow: fullRow({ id: M1, name: "Renamed" }),
    });
    const result = await updateMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: M1,
      name: "Renamed",
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.machine.name).toBe("Renamed");
  });

  it("404s when machine is a system template", async () => {
    const fake = makeFakeClient({
      machineLookupRows: [
        fullRow({ id: "tpl-1", teacher_id: null, is_system_template: true }),
      ],
    });
    const result = await updateMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: "tpl-1",
      name: "Hacked",
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(404);
  });

  it("404s when machine belongs to another teacher", async () => {
    const fake = makeFakeClient({
      machineLookupRows: [fullRow({ id: M1, teacher_id: T2 })],
    });
    const result = await updateMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: M1,
      name: "x",
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(404);
  });

  it("400s when patch is empty", async () => {
    const fake = makeFakeClient({
      machineLookupRows: [fullRow({ id: M1, teacher_id: T1 })],
    });
    const result = await updateMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: M1,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
  });

  it("rejects invalid operationColorMap in patch", async () => {
    const fake = makeFakeClient({
      machineLookupRows: [fullRow({ id: M1, teacher_id: T1 })],
    });
    const result = await updateMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: M1,
      operationColorMap: { "not-hex": "cut" } as never,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
  });

  it("maps 23505 duplicate name to 409", async () => {
    const fake = makeFakeClient({
      machineLookupRows: [fullRow({ id: M1, teacher_id: T1 })],
      updateError: { message: "dup", code: "23505" },
    });
    const result = await updateMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: M1,
      name: "Dup",
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(409);
  });

  it("toggles requiresTeacherApproval", async () => {
    const fake = makeFakeClient({
      machineLookupRows: [fullRow({ id: M1, teacher_id: T1, requires_teacher_approval: false })],
      updatedRow: fullRow({ id: M1, requires_teacher_approval: true }),
    });
    const result = await updateMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: M1,
      requiresTeacherApproval: true,
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.machine.requiresTeacherApproval).toBe(true);
  });

  // ----- Phase 8.1d-4: labId reassignment via update -----

  it("reassigns labId to a teacher-owned target lab", async () => {
    const fake = makeFakeClient({
      machineLookupRows: [fullRow({ id: M1, teacher_id: T1, lab_id: LAB1 })],
      labRows: [{ id: LAB2, teacher_id: T1 }],
      updatedRow: fullRow({ id: M1, lab_id: LAB2 }),
    });
    const result = await updateMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: M1,
      labId: LAB2,
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.machine.labId).toBe(LAB2);
  });

  it("404s when target lab is not owned by this teacher", async () => {
    const fake = makeFakeClient({
      machineLookupRows: [fullRow({ id: M1, teacher_id: T1, lab_id: LAB1 })],
      labRows: [{ id: LAB2, teacher_id: T2 }],
    });
    const result = await updateMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: M1,
      labId: LAB2,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(404);
  });

  it("400s when labId is empty string", async () => {
    const fake = makeFakeClient({
      machineLookupRows: [fullRow({ id: M1, teacher_id: T1, lab_id: LAB1 })],
    });
    const result = await updateMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: M1,
      labId: "",
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
  });

  it("supports orphan→lab transition (machine with lab_id=null gets a lab)", async () => {
    // The whole reason this lives in updateMachineProfile rather than
    // reassignMachineToLab — orphans don't have a sourceLabId for the
    // /labs/[id]/machines route to anchor on.
    const fake = makeFakeClient({
      machineLookupRows: [fullRow({ id: M1, teacher_id: T1, lab_id: null })],
      labRows: [{ id: LAB1, teacher_id: T1 }],
      updatedRow: fullRow({ id: M1, lab_id: LAB1 }),
    });
    const result = await updateMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: M1,
      labId: LAB1,
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.machine.labId).toBe(LAB1);
  });
});

// ============================================================
// softDeleteMachineProfile
// ============================================================

describe("softDeleteMachineProfile", () => {
  it("soft-deletes cleanly when no active jobs", async () => {
    const fake = makeFakeClient({
      machineLookupRows: [fullRow({ id: M1, teacher_id: T1 })],
      activeJobs: [],
    });
    const result = await softDeleteMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: M1,
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.machineProfileId).toBe(M1);
  });

  it("409s when machine has active jobs", async () => {
    const fake = makeFakeClient({
      machineLookupRows: [fullRow({ id: M1, teacher_id: T1 })],
      activeJobs: [
        { id: "j1", status: "pending_approval" },
        { id: "j2", status: "picked_up" },
      ],
    });
    const result = await softDeleteMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: M1,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(409);
    expect(result.error.message).toMatch(/2 active job/);
  });

  it("404s for cross-teacher or template", async () => {
    const fake = makeFakeClient({
      machineLookupRows: [fullRow({ id: M1, teacher_id: T2 })],
    });
    const result = await softDeleteMachineProfile(fake as never, {
      teacherId: T1,
      machineProfileId: M1,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(404);
  });
});

// ============================================================
// bulkSetApprovalForLab
// ============================================================

describe("bulkSetApprovalForLab", () => {
  it("turns approval ON for every machine in the lab", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
      machinesInLab: [{ id: "m-1" }, { id: "m-2" }, { id: "m-3" }],
    });
    const result = await bulkSetApprovalForLab(fake as never, {
      teacherId: T1,
      labId: LAB1,
      requireApproval: true,
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.updatedMachineCount).toBe(3);
    expect(result.requireApproval).toBe(true);
  });

  it("turns approval OFF for every machine in the lab", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
      machinesInLab: [{ id: "m-1" }],
    });
    const result = await bulkSetApprovalForLab(fake as never, {
      teacherId: T1,
      labId: LAB1,
      requireApproval: false,
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.updatedMachineCount).toBe(1);
    expect(result.requireApproval).toBe(false);
  });

  it("returns 0 count for an empty lab", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB1, teacher_id: T1 }],
      machinesInLab: [],
    });
    const result = await bulkSetApprovalForLab(fake as never, {
      teacherId: T1,
      labId: LAB1,
      requireApproval: true,
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.updatedMachineCount).toBe(0);
  });

  it("404s when lab is not owned by teacher", async () => {
    const fake = makeFakeClient({
      labRows: [{ id: LAB2, teacher_id: T2 }],
    });
    const result = await bulkSetApprovalForLab(fake as never, {
      teacherId: T1,
      labId: LAB2,
      requireApproval: true,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(404);
  });

  it("400s when requireApproval is not a boolean", async () => {
    const fake = makeFakeClient({});
    const result = await bulkSetApprovalForLab(fake as never, {
      teacherId: T1,
      labId: LAB1,
      requireApproval: "yes" as never,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
  });
});
