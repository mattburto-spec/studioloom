"use client";

import Link from "next/link";
import type { WizardDispatch, WizardMode } from "@/hooks/useWizardState";

interface Props {
  dispatch: WizardDispatch;
  onSelectMode: (mode: WizardMode) => void;
}

export function ModeSelector({ onSelectMode }: Props) {
  return (
    <div className="animate-slide-up max-w-lg mx-auto" style={{ animationDelay: "100ms" }}>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={() => onSelectMode("build-for-me")}
          className="group w-full sm:w-auto flex-1 flex items-center gap-3 px-6 py-4 rounded-2xl bg-brand-purple text-white hover:bg-brand-violet transition-all duration-200 shadow-lg shadow-brand-purple/20 hover:shadow-xl hover:shadow-brand-purple/30 hover:scale-[1.02]"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-bold">Build it for me</div>
            <div className="text-xs text-white/70">AI fills in the details</div>
          </div>
        </button>

        <button
          onClick={() => onSelectMode("guide-me")}
          className="group w-full sm:w-auto flex-1 flex items-center gap-3 px-6 py-4 rounded-2xl border-2 border-border bg-white text-text-primary hover:border-brand-purple/30 hover:bg-brand-purple/5 transition-all duration-200 hover:scale-[1.02]"
        >
          <div className="w-10 h-10 rounded-xl bg-brand-purple/10 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-bold">Guide me through it</div>
            <div className="text-xs text-text-secondary">Step-by-step with AI help</div>
          </div>
        </button>
      </div>

      {/* Import existing option */}
      <div className="mt-4 text-center">
        <Link
          href="/teacher/units/import"
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
