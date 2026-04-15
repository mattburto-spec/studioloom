/**
 * AuthHashForwarder — fallback catcher for Supabase auth redirects.
 *
 * When the Supabase redirect URL allowlist doesn't match `redirectTo`,
 * Supabase silently falls back to the project's Site URL with the auth
 * payload attached either:
 *
 *   - URL hash:   https://studioloom.org/#access_token=...&refresh_token=...
 *                 (implicit flow — access/refresh tokens, or error_code)
 *
 *   - Query str:  https://studioloom.org/?code=<uuid>
 *                 (PKCE flow — exchange-code, or error)
 *
 * Either way the user just sees the landing page and has no idea
 * they're mid-auth. This component mounts in the root layout, detects
 * the fallback, and forwards to /auth/callback (preserving both query
 * and hash) so the real callback page can complete the flow.
 *
 * The real fix is to add the /auth/callback URLs to Supabase's Redirect
 * URL allowlist — this forwarder is a belt-and-braces safety net.
 *
 * No-op for every other URL (no hash + no code, or already on the
 * callback route).
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

    // Don't loop if we're already on /auth/callback.
    if (window.location.pathname.startsWith("/auth/callback")) return;

    const hash = window.location.hash;
    const search = window.location.search;

    // --- Hash check: implicit flow fallback -----------------------------
    const h = hash.length >= 2 ? hash.slice(1) : "";
    const hashLooksLikeAuth =
      h.includes("access_token=") ||
      h.includes("refresh_token=") ||
      h.includes("error_code=") ||
      h.includes("error_description=") ||
      h.startsWith("error=");

    // --- Query check: PKCE flow fallback --------------------------------
    const params = new URLSearchParams(search);
    const code = params.get("code");
    const err = params.get("error") || params.get("error_code");
    const queryLooksLikeAuth =
      (code !== null && PKCE_CODE_RE.test(code)) || err !== null;

    if (!hashLooksLikeAuth && !queryLooksLikeAuth) return;

    // Preserve both the query string and hash — the callback page reads
    // from either source depending on which Supabase flow was used.
    window.location.replace(`/auth/callback${search}${hash}`);
  }, []);

  return null;
}
