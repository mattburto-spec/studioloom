"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { NMElementsPanel, NMResultsPanel } from "@/components/nm";
import UnitAttentionPanel from "@/components/teacher/UnitAttentionPanel";
import type { NMUnitConfig } from "@/lib/nm/constants";

// ---------------------------------------------------------------------------
// MetricsDrawer — slide-out wrapper around the old New Metrics tab content
// (DT canvas Phase 3.2 Step 4, 16 May 2026). Triggered by the side-rail
// "Class metrics · this unit" card CTA. Stacks:
//   1. NMElementsPanel (collapsed by default once elements are picked)
//   2. UnitAttentionPanel (the daily-driver rotation list)
//   3. NMResultsPanel (per-element drill-down)
//   4. "Per-lesson checkpoints live in the lesson editor" pointer banner
// Mirrors the layout that lived inside the old `activeTab === "metrics"`
// block before the canvas rebuild. No behavioural change to NM/Attention.
// ---------------------------------------------------------------------------

interface MetricsDrawerProps {
  unitId: string;
  classId: string;
  globalNmEnabled: boolean;
  nmConfig: NMUnitConfig;
  onNmConfigChange: (next: NMUnitConfig) => Promise<void> | void;
  onClose: () => void;
}

export default function MetricsDrawer({
  unitId,
  classId,
  globalNmEnabled,
  nmConfig,
  onNmConfigChange,
  onClose,
}: MetricsDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" />
      <div
        ref={panelRef}
        data-testid="metrics-drawer"
        className="fixed top-0 right-0 h-full w-[640px] max-w-[95vw] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{ animation: "metricsDrawerSlideIn 0.2s ease-out" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">Class metrics · this unit</h2>
            <p className="text-xs text-gray-500">
              Pick which Melbourne Metrics elements to track + drill into per-student observations.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close metrics drawer"
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {globalNmEnabled ? (
            <>
              {/* NM element picker — collapsed once configured */}
              <details className="group" open={!(nmConfig?.elements?.length)}>
                <summary className="cursor-pointer select-none px-4 py-3 rounded-xl border border-border bg-surface-alt hover:bg-gray-50 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-text-primary">
                    {nmConfig?.elements?.length
                      ? `NM settings — tracking ${nmConfig.elements.length} of 12 elements (click to edit)`
                      : "NM settings — pick which elements to track"}
                  </span>
                  <span className="text-xs text-text-secondary group-open:hidden">expand</span>
                  <span className="text-xs text-text-secondary hidden group-open:inline">collapse</span>
                </summary>
                <div className="mt-3">
                  <NMElementsPanel
                    currentConfig={nmConfig}
                    onSave={async (next) => {
                      await onNmConfigChange(next);
                    }}
                  />
                </div>
              </details>

              {/* Daily-driver attention rotation */}
              <UnitAttentionPanel unitId={unitId} classId={classId} />

              {/* Per-element drill-down */}
              <NMResultsPanel unitId={unitId} classId={classId} />

              {/* Stub for PaceFeedbackSummary — was dropped from the
                  canvas in Phase 3.1 Step 3 per G7 ("folds into the
                  Metrics detail sheet"). Lives here as a greyed
                  placeholder so the un-stub work has a destination
                  (the original PaceFeedbackSummary component still
                  exists; just needs to be mounted + styled to fit
                  the drawer's vertical stack). */}
              <div
                data-testid="metrics-drawer-pace-feedback-stub"
                aria-disabled="true"
                className="px-4 py-3 rounded-xl border border-dashed border-border bg-surface-alt/40 opacity-60 cursor-not-allowed flex items-start gap-3"
              >
                <span className="text-text-tertiary text-lg flex-shrink-0">⏱</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text-secondary text-sm mb-0.5">
                    Pace feedback summary
                    <span className="text-[10px] text-text-tertiary italic font-normal ml-2">coming soon</span>
                  </h3>
                  <p className="text-xs text-text-tertiary leading-relaxed">
                    Per-lesson pace distribution from student post-lesson
                    surveys — was on the canvas Progress tab before the
                    rebuild, folding back in here once the drawer's
                    vertical stack has room.
                  </p>
                </div>
              </div>

              {/* Lesson-editor pointer */}
              <div className="px-4 py-3 rounded-xl border border-violet-200 bg-violet-50/60 flex items-start gap-3">
                <span className="text-violet-700 text-lg flex-shrink-0">🎯</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text-primary text-sm mb-0.5">
                    Per-lesson checkpoints live in the lesson editor
                  </h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    The NM settings above control <strong>which</strong> elements you track. To choose <strong>when</strong> students rate themselves, open any lesson, expand the <strong>New Metrics</strong> block category in the Blocks pane, and click an element to register a checkpoint on that lesson.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 bg-gray-50 rounded-xl border border-border text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <h3 className="font-semibold text-text-primary mb-1">New Metrics</h3>
              <p className="text-sm text-text-secondary mb-3">
                Enable New Metrics in your school settings to configure competency assessments for this class.
              </p>
              <Link href="/teacher/settings?tab=school" className="text-purple-600 text-sm font-medium hover:underline">
                Go to Settings →
              </Link>
            </div>
          )}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes metricsDrawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}} />
    </>
  );
}
