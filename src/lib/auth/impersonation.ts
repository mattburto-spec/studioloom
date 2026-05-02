/**
 * View-as (impersonation) token helpers — Phase 4.7.
 *
 * Per §3.8 Q9 (master spec Decision 9): platform-admin support tooling
 * uses a `?as_teacher_id=...` query param on teacher pages, gated by
 * `is_platform_admin`, signed URL with 5-minute expiry, audit_events
 * row per use. Read-only forced via middleware (any mutation route
 * 403s when as_teacher_id is present).
 *
 * Token shape (URL query param `as_token`):
 *
 *   base64url(payload).base64url(hmacSig)
 *
 *   payload = JSON({
 *     v: 1,                    // schema version
 *     admin_id: string,        // auth.users.id of the platform admin
 *     target_teacher_id: string,
 *     school_id: string,       // school context (audit + RLS join hint)
 *     issued_at_ms: number,
 *     expires_at_ms: number,   // issued + 5 min
 *     nonce: string            // random 16-byte hex
 *   })
 *
 *   hmacSig = HMAC-SHA256(payload, secret)
 *
 * Secret = ENCRYPTION_KEY (already in env; rotation procedure in
 * docs/security/encryption-key-rotation.md). Reusing the existing key
 * avoids adding another env var; HMAC over short-lived tokens with a
 * 5-min expiry has minimal post-rotation invalidation risk (tokens
 * rotate naturally within minutes).
 *
 * Two public functions:
 *
 *   signImpersonationToken(payload) → token string
 *   verifyImpersonationToken(token) → ImpersonationVerifyResult
 *
 * Routes that ACCEPT impersonation (read-only teacher pages) call verify
 * and audit-log on success. Mutation routes are blocked at middleware
 * level — they don't even reach the verify helper.
 *
 * NOTE: Phase 4.7 ships the URL-generation + middleware-block + verify
 * helper. Wiring actual teacher pages to render-as the impersonated
 * teacher (i.e. swap `auth.uid()` → `as_teacher_id` in dashboard reads)
 * is filed as `FU-AV2-IMPERSONATION-RENDER-WIRING` P3 — not blocking the
 * super-admin view's primary use cases (audit log, change history,
 * teacher list, settings snapshot).
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const IMPERSONATION_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_SCHEMA_VERSION = 1;

export type ImpersonationPayload = {
  v: number;
  admin_id: string;
  target_teacher_id: string;
  school_id: string;
  issued_at_ms: number;
  expires_at_ms: number;
  nonce: string;
};

export type SignImpersonationArgs = {
  adminId: string;
  targetTeacherId: string;
  schoolId: string;
};

export type ImpersonationVerifyResult =
  | {
      ok: true;
      payload: ImpersonationPayload;
    }
  | {
      ok: false;
      reason:
        | "missing_secret"
        | "malformed_token"
        | "bad_signature"
        | "expired"
        | "future_dated"
        | "schema_mismatch";
      message: string;
    };

function getSecret(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) return null;
  return Buffer.from(key);
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(s: string): Buffer {
  const padded = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

export function signImpersonationToken(args: SignImpersonationArgs): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error(
      "ENCRYPTION_KEY env var is not set or too short — cannot sign impersonation token"
    );
  }

  const now = Date.now();
  const payload: ImpersonationPayload = {
    v: TOKEN_SCHEMA_VERSION,
    admin_id: args.adminId,
    target_teacher_id: args.targetTeacherId,
    school_id: args.schoolId,
    issued_at_ms: now,
    expires_at_ms: now + IMPERSONATION_TOKEN_TTL_MS,
    nonce: randomBytes(16).toString("hex"),
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(Buffer.from(payloadJson, "utf-8"));

  const sig = createHmac("sha256", secret).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(sig);

  return `${payloadB64}.${sigB64}`;
}

export function verifyImpersonationToken(
  token: string,
  nowMs: number = Date.now()
): ImpersonationVerifyResult {
  const secret = getSecret();
  if (!secret) {
    return {
      ok: false,
      reason: "missing_secret",
      message: "ENCRYPTION_KEY env var is not set",
    };
  }

  const dot = token.indexOf(".");
  if (dot < 0 || dot === token.length - 1) {
    return {
      ok: false,
      reason: "malformed_token",
      message: "Token must be in payload.signature format",
    };
  }

  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  const expectedSig = createHmac("sha256", secret).update(payloadB64).digest();
  let providedSig: Buffer;
  try {
    providedSig = base64UrlDecode(sigB64);
  } catch {
    return {
      ok: false,
      reason: "malformed_token",
      message: "Signature is not valid base64url",
    };
  }

  if (
    expectedSig.length !== providedSig.length ||
    !timingSafeEqual(expectedSig, providedSig)
  ) {
    return {
      ok: false,
      reason: "bad_signature",
      message: "Signature does not match payload",
    };
  }

  let payload: ImpersonationPayload;
  try {
    const json = base64UrlDecode(payloadB64).toString("utf-8");
    payload = JSON.parse(json) as ImpersonationPayload;
  } catch {
    return {
      ok: false,
      reason: "malformed_token",
      message: "Payload is not valid JSON",
    };
  }

  if (payload.v !== TOKEN_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: "schema_mismatch",
      message: `Token schema version ${payload.v} does not match expected ${TOKEN_SCHEMA_VERSION}`,
    };
  }

  if (typeof payload.expires_at_ms !== "number" || payload.expires_at_ms < nowMs) {
    return {
      ok: false,
      reason: "expired",
      message: "Token has expired",
    };
  }

  if (
    typeof payload.issued_at_ms !== "number" ||
    payload.issued_at_ms > nowMs + 60_000 // allow 1-min clock skew
  ) {
    return {
      ok: false,
      reason: "future_dated",
      message: "Token issued_at is in the future (clock skew or forgery)",
    };
  }

  return { ok: true, payload };
}

/**
 * Build the view-as URL with the signed token attached.
 * The default redirect target is /teacher/dashboard but callers can
 * override (e.g. /teacher/students/[studentId]).
 */
export function buildImpersonationUrl(args: {
  token: string;
  redirectPath?: string;
}): string {
  const path = args.redirectPath ?? "/teacher/dashboard";
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}as_token=${encodeURIComponent(args.token)}`;
}
