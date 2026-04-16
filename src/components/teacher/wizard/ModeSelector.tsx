"use client";

import Link from "next/link";
import type { WizardMode } from "@/hooks/useWizardState";

interface Props {
  onSelectMode: (mode: WizardMode) => void;
  /** Last-used lane (from localStorage). Shows a subtle badge on that card. */
  lastUsed?: WizardMode | null;
}

/**
 * LaneSelector - Choose between 3 wizard lanes
 * Exported as ModeSelector for backward compatibility with imports
 */
export function ModeSelector({ onSelectMode, lastUsed }: Props) {
  return (
    <div className="animate-slide-up max-w-4xl mx-auto" style={{ animationDelay: "100ms" }}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Express Lane */}
        <button
          onClick={() => onSelectMode("build-for-me")}
          className="group relative flex flex-col items-start p-6 rounded-2xl bg-brand-purple text-white hover:bg-brand-violet transition-all duration-200 shadow-lg shadow-brand-purple/20 hover:shadow-xl hover:shadow-brand-purple/30 hover:scale-[1.02]"
        >
          {lastUsed === "build-for-me" && (
            <span className="absolute top-3 right-3 text-[9px] font-medium bg-white/20 text-white/90 px-2 py-0.5 rounded-full">Last used</span>
          )}
          <div className="mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              {/* Lightning bolt icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
          </div>
          <div className="text-left flex-1">
            <div className="text-lg font-bold mb-1">Express</div>
            <div className="text-sm text-white/80 mb-3">Just build it</div>
            <div className="text-xs text-white/70">3 clicks — AI makes all decisions</div>
          </div>
        </button>

        {/* Guided Lane */}
        <button
          onClick={() => onSelectMode("guide-me")}
          className={`group relative flex flex-col items-start p-6 rounded-2xl border-2 bg-white text-text-primary hover:border-brand-purple/30 hover:bg-brand-purple/5 transition-all duration-200 hover:scale-[1.02] ${
            lastUsed === "guide-me" ? "border-brand-purple/20" : "border-border"
          }`}
        >
          {lastUsed === "guide-me" && (
            <span className="absolute top-3 right-3 text-[9px] font-medium bg-brand-purple/10 text-brand-purple px-2 py-0.5 rounded-full">Last used</span>
          )}
          <div className="mb-4">
            <div className="w-12 h-12 rounded-xl bg-brand-purple/10 flex items-center justify-center">
              {/* Chat bubble icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
          </div>
          <div className="text-left flex-1">
            <div className="text-lg font-bold mb-1">Guided</div>
            <div className="text-sm text-text-primary mb-3">Walk me through it</div>
            <div className="text-xs text-text-secondary">Step-by-step with AI help</div>
          </div>
        </button>

        {/* Architect Lane */}
        <button
          onClick={() => onSelectMode("architect" as WizardMode)}
          className={`group relative flex flex-col items-start p-6 rounded-2xl border-2 bg-white text-text-primary hover:border-brand-purple/30 hover:bg-brand-purple/5 transition-all duration-200 hover:scale-[1.02] ${
            lastUsed === "architect" ? "border-brand-purple/20" : "border-border"
          }`}
        >
          {lastUsed === "architect" && (
            <span className="absolute top-3 right-3 text-[9px] font-medium bg-brand-purple/10 text-brand-purple px-2 py-0.5 rounded-full">Last used</span>
          )}
          <div className="mb-4">
            <div className="w-12 h-12 rounded-xl bg-brand-purple/10 flex items-center justify-center">
              {/* Wrench icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 1 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
          </div>
          <div className="text-left flex-1">
            <div className="text-lg font-bold mb-1">Architect</div>
            <div className="text-sm text-text-primary mb-3">Full control</div>
            <div className="text-xs text-text-secondary">Every field visible, power users</div>
          </div>
        </button>
      </div>

      {/* Import existing option */}
      <div className="mt-6 text-center">
        <Link
          href="/teacher/library/import"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-text-secondary hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50/30 transition-all"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Import existing lesson plan
        </Link>
      </div>
    </div>
  );
}
