import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Phase 8-3 route tests for /api/teacher/machine-profiles (GET list,
 * POST create), /api/teacher/machine-profiles/[id] (PATCH + DELETE),
 * and /api/teacher/labs/[id]/bulk-approval (POST).
 *
 * Mocks orchestration; logic covered in machine-orchestration.test.ts.
 * Here we assert auth gating, body parsing, params threading, and
 * HTTP status mapping.
 */

let mockUserId: string | null = "teacher-1";
let createSpy: ReturnType<typeof vi.fn>;
let listSpy: ReturnType<typeof vi.fn>;
let updateSpy: ReturnType<typeof vi.fn>;
let softDeleteSpy: ReturnType<typeof vi.fn>;
let bulkSpy: ReturnType<typeof vi.fn>;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockUserId ? { id: mockUserId, app_metadata: { user_type: "teacher" } } : null },
      })),
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/fabrication/machine-orchestration", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/fabrication/machine-orchestration")
  >("@/lib/fabrication/machine-orchestration");
  return {
    ...actual,
    createMachineProfile: (...args: unknown[]) => createSpy(...args),
    listMyMachines: (...args: unknown[]) => listSpy(...args),
    updateMachineProfile: (...args: unknown[]) => updateSpy(...args),
    softDeleteMachineProfile: (...args: unknown[]) => softDeleteSpy(...args),
    bulkSetApprovalForLab: (...args: unknown[]) => bulkSpy(...args),
  };
});

import { GET as listGet, POST as createPost } from "../route";
import { PATCH as patchRoute, DELETE as deleteRoute } from "../[id]/route";
import { POST as bulkPost } from "../../labs/[id]/bulk-approval/route";
import { NextRequest } from "next/server";

beforeEach(() => {
  mockUserId = "teacher-1";
  createSpy = vi.fn();
  listSpy = vi.fn();
  updateSpy = vi.fn();
  softDeleteSpy = vi.fn();
  bulkSpy = vi.fn();
});

// ============================================================
// GET /api/teacher/machine-profiles
// ============================================================

describe("GET /api/teacher/machine-profiles", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUserId = null;
    const res = await listGet(
      new NextRequest("http://localhost/api/teacher/machine-profiles")
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with both buckets on success", async () => {
    listSpy.mockResolvedValueOnce({
      teacherMachines: [{ id: "t-1" }],
      systemTemplates: [{ id: "tpl-1" }],
    });
    const res = await listGet(
      new NextRequest("http://localhost/api/teacher/machine-profiles")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.teacherMachines).toHaveLength(1);
    expect(json.systemTemplates).toHaveLength(1);
  });

  it("threads includeInactive from query string", async () => {
    listSpy.mockResolvedValueOnce({
      teacherMachines: [],
      systemTemplates: [],
    });
    await listGet(
      new NextRequest(
        "http://localhost/api/teacher/machine-profiles?includeInactive=true"
      )
    );
    expect(listSpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
      includeInactive: true,
    });
  });
});

// ============================================================
// POST /api/teacher/machine-profiles
// ============================================================

describe("POST /api/teacher/machine-profiles", () => {
  function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/teacher/machine-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? "not-json" : JSON.stringify(body),
    });
  }

  it("returns 401 when unauthenticated", async () => {
    mockUserId = null;
    const res = await createPost(makeRequest({ labId: "l1", name: "X" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await createPost(makeRequest(undefined));
    expect(res.status).toBe(400);
  });

  it("returns 400 when labId is missing", async () => {
    const res = await createPost(makeRequest({ name: "X" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/labId/);
  });

  it("returns 201 on successful create (from scratch)", async () => {
    createSpy.mockResolvedValueOnce({
      machine: { id: "new-m", name: "Prusa" },
    });
    const res = await createPost(
      makeRequest({
        labId: "l1",
        name: "Prusa",
        machineCategory: "3d_printer",
        bedSizeXMm: 250,
        bedSizeYMm: 210,
      })
    );
    expect(res.status).toBe(201);
    expect(createSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        teacherId: "teacher-1",
        labId: "l1",
        name: "Prusa",
        machineCategory: "3d_printer",
        bedSizeXMm: 250,
        bedSizeYMm: 210,
      })
    );
  });

  it("threads fromTemplateId through to orchestration", async () => {
    createSpy.mockResolvedValueOnce({
      machine: { id: "copy-1", name: "My X1C" },
    });
    await createPost(
      makeRequest({
        fromTemplateId: "tpl-1",
        labId: "l1",
        name: "My X1C",
      })
    );
    expect(createSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fromTemplateId: "tpl-1" })
    );
  });

  it("propagates 409 from orchestration (duplicate name)", async () => {
    createSpy.mockResolvedValueOnce({
      error: { status: 409, message: "dup" },
    });
    const res = await createPost(
      makeRequest({
        labId: "l1",
        name: "Dup",
        machineCategory: "3d_printer",
        bedSizeXMm: 200,
        bedSizeYMm: 200,
      })
    );
    expect(res.status).toBe(409);
  });
});

