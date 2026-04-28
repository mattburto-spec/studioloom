import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Phase 8-2 route tests for /api/teacher/labs (GET list, POST create)
 * + /api/teacher/labs/[id] (PATCH, DELETE)
 * + /api/teacher/labs/[id]/machines (PATCH reassign).
 *
 * Mocks the module boundaries — orchestration functions are spied on,
 * their internal logic is covered by lab-orchestration.test.ts. Here
 * we verify:
 *   - 401 when no teacher session
 *   - Body parsing (bad JSON → 400; wrong types → 400)
 *   - Correct params passed to orchestration
 *   - Orchestration result mapped to correct HTTP status
 *   - Cache-Control private/no-cache header set
 */

let mockUserId: string | null = "teacher-1";
let listMyLabsSpy: ReturnType<typeof vi.fn>;
let createLabSpy: ReturnType<typeof vi.fn>;
let updateLabSpy: ReturnType<typeof vi.fn>;
let deleteLabSpy: ReturnType<typeof vi.fn>;
let reassignSpy: ReturnType<typeof vi.fn>;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockUserId ? { id: mockUserId } : null },
      })),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/fabrication/lab-orchestration", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/fabrication/lab-orchestration")
  >("@/lib/fabrication/lab-orchestration");
  return {
    ...actual, // keep isOrchestrationError as the real helper
    createLab: (...args: unknown[]) => createLabSpy(...args),
    listMyLabs: (...args: unknown[]) => listMyLabsSpy(...args),
    updateLab: (...args: unknown[]) => updateLabSpy(...args),
    deleteLab: (...args: unknown[]) => deleteLabSpy(...args),
    reassignMachineToLab: (...args: unknown[]) => reassignSpy(...args),
  };
});

import { GET as listGet, POST as createPost } from "../route";
import { PATCH as updatePatch, DELETE as deleteRoute } from "../[id]/route";
import { PATCH as reassignPatch } from "../[id]/machines/route";
import { NextRequest } from "next/server";

beforeEach(() => {
  mockUserId = "teacher-1";
  listMyLabsSpy = vi.fn();
  createLabSpy = vi.fn();
  updateLabSpy = vi.fn();
  deleteLabSpy = vi.fn();
  reassignSpy = vi.fn();
});

// ============================================================
// GET /api/teacher/labs
// ============================================================

describe("GET /api/teacher/labs", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUserId = null;
    const res = await listGet(
      new NextRequest("http://localhost/api/teacher/labs")
    );
    expect(res.status).toBe(401);
  });

  it("passes teacherId + returns labs on success", async () => {
    listMyLabsSpy.mockResolvedValueOnce({
      labs: [
        {
          id: "lab-1",
          schoolId: "school-1",
          createdByTeacherId: "teacher-1",
          name: "Default lab",
          description: null,
          createdAt: "2026-04-28T00:00:00Z",
          updatedAt: "2026-04-28T00:00:00Z",
          machineCount: 2,
        },
      ],
    });
    const res = await listGet(
      new NextRequest("http://localhost/api/teacher/labs")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.labs).toHaveLength(1);
    expect(json.labs[0].machineCount).toBe(2);
    expect(listMyLabsSpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
    });
  });

  it("propagates orchestration error status", async () => {
    listMyLabsSpy.mockResolvedValueOnce({
      error: { status: 500, message: "db dead" },
    });
    const res = await listGet(
      new NextRequest("http://localhost/api/teacher/labs")
    );
    expect(res.status).toBe(500);
  });

  it("sets Cache-Control: private, no-cache on responses", async () => {
    listMyLabsSpy.mockResolvedValueOnce({ labs: [] });
    const res = await listGet(
      new NextRequest("http://localhost/api/teacher/labs")
    );
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.headers.get("cache-control")).toContain("no-cache");
  });
});

// ============================================================
// POST /api/teacher/labs
// ============================================================

