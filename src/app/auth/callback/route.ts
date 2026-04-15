/**
 * /auth/callback  —  SERVER route for PKCE code exchange.
 *
 * This endpoint is what Supabase redirects to after a teacher clicks
 * a password-reset email (the only flow in StudioLoom that uses PKCE).
 *
 *   URL: /auth/callback?code=<uuid>&next=/teacher/set-password[&type=recovery]
 *
 * PKCE exchange must happen server-side so `@supabase/ssr` can read the
 * `code_verifier` cookie that was set when the user submitted the form
 * (we use `createServerClient` with cookie access). Doing the exchange
 * from a client component produces:
 *
 *   "PKCE code verifier not found in storage"
 *
 * because the browser client can't reliably read the verifier across a
 * full-page navigation from the email link (apex→www redirects, cookie
 * scope, etc.).
 *
 * --------------------------------------------------------------------
 * Implicit-flow callbacks (invite emails with `#access_token=...` in
 * the hash) do NOT come here — hashes never reach the server. Those
 * land at `/auth/confirm` instead, which is a client page that parses
 * the hash and calls `setSession()`. `AuthHashForwarder` handles the
 * routing: hash-based auth → /auth/confirm, PKCE code → /auth/callback.
 * --------------------------------------------------------------------
 *
 * Routing rules after a successful exchange:
 *   type=recovery → /teacher/set-password   (forgot-password completion)
 *   type=invite   → /teacher/set-password?next=/teacher/welcome
 *   otherwise     → `next` param (safe-prefixed to /teacher/*)
 *
 * Errors redirect to /auth/confirm with ?error=... so the user sees the
 * shared error UI with a "Back to login" button.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function safeNext(raw: string | null): string {
  const fallback = "/teacher/welcome";
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

function routeFor(type: string | null, next: string): string {
  if (type === "recovery") return "/teacher/set-password";
  if (type === "invite") return "/teacher/set-password?next=/teacher/welcome";
  return next;
}

function errorRedirect(origin: string, message: string): NextResponse {
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const type = searchParams.get("type");
  const errorParam =
    searchParams.get("error_description") ||
    searchParams.get("error") ||
    searchParams.get("error_code");

  // Supabase bounced us here with an error query param (rare — usually
  // errors arrive in the hash for implicit flow).
  if (errorParam) {
    return errorRedirect(origin, errorParam);
  }

  // No code + no error — likely an implicit-flow callback whose hash
  // got stripped along the way, or a direct hit. Let the client-side
  // confirm page try to parse the hash; if nothing's there it'll show
  // a friendly error.
  if (!code) {
    return NextResponse.redirect(new URL("/auth/confirm", origin));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return errorRedirect(origin, error.message);
    }

    // Success — session cookies have been written to the response via
    // the `setAll` callback in createServerSupabaseClient.
    return NextResponse.redirect(new URL(routeFor(type, next), origin));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error during sign-in.";
    return errorRedirect(origin, message);
  }
}
