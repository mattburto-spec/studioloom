"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function FabLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/fab/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Login failed. Please try again."
        );
        setSubmitting(false);
        return;
      }
      router.push("/fab/queue");
    } catch {
      setError("Network error. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-block rounded-2xl bg-gradient-to-br from-purple-600 via-purple-800 to-purple-900 px-5 py-3 text-lg font-bold tracking-tight text-white shadow-lg">
            Preflight · Fabricator
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Sign in to pick up scanned jobs.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-slate-900 p-6 shadow-xl ring-1 ring-slate-800"
        >
          <label className="block text-sm font-medium text-slate-300">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border-0 bg-slate-800 px-3 py-2 text-base text-slate-100 shadow-sm ring-1 ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-purple-500"
              disabled={submitting}
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-300">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border-0 bg-slate-800 px-3 py-2 text-base text-slate-100 shadow-sm ring-1 ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-purple-500"
              disabled={submitting}
            />
          </label>

          {error && (
            <p className="mt-4 rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-900">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 px-4 py-2.5 text-base font-semibold text-white shadow-md hover:from-purple-400 hover:to-purple-600 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            Invited by a teacher? Check your email for the set-password link.
          </p>
        </form>
      </div>
    </div>
  );
}
