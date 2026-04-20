import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateSetupSession } from "../auth";
import { hashFabToken } from "../token";

/**
 * Unit tests for validateSetupSession — the helper shared by
 * /api/fab/set-password/verify and /api/fab/set-password/submit.
 *
 * Each assertion checks a SPECIFIC expected value (Lesson #38), not just ok/null.
 */

interface MockState {
  session: {
    id: string;
    fabricator_id: string;
    is_setup: boolean;
    expires_at: string;
  } | null;
  fabricator: {
    id: string;
    email: string;
    display_name: string;
    is_active: boolean;
  } | null;
  filters: {
    tokenHash?: string;
    isSetup?: boolean;
  };
}

function buildMockSupabase(state: MockState): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      if (table === "fabricator_sessions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col1: string, val1: string | boolean) => ({
              eq: vi.fn((col2: string, val2: string | boolean) => ({
                gt: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => {
                    state.filters = {
                      tokenHash: col1 === "session_token_hash" ? String(val1) : undefined,
                      isSetup: col2 === "is_setup" ? Boolean(val2) : undefined,
                    };
                    return { data: state.session };
                  }),
                })),
              })),
            })),
          })),
        };
      }
      if (table === "fabricators") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: state.fabricator })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  } as unknown as SupabaseClient;
}

const VALID_SETUP_SESSION = {
  id: "setup-sess-1",
  fabricator_id: "fab-1",
  is_setup: true,
  expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
};
const ACTIVE_FAB = {
  id: "fab-1",
  email: "fab@example.com",
  display_name: "Cynthia Chen",
  is_active: true,
};

describe("validateSetupSession", () => {
  let state: MockState;
  let supabase: SupabaseClient;

  beforeEach(() => {
    state = {
      session: VALID_SETUP_SESSION,
      fabricator: ACTIVE_FAB,
      filters: {},
    };
    supabase = buildMockSupabase(state);
  });

  it("returns null on empty token (no database call made)", async () => {
    const fromSpy = supabase.from as ReturnType<typeof vi.fn>;
    const result = await validateSetupSession("", supabase);
    expect(result).toBeNull();
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("hashes token and filters fabricator_sessions to is_setup=true", async () => {
    await validateSetupSession("raw-token", supabase);
    expect(state.filters.tokenHash).toBe(hashFabToken("raw-token"));
    expect(state.filters.isSetup).toBe(true);
  });

  it("returns null when session row is missing (expired sessions filtered by .gt)", async () => {
    state.session = null;
    const result = await validateSetupSession("raw", supabase);
    expect(result).toBeNull();
  });

  it("returns null when session is a login session (is_setup=false wouldn't match filter)", async () => {
    // The .eq('is_setup', true) in the helper means a login-session row
    // won't be returned. Simulate: session=null (doesn't match filter).
    state.session = null;
    const result = await validateSetupSession("raw", supabase);
    expect(result).toBeNull();
  });

  it("returns null when fabricator is inactive (guards is_active)", async () => {
    state.fabricator = { ...ACTIVE_FAB, is_active: false };
    const result = await validateSetupSession("raw", supabase);
    expect(result).toBeNull();
  });

  it("returns null when fabricator row is missing", async () => {
    state.fabricator = null;
    const result = await validateSetupSession("raw", supabase);
    expect(result).toBeNull();
  });

  it("returns {sessionId, fabricator} on happy path", async () => {
    const result = await validateSetupSession("raw", supabase);
    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe("setup-sess-1");
    expect(result!.fabricator.id).toBe("fab-1");
    expect(result!.fabricator.display_name).toBe("Cynthia Chen");
    expect(result!.fabricator.is_active).toBe(true);
  });
});
