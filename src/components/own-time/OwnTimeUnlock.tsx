"use client";

import { useState } from "react";

interface OwnTimeUnlockProps {
  studentId: string;
  studentName: string;
  classId: string;
  unitId: string;
  /** Whether this student already has Own Time approved */
  approved: boolean;
  approvedAt?: string | null;
  onApproved?: () => void;
}

/**
 * Teacher-facing component to unlock Own Time for a specific student.
 * Appears on the progress tracking page next to each student's row.
 *
 * Two states:
 * 1. NOT APPROVED — shows an unlock button
 * 2. APPROVED — shows a subtle "Own Time active" badge
 */
export function OwnTimeUnlock({
  studentId,
  studentName,
  classId,
  unitId,
  approved: initialApproved,
  approvedAt,
  onApproved,
}: OwnTimeUnlockProps) {
  const [approved, setApproved] = useState(initialApproved);
  const [showModal, setShowModal] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleApprove() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/teacher/own-time/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          classId,
          unitId,
          note: note.trim() || null,
        }),
      });
      if (res.ok) {
        setApproved(true);
        setShowModal(false);
        onApproved?.();
      }
    } catch {
      // Silent fail — will retry
    } finally {
      setSubmitting(false);
    }
  }

  if (approved) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold"
        style={{
          background: "rgba(56,189,248,0.08)",
          color: "#38bdf8",
          border: "1px solid rgba(56,189,248,0.15)",
        }}
        title={approvedAt ? `Approved ${new Date(approvedAt).toLocaleDateString()}` : "Own Time active"}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0" />
        </svg>
        Own Time
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
          e.currentTarget.style.background = "rgba(56,189,248,0.06)";
          e.currentTarget.style.color = "#38bdf8";
          e.currentTarget.style.borderColor = "rgba(56,189,248,0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(0,0,0,0.03)";
          e.currentTarget.style.color = "#94a3b8";
          e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)";
        }}
        title="Unlock Own Time for this student"
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
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(45,212,191,0.08))",
                  border: "1px solid rgba(56,189,248,0.2)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">Unlock Own Time</h2>
                <p className="text-sm text-text-secondary">
                  for {studentName}
                </p>
              </div>
            </div>

            <p className="text-sm text-text-secondary mb-4 leading-relaxed">
              This gives {studentName.split(" ")[0]} autonomous learning time with an AI
              mentor. They&apos;ll set their own goals and work at their own pace while
              you receive progress digests.
            </p>

            {/* Optional note */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Personal note <span className="text-text-secondary font-normal">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Great work on Criterion B — explore whatever interests you!"
                className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#38bdf8]/30 focus:border-[#38bdf8] transition-all text-sm resize-none"
                rows={3}
              />
              <p className="text-xs text-text-secondary mt-1.5">
                This note appears on the student&apos;s dashboard when they see Own Time is unlocked. A personal message makes it feel earned.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm text-text-secondary hover:bg-surface-alt transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #38bdf8, #2dd4bf)" }}
              >
                {submitting ? "Unlocking..." : "Unlock Own Time"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
