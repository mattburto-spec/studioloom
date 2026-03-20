"use client";

import { useState, useCallback, useRef, useEffect, type FC } from "react";

// =========================================================================
// Types
// =========================================================================

export interface PhaseConfig {
  id: "opening" | "miniLesson" | "workTime" | "debrief";
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  /** Current duration in minutes */
  durationMinutes: number;
  /** Minimum allowed duration */
  minMinutes: number;
  /** Is this phase locked (won't auto-resize)? */
  locked: boolean;
}

export interface OverheadConfig {
  transitionMinutes: number;
  setupMinutes: number;
  cleanupMinutes: number;
  isWorkshop: boolean;
}

export interface PhaseTimelineBarProps {
  /** Raw period length in minutes */
  periodMinutes: number;
  /** The 4 workshop phases with current durations */
  phases: PhaseConfig[];
  /** Overhead (transition, setup, cleanup) */
  overhead: OverheadConfig;
  /** Instruction cap from 1+age rule */
  instructionCap: number;
  /** Callback when phases are resized */
  onPhasesChange: (phases: PhaseConfig[]) => void;
  /** Optional: apply a timing preset */
  onPresetApply?: (presetId: string) => void;
  /** Read-only mode (no dragging) */
  readOnly?: boolean;
}

// =========================================================================
// Constants
// =========================================================================

const PHASE_DEFAULTS: Record<string, { label: string; shortLabel: string; color: string; bgColor: string; borderColor: string }> = {
  opening: { label: "Opening", shortLabel: "Open", color: "#7C3AED", bgColor: "#F3E8FF", borderColor: "#C4B5FD" },
  miniLesson: { label: "Mini-Lesson", shortLabel: "Teach", color: "#2563EB", bgColor: "#DBEAFE", borderColor: "#93C5FD" },
  workTime: { label: "Work Time", shortLabel: "Work", color: "#16A34A", bgColor: "#DCFCE7", borderColor: "#86EFAC" },
  debrief: { label: "Debrief", shortLabel: "Debrief", color: "#D97706", bgColor: "#FEF3C7", borderColor: "#FCD34D" },
};

// =========================================================================
// Helper: build default phases from usable time
// =========================================================================

export function buildDefaultPhases(
  usableMinutes: number,
  instructionCap: number
): PhaseConfig[] {
  const opening = Math.min(7, Math.round(usableMinutes * 0.1));
  const miniLesson = Math.min(instructionCap, Math.round(usableMinutes * 0.2));
  const debrief = Math.min(8, Math.max(5, Math.round(usableMinutes * 0.08)));
  const workTime = usableMinutes - opening - miniLesson - debrief;

  return [
    { id: "opening", ...PHASE_DEFAULTS.opening, durationMinutes: Math.max(5, opening), minMinutes: 3, locked: false },
    { id: "miniLesson", ...PHASE_DEFAULTS.miniLesson, durationMinutes: miniLesson, minMinutes: 3, locked: false },
    { id: "workTime", ...PHASE_DEFAULTS.workTime, durationMinutes: Math.max(15, workTime), minMinutes: 15, locked: false },
    { id: "debrief", ...PHASE_DEFAULTS.debrief, durationMinutes: Math.max(5, debrief), minMinutes: 5, locked: false },
  ];
}

// =========================================================================
// Phase Timeline Bar Component
// =========================================================================

