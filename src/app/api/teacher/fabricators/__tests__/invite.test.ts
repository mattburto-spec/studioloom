import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Unit tests for POST /api/teacher/fabricators invite flow.
 *
 * We mock the module boundaries:
 *   - @supabase/ssr createServerClient → returns a supabase whose auth.getUser
 *     resolves to our test user (or null for the unauthed test)
 *   - @/lib/supabase/admin createAdminClient → returns a controllable mock
 *   - @/lib/preflight/email sendFabricationEmail → spy capture
 *
 * We assert specific payload shapes and specific downstream calls (Lesson #38).
 */

type TableState = {
  teachers?: { id: string; display_name: string; email: string } | null;
  existingFabricator?: {
    id: string;
    invited_by_teacher_id: string;
    password_hash: string;
  } | null;
  insertedFabricator?: { id: string };
  insertError?: { message: string };
};

let tableState: TableState = {};
let emailSpy: ReturnType<typeof vi.fn>;
let sessionSpy: ReturnType<typeof vi.fn>;
let mockUserId: string | null = "teacher-1";

// Mock SSR teacher client.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: mockUserId ? { id: mockUserId } : null },
      })),
    },
  }),
}));

// Mock admin client.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminMock,
}));

const adminMock = {
  from: vi.fn((table: string) => {
    if (table === "teachers") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: tableState.teachers ?? null })),
          })),
        })),
      };
    }
    if (table === "fabricators") {
      return {
        select: vi.fn(() => ({
          ilike: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: tableState.existingFabricator ?? null,
            })),
          })),
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: tableState.insertedFabricator ?? null,
              error: tableState.insertError ?? null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      };
    }
    if (table === "fabricator_machines") {
      return {
        delete: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
        insert: vi.fn(async () => ({ error: null })),
      };
    }
    if (table === "fabricator_sessions") {
      return {
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  }),
};

// Mock email helper.
vi.mock("@/lib/preflight/email", () => ({
  sendFabricationEmail: (...args: unknown[]) => (emailSpy as unknown as (...a: unknown[]) => unknown)(...args),
}));

// Mock createFabricatorSession (don't actually hit token crypto).
vi.mock("@/lib/fab/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fab/auth")>("@/lib/fab/auth");
  return {
    ...actual,
    createFabricatorSession: (...args: unknown[]) => (sessionSpy as unknown as (...a: unknown[]) => unknown)(...args),
  };
});

import { POST } from "../route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/teacher/fabricators", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/teacher/fabricators (invite)", () => {
  beforeEach(() => {
    tableState = {
      teachers: { id: "teacher-1", display_name: "Matt", email: "m@x.com" },
      existingFabricator: null,
      insertedFabricator: { id: "fab-new" },
      insertError: undefined,
    };
    mockUserId = "teacher-1";
    emailSpy = vi.fn(async () => ({ sent: true, skipped: false }));
    sessionSpy = vi.fn(async () => ({
      rawToken: "raw-xyz",
      tokenHash: "hash",
      expiresAt: new Date(),
      sessionId: "sess-1",
    }));
  });

  it("returns 401 when user is not authenticated", async () => {
    mockUserId = null;
    const res = await POST(makeRequest({ email: "x@x.com", displayName: "X", machineIds: ["m1"] }));
    expect(res.status).toBe(401);
  });

  it("rejects missing email with 400", async () => {
    const res = await POST(makeRequest({ displayName: "X", machineIds: ["m1"] }));
    expect(res.status).toBe(400);
  });

  it("rejects empty machineIds with 400", async () => {
    const res = await POST(makeRequest({ email: "x@x.com", displayName: "X", machineIds: [] }));
    expect(res.status).toBe(400);
  });

  it("fresh invite: inserts fabricator, creates setup session, dispatches invite email", async () => {
    const res = await POST(
      makeRequest({ email: "FAB@EXAMPLE.com", displayName: "Cynthia", machineIds: ["m-1", "m-2"] })
    );
    expect(res.status).toBe(200);

    // Email dispatched with correct kind + null jobId
    expect(emailSpy).toHaveBeenCalledTimes(1);
    const emailArg = emailSpy.mock.calls[0][0];
    expect(emailArg.kind).toBe("invite");
    expect(emailArg.jobId).toBeNull();
    expect(emailArg.to).toBe("fab@example.com"); // lowercased
    expect(emailArg.html).toContain("raw-xyz"); // token landed in URL

    // Setup session created (isSetup=true)
    expect(sessionSpy).toHaveBeenCalledTimes(1);
    expect(sessionSpy.mock.calls[0][0].isSetup).toBe(true);
  });

  it("existing fabricator owned by another teacher returns 409 (no resend hint)", async () => {
    tableState.existingFabricator = {
      id: "fab-other",
      invited_by_teacher_id: "teacher-OTHER",
      password_hash: "somehash",
    };
    const res = await POST(
      makeRequest({ email: "other@x.com", displayName: "Other", machineIds: ["m-1"] })
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/another teacher/i);
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it("existing fabricator owned by same teacher without resend flag returns 409 with hint", async () => {
    tableState.existingFabricator = {
      id: "fab-mine",
      invited_by_teacher_id: "teacher-1",
      password_hash: "oldhash",
    };
    const res = await POST(
      makeRequest({ email: "mine@x.com", displayName: "Mine", machineIds: ["m-1"] })
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.hint).toMatch(/resend=true/);
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it("existing fabricator with resend=true resets password_hash, clears setup sessions, dispatches email", async () => {
    tableState.existingFabricator = {
      id: "fab-mine",
      invited_by_teacher_id: "teacher-1",
      password_hash: "oldhash",
    };
    const res = await POST(
      makeRequest({
        email: "mine@x.com",
        displayName: "Mine",
        machineIds: ["m-1"],
        resend: true,
      })
    );
    expect(res.status).toBe(200);
    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy.mock.calls[0][0].kind).toBe("invite");
  });
});