describe("POST /api/teacher/labs", () => {
  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/teacher/labs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? "not-json" : JSON.stringify(body),
    });
  }

  it("returns 401 when unauthenticated", async () => {
    mockUserId = null;
    const res = await createPost(makeRequest({ name: "x" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed JSON body", async () => {
    const res = await createPost(makeRequest(undefined));
    expect(res.status).toBe(400);
    expect(createLabSpy).not.toHaveBeenCalled();
  });

  it("passes body through to createLab + returns 201 on success", async () => {
    createLabSpy.mockResolvedValueOnce({
      lab: {
        id: "new-lab",
        schoolId: "school-1",
        createdByTeacherId: "teacher-1",
        name: "2nd floor",
        description: "north wing",
        createdAt: "2026-04-28T00:00:00Z",
        updatedAt: "2026-04-28T00:00:00Z",
      },
    });
    const res = await createPost(
      makeRequest({
        name: "2nd floor",
        description: "north wing",
      })
    );
    expect(res.status).toBe(201);
    expect(createLabSpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
      name: "2nd floor",
      description: "north wing",
    });
  });

  it("propagates validation 400 from orchestration", async () => {
    createLabSpy.mockResolvedValueOnce({
      error: { status: 400, message: "`name` cannot be empty." },
    });
    const res = await createPost(makeRequest({ name: "" }));
    expect(res.status).toBe(400);
  });

  it("propagates 409 on duplicate name (revised — was 'duplicate default')", async () => {
    createLabSpy.mockResolvedValueOnce({
      error: {
        status: 409,
        message: "A lab named \"x\" already exists at your school.",
      },
    });
    const res = await createPost(makeRequest({ name: "x" }));
    expect(res.status).toBe(409);
  });
});

// ============================================================
// PATCH /api/teacher/labs/[id]
// ============================================================

describe("PATCH /api/teacher/labs/[id]", () => {
  function makeRequest(id: string, body: unknown) {
    return {
      req: new NextRequest(`http://localhost/api/teacher/labs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? "not-json" : JSON.stringify(body),
      }),
      context: { params: Promise.resolve({ id }) },
    };
  }

  it("returns 401 when unauthenticated", async () => {
    mockUserId = null;
    const { req, context } = makeRequest("lab-1", { name: "x" });
    const res = await updatePatch(req, context);
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed JSON", async () => {
    const { req, context } = makeRequest("lab-1", undefined);
    const res = await updatePatch(req, context);
    expect(res.status).toBe(400);
  });

  it("passes labId + body fields to updateLab", async () => {
    updateLabSpy.mockResolvedValueOnce({
      lab: {
        id: "lab-1",
        schoolId: "school-1",
        createdByTeacherId: "teacher-1",
        name: "Renamed",
        description: null,
        createdAt: "2026-04-28T00:00:00Z",
        updatedAt: "2026-04-28T00:00:00Z",
      },
    });
    const { req, context } = makeRequest("lab-1", {
      name: "Renamed",
      description: null,
    });
    const res = await updatePatch(req, context);
    expect(res.status).toBe(200);
    expect(updateLabSpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
      labId: "lab-1",
      name: "Renamed",
      description: null,
    });
  });

  it("propagates 404 for cross-teacher access", async () => {
    updateLabSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Lab not found." },
    });
    const { req, context } = makeRequest("lab-other", { name: "x" });
    const res = await updatePatch(req, context);
    expect(res.status).toBe(404);
  });
});

// ============================================================
// DELETE /api/teacher/labs/[id]
// ============================================================

describe("DELETE /api/teacher/labs/[id]", () => {
  function makeRequest(id: string, reassignTo?: string) {
    const url = reassignTo
      ? `http://localhost/api/teacher/labs/${id}?reassignTo=${reassignTo}`
      : `http://localhost/api/teacher/labs/${id}`;
    return {
      req: new NextRequest(url, { method: "DELETE" }),
      context: { params: Promise.resolve({ id }) },
    };
  }

  it("returns 401 when unauthenticated", async () => {
    mockUserId = null;
    const { req, context } = makeRequest("lab-1");
    const res = await deleteRoute(req, context);
    expect(res.status).toBe(401);
  });

  it("passes labId without reassignTo for empty-lab delete", async () => {
    deleteLabSpy.mockResolvedValueOnce({
      deletedId: "lab-1",
      reassigned: { machines: 0, classes: 0, teachers: 0 },
    });
    const { req, context } = makeRequest("lab-1");
    const res = await deleteRoute(req, context);
    expect(res.status).toBe(200);
    expect(deleteLabSpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
      labId: "lab-1",
      reassignTo: undefined,
    });
  });

  it("passes reassignTo from query string", async () => {
    deleteLabSpy.mockResolvedValueOnce({
      deletedId: "lab-1",
      reassigned: { machines: 3, classes: 0, teachers: 0 },
    });
    const { req, context } = makeRequest("lab-1", "lab-2");
    const res = await deleteRoute(req, context);
    expect(res.status).toBe(200);
    expect(deleteLabSpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
      labId: "lab-1",
      reassignTo: "lab-2",
    });
  });

  it("propagates 409 when lab has machines + no reassignTo", async () => {
    deleteLabSpy.mockResolvedValueOnce({
      error: { status: 409, message: "Lab has 2 machines..." },
    });
    const { req, context } = makeRequest("lab-1");
    const res = await deleteRoute(req, context);
    expect(res.status).toBe(409);
  });
});

