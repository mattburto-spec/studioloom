/**
 * /auth/confirm  —  CLIENT page for implicit-flow auth + error display.
 *
 * Two arrivals:
 *
 * 1. Implicit-flow callback (invite emails):
 *    URL:  /auth/confirm#access_token=...&refresh_token=...&type=invite
 *    Hash never reaches the server, so this MUST be a client component.
 *    We parse the hash, call supabase.auth.setSession(), then route
 *    based on `type` (invite → set-password → welcome).
 *
 * 2. Error display for either flow:
 *    URL:  /auth/confirm?error=<message>
 *    The server route at /auth/callback redirects here on PKCE error,
 *    and AuthHashForwarder redirects here when it sees an error in the
 *    URL hash. Single place for the "Something went wrong" UI.
 *
 * Suspense boundary required because useSearchParams opts the page
 * into dynamic rendering in Next.js 15.
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function safeNext(raw: string | null): string {
  if (!raw) return "/teacher/welcome";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/teacher/welcome";
}

function routeFor(type: string | null, next: string): string {
  if (type === "recovery") return "/teacher/set-password";
  if (type === "invite") return "/teacher/set-password?next=/teacher/welcome";
  return next;
}

function ConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const supabase = createClient();
    const next = safeNext(searchParams.get("next"));
    const queryError = searchParams.get("error");

    // Surface error params from server-route redirects immediately.
    if (queryError) {
      setStatus("error");
      setMessage(decodeURIComponent(queryError.replace(/\+/g, " ")));
      return;
    }

    async function handle() {
      if (typeof window === "undefined") return;

      const hash = window.location.hash;

      // No hash, no error param — someone navigated here directly.
      if (!hash || hash.length < 2) {
        setStatus("error");
        setMessage(
          "No sign-in credentials found in the link. Try requesting a fresh invite."
        );
        return;
      }

      const hashParams = new URLSearchParams(hash.slice(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashErr =
        hashParams.get("error_description") ||
        hashParams.get("error") ||
        hashParams.get("error_code");
      const hashType = hashParams.get("type");

      if (hashErr) {
        setStatus("error");
        setMessage(decodeURIComponent(hashErr.replace(/\+/g, " ")));
        return;
      }

      if (!accessToken || !refreshToken) {
        setStatus("error");
        setMessage(
          "No sign-in credentials found in the link. Try requesting a fresh invite."
        );
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        setStatus("error");
        setMessage(`Sign-in failed: ${error.message}`);
        return;
      }

      // Clear the hash so tokens don't stay in history.
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
      router.replace(routeFor(hashType, next));
    }

    handle().catch((e) => {
      setStatus("error");
      setMessage(
        e instanceof Error ? e.message : "Unexpected error during sign-in."
      );
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

export default function AuthConfirmPage() {
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
      <ConfirmInner />
    </Suspense>
  );
}
