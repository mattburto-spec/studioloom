import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createFabricatorSession,
  getFabricator,
  requireFabricatorAuth,
  destroyFabricatorSession,
  FAB_PRIVATE_CACHE_HEADERS,
} from "../auth";
import { hashFabToken } from "../token";
import { FAB_SESSION_COOKIE_NAME } from "@/lib/constants";

/**
 * Mock createAdminClient so getFabricator / destroyFabricatorSession use
 * whatever we hand them.
 */
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminClient,
}));

let mockAdminClient: SupabaseClient;

interface MockAdminState {
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
  deleteCapture: { tokenHash: string } | null;
  sessionFilters: { tokenHash?: string; isSetup?: boolean } | null;
}

function buildMockAdmin(state: MockAdminState): SupabaseClient {
  return {
    from: vi.fn((table: string) => {
      if (table === "fabricator_sessions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col1: string, val1: string | boolean) => ({
              eq: vi.fn((col2: string, val2: string | boolean) => ({
                gt: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => {
                    state.sessionFilters = {
                      tokenHash: col1 === "session_token_hash" ? String(val1) : undefined,
                      isSetup: col2 === "is_setup" ? Boolean(val2) : undefined,
                    };
                    return { data: state.session };
                  }),
                })),
              })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(async (_col: string, tokenHash: string) => {
              state.deleteCapture = { tokenHash };
              return { error: null };
            }),
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

function buildRequest(rawToken?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (rawToken) headers.cookie = `${FAB_SESSION_COOKIE_NAME}=${rawToken}`;
  return new NextRequest("http://localhost/fab/queue", { headers });
}

const VALID_SESSION = {
  id: "sess-1",
  fabricator_id: "fab-1",
  is_setup: false,
  expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
};
const ACTIVE_FABRICATOR = {
  id: "fab-1",
  email: "fab@example.com",
  display_name: "Cynthia Chen",
  is_active: true,
};

describe("getFabricator", () => {
  let state: MockAdminState;

  beforeEach(() => {
    state = {
      session: VALID_SESSION,
      fabricator: ACTIVE_FABRICATOR,
      deleteCapture: null,
      sessionFilters: null,
    };
    mockAdminClient = buildMockAdmin(state);
  });

  it("returns null when no session cookie is present", async () => {
    const result = await getFabricator(buildRequest());
    expect(result).toBeNull();
  });

  it("hashes the cookie value before looking up session_token_hash", async () => {
    const rawToken = "raw-token-abc";
    await getFabricator(buildRequest(rawToken));
    expect(state.sessionFilters?.tokenHash).toBe(hashFabToken(rawToken));
  });

  it("filters to is_setup=false (rejects invite sessions as login sessions)", async () => {
    await getFabricator(buildRequest("raw"));
    expect(state.sessionFilters?.isSetup).toBe(false);
  });

  it("returns null when no session row matches", async () => {
    state.session = null;
    const result = await getFabricator(buildRequest("raw"));
    expect(result).toBeNull();
  });

  it("returns null when fabricator row is missing", async () => {
    state.fabricator = null;
    const result = await getFabricator(buildRequest("raw"));
    expect(result).toBeNull();
  });

  it("returns null when fabricator.is_active is false", async () => {
    state.fabricator = { ...ACTIVE_FABRICATOR, is_active: false };
    const result = await getFabricator(buildRequest("raw"));
    expect(result).toBeNull();
  });

  it("returns fabricator + session on happy path", async () => {
    const result = await getFabricator(buildRequest("raw"));
    expect(result).not.toBeNull();
    expect(result!.fabricator.id).toBe("fab-1");
    expect(result!.fabricator.display_name).toBe("Cynthia Chen");
    expect(result!.session.id).toBe("sess-1");
  });
});

describe("requireFabricatorAuth", () => {
  let state: MockAdminState;

  beforeEach(() => {
    state = {
      session: null,
      fabricator: null,
      deleteCapture: null,
      sessionFilters: null,
    };
    mockAdminClient = buildMockAdmin(state);
  });

  it("returns { error: 401 NextResponse with private Cache-Control } when unauthed", async () => {
    const result = await requireFabricatorAuth(buildRequest());
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.status).toBe(401);
      expect(result.error.headers.get("Cache-Control")).toBe(
        FAB_PRIVATE_CACHE_HEADERS["Cache-Control"]
      );
    }
  });

  it("returns the fabricator+session on happy path", async () => {
    state.session = VALID_SESSION;
    state.fabricator = ACTIVE_FABRICATOR;
    const result = await requireFabricatorAuth(buildRequest("raw"));
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.fabricator.id).toBe("fab-1");
    }
  });
});

describe("createFabricatorSession", () => {
  function mockInsertingSupabase(): {
    client: SupabaseClient;
    captured: Record<string, unknown>;
  } {
    const captured: Record<string, unknown> = {};
    const client = {
      from: vi.fn(() => ({
        insert: vi.fn((payload: Record<string, unknown>) => {
          captured.payload = payload;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { id: "new-session-id" },
                error: null,
              })),
            })),
          };
        }),
      })),
    } as unknown as SupabaseClient;
    return { client, captured };
  }

  it("isSetup=false sets expiry ~30 days from now and stores SHA-256 hash (not raw token)", async () => {
    const { client, captured } = mockInsertingSupabase();
    const result = await createFabricatorSession({
      fabricatorId: "fab-1",
      isSetup: false,
      supabase: client,
    });

    const payload = captured.payload as Record<string, string | boolean>;
    expect(payload.fabricator_id).toBe("fab-1");
    expect(payload.is_setup).toBe(false);
    expect(payload.session_token_hash).toBe(hashFabToken(result.rawToken));
    expect(payload.session_token_hash).not.toBe(result.rawToken);

    const expiresAt = new Date(payload.expires_at as string);
    const daysUntil = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysUntil).toBeGreaterThan(29.5);
    expect(daysUntil).toBeLessThan(30.5);

    expect(result.sessionId).toBe("new-session-id");
  });

  it("isSetup=true sets expiry ~24h from now", async () => {
    const { client, captured } = mockInsertingSupabase();
    await createFabricatorSession({
      fabricatorId: "fab-1",
      isSetup: true,
      supabase: client,
    });

    const payload = captured.payload as Record<string, string | boolean>;
    expect(payload.is_setup).toBe(true);
    const expiresAt = new Date(payload.expires_at as string);
    const hoursUntil = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(hoursUntil).toBeGreaterThan(23.5);
    expect(hoursUntil).toBeLessThan(24.5);
  });
});

describe("destroyFabricatorSession", () => {
  it("hashes the raw token before deleting (row is keyed by session_token_hash)", async () => {
    const state: MockAdminState = {
      session: null,
      fabricator: null,
      deleteCapture: null,
      sessionFilters: null,
    };
    const supabase = buildMockAdmin(state);
    await destroyFabricatorSession("raw-token-xyz", supabase);
    expect(state.deleteCapture?.tokenHash).toBe(hashFabToken("raw-token-xyz"));
  });
});
