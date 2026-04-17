"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function TeacherLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Request access modal state
  const [showRequest, setShowRequest] = useState(false);
  const [reqEmail, setReqEmail] = useState("");
  const [reqName, setReqName] = useState("");
  const [reqSchool, setReqSchool] = useState("");
  const [reqRole, setReqRole] = useState("");
  const [reqMessage, setReqMessage] = useState("");
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqError, setReqError] = useState("");
  const [reqSent, setReqSent] = useState(false);

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

      router.push("/teacher/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setReqError("");
    setReqSubmitting(true);

    try {
      const res = await fetch("/api/teacher/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: reqEmail,
          name: reqName,
          school: reqSchool,
          role: reqRole,
          message: reqMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReqError(data.error || "Failed to submit request");
        return;
      }
      setReqSent(true);
    } catch {
      setReqError("Something went wrong. Please try again.");
    } finally {
      setReqSubmitting(false);
    }
  }

  function closeRequestModal() {
    setShowRequest(false);
    // Reset after a delay so the closing animation doesn't show a flash of empty
    setTimeout(() => {
      setReqEmail("");
      setReqName("");
      setReqSchool("");
      setReqRole("");
      setReqMessage("");
      setReqError("");
      setReqSent(false);
    }, 200);
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">StudioLoom</h1>
          <p className="text-white/60">Teacher Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                required
                className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 gradient-cta text-white rounded-full font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-brand-pink/20"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>

            <div className="text-center">
              <Link
                href="/teacher/forgot-password"
                className="text-xs text-text-secondary hover:text-accent-blue transition"
              >
                Forgot password? · Need a sign-in link?
              </Link>
            </div>
          </form>

          <p className="text-center mt-4 text-xs text-text-tertiary">
            Teacher accounts are invite-only during the pilot.{" "}
            <button
              type="button"
              onClick={() => setShowRequest(true)}
              className="text-accent-blue hover:underline font-medium"
            >
              Request access
            </button>
          </p>
        </div>

        <p className="text-center mt-6 text-white/40 text-sm">
          Student?{" "}
          <Link href="/login" className="text-white/70 hover:text-white underline">
            Log in here
          </Link>
        </p>
      </div>

      {/* Request Access Modal */}
      {showRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => !reqSubmitting && closeRequestModal()}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {reqSent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: "#D1FAE5" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-text-primary">Request sent!</h3>
                <p className="text-sm text-text-secondary mt-1">
                  We&rsquo;ll review your request and email you an invite if approved.
                </p>
                <button
                  onClick={closeRequestModal}
                  className="mt-5 px-5 py-2 gradient-cta text-white rounded-full text-sm font-medium"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">Request access</h3>
                    <p className="text-sm text-text-secondary mt-0.5">
                      Tell us who you are and we&rsquo;ll send you an invite.
                    </p>
                  </div>
                  <button
                    onClick={closeRequestModal}
                    className="p-1 text-text-tertiary hover:text-text-primary"
                    aria-label="Close"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleRequestSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      placeholder="you@school.edu"
                      required
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Full name
                    </label>
                    <input
                      type="text"
                      value={reqName}
                      onChange={(e) => setReqName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">
                        School
                      </label>
                      <input
                        type="text"
                        value={reqSchool}
                        onChange={(e) => setReqSchool(e.target.value)}
                        placeholder="School name"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">
                        Role
                      </label>
                      <input
                        type="text"
                        value={reqRole}
                        onChange={(e) => setReqRole(e.target.value)}
                        placeholder="e.g. MYP Design"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Anything else?
                    </label>
                    <textarea
                      value={reqMessage}
                      onChange={(e) => setReqMessage(e.target.value)}
                      placeholder="How you heard about us, what you teach, etc."
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent resize-none"
                    />
                  </div>

                  {reqError && (
                    <p className="text-sm text-red-500">{reqError}</p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={closeRequestModal}
                      disabled={reqSubmitting}
                      className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={reqSubmitting}
                      className="px-5 py-2 gradient-cta text-white rounded-full text-sm font-medium disabled:opacity-50"
                    >
                      {reqSubmitting ? "Sending..." : "Send request"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
