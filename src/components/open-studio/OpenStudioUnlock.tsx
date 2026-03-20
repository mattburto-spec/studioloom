"use client";

import { useState } from "react";

interface OpenStudioUnlockProps {
  studentId: string;
  studentName: string;
  classId: string;
  unitId: string;
  /** Whether this student already has Open Studio unlocked */
  unlocked: boolean;
  unlockedAt?: string | null;
  onUnlocked?: () => void;
}

/**
 * Teacher-facing inline component to unlock/show Open Studio status for a student.
 * Replaces OwnTimeUnlock on the progress tracking page.
 *
 * Two states:
 * 1. NOT UNLOCKED — shows an unlock button
 * 2. UNLOCKED — shows a subtle "Open Studio" badge
 */
export function OpenStudioUnlock({
  studentId,
  studentName,
  classId,
  unitId,
  unlocked: initialUnlocked,
  unlockedAt,
  onUnlocked,
}: OpenStudioUnlockProps) {
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [showModal, setShowModal] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleUnlock() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/teacher/open-studio/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          classId,
          unitId,
          teacherNote: note.trim() || null,
        }),
      });
      if (res.ok) {
        setUnlocked(true);
        setShowModal(false);
        onUnlocked?.();
      }
    } catch {
      // Silent fail — will retry
    } finally {
      setSubmitting(false);
    }
  }

  if (unlocked) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold"
        style={{
          background: "rgba(124,58,237,0.08)",
          color: "#7c3aed",
          border: "1px solid rgba(124,58,237,0.15)",
        }}
        title={unlockedAt ? `Unlocked ${new Date(unlockedAt).toLocaleDateString()}` : "Open Studio active"}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0" />
        </svg>
        Studio
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-200 hover:scale-105"
        style={{
          background: "rgba(0,0,0,0.03)",
          color: "#94a3b8",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(124,58,237,0.06)";
          e.currentTarget.style.color = "#7c3aed";
          e.currentTarget.style.borderColor = "rgba(124,58,237,0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(0,0,0,0.03)";
          e.currentTarget.style.color = "#94a3b8";
          e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)";
        }}
        title="Unlock Open Studio for this student"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Unlock
      </button>

      {/* Approval Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          style={{ backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl border border-border animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(167,139,250,0.08))",
                  border: "1px solid rgba(124,58,237,0.2)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">Unlock Open Studio</h2>
                <p className="text-sm text-text-secondary">
                  for {studentName}
                </p>
              </div>
            </div>

            <p className="text-sm text-text-secondary mb-4 leading-relaxed">
              This switches {studentName.split(" ")[0]}&apos;s AI mentor from guided tutor to
              studio critic. They&apos;ll choose their own direction while the AI
              observes, checks in periodically, and gives honest feedback when asked.
            </p>

            <div className="mb-5">
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Personal note <span className="text-text-secondary font-normal">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. You've been managing your process really well — time to drive your own design!"
                className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/30 focus:border-[#7c3aed] transition-all text-sm resize-none"
                rows={3}
              />
              <p className="text-xs text-text-secondary mt-1.5">
                This note appears when they see Open Studio is unlocked. A personal message makes it feel earned.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm text-text-secondary hover:bg-surface-alt transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlock}
                disabled={submitting}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)" }}
              >
                {submitting ? "Unlocking..." : "Unlock Open Studio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