const PhaseTimelineBar: FC<PhaseTimelineBarProps> = ({
  periodMinutes,
  phases,
  overhead,
  instructionCap,
  onPhasesChange,
  onPresetApply,
  readOnly = false,
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [hoveredPhase, setHoveredPhase] = useState<string | null>(null);

  const totalOverhead = overhead.transitionMinutes
    + (overhead.isWorkshop ? overhead.setupMinutes + overhead.cleanupMinutes : 0);
  const usableMinutes = periodMinutes - totalOverhead;
  const totalPhaseMinutes = phases.reduce((sum, p) => sum + p.durationMinutes, 0);

  // Compute warnings
  const warnings: string[] = [];
  const miniLessonPhase = phases.find((p) => p.id === "miniLesson");
  const workTimePhase = phases.find((p) => p.id === "workTime");
  const debriefPhase = phases.find((p) => p.id === "debrief");

  if (miniLessonPhase && miniLessonPhase.durationMinutes > instructionCap) {
    warnings.push(`Mini-Lesson exceeds ${instructionCap}min cap (1 + student age)`);
  }
  if (workTimePhase && workTimePhase.durationMinutes / usableMinutes < 0.45) {
    warnings.push(`Work Time is below 45% — students need more making time`);
  }
  if (debriefPhase && debriefPhase.durationMinutes < 5) {
    warnings.push(`Debrief must be at least 5 minutes`);
  }

  // ---- Drag handling ----
  const handleMouseDown = useCallback(
    (dividerIndex: number) => {
      if (readOnly) return;
      setDragging(dividerIndex);
    },
    [readOnly]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging === null || !barRef.current) return;

      const rect = barRef.current.getBoundingClientRect();
      const overheadLeftWidth = overhead.isWorkshop
        ? ((overhead.transitionMinutes + overhead.setupMinutes) / periodMinutes) * rect.width
        : (overhead.transitionMinutes / periodMinutes) * rect.width;

      const usableWidth = (usableMinutes / periodMinutes) * rect.width;
      const relativeX = e.clientX - rect.left - overheadLeftWidth;
      const minuteAtCursor = (relativeX / usableWidth) * usableMinutes;

      // Calculate where the divider should be
      const leftPhases = phases.slice(0, dragging + 1);
      const rightPhases = phases.slice(dragging + 1);

      const leftMinTotal = leftPhases.reduce((sum, p) => sum + p.minMinutes, 0);
      const rightMinTotal = rightPhases.reduce((sum, p) => sum + p.minMinutes, 0);

      const clampedMinutes = Math.max(leftMinTotal, Math.min(usableMinutes - rightMinTotal, minuteAtCursor));

      // Redistribute: the phase to the left of the divider gets resized, the one to the right absorbs
      const leftPhase = phases[dragging];
      const rightPhase = phases[dragging + 1];

      if (leftPhase.locked || rightPhase.locked) return;

      const leftPrevious = leftPhases.slice(0, -1).reduce((sum, p) => sum + p.durationMinutes, 0);
      const newLeftDuration = Math.max(leftPhase.minMinutes, Math.round(clampedMinutes - leftPrevious));
      const newRightDuration = Math.max(
        rightPhase.minMinutes,
        leftPhase.durationMinutes + rightPhase.durationMinutes - newLeftDuration + leftPrevious + leftPhase.durationMinutes - clampedMinutes > 0
          ? rightPhase.durationMinutes + leftPhase.durationMinutes - newLeftDuration
          : rightPhase.minMinutes
      );

      // Simple two-phase redistribution
      const combined = leftPhase.durationMinutes + rightPhase.durationMinutes;
      const clampedLeft = Math.max(leftPhase.minMinutes, Math.min(combined - rightPhase.minMinutes, newLeftDuration));
      const clampedRight = combined - clampedLeft;

      const updated = phases.map((p) => {
        if (p.id === leftPhase.id) return { ...p, durationMinutes: clampedLeft };
        if (p.id === rightPhase.id) return { ...p, durationMinutes: clampedRight };
        return p;
      });

      onPhasesChange(updated);
    },
    [dragging, phases, overhead, periodMinutes, usableMinutes, onPhasesChange]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // ---- Toggle lock ----
  const toggleLock = (phaseId: string) => {
    if (readOnly) return;
    onPhasesChange(phases.map((p) => (p.id === phaseId ? { ...p, locked: !p.locked } : p)));
  };

  // ---- Render ----
  const overheadLeftPercent = overhead.isWorkshop
    ? ((overhead.transitionMinutes + overhead.setupMinutes) / periodMinutes) * 100
    : (overhead.transitionMinutes / periodMinutes) * 100;
  const overheadRightPercent = overhead.isWorkshop
    ? (overhead.cleanupMinutes / periodMinutes) * 100
    : 0;

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700">
          Lesson Timing — {periodMinutes}min period ({usableMinutes}min usable)
        </div>
        {onPresetApply && !readOnly && (
          <div className="flex gap-1.5">
            {[
              { id: "balanced", label: "Balanced" },
              { id: "hands-on-heavy", label: "Hands-On" },
              { id: "instruction-heavy", label: "Instruction" },
              { id: "critique-session", label: "Critique" },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => onPresetApply(preset.id)}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-gray-200 text-gray-600 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timeline bar */}
      <div
        ref={barRef}
        className="relative w-full h-14 rounded-xl overflow-hidden flex shadow-sm border border-gray-200"
        style={{ cursor: dragging !== null ? "col-resize" : "default" }}
      >
        {/* Left overhead (transition + setup) */}
        {overheadLeftPercent > 0 && (
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: `${overheadLeftPercent}%`,
              backgroundColor: "#F9FAFB",
              borderRight: "1px dashed #D1D5DB",
            }}
          >
            <span className="text-[10px] text-gray-400 font-medium">
              {overhead.isWorkshop ? `${overhead.transitionMinutes + overhead.setupMinutes}m` : `${overhead.transitionMinutes}m`}
            </span>
          </div>
        )}

        {/* Workshop phases */}
        {phases.map((phase, i) => {
          const widthPercent = (phase.durationMinutes / periodMinutes) * 100;
          const isHovered = hoveredPhase === phase.id;
          const workPercent = phase.id === "workTime" ? Math.round((phase.durationMinutes / usableMinutes) * 100) : null;
          const isOverCap = phase.id === "miniLesson" && phase.durationMinutes > instructionCap;
          const isUnderFloor = phase.id === "workTime" && phase.durationMinutes / usableMinutes < 0.45;
          const isUnderDebrief = phase.id === "debrief" && phase.durationMinutes < 5;
          const hasIssue = isOverCap || isUnderFloor || isUnderDebrief;

          return (
            <div key={phase.id} className="relative flex items-center" style={{ width: `${widthPercent}%` }}>
              {/* Phase block */}
              <div
                className="w-full h-full flex flex-col items-center justify-center transition-all duration-150 relative"
                style={{
                  backgroundColor: isHovered ? phase.bgColor : `${phase.bgColor}CC`,
                  borderLeft: i > 0 ? `2px solid ${phase.borderColor}` : "none",
                  outline: hasIssue ? "2px solid #EF4444" : "none",
                  outlineOffset: "-2px",
                }}
                onMouseEnter={() => setHoveredPhase(phase.id)}
                onMouseLeave={() => setHoveredPhase(null)}
              >
                {/* Lock indicator */}
                {phase.locked && (
                  <div className="absolute top-1 right-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill={phase.color} className="w-3 h-3 opacity-60">
                      <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1.5V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}

                {/* Phase content */}
                <span className="text-xs font-semibold truncate px-1" style={{ color: phase.color }}>
                  {widthPercent > 8 ? phase.label : phase.shortLabel}
                </span>
                <span className="text-[11px] font-bold" style={{ color: phase.color }}>
                  {phase.durationMinutes}m
                </span>
                {workPercent !== null && widthPercent > 12 && (
                  <span className="text-[9px] opacity-70" style={{ color: phase.color }}>
                    {workPercent}% of usable
                  </span>
                )}
              </div>

              {/* Drag handle (between phases) */}
              {i < phases.length - 1 && !readOnly && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-3 z-10 flex items-center justify-center group"
                  style={{
                    cursor: "col-resize",
                    transform: "translateX(50%)",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleMouseDown(i);
                  }}
                >
                  <div className="w-0.5 h-8 rounded-full bg-gray-300 group-hover:bg-purple-500 group-hover:w-1 transition-all" />
                </div>
              )}
            </div>
          );
        })}

        {/* Right overhead (cleanup) */}
        {overheadRightPercent > 0 && (
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: `${overheadRightPercent}%`,
              backgroundColor: "#F9FAFB",
              borderLeft: "1px dashed #D1D5DB",
            }}
          >
            <span className="text-[10px] text-gray-400 font-medium">{overhead.cleanupMinutes}m</span>
          </div>
        )}
      </div>

      {/* Phase details row */}
      <div className="flex gap-2">
        {phases.map((phase) => {
          const isOverCap = phase.id === "miniLesson" && phase.durationMinutes > instructionCap;
          const isUnderFloor = phase.id === "workTime" && phase.durationMinutes / usableMinutes < 0.45;

          return (
            <button
              key={phase.id}
              onClick={() => toggleLock(phase.id)}
              className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-colors"
              style={{
                borderColor: phase.locked ? phase.color : "#E5E7EB",
                backgroundColor: phase.locked ? `${phase.bgColor}` : "transparent",
              }}
              title={phase.locked ? "Click to unlock" : "Click to lock duration"}
            >
              {phase.locked ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3" style={{ color: phase.color }}>
                  <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1.5V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-gray-400">
                  <path d="M11.5 1A3.5 3.5 0 0 0 8 4.5V7H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1.5V4.5a2 2 0 1 1 4 0v1a.75.75 0 0 0 1.5 0v-1A3.5 3.5 0 0 0 11.5 1Z" />
                </svg>
              )}
              <span className="font-medium" style={{ color: phase.color }}>{phase.shortLabel}</span>
              <span className="text-gray-500">{phase.durationMinutes}m</span>
              {isOverCap && <span className="text-red-500 text-[10px]">over cap</span>}
              {isUnderFloor && <span className="text-red-500 text-[10px]">too short</span>}
            </button>
          );
        })}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
                <path fillRule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhaseTimelineBar;
