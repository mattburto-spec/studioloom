"use client";

/**
 * /teacher/pitches — review queue for "Other / Pitch your own"
 * Product Brief proposals from students.
 *
 * FU-PLATFORM-CUSTOM-PROJECT-PITCH MVP (shipped 12 May 2026).
 *
 * Reads from GET /api/teacher/product-brief-pitch (returns pending +
 * revise pitches across all classes the teacher manages). Each pitch
 * card has three actions: Approve / Request Revision / Reject.
 *
 * Approval unblocks the student's slot walker. Revision sends them
 * back with a note. Reject also clears archetype_id so the student
 * returns to the picker and can pick a preset instead.
 */

import { useCallback, useEffect, useState } from "react";

interface Pitch {
  studentId: string;
  studentName: string;
  unitId: string;
  unitTitle: string;
  pitchText: string;
  pitchStatus: "pending" | "revise";
  pitchTeacherNote: string | null;
  updatedAt: string;
}

export default function TeacherPitchesPage() {
  const [pitches, setPitches] = useState<Pitch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decisionInFlight, setDecisionInFlight] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/teacher/product-brief-pitch", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Load failed: ${res.status}`);
      const data = await res.json();
      setPitches(data.pitches ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(
    pitch: Pitch,
    action: "approve" | "revise" | "reject",
    note: string | null,
  ) {
    const key = `${pitch.studentId}-${pitch.unitId}`;
    setDecisionInFlight(key);
    try {
      const res = await fetch("/api/teacher/product-brief-pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: pitch.studentId,
          unitId: pitch.unitId,
          action,
          note,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `${res.status}`);
      }
      // Refresh the list — the just-decided pitch drops out.
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save decision");
    } finally {
      setDecisionInFlight(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          💡 Pitches awaiting review
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Students who picked &ldquo;Other / Pitch your own&rdquo; on a Product
          Brief block. Approve to unlock their slot walker, request a revision
          with a note, or redirect them to a preset archetype.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 mb-4 text-sm text-rose-900">
          {error}
        </div>
      )}

      {pitches === null && !error && (
        <p className="text-sm text-gray-500 italic">Loading…</p>
      )}

      {pitches !== null && pitches.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No pitches awaiting review. Students who pick &ldquo;Other / Pitch
          your own&rdquo; will appear here.
        </div>
      )}

      <div className="space-y-4">
        {(pitches ?? []).map((pitch) => {
          const key = `${pitch.studentId}-${pitch.unitId}`;
          const busy = decisionInFlight === key;
          return (
            <PitchCard
              key={key}
              pitch={pitch}
              busy={busy}
              onApprove={(note) => decide(pitch, "approve", note)}
              onRevise={(note) => decide(pitch, "revise", note)}
              onReject={(note) => decide(pitch, "reject", note)}
            />
          );
        })}
      </div>
    </div>
  );
}

function PitchCard({
  pitch,
  busy,
  onApprove,
  onRevise,
  onReject,
}: {
  pitch: Pitch;
  busy: boolean;
  onApprove: (note: string | null) => void;
  onRevise: (note: string) => void;
  onReject: (note: string | null) => void;
}) {
  const [note, setNote] = useState("");

  const statusBadge =
    pitch.pitchStatus === "revise" ? (
      <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-xs font-medium">
        revision in progress
      </span>
    ) : (
      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
        pending
      </span>
    );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{pitch.studentName}</h3>
          <p className="text-xs text-gray-500">{pitch.unitTitle}</p>
        </div>
        {statusBadge}
      </div>

      {pitch.pitchStatus === "revise" && pitch.pitchTeacherNote && (
        <div className="mb-3 rounded-lg bg-gray-50 border border-gray-200 p-2 text-xs">
          <span className="font-semibold text-gray-600">
            Your previous note:
          </span>{" "}
          <span className="italic text-gray-700">
            &ldquo;{pitch.pitchTeacherNote}&rdquo;
          </span>
        </div>
      )}

      <div className="rounded-lg bg-purple-50/50 border border-purple-100 p-3 mb-4 whitespace-pre-wrap text-sm text-gray-900">
        {pitch.pitchText}
      </div>

      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Optional note to student
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Required for revision. Optional for approve / reject."
          rows={2}
          disabled={busy}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:bg-gray-50"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onApprove(note.trim() || null)}
          disabled={busy}
          className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => {
            const trimmed = note.trim();
            if (trimmed.length === 0) {
              alert("Please add a note explaining what to revise.");
              return;
            }
            onRevise(trimmed);
          }}
          disabled={busy}
          className="px-4 py-2 text-sm font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
        >
          Request revision
        </button>
        <button
          type="button"
          onClick={() => onReject(note.trim() || null)}
          disabled={busy}
          className="px-4 py-2 text-sm font-semibold border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 disabled:opacity-50"
        >
          Redirect to preset
        </button>
      </div>
    </div>
  );
}
