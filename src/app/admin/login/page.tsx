"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

function AdminLoginInner() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/admin";
  const urlError = searchParams.get("error");
  const urlReason = searchParams.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    urlError === "not_authorised"
      ? "This account doesn't have admin access. Sign in with an admin account."
      : urlReason === "session-changed"
      ? "Your admin session was replaced — likely because a student or teacher signed in inside another window of this browser profile. Sign in again to continue."
      : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }

      // Verify admin status BEFORE navigating. Without this, a non-admin
      // teacher would briefly see the admin dashboard shell (bfcache snapshot
      // or server HTML in flight) before middleware bounced them back here.
      // Only navigate on a clean 200 from /api/admin/whoami.
      const whoamiRes = await fetch("/api/admin/whoami", {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (whoamiRes.ok) {
        window.location.replace(redirect);
        return;
      }

      if (whoamiRes.status === 403) {
        await supabase.auth.signOut();
        setError("This account doesn't have admin access. Try a different account.");
        return;
      }

      setError("Couldn't verify admin access. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setError("");
    setEmail("");
    setPassword("");
    // Reload the page so middleware sees the cleared session
    window.location.href = "/admin/login";
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #312E81 100%)",
      }}
    >
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #F59E0B, #D97706)",
              boxShadow: "0 4px 20px rgba(245, 158, 11, 0.4)",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Admin Access</h1>
          <p className="text-white/60 text-sm">Restricted — administrators only</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl p-6">
          {urlError === "not_authorised" && (
            <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs">
              You are signed in, but this account doesn&rsquo;t have admin access.{" "}
              <button
                type="button"
                onClick={handleSignOut}
                className="underline font-medium hover:text-amber-100"
              >
                Sign out
              </button>{" "}
              and try a different account.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wider">
                Admin email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@…"
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-transparent"
              />
            </div>

            {error && !urlError && (
              <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-medium text-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
              style={{
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                boxShadow: "0 4px 20px rgba(245, 158, 11, 0.3)",
              }}
            >
              {loading ? "Signing in…" : "Sign in to admin"}
            </button>
          </form>

          <p className="text-center mt-4 text-[11px] text-white/40">
            This area is logged and audited.
          </p>
        </div>

        <p className="text-center mt-6 text-white/40 text-xs">
          Not an admin?{" "}
          <Link href="/teacher/login" className="text-white/70 hover:text-white underline">
            Teacher login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: "#0F172A" }}>
          <div className="text-white/60 text-sm">Loading…</div>
        </div>
      }
    >
      <AdminLoginInner />
    </Suspense>
  );
}
