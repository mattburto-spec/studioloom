"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GalleryRoundCreator,
  GalleryMonitor,
  GalleryRoundCard,
  GalleryCanvasModal,
} from "@/components/gallery";
import type { UnitPage } from "@/types";

// ---------------------------------------------------------------------------
// GalleryDrawer — slide-out wrapper around the old Gallery tab (DT canvas
// Phase 3.5 Step 1, 16 May 2026). Lifted verbatim from the inline GalleryTab
// function that lived in page.tsx before the rebuild (Phase 3.1 Step 2 left
// it orphan when the tabs disappeared). Same Pin-Up Gallery management
// flow + same internal modals (Creator / Monitor / Canvas) — only the
// drawer chrome is new. Triggered by the gallery strip's "Open gallery →"
// CTA on the canvas, and by ?tab=gallery legacy compat (Phase 3.5 Step 2).
// ---------------------------------------------------------------------------

interface GalleryDrawerProps {
  unitId: string;
  classId: string;
  unitPages: UnitPage[];
  onClose: () => void;
}

export default function GalleryDrawer({ unitId, classId, unitPages, onClose }: GalleryDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [monitorRoundId, setMonitorRoundId] = useState<string | null>(null);
  const [canvasRoundId, setCanvasRoundId] = useState<string | null>(null);

  const loadRounds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/gallery?unitId=${unitId}&classId=${classId}`);
      if (res.ok) {
        const data = await res.json();
        setRounds(data.rounds || []);
      }
    } catch (e) {
      console.error("Failed to load gallery rounds:", e);
    } finally {
      setLoading(false);
    }
  }, [unitId, classId]);

  useEffect(() => { loadRounds(); }, [loadRounds]);

  // Close on click-outside + Escape. Skip when a child modal (Creator /
  // Monitor / Canvas) is open — those modals own the click target and
  // closing the drawer behind them would feel jumpy.
  useEffect(() => {
    const childOpen = showCreator || monitorRoundId !== null || canvasRoundId !== null;
    function handleClick(e: MouseEvent) {
      if (childOpen) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (childOpen) return;
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, showCreator, monitorRoundId, canvasRoundId]);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" />
      <div
        ref={panelRef}
        data-testid="gallery-drawer"
        className="fixed top-0 right-0 h-full w-[640px] max-w-[95vw] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{ animation: "galleryDrawerSlideIn 0.2s ease-out" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">Pin-Up Gallery</h2>
            <p className="text-xs text-gray-500">
              Create critique rounds where students share work and give peer feedback.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close gallery drawer"
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* New round button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreator(true)}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Gallery Round
            </button>
          </div>

          {/* Rounds list */}
          {loading ? (
            <div className="space-y-3">
              <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ) : rounds.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-900 font-semibold mb-1">No gallery rounds yet</p>
              <p className="text-gray-500 text-sm mb-4">Create a pin-up crit round for students to share work and give peer feedback.</p>
              <button
                onClick={() => setShowCreator(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition"
              >
                Create Your First Round
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rounds.map((round: any) => (
                <GalleryRoundCard
                  key={round.id}
                  round={round}
                  onClick={() => {
                    if (round.display_mode === "canvas") {
                      setCanvasRoundId(round.id);
                    } else {
                      setMonitorRoundId(round.id);
                    }
                  }}
                />
              ))}
            </div>
          )}

          {/* Info card — preserved from the inline GalleryTab */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
            <h3 className="font-semibold text-purple-900 flex items-center gap-2 mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
              About Pin-Up Gallery
            </h3>
            <p className="text-sm text-purple-700 leading-relaxed mb-3">
              Pin-up crits are a core design studio practice. Students share work-in-progress, then browse and give structured feedback to classmates. Effort-gated: students must complete their reviews before seeing feedback on their own work.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="bg-white/70 rounded-lg p-3 border border-purple-100">
                <div className="font-semibold text-purple-800 mb-1">Review Formats</div>
                <p className="text-purple-600 text-xs">Quick Comment, PMI Analysis, Two Stars &amp; a Wish, or any toolkit tool.</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3 border border-purple-100">
                <div className="font-semibold text-purple-800 mb-1">Effort-Gating</div>
                <p className="text-purple-600 text-xs">Students must complete minimum reviews before seeing their own feedback.</p>
              </div>
              <div className="bg-white/70 rounded-lg p-3 border border-purple-100">
                <div className="font-semibold text-purple-800 mb-1">MYP Criterion D</div>
                <p className="text-purple-600 text-xs">Structured peer evaluation maps directly to Criterion D (Evaluating).</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Child modals — rendered outside the drawer so click-outside on
          them doesn't punch through to the drawer's click-outside handler. */}
      {monitorRoundId && (
        <GalleryMonitor roundId={monitorRoundId} onClose={() => { setMonitorRoundId(null); loadRounds(); }} />
      )}
      {canvasRoundId && (
        <GalleryCanvasModal roundId={canvasRoundId} onClose={() => { setCanvasRoundId(null); loadRounds(); }} />
      )}
      {showCreator && (
        <GalleryRoundCreator
          unitId={unitId}
          classId={classId}
          pages={unitPages.map(p => ({ id: p.id, title: p.title }))}
          onCreated={() => { setShowCreator(false); loadRounds(); }}
          onClose={() => setShowCreator(false)}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes galleryDrawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}} />
    </>
  );
}
