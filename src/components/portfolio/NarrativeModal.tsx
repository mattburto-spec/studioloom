"use client";

import { useState, useEffect } from "react";
import { getPageList } from "@/lib/unit-adapter";
import { buildNarrativeSections } from "@/lib/narrative-utils";
import { NarrativeView } from "./NarrativeView";
import type { Unit, StudentProgress, PortfolioEntry } from "@/types";

interface NarrativeModalProps {
  open: boolean;
  onClose: () => void;
  unit: Unit;
  progress: StudentProgress[];
  studentName: string;
}

export function NarrativeModal({
  open,
  onClose,
  unit,
  progress,
  studentName,
}: NarrativeModalProps) {
  const [portfolioEntries, setPortfolioEntries] = useState<PortfolioEntry[]>([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  // Round 10 (6 May 2026) — fetch FRESH progress on open. The `progress`
  // prop is stale: it's the snapshot from when the parent lesson page
  // mounted, which is BEFORE the student saved their journal. Without
  // this fetch, journal entries written in the current session never
  // surface in the narrative even though student_progress.responses
  // does have them on the server.
  const [freshProgress, setFreshProgress] = useState<StudentProgress[] | null>(
    null
  );

  // Fetch portfolio entries + fresh progress when modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingPortfolio(true);

    const portfolioPromise = fetch(`/api/student/portfolio?unitId=${unit.id}`)
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data) => setPortfolioEntries(data.entries || []))
      .catch(() => setPortfolioEntries([]));

    // Refresh progress so just-saved journal entries (and any other
    // autosaved responses) appear in the narrative immediately.
    const progressPromise = fetch(`/api/student/unit?unitId=${unit.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.progress) {
          setFreshProgress(data.progress as StudentProgress[]);
        } else {
          setFreshProgress(null);
        }
      })
      .catch(() => setFreshProgress(null));

    Promise.allSettled([portfolioPromise, progressPromise]).finally(() =>
      setLoadingPortfolio(false)
    );
  }, [open, unit.id]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  // Round 10 — prefer freshProgress (just-fetched) over the stale prop.
  // Falls back to the prop if the refresh failed (or hasn't fired yet).
  const effectiveProgress = freshProgress ?? progress;

  // Build narrative sections from progress + pages (with portfolio
  // filtering). LIS.E — pass portfolioEntries so manual Portfolio
  // captures of regular text responses surface in Narrative.
  const allPages = getPageList(unit.content_data);
  const sections = buildNarrativeSections(
    allPages,
    effectiveProgress,
    portfolioEntries,
  );

  // Date range
  const dates = [
    ...effectiveProgress.map((p) => p.updated_at),
    ...portfolioEntries.map((e) => e.created_at),
  ]
    .filter(Boolean)
    .sort();
  const dateRange =
    dates.length > 0
      ? { start: dates[0], end: dates[dates.length - 1] }
      : null;

  const firstPageId = allPages.length > 0 ? allPages[0].id : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-3 md:inset-6 z-50 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in">
        {/* Override the NarrativeView toolbar with our own modal header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <h2 className="text-sm font-semibold text-gray-800">
              Design Narrative
            </h2>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print / Save PDF
          </button>
        </div>

        {/* Scrollable narrative content */}
        <div className="flex-1 overflow-y-auto">
          {loadingPortfolio ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-sm text-gray-400">Loading narrative...</div>
            </div>
          ) : (
            <NarrativeView
              unitTitle={unit.title}
              unitDescription={unit.description}
              studentName={studentName}
              sections={sections}
              portfolioEntries={portfolioEntries}
              dateRange={dateRange}
              unitId={unit.id}
              firstPageId={firstPageId}
              hideToolbar
            />
          )}
        </div>
      </div>
    </>
  );
}
