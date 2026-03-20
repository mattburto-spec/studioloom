"use client";

import { useState, useEffect, useCallback, useRef, type FC } from "react";
import type { WorkshopPhases } from "@/types";

// =========================================================================
// Types
// =========================================================================

type PhaseId = "opening" | "miniLesson" | "workTime" | "debrief";

interface Phase {
  id: PhaseId;
  label: string;
  durationSeconds: number;
  color: string;
  bgColor: string;
  icon: string;
  hint?: string; // e.g., hook, focus, protocol
}

export interface PhaseTimerProps {
  workshopPhases: WorkshopPhases;
  /** Total period length in minutes (for overhead display) */
  periodMinutes?: number;
  /** Callback when phase transitions */
  onPhaseChange?: (phaseId: PhaseId, phaseIndex: number) => void;
  /** Callback when lesson completes */
  onLessonComplete?: () => void;
  /** Compact mode for sidebar */
  compact?: boolean;
}

// =========================================================================
// Constants
// =========================================================================

const PHASE_META: Record<PhaseId, { label: string; color: string; bgColor: string; icon: string }> = {
  opening:    { label: "Opening",     color: "#7C3AED", bgColor: "#F3E8FF", icon: "🎯" },
  miniLesson: { label: "Mini-Lesson", color: "#2563EB", bgColor: "#DBEAFE", icon: "📖" },
  workTime:   { label: "Work Time",   color: "#16A34A", bgColor: "#DCFCE7", icon: "🔨" },
  debrief:    { label: "Debrief",     color: "#D97706", bgColor: "#FEF3C7", icon: "💬" },
};

// =========================================================================
// Helpers
// =========================================================================

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(Math.abs(totalSeconds) / 60);
  const secs = Math.abs(totalSeconds) % 60;
  const sign = totalSeconds < 0 ? "-" : "";
  return `${sign}${mins}:${secs.toString().padStart(2, "0")}`;
}

function buildPhases(wp: WorkshopPhases): Phase[] {
  return [
    {
      id: "opening",
      label: PHASE_META.opening.label,
      durationSeconds: wp.opening.durationMinutes * 60,
      color: PHASE_META.opening.color,
      bgColor: PHASE_META.opening.bgColor,
      icon: PHASE_META.opening.icon,
      hint: wp.opening.hook,
    },
    {
      id: "miniLesson",
      label: PHASE_META.miniLesson.label,
      durationSeconds: wp.miniLesson.durationMinutes * 60,
      color: PHASE_META.miniLesson.color,
      bgColor: PHASE_META.miniLesson.bgColor,
      icon: PHASE_META.miniLesson.icon,
      hint: wp.miniLesson.focus,
    },
    {
      id: "workTime",
      label: PHASE_META.workTime.label,
      durationSeconds: wp.workTime.durationMinutes * 60,
      color: PHASE_META.workTime.color,
      bgColor: PHASE_META.workTime.bgColor,
      icon: PHASE_META.workTime.icon,
      hint: wp.workTime.focus,
    },
    {
      id: "debrief",
      label: PHASE_META.debrief.label,
      durationSeconds: wp.debrief.durationMinutes * 60,
      color: PHASE_META.debrief.color,
      bgColor: PHASE_META.debrief.bgColor,
      icon: PHASE_META.debrief.icon,
      hint: wp.debrief.protocol || wp.debrief.prompt,
    },
  ];
}

// =========================================================================
// Component
// =========================================================================

