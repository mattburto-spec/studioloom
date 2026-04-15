/**
 * AuthHashForwarder — fallback catcher for Supabase auth redirects.
 *
 * When the Supabase redirect URL allowlist doesn't match `redirectTo`,
 * Supabase silently falls back to the project's Site URL with the auth
 * payload attached either:
 *
 *   - URL hash:   https://studioloom.org/#access_token=...&refresh_token=...
 *                 (implicit flow — invite emails; access/refresh tokens
 *                 or error_code in the hash fragment)
 *
 *   - Query str:  https://studioloom.org/?code=<uuid>
 *                 (PKCE flow — forgot-password emails; exchange-code
 *                 in the query string)
 *
 * Either way the user just sees the landing page and has no idea
 * they're mid-auth. This component mounts in the root layout, detects
 * the fallback, and forwards to the right handler:
 *
 *   hash auth  →  /auth/confirm   (client page; hash needs client JS)
 *   PKCE code  →  /auth/callback  (server route; needs cookie access
 *                                  to exchange the code for a session)
 *
 * The real fix is to add the /auth/callback + /auth/confirm URLs to
 * Supabase's Redirect URL allowlist — this forwarder is a belt-and-
 * braces safety net.
 *
 * No-op for every other URL (no hash + no code, or already on one of
 * the auth routes).
 */

"use client";

import { useEffect } from "react";

// Supabase PKCE codes are UUID-format. Restrict forwarding to real
// auth codes so we don't hijack unrelated `?code=` params on other
// pages in the future.
const PKCE_CODE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AuthHashForwarder() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Don't loop if we're already on one of the auth routes.
    const path = window.location.pathname;
    if (path.startsWith("/auth/callback") || path.startsWith("/auth/confirm"))
      return;

    const hash = window.location.hash;
    const search = window.location.search;

    // --- Hash check: implicit flow fallback (invite emails) -------------
    const h = hash.length >= 2 ? hash.slice(1) : "";
    const hashLooksLikeAuth =
      h.includes("access_token=") ||
      h.includes("refresh_token=") ||
      h.includes("error_code=") ||
      h.includes("error_description=") ||
      h.startsWith("error=");

    // --- Query check: PKCE flow fallback (reset emails) -----------------
    const params = new URLSearchParams(search);
    const code = params.get("code");
    const err = params.get("error") || params.get("error_code");
    const queryHasCode = code !== null && PKCE_CODE_RE.test(code);
    const queryHasError = err !== null;

    if (!hashLooksLikeAuth && !queryHasCode && !queryHasError) return;

    // Route to the right handler:
    //   hash tokens  → /auth/confirm  (client page parses the hash)
    //   PKCE code    → /auth/callback (server route does the exchange)
    //   error only   → /auth/confirm  (shared error UI)
    const target = queryHasCode ? "/auth/callback" : "/auth/confirm";
    window.location.replace(`${target}${search}${hash}`);
  }, []);

  return null;
}
