/**
 * S6 (F-12 + F-14 9 May 2026) — fab login hardening tests.
 *
 * Covers:
 *   F-12 — TIMING EQUALIZE. Every login path runs exactly one
 *   bcrypt.compare. The early-out branches (no fabricator, deactivated,
 *   invite pending) MUST go through DUMMY_HASH so wall-clock time matches
 *   the unhappy-password branch. Asserted via behavioral
 *   bcrypt.compare-call-count, not raw timing (raw timing is flaky in CI).
 *
 *   F-14 — DB-COLUMN LOCKOUT. After LOCKOUT_THRESHOLD (10) failed
 *   attempts on the same email, the account is locked for
 *   LOCKOUT_DURATION_MS (30 min) — return 429 instead of running
 *   bcrypt.compare. On successful login, count + locked_until reset.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ──────────────────────────────────────────────────────────────

// vi.mock calls are hoisted ABOVE this file's top-level code, so any
// spies referenced inside vi.mock() must be created via vi.hoisted()
// (otherwise we hit a TDZ error at import-time).
const { bcryptCompareSpy, bcryptHashSyncSpy } = vi.hoisted(() => ({
  bcryptCompareSpy: vi.fn(async () => false),
  bcryptHashSyncSpy: vi.fn(
    () => "$2a$12$DUMMY_DUMMY_DUMMY_DUMMY_DUMMYzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
  ),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: bcryptCompareSpy,
    hashSync: bcryptHashSyncSpy,
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 0 })),
}));

vi.mock("@/lib/fab/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fab/auth")>(
    "@/lib/fab/auth",
  );
  return {
    ...actual,
    createFabricatorSession: vi.fn(async () => ({
      rawToken: "raw-test-token",
      sessionId: "session-uuid",
    })),
  };
});

// Per-test mutable fabricator row.
type FabRow = {
  id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  display_name: string;
  failed_login_count: number;
  failed_login_locked_until: string | null;
} | null;

let fabricatorRow: FabRow = null;
let lookupError: { message: string } | null = null;
let updateCalls: Array<Record<string, unknown>> = [];

const adminFromMock = vi.fn((table: string) => {
  if (table === "fabricators") {
    return {
      select: () => ({
        ilike: () => ({
          maybeSingle: async () => ({ data: fabricatorRow, error: lookupError }),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        updateCalls.push(payload);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    };
  }
  return {
    select: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: null }) }) }),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminFromMock }),
}));

import { POST } from "../route";

beforeEach(() => {
  fabricatorRow = null;
  lookupError = null;
  updateCalls = [];
  bcryptCompareSpy.mockReset();
  bcryptCompareSpy.mockResolvedValue(false);
  adminFromMock.mockClear();
});

function makeRequest(email: string, password: string) {
  return new NextRequest("http://localhost/api/fab/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" },
  });
}

const goodFab = (overrides: Partial<NonNullable<FabRow>> = {}): FabRow => ({
  id: "fab-1",
  email: "alice@school.com",
  password_hash: "$2a$12$REAL_HASH_REAL_HASH_REAL_HASH_REAL_HASH_REAL_HASH",
  is_active: true,
  display_name: "Alice",
  failed_login_count: 0,
  failed_login_locked_until: null,
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════
// F-12 — TIMING EQUALIZE
// ═══════════════════════════════════════════════════════════════════════

describe("/api/fab/login — F-12 timing equalize", () => {
  it("runs bcrypt.compare exactly ONCE on unknown email (not zero)", async () => {
    fabricatorRow = null; // email doesn't exist
    bcryptCompareSpy.mockResolvedValueOnce(false); // dummy will fail
    const res = await POST(makeRequest("ghost@nowhere.com", "wrong"));
    expect(res.status).toBe(401);
    expect(bcryptCompareSpy).toHaveBeenCalledTimes(1);
  });

  it("runs bcrypt.compare exactly ONCE on deactivated account", async () => {
    fabricatorRow = goodFab({ is_active: false });
    const res = await POST(makeRequest("alice@school.com", "wrong"));
    expect(res.status).toBe(401);
    expect(bcryptCompareSpy).toHaveBeenCalledTimes(1);
  });

  it("runs bcrypt.compare exactly ONCE on INVITE_PENDING password_hash", async () => {
    fabricatorRow = goodFab({ password_hash: "INVITE_PENDING" });
    const res = await POST(makeRequest("alice@school.com", "anything"));
    expect(res.status).toBe(401);
    expect(bcryptCompareSpy).toHaveBeenCalledTimes(1);
  });

  it("runs bcrypt.compare exactly ONCE on wrong password (real account)", async () => {
    fabricatorRow = goodFab();
    bcryptCompareSpy.mockResolvedValueOnce(false);
    const res = await POST(makeRequest("alice@school.com", "wrong"));
    expect(res.status).toBe(401);
    expect(bcryptCompareSpy).toHaveBeenCalledTimes(1);
  });

  it("runs bcrypt.compare exactly ONCE on successful login", async () => {
    fabricatorRow = goodFab();
    bcryptCompareSpy.mockResolvedValueOnce(true);
    const res = await POST(makeRequest("alice@school.com", "right"));
    expect(res.status).toBe(200);
    expect(bcryptCompareSpy).toHaveBeenCalledTimes(1);
  });

  it("uses the DUMMY_HASH branch when fabricator is missing (compares password against DUMMY_HASH not real hash)", async () => {
    fabricatorRow = null;
    let comparedHash = "";
    bcryptCompareSpy.mockImplementationOnce(async (_p: string, hash: string) => {
      comparedHash = hash;
      return false;
    });
    await POST(makeRequest("ghost@nowhere.com", "wrong"));
    // The DUMMY_HASH constant is computed at module init via bcrypt.hashSync
    // — our hashSync mock returns a fixed string, so we can assert that the
    // compared hash IS that fixed string and NOT the real hash from goodFab.
    expect(comparedHash).toBe(
      "$2a$12$DUMMY_DUMMY_DUMMY_DUMMY_DUMMYzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// F-14 — DB-COLUMN LOCKOUT
// ═══════════════════════════════════════════════════════════════════════

describe("/api/fab/login — F-14 lockout", () => {
  it("returns 429 + Retry-After when account is currently locked", async () => {
    const future = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    fabricatorRow = goodFab({
      failed_login_count: 10,
      failed_login_locked_until: future,
    });
    const res = await POST(makeRequest("alice@school.com", "any"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    // Crucially: bcrypt.compare must NOT have been called (avoid the
    // expensive op when we know we're rejecting anyway).
    expect(bcryptCompareSpy).not.toHaveBeenCalled();
  });

  it("does NOT return 429 when locked_until is in the past (lockout expired)", async () => {
    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    fabricatorRow = goodFab({
      failed_login_count: 10,
      failed_login_locked_until: past,
    });
    bcryptCompareSpy.mockResolvedValueOnce(false);
    const res = await POST(makeRequest("alice@school.com", "wrong"));
    // Lockout expired → falls through to normal flow → wrong pwd → 401
    expect(res.status).toBe(401);
  });

  it("increments failed_login_count on wrong password", async () => {
    fabricatorRow = goodFab({ failed_login_count: 3 });
    bcryptCompareSpy.mockResolvedValueOnce(false);
    await POST(makeRequest("alice@school.com", "wrong"));
    expect(updateCalls.length).toBeGreaterThan(0);
    const update = updateCalls.find(
      (u) => typeof u.failed_login_count === "number",
    );
    expect(update).toBeDefined();
    expect(update!.failed_login_count).toBe(4);
    // No lockout below threshold
    expect(update!.failed_login_locked_until).toBeUndefined();
  });

  it("sets failed_login_locked_until when count reaches threshold (10)", async () => {
    fabricatorRow = goodFab({ failed_login_count: 9 });
    bcryptCompareSpy.mockResolvedValueOnce(false);
    await POST(makeRequest("alice@school.com", "wrong"));
    const update = updateCalls.find((u) => u.failed_login_locked_until);
    expect(update).toBeDefined();
    expect(update!.failed_login_count).toBe(10);
    expect(typeof update!.failed_login_locked_until).toBe("string");
    // Locked until future
    const lockedUntil = new Date(update!.failed_login_locked_until as string).getTime();
    expect(lockedUntil).toBeGreaterThan(Date.now());
    // Locked for ~30 min (allow 5s slack for test execution)
    const expectedMs = 30 * 60 * 1000;
    expect(lockedUntil - Date.now()).toBeGreaterThan(expectedMs - 5000);
    expect(lockedUntil - Date.now()).toBeLessThan(expectedMs + 5000);
  });

  it("resets failed_login_count + locked_until on successful login", async () => {
    fabricatorRow = goodFab({
      failed_login_count: 7,
      failed_login_locked_until: null,
    });
    bcryptCompareSpy.mockResolvedValueOnce(true);
    const res = await POST(makeRequest("alice@school.com", "right"));
    expect(res.status).toBe(200);
    // The success path updates last_login_at + resets count + clears locked_until.
    const successUpdate = updateCalls.find(
      (u) => u.last_login_at && u.failed_login_count === 0,
    );
    expect(successUpdate).toBeDefined();
    expect(successUpdate!.failed_login_count).toBe(0);
    expect(successUpdate!.failed_login_locked_until).toBe(null);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// F-13 — doc/code reconciliation guard
// (Source-static: future drift on Argon2id mentions fails CI)
// ═══════════════════════════════════════════════════════════════════════

describe("/api/fab/login — F-13 doc/code reconciliation guard", () => {
  it("CLAUDE.md does not claim Fabricator auth uses Argon2id", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const claudeMd = fs.readFileSync(
      path.join(__dirname, "..", "..", "..", "..", "..", "..", "CLAUDE.md"),
      "utf-8",
    );
    // Specific phrases the 9 May external review flagged as drift.
    // Match in case-insensitive form so future re-introductions are caught.
    expect(claudeMd).not.toMatch(/Argon2id Fabricator/i);
    expect(claudeMd).not.toMatch(/Fabricator.*Argon2id/i);
  });
});