// ============================================================
// PATCH /api/teacher/machine-profiles/[id]
// ============================================================

describe("PATCH /api/teacher/machine-profiles/[id]", () => {
  function makeRequest(id: string, body: unknown) {
    return {
      req: new NextRequest(
        `http://localhost/api/teacher/machine-profiles/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: body === undefined ? "not-json" : JSON.stringify(body),
        }
      ),
      context: { params: Promise.resolve({ id }) },
    };
  }

  it("returns 401 when unauthenticated", async () => {
    mockUserId = null;
    const { req, context } = makeRequest("m-1", { name: "x" });
    const res = await patchRoute(req, context);
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed JSON", async () => {
    const { req, context } = makeRequest("m-1", undefined);
    const res = await patchRoute(req, context);
    expect(res.status).toBe(400);
  });

  it("threads machineProfileId + patch fields", async () => {
    updateSpy.mockResolvedValueOnce({ machine: { id: "m-1" } });
    const { req, context } = makeRequest("m-1", {
      name: "Renamed",
      requiresTeacherApproval: true,
    });
    const res = await patchRoute(req, context);
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        teacherId: "teacher-1",
        machineProfileId: "m-1",
        name: "Renamed",
        requiresTeacherApproval: true,
      })
    );
  });

  it("propagates 404 from orchestration", async () => {
    updateSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Machine not found." },
    });
    const { req, context } = makeRequest("nope", { name: "x" });
    const res = await patchRoute(req, context);
    expect(res.status).toBe(404);
  });
});

// ============================================================
// DELETE /api/teacher/machine-profiles/[id]
// ============================================================

describe("DELETE /api/teacher/machine-profiles/[id]", () => {
  function makeRequest(id: string) {
    return {
      req: new NextRequest(
        `http://localhost/api/teacher/machine-profiles/${id}`,
        { method: "DELETE" }
      ),
      context: { params: Promise.resolve({ id }) },
    };
  }

  it("returns 401 when unauthenticated", async () => {
    mockUserId = null;
    const { req, context } = makeRequest("m-1");
    const res = await deleteRoute(req, context);
    expect(res.status).toBe(401);
  });

  it("returns 200 on successful soft-delete", async () => {
    softDeleteSpy.mockResolvedValueOnce({
      machineProfileId: "m-1",
      deactivatedAt: "2026-04-25T00:00:00Z",
    });
    const { req, context } = makeRequest("m-1");
    const res = await deleteRoute(req, context);
    expect(res.status).toBe(200);
  });

  it("propagates 409 when machine has active jobs", async () => {
    softDeleteSpy.mockResolvedValueOnce({
      error: { status: 409, message: "Machine has 2 active jobs." },
    });
    const { req, context } = makeRequest("m-1");
    const res = await deleteRoute(req, context);
    expect(res.status).toBe(409);
  });
});

// ============================================================
// POST /api/teacher/labs/[id]/bulk-approval
// ============================================================

describe("POST /api/teacher/labs/[id]/bulk-approval", () => {
  function makeRequest(labId: string, body: unknown) {
    return {
      req: new NextRequest(
        `http://localhost/api/teacher/labs/${labId}/bulk-approval`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body === undefined ? "not-json" : JSON.stringify(body),
        }
      ),
      context: { params: Promise.resolve({ id: labId }) },
    };
  }

  it("returns 401 when unauthenticated", async () => {
    mockUserId = null;
    const { req, context } = makeRequest("l-1", { requireApproval: true });
    const res = await bulkPost(req, context);
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed JSON", async () => {
    const { req, context } = makeRequest("l-1", undefined);
    const res = await bulkPost(req, context);
    expect(res.status).toBe(400);
  });

  it("returns 400 when requireApproval is missing or non-boolean", async () => {
    const { req, context } = makeRequest("l-1", { requireApproval: "yes" });
    const res = await bulkPost(req, context);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/boolean/i);
  });

  it("threads labId + requireApproval to orchestration", async () => {
    bulkSpy.mockResolvedValueOnce({
      labId: "l-1",
      updatedMachineCount: 3,
      requireApproval: true,
    });
    const { req, context } = makeRequest("l-1", { requireApproval: true });
    const res = await bulkPost(req, context);
    expect(res.status).toBe(200);
    expect(bulkSpy).toHaveBeenCalledWith(expect.anything(), {
      teacherId: "teacher-1",
      labId: "l-1",
      requireApproval: true,
    });
  });

  it("propagates 404 from orchestration", async () => {
    bulkSpy.mockResolvedValueOnce({
      error: { status: 404, message: "Lab not found." },
    });
    const { req, context } = makeRequest("l-other", {
      requireApproval: true,
    });
    const res = await bulkPost(req, context);
    expect(res.status).toBe(404);
  });
});
