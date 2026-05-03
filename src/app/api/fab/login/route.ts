// audit-skip: routine fab-tech operational endpoint, audit lives in fabrication pipeline state machine
/**
 * POST /api/fab/login
 *
 * Fabricator login. Separate from student + teacher auth — uses its own
 * cookie (FAB_SESSION_COOKIE_NAME), its own session table (fabricator_sessions),
 * and bcrypt-verified passwords (fabricators.password_hash).
 *
 * Rate-limited per IP to defeat brute-force. Cache-Control: private so
 * Vercel CDN doesn't strip Set-Cookie (Lesson #11).
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
  createFabricatorSession,
  FAB_PRIVATE_CACHE_HEADERS,
} from "@/lib/fab/auth";

const LOGIN_LIMITS = [
  { maxRequests: 10, windowMs: 60 * 1000 },
  { maxRequests: 50, windowMs: 60 * 60 * 1000 },
];

// Sentinel placeholder written by invite flow before the Fabricator sets a
// real password. A Fabricator whose password_hash still equals this has
// never redeemed their invite link and cannot log in via /fab/login — they
// must visit /fab/set-password?token=... instead.
const INVITE_PENDING = "INVITE_PENDING";

function privateJson(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...FAB_PRIVATE_CACHE_HEADERS, ...extraHeaders },
  });
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed, retryAfterMs } = rateLimit(`fab-login:${ip}`, LOGIN_LIMITS);
  if (!allowed) {
    return privateJson(
      { error: "Too many login attempts. Please try again later." },
      429,
      { "Retry-After": String(Math.ceil((retryAfterMs || 60000) / 1000)) }
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return privateJson({ error: "Email and password are required" }, 400);
  }

  const supabase = createAdminClient();

  // Case-insensitive email lookup. Migration 097 created
  // UNIQUE INDEX uq_fabricators_email_lower ON (LOWER(email)).
  const { data: fabricator, error: lookupError } = await supabase
    .from("fabricators")
    .select("id, email, password_hash, is_active, display_name")
    .ilike("email", email)
    .maybeSingle();

  if (lookupError) {
    return privateJson({ error: "Login service error" }, 500);
  }

  // Generic 401 for all failure paths — don't leak whether the email exists
  // or whether it's deactivated or whether password is wrong.
  const genericFail = () => privateJson({ error: "Invalid credentials" }, 401);

  if (!fabricator) return genericFail();
  if (!fabricator.is_active) return genericFail();
  if (fabricator.password_hash === INVITE_PENDING) return genericFail();

  const ok = await bcrypt.compare(password, fabricator.password_hash);
  if (!ok) return genericFail();

  // Create a normal (is_setup=false) session.
  const session = await createFabricatorSession({
    fabricatorId: fabricator.id,
    isSetup: false,
    supabase,
  });

  // Update last_login_at (best-effort; don't fail login on audit error).
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
