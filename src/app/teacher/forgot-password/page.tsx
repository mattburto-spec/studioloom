/**
 * /teacher/forgot-password — request a password-reset email.
 *
 * Single input field (email). Calls supabase.auth.resetPasswordForEmail
 * with redirectTo pointed at /auth/callback?next=/teacher/set-password so
 * the recovery-link hash (type=recovery) lands on the callback, gets
 * routed to /teacher/set-password, and the teacher picks a new password.
 *
 * No account-existence leak: on success we always show "if an account
 * exists, we've sent a reset link" — whether the email matched a teacher
 * or not. Supabase's API responds the same either way for this reason.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setSending(true);
    try {
      const supabase = createClient();
      const siteUrl =
        typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = `${siteUrl}/auth/callback?next=/teacher/set-password`;
      const { error: sendErr } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      );
      if (sendErr) {
        // Don't surface "user not found" — leak-proof. Only surface
        // infrastructure errors (rate-limited, service unavailable, etc.).
        if (/rate/i.test(sendErr.message)) {
          setError(
            "Too many attempts. Please wait a minute and try again."
          );
        } else {
          setError(sendErr.message);
        }
        return;
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#4A0FB0] via-[#5C16C5] to-[#7B2FF2] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">
            Reset your password
          </h1>
          <p className="text-white/70 text-sm">
            We&apos;ll email you a link to choose a new one.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          {sent ? (
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
                Check your email
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                If an account exists for{" "}
                <span className="font-mono text-gray-700">{email.trim()}</span>,
                a reset link is on its way. It expires in a few hours —
                click it to pick a new password.
              </p>
              <Link
                href="/teacher/login"
                className="inline-block mt-4 text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="you@school.edu"
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
                disabled={sending || !email.trim()}
                className="w-full py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                style={{
                  background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                  boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)",
                }}
              >
                {sending ? "Sending…" : "Send reset link"}
              </button>

              <div className="pt-1 text-center">
                <Link
                  href="/teacher/login"
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
