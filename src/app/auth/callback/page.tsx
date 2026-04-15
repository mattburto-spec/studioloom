/**
 * /auth/callback  — client-side auth completion page
 *
 * Supabase's auth verify endpoint redirects here after a teacher clicks
 * an invite / magic-link / password-reset email. Two flows are possible
 * depending on the project's auth configuration:
 *
 *   1. PKCE flow (newer projects)
 *      URL: /auth/callback?code=XYZ&next=/teacher/welcome
 *      Handle with supabase.auth.exchangeCodeForSession(code).
 *
 *   2. Implicit flow (legacy / current project)
 *      URL: /auth/callback#access_token=...&refresh_token=...&type=invite
 *      Hash fragments never reach the server, so this MUST be a client
 *      component. Parse the hash and call supabase.auth.setSession().
 *
 * Either way, once the session cookies are set we router.replace() to
 * `next` (default /teacher/welcome).
 *
 * Error modes land the user back at /teacher/login with an error param.
 *
 * Suspense boundary is required because useSearchParams opts the page
 * into dynamic rendering in Next.js 15.
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function safeNext(raw: string | null): string {
  if (!raw) return "/teacher/welcome";
  // Only allow internal paths (no protocol, no protocol-relative //).
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/teacher/welcome";
}

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const supabase = createClient();
    const next = safeNext(searchParams.get("next"));

    async function handle() {
      // Case 1: PKCE flow — ?code=XYZ in query string.
      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus("error");
          setMessage(`Sign-in failed: ${error.message}`);
          return;
        }
        router.replace(next);
        return;
      }

      // Case 2: Implicit flow — #access_token=...&refresh_token=... in hash.
      if (typeof window !== "undefined" && window.location.hash.includes("access_token=")) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const hashErr = hashParams.get("error_description") || hashParams.get("error");

        if (hashErr) {
          setStatus("error");
          setMessage(decodeURIComponent(hashErr.replace(/\+/g, " ")));
          return;
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            setStatus("error");
            setMessage(`Sign-in failed: ${error.message}`);
            return;
          }
          // Clear the hash so tokens aren't kept in history.
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          }
          router.replace(next);
          return;
        }
      }

      // Neither flow matched. Likely the user navigated here directly or
      // the hash was stripped by an email client / proxy.
      setStatus("error");
      setMessage(
        "No sign-in credentials found in the link. Try requesting a fresh invite."
      );
    }

    handle().catch((e) => {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Unexpected error during sign-in.");
    });
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#4A0FB0] via-[#5C16C5] to-[#7B2FF2] text-white">
      <div className="text-center max-w-md px-6">
        {status === "loading" ? (
          <>
            <div
              className="mx-auto mb-5 w-12 h-12 border-4 border-white/25 border-t-white rounded-full animate-spin"
              aria-hidden
            />
            <p className="text-lg font-medium">{message}</p>
            <p className="text-sm text-white/70 mt-2">One moment…</p>
          </>
        ) : (
          <>
            <div
              className="mx-auto mb-5 w-12 h-12 rounded-full bg-red-500/25 flex items-center justify-center text-2xl"
              aria-hidden
            >
              !
            </div>
            <p className="text-lg font-semibold mb-3">Something went wrong</p>
            <p className="text-sm text-white/80 mb-6">{message}</p>
            <a
              href="/teacher/login"
              className="inline-block px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition"
            >
              Back to login
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#4A0FB0] via-[#5C16C5] to-[#7B2FF2] text-white">
          <div className="text-center">
            <div className="mx-auto mb-5 w-12 h-12 border-4 border-white/25 border-t-white rounded-full animate-spin" />
            <p className="text-lg font-medium">Signing you in…</p>
          </div>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