// ============================================================
// PATCH /api/teacher/labs/[id]/machines
// ============================================================

describe("PATCH /api/teacher/labs/[id]/machines", () => {
  function makeRequest(labId: string, body: unknown) {
    return {
      req: new NextRequest(
        `http://localhost/api/teacher/labs/${labId}/machines`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: body === undefined ? "not-json" : JSON.stringify(body),
        }
      ),
      context: { params: Promise.resolve({ id: labId }) },
    };
  }

  it("returns 401 when unauthenticated", async () => {
    mockUserId = null;
    const { req, context } = makeRequest("lab-1", {
      machineProfileId: "m1",
      toLabId: "lab-2",
    });
    const res = await reassignPatch(req, context);
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed JSON", async () => {
    const { req, context } = makeRequest("lab-1", undefined);
    const res = await reassignPatch(req, context);
    expect(res.status).toBe(400);
  });

  it("returns 400 when machineProfileId is missing", async () => {
    const { req, context } = makeRequest("lab-1", {
      toLabId: "lab-2",
    });
    const res = await reassignPatch(req, context);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/machineProfileId/);
  });

  it("returns 400 when toLabId is missing", async () => {
    const { req, context } = makeRequest("lab-1", {
      machineProfileId: "m1",
    });
    const res = await reassignPatch(req, context);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/toLabId/);
  });

  it("passes all params to reassignMachineToLab + 200 on success", async () => {
    reassignSpy.mockResolvedValueOnce({
      machineProfileId: "m1",
      previousLabId: "lab-1",
      newLabId: "lab-2",
    });
    const { req, context } = makeRequest("lab-1", {
      machineProfileId: "m1",
      toLabId: "lab-2",
    });
    const res = await reassignPatch(req, context);
    expect(res.status).toBe(200);
    expect(reassignSpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
      fromLabId: "lab-1",
      machineProfileId: "m1",
      toLabId: "lab-2",
    });
  });

  it("propagates 409 from orchestration (e.g. system template)", async () => {
    reassignSpy.mockResolvedValueOnce({
      error: { status: 409, message: "System-template machines..." },
    });
    const { req, context } = makeRequest("lab-1", {
      machineProfileId: "sys-1",
      toLabId: "lab-2",
    });
    const res = await reassignPatch(req, context);
    expect(res.status).toBe(409);
  });
});
