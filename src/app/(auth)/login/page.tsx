"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function StudentLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"code" | "username">("code");
  const [classCode, setClassCode] = useState("");
  const [username, setUsername] = useState("");
  const [className, setClassName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classCode, username }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        if (res.status === 401 && data.error === "Invalid class code") {
          setStep("code");
        }
        return;
      }

      setClassName(data.className);
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-dark-blue to-dark-blue/90 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Questerra</h1>
          <p className="text-white/60">Student Login</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          {step === "code" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Class Code
                </label>
                <input
                  type="text"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC123"
                  maxLength={6}
                  className="w-full px-4 py-3 border border-border rounded-lg text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && classCode.length >= 4) {
                      setStep("username");
                    }
                  }}
                />
              </div>
              <button
                onClick={() => {
                  if (classCode.length >= 4) {
                    setError("");
                    setStep("username");
                  }
                }}
                disabled={classCode.length < 4}
                className="w-full py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-alt rounded-lg px-3 py-2">
                <span className="font-mono font-medium text-accent-blue">{classCode}</span>
                <button
                  onClick={() => setStep("code")}
                  className="ml-auto text-xs text-accent-blue hover:underline"
                >
                  Change
                </button>
              </div>
              {className && (
                <p className="text-sm text-text-secondary">{className}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && username.trim()) {
                      handleLogin();
                    }
                  }}
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={!username.trim() || loading}
                className="w-full py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Logging in..." : "Log In"}
              </button>
            </>
          )}

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
        </div>

        <p className="text-center mt-6 text-white/40 text-sm">
          Teacher?{" "}
          <Link href="/teacher/login" className="text-white/70 hover:text-white underline">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
}
