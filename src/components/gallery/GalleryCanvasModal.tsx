"use client";

/**
 * Teacher-facing canvas modal for a gallery round in canvas display mode.
 *
 * Fetches the round + submissions from /api/teacher/gallery/[roundId], renders
 * GalleryCanvasView, and persists teacher-driven card moves via PATCH to
 * /api/teacher/gallery/[roundId]/layout (debounced inside the canvas view).
 *
 * Spec: docs/projects/gallery-v2.md §10 GV2-1
 */

import { useCallback, useEffect, useState } from "react";
import { GalleryCanvasView, type CanvasSubmission, type CanvasLayoutChange } from "./GalleryCanvasView";

interface GalleryCanvasModalProps {
  roundId: string;
  onClose: () => void;
}

interface FetchedRound {
  id: string;
  title: string;
  description: string;
  anonymous: boolean;
  status: "open" | "closed";
  display_mode: "grid" | "canvas";
  submissions: Array<{
    id: string;
    student_id: string;
    student_name: string;
    context_note: string | null;
    canvas_x: number | null;
    canvas_y: number | null;
  }>;
}

export function GalleryCanvasModal({ roundId, onClose }: GalleryCanvasModalProps) {
  const [round, setRound] = useState<FetchedRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/teacher/gallery/${roundId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load round (${res.status})`);
        const data = await res.json();
        if (!cancelled) {
          setRound(data.round);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load round");
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  const handleLayoutChange = useCallback(
    async (changes: CanvasLayoutChange[]) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/teacher/gallery/${roundId}/layout`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissions: changes.map((c) => ({
              id: c.submissionId,
              canvas_x: c.x,
              canvas_y: c.y,
            })),
          }),
        });
        if (!res.ok) throw new Error(`Save failed (${res.status})`);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch (err) {
        console.error("[GalleryCanvasModal] Layout save failed:", err);
        setSaveStatus("error");
      }
    },
    [roundId]
  );

  const canvasSubmissions: CanvasSubmission[] = (round?.submissions || []).map((s) => ({
    id: s.id,
    studentId: s.student_id,
    studentName: s.student_name,
    contextNote: s.context_note,
    canvasX: s.canvas_x,
    canvasY: s.canvas_y,
  }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">
              {round?.title || "Loading…"}
            </h2>
            <p className="text-xs text-purple-100 mt-0.5">
              Canvas mode · drag cards to arrange
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-xs text-purple-100 min-w-[70px] text-right"
              data-testid="gallery-canvas-save-status"
            >
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "saved" && "Saved ✓"}
              {saveStatus === "error" && "Save failed"}
              {saveStatus === "idle" && ""}
            </span>
            <button
              onClick={onClose}
              className="text-purple-100 hover:text-white transition-colors text-xl leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-4 overflow-auto">
          {loading ? (
            <div className="h-96 flex items-center justify-center text-gray-500 text-sm">
              Loading submissions…
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-800">
              {error}
            </div>
          ) : round ? (
            <GalleryCanvasView
              roundId={roundId}
              submissions={canvasSubmissions}
              isTeacher={true}
              anonymous={round.anonymous}
              onLayoutChange={handleLayoutChange}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
