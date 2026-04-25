import { describe, it, expect } from "vitest";
import {
  createLab,
  listMyLabs,
  updateLab,
  deleteLab,
  reassignMachineToLab,
  isOrchestrationError,
} from "../lab-orchestration";

/**
 * Phase 8-2 lab-orchestration unit tests. Pure logic — Supabase
 * client faked as a query-builder chain matching the shape used by
 * fab-orchestration.test.ts / teacher-orchestration.test.ts.
 *
 * Coverage goals per Phase 8-2 brief:
 *   - createLab: happy path, input validation, unique-default 23505 → 409
 *   - listMyLabs: empty, multi-lab with machine counts, teacher scoping
 *   - updateLab: happy path, validation, empty patch, cross-teacher 404
 *   - deleteLab: happy (empty lab), 409 with machines + no target,
 *                machine + class reassignment, default-safety guard,
 *                target = self 400, target not-owned 404
 *   - reassignMachineToLab: happy path, same-source-target 400,
 *                           source/target/machine not-owned 404,
 *                           system-template 409
 */

// ============================================================
// Shared fake: scripted query-builder
// ============================================================

interface FakeOpts {
  /** What `fabrication_labs.maybeSingle()` returns, keyed by call order.
   *  First call = ownership of param.labId (or source lab).
   *  Subsequent calls = target lab (for deleteLab reassignTo path, for
   *  reassignMachineToLab target-lab check). */
  labRows?: Array<
    | {
        id: string;
        teacher_id: string;
        school_id: string | null;
        name: string;
        description: string | null;
        is_default: boolean;
        created_at: string;
        updated_at: string;
      }
    | null
  >;
  /** INSERT into fabrication_labs returns this row (or error). */
  insertLabRow?: {
    id: string;
    teacher_id: string;
    school_id: string | null;
    name: string;
    description: string | null;
    is_default: boolean;
    created_at: string;
    updated_at: string;
  } | null;
  insertLabError?: { message: string; code?: string };
  /** UPDATE .select().single() on fabrication_labs returns this. */
  updatedLabRow?: {
    id: string;
    teacher_id: string;
    school_id: string | null;
    name: string;
    description: string | null;
    is_default: boolean;
    created_at: string;
    updated_at: string;
  } | null;
  updateLabError?: { message: string; code?: string };
  /** List of labs returned by the list-query (no maybeSingle, array). */
  listLabsRows?: Array<{
    id: string;
    teacher_id: string;
    school_id: string | null;
    name: string;
    description: string | null;
    is_default: boolean;
    created_at: string;
    updated_at: string;
  }>;
  listLabsError?: { message: string };
  /** List of machines for machine-count lookup in listMyLabs + delete. */
  machinesByLab?: Array<{ id: string; lab_id: string }>;
  machinesError?: { message: string };
  /** fabrication_labs `.neq().limit()` for deleteLab default-safety check. */
  otherLabsExist?: boolean;
  /** Single machine lookup for reassignMachineToLab. */
  machineLookupRow?: {
    id: string;
    teacher_id: string | null;
    lab_id: string | null;
    is_system_template: boolean;
  } | null;
  machineLookupError?: { message: string };
  /** Generic update errors on machine_profiles or classes. */
  machineUpdateError?: { message: string };
  classUpdateError?: { message: string };
  deleteLabError?: { message: string };
}

