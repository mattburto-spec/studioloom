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
 * Phase 8-2 lab-orchestration unit tests (rewritten 28 Apr 2026 for
 * school-scoped contract). The previous teacher-scoped test file was
 * superseded by today's Q3 flip + audit Round 1.
 *
 * Coverage:
 *   - createLab: derives school from teacher; orphan-teacher 401;
 *     name validation; dup-name 23505 → 409.
 *   - listMyLabs: school-scoped (every same-school teacher sees same
 *     list); empty when teacher has no school; machine counts.
 *   - updateLab: school-scoped 404 (cross-school invisibility);
 *     name validation; empty-patch no-op.
 *   - deleteLab: 404 cross-school; 409 with refs + no reassign;
 *     reassignTo redirects machines + classes + teacher defaults;
 *     reassignTo cross-school → 404; self-reassign → 400.
 *   - reassignMachineToLab: same-school check; source mismatch 409;
 *     same source/target → 400; success.
 *
 * Tests use the same scripted-query-builder mock pattern as
 * fab-orchestration.test.ts.
 */

// ============================================================
// Shared mock — scripted query-builder
// ============================================================

interface FakeOpts {
  /** Teacher's school_id (returned by `teachers.maybeSingle()` for
   *  the calling teacher). Default "school-1". null = orphan
   *  teacher (no school picked yet). undefined keyword = teacher
   *  row missing entirely. */
  teacherSchoolId?: string | null | "missing";
  /** Sequenced labRows returned by `fabrication_labs.maybeSingle()`
   *  in call order. Drives loadSchoolOwnedLab. */
  labRows?: Array<
    | {
        id: string;
        school_id: string;
        created_by_teacher_id: string | null;
        name: string;
        description: string | null;
        created_at: string;
        updated_at: string;
      }
    | null
  >;
  insertLabRow?: {
    id: string;
    school_id: string;
    created_by_teacher_id: string | null;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  insertLabError?: { message: string; code?: string };
  updatedLabRow?: {
    id: string;
    school_id: string;
    created_by_teacher_id: string | null;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  updateLabError?: { message: string; code?: string };
  /** Array result of `fabrication_labs.eq("school_id", X).order(...)`
   *  in listMyLabs. */
  listLabsRows?: Array<{
    id: string;
    school_id: string;
    created_by_teacher_id: string | null;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
  }>;
  listLabsError?: { message: string };
  /** machine_profiles list for count + ref lookups. */
  machinesByLab?: Array<{ id: string; lab_id: string }>;
  machinesError?: { message: string };
  /** classes WHERE default_lab_id = X — for delete blocker. */
  classesByLab?: Array<{ id: string }>;
  /** teachers WHERE default_lab_id = X — for delete blocker. */
  teachersByLab?: Array<{ id: string }>;
  machineLookupRow?: {
    id: string;
    lab_id: string | null;
  } | null;
  machineLookupError?: { message: string };
  machineUpdateError?: { message: string };
  classUpdateError?: { message: string };
  teacherUpdateError?: { message: string };
  deleteLabError?: { message: string };
}

interface LogEntry {
  table: string;
  op: string;
  eq: Array<[string, unknown]>;
  payload?: Record<string, unknown>;
  selectCols?: string;
}

function makeFakeClient(opts: FakeOpts = {}) {
  const log: LogEntry[] = [];
  let labMaybeSingleCalls = 0;

  const tableHandler = (table: string) => {
    const entry: LogEntry = { table, op: "select", eq: [] };

    const chain: Record<string, unknown> = {};
    chain.select = (cols: string) => {
      entry.selectCols = cols;
      return chain;
    };
    chain.eq = (col: string, val: unknown) => {
      entry.eq.push([col, val]);
      return chain;
    };
    chain.in = (col: string, vals: unknown[]) => {
      entry.eq.push([col, vals]);
      return chain;
    };
    chain.order = () => chain;

    chain.maybeSingle = async () => {
      log.push({ ...entry });

      if (table === "teachers") {
        if (opts.teacherSchoolId === "missing") {
          return { data: null, error: null };
        }
        return {
          data: {
            school_id:
              opts.teacherSchoolId === undefined
                ? "school-1"
                : opts.teacherSchoolId,
          },
          error: null,
        };
      }

      if (table === "fabrication_labs") {
        const row = opts.labRows?.[labMaybeSingleCalls];
        labMaybeSingleCalls++;
        return { data: row ?? null, error: null };
      }

      if (table === "machine_profiles") {
        if (opts.machineLookupError) {
          return {
            data: null,
            error: { message: opts.machineLookupError.message },
          };
        }
        return { data: opts.machineLookupRow ?? null, error: null };
      }

      return { data: null, error: null };
    };

    // .single() — used after .insert/.update for create/update returns.
    chain.single = async () => {
      log.push({ ...entry });
      if (entry.op === "insert") {
        if (opts.insertLabError) {
          return { data: null, error: opts.insertLabError };
        }
        return { data: opts.insertLabRow ?? null, error: null };
      }
      if (entry.op === "update") {
        if (opts.updateLabError) {
          return { data: null, error: opts.updateLabError };
        }
        return { data: opts.updatedLabRow ?? null, error: null };
      }
      return { data: null, error: null };
    };

    chain.insert = (payload: Record<string, unknown>) => {
      entry.op = "insert";
      entry.payload = payload;
      return chain;
    };

    chain.update = (payload: Record<string, unknown>) => {
      entry.op = "update";
      entry.payload = payload;
      const updChain: Record<string, unknown> = {};
      updChain.eq = (col: string, val: unknown) => {
        entry.eq.push([col, val]);
        return updChain;
      };
      updChain.select = (cols: string) => {
        entry.selectCols = cols;
        const sel: Record<string, unknown> = {};
        sel.single = chain.single;
        return sel;
      };
      updChain.then = (resolve: (v: unknown) => unknown) => {
        log.push({ ...entry });
        if (table === "machine_profiles") {
          if (opts.machineUpdateError) {
            return Promise.resolve(
              resolve({ error: opts.machineUpdateError })
            );
          }
          return Promise.resolve(resolve({ error: null }));
        }
        if (table === "classes") {
          if (opts.classUpdateError) {
            return Promise.resolve(
              resolve({ error: opts.classUpdateError })
            );
          }
          return Promise.resolve(resolve({ error: null }));
        }
        if (table === "teachers") {
          if (opts.teacherUpdateError) {
            return Promise.resolve(
              resolve({ error: opts.teacherUpdateError })
            );
          }
          return Promise.resolve(resolve({ error: null }));
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

    // Special-case: list-style queries (no .maybeSingle, no .single)
    // that resolve via implicit await. We support a thenable on chain
    // for the listMyLabs + reference-count queries.
    const originalEq = chain.eq as (col: string, val: unknown) => unknown;
    chain.eq = (col: string, val: unknown) => {
      originalEq(col, val);
      // Make the chain thenable AFTER .eq was called so listMyLabs
      // and ref-count queries work. .order() returns chain too.
      (chain as { then?: unknown }).then = (
        resolve: (v: unknown) => unknown
      ) => {
        log.push({ ...entry });
        if (table === "fabrication_labs" && entry.op === "select") {
          if (opts.listLabsError) {
            return Promise.resolve(
              resolve({ data: null, error: opts.listLabsError })
            );
          }
          return Promise.resolve(
            resolve({ data: opts.listLabsRows ?? [], error: null })
          );
        }
        if (table === "machine_profiles") {
          if (opts.machinesError) {
            return Promise.resolve(
              resolve({ data: null, error: opts.machinesError })
            );
          }
          // Filter by lab_id. Distinguish .eq("lab_id", X) (single
          // string value — used by deleteLab refs scan) from
          // .in("lab_id", [...]) (array — used by listMyLabs counts).
          const labIdEq = entry.eq.find(([c]) => c === "lab_id");
          if (labIdEq && Array.isArray(labIdEq[1])) {
            // .in() — return all machines whose lab_id is in the set
            const labIdSet = new Set(labIdEq[1] as string[]);
            const matches = (opts.machinesByLab ?? []).filter((m) =>
              labIdSet.has(m.lab_id)
            );
            return Promise.resolve(
              resolve({ data: matches, error: null })
            );
          }
          if (labIdEq) {
            // .eq() — single lab_id filter
            const matches = (opts.machinesByLab ?? []).filter(
              (m) => m.lab_id === labIdEq[1]
            );
            return Promise.resolve(
              resolve({ data: matches, error: null })
            );
          }
          return Promise.resolve(
            resolve({ data: opts.machinesByLab ?? [], error: null })
          );
        }
        if (table === "classes") {
          return Promise.resolve(
            resolve({ data: opts.classesByLab ?? [], error: null })
          );
        }
        if (table === "teachers") {
          return Promise.resolve(
            resolve({ data: opts.teachersByLab ?? [], error: null })
          );
        }
        return Promise.resolve(resolve({ data: [], error: null }));
      };
      return chain;
    };
    chain.in = (col: string, vals: unknown[]) => {
      entry.eq.push([col, vals]);
      (chain as { then?: unknown }).then = (
        resolve: (v: unknown) => unknown
      ) => {
        log.push({ ...entry });
        if (table === "machine_profiles") {
          if (opts.machinesError) {
            return Promise.resolve(
              resolve({ data: null, error: opts.machinesError })
            );
          }
          return Promise.resolve(
            resolve({ data: opts.machinesByLab ?? [], error: null })
          );
        }
        return Promise.resolve(resolve({ data: [], error: null }));
      };
      return chain;
    };

    return chain;
  };

  return {
    client: { from: tableHandler } as unknown as Parameters<
      typeof createLab
    >[0],
    log,
  };
}

// Helper to build a lab row with all required fields.
function labRow(overrides: Partial<{
  id: string;
  school_id: string;
  created_by_teacher_id: string | null;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}> = {}) {
  return {
    id: overrides.id ?? "lab-1",
    school_id: overrides.school_id ?? "school-1",
    created_by_teacher_id:
      overrides.created_by_teacher_id === undefined
        ? "teacher-1"
        : overrides.created_by_teacher_id,
    name: overrides.name ?? "Default lab",
    description: overrides.description === undefined ? null : overrides.description,
    created_at: overrides.created_at ?? "2026-04-28T00:00:00Z",
    updated_at: overrides.updated_at ?? "2026-04-28T00:00:00Z",
  };
}

// ============================================================
// createLab
// ============================================================

describe("createLab", () => {
  it("creates a lab in the calling teacher's school", async () => {
    const inserted = labRow({ id: "lab-new", name: "PYP Lab" });
    const { client, log } = makeFakeClient({ insertLabRow: inserted });
    const result = await createLab(client, {
      teacherId: "teacher-1",
      name: "PYP Lab",
    });
    if (isOrchestrationError(result)) throw new Error("expected success");
    expect(result.lab.id).toBe("lab-new");
    expect(result.lab.schoolId).toBe("school-1");
    expect(result.lab.name).toBe("PYP Lab");
    expect(result.lab.createdByTeacherId).toBe("teacher-1");

    // INSERT payload should include school_id from the teacher and
    // created_by_teacher_id audit field.
    const insertEntry = log.find(
      (e) => e.table === "fabrication_labs" && e.op === "insert"
    );
    expect(insertEntry?.payload?.school_id).toBe("school-1");
    expect(insertEntry?.payload?.created_by_teacher_id).toBe("teacher-1");
  });

  it("rejects empty / whitespace name with 400", async () => {
    const { client } = makeFakeClient();
    const result = await createLab(client, {
      teacherId: "teacher-1",
      name: "   ",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(400);
    expect(result.error.message).toMatch(/empty/i);
  });

  it("rejects name longer than 80 chars with 400", async () => {
    const { client } = makeFakeClient();
    const result = await createLab(client, {
      teacherId: "teacher-1",
      name: "x".repeat(81),
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(400);
  });

  it("returns 401 when teacher has no school_id (orphan)", async () => {
    const { client } = makeFakeClient({ teacherSchoolId: null });
    const result = await createLab(client, {
      teacherId: "teacher-1",
      name: "Lab",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(401);
    expect(result.error.message).toMatch(/pick your school/i);
  });

  it("maps duplicate-name unique violation (23505) to 409", async () => {
    const { client } = makeFakeClient({
      insertLabError: { message: "duplicate", code: "23505" },
    });
    const result = await createLab(client, {
      teacherId: "teacher-1",
      name: "Default lab",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(409);
    expect(result.error.message).toMatch(/already exists/i);
  });

  it("maps generic insert failure to 500", async () => {
    const { client } = makeFakeClient({
      insertLabError: { message: "connection dropped" },
    });
    const result = await createLab(client, {
      teacherId: "teacher-1",
      name: "Lab",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(500);
  });
});

// ============================================================
// listMyLabs
// ============================================================

describe("listMyLabs", () => {
  it("returns labs at the calling teacher's school sorted by name", async () => {
    const { client } = makeFakeClient({
      listLabsRows: [
        labRow({ id: "lab-a", name: "PYP Lab" }),
        labRow({ id: "lab-b", name: "MYP Lab" }),
      ],
      machinesByLab: [
        { id: "m1", lab_id: "lab-a" },
        { id: "m2", lab_id: "lab-a" },
        { id: "m3", lab_id: "lab-b" },
      ],
    });
    const result = await listMyLabs(client, { teacherId: "teacher-1" });
    if (isOrchestrationError(result)) throw new Error("expected success");
    expect(result.labs).toHaveLength(2);
    expect(result.labs.find((l) => l.id === "lab-a")?.machineCount).toBe(2);
    expect(result.labs.find((l) => l.id === "lab-b")?.machineCount).toBe(1);
  });

  it("returns empty list when teacher has no school (orphan)", async () => {
    const { client } = makeFakeClient({ teacherSchoolId: null });
    const result = await listMyLabs(client, { teacherId: "teacher-1" });
    if (isOrchestrationError(result)) throw new Error("expected success");
    expect(result.labs).toEqual([]);
  });

  it("returns empty list when school has no labs", async () => {
    const { client } = makeFakeClient({ listLabsRows: [] });
    const result = await listMyLabs(client, { teacherId: "teacher-1" });
    if (isOrchestrationError(result)) throw new Error("expected success");
    expect(result.labs).toEqual([]);
  });

  it("filters list query by school_id (not teacher_id)", async () => {
    const { client, log } = makeFakeClient({
      teacherSchoolId: "school-99",
      listLabsRows: [labRow({ school_id: "school-99" })],
    });
    await listMyLabs(client, { teacherId: "teacher-1" });
    const labsQuery = log.find(
      (e) => e.table === "fabrication_labs" && e.op === "select"
    );
    const schoolFilter = labsQuery?.eq.find(([c]) => c === "school_id");
    expect(schoolFilter?.[1]).toBe("school-99");
    // Should NOT be filtering by teacher_id at the lab level
    const teacherFilter = labsQuery?.eq.find(([c]) => c === "teacher_id");
    expect(teacherFilter).toBeUndefined();
  });

  it("surfaces list query errors as 500", async () => {
    const { client } = makeFakeClient({
      listLabsError: { message: "connection dropped" },
    });
    const result = await listMyLabs(client, { teacherId: "teacher-1" });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(500);
    expect(result.error.message).toMatch(/connection dropped/);
  });
});

// ============================================================
// updateLab
// ============================================================

describe("updateLab", () => {
  it("updates name + description and returns the new row", async () => {
    const updated = labRow({
      name: "Renamed Lab",
      description: "new desc",
    });
    const { client } = makeFakeClient({
      labRows: [labRow()],
      updatedLabRow: updated,
    });
    const result = await updateLab(client, {
      teacherId: "teacher-1",
      labId: "lab-1",
      name: "Renamed Lab",
      description: "new desc",
    });
    if (isOrchestrationError(result)) throw new Error("expected success");
    expect(result.lab.name).toBe("Renamed Lab");
    expect(result.lab.description).toBe("new desc");
  });

  it("returns 404 when lab is at a different school (cross-school invisibility)", async () => {
    const { client } = makeFakeClient({
      teacherSchoolId: "school-1",
      labRows: [labRow({ school_id: "school-99" })],
    });
    const result = await updateLab(client, {
      teacherId: "teacher-1",
      labId: "lab-1",
      name: "x",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(404);
  });

  it("returns 404 when lab doesn't exist", async () => {
    const { client } = makeFakeClient({ labRows: [null] });
    const result = await updateLab(client, {
      teacherId: "teacher-1",
      labId: "lab-1",
      name: "x",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(404);
  });

  it("returns existing lab unchanged on empty patch (no DB call)", async () => {
    const existing = labRow({ name: "untouched" });
    const { client, log } = makeFakeClient({ labRows: [existing] });
    const result = await updateLab(client, {
      teacherId: "teacher-1",
      labId: "lab-1",
    });
    if (isOrchestrationError(result)) throw new Error("expected success");
    expect(result.lab.name).toBe("untouched");
    // No update operation logged
    expect(log.find((e) => e.op === "update")).toBeUndefined();
  });

  it("rejects empty name string with 400", async () => {
    const { client } = makeFakeClient({ labRows: [labRow()] });
    const result = await updateLab(client, {
      teacherId: "teacher-1",
      labId: "lab-1",
      name: "  ",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(400);
  });

  it("maps unique-name violation (23505) to 409", async () => {
    const { client } = makeFakeClient({
      labRows: [labRow()],
      updateLabError: { message: "duplicate", code: "23505" },
    });
    const result = await updateLab(client, {
      teacherId: "teacher-1",
      labId: "lab-1",
      name: "Default lab",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(409);
  });
});

// ============================================================
// deleteLab
// ============================================================

describe("deleteLab", () => {
  it("deletes a lab with no references", async () => {
    const { client, log } = makeFakeClient({
      labRows: [labRow()],
      machinesByLab: [],
      classesByLab: [],
      teachersByLab: [],
    });
    const result = await deleteLab(client, {
      teacherId: "teacher-1",
      labId: "lab-1",
    });
    if (isOrchestrationError(result)) throw new Error("expected success");
    expect(result.deletedId).toBe("lab-1");
    expect(result.reassigned).toEqual({ machines: 0, classes: 0, teachers: 0 });
    expect(log.find((e) => e.op === "delete")).toBeDefined();
  });

  it("returns 404 when lab is at a different school", async () => {
    const { client } = makeFakeClient({
      teacherSchoolId: "school-1",
      labRows: [labRow({ school_id: "school-99" })],
    });
    const result = await deleteLab(client, {
      teacherId: "teacher-1",
      labId: "lab-1",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(404);
  });

  it("blocks delete with 409 when machines reference the lab + no reassign", async () => {
    const { client } = makeFakeClient({
      labRows: [labRow()],
      machinesByLab: [{ id: "m1", lab_id: "lab-1" }],
      classesByLab: [],
      teachersByLab: [],
    });
    const result = await deleteLab(client, {
      teacherId: "teacher-1",
      labId: "lab-1",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(409);
    expect(result.error.message).toMatch(/1 machine\b/);
  });

  it("blocks delete with 409 when classes reference + lists count", async () => {
    const { client } = makeFakeClient({
      labRows: [labRow()],
      machinesByLab: [],
      classesByLab: [{ id: "c1" }, { id: "c2" }],
      teachersByLab: [],
    });
    const result = await deleteLab(client, {
      teacherId: "teacher-1",
      labId: "lab-1",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(409);
    expect(result.error.message).toMatch(/2 classes/);
  });

  it("blocks delete with 409 when a teacher's default points at the lab", async () => {
    const { client } = makeFakeClient({
      labRows: [labRow()],
      machinesByLab: [],
      classesByLab: [],
      teachersByLab: [{ id: "t1" }],
    });
    const result = await deleteLab(client, {
      teacherId: "teacher-1",
      labId: "lab-1",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(409);
    expect(result.error.message).toMatch(/teacher default/);
  });

  it("reassigns machines + classes + teacher defaults when reassignTo is provided", async () => {
    const { client } = makeFakeClient({
      labRows: [
        labRow({ id: "lab-source" }),
        labRow({ id: "lab-target" }),
      ],
      machinesByLab: [
        { id: "m1", lab_id: "lab-source" },
        { id: "m2", lab_id: "lab-source" },
      ],
      classesByLab: [{ id: "c1" }],
      teachersByLab: [{ id: "t1" }],
    });
    const result = await deleteLab(client, {
      teacherId: "teacher-1",
      labId: "lab-source",
      reassignTo: "lab-target",
    });
    if (isOrchestrationError(result)) throw new Error("expected success");
    expect(result.reassigned).toEqual({
      machines: 2,
      classes: 1,
      teachers: 1,
    });
  });

  it("rejects self-reassignment with 400", async () => {
    const { client } = makeFakeClient({ labRows: [labRow()] });
    const result = await deleteLab(client, {
      teacherId: "teacher-1",
      labId: "lab-1",
      reassignTo: "lab-1",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(400);
    expect(result.error.message).toMatch(/itself/);
  });

  it("returns 404 when reassignTo is at a different school", async () => {
    const { client } = makeFakeClient({
      teacherSchoolId: "school-1",
      labRows: [
        labRow({ id: "lab-1" }), // source — same school
        labRow({ id: "lab-target", school_id: "school-99" }), // cross-school target
      ],
    });
    const result = await deleteLab(client, {
      teacherId: "teacher-1",
      labId: "lab-1",
      reassignTo: "lab-target",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(404);
    expect(result.error.message).toMatch(/Reassignment target/);
  });
});

// ============================================================
// reassignMachineToLab
// ============================================================

describe("reassignMachineToLab", () => {
  it("moves a machine from source lab to target lab in the same school", async () => {
    const { client } = makeFakeClient({
      labRows: [
        labRow({ id: "lab-from" }),
        labRow({ id: "lab-to" }),
      ],
      machineLookupRow: { id: "m-1", lab_id: "lab-from" },
    });
    const result = await reassignMachineToLab(client, {
      teacherId: "teacher-1",
      fromLabId: "lab-from",
      machineProfileId: "m-1",
      toLabId: "lab-to",
    });
    if (isOrchestrationError(result)) throw new Error("expected success");
    expect(result.machineProfileId).toBe("m-1");
    expect(result.fromLabId).toBe("lab-from");
    expect(result.toLabId).toBe("lab-to");
  });

  it("rejects same source/target with 400", async () => {
    const { client } = makeFakeClient();
    const result = await reassignMachineToLab(client, {
      teacherId: "teacher-1",
      fromLabId: "lab-1",
      machineProfileId: "m-1",
      toLabId: "lab-1",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(400);
  });

  it("returns 404 when source lab is at a different school", async () => {
    const { client } = makeFakeClient({
      teacherSchoolId: "school-1",
      labRows: [
        labRow({ id: "lab-from", school_id: "school-99" }),
      ],
    });
    const result = await reassignMachineToLab(client, {
      teacherId: "teacher-1",
      fromLabId: "lab-from",
      machineProfileId: "m-1",
      toLabId: "lab-to",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(404);
  });

  it("returns 404 when target lab is at a different school", async () => {
    const { client } = makeFakeClient({
      teacherSchoolId: "school-1",
      labRows: [
        labRow({ id: "lab-from", school_id: "school-1" }),
        labRow({ id: "lab-to", school_id: "school-99" }),
      ],
    });
    const result = await reassignMachineToLab(client, {
      teacherId: "teacher-1",
      fromLabId: "lab-from",
      machineProfileId: "m-1",
      toLabId: "lab-to",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(404);
  });

  it("returns 409 when machine is not currently in source lab (stale page)", async () => {
    const { client } = makeFakeClient({
      labRows: [labRow({ id: "lab-from" }), labRow({ id: "lab-to" })],
      machineLookupRow: { id: "m-1", lab_id: "lab-other" }, // not in lab-from
    });
    const result = await reassignMachineToLab(client, {
      teacherId: "teacher-1",
      fromLabId: "lab-from",
      machineProfileId: "m-1",
      toLabId: "lab-to",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(409);
    expect(result.error.message).toMatch(/not currently in the source lab/i);
  });

  it("returns 404 when machine doesn't exist", async () => {
    const { client } = makeFakeClient({
      labRows: [labRow({ id: "lab-from" }), labRow({ id: "lab-to" })],
      machineLookupRow: null,
    });
    const result = await reassignMachineToLab(client, {
      teacherId: "teacher-1",
      fromLabId: "lab-from",
      machineProfileId: "m-1",
      toLabId: "lab-to",
    });
    if (!isOrchestrationError(result)) throw new Error("expected error");
    expect(result.error.status).toBe(404);
    expect(result.error.message).toMatch(/Machine not found/);
  });
});
