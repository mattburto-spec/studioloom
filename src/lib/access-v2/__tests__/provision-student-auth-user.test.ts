/**
 * Tests for provisionStudentAuthUser shared helper.
 *
 * Phase: Access Model v2 Phase 1.1d
 *
 * Covers:
 *   - syntheticEmailForStudentId (pure)
 *   - buildAuthUserPayload (pure, exact shape — Lesson #38)
 *   - provisionStudentAuthUser (mocked Supabase client)
 *   - provisionStudentAuthUserOrThrow (throws on failure)
 *   - Idempotency: re-call on linked student is a no-op
 *   - Recovery: createUser duplicate-email reuses existing auth.users
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CREATED_VIA_TAG,
  SYNTHETIC_EMAIL_DOMAIN,
  buildAuthUserPayload,
  provisionStudentAuthUser,
  provisionStudentAuthUserOrThrow,
  syntheticEmailForStudentId,
} from "../provision-student-auth-user";

// ─────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────

describe("syntheticEmailForStudentId", () => {
  it("produces the documented format", () => {
    expect(syntheticEmailForStudentId("abc-123")).toBe(
      "student-abc-123@students.studioloom.local"
    );
  });
  it("uses the canonical .local domain constant", () => {
    expect(SYNTHETIC_EMAIL_DOMAIN).toBe("students.studioloom.local");
  });
  it("rejects empty / non-string ids", () => {
    expect(() => syntheticEmailForStudentId("")).toThrow(/invalid studentId/);
    // @ts-expect-error
    expect(() => syntheticEmailForStudentId(null)).toThrow(/invalid studentId/);
  });
});

describe("buildAuthUserPayload", () => {
  it("builds the exact documented payload shape (Lesson #38)", () => {
    expect(buildAuthUserPayload({ id: "stu-1", user_id: null, school_id: "sch-1" })).toEqual({
      email: "student-stu-1@students.studioloom.local",
      email_confirm: true,
      user_metadata: { user_type: "student" },
      app_metadata: {
        user_type: "student",
        school_id: "sch-1",
        created_via: "phase-1-1-backfill",
      },
    });
  });
  it("uses CREATED_VIA_TAG constant", () => {
    expect(CREATED_VIA_TAG).toBe("phase-1-1-backfill");
  });
  it("preserves null school_id", () => {
    const p = buildAuthUserPayload({ id: "x", user_id: null, school_id: null });
    expect(p.app_metadata.school_id).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Mock Supabase builder (small — focused on the helper's surface)
// ─────────────────────────────────────────────────────────────────────────

interface MockState {
  authUsers: Array<{ id: string; email: string; app_metadata: Record<string, unknown> }>;
  studentRows: Array<{ id: string; user_id: string | null }>;
  duplicateEmailMode: boolean; // simulate Supabase rejecting createUser due to duplicate
  createUserOverride?: { error: { message: string; code?: string } };
}

function buildMock(state: MockState) {
  const calls = { createUser: 0, listUsers: 0, studentUpdate: 0 };
  const client = {
    auth: {
      admin: {
        createUser: vi.fn((payload: { email: string; app_metadata: Record<string, unknown> }) => {
          calls.createUser += 1;
          if (state.createUserOverride) {
            return Promise.resolve({ data: { user: null }, error: state.createUserOverride.error });
          }
          if (state.duplicateEmailMode) {
            return Promise.resolve({
              data: { user: null },
              error: { message: "User already registered", code: "email_exists" },
            });
          }
          const id = `auth-new-${state.authUsers.length + 1}`;
          state.authUsers.push({ id, email: payload.email, app_metadata: payload.app_metadata });
          return Promise.resolve({ data: { user: { id, email: payload.email } }, error: null });
        }),
        listUsers: vi.fn(() => {
          calls.listUsers += 1;
          return Promise.resolve({ data: { users: state.authUsers }, error: null });
        }),
      },
    },
    from: vi.fn((table: string) => {
      if (table !== "students") throw new Error(`unexpected table: ${table}`);
      return {
        update: vi.fn((patch: Record<string, unknown>) => {
          calls.studentUpdate += 1;
          return {
            eq: vi.fn((_col: string, val: string) => {
              const target = state.studentRows.find((s) => s.id === val);
              if (target) Object.assign(target, patch);
              return Promise.resolve({ error: null });
            }),
          };
        }),
      };
    }),
  };
  return { client: client as never, calls, state };
}

// ─────────────────────────────────────────────────────────────────────────
// provisionStudentAuthUser
// ─────────────────────────────────────────────────────────────────────────

describe("provisionStudentAuthUser", () => {
  let mock: ReturnType<typeof buildMock>;

  beforeEach(() => {
    mock = buildMock({
      authUsers: [],
      studentRows: [{ id: "stu-1", user_id: null }],
      duplicateEmailMode: false,
    });
  });

  it("creates auth.users + links student.user_id when both absent (happy path)", async () => {
    const result = await provisionStudentAuthUser(mock.client, {
      id: "stu-1",
      user_id: null,
      school_id: "sch-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user_id).toBe("auth-new-1");
      expect(result.created).toBe(true);
      expect(result.reused).toBe(false);
      expect(result.skipped).toBe(false);
    }
    expect(mock.calls.createUser).toBe(1);
    expect(mock.calls.listUsers).toBe(0); // happy path: no listUsers needed
    expect(mock.calls.studentUpdate).toBe(1);
    expect(mock.state.authUsers[0].email).toBe("student-stu-1@students.studioloom.local");
  });

  it("skips when student.user_id is already set (idempotent)", async () => {
    const result = await provisionStudentAuthUser(mock.client, {
      id: "stu-already",
      user_id: "auth-existing",
      school_id: "sch-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user_id).toBe("auth-existing");
      expect(result.skipped).toBe(true);
      expect(result.created).toBe(false);
      expect(result.reused).toBe(false);
    }
    expect(mock.calls.createUser).toBe(0);
    expect(mock.calls.studentUpdate).toBe(0);
  });

  it("recovers via duplicate-email lookup when createUser returns email_exists", async () => {
    mock.state.duplicateEmailMode = true;
    // Pre-seed: existing auth.users from a prior partial run
    mock.state.authUsers.push({
      id: "auth-prior",
      email: "student-stu-1@students.studioloom.local",
      app_metadata: {},
    });

    const result = await provisionStudentAuthUser(mock.client, {
      id: "stu-1",
      user_id: null,
      school_id: "sch-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user_id).toBe("auth-prior");
      expect(result.reused).toBe(true);
      expect(result.created).toBe(false);
    }
    expect(mock.calls.createUser).toBe(1);
    expect(mock.calls.listUsers).toBe(1);
    expect(mock.calls.studentUpdate).toBe(1);
  });

  it("recovers via duplicate-email even when error is on .message rather than .code (older SDK)", async () => {
    mock.state.createUserOverride = {
      error: { message: 'duplicate key value violates unique constraint "users_email_idx"' },
    };
    mock.state.authUsers.push({
      id: "auth-prior",
      email: "student-stu-1@students.studioloom.local",
      app_metadata: {},
    });

    const result = await provisionStudentAuthUser(mock.client, {
      id: "stu-1",
      user_id: null,
      school_id: "sch-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reused).toBe(true);
      expect(result.user_id).toBe("auth-prior");
    }
  });

  it("returns ok:false when createUser fails for a non-duplicate reason", async () => {
    mock.state.createUserOverride = {
      error: { message: "rate limit exceeded" },
    };

    const result = await provisionStudentAuthUser(mock.client, {
      id: "stu-1",
      user_id: null,
      school_id: "sch-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/rate limit/);
    }
    expect(mock.calls.studentUpdate).toBe(0); // no update on createUser failure
  });

  it("returns ok:false when createUser duplicates but the auth.users lookup misses (zero rows)", async () => {
    mock.state.duplicateEmailMode = true;
    // No pre-seeded auth.users — lookup will fail
    expect(mock.state.authUsers).toHaveLength(0);

    const result = await provisionStudentAuthUser(mock.client, {
      id: "stu-1",
      user_id: null,
      school_id: "sch-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/lookup failed/);
    }
  });

  it("returns ok:false when the students UPDATE fails", async () => {
    // Override .from('students').update().eq() to return an error
    mock.client.from = vi.fn(() => ({
      update: () => ({
        eq: () => Promise.resolve({ error: { message: "rls denied" } }),
      }),
    })) as never;

    const result = await provisionStudentAuthUser(mock.client, {
      id: "stu-1",
      user_id: null,
      school_id: "sch-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/update students.user_id: rls denied/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// provisionStudentAuthUserOrThrow
// ─────────────────────────────────────────────────────────────────────────

describe("provisionStudentAuthUserOrThrow", () => {
  it("returns user_id on success", async () => {
    const mock = buildMock({
      authUsers: [],
      studentRows: [{ id: "stu-1", user_id: null }],
      duplicateEmailMode: false,
    });
    const result = await provisionStudentAuthUserOrThrow(mock.client, {
      id: "stu-1",
      user_id: null,
      school_id: "sch-1",
    });
    expect(result.user_id).toBeDefined();
    expect(result.created).toBe(true);
  });

  it("throws on failure", async () => {
    const mock = buildMock({
      authUsers: [],
      studentRows: [],
      duplicateEmailMode: false,
      createUserOverride: { error: { message: "auth API down" } },
    });
    await expect(
      provisionStudentAuthUserOrThrow(mock.client, {
        id: "stu-1",
        user_id: null,
        school_id: "sch-1",
      })
    ).rejects.toThrow(/provisionStudentAuthUser failed.*auth API down/);
  });
});
