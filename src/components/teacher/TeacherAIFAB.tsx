"use client";

import { useState, useRef, useEffect } from "react";

// ---------------------------------------------------------------------------
// Floating # AI assistant button for teacher dashboard
// ---------------------------------------------------------------------------

const QUICK_ACTIONS = [
  { label: "Create a class", action: "create-class", icon: "M12 5v14m-7-7h14" },
  { label: "Build a unit", action: "build-unit", icon: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" },
  { label: "Browse toolkit", action: "browse-toolkit", icon: "M2 4h20v16H2zM12 4v16M2 12h20" },
  { label: "Import a resource", action: "import-resource", icon: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" },
];

interface TeacherAIFABProps {
  onAction?: (action: string) => void;
}

export default function TeacherAIFAB({ onAction }: TeacherAIFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeenPulse, setHasSeenPulse] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Stop pulsing after first open
  useEffect(() => {
    if (isOpen && !hasSeenPulse) setHasSeenPulse(true);
  }, [isOpen, hasSeenPulse]);

  function handleAction(action: string) {
    setIsOpen(false);
    if (action === "browse-toolkit") {
      window.location.href = "/teacher/toolkit";
    } else if (action === "build-unit") {
      // QUARANTINED (3 Apr 2026) — Generation pipeline disabled pending Dimensions2 rebuild
      // window.location.href = "/teacher/units/create";
      return; // silently no-op
    } else if (onAction) {
      onAction(action);
    }
  }

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-50">
      {/* Quick actions panel */}
      {isOpen && (
        <div
          className="absolute bottom-16 right-0 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
          style={{
            animation: "fabSlideUp 0.2s ease-out",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(123,47,242,0.1)",
          }}
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
              >
                <svg width="12" height="12" viewBox="0 0 32 32" fill="none">
                  <rect x="2" y="8" width="28" height="5" rx="2.5" fill="white" />
                  <rect x="2" y="19" width="28" height="5" rx="2.5" fill="white" />
                  <rect x="8" y="2" width="5" height="28" rx="2.5" fill="white" />
                  <rect x="19" y="2" width="5" height="28" rx="2.5" fill="white" />
                </svg>
              </div>
              <span className="text-sm font-bold text-gray-900">Quick Actions</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">What would you like to do?</p>
          </div>

          <div className="p-2">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.action}
                onClick={() => handleAction(qa.action)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-purple-50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-50 group-hover:bg-purple-100 flex items-center justify-center transition-colors flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={qa.icon} />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700 transition-colors">{qa.label}</span>
              </button>
            ))}
          </div>

          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 text-center">AI chat assistant coming soon</p>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl active:scale-95"
        style={{
          background: isOpen
            ? "linear-gradient(135deg, #5C16C5, #4F46E5)"
            : "linear-gradient(135deg, #7B2FF2, #5C16C5)",
          boxShadow: isOpen
            ? "0 8px 30px rgba(123, 47, 242, 0.4)"
            : "0 8px 30px rgba(123, 47, 242, 0.3)",
        }}
        title="Quick actions"
      >
        {/* Pulse ring — only before first open */}
        {!hasSeenPulse && !isOpen && (
          <span
            className="absolute inset-0 rounded-2xl animate-ping"
            style={{ background: "rgba(123, 47, 242, 0.25)", animationDuration: "2s" }}
          />
        )}

        {/* # icon or X */}
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <rect x="2" y="8" width="28" height="5" rx="2.5" fill="white" />
            <rect x="2" y="19" width="28" height="5" rx="2.5" fill="white" />
            <rect x="8" y="2" width="5" height="28" rx="2.5" fill="white" />
            <rect x="19" y="2" width="5" height="28" rx="2.5" fill="white" />
          </svg>
        )}
      </button>

      <style>{`
        @keyframes fabSlideUp {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
