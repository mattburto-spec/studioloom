/**
 * /teacher/set-password — set or change a teacher account password.
 *
 * Two entry points:
 *   1. Auth callback routes invite + recovery flows here after setting the
 *      session. We want every new teacher to leave an invite with a real
 *      password so they can actually log back in later.
 *   2. Logged-in teachers can navigate here manually to change their
 *      password at any time (e.g. forgot password → email link → set → done).
 *
 * Session-gated: if supabase.auth.getUser() returns no user we boot to
 * /teacher/login. The underlying updateUser() call also requires a session,
 * so this is belt-and-braces — the UI guard just keeps us from flashing the
 * form before redirecting.
 *
 * After a successful update we forward to `next` (safe-prefixed to /teacher/*).
 * Default next is /teacher/dashboard for logged-in teachers changing their
 * password, but the invite callback sets `next=/teacher/welcome` so new
 * teachers land in the onboarding wizard immediately after setting their
 * password.
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

function safeNext(raw: string | null): string {
  const fallback = "/teacher/dashboard";
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

function SetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const next = safeNext(searchParams.get("next"));

  // Session guard — bounce unauthenticated visitors to login.
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/teacher/login?error=set_password_no_session");
          return;
        }
        setEmail(user.email ?? null);
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pw1.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (pw1 !== pw2) {
      setError("Passwords don't match.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase.auth.updateUser({
        password: pw1,
      });
      if (updateErr) {
        setError(updateErr.message);
        return;
      }
      setSuccess(true);
      // Give the user a moment to read the confirmation then forward.
      setTimeout(() => {
        window.location.href = next;
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#4A0FB0] via-[#5C16C5] to-[#7B2FF2]">
        <div className="flex items-center gap-3 text-white/80">
          <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#4A0FB0] via-[#5C16C5] to-[#7B2FF2] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Set your password</h1>
          <p className="text-white/70 text-sm">
            {email ? (
              <>
                Pick a password for{" "}
                <span className="font-mono text-white/90">{email}</span>. You&apos;ll
                use it to sign back in later.
              </>
            ) : (
              <>Pick a password so you can sign back in later.</>
            )}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          {success ? (
            <div className="text-center py-4">
              <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#16A34A"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                Password saved
              </p>
              <p className="text-xs text-gray-500">Taking you through…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  New password
                </label>
                <input
                  type="password"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  autoFocus
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  autoComplete="new-password"
                  placeholder="Repeat the password"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all text-sm"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving || !pw1 || !pw2}
                className="w-full py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                style={{
                  background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                  boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)",
                }}
              >
                {saving ? "Saving…" : "Save password"}
              </button>

              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                After saving, you&apos;ll be signed in automatically. Use this
                password next time you visit{" "}
                <Link
                  href="/teacher/login"
                  className="text-purple-600 hover:text-purple-800"
                >
                  /teacher/login
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#4A0FB0] via-[#5C16C5] to-[#7B2FF2]">
          <div className="flex items-center gap-3 text-white/80">
            <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        </div>
      }
    >
      <SetPasswordInner />
    </Suspense>
  );
}
