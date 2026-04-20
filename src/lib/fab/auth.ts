/**
 * Fabricator authentication — cookie session helper.
 *
 * Mirrors the student token-session pattern (Lesson #4) — NOT Supabase Auth.
 * Own cookie name (FAB_SESSION_COOKIE_NAME) to avoid collision with students.
 *
 * Session token discipline (Option C, D-AUTH-4):
 *   - Raw token: 32 random bytes, base64url, lives only in the cookie
 *   - Stored value: sha256(raw).hex in fabricator_sessions.session_token_hash
 *   - Validator hashes the incoming cookie and compares
 *
 * Every /fab/* route and every /api/fab/* route gates through
 * requireFabricatorAuth. Never import supabase.auth.getUser() or
 * requireStudentAuth or requireTeacherAuth on a Fabricator surface
 * (Lesson #9).
 */

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FAB_SESSION_COOKIE_NAME,
  FAB_SESSION_DURATION_DAYS,
  FAB_SETUP_SESSION_DURATION_HOURS,
} from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateFabToken, hashFabToken } from "./token";

export interface FabricatorRecord {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
}

export interface FabricatorSessionRecord {
  id: string;
  fabricator_id: string;
  is_setup: boolean;
  expires_at: string;
}

export interface FabAuthSuccess {
  fabricator: FabricatorRecord;
  session: FabricatorSessionRecord;
}

/**
 * Extract the authenticated Fabricator from the request, or null.
 *
 * - Reads FAB_SESSION_COOKIE_NAME cookie
 * - Hashes it (SHA-256) and looks up fabricator_sessions by session_token_hash
 * - Filters to is_setup=false (setup sessions are not login sessions)
 * - Rejects expired sessions
 * - Returns the joined fabricator row (is_active must be true)
 */
export async function getFabricator(
  request: NextRequest
): Promise<FabAuthSuccess | null> {
  const rawToken = request.cookies.get(FAB_SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashFabToken(rawToken);
  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("fabricator_sessions")
    .select("id, fabricator_id, is_setup, expires_at")
    .eq("session_token_hash", tokenHash)
    .eq("is_setup", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!session) return null;

  const { data: fabricator } = await supabase
    .from("fabricators")
    .select("id, email, display_name, is_active")
    .eq("id", session.fabricator_id)
    .maybeSingle();

  if (!fabricator || !fabricator.is_active) return null;

  return { fabricator, session };
}

/**
 * Gate a /fab/* route or /api/fab/* route. Returns the fabricator+session,
 * or a 401 NextResponse the caller returns directly.
 *
 * Usage:
 *   const auth = await requireFabricatorAuth(request);
 *   if ("error" in auth) return auth.error;
 *   const { fabricator } = auth;
 */
export async function requireFabricatorAuth(
  request: NextRequest
): Promise<FabAuthSuccess | { error: NextResponse }> {
  const result = await getFabricator(request);
  if (!result) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 401,
          headers: {
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
          },
        }
      ),
    };
  }
  return result;
}

export interface CreateSessionParams {
  fabricatorId: string;
  isSetup: boolean;
  supabase: SupabaseClient;
}

export interface CreateSessionResult {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
  sessionId: string;
}

/**
 * Create a new fabricator_sessions row.
 *
 * - Generates a fresh random token (raw never leaves this function except
 *   via the returned object — caller sets it as a cookie or emails it)
 * - Stores SHA-256 hash in session_token_hash
 * - Sets expiry based on isSetup flag:
 *     isSetup=true → 24 hours (invite / password-reset link)
 *     isSetup=false → 30 days (normal login session)
 */
export async function createFabricatorSession(
  params: CreateSessionParams
): Promise<CreateSessionResult> {
  const { fabricatorId, isSetup, supabase } = params;
  const rawToken = generateFabToken();
  const tokenHash = hashFabToken(rawToken);
  const expiresAt = new Date();
  if (isSetup) {
    expiresAt.setHours(
      expiresAt.getHours() + FAB_SETUP_SESSION_DURATION_HOURS
    );
  } else {
    expiresAt.setDate(
      expiresAt.getDate() + FAB_SESSION_DURATION_DAYS
    );
  }

  const { data, error } = await supabase
    .from("fabricator_sessions")
    .insert({
      fabricator_id: fabricatorId,
      session_token_hash: tokenHash,
      is_setup: isSetup,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create fabricator session: ${error?.message ?? "no row returned"}`
    );
  }

  return { rawToken, tokenHash, expiresAt, sessionId: data.id };
}

export interface SetupSessionValidation {
  sessionId: string;
  fabricator: FabricatorRecord;
}

/**
 * Validate a setup/reset token. Used by /fab/set-password verify + submit.
 *
 * - Hashes the raw token (tokens live hashed in fabricator_sessions)
 * - Requires is_setup=true (login sessions must not be consumable here)
 * - Requires expires_at > now()
 * - Requires the joined fabricator to be is_active=true
 *
 * Returns null on any failure (callers map to 401 — don't leak why).
 */
export async function validateSetupSession(
  rawToken: string,
  supabase: SupabaseClient
): Promise<SetupSessionValidation | null> {
  if (!rawToken) return null;
  const tokenHash = hashFabToken(rawToken);

  const { data: session } = await supabase
    .from("fabricator_sessions")
    .select("id, fabricator_id, is_setup, expires_at")
    .eq("session_token_hash", tokenHash)
    .eq("is_setup", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!session) return null;

  const { data: fabricator } = await supabase
    .from("fabricators")
    .select("id, email, display_name, is_active")
    .eq("id", session.fabricator_id)
    .maybeSingle();

  if (!fabricator || !fabricator.is_active) return null;

  return { sessionId: session.id, fabricator };
}

/**
 * Destroy a fabricator session by hashing the raw token and deleting the row.
 * Idempotent — unknown tokens are no-ops.
 */
export async function destroyFabricatorSession(
  rawToken: string,
  supabase: SupabaseClient
): Promise<void> {
  const tokenHash = hashFabToken(rawToken);
  await supabase
    .from("fabricator_sessions")
    .delete()
    .eq("session_token_hash", tokenHash);
}

/**
 * Standard Cache-Control headers for any /api/fab/* route that sets or
 * depends on the Fabricator session cookie. Vercel CDN strips Set-Cookie
 * from "public" responses (Lesson #11).
 */
export const FAB_PRIVATE_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
} as const;
