/**
 * Tests for view-as (impersonation) token helpers — Phase 4.7.
 *
 * Covers signing + verification round-trip, signature tampering,
 * payload tampering, expiry, schema-mismatch, malformed input,
 * URL-builder.
 *
 * ENCRYPTION_KEY is set in beforeEach to a deterministic test value.
 * Production rotation is documented in
 * docs/security/encryption-key-rotation.md.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  signImpersonationToken,
  verifyImpersonationToken,
  buildImpersonationUrl,
  IMPERSONATION_TOKEN_TTL_MS,
} from "../impersonation";

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const TEACHER_ID = "22222222-2222-2222-2222-222222222222";
const SCHOOL_ID = "33333333-3333-3333-3333-333333333333";
const TEST_KEY = "test-encryption-key-32-chars-or-more-for-security-yes";

let originalKey: string | undefined;

beforeEach(() => {
  originalKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.ENCRYPTION_KEY;
  } else {
    process.env.ENCRYPTION_KEY = originalKey;
  }
});

// ═══════════════════════════════════════════════════════════════════
// Sign + verify round-trip
// ═══════════════════════════════════════════════════════════════════

describe("signImpersonationToken / verifyImpersonationToken round-trip", () => {
  it("verifies a freshly signed token", () => {
    const token = signImpersonationToken({
      adminId: ADMIN_ID,
      targetTeacherId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });
    const result = verifyImpersonationToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.admin_id).toBe(ADMIN_ID);
      expect(result.payload.target_teacher_id).toBe(TEACHER_ID);
      expect(result.payload.school_id).toBe(SCHOOL_ID);
      expect(result.payload.v).toBe(1);
      expect(result.payload.nonce).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it("issued_at_ms and expires_at_ms differ by exactly TTL", () => {
    const token = signImpersonationToken({
      adminId: ADMIN_ID,
      targetTeacherId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });
    const result = verifyImpersonationToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.expires_at_ms - result.payload.issued_at_ms).toBe(
        IMPERSONATION_TOKEN_TTL_MS
      );
    }
  });

  it("two tokens issued back-to-back have different nonces", () => {
    const a = signImpersonationToken({
      adminId: ADMIN_ID,
      targetTeacherId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });
    const b = signImpersonationToken({
      adminId: ADMIN_ID,
      targetTeacherId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });
    expect(a).not.toBe(b);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Tampering / forgery resistance
// ═══════════════════════════════════════════════════════════════════

describe("verifyImpersonationToken — tampering", () => {
  it("rejects when payload is tampered (signature stale)", () => {
    const token = signImpersonationToken({
      adminId: ADMIN_ID,
      targetTeacherId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });
    const [, sig] = token.split(".");
    // Replace payload with one that targets a different teacher
    const evilPayload = Buffer.from(
      JSON.stringify({
        v: 1,
        admin_id: ADMIN_ID,
        target_teacher_id: "99999999-9999-9999-9999-999999999999",
        school_id: SCHOOL_ID,
        issued_at_ms: Date.now(),
        expires_at_ms: Date.now() + 60_000,
        nonce: "deadbeef".repeat(4),
      })
    )
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const tampered = `${evilPayload}.${sig}`;
    const result = verifyImpersonationToken(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("bad_signature");
    }
  });

  it("rejects when signature is tampered", () => {
    const token = signImpersonationToken({
      adminId: ADMIN_ID,
      targetTeacherId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });
    const [payload] = token.split(".");
    const tampered = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const result = verifyImpersonationToken(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("bad_signature");
    }
  });

  it("rejects malformed token (no dot separator)", () => {
    const result = verifyImpersonationToken("notatokenatall");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("malformed_token");
    }
  });

  it("rejects empty signature", () => {
    const result = verifyImpersonationToken("payload.");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("malformed_token");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Expiry / clock-skew
// ═══════════════════════════════════════════════════════════════════

describe("verifyImpersonationToken — expiry", () => {
  it("rejects expired tokens (now > expires_at)", () => {
    const token = signImpersonationToken({
      adminId: ADMIN_ID,
      targetTeacherId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });
    // Verify with a now() 10 minutes after issuance
    const result = verifyImpersonationToken(
      token,
      Date.now() + IMPERSONATION_TOKEN_TTL_MS + 60_000
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired");
    }
  });

  it("accepts tokens within the 5-min TTL window", () => {
    const token = signImpersonationToken({
      adminId: ADMIN_ID,
      targetTeacherId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });
    // 4 minutes later
    const result = verifyImpersonationToken(token, Date.now() + 4 * 60_000);
    expect(result.ok).toBe(true);
  });

  it("rejects tokens with future-dated issued_at (clock skew > 1min)", () => {
    const token = signImpersonationToken({
      adminId: ADMIN_ID,
      targetTeacherId: TEACHER_ID,
      schoolId: SCHOOL_ID,
    });
    // Verify with now() set well in the past so issued_at appears future
    const result = verifyImpersonationToken(token, Date.now() - 5 * 60_000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Could be expired if expires_at < nowMs (it would be) — actually
      // since we shifted now back, issued_at_ms IS > nowMs + 60s, so
      // future_dated. expires_at would also be > nowMs so not expired.
      expect(result.reason).toBe("future_dated");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Missing secret
// ═══════════════════════════════════════════════════════════════════

describe("ENCRYPTION_KEY guard", () => {
  it("verifyImpersonationToken returns missing_secret when env var absent", () => {
    delete process.env.ENCRYPTION_KEY;
    const result = verifyImpersonationToken("anything.anything");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing_secret");
    }
  });

  it("signImpersonationToken throws when env var absent", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() =>
      signImpersonationToken({
        adminId: ADMIN_ID,
        targetTeacherId: TEACHER_ID,
        schoolId: SCHOOL_ID,
      })
    ).toThrow(/ENCRYPTION_KEY/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildImpersonationUrl
// ═══════════════════════════════════════════════════════════════════

describe("buildImpersonationUrl", () => {
  it("defaults to /teacher/dashboard with as_token query param", () => {
    const url = buildImpersonationUrl({ token: "abc.def" });
    expect(url).toBe("/teacher/dashboard?as_token=abc.def");
  });

  it("respects custom redirectPath", () => {
    const url = buildImpersonationUrl({
      token: "abc.def",
      redirectPath: "/teacher/students/xyz",
    });
    expect(url).toBe("/teacher/students/xyz?as_token=abc.def");
  });

  it("uses & when redirectPath already has a query string", () => {
    const url = buildImpersonationUrl({
      token: "abc.def",
      redirectPath: "/teacher/dashboard?tab=units",
    });
    expect(url).toBe("/teacher/dashboard?tab=units&as_token=abc.def");
  });

  it("URL-encodes the token", () => {
    const url = buildImpersonationUrl({ token: "abc/def+ghi=" });
    expect(url).toContain("as_token=abc%2Fdef%2Bghi%3D");
  });
});
