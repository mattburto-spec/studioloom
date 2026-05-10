// audit-skip: routine fab-tech operational endpoint, audit lives in fabrication pipeline state machine
/**
 * POST /api/fab/login
 *
 * Fabricator login. Separate from student + teacher auth — uses its own
 * cookie (FAB_SESSION_COOKIE_NAME), its own session table (fabricator_sessions),
 * and bcrypt-verified passwords (fabricators.password_hash).
 *
 * Hardened 9 May 2026 (S6 — closes F-12, F-14):
 *
 *   F-12 — TIMING EQUALIZE. Pre-fix the early-out branches (!fabricator,
 *   !is_active, INVITE_PENDING) returned generic 401 without running
 *   bcrypt.compare, while the unhappy-password branch DID run bcrypt.
 *   bcrypt.compare is intentionally slow (~50-100ms at cost factor 12),
 *   so an attacker could distinguish "email exists, wrong password"
 *   from "email doesn't exist" by measuring response time. Now every
 *   branch runs ONE bcrypt.compare against either the real hash or a
 *   constant DUMMY_HASH (computed at module init), equalizing wall-clock
 *   time across paths.
 *
 *   F-14 — DB-COLUMN LOCKOUT (Q4 option A). Pre-fix the only rate-limit
 *   was an in-memory Map (lib/rate-limit.ts) that resets on Vercel
 *   cold-start AND doesn't share across Lambda instances. Credential-
 *   stuffing from rotating IPs hit bcrypt.compare unboundedly. Migration
 *   20260510090841 added fabricators.failed_login_count +
 *   failed_login_locked_until. After 10 failed attempts on the same
 *   email, lockout for 30 min. Persists across cold-starts and instances.
 *
 * Cache-Control: private so Vercel CDN doesn't strip Set-Cookie (Lesson #11).
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

// F-12: equal-time bcrypt fallback. Computed once at module load so every
// `bcrypt.compare(password, DUMMY_HASH)` is statistically indistinguishable
// from `bcrypt.compare(password, real_hash)`. Cost factor 12 matches what
// the invite + set-password flows produce. The literal "INVALID_DUMMY_INPUT"
// is something no real password could realistically equal.
const DUMMY_HASH = bcrypt.hashSync("INVALID_DUMMY_INPUT", 12);

// F-14: DB-column lockout thresholds.
const LOCKOUT_THRESHOLD = 10; // failed attempts on same email before lockout
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 min

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
    .select(
      "id, email, password_hash, is_active, display_name, failed_login_count, failed_login_locked_until",
    )
    .ilike("email", email)
    .maybeSingle();

  if (lookupError) {
    return privateJson({ error: "Login service error" }, 500);
  }

  // Generic 401 for all failure paths — don't leak whether the email exists
  // or whether it's deactivated or whether password is wrong.
  const genericFail = () => privateJson({ error: "Invalid credentials" }, 401);

  // F-14: lockout check FIRST (before timing-sensitive bcrypt). If the
  // account is locked, reject with 429 — distinct from the generic 401
  // because a legitimate user needs to know they're locked, not just that
  // their password is wrong.
  if (
    fabricator?.failed_login_locked_until &&
    new Date(fabricator.failed_login_locked_until).getTime() > Date.now()
  ) {
    const remainingMs =
      new Date(fabricator.failed_login_locked_until).getTime() - Date.now();
    return privateJson(
      { error: "Account temporarily locked due to repeated failed logins. Try again later." },
      429,
      { "Retry-After": String(Math.ceil(remainingMs / 1000)) },
    );
  }

  // F-12: ALWAYS run one bcrypt.compare to equalize timing. If we have a
  // real fabricator + real hash, compare against that. If any early-out
  // branch hit (no row, deactivated, invite pending), compare against
  // DUMMY_HASH so the wall-clock time is identical.
  const hashToCompare =
    fabricator &&
    fabricator.is_active &&
    fabricator.password_hash !== INVITE_PENDING
      ? fabricator.password_hash
      : DUMMY_HASH;

  const ok = await bcrypt.compare(password, hashToCompare);

  // Now branch on the early-out conditions (post-bcrypt so timing is equal).
  if (!fabricator) return genericFail();
  if (!fabricator.is_active) return genericFail();
  if (fabricator.password_hash === INVITE_PENDING) return genericFail();

  if (!ok) {
    // F-14: increment failed_login_count + maybe set lockout.
    const newCount = (fabricator.failed_login_count ?? 0) + 1;
    const update: { failed_login_count: number; failed_login_locked_until?: string } = {
      failed_login_count: newCount,
    };
    if (newCount >= LOCKOUT_THRESHOLD) {
      update.failed_login_locked_until = new Date(
        Date.now() + LOCKOUT_DURATION_MS,
      ).toISOString();
    }
    await supabase.from("fabricators").update(update).eq("id", fabricator.id);
    return genericFail();
  }

  // Successful login — reset lockout state + create session.
  // Create a normal (is_setup=false) session.
  const session = await createFabricatorSession({
    fabricatorId: fabricator.id,
    isSetup: false,
    supabase,
  });

  // Reset failed_login_count + locked_until + bump last_login_at in one
  // round-trip (best-effort; don't fail login on audit error).
  await supabase
    .from("fabricators")
    .update({
      last_login_at: new Date().toISOString(),
      failed_login_count: 0,
      failed_login_locked_until: null,
    })
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
