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
  // Phase 8-1 + Round 2 audit (4 May 2026): teachers row now needs
  // school_id for loadTeacherSchoolId resolution. Calling teacher's
  // school is read FIRST in the new contract.
  teachers?: {
    id: string;
    display_name: string;
    email: string;
    school_id: string | null;
  } | null;
  existingFabricator?: {
    id: string;
    invited_by_teacher_id: string;
    password_hash: string;
    // The inviter's school_id, returned via the
    // `inviter:teachers!fabricators_invited_by_teacher_id_fkey(school_id)`
    // PostgREST embed in findFabricatorByEmail.
    inviterSchoolId: string | null;
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
      // Two callsite shapes:
      //   - loadTeacherSchoolId(callingUser) — selects "school_id"
      //   - findFabricatorByEmail's inviter lookup — also selects
      //     "school_id" but for a DIFFERENT teacher_id (the
      //     existing fab's inviter). The mock differentiates by the
      //     eq value: if it matches the calling teacher's id, return
      //     tableState.teachers; otherwise return the existing fab's
      //     inviter school.
      return {
        select: vi.fn(() => ({
          eq: vi.fn((_col: string, val: unknown) => ({
            maybeSingle: vi.fn(async () => {
              if (val === mockUserId) {
                return { data: tableState.teachers ?? null };
              }
              // Inviter lookup — synthesize a row from the fab's
              // inviterSchoolId fixture.
              if (
                tableState.existingFabricator &&
                val === tableState.existingFabricator.invited_by_teacher_id
              ) {
                return {
                  data: {
                    school_id: tableState.existingFabricator.inviterSchoolId,
                  },
                };
              }
              return { data: null };
            }),
          })),
        })),
      };
    }
    if (table === "fabricators") {
      return {
        select: vi.fn(() => ({
          // findFabricatorByEmail uses two queries — fabricator
          // first (no embed; FK target is auth.users not teachers
          // so PostgREST can't embed), then teachers lookup. Return
          // the bare fab row here.
          ilike: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: tableState.existingFabricator
                ? {
                    id: tableState.existingFabricator.id,
                    email: "test@example.com",
                    display_name: "Test",
                    is_active: true,
                    password_hash: tableState.existingFabricator.password_hash,
                    invited_by_teacher_id:
                      tableState.existingFabricator.invited_by_teacher_id,
                  }
                : null,
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
      teachers: {
        id: "teacher-1",
        display_name: "Matt",
        email: "m@x.com",
        school_id: "school-NIS",
      },
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

  it("ACCEPTS empty machineIds — fabricators see all teacher jobs (Phase 8.1d-9)", async () => {
    // Phase 8.1d-9 dropped the per-machine assignment requirement.
    // machineIds is now optional; the queue + pickup paths scope by
    // inviting teacher_id directly. The junction is deprecated as a
    // visibility mechanism. Future PH9-FU-FAB-MACHINE-RESTRICT may
    // re-introduce per-machine opt-in scoping.
    tableState.insertedFabricator = { id: "fab-empty" };
    const res = await POST(
      makeRequest({ email: "x@x.com", displayName: "X", machineIds: [] })
    );
    expect(res.status).toBe(200);
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

  it("existing fabricator at another school returns 409 (no resend across schools)", async () => {
    // Phase 8-1 + Round 2: school-scoped membership. A fab whose
    // inviter is at a different school is invisible / hijack-protected
    // — School B can't reset a fab originally invited at School A.
    tableState.existingFabricator = {
      id: "fab-other-school",
      invited_by_teacher_id: "teacher-OTHER-SCHOOL",
      password_hash: "somehash",
      inviterSchoolId: "school-OTHER",
    };
    const res = await POST(
      makeRequest({ email: "other@x.com", displayName: "Other", machineIds: ["m-1"] })
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/another school/i);
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it("existing fabricator at SAME school (different teacher persona) without resend returns 409 with hint", async () => {
    // Phase 8-1 + Round 2 flat-membership: the inviter was
    // teacher-OTHER-SAME-SCHOOL, but they share school-NIS with
    // teacher-1 (the calling user). Treated as same-school, so
    // resend hint applies. Replaces the pre-flat-membership
    // "another teacher" hard-block.
    tableState.existingFabricator = {
      id: "fab-shared",
      invited_by_teacher_id: "teacher-OTHER-SAME-SCHOOL",
      password_hash: "oldhash",
      inviterSchoolId: "school-NIS",
    };
    const res = await POST(
      makeRequest({ email: "shared@x.com", displayName: "Shared", machineIds: ["m-1"] })
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.hint).toMatch(/resend=true/);
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it("existing fabricator owned by same teacher without resend flag returns 409 with hint", async () => {
    tableState.existingFabricator = {
      id: "fab-mine",
      invited_by_teacher_id: "teacher-1",
      password_hash: "oldhash",
      inviterSchoolId: "school-NIS",
    };
    const res = await POST(
      makeRequest({ email: "mine@x.com", displayName: "Mine", machineIds: ["m-1"] })
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.hint).toMatch(/resend=true/);
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it("existing fabricator at SAME school with resend=true takes over regardless of original inviter", async () => {
    // Same-school resend works whether the original inviter was
    // teacher-1 OR teacher-OTHER-SAME-SCHOOL. Tests the cross-persona
    // takeover path that the pre-flat-membership code blocked.
    tableState.existingFabricator = {
      id: "fab-other-persona",
      invited_by_teacher_id: "teacher-OTHER-SAME-SCHOOL",
      password_hash: "oldhash",
      inviterSchoolId: "school-NIS",
    };
    const res = await POST(
      makeRequest({
        email: "shared@x.com",
        displayName: "Shared",
        machineIds: ["m-1"],
        resend: true,
      })
    );
    expect(res.status).toBe(200);
    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy.mock.calls[0][0].kind).toBe("invite");
  });

  it("existing fabricator owned by same teacher with resend=true resets password_hash, dispatches email", async () => {
    tableState.existingFabricator = {
      id: "fab-mine",
      invited_by_teacher_id: "teacher-1",
      password_hash: "oldhash",
      inviterSchoolId: "school-NIS",
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
