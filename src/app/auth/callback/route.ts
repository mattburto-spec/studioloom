/**
 * /auth/callback  —  SERVER route for PKCE code exchange.
 *
 * This endpoint is what Supabase redirects to after:
 *   1. Teacher clicks password-reset email (type=recovery)
 *   2. Teacher clicks invite email (type=invite)
 *   3. Phase 2.1+ — Teacher signs in via Microsoft/Google OAuth (no type)
 *
 *   URL: /auth/callback?code=<uuid>&next=/teacher/dashboard[&type=...]
 *
 * PKCE exchange must happen server-side so `@supabase/ssr` can read the
 * `code_verifier` cookie that was set when the user submitted the form
 * or clicked the OAuth button. Doing the exchange from a client component
 * produces "PKCE code verifier not found in storage".
 *
 * --------------------------------------------------------------------
 * Implicit-flow callbacks (invite emails with `#access_token=...` in
 * the hash) do NOT come here — hashes never reach the server. Those
 * land at `/auth/confirm` instead.
 * --------------------------------------------------------------------
 *
 * Routing rules after a successful exchange:
 *   type=recovery → /teacher/set-password   (forgot-password completion)
 *   type=invite   → /teacher/set-password?next=/teacher/welcome
 *   no type, NEW user (no teachers row) → /teacher/welcome (after provisioning)
 *   no type, EXISTING user → `next` param (safe-prefixed to /teacher/*)
 *
 * Phase 2.1 (30 Apr 2026) — OAuth first-login teacher provisioning:
 *   when a user lands here without a `teachers` row (i.e. signed in via
 *   Microsoft/Google for the first time), this route:
 *     1. INSERTs a `teachers` row using metadata from the OAuth provider
 *     2. Sets `app_metadata.user_type = 'teacher'` so Phase 1.3's
 *        polymorphic getActorSession() dispatches correctly
 *     3. Redirects to /teacher/welcome for first-class onboarding
 *
 * Existing teachers (already have a teachers row) skip provisioning and
 * route normally.
 *
 * Errors redirect to /auth/confirm with ?error=... so the user sees the
 * shared error UI with a "Back to login" button.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function safeNext(raw: string | null): string {
  // For OAuth flows the caller passes `next=/teacher/dashboard` explicitly.
  // For password-reset/invite flows the type param overrides next anyway.
  // Default fallback: dashboard (safe for the OAuth case where next was
  // accidentally stripped by Supabase's Site URL handling).
  const fallback = "/teacher/dashboard";
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

/**
 * First-login teacher provisioning. Called when an OAuth user lands at
 * the callback for the first time (no `teachers` row yet for their
 * auth.users.id). INSERTs a teachers row + sets app_metadata.user_type.
 *
 * Returns: the redirect URL the caller should send the user to.
 *   - On success: /teacher/welcome (first-class onboarding flow)
 *   - On insert failure: throws — caller wraps in errorRedirect
 *
 * Idempotent: if the teachers row already exists (race condition with
 * a concurrent callback), the INSERT fails with 23505 unique violation
 * which we treat as "already provisioned" and return the welcome URL.
 */
async function provisionTeacherFromOAuth(
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }
): Promise<void> {
  const admin = createAdminClient();

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Teacher";

  // Try INSERT — handle 23505 (unique violation) as idempotent success
  // in case two concurrent callbacks for the same user race.
  const { error: insertErr } = await admin
    .from("teachers")
    .insert({
      id: user.id,
      email: user.email!,
      name: fullName,
      display_name: fullName,
      locale: "en",
      // school_id: NULL — Phase 4 will handle domain-based school assignment
      // onboarded_at: NULL — forces /teacher/welcome flow
    });

  if (insertErr && insertErr.code !== "23505") {
    throw new Error(`teachers INSERT failed: ${insertErr.message}`);
  }

  // Set user_type claim so Phase 1.3's polymorphic getActorSession()
  // recognizes this user as a teacher. Merging with existing app_metadata
  // (which Supabase Auth populates with provider info).
  const { error: metaErr } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata ?? {}),
      user_type: "teacher",
      created_via: "oauth",
    },
  });

  if (metaErr) {
    // Non-fatal — log and continue. The teachers row exists; subsequent
    // sign-ins will pick up the metadata via Supabase's provider sync.
    console.error(
      "[/auth/callback] Failed to set app_metadata.user_type:",
      metaErr.message
    );
  }
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
    const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeErr) {
      return errorRedirect(origin, exchangeErr.message);
    }

    // Recovery / invite flows skip teacher provisioning — the teacher row
    // already exists (recovery = forgot-password on existing account; invite =
    // teacher_access_requests workflow created the row server-side already).
    if (type === "recovery" || type === "invite") {
      return NextResponse.redirect(new URL(routeFor(type, next), origin));
    }

    // OAuth flow (or any non-typed code exchange) — check if first-login.
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return errorRedirect(origin, "Session created but user lookup failed");
    }
    const user = userData.user;

    // Look up existing teachers row using admin client (RLS-bypassing).
    // Admin client is required because the user just signed in but
    // app_metadata.user_type may not yet be 'teacher' for first-login
    // OAuth users — RLS reads against teachers would 0-row.
    const admin = createAdminClient();
    const { data: existingTeacher } = await admin
      .from("teachers")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingTeacher) {
      // First-login OAuth user — provision teacher row + app_metadata.
      try {
        await provisionTeacherFromOAuth(user);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to provision teacher row";
        return errorRedirect(origin, message);
      }

      // Send them through onboarding rather than straight to dashboard.
      return NextResponse.redirect(new URL("/teacher/welcome", origin));
    }

    // Existing teacher — route to the requested next (or default dashboard).
    return NextResponse.redirect(new URL(routeFor(type, next), origin));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error during sign-in.";
    return errorRedirect(origin, message);
  }
}