function makeFakeClient(opts: FakeOpts = {}) {
  const log: Array<{ table: string; op: string; eq: Array<[string, unknown]>; payload?: Record<string, unknown> }> = [];
  let labMaybeSingleCalls = 0;

  const tableHandler = (table: string) => {
    const entry: { table: string; op: string; eq: Array<[string, unknown]>; payload?: Record<string, unknown> } = {
      table,
      op: "select",
      eq: [],
    };

    const chain: Record<string, unknown> = {};
    let listSelectMode = false;
    let insertPayload: Record<string, unknown> | undefined;
    let updatePayload: Record<string, unknown> | undefined;

    chain.select = (_cols: string) => {
      listSelectMode = table === "fabrication_labs" || table === "machine_profiles";
      return chain;
    };
    chain.eq = (col: string, val: unknown) => {
      entry.eq.push([col, val]);
      return chain;
    };
    chain.neq = (col: string, val: unknown) => {
      entry.eq.push([`neq:${col}`, val]);
      return chain;
    };
    chain.in = (col: string, vals: unknown[]) => {
      entry.eq.push([col, vals]);
      return chain;
    };
    chain.order = () => chain;
    chain.limit = () => ({
      then: (resolve: (v: unknown) => unknown) => {
        log.push({ ...entry });
        // only used by deleteLab default-safety check
        if (table === "fabrication_labs") {
          return Promise.resolve(
            resolve({
              data: opts.otherLabsExist ? [{ id: "other-lab" }] : [],
              error: null,
            })
          );
        }
        return Promise.resolve(resolve({ data: [], error: null }));
      },
    });
    chain.maybeSingle = async () => {
      log.push({ ...entry });
      if (table === "fabrication_labs") {
        const idx = labMaybeSingleCalls++;
        const row = opts.labRows?.[idx];
        if (row === undefined) return { data: null, error: null };
        return { data: row, error: null };
      }
      if (table === "machine_profiles") {
        if (opts.machineLookupError) {
          return { data: null, error: opts.machineLookupError };
        }
        return { data: opts.machineLookupRow ?? null, error: null };
      }
      return { data: null, error: null };
    };

    // List query: select().eq()...[.order().order()] resolved as a
    // thenable. fabrication_labs list or machine_profiles count.
    // Make the chain itself awaitable via a `then` method — triggered
    // when the orchestration awaits the final builder.
    chain.then = (resolve: (v: unknown) => unknown) => {
      log.push({ ...entry });
      if (!listSelectMode) {
        return Promise.resolve(resolve({ data: null, error: null }));
      }
      if (table === "fabrication_labs") {
        if (opts.listLabsError) {
          return Promise.resolve(resolve({ data: null, error: opts.listLabsError }));
        }
        return Promise.resolve(resolve({ data: opts.listLabsRows ?? [], error: null }));
      }
      if (table === "machine_profiles") {
        if (opts.machinesError) {
          return Promise.resolve(resolve({ data: null, error: opts.machinesError }));
        }
        return Promise.resolve(resolve({ data: opts.machinesByLab ?? [], error: null }));
      }
      return Promise.resolve(resolve({ data: null, error: null }));
    };

    chain.insert = (payload: Record<string, unknown>) => {
      entry.op = "insert";
      entry.payload = payload;
      insertPayload = payload;
      void insertPayload;
      const insChain: Record<string, unknown> = {};
      insChain.select = () => insChain;
      insChain.single = async () => {
        log.push({ ...entry });
        if (opts.insertLabError) {
          return { data: null, error: opts.insertLabError };
        }
        return { data: opts.insertLabRow ?? null, error: null };
      };
      return insChain;
    };

    chain.update = (payload: Record<string, unknown>) => {
      entry.op = "update";
      entry.payload = payload;
      updatePayload = payload;
      void updatePayload;
      const updChain: Record<string, unknown> = {};
      updChain.eq = (col: string, val: unknown) => {
        entry.eq.push([col, val]);
        return updChain;
      };
      updChain.select = () => updChain;
      updChain.single = async () => {
        log.push({ ...entry });
        if (table === "fabrication_labs") {
          if (opts.updateLabError) return { data: null, error: opts.updateLabError };
          return { data: opts.updatedLabRow ?? null, error: null };
        }
        return { data: null, error: null };
      };
      updChain.then = (resolve: (v: unknown) => unknown) => {
        log.push({ ...entry });
        if (table === "machine_profiles" && opts.machineUpdateError) {
          return Promise.resolve(resolve({ error: opts.machineUpdateError }));
        }
        if (table === "classes" && opts.classUpdateError) {
          return Promise.resolve(resolve({ error: opts.classUpdateError }));
        }
        return Promise.resolve(resolve({ error: null }));
      };
      return updChain;
    };

    chain.delete = () => {
      entry.op = "delete";
      const delChain: Record<string, unknown> = {};
      delChain.eq = (col: string, val: unknown) => {
        entry.eq.push([col, val]);
        return delChain;
      };
      delChain.then = (resolve: (v: unknown) => unknown) => {
        log.push({ ...entry });
        if (opts.deleteLabError) {
          return Promise.resolve(resolve({ error: opts.deleteLabError }));
        }
        return Promise.resolve(resolve({ error: null }));
      };
      return delChain;
    };

    return chain as {
      from: (t: string) => unknown;
      select: (cols: string) => unknown;
      eq: (c: string, v: unknown) => unknown;
      maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
    };
  };

  return {
    from: (table: string) => tableHandler(table),
    _log: log,
  };
}