const PhaseTimer: FC<PhaseTimerProps> = ({
  workshopPhases,
  periodMinutes,
  onPhaseChange,
  onLessonComplete,
  compact = false,
}) => {
  const phases = buildPhases(workshopPhases);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(phases[0].durationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const warningAudioRef = useRef<HTMLAudioElement | null>(null);

  const currentPhase = phases[currentPhaseIndex];
  const totalDuration = phases.reduce((sum, p) => sum + p.durationSeconds, 0);
  const phaseElapsed = currentPhase.durationSeconds - secondsRemaining;
  const phasePct = currentPhase.durationSeconds > 0
    ? Math.min(100, (phaseElapsed / currentPhase.durationSeconds) * 100)
    : 100;
  const overallPct = totalDuration > 0
    ? Math.min(100, (totalElapsed / totalDuration) * 100)
    : 100;

  // Tick
  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Phase complete — advance
          setCurrentPhaseIndex((idx) => {
            const next = idx + 1;
            if (next >= phases.length) {
              setIsRunning(false);
              setIsComplete(true);
              onLessonComplete?.();
              return idx;
            }
            setSecondsRemaining(phases[next].durationSeconds);
            onPhaseChange?.(phases[next].id, next);
            return next;
          });
          return 0;
        }
        // Warning at 60 seconds
        if (prev === 61) {
          try {
            warningAudioRef.current?.play();
          } catch { /* no audio is fine */ }
        }
        return prev - 1;
      });
      setTotalElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, phases, onPhaseChange, onLessonComplete]);

  const toggleTimer = useCallback(() => {
    if (isComplete) {
      // Reset
      setCurrentPhaseIndex(0);
      setSecondsRemaining(phases[0].durationSeconds);
      setTotalElapsed(0);
      setIsComplete(false);
      setIsRunning(false);
    } else {
      setIsRunning((prev) => !prev);
    }
  }, [isComplete, phases]);

  const skipToPhase = useCallback((index: number) => {
    if (index < 0 || index >= phases.length) return;
    // Calculate elapsed up to this phase
    let elapsed = 0;
    for (let i = 0; i < index; i++) {
      elapsed += phases[i].durationSeconds;
    }
    setCurrentPhaseIndex(index);
    setSecondsRemaining(phases[index].durationSeconds);
    setTotalElapsed(elapsed);
    setIsComplete(false);
    onPhaseChange?.(phases[index].id, index);
  }, [phases, onPhaseChange]);

  // Warning state
  const isWarning = secondsRemaining <= 60 && secondsRemaining > 0 && isRunning;
  const isOvertime = secondsRemaining <= 0 && !isComplete;

  // -----------------------------------------------------------------------
  // Compact mode (sidebar)
  // -----------------------------------------------------------------------
  if (compact) {
    return (
      <div className="space-y-3">
        {/* Phase pills */}
        <div className="flex gap-1">
          {phases.map((p, i) => (
            <button
              key={p.id}
              onClick={() => skipToPhase(i)}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-center transition-all"
              style={{
                background: i === currentPhaseIndex ? p.color : p.bgColor,
                color: i === currentPhaseIndex ? "#fff" : p.color,
                opacity: i < currentPhaseIndex ? 0.5 : 1,
              }}
            >
              {p.icon} {Math.round(p.durationSeconds / 60)}m
            </button>
          ))}
        </div>

        {/* Timer display */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTimer}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md transition-transform hover:scale-105"
            style={{ background: isComplete ? "#6B7280" : currentPhase.color }}
          >
            {isComplete ? "↺" : isRunning ? "⏸" : "▶"}
          </button>
          <div className="flex-1">
            <div
              className="text-2xl font-mono font-bold tabular-nums"
              style={{ color: isWarning ? "#DC2626" : currentPhase.color }}
            >
              {formatTime(secondsRemaining)}
            </div>
            <div className="text-[10px] text-gray-500 font-medium">
              {currentPhase.icon} {currentPhase.label}
              {currentPhase.hint && ` — ${currentPhase.hint}`}
            </div>
          </div>
        </div>

        {/* Phase progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${phasePct}%`, background: currentPhase.color }}
          />
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Full mode (main dashboard)
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Hidden audio for warning chime */}
      <audio ref={warningAudioRef} preload="none">
        {/* A simple beep — browsers may block autoplay, that's fine */}
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==" type="audio/wav" />
      </audio>

      {/* Phase timeline — horizontal bar showing all phases */}
      <div className="flex rounded-xl overflow-hidden h-12 border border-gray-200">
        {phases.map((p, i) => {
          const widthPct = (p.durationSeconds / totalDuration) * 100;
          const isCurrent = i === currentPhaseIndex;
          const isPast = i < currentPhaseIndex;
          return (
            <button
              key={p.id}
              onClick={() => skipToPhase(i)}
              className="relative flex items-center justify-center transition-all hover:brightness-95"
              style={{
                width: `${widthPct}%`,
                background: isCurrent ? p.color : isPast ? `${p.color}33` : p.bgColor,
                color: isCurrent ? "#fff" : isPast ? `${p.color}99` : p.color,
                cursor: "pointer",
              }}
            >
              <span className="text-xs font-bold whitespace-nowrap">
                {p.icon} {p.label}
              </span>
              <span className="absolute bottom-0.5 text-[9px] font-mono opacity-70">
                {Math.round(p.durationSeconds / 60)}m
              </span>
              {/* Active indicator */}
              {isCurrent && (
                <div
                  className="absolute bottom-0 left-0 h-1 transition-all duration-1000"
                  style={{ width: `${phasePct}%`, background: "rgba(255,255,255,0.5)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Main timer display */}
      <div className="flex items-center gap-6">
        {/* Play/pause button */}
        <button
          onClick={toggleTimer}
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{ background: isComplete ? "#6B7280" : isWarning ? "#DC2626" : currentPhase.color }}
        >
          {isComplete ? "↺" : isRunning ? "⏸" : "▶"}
        </button>

        {/* Time + phase info */}
        <div className="flex-1">
          <div
            className={`text-5xl font-mono font-black tabular-nums leading-none ${isWarning ? "animate-pulse" : ""}`}
            style={{ color: isWarning ? "#DC2626" : currentPhase.color }}
          >
            {formatTime(secondsRemaining)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-sm font-bold"
              style={{ color: currentPhase.color }}
            >
              {currentPhase.icon} {currentPhase.label}
            </span>
            {currentPhase.hint && (
              <span className="text-xs text-gray-500">— {currentPhase.hint}</span>
            )}
          </div>
        </div>

        {/* Skip buttons */}
        <div className="flex gap-2">
          {currentPhaseIndex > 0 && (
            <button
              onClick={() => skipToPhase(currentPhaseIndex - 1)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50"
            >
              ← Prev
            </button>
          )}
          {currentPhaseIndex < phases.length - 1 && (
            <button
              onClick={() => skipToPhase(currentPhaseIndex + 1)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50"
            >
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-gray-400 font-medium">
          <span>{formatTime(totalElapsed)} elapsed</span>
          <span>{formatTime(totalDuration - totalElapsed)} remaining</span>
        </div>
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-purple-500 via-blue-500 to-green-500"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Checkpoints (if work time has them) */}
      {currentPhase.id === "workTime" && workshopPhases.workTime.checkpoints && workshopPhases.workTime.checkpoints.length > 0 && (
        <div className="bg-green-50 rounded-xl p-3 border border-green-100">
          <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1">
            Work Time Checkpoints
          </p>
          <ul className="space-y-1">
            {workshopPhases.workTime.checkpoints.map((cp, i) => (
              <li key={i} className="text-xs text-green-800 flex items-start gap-1.5">
                <span className="text-green-400 mt-0.5">○</span>
                {cp}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PhaseTimer;
