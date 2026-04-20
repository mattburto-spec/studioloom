/**
 * POST /api/fab/set-password/submit
 *
 * Consumes a valid setup/reset session. Sets the new bcrypt password hash
 * on the fabricator, deletes the consumed setup session (one-shot), and
 * creates a fresh normal login session + cookie so the user lands on
 * /fab/queue already signed in.
 *
 * Transaction shape (best-effort atomicity):
 *   1. Re-validate setup session
 *   2. UPDATE fabricators.password_hash
 *   3. DELETE fabricator_sessions (the setup row we just consumed)
 *   4. INSERT new normal session + set cookie
 *
 * If step 2 fails → 500 and nothing deleted.
 * If step 3 fails after step 2 succeeded → log + proceed to step 4. The
 *   setup row will simply expire within 24h. Not worth failing the user.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import {
  FAB_SESSION_COOKIE_NAME,
  FAB_SESSION_DURATION_DAYS,
} from "@/lib/constants";
import {
  validateSetupSession,
  createFabricatorSession,
  FAB_PRIVATE_CACHE_HEADERS,
} from "@/lib/fab/auth";

const SUBMIT_LIMITS = [
  { maxRequests: 10, windowMs: 60 * 1000 },
  { maxRequests: 50, windowMs: 60 * 60 * 1000 },
];

const MIN_PASSWORD_LENGTH = 12;

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: FAB_PRIVATE_CACHE_HEADERS });
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = rateLimit(`fab-setpw-submit:${ip}`, SUBMIT_LIMITS);
  if (!allowed) {
    return privateJson({ error: "Too many attempts. Try again later." }, 429);
  }

  let body: { token?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  const token = typeof body.token === "string" ? body.token : "";
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : "";

  if (!token) return privateJson({ error: "Invalid or expired link" }, 401);
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return privateJson(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      400
    );
  }

  const supabase = createAdminClient();
  const validation = await validateSetupSession(token, supabase);
  if (!validation) {
    return privateJson({ error: "Invalid or expired link" }, 401);
  }

  const { fabricator, sessionId: setupSessionId } = validation;

  // Step 2: hash + update password
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const { error: updateError } = await supabase
    .from("fabricators")
    .update({ password_hash: passwordHash })
    .eq("id", fabricator.id);

  if (updateError) {
    console.error("[fab/set-password] password update failed:", updateError.message);
    return privateJson({ error: "Failed to set password" }, 500);
  }

  // Step 3: one-shot consume the setup session
  const { error: deleteError } = await supabase
    .from("fabricator_sessions")
    .delete()
    .eq("id", setupSessionId);

  if (deleteError) {
    // Non-fatal: setup row will expire in ≤24h anyway.
    console.warn(
      "[fab/set-password] setup session delete failed (non-fatal):",
      deleteError.message
    );
  }

  // Step 4: issue fresh normal login session
  const session = await createFabricatorSession({
    fabricatorId: fabricator.id,
    isSetup: false,
    supabase,
  });

  // Best-effort last_login_at bump (completing set-password = first login).
  await supabase
    .from("fabricators")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", fabricator.id);

  const response = privateJson({
    ok: true,
    fabricator: {
      id: fabricator.id,
      display_name: fabricator.display_name,
    },
  });

  response.cookies.set(FAB_SESSION_COOKIE_NAME, session.rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: FAB_SESSION_DURATION_DAYS * 24 * 60 * 60,
  });

  return response;
}
