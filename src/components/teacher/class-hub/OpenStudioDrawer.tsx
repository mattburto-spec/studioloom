"use client";

import { useEffect, useRef } from "react";
import { OpenStudioClassView } from "@/components/open-studio";

// ---------------------------------------------------------------------------
// OpenStudioDrawer — slide-out wrapper around OpenStudioClassView (DT
// canvas Phase 3.2 Step 3, 16 May 2026). Triggered by the side-rail
// "Open Studio" card CTA. Wraps the existing class-view UI as-is in
// drawer chrome; no behavioural change to OS unlock/revoke/check-in.
// ---------------------------------------------------------------------------

interface OpenStudioDrawerProps {
  unitId: string;
  classId: string;
  onClose: () => void;
}

export default function OpenStudioDrawer({ unitId, classId, onClose }: OpenStudioDrawerProps) {
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
        data-testid="open-studio-drawer"
        className="fixed top-0 right-0 h-full w-[560px] max-w-[92vw] bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{ animation: "openStudioDrawerSlideIn 0.2s ease-out" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">Open Studio</h2>
            <p className="text-xs text-gray-500">
              Unlock self-directed working time. Drift detection + check-ins apply automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Open Studio drawer"
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <OpenStudioClassView unitId={unitId} classId={classId} />
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes openStudioDrawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}} />
    </>
  );
}
