/**
 * AuthHashForwarder — fallback catcher for Supabase auth hash fragments.
 *
 * When the Supabase redirect URL allowlist doesn't match `redirectTo`,
 * Supabase falls back to the project's Site URL. The access token still
 * lands in the URL hash (e.g. `https://studioloom.org/#access_token=...`)
 * but without this component it just sits there — the user sees the
 * landing page and has no idea they're actually authenticated.
 *
 * Mount this in the root layout. On mount it checks for `#access_token=`
 * or `#error=` in the URL and, if found, forwards to /auth/callback so
 * the real callback page can complete the sign-in (or show the error).
 *
 * No-op for every other URL (no hash, or hash unrelated to auth).
 */

"use client";

import { useEffect } from "react";

export default function AuthHashForwarder() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const h = hash.slice(1); // drop leading '#'
    const looksLikeAuth =
      h.includes("access_token=") ||
      h.includes("refresh_token=") ||
      h.includes("error_code=") ||
      h.includes("error_description=") ||
      h.startsWith("error=");

    if (!looksLikeAuth) return;

    // Don't loop if we're already on /auth/callback.
    if (window.location.pathname.startsWith("/auth/callback")) return;

    // Preserve the hash so /auth/callback can parse it.
    window.location.replace(`/auth/callback${window.location.search}${hash}`);
  }, []);

  return null;
}
