"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

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
    blurb: string;
    emoji: string;
    color: string; // CSS color string for left rail
  }
> = {
  opening: {
    label: "Opening",
    blurb: "Hook & engage",
    emoji: "🎯",
    color: "#0EA5E9",
  },
  miniLesson: {
    label: "Mini-Lesson",
    blurb: "Teacher-led demo · direct instruction",
    emoji: "🧑‍🏫",
    color: "#9333EA",
  },
  workTime: {
    label: "Work Time",
    blurb: "Student activities",
    emoji: "🛠",
    color: "#F59E0B",
  },
  debrief: {
    label: "Debrief",
    blurb: "Reflection · close the loop",
    emoji: "💬",
    color: "#16A34A",
  },
};

/**
 * PhaseSection — Workshop Model phase wrapper, warm-paper aesthetic.
 *
 * Layout matches the Unit Editor design:
 * - Header row: ± toggle, emoji, name, blurb, minutes chip, optional warning
 * - Children: indented with a colored left rail
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

  // While the height collapse animation is running we keep overflow:hidden
  // so children don't visually overflow the shrinking/growing box. Once the
  // animation settles we release it so absolute popovers (e.g. AITextField
  // suggestions) aren't clipped by this wrapper.
  const [animating, setAnimating] = useState(false);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), 500);
    return () => clearTimeout(t);
  }, [isOpen]);

  const config = PHASE_CONFIG[phase];
  const missingTiming = phaseDuration === 0;

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
    <div className="mt-4">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={onToggle}
          aria-label={isOpen ? "Collapse phase" : "Expand phase"}
          className="w-5 h-5 rounded-md border border-[var(--le-hair)] text-[10px] font-extrabold flex items-center justify-center bg-[var(--le-paper)] hover:bg-[var(--le-hair-2)] transition-colors text-[var(--le-ink-2)]"
        >
          {isOpen ? "−" : "+"}
        </button>
        <span className="text-[15px]">{config.emoji}</span>
        <div className="text-[13.5px] font-extrabold text-[var(--le-ink)]">{config.label}</div>
        <div className="text-[11px] text-[var(--le-ink-3)]">· {config.blurb}</div>
        <div className="ml-auto flex items-center gap-2">
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
              className="w-12 px-2 py-0.5 text-[11px] border border-[var(--le-hair)] rounded-md bg-[var(--le-paper)] text-[var(--le-ink)] focus:outline-none focus:border-[var(--le-ink)]"
            />
          ) : (
            <button
              onClick={() => {
                setEditingDuration(true);
                setDurationDraft(phaseDuration.toString());
              }}
              className="text-[11px] font-extrabold le-tnum text-[var(--le-ink-2)] hover:text-[var(--le-ink)] transition-colors"
            >
              {phaseDuration} min
            </button>
          )}
          {missingTiming && (
            <span className="text-[10.5px] font-extrabold tracking-wider uppercase px-2 py-[3px] border rounded-full bg-amber-50 text-amber-900 border-amber-200">
              ⚠ No timing
            </span>
          )}
        </div>
      </div>

      {/* Children — indented with colored left rail. */}
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={isOpen && !animating ? "" : "overflow-hidden"}
      >
        <div
          className="ml-7 border-l-2 pl-4 space-y-2"
          style={{ borderColor: `${config.color}55` }}
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
}
