/**
 * Unit tests for POST /api/auth/student-classcode-login (Phase 1.2).
 *
 * We mock the module boundaries:
 *   - next/headers cookies()              → fake writable cookie store
 *   - @supabase/ssr createServerClient    → mock with auth.verifyOtp
 *   - @/lib/supabase/admin createAdminClient → state-driven mock
 *   - @/lib/rate-limit rateLimit          → controllable allow/deny
 *   - @/lib/access-v2/provision-student-auth-user → controllable shim
 *
 * Tests assert specific payload shapes for audit_events inserts (Lesson #38)
 * and specific downstream call counts (verify, generateLink, audit).
 *
 * Coverage:
 *   - 400 on bad body
 *   - 429 + audit on per-IP rate limit
 *   - 401 + audit on invalid class code
 *   - 401 + audit on student not found
 *   - 503 + audit on lazy provisioning failure
 *   - 503 + audit on generateLink failure
 *   - 503 + audit on verifyOtp failure
 *   - 200 + cookies + audit success on happy path
 *   - 200 lazy-provision triggers when user_id is NULL
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────
// Mock state (mutated per-test in beforeEach)
// ─────────────────────────────────────────────────────────────────────────

interface ClassRow {
  id: string;
  name: string;
  school_id: string | null;
  teacher_id: string | null;
  code?: string;
}

interface MockState {
  cookieStore: { name: string; value: string; options?: Record<string, unknown> }[];
  rateLimitAllowed: boolean;
  rateLimitRetryAfterMs: number;
  classRow: ClassRow | null;
  enrollmentRows: Array<{ student_id: string; students: Record<string, unknown> | null }>;
  legacyStudent: Record<string, unknown> | null;
  orphanStudent: Record<string, unknown> | null;
  provisionThrows: boolean;
  generateLinkResult:
    | { data: { properties: { hashed_token: string } }; error: null }
    | { data: null; error: { message: string } };
  verifyOtpResult:
    | { data: { session: { access_token: string }; user: { id: string } }; error: null }
    | { data: null; error: { message: string } };
  auditInserts: Array<Record<string, unknown>>;
}

let state: MockState;

beforeEach(() => {
  state = {
    cookieStore: [],
    rateLimitAllowed: true,
    rateLimitRetryAfterMs: 60_000,
    classRow: {
      id: "class-1",
      name: "Test Class",
      school_id: "school-1",
      teacher_id: "teacher-1",
    },
    enrollmentRows: [
      {
        student_id: "stu-1",
        students: {
          id: "stu-1",
          username: "alice",
          display_name: "Alice",
          ell_level: 3,
          user_id: "auth-1",
          school_id: "school-1",
        },
      },
    ],
    legacyStudent: null,
    orphanStudent: null,
    provisionThrows: false,
    generateLinkResult: {
      data: { properties: { hashed_token: "th-abc" } },
      error: null,
    },
    verifyOtpResult: {
      data: { session: { access_token: "at-abc" }, user: { id: "auth-1" } },
      error: null,
    },
    auditInserts: [],
  };
});

// ─────────────────────────────────────────────────────────────────────────
// Module mocks — declared BEFORE the route is imported
// ─────────────────────────────────────────────────────────────────────────

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => state.cookieStore,
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      state.cookieStore.push({ name, value, options });
    },
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      verifyOtp: vi.fn(async () => state.verifyOtpResult),
    },
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({
    allowed: state.rateLimitAllowed,
    retryAfterMs: state.rateLimitAllowed ? 0 : state.rateLimitRetryAfterMs,
  })),
}));

vi.mock("@/lib/access-v2/provision-student-auth-user", async (importOriginal) => {
  // Keep syntheticEmailForStudentId real (it's pure); mock only the throwing variant.
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    provisionStudentAuthUserOrThrow: vi.fn(async () => {
      if (state.provisionThrows) {
        throw new Error("provision boom");
      }
      return { user_id: "auth-lazy", created: true, reused: false, skipped: false };
    }),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminMock,
}));

// ─────────────────────────────────────────────────────────────────────────
// Admin client mock — state-driven shim for from(table).chain
// ─────────────────────────────────────────────────────────────────────────

const adminMock = {
  from: vi.fn((table: string) => {
    if (table === "classes") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: state.classRow,
              error: state.classRow ? null : { message: "no row" },
            }),
          }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    }
    if (table === "class_students") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              not: async () => ({
                data: state.enrollmentRows,
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    if (table === "students") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.legacyStudent ?? state.orphanStudent ?? null,
                error: null,
              }),
            }),
          }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    }
    if (table === "audit_events") {
      return {
        insert: async (row: Record<string, unknown>) => {
          state.auditInserts.push(row);
          return { error: null };
        },
      };
    }
    throw new Error(`Unmocked table: ${table}`);
  }),
  auth: {
    admin: {
      generateLink: vi.fn(async () => state.generateLinkResult),
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Helper: build NextRequest-shaped object the handler can ingest
// ─────────────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, ip = "10.0.0.1") {
  // Construct a minimal NextRequest-ish object with the methods the handler reads.
  return {
    headers: {
      get: (key: string) => {
        const k = key.toLowerCase();
        if (k === "x-forwarded-for") return ip;
        if (k === "user-agent") return "vitest";
        return null;
      },
    },
    json: async () => body,
  } as unknown as import("next/server").NextRequest;
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

async function importHandler() {
  const mod = await import("../route");
  return mod.POST;
}

describe("POST /api/auth/student-classcode-login", () => {
  it("returns 400 on missing classCode/username", async () => {
    const POST = await importHandler();
    const res = await POST(makeRequest({ classCode: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 429 + audit on per-IP rate limit", async () => {
    state.rateLimitAllowed = false;
    const POST = await importHandler();
    const res = await POST(makeRequest({ classCode: "ABC123", username: "alice" }));
    expect(res.status).toBe(429);
    expect(state.auditInserts).toHaveLength(1);
    expect(state.auditInserts[0]).toMatchObject({
      action: "student.login.classcode.rate_limited",
      severity: "warn",
      actor_type: "system",
    });
    // Cache-Control on rate-limit response (Vercel CDN gotcha)
    expect(res.headers.get("Cache-Control")).toMatch(/private/);
  });

  it("returns 401 + audit on invalid class code", async () => {
    state.classRow = null;
    const POST = await importHandler();
    const res = await POST(makeRequest({ classCode: "BADCODE", username: "alice" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid class code");
    expect(state.auditInserts.at(-1)).toMatchObject({
      action: "student.login.classcode.failed",
      payload_jsonb: expect.objectContaining({
        classCode: "BADCODE",
        failureReason: "invalid_class_code",
      }),
    });
  });

  it("returns 401 + audit when student is not in the class", async () => {
    state.enrollmentRows = []; // no enrollment match
    state.legacyStudent = null;
    state.orphanStudent = null;
    const POST = await importHandler();
    const res = await POST(makeRequest({ classCode: "ABC", username: "ghost" }));
    expect(res.status).toBe(401);
    expect(state.auditInserts.at(-1)).toMatchObject({
      action: "student.login.classcode.failed",
      payload_jsonb: expect.objectContaining({ failureReason: "student_not_in_class" }),
    });
  });

  it("returns 503 + audit when lazy provisioning fails", async () => {
    state.enrollmentRows = [
      {
        student_id: "stu-2",
        students: {
          id: "stu-2",
          username: "bob",
          display_name: "Bob",
          ell_level: 3,
          user_id: null, // triggers lazy provision
          school_id: "school-1",
        },
      },
    ];
    state.provisionThrows = true;
    const POST = await importHandler();
    const res = await POST(makeRequest({ classCode: "ABC", username: "bob" }));
    expect(res.status).toBe(503);
    expect(state.auditInserts.at(-1)).toMatchObject({
      action: "student.login.classcode.failed",
      payload_jsonb: expect.objectContaining({ failureReason: "lazy_provision_failed" }),
    });
  });

  it("returns 503 + audit when generateLink fails", async () => {
    state.generateLinkResult = { data: null, error: { message: "boom" } };
    const POST = await importHandler();
    const res = await POST(makeRequest({ classCode: "ABC", username: "alice" }));
    expect(res.status).toBe(503);
    expect(state.auditInserts.at(-1)).toMatchObject({
      action: "student.login.classcode.failed",
      payload_jsonb: expect.objectContaining({ failureReason: "generate_link_failed" }),
    });
  });

  it("returns 503 + audit when verifyOtp fails", async () => {
    state.verifyOtpResult = { data: null, error: { message: "otp boom" } };
    const POST = await importHandler();
    const res = await POST(makeRequest({ classCode: "ABC", username: "alice" }));
    expect(res.status).toBe(503);
    expect(state.auditInserts.at(-1)).toMatchObject({
      action: "student.login.classcode.failed",
      payload_jsonb: expect.objectContaining({ failureReason: "verify_otp_failed" }),
    });
  });

  it("happy path: returns 200 + success audit + Cache-Control: private", async () => {
    const POST = await importHandler();
    const res = await POST(makeRequest({ classCode: "ABC", username: "alice" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.student).toEqual({
      id: "stu-1",
      username: "alice",
      display_name: "Alice",
    });
    expect(body.className).toBe("Test Class");

    // Cache-Control: private (Vercel CDN gotcha)
    expect(res.headers.get("Cache-Control")).toMatch(/private/);

    // Last audit entry is the success row
    expect(state.auditInserts.at(-1)).toMatchObject({
      action: "student.login.classcode.success",
      severity: "info",
      actor_type: "student",
      actor_id: "auth-1",
      target_table: "students",
      target_id: "stu-1",
      school_id: "school-1",
      class_id: "class-1",
    });
  });

  it("lazy-provision: when student.user_id is NULL, provisions via helper and audit shows actor_id=auth-lazy", async () => {
    state.enrollmentRows = [
      {
        student_id: "stu-3",
        students: {
          id: "stu-3",
          username: "charlie",
          display_name: "Charlie",
          ell_level: 3,
          user_id: null, // triggers lazy provision
          school_id: "school-1",
        },
      },
    ];
    const POST = await importHandler();
    const res = await POST(makeRequest({ classCode: "ABC", username: "charlie" }));
    expect(res.status).toBe(200);
    expect(state.auditInserts.at(-1)).toMatchObject({
      action: "student.login.classcode.success",
      actor_id: "auth-lazy", // proves lazy provisionStudentAuthUserOrThrow ran
    });
  });
});
