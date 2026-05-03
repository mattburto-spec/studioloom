// audit-skip: routine fab-tech operational endpoint, audit lives in fabrication pipeline state machine
/**
 * POST /api/fab/set-password/verify
 *
 * Pre-auth endpoint. Called by the /fab/set-password page on mount to check
 * that the ?token=... in the URL is a valid setup/reset session before
 * rendering the password form.
 *
 * Separate from /submit so the page can show a friendly "this link has
 * expired" screen without the user typing their password first.
 *
 * Rate-limited per IP since this reveals whether a token is valid
 * (attacker could try many). Returns a generic 401 on any failure —
 * don't leak whether a session exists, is expired, or is a login session.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import {
  validateSetupSession,
  FAB_PRIVATE_CACHE_HEADERS,
} from "@/lib/fab/auth";

const VERIFY_LIMITS = [
  { maxRequests: 20, windowMs: 60 * 1000 },
  { maxRequests: 100, windowMs: 60 * 60 * 1000 },
];

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: FAB_PRIVATE_CACHE_HEADERS });
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = rateLimit(`fab-setpw-verify:${ip}`, VERIFY_LIMITS);
  if (!allowed) {
    return privateJson({ error: "Too many attempts. Try again later." }, 429);
  }

  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return privateJson({ error: "Invalid JSON body" }, 400);
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return privateJson({ error: "Invalid or expired link" }, 401);

  const supabase = createAdminClient();
  const validation = await validateSetupSession(token, supabase);
  if (!validation) {
    return privateJson({ error: "Invalid or expired link" }, 401);
  }

  return privateJson({
    fabricatorId: validation.fabricator.id,
    displayName: validation.fabricator.display_name,
  });
}
