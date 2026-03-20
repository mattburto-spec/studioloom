"use client";

import { useState, useEffect } from "react";

interface OwnTimeStatus {
  approved: boolean;
  approved_at: string | null;
  teacher_note: string | null;
}

/**
 * Own Time card on the student dashboard.
 *
 * Three states:
 * 1. LOCKED — student hasn't earned it yet. Shows as a beautiful locked card
 *    with subtle animation that creates anticipation.
 * 2. JUST UNLOCKED — teacher approved, student hasn't opened it yet. Glows and
 *    pulses, feels like an achievement.
 * 3. ACTIVE — student has started their Own Time journey.
 */
export function OwnTimeCard() {
  const [status, setStatus] = useState<OwnTimeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/student/own-time/status");
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        } else {
          // API not ready yet — show locked state
          setStatus({ approved: false, approved_at: null, teacher_note: null });
        }
      } catch {
        setStatus({ approved: false, approved_at: null, teacher_note: null });
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl p-6 animate-pulse h-44 border border-border bg-white shadow-sm" />
    );
  }

  if (!status) return null;

  // APPROVED — glowing, ready to start
  if (status.approved) {
    return (
      <div
        className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
          border: "1px solid rgba(56,189,248,0.3)",
          boxShadow: hovering
            ? "0 8px 32px rgba(56,189,248,0.2), inset 0 1px 0 rgba(255,255,255,0.05)"
            : "0 4px 16px rgba(56,189,248,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={() => {
          // TODO: Navigate to Own Time workspace
          // For now, we show a coming-soon state
        }}
      >
        {/* Animated glow pulse */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: "radial-gradient(ellipse 300px 200px at 50% 50%, rgba(56,189,248,0.15), transparent)",
            animation: "ownTimePulse 3s ease-in-out infinite",
          }}
        />

        {/* Tiny aurora accents */}
        <div className="absolute top-0 right-0 w-32 h-32 opacity-20"
          style={{ background: "radial-gradient(circle, rgba(45,212,191,0.3), transparent)" }}
        />
        <div className="absolute bottom-0 left-0 w-24 h-24 opacity-15"
          style={{ background: "radial-gradient(circle, rgba(167,139,250,0.3), transparent)" }}
        />

        <div className="relative p-6">
          {/* Unlocked badge */}
          <div className="flex items-center gap-2 mb-3">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{
                background: "rgba(74,222,128,0.15)",
                color: "#4ade80",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0" />
              </svg>
              Unlocked
            </div>
          </div>

          <h3 className="text-lg font-bold text-white tracking-tight mb-1">
            Your Own Time
          </h3>
          <p className="text-sm text-white/50 mb-4 max-w-xs">
            You&apos;ve earned autonomous learning time. Explore what interests you, with a mentor to guide your journey.
          </p>

          {/* Teacher note */}
          {status.teacher_note && (
            <div
              className="rounded-xl px-4 py-3 mb-4"
              style={{
                background: "rgba(255,255,255,0.04)",
                borderLeft: "2px solid rgba(56,189,248,0.4)",
              }}
            >
              <p className="text-[11px] text-white/30 uppercase tracking-wider mb-1 font-medium">
                From your teacher
              </p>
              <p className="text-sm text-white/60 italic leading-relaxed">
                &ldquo;{status.teacher_note}&rdquo;
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 group-hover:gap-2.5"
              style={{
                background: "linear-gradient(135deg, #38bdf8, #2dd4bf)",
                color: "#0a0e1a",
              }}
            >
              Begin Your Journey
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14m-7-7 7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>

        <style>{`
          @keyframes ownTimePulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.6; }
          }
        `}</style>
      </div>
    );
  }

  // LOCKED — creates anticipation
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
        border: "1px solid #e2e8f0",
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Lock pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative p-6">
        <div className="flex items-start gap-4">
          {/* Lock icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500"
            style={{
              background: hovering
                ? "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(45,212,191,0.08))"
                : "rgba(0,0,0,0.04)",
              border: hovering ? "1px solid rgba(56,189,248,0.2)" : "1px solid transparent",
            }}
          >
            <svg
              width="22" height="22" viewBox="0 0 24 24" fill="none"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              style={{
                stroke: hovering ? "#38bdf8" : "#94a3b8",
                transition: "stroke 0.5s ease",
              }}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <div className="flex-1">
            <h3
              className="text-base font-bold tracking-tight transition-colors duration-500"
              style={{ color: hovering ? "#0f172a" : "#64748b" }}
            >
              Own Time
            </h3>
            <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">
              Complete your current units to unlock self-directed learning time with an AI mentor.
            </p>

            {/* Progress hint */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: hovering ? "15%" : "0%",
                    background: "linear-gradient(90deg, #38bdf8, #2dd4bf)",
                    opacity: hovering ? 1 : 0,
                  }}
                />
              </div>
              <span className="text-[11px] text-slate-400 font-medium transition-opacity duration-500"
                style={{ opacity: hovering ? 1 : 0 }}
              >
                Keep going...
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
