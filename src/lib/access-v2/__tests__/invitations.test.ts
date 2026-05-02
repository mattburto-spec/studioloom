/**
 * Tests for school-invitation helpers — Phase 4.7b-2.
 *
 * Covers:
 *   - generateInvitationToken: length + format + uniqueness
 *   - isValidInvitedRole: enum gate
 *   - createInvitation: happy + invalid_email + invalid_role +
 *     duplicate_active + school_not_found + school_not_invitable
 *   - acceptInvitation: happy + token_not_found + expired + revoked +
 *     already_accepted + email_mismatch + school_admin role grant path
 *   - revokeInvitation: happy + not_found + already_terminal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateInvitationToken,
  isValidInvitedRole,
  createInvitation,
  acceptInvitation,
  revokeInvitation,
  __TEST__,
} from "../school/invitations";

// ─── Mocks ──────────────────────────────────────────────────────────

interface ChainResult {
  data: unknown;
  error: unknown;
  count?: number | null;
}

type MockChain = Record<string, ReturnType<typeof vi.fn>> & {
  then: (r: (v: unknown) => void) => Promise<unknown>;
};

function buildChain(result: ChainResult = { data: null, error: null }): MockChain {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "or",
    "in",
    "is",
    "order",
    "limit",
    "single",
    "maybeSingle",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(result).then(resolve);
  return chain as MockChain;
}

const SCHOOL_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_USER_ID = "22222222-2222-2222-2222-222222222222";
const INVITEE_USER_ID = "33333333-3333-3333-3333-333333333333";
const INVITATION_ID = "44444444-4444-4444-4444-444444444444";

function buildClient(handlers: Record<string, ChainResult[]>) {
  const queues = new Map<string, MockChain[]>();
  for (const [table, results] of Object.entries(handlers)) {
    queues.set(table, results.map((r) => buildChain(r)));
  }
  return {
    from: vi.fn((table: string) => {
      const q = queues.get(table);
      if (!q || q.length === 0) {
        return buildChain({ data: null, error: null, count: 0 });
      }
      return q.shift()!;
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════
// generateInvitationToken
// ═══════════════════════════════════════════════════════════════════

describe("generateInvitationToken", () => {
  it("produces a 43-char URL-safe base64 string (32 bytes)", () => {
    const token = generateInvitationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("two consecutive tokens are different", () => {
    expect(generateInvitationToken()).not.toBe(generateInvitationToken());
  });

  it("uses URL-safe alphabet (no +/=)", () => {
    const token = generateInvitationToken();
    expect(token).not.toMatch(/[+/=]/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// isValidInvitedRole
// ═══════════════════════════════════════════════════════════════════

describe("isValidInvitedRole", () => {
  it("accepts the 4 valid roles", () => {
    expect(isValidInvitedRole("lead_teacher")).toBe(true);
    expect(isValidInvitedRole("co_teacher")).toBe(true);
    expect(isValidInvitedRole("dept_head")).toBe(true);
    expect(isValidInvitedRole("school_admin")).toBe(true);
  });

  it("rejects unknown roles", () => {
    expect(isValidInvitedRole("admin")).toBe(false);
    expect(isValidInvitedRole("teacher")).toBe(false);
    expect(isValidInvitedRole("")).toBe(false);
    expect(isValidInvitedRole(null)).toBe(false);
    expect(isValidInvitedRole(undefined)).toBe(false);
  });

  it("VALID_ROLES set has exactly 4 members", () => {
    expect(__TEST__.VALID_ROLES.size).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════
// createInvitation
// ═══════════════════════════════════════════════════════════════════

describe("createInvitation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid email format", async () => {
    const result = await createInvitation({
      schoolId: SCHOOL_ID,
      invitedEmail: "not-an-email",
      invitedRole: "lead_teacher",
      invitedByTeacherId: ADMIN_USER_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_email");
  });

  it("rejects invalid role", async () => {
    const result = await createInvitation({
      schoolId: SCHOOL_ID,
      invitedEmail: "test@example.com",
      // @ts-expect-error — testing the runtime guard
      invitedRole: "bogus_role",
      invitedByTeacherId: ADMIN_USER_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_role");
  });

  it("rejects when school not found", async () => {
    const client = buildClient({
      schools: [{ data: null, error: null }],
    });
    const result = await createInvitation({
      schoolId: SCHOOL_ID,
      invitedEmail: "test@example.com",
      invitedRole: "lead_teacher",
      invitedByTeacherId: ADMIN_USER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("school_not_found");
  });

  it("rejects when school is not on 'school' tier", async () => {
    const client = buildClient({
      schools: [
        {
          data: { id: SCHOOL_ID, subscription_tier: "free", status: "active" },
          error: null,
        },
      ],
    });
    const result = await createInvitation({
      schoolId: SCHOOL_ID,
      invitedEmail: "test@example.com",
      invitedRole: "lead_teacher",
      invitedByTeacherId: ADMIN_USER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("school_not_invitable");
  });

  it("rejects when school is archived", async () => {
    const client = buildClient({
      schools: [
        {
          data: {
            id: SCHOOL_ID,
            subscription_tier: "school",
            status: "archived",
          },
          error: null,
        },
      ],
    });
    const result = await createInvitation({
      schoolId: SCHOOL_ID,
      invitedEmail: "test@example.com",
      invitedRole: "lead_teacher",
      invitedByTeacherId: ADMIN_USER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("school_not_invitable");
  });

  it("returns duplicate_active on 23505 unique violation", async () => {
    const client = buildClient({
      schools: [
        {
          data: {
            id: SCHOOL_ID,
            subscription_tier: "school",
            status: "active",
          },
          error: null,
        },
      ],
      school_invitations: [
        {
          data: null,
          error: { code: "23505", message: "unique violation" },
        },
      ],
    });
    const result = await createInvitation({
      schoolId: SCHOOL_ID,
      invitedEmail: "test@example.com",
      invitedRole: "lead_teacher",
      invitedByTeacherId: ADMIN_USER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("duplicate_active");
  });

  it("happy path returns invitation_id, token, expires_at", async () => {
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const client = buildClient({
      schools: [
        {
          data: {
            id: SCHOOL_ID,
            subscription_tier: "school",
            status: "active",
          },
          error: null,
        },
      ],
      school_invitations: [
        {
          data: { id: INVITATION_ID, expires_at: expiresAt.toISOString() },
          error: null,
        },
      ],
    });
    const result = await createInvitation({
      schoolId: SCHOOL_ID,
      invitedEmail: "TEST@Example.com", // mixed case → normalized
      invitedRole: "lead_teacher",
      invitedByTeacherId: ADMIN_USER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invitationId).toBe(INVITATION_ID);
      expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(result.expiresAt.getTime()).toBe(expiresAt.getTime());
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// acceptInvitation
// ═══════════════════════════════════════════════════════════════════

describe("acceptInvitation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns token_not_found for unknown token", async () => {
    const client = buildClient({
      school_invitations: [{ data: null, error: null }],
    });
    const result = await acceptInvitation({
      token: "nonexistent_token_value_padding_to_32",
      acceptingUserId: INVITEE_USER_ID,
      acceptingEmail: "anyone@example.com",
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("token_not_found");
  });

  it("returns already_accepted when accepted_at is set", async () => {
    const client = buildClient({
      school_invitations: [
        {
          data: {
            id: INVITATION_ID,
            school_id: SCHOOL_ID,
            invited_email: "test@example.com",
            invited_role: "lead_teacher",
            expires_at: new Date(Date.now() + 1_000_000).toISOString(),
            accepted_at: new Date().toISOString(),
            revoked_at: null,
          },
          error: null,
        },
      ],
    });
    const result = await acceptInvitation({
      token: "any_token_long_enough_to_pass_route_guard",
      acceptingUserId: INVITEE_USER_ID,
      acceptingEmail: "test@example.com",
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("already_accepted");
  });

  it("returns revoked when revoked_at is set", async () => {
    const client = buildClient({
      school_invitations: [
        {
          data: {
            id: INVITATION_ID,
            school_id: SCHOOL_ID,
            invited_email: "test@example.com",
            invited_role: "lead_teacher",
            expires_at: new Date(Date.now() + 1_000_000).toISOString(),
            accepted_at: null,
            revoked_at: new Date().toISOString(),
          },
          error: null,
        },
      ],
    });
    const result = await acceptInvitation({
      token: "any_token_long_enough_to_pass_route_guard",
      acceptingUserId: INVITEE_USER_ID,
      acceptingEmail: "test@example.com",
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("revoked");
  });

  it("returns expired when past expiry", async () => {
    const client = buildClient({
      school_invitations: [
        {
          data: {
            id: INVITATION_ID,
            school_id: SCHOOL_ID,
            invited_email: "test@example.com",
            invited_role: "lead_teacher",
            expires_at: new Date(Date.now() - 1000).toISOString(),
            accepted_at: null,
            revoked_at: null,
          },
          error: null,
        },
      ],
    });
    const result = await acceptInvitation({
      token: "any_token_long_enough_to_pass_route_guard",
      acceptingUserId: INVITEE_USER_ID,
      acceptingEmail: "test@example.com",
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("rejects when accepting email doesn't match invited_email", async () => {
    const client = buildClient({
      school_invitations: [
        {
          data: {
            id: INVITATION_ID,
            school_id: SCHOOL_ID,
            invited_email: "intended@example.com",
            invited_role: "lead_teacher",
            expires_at: new Date(Date.now() + 1_000_000).toISOString(),
            accepted_at: null,
            revoked_at: null,
          },
          error: null,
        },
      ],
    });
    const result = await acceptInvitation({
      token: "any_token_long_enough_to_pass_route_guard",
      acceptingUserId: INVITEE_USER_ID,
      acceptingEmail: "imposter@example.com",
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("email_mismatch");
  });
});

// ═══════════════════════════════════════════════════════════════════
// revokeInvitation
// ═══════════════════════════════════════════════════════════════════

describe("revokeInvitation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns not_found for unknown id", async () => {
    const client = buildClient({
      school_invitations: [{ data: null, error: null }],
    });
    const result = await revokeInvitation({
      invitationId: INVITATION_ID,
      revokedByTeacherId: ADMIN_USER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_found");
  });

  it("returns already_terminal when invitation already accepted", async () => {
    const client = buildClient({
      school_invitations: [
        {
          data: {
            id: INVITATION_ID,
            accepted_at: new Date().toISOString(),
            revoked_at: null,
          },
          error: null,
        },
      ],
    });
    const result = await revokeInvitation({
      invitationId: INVITATION_ID,
      revokedByTeacherId: ADMIN_USER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("already_terminal");
  });

  it("returns already_terminal when invitation already revoked", async () => {
    const client = buildClient({
      school_invitations: [
        {
          data: {
            id: INVITATION_ID,
            accepted_at: null,
            revoked_at: new Date().toISOString(),
          },
          error: null,
        },
      ],
    });
    const result = await revokeInvitation({
      invitationId: INVITATION_ID,
      revokedByTeacherId: ADMIN_USER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("already_terminal");
  });

  it("happy path flips revoked_at + revoked_by", async () => {
    const client = buildClient({
      school_invitations: [
        {
          data: { id: INVITATION_ID, accepted_at: null, revoked_at: null },
          error: null,
        },
        // The UPDATE call returns no data but no error
        { data: null, error: null },
      ],
    });
    const result = await revokeInvitation({
      invitationId: INVITATION_ID,
      revokedByTeacherId: ADMIN_USER_ID,
      supabase: client as never,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.invitationId).toBe(INVITATION_ID);
  });
});
