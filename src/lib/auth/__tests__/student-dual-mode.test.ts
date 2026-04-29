/**
 * Tests for Phase 1.4a — dual-mode requireStudentAuth + getStudentId.
 *
 * Verifies the legacy-helper-now-checks-Supabase-first behaviour without
 * breaking any of the 63 existing student routes.
 *
 * Coverage:
 *   - Supabase session present → returns studentId from session (legacy not consulted)
 *   - Supabase session absent + legacy cookie + valid student_sessions row → legacy returns studentId
 *   - Supabase session absent + legacy cookie + expired/missing → null
 *   - Both absent → null
 *   - Supabase session throws → falls back to legacy (defensive)
 *   - requireStudentAuth wraps the dual-mode lookup correctly
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────
// Mock state
// ─────────────────────────────────────────────────────────────────────────

interface MockState {
  supabaseSession:
    | { type: "student"; studentId: string; userId: string; schoolId: string | null }
    | null;
  supabaseThrows: boolean;
  legacyCookie: string | null;
  legacyTableRow: { student_id: string } | null;
}

let state: MockState;

beforeEach(() => {
  state = {
    supabaseSession: null,
    supabaseThrows: false,
    legacyCookie: null,
    legacyTableRow: null,
  };
});

// ─────────────────────────────────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────────────────────────────────

// Constants are pulled by student.ts transitively — declare a stub so
// vitest's module graph doesn't try to resolve the real one.
vi.mock("@/lib/constants", () => ({
  SESSION_COOKIE_NAME: "questerra_student_session",
  SESSION_DURATION_DAYS: 7,
  FAB_SESSION_COOKIE_NAME: "questerra_fab_session",
  FAB_SESSION_DURATION_DAYS: 30,
  FAB_SETUP_SESSION_DURATION_HOURS: 24,
}));

// Same for the SSR module — actor-session.ts pulls it transitively;
// the test never reaches code that calls it (we mock actor-session
// directly), but vitest's analyzer still walks the graph.
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/access-v2/actor-session", () => ({
  getStudentSession: vi.fn(async () => {
    if (state.supabaseThrows) throw new Error("ssr boom");
    return state.supabaseSession;
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          gt: () => ({
            maybeSingle: async () => ({
              data: state.legacyTableRow,
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
}));

// ─────────────────────────────────────────────────────────────────────────
// Helper: build a NextRequest-shaped object with a cookie
// ─────────────────────────────────────────────────────────────────────────

function makeRequest(opts: { legacyCookie?: string | null } = {}): import("next/server").NextRequest {
  const cookies = new Map<string, { value: string }>();
  if (opts.legacyCookie) {
    cookies.set("questerra_student_session", { value: opts.legacyCookie });
  }
  return {
    cookies: {
      get: (name: string) => cookies.get(name),
    },
  } as unknown as import("next/server").NextRequest;
}

async function importHelpers() {
  return import("../student");
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe("getStudentId — Phase 1.4a dual-mode", () => {
  it("returns studentId from Supabase session when present (skips legacy)", async () => {
    state.supabaseSession = {
      type: "student",
      studentId: "stu-supabase",
      userId: "auth-1",
      schoolId: "school-1",
    };
    state.legacyCookie = "legacy-token-should-not-be-checked";
    state.legacyTableRow = { student_id: "stu-legacy" };

    const { getStudentId } = await importHelpers();
    const id = await getStudentId(makeRequest({ legacyCookie: "legacy-token-should-not-be-checked" }));
    expect(id).toBe("stu-supabase");
  });

  it("falls back to legacy when no Supabase session AND legacy cookie + row present", async () => {
    state.supabaseSession = null;
    state.legacyTableRow = { student_id: "stu-legacy" };

    const { getStudentId } = await importHelpers();
    const id = await getStudentId(makeRequest({ legacyCookie: "valid-token" }));
    expect(id).toBe("stu-legacy");
  });

  it("returns null when no Supabase session AND no legacy cookie", async () => {
    state.supabaseSession = null;
    const { getStudentId } = await importHelpers();
    expect(await getStudentId(makeRequest())).toBeNull();
  });

  it("returns null when legacy cookie present but no matching table row (expired/invalid)", async () => {
    state.supabaseSession = null;
    state.legacyTableRow = null; // simulates expired or invalid token
    const { getStudentId } = await importHelpers();
    expect(await getStudentId(makeRequest({ legacyCookie: "expired-token" }))).toBeNull();
  });

  it("falls back to legacy when getStudentSession throws (defensive — never 5xx the route)", async () => {
    state.supabaseThrows = true;
    state.legacyTableRow = { student_id: "stu-legacy-after-ssr-error" };
    const { getStudentId } = await importHelpers();
    const id = await getStudentId(makeRequest({ legacyCookie: "valid-token" }));
    expect(id).toBe("stu-legacy-after-ssr-error");
  });

  it("returns null when both paths fail (Supabase throws + no legacy cookie)", async () => {
    state.supabaseThrows = true;
    const { getStudentId } = await importHelpers();
    expect(await getStudentId(makeRequest())).toBeNull();
  });
});

describe("requireStudentAuth — Phase 1.4a dual-mode wrapper", () => {
  it("returns { studentId } from Supabase path", async () => {
    state.supabaseSession = {
      type: "student",
      studentId: "stu-1",
      userId: "auth-1",
      schoolId: "school-1",
    };
    const { requireStudentAuth } = await importHelpers();
    const result = await requireStudentAuth(makeRequest());
    expect(result).toEqual({ studentId: "stu-1" });
    expect("error" in result).toBe(false);
  });

  it("returns { studentId } from legacy fallback path", async () => {
    state.legacyTableRow = { student_id: "stu-legacy" };
    const { requireStudentAuth } = await importHelpers();
    const result = await requireStudentAuth(makeRequest({ legacyCookie: "valid" }));
    expect(result).toEqual({ studentId: "stu-legacy" });
  });

  it("returns { error: 401 NextResponse } when both paths fail", async () => {
    const { requireStudentAuth } = await importHelpers();
    const result = await requireStudentAuth(makeRequest());
    expect("error" in result).toBe(true);
    if ("error" in result && result.error) {
      expect(result.error.status).toBe(401);
    }
  });
});
