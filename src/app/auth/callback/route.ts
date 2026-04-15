/**
 * GET /auth/callback
 *
 * Server route that completes the Supabase PKCE flow for magic-link /
 * invite / password-reset / OAuth sign-ins.
 *
 * Supabase emails the teacher a link of the form:
 *   https://studioloom.org/auth/callback?code=XYZ&next=/teacher/welcome
 *
 * This route calls `exchangeCodeForSession(code)` on the server-side
 * Supabase client (which writes the sb-* HttpOnly session cookies via
 * @supabase/ssr's cookie adapter) and then redirects the teacher to
 * `next` (or `/teacher/welcome` by default).
 *
 * Failure modes:
 *   - Missing `code` param          → redirect to /teacher/login?error=missing_code
 *   - exchangeCodeForSession error  → redirect to /teacher/login?error=<msg>
 *     (covers otp_expired, invalid_grant, etc. — Supabase already sends
 *      error params in the hash when the OTP itself is dead, but this
 *      path catches server-side code-for-session failures.)
 *
 * Related: src/app/api/admin/teachers/invite/route.ts sets redirectTo
 * to this URL; Supabase Dashboard → Authentication → URL Configuration
 * must include https://studioloom.org/auth/callback in the allowlist.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") || "/teacher/welcome";

  // Guard: only allow internal paths as `next` (prevent open-redirect).
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/teacher/welcome";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/teacher/login?error=missing_code`
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const errParam = encodeURIComponent(error.message || "exchange_failed");
    return NextResponse.redirect(
      `${origin}/teacher/login?error=${errParam}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
