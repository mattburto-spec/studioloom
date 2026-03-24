"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import InlineEdit from "./InlineEdit";

interface PhaseSectionProps {
  phase: "opening" | "miniLesson" | "workTime" | "debrief";
  phaseDuration: number;
  onDurationChange: (newDuration: number) => void;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const PHASE_CONFIG: Record<
  string,
  {
    label: string;
    bgColor: string;
    borderColor: string;
    accentColor: string;
    description: string;
  }
> = {
  opening: {
    label: "Opening",
    bgColor: "bg-violet-50",
    borderColor: "border-l-4 border-violet-400",
    accentColor: "text-violet-700",
    description: "Hook & engage",
  },
  miniLesson: {
    label: "Mini-Lesson",
    bgColor: "bg-blue-50",
    borderColor: "border-l-4 border-blue-400",
    accentColor: "text-blue-700",
    description: "Direct instruction",
  },
  workTime: {
    label: "Work Time",
    bgColor: "bg-emerald-50",
    borderColor: "border-l-4 border-emerald-400",
    accentColor: "text-emerald-700",
    description: "Student activities",
  },
  debrief: {
    label: "Debrief",
    bgColor: "bg-amber-50",
    borderColor: "border-l-4 border-amber-400",
    accentColor: "text-amber-700",
    description: "Reflect & share",
  },
};

/**
 * PhaseSection — Collapsible phase wrapper for a lesson phase
 *
 * Shows:
 * - Header with phase name, duration chip, collapse chevron
 * - Color-coded left border per phase
 * - Framer Motion collapse animation
 * - Helper text for each phase
 */
export default function PhaseSection({
  phase,
  phaseDuration,
  onDurationChange,
  isOpen,
  onToggle,
  children,
}: PhaseSectionProps) {
  const [editingDuration, setEditingDuration] = useState(false);
  const [durationDraft, setDurationDraft] = useState(phaseDuration.toString());

  const config = PHASE_CONFIG[phase];

  const commitDuration = () => {
    const parsed = parseInt(durationDraft, 10);
    if (!isNaN(parsed) && parsed > 0) {
      onDurationChange(parsed);
    } else {
      setDurationDraft(phaseDuration.toString());
    }
    setEditingDuration(false);
  };

  return (
    <div className={`rounded-lg ${config.bgColor} ${config.borderColor} overflow-hidden mb-6`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <motion.div
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="flex-shrink-0"
          >
            <svg
              className={`w-5 h-5 ${config.accentColor}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
            </svg>
          </motion.div>

          <div className="flex-1">
            <h3 className={`font-semibold ${config.accentColor}`}>
              {config.label}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
          </div>
        </div>

        {/* Duration chip */}
        <div className="flex-shrink-0 ml-4">
          {editingDuration ? (
            <input
              type="number"
              min="1"
              max="180"
              value={durationDraft}
              onChange={(e) => setDurationDraft(e.target.value)}
              onBlur={commitDuration}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitDuration();
                if (e.key === "Escape") {
                  setDurationDraft(phaseDuration.toString());
                  setEditingDuration(false);
                }
              }}
              autoFocus
              className="w-12 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingDuration(true);
                setDurationDraft(phaseDuration.toString());
              }}
              className={`px-3 py-1 text-sm font-medium rounded-full ${config.accentColor} bg-white/60 hover:bg-white transition-colors`}
            >
              {phaseDuration} min
            </button>
          )}
        </div>
      </button>

      {/* Content */}
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="overflow-hidden"
      >
        <div className="px-4 py-4 border-t border-black/10">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
