"use client";

import { useState, useEffect, useRef } from "react";

const CATEGORIES = [
  { value: "broken", label: "Something's broken", icon: "🔴" },
  { value: "visual", label: "Doesn't look right", icon: "🎨" },
  { value: "confused", label: "I'm confused", icon: "❓" },
  { value: "feature_request", label: "Feature request", icon: "💡" },
] as const;

interface BugReportButtonProps {
  /** Current user role */
  role: "teacher" | "student";
  /** Current class ID (if in class context) */
  classId?: string | null;
  /** Whether bug reporting is enabled for this class. Admin/teacher always see the button. */
  enabled?: boolean;
}

export function BugReportButton({ role, classId, enabled = true }: BugReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"pick" | "form">("pick");
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const consoleErrorsRef = useRef<string[]>([]);

  // Capture console errors
  useEffect(() => {
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      consoleErrorsRef.current = [
        ...consoleErrorsRef.current.slice(-4),
        args.map(String).join(" ").slice(0, 500),
      ];
      origError.apply(console, args);
    };
    return () => { console.error = origError; };
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Teachers always see the button; students only when enabled for their class
  if (role === "student" && !enabled) return null;

  const handleClose = () => {
    setOpen(false);
    setStep("pick");
    setCategory(null);
    setDescription("");
    setError(null);
    setSubmitted(false);
  };

  const handleCategoryPick = (cat: string) => {
    setCategory(cat);
    setStep("form");
  };

  const handleSubmit = async () => {
    if (!category || !description.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description: description.trim(),
          page_url: window.location.href,
          console_errors: consoleErrorsRef.current,
          class_id: classId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setSubmitted(true);
      setTimeout(handleClose, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{
          background: open ? "#DC2626" : "#7B2FF2",
          color: "white",
        }}
        title="Report a bug"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
            <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6z" />
            <path d="M12 20v2M6 13H2M22 13h-4M6 17H3.5M20.5 17H18M6 9H4M20 9h-2" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-6 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        >
          {submitted ? (
            <div className="p-6 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm font-medium text-gray-900">Report submitted!</p>
              <p className="text-xs text-gray-500 mt-1">Thanks for helping improve StudioLoom</p>
            </div>
          ) : step === "pick" ? (
            <div className="p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">What's happening?</p>
              <div className="space-y-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => handleCategoryPick(c.value)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <span className="text-lg">{c.icon}</span>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setStep("pick")}
                  className="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-semibold text-gray-900">
                  {CATEGORIES.find((c) => c.value === category)?.label}
                </span>
              </div>

              <textarea
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened..."
                className="w-full h-24 px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                maxLength={2000}
              />

              <p className="text-[10px] text-gray-400 mt-1">
                Auto-captures: page URL, browser info{consoleErrorsRef.current.length > 0 ? `, ${consoleErrorsRef.current.length} console errors` : ""}
              </p>

              {error && (
                <p className="text-xs text-red-600 mt-2">{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!description.trim() || submitting}
                className="w-full mt-3 py-2 rounded-xl text-sm font-medium text-white transition disabled:opacity-50"
                style={{ background: "#7B2FF2" }}
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          )}
        </div>
      )}

    </>
  );
}
