"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Stage = "verifying" | "invalid" | "ready" | "submitting" | "done";

const MIN_PASSWORD_LENGTH = 12;

function FabSetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [stage, setStage] = useState<Stage>("verifying");
  const [displayName, setDisplayName] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // On mount: verify the token before showing the form.
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setStage("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/fab/set-password/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && typeof data.displayName === "string") {
          setDisplayName(data.displayName);
          setStage("ready");
        } else {
          setStage("invalid");
        }
      } catch {
        if (!cancelled) setStage("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setStage("submitting");
    try {
      const res = await fetch("/api/fab/set-password/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to set password.");
        setStage("ready");
        return;
      }
      setStage("done");
      router.push("/fab/queue");
    } catch {
      setError("Network error. Please try again.");
      setStage("ready");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-block rounded-2xl bg-gradient-to-br from-purple-600 via-purple-800 to-purple-900 px-5 py-3 text-lg font-bold tracking-tight text-white shadow-lg">
            Preflight · Fabricator
          </div>
        </div>

        {stage === "verifying" && (
          <div className="rounded-2xl bg-slate-900 p-6 text-center text-sm text-slate-400 ring-1 ring-slate-800">
            Checking your link…
          </div>
        )}

        {stage === "invalid" && (
          <div className="rounded-2xl bg-slate-900 p-6 ring-1 ring-slate-800">
            <h1 className="text-base font-semibold text-slate-100">
              This link is invalid or expired
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Set-password links are valid for 24 hours. Ask the teacher who
              invited you to send a fresh one.
            </p>
          </div>
        )}

        {(stage === "ready" || stage === "submitting" || stage === "done") && (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-slate-900 p-6 shadow-xl ring-1 ring-slate-800"
          >
            <p className="mb-4 text-sm text-slate-300">
              Welcome{displayName ? `, ${displayName}` : ""}. Set your password
              to finish setting up your Fabricator account.
            </p>

            <label className="block text-sm font-medium text-slate-300">
              New password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border-0 bg-slate-800 px-3 py-2 text-base text-slate-100 shadow-sm ring-1 ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-purple-500"
                disabled={stage !== "ready"}
              />
            </label>

            <label className="mt-4 block text-sm font-medium text-slate-300">
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border-0 bg-slate-800 px-3 py-2 text-base text-slate-100 shadow-sm ring-1 ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-purple-500"
                disabled={stage !== "ready"}
              />
            </label>

            <p className="mt-2 text-xs text-slate-500">
              Minimum {MIN_PASSWORD_LENGTH} characters.
            </p>

            {error && (
              <p className="mt-4 rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-900">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={stage !== "ready"}
              className="mt-6 w-full rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 px-4 py-2.5 text-base font-semibold text-white shadow-md hover:from-purple-400 hover:to-purple-600 disabled:opacity-60"
            >
              {stage === "submitting" ? "Setting password…" : "Set password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function FabSetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="w-full max-w-sm">
            <div className="rounded-2xl bg-slate-900 p-6 text-center text-sm text-slate-400 ring-1 ring-slate-800">
              Loading…
            </div>
          </div>
        </div>
      }
    >
      <FabSetPasswordInner />
    </Suspense>
  );
}
