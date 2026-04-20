/**
 * Fabricator session-token helpers.
 *
 * Session tokens are long random strings, so bcrypt-style slow hashing is
 * overkill and unnecessarily expensive per-request. SHA-256 is fast and
 * sufficient because the plaintext space (32-byte nanoid) is uncorrelated
 * and >10^48 — no rainbow-table or brute-force attack is feasible.
 *
 * Pattern: raw token goes in the cookie; SHA-256 hex digest is stored
 * in fabricator_sessions.session_token_hash. Validator hashes the
 * incoming cookie and compares to the column.
 *
 * Keeping this split from auth.ts lets us unit-test hashing deterministically
 * without mocking the Supabase client.
 */

import { createHash, randomBytes } from "node:crypto";

/** Generate a cryptographically random, URL-safe 32-byte token (~43 chars). */
export function generateFabToken(): string {
  // 32 random bytes → base64url (no padding). Matches nanoid-style length
  // without the nanoid dep. 2^256 entropy, ~43 chars long.
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hex digest — the value we store in session_token_hash. */
export function hashFabToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