const T1 = "teacher-1";
const T2 = "teacher-2";
const L1 = "lab-1";
const L2 = "lab-2";

const labRow = (overrides: Partial<{ id: string; teacher_id: string; name: string; is_default: boolean; description: string | null }> = {}) => ({
  id: overrides.id ?? L1,
  teacher_id: overrides.teacher_id ?? T1,
  school_id: null,
  name: overrides.name ?? "Default lab",
  description: overrides.description ?? null,
  is_default: overrides.is_default ?? true,
  created_at: "2026-04-25T00:00:00Z",
  updated_at: "2026-04-25T00:00:00Z",
});

// ============================================================
// createLab
// ============================================================

describe("createLab", () => {
  it("creates a lab and returns the new row", async () => {
    const fake = makeFakeClient({
      insertLabRow: labRow({ id: "new-lab", name: "2nd floor", is_default: false }),
    });
    const result = await createLab(fake as never, {
      teacherId: T1,
      name: "2nd floor",
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.lab.id).toBe("new-lab");
    expect(result.lab.name).toBe("2nd floor");
    expect(result.lab.isDefault).toBe(false);
  });

  it("rejects empty name with 400", async () => {
    const fake = makeFakeClient();
    const result = await createLab(fake as never, { teacherId: T1, name: "   " });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
    expect(result.error.message).toMatch(/cannot be empty/i);
  });

  it("rejects over-long name with 400", async () => {
    const fake = makeFakeClient();
    const result = await createLab(fake as never, {
      teacherId: T1,
      name: "x".repeat(200),
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
  });

  it("rejects non-string name with 400", async () => {
    const fake = makeFakeClient();
    const result = await createLab(fake as never, {
      teacherId: T1,
      name: 42 as unknown as string,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
  });

  it("maps unique-default violation (23505) to 409", async () => {
    const fake = makeFakeClient({
      insertLabError: { message: "duplicate key", code: "23505" },
    });
    const result = await createLab(fake as never, {
      teacherId: T1,
      name: "Dup default",
      isDefault: true,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(409);
    expect(result.error.message).toMatch(/default lab/i);
  });

  it("maps generic insert failure to 500", async () => {
    const fake = makeFakeClient({
      insertLabError: { message: "disk full" },
    });
    const result = await createLab(fake as never, { teacherId: T1, name: "x" });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(500);
  });
});

// ============================================================
// listMyLabs
// ============================================================

describe("listMyLabs", () => {
  it("returns empty array when teacher has no labs", async () => {
    const fake = makeFakeClient({ listLabsRows: [] });
    const result = await listMyLabs(fake as never, { teacherId: T1 });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.labs).toEqual([]);
  });

  it("bubbles machine counts into LabListRow", async () => {
    const fake = makeFakeClient({
      listLabsRows: [
        labRow({ id: L1, name: "Default lab", is_default: true }),
        labRow({ id: L2, name: "2nd floor", is_default: false }),
      ],
      machinesByLab: [
        { id: "m1", lab_id: L1 },
        { id: "m2", lab_id: L1 },
        { id: "m3", lab_id: L2 },
      ],
    });
    const result = await listMyLabs(fake as never, { teacherId: T1 });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    const byId = new Map(result.labs.map((l) => [l.id, l]));
    expect(byId.get(L1)?.machineCount).toBe(2);
    expect(byId.get(L2)?.machineCount).toBe(1);
  });

  it("returns zero count for labs with no machines", async () => {
    const fake = makeFakeClient({
      listLabsRows: [labRow({ id: L1 })],
      machinesByLab: [],
    });
    const result = await listMyLabs(fake as never, { teacherId: T1 });
    if (isOrchestrationError(result)) return;
    expect(result.labs[0].machineCount).toBe(0);
  });

  it("propagates list query errors as 500", async () => {
    const fake = makeFakeClient({ listLabsError: { message: "boom" } });
    const result = await listMyLabs(fake as never, { teacherId: T1 });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(500);
  });
});

// ============================================================
// updateLab
// ============================================================

describe("updateLab", () => {
  it("updates name and returns the new row", async () => {
    const fake = makeFakeClient({
      labRows: [labRow({ id: L1, teacher_id: T1 })], // ownership
      updatedLabRow: labRow({ id: L1, name: "Renamed" }),
    });
    const result = await updateLab(fake as never, {
      teacherId: T1,
      labId: L1,
      name: "Renamed",
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.lab.name).toBe("Renamed");
  });

  it("404s when lab belongs to a different teacher", async () => {
    const fake = makeFakeClient({
      labRows: [labRow({ id: L1, teacher_id: T2 })],
    });
    const result = await updateLab(fake as never, {
      teacherId: T1,
      labId: L1,
      name: "Hacked",
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(404);
  });

  it("404s when lab does not exist", async () => {
    const fake = makeFakeClient({ labRows: [null] });
    const result = await updateLab(fake as never, {
      teacherId: T1,
      labId: "missing",
      name: "x",
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(404);
  });

  it("400s when patch is empty", async () => {
    const fake = makeFakeClient({
      labRows: [labRow({ id: L1, teacher_id: T1 })],
    });
    const result = await updateLab(fake as never, {
      teacherId: T1,
      labId: L1,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
    expect(result.error.message).toMatch(/No updatable fields/);
  });

  it("maps 23505 on isDefault promotion to 409", async () => {
    const fake = makeFakeClient({
      labRows: [labRow({ id: L1, teacher_id: T1, is_default: false })],
      updateLabError: { message: "dup", code: "23505" },
    });
    const result = await updateLab(fake as never, {
      teacherId: T1,
      labId: L1,
      isDefault: true,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(409);
    expect(result.error.message).toMatch(/default/i);
  });

  it("clears description when null is explicitly passed", async () => {
    const fake = makeFakeClient({
      labRows: [labRow({ id: L1, teacher_id: T1, description: "old" })],
      updatedLabRow: labRow({ id: L1, description: null }),
    });
    const result = await updateLab(fake as never, {
      teacherId: T1,
      labId: L1,
      description: null,
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.lab.description).toBeNull();
  });
});

// ============================================================
// deleteLab
// ============================================================

describe("deleteLab", () => {
  it("deletes an empty lab (no machines) cleanly", async () => {
    const fake = makeFakeClient({
      labRows: [labRow({ id: L1, teacher_id: T1, is_default: false })],
      machinesByLab: [],
    });
    const result = await deleteLab(fake as never, {
      teacherId: T1,
      labId: L1,
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.deletedLabId).toBe(L1);
    expect(result.reassignedMachineCount).toBe(0);
  });

  it("409s when lab has machines and no reassignTo provided", async () => {
    const fake = makeFakeClient({
      labRows: [labRow({ id: L1, teacher_id: T1, is_default: false })],
      machinesByLab: [{ id: "m1", lab_id: L1 }],
    });
    const result = await deleteLab(fake as never, {
      teacherId: T1,
      labId: L1,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(409);
    expect(result.error.message).toMatch(/machine/i);
  });

  it("reassigns machines then deletes when reassignTo is provided", async () => {
    const fake = makeFakeClient({
      labRows: [
        labRow({ id: L1, teacher_id: T1, is_default: false }), // source
        labRow({ id: L2, teacher_id: T1, is_default: true }), // target
      ],
      machinesByLab: [
        { id: "m1", lab_id: L1 },
        { id: "m2", lab_id: L1 },
      ],
    });
    const result = await deleteLab(fake as never, {
      teacherId: T1,
      labId: L1,
      reassignTo: L2,
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.deletedLabId).toBe(L1);
    expect(result.reassignedMachineCount).toBe(2);
    // Verify the log shows machine UPDATE + class UPDATE + lab DELETE
    const ops = fake._log.map((e) => `${e.table}:${e.op}`);
    expect(ops).toContain("machine_profiles:update");
    expect(ops).toContain("classes:update");
    expect(ops).toContain("fabrication_labs:delete");
  });

  it("400s when reassignTo === labId", async () => {
    const fake = makeFakeClient({
      labRows: [
        labRow({ id: L1, teacher_id: T1, is_default: false }),
        labRow({ id: L1, teacher_id: T1, is_default: false }), // same lab
      ],
      machinesByLab: [{ id: "m1", lab_id: L1 }],
    });
    const result = await deleteLab(fake as never, {
      teacherId: T1,
      labId: L1,
      reassignTo: L1,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
    expect(result.error.message).toMatch(/cannot be the lab being deleted/i);
  });

  it("404s when reassignTo lab belongs to another teacher", async () => {
    const fake = makeFakeClient({
      labRows: [
        labRow({ id: L1, teacher_id: T1, is_default: false }), // source OK
        labRow({ id: L2, teacher_id: T2 }), // target owned by T2 — 404 to T1
      ],
      machinesByLab: [{ id: "m1", lab_id: L1 }],
    });
    const result = await deleteLab(fake as never, {
      teacherId: T1,
      labId: L1,
      reassignTo: L2,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(404);
  });

  it("409s when deleting default lab while others exist", async () => {
    const fake = makeFakeClient({
      labRows: [labRow({ id: L1, teacher_id: T1, is_default: true })],
      otherLabsExist: true,
    });
    const result = await deleteLab(fake as never, {
      teacherId: T1,
      labId: L1,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(409);
    expect(result.error.message).toMatch(/default/i);
  });

  it("allows deleting the last default lab (no others exist, no machines)", async () => {
    const fake = makeFakeClient({
      labRows: [labRow({ id: L1, teacher_id: T1, is_default: true })],
      otherLabsExist: false,
      machinesByLab: [],
    });
    const result = await deleteLab(fake as never, {
      teacherId: T1,
      labId: L1,
    });
    expect(isOrchestrationError(result)).toBe(false);
  });
});

// ============================================================
// reassignMachineToLab
// ============================================================

describe("reassignMachineToLab", () => {
  it("reassigns a teacher-owned machine from source lab to target lab", async () => {
    const fake = makeFakeClient({
      labRows: [
        labRow({ id: L1, teacher_id: T1 }), // source
        labRow({ id: L2, teacher_id: T1 }), // target
      ],
      machineLookupRow: {
        id: "m1",
        teacher_id: T1,
        lab_id: L1,
        is_system_template: false,
      },
    });
    const result = await reassignMachineToLab(fake as never, {
      teacherId: T1,
      sourceLabId: L1,
      machineProfileId: "m1",
      targetLabId: L2,
    });
    expect(isOrchestrationError(result)).toBe(false);
    if (isOrchestrationError(result)) return;
    expect(result.machineProfileId).toBe("m1");
    expect(result.previousLabId).toBe(L1);
    expect(result.newLabId).toBe(L2);
  });

  it("400s when source and target are the same", async () => {
    const fake = makeFakeClient({
      labRows: [
        labRow({ id: L1, teacher_id: T1 }),
        labRow({ id: L1, teacher_id: T1 }), // same
      ],
    });
    const result = await reassignMachineToLab(fake as never, {
      teacherId: T1,
      sourceLabId: L1,
      machineProfileId: "m1",
      targetLabId: L1,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(400);
  });

  it("404s when source lab not owned", async () => {
    const fake = makeFakeClient({
      labRows: [labRow({ id: L1, teacher_id: T2 })],
    });
    const result = await reassignMachineToLab(fake as never, {
      teacherId: T1,
      sourceLabId: L1,
      machineProfileId: "m1",
      targetLabId: L2,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(404);
  });

  it("404s when target lab not owned", async () => {
    const fake = makeFakeClient({
      labRows: [
        labRow({ id: L1, teacher_id: T1 }), // source OK
        labRow({ id: L2, teacher_id: T2 }), // target NOT owned
      ],
    });
    const result = await reassignMachineToLab(fake as never, {
      teacherId: T1,
      sourceLabId: L1,
      machineProfileId: "m1",
      targetLabId: L2,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(404);
  });

  it("404s when machine not found or owned by another teacher", async () => {
    const fake = makeFakeClient({
      labRows: [
        labRow({ id: L1, teacher_id: T1 }),
        labRow({ id: L2, teacher_id: T1 }),
      ],
      machineLookupRow: null, // not found
    });
    const result = await reassignMachineToLab(fake as never, {
      teacherId: T1,
      sourceLabId: L1,
      machineProfileId: "m1",
      targetLabId: L2,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(404);
  });

  it("409s when attempting to move a system template", async () => {
    const fake = makeFakeClient({
      labRows: [
        labRow({ id: L1, teacher_id: T1 }),
        labRow({ id: L2, teacher_id: T1 }),
      ],
      machineLookupRow: {
        id: "m-sys",
        teacher_id: T1,
        lab_id: null,
        is_system_template: true,
      },
    });
    const result = await reassignMachineToLab(fake as never, {
      teacherId: T1,
      sourceLabId: L1,
      machineProfileId: "m-sys",
      targetLabId: L2,
    });
    expect(isOrchestrationError(result)).toBe(true);
    if (!isOrchestrationError(result)) return;
    expect(result.error.status).toBe(409);
    expect(result.error.message).toMatch(/system.template/i);
  });
});

// ============================================================
// Phase 8.1d hotfix: deleteLab + listMyLabs filter is_active=true
// ============================================================
//
// Regression for the bug Matt found during S1 smoke 25 Apr PM:
//   - Teacher soft-deletes 2 machines (is_active=false)
//   - UI grid shows 0 machines (correct — already filtered)
//   - Try to delete the lab
//   - Server pre-fix: counts ALL rows (including inactive) → 409
//   - Server post-fix: counts is_active=true only → 0 → succeeds
//
// We can't run the actual SQL filter through the fake, but we CAN
// assert the orchestration code applies the .eq("is_active", true)
// filter on both queries — which is what fixes the bug at the
// PostgREST layer in prod.

describe("Phase 8.1d hotfix: is_active filter on lab counts", () => {
  it("deleteLab includes is_active=true on the machine count query", async () => {
    const fake = makeFakeClient({
      labRows: [labRow({ id: L1, teacher_id: T1, is_default: false })],
      machinesByLab: [], // simulating "no active machines"
    });
    await deleteLab(fake as never, { teacherId: T1, labId: L1 });

    // Find the machine_profiles SELECT query (count phase, before delete).
    const machineCountEntry = fake._log.find(
      (e) =>
        e.table === "machine_profiles" &&
        e.op === "select" &&
        e.eq.some(([col]) => col === "lab_id")
    );
    expect(machineCountEntry).toBeDefined();
    const eqMap = new Map(machineCountEntry!.eq as [string, unknown][]);
    expect(eqMap.get("is_active")).toBe(true);
  });

  it("listMyLabs includes is_active=true on the per-lab machine count query", async () => {
    const fake = makeFakeClient({
      listLabsRows: [labRow({ id: L1 })],
      machinesByLab: [],
    });
    await listMyLabs(fake as never, { teacherId: T1 });

    const machineCountEntry = fake._log.find(
      (e) =>
        e.table === "machine_profiles" &&
        e.op === "select" &&
        // listMyLabs uses .in("lab_id", labIds) not .eq, but is_active
        // still appears as an .eq filter in the same chain.
        e.eq.some(([col]) => col === "is_active")
    );
    expect(machineCountEntry).toBeDefined();
    const eqMap = new Map(machineCountEntry!.eq as [string, unknown][]);
    expect(eqMap.get("is_active")).toBe(true);
  });
});
